import { dbService, CandidateProfile, JobPosting } from '../../config/firebase';
import { GeminiService } from '../../config/gemini';
import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

export class CvTailorer {
  /**
   * Tailors the candidate's CV layout and profile descriptions to match the job posting,
   * compiles the tailored version into a PDF via Playwright, and uploads it to Firebase/local storage.
   */
  static async tailorCv(profile: CandidateProfile, job: JobPosting, jobDescription: string): Promise<string> {
    console.log(`[CV Tailorer] Initiating CV tailoring for role: "${job.title}" at "${job.company}"`);

    const prompt = `
      You are an expert technical resume writer.
      You are given a candidate's master profile details and a specific job description.
      Rewrite/tailor the candidate's resume to match the requirements of the job description.
      
      CRITICAL RULES:
      1. Do NOT invent fake experiences, fake employers, fake project metrics, or fake credentials. Be completely honest.
      2. Emphasize the skills, technologies, and achievements from the candidate's profile that directly match the job description.
      3. Customize the professional summary to explain exactly why they are a strong fit for this specific job.
      4. Adapt the experience bullet points to highlight matching stacks (e.g. Node, React, Go, etc.) and architectural challenges.
      5. Output ONLY a clean, valid, professional HTML resume.
      6. Include a simple, clean, modern inline CSS style block in the HTML head. Suitable for professional A4 print format (dark charcoal text, white bg, clear margins, clean fonts like Arial/Helvetica, no decorative fluff).
      7. Return ONLY the raw HTML code. Do NOT wrap it in markdown code blocks (\`\`\`html).
      
      Job Details:
      - Title: ${job.title}
      - Company: ${job.company}
      - Description: ${jobDescription}
      
      Candidate Profile:
      ${JSON.stringify(profile, null, 2)}
    `;

    const tailoredHtml = await GeminiService.generateText(prompt, () => {
      // Fallback simple HTML if Gemini fails/is mock
      return `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Resume - ${profile.name}</title>
            <style>
              body { font-family: 'Arial', sans-serif; margin: 40px; color: #333; line-height: 1.5; font-size: 14px; }
              .header { text-align: center; margin-bottom: 20px; }
              h1 { color: #111; margin-bottom: 5px; font-size: 24px; }
              h2 { border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-top: 25px; color: #2c3e50; font-size: 18px; }
              ul { margin-top: 5px; }
              .job-title-company { display: flex; justify-content: space-between; font-weight: bold; }
              .date-range { font-style: italic; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>${profile.name}</h1>
              <p>${profile.email} | ${profile.phone} | ${profile.location}</p>
            </div>
            
            <h2>Professional Summary</h2>
            <p>Targeted software professional with ${profile.experienceYears} years of experience, tailored specifically for the ${job.title} role at ${job.company}. Emphasizing core matching capabilities in development, system architecture, and team collaboration.</p>
            
            <h2>Technical Skills</h2>
            <p><strong>Frontend:</strong> ${profile.skills?.frontend?.join(', ') || 'React, TypeScript'}</p>
            <p><strong>Backend:</strong> ${profile.skills?.backend?.join(', ') || 'Node.js, Go'}</p>
            <p><strong>Databases:</strong> ${profile.skills?.databases?.join(', ') || 'PostgreSQL'}</p>
            <p><strong>DevOps:</strong> ${profile.skills?.devops?.join(', ') || 'Docker'}</p>

            <h2>Professional Experience</h2>
            <div>
              <div class="job-title-company">
                <span>Senior Software Engineer</span>
                <span class="date-range">Present</span>
              </div>
              <ul>
                <li>Designed and implemented high-performance features aligning directly with ${job.title} requirements.</li>
                <li>Worked in a collaborative engineering team utilizing ${profile.skills?.frontend?.[0] || 'React'} and ${profile.skills?.backend?.[0] || 'Go'} to build scalable products.</li>
              </ul>
            </div>
          </body>
        </html>
      `;
    });

    const tempDir = path.resolve(process.cwd(), 'storage/temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const pdfFileName = `tailored_cv_${job.jobId}_${Date.now()}.pdf`;
    const tempPdfPath = path.join(tempDir, pdfFileName);

    console.log(`[CV Tailorer] Generating PDF using Playwright headless browser...`);
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.setContent(tailoredHtml);
      await page.waitForLoadState('networkidle');
      await page.pdf({
        path: tempPdfPath,
        format: 'A4',
        margin: { top: '15mm', bottom: '15mm', left: '15mm', right: '15mm' }
      });
      console.log(`[CV Tailorer] Tailored PDF generated successfully at ${tempPdfPath}`);
    } finally {
      await browser.close();
    }

    // Upload to firebase (will automatically clean up local tempPdfPath after successful upload)
    const storageDestPath = `tailored_cvs/${pdfFileName}`;
    console.log(`[CV Tailorer] Uploading tailored resume...`);
    const remoteUrl = await dbService.uploadFile(tempPdfPath, storageDestPath);
    console.log(`[CV Tailorer] Tailored resume available at: ${remoteUrl}`);
    return remoteUrl;
  }
}
