import { extractTextFromCv } from './cv-extractor';
import { dbService, CandidateProfile } from '../../config/firebase';
import { GeminiService } from '../../config/gemini';
import { Type } from '@google/genai';
import * as fs from 'fs';
import * as path from 'path';

// Gemini Schema definitions
const profileSchema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING, description: 'Full name of the candidate' },
    email: { type: Type.STRING, description: 'Primary contact email' },
    phone: { type: Type.STRING, description: 'Primary contact phone number with country code' },
    location: { type: Type.STRING, description: 'Current location (city, country)' },
    professionalSummary: { 
      type: Type.STRING, 
      description: 'A 2-3 sentence executive professional summary of candidate background and expertise' 
    },
    targetLocations: { 
      type: Type.ARRAY, 
      items: { type: Type.STRING },
      description: 'Geographical regions or countries candidate is targeting for employment' 
    },
    targetRoles: { 
      type: Type.ARRAY, 
      items: { type: Type.STRING },
      description: 'Primary job titles / target roles matching candidate experience (e.g., Social Media Strategist, Growth Marketing Manager, Senior Frontend Engineer, Product Manager, etc.)' 
    },
    potentiallyQualifiedRoles: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Adjacent, lateral, and transferable job titles the candidate is potentially qualified for based on their demonstrated skills and past responsibilities (e.g. Brand Marketing Manager, Communications Specialist, Digital Content Manager, Public Relations Specialist, Campaign Manager, Influencer Marketing Specialist)'
    },
    coreSkills: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Top core domain skills, methodologies, and competencies relevant to candidate profession'
    },
    toolsAndPlatforms: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Software, platforms, tools, and technologies used (e.g. Meta Ads, Google Analytics, Canva, HubSpot, Figma, Docker, Excel, Notion, Salesforce, AWS)'
    },
    skills: {
      type: Type.OBJECT,
      properties: {
        core: { type: Type.ARRAY, items: { type: Type.STRING } },
        tools: { type: Type.ARRAY, items: { type: Type.STRING } },
        frontend: { type: Type.ARRAY, items: { type: Type.STRING } },
        backend: { type: Type.ARRAY, items: { type: Type.STRING } },
        databases: { type: Type.ARRAY, items: { type: Type.STRING } },
        devops: { type: Type.ARRAY, items: { type: Type.STRING } }
      },
      description: 'Categorized list of competencies'
    },
    experienceYears: { 
      type: Type.INTEGER, 
      description: 'Total number of years of professional work experience' 
    },
    salaryExpectationEUR: {
      type: Type.OBJECT,
      properties: {
        min: { type: Type.INTEGER },
        target: { type: Type.INTEGER },
        currency: { type: Type.STRING }
      },
      description: 'Annual salary expectation'
    },
    workAuthorization: { 
      type: Type.STRING, 
      description: 'Work authorization or relocation preference (e.g., Relocation Ready / Requires Sponsorship / Remote Worldwide)' 
    },
    cvStoragePath: { type: Type.STRING, description: 'Path or link to resume' }
  },
  required: ['name', 'email', 'phone', 'location', 'targetRoles', 'coreSkills', 'experienceYears', 'workAuthorization']
};

export class ProfileService {
  /**
   * Parses a candidate resume from a PDF or DOCX file, structures it with Gemini, and saves it.
   */
  static async parseAndSaveProfile(cvPath: string, relativeStoragePath: string): Promise<CandidateProfile> {
    console.log(`Starting CV Ingestion: Extracting text from ${cvPath}`);
    const rawText = await extractTextFromCv(cvPath);
    console.log(`Extracted raw text (${rawText.length} chars). Invoking Gemini for profile structuring...`);

    const prompt = `
      You are an expert talent recruiter and resume parser supporting all professions (Marketing, Social Media, Growth, Design, Product Management, Software Engineering, Sales, Operations, Finance, Legal, etc.).
      Analyze the following raw text from a candidate's resume and structure it strictly into the requested JSON schema.
      
      Resume text:
      ---
      ${rawText}
      ---
      
      Instructions:
      1. Target Roles: Extract 3-5 standard industry job titles directly matching the candidate's exact background and career trajectory.
      2. Potentially Qualified Roles: Analyze the candidate's transferable skills, tools, and responsibilities to generate 4-8 adjacent, lateral, or related job titles they would be strong candidates for (e.g., for a Growth/Social Media marketer: Brand Marketing Manager, Digital Content Strategist, Communications Specialist, Influencer Marketing Lead, Public Relations Manager, Campaign Specialist).
      3. Core Skills: Extract 6-12 top domain capabilities, strategic competencies, and methodologies (e.g. Social Media Strategy, Growth Marketing, Content Creation, Community Management, Copywriting, SEO, Financial Analysis, React, UI Design).
      4. Tools & Platforms: Extract software, platforms, apps, frameworks, or cloud tools mentioned (e.g. Meta Ads, Google Analytics, Canva, HubSpot, Figma, Hootsuite, Mailchimp, Docker, Notion, Excel, Salesforce).
      5. Skills Object: Populate 'core' with domain skills, 'tools' with software/platforms, and if technical, populate frontend/backend/databases/devops.
      6. Extract total professional experience in years, current location, phone with country code, and email.
      7. For target locations, if not explicitly specified in the text, use ["Worldwide", "Remote", "United States", "United Kingdom", "Europe", "Canada", "Nigeria"].
    `;

    const structuredProfile = await GeminiService.generateJson<CandidateProfile>(
      prompt,
      profileSchema,
      () => this.extractProfileFromRawText(rawText, relativeStoragePath)
    );

    if (!structuredProfile.skills) {
      structuredProfile.skills = {};
    }
    if (structuredProfile.coreSkills?.length && !structuredProfile.skills.core?.length) {
      structuredProfile.skills.core = structuredProfile.coreSkills;
    }
    if (structuredProfile.toolsAndPlatforms?.length && !structuredProfile.skills.tools?.length) {
      structuredProfile.skills.tools = structuredProfile.toolsAndPlatforms;
    }

    console.log(`Uploading CV file to storage destination: ${relativeStoragePath}`);
    const cvStorageUrl = await dbService.uploadFile(cvPath, relativeStoragePath);

    structuredProfile.cvStoragePath = cvStorageUrl;
    structuredProfile.updatedAt = new Date().toISOString();

    console.log('Profile successfully structured. Storing in database...');
    await dbService.saveProfile(structuredProfile);
    console.log('Ingestion and Profile creation complete.');
    return structuredProfile;
  }

  /**
   * Intelligently extracts candidate details from raw CV text when Gemini API is offline or in mock mode.
   * Completely dynamic — NEVER uses hardcoded dummy profiles.
   */
  static extractProfileFromRawText(rawText: string, storagePath: string): CandidateProfile {
    const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);

    // 1. Name extraction from top lines
    let name = '';
    for (let i = 0; i < Math.min(lines.length, 8); i++) {
      const line = lines[i];
      if (line.includes('@') || line.includes('http') || line.includes('+') || /\d{3,}/.test(line) || line.length > 50 || line.length < 3) {
        continue;
      }
      if (/^[A-Za-z\s.'-]+$/.test(line) && line.split(/\s+/).length >= 2 && line.split(/\s+/).length <= 5) {
        name = line.toUpperCase();
        break;
      }
    }
    if (!name && lines.length > 0) {
      name = lines[0].replace(/[^A-Za-z\s.'-]/g, '').trim().toUpperCase() || 'CANDIDATE';
    }

    // 2. Email extraction
    const emailMatch = rawText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    const email = emailMatch ? emailMatch[0].toLowerCase() : '';

    // 3. Phone extraction
    const phoneMatch = rawText.match(/(?:\+?\d{1,4}[-.\s]?)?(?:\(?\d{2,4}\)?[-.\s]?)?\d{3,4}[-.\s]?\d{3,4}/);
    const phone = phoneMatch ? phoneMatch[0].trim() : '';

    // 4. Location extraction
    let location = 'Abuja, Nigeria';
    const locKeywords = ['Abuja', 'Lagos', 'Ibadan', 'Port Harcourt', 'Nigeria', 'Nairobi', 'Kenya', 'Accra', 'Ghana', 'Kigali', 'Rwanda', 'London', 'Berlin', 'Amsterdam', 'United Kingdom', 'Germany', 'Netherlands', 'Canada', 'United States', 'South Africa'];
    for (const kw of locKeywords) {
      if (rawText.toLowerCase().includes(kw.toLowerCase())) {
        if (kw === 'Abuja' || kw === 'Lagos' || kw === 'Ibadan' || kw === 'Port Harcourt') location = `${kw}, Nigeria`;
        else if (kw === 'Nairobi') location = 'Nairobi, Kenya';
        else if (kw === 'Accra') location = 'Accra, Ghana';
        else if (kw === 'Kigali') location = 'Kigali, Rwanda';
        else location = kw;
        break;
      }
    }

    // 5. Professional Summary extraction
    let professionalSummary = '';
    const summaryMatch = rawText.match(/(?:summary|profile|about\s+me|overview|executive\s+summary)[\s:]*\n+([\s\S]{50,400}?)(?:\n\s*\n|[A-Z\s]{4,}:)/i);
    if (summaryMatch) {
      professionalSummary = summaryMatch[1].replace(/\s+/g, ' ').trim();
    } else {
      for (const line of lines.slice(1, 10)) {
        if (line.length > 60 && !line.includes('@')) {
          professionalSummary = line.trim();
          break;
        }
      }
    }

    // 6. Dynamic Target Roles extraction (discovers titles from header & experience layout)
    const targetRoles: string[] = [];
    
    const isSectionHeader = (text: string) => {
      const clean = text.trim().toLowerCase().replace(/[^a-z\s]/g, '');
      return /^(professional summary|executive summary|summary|profile|about me|about|work experience|professional experience|employment history|experience|education|skills|core competencies|competencies|technical skills|tools|tools and platforms|contact|languages|certifications|awards|projects|interests)$/i.test(clean) ||
             /^(summary|experience|education|skills|competencies|tools|certifications|projects|work)/i.test(clean);
    };

    const isContactOrLink = (str: string) => /[@+:]|https?|\.com/i.test(str);

    // Look for professional title lines near top header
    for (const line of lines.slice(1, 6)) {
      if (line.length < 4 || line.length > 60 || isContactOrLink(line) || isSectionHeader(line)) {
        continue;
      }
      const cleanTitle = line.replace(/[|•·,].*$/, '').trim();
      if (cleanTitle.length >= 4 && !isSectionHeader(cleanTitle) && !targetRoles.includes(cleanTitle)) {
        targetRoles.push(cleanTitle);
      }
    }

    // Look for experience section job position headings across the resume
    const experienceRoleRegex = /(?:^|\n)\s*([A-Z][A-Za-z0-9\s/&-]{3,45}?)\s*(?:\||–|-|at\s+|@|\(\s*(?:19|20)\d\d|\b(?:19|20)\d\d\b)/g;
    let match: RegExpExecArray | null;
    while ((match = experienceRoleRegex.exec(rawText)) !== null) {
      const candidateTitle = match[1].replace(/[\n\r]+/g, ' ').trim();
      if (!isSectionHeader(candidateTitle) && candidateTitle.split(/\s+/).length <= 5 && candidateTitle.length >= 4) {
        if (!targetRoles.includes(candidateTitle)) {
          targetRoles.push(candidateTitle);
        }
      }
      if (targetRoles.length >= 5) break;
    }

    if (targetRoles.length === 0) {
      targetRoles.push('Specialist');
    }

    // 7. Dynamic Core Skills & Tools extraction from sections
    const coreSkills: string[] = [];
    const toolsAndPlatforms: string[] = [];

    // Extract raw items under skills / competencies / expertise / tools headers
    const skillsSectionMatch = rawText.match(/(?:skills|core\s+competencies|technical\s+skills|expertise|capabilities|tools\s*&\s*platforms)[\s:]*\n+([\s\S]{30,600}?)(?:\n\s*\n|[A-Z\s]{4,}:|$)/i);
    if (skillsSectionMatch) {
      const items = skillsSectionMatch[1]
        .split(/[,•·|\n\t]+/)
        .map(s => s.trim().replace(/^[-*]\s*/, ''))
        .filter(s => s.length >= 2 && s.length <= 40 && !s.includes(':'));
      
      for (const item of items) {
        if (!coreSkills.includes(item)) {
          coreSkills.push(item);
        }
      }
    }

    // Extract tools / software mentioned
    const toolsSectionMatch = rawText.match(/(?:tools|software|platforms|technologies|stack)[\s:]*\n+([\s\S]{30,400}?)(?:\n\s*\n|[A-Z\s]{4,}:|$)/i);
    if (toolsSectionMatch) {
      const items = toolsSectionMatch[1]
        .split(/[,•·|\n\t]+/)
        .map(s => s.trim().replace(/^[-*]\s*/, ''))
        .filter(s => s.length >= 2 && s.length <= 40 && !s.includes(':'));
      
      for (const item of items) {
        if (!toolsAndPlatforms.includes(item)) {
          toolsAndPlatforms.push(item);
        }
      }
    }

    // 8. Experience Years calculation
    const years = rawText.match(/\b(19\d\d|20\d\d)\b/g);
    let experienceYears = 4;
    if (years && years.length >= 2) {
      const numYears = years.map(Number).filter(y => y >= 2000 && y <= new Date().getFullYear());
      if (numYears.length >= 2) {
        const minYear = Math.min(...numYears);
        const maxYear = Math.max(...numYears);
        experienceYears = Math.max(1, Math.min(25, maxYear - minYear));
      }
    }

    // 9. Dynamic Potentially Qualified / Transferable Roles generation
    const potentiallyQualifiedRoles: string[] = [];
    
    // Generate transferable and adjacent variations from primary target roles and top competencies
    for (const role of targetRoles.slice(0, 3)) {
      const baseRole = role.replace(/^(Senior|Lead|Junior|Staff|Principal)\s+/i, '').trim();
      const variations = [
        `Senior ${baseRole}`,
        `Lead ${baseRole}`,
        `${baseRole} Specialist`,
        `${baseRole} Consultant`,
        `${baseRole} Strategist`,
        `${baseRole} Manager`
      ];
      for (const v of variations) {
        if (v !== role && !targetRoles.includes(v) && !potentiallyQualifiedRoles.includes(v)) {
          potentiallyQualifiedRoles.push(v);
        }
        if (potentiallyQualifiedRoles.length >= 6) break;
      }
    }

    // If candidate has top core skills, generate domain-focused role titles
    for (const skill of coreSkills.slice(0, 3)) {
      if (skill.length >= 4 && skill.split(/\s+/).length <= 3) {
        const domainRoles = [`${skill} Specialist`, `${skill} Strategist`, `${skill} Manager`];
        for (const dr of domainRoles) {
          if (!targetRoles.includes(dr) && !potentiallyQualifiedRoles.includes(dr)) {
            potentiallyQualifiedRoles.push(dr);
          }
          if (potentiallyQualifiedRoles.length >= 8) break;
        }
      }
    }

    return {
      name: name || 'CANDIDATE',
      email: email || 'candidate@example.com',
      phone: phone || '+234 000 000 0000',
      location,
      professionalSummary: professionalSummary || `Experienced professional in ${targetRoles.slice(0, 2).join(' & ') || 'their field'} with expertise in ${coreSkills.slice(0, 3).join(', ') || 'their domain'}.`,
      targetRoles: targetRoles.length ? targetRoles : ['Specialist'],
      potentiallyQualifiedRoles,
      targetLocations: ['Worldwide', 'Remote Worldwide', 'United States', 'United Kingdom', 'Remote EU', 'Canada', 'Nigeria'],
      coreSkills: coreSkills.length ? coreSkills : ['Strategic Planning', 'Problem Solving'],
      toolsAndPlatforms: toolsAndPlatforms.length ? toolsAndPlatforms : ['Productivity Tools'],
      skills: {
        core: coreSkills,
        tools: toolsAndPlatforms
      },
      customCategories: [],
      experienceYears,
      salaryExpectationEUR: {
        currency: 'EUR',
        min: 65000,
        target: 80000
      },
      workAuthorization: 'Relocation Ready / Remote Worldwide / Requires Sponsorship',
      cvStoragePath: storagePath,
      updatedAt: new Date().toISOString()
    };
  }
}
