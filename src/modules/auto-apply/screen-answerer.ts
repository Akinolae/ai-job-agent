import { GeminiService } from '../../config/gemini';
import { CandidateProfile } from '../../config/firebase';

export class ScreenAnswerer {
  /**
   * Generates a 1-2 sentence response for application screening questions.
   */
  static async answerQuestion(
    questionText: string,
    profile: CandidateProfile,
    jobTitle: string,
    company: string
  ): Promise<string> {
    const prompt = `
      You are an assistant applying for a job on behalf of ${profile.name}.
      
      Candidate Profile:
      - Name: ${profile.name}
      - Experience: ${profile.experienceYears} years
      - Skills: ${JSON.stringify(profile.skills)}
      - Work Authorization: ${profile.workAuthorization}
      - Salary expectation: ${JSON.stringify(profile.salaryExpectationEUR)}
      
      Job Context:
      - Title: ${jobTitle}
      - Company: ${company}
      
      Form Question:
      "${questionText}"
      
      Task:
      Generate a professional, truthful 1-2 sentence answer to this question on behalf of ${profile.name}.
      Do not exaggerate or invent qualifications that are not in the profile.
      Keep it brief and clean.
    `;

    return GeminiService.generateText(prompt, () => 
      this.getMockAnswer(questionText, profile, jobTitle, company)
    );
  }

  /**
   * Generates heuristics-based mock answers for local test runs.
   */
  private static getMockAnswer(
    questionText: string,
    profile: CandidateProfile,
    jobTitle: string,
    company: string
  ): string {
    const q = questionText.toLowerCase();

    if (q.includes('sponsorship') || q.includes('visa') || q.includes('work authorization') || q.includes('work in')) {
      return `Yes, I require visa sponsorship. I am currently based in Nigeria and am eligible for the EU Blue Card.`;
    }
    
    if (q.includes('notice period') || q.includes('start date') || q.includes('start when') || q.includes('available')) {
      return `My notice period is 1 month, but I am ready to start immediately once visa procedures are completed.`;
    }

    if (q.includes('salary') || q.includes('compensation') || q.includes('expectation')) {
      return `My salary expectation is €${profile.salaryExpectationEUR.target.toLocaleString()} gross per year.`;
    }

    if (q.includes('why') || q.includes('interest') || q.includes('excited')) {
      return `I am excited about ${company}'s work and scaling challenges. My experience with ${profile.skills.frontend?.slice(0, 2).join(' and ')} aligns perfectly with the ${jobTitle} role.`;
    }

    if (q.includes('experience') || q.includes('how many years') || q.includes('kubernetes') || q.includes('react') || q.includes('go')) {
      return `I have over ${profile.experienceYears} years of professional experience, including extensive production work with modern React, TypeScript, and backend architectures.`;
    }

    return `Yes, I have hands-on experience deploying scalable web architectures and am excited to bring these skills to the team at ${company}.`;
  }

  /**
   * Selects the single best option matching the candidate's profile from a list of dropdown/radio options.
   */
  static async selectBestOption(
    questionText: string,
    options: { value: string; text: string }[],
    profile: CandidateProfile,
    jobTitle: string,
    company: string
  ): Promise<string> {
    const prompt = `
      You are an assistant applying for a job on behalf of ${profile.name}.
      
      Candidate Profile:
      - Name: ${profile.name}
      - Experience: ${profile.experienceYears} years
      - Skills: ${JSON.stringify(profile.skills)}
      - Work Authorization: ${profile.workAuthorization}
      
      Job Context:
      - Title: ${jobTitle}
      - Company: ${company}
      
      Form Question:
      "${questionText}"
      
      Available Options:
      ${options.map((o, idx) => `${idx}: "${o.text}" (value: "${o.value}")`).join('\n')}
      
      Task:
      Select the single best option index matching the candidate's profile.
      If the question relates to visa sponsorship or relocation, align with the candidate's work authorization status: "${profile.workAuthorization}".
      Return ONLY the index number (e.g. "0" or "1") of the chosen option. Do not include markdown, code blocks, or any other text.
    `;

    const answer = await GeminiService.generateText(prompt, () => {
      // Heuristic fallback matching
      const q = questionText.toLowerCase();
      
      // English proficiency
      if (q.includes('english') || q.includes('language')) {
        const fluentIdx = options.findIndex(o => 
          o.text.toLowerCase().includes('fluent') || 
          o.text.toLowerCase().includes('native') || 
          o.text.toLowerCase().includes('professional') ||
          o.text.toLowerCase().includes('yes')
        );
        if (fluentIdx !== -1) return String(fluentIdx);
      }
      
      // Sponsorship
      if (q.includes('visa') || q.includes('sponsorship') || q.includes('relocation') || q.includes('sponsor')) {
        const isSponsorNeed = profile.workAuthorization.toLowerCase().includes('sponsor') || 
                            profile.workAuthorization.toLowerCase().includes('require');
        const targetText = isSponsorNeed ? 'yes' : 'no';
        const foundIdx = options.findIndex(o => o.text.toLowerCase().includes(targetText));
        if (foundIdx !== -1) return String(foundIdx);
      }
      
      // Hybrid/Office comfort
      if (q.includes('hybrid') || q.includes('office') || q.includes('3 days') || q.includes('work from')) {
        const yesIdx = options.findIndex(o => o.text.toLowerCase().includes('yes'));
        if (yesIdx !== -1) return String(yesIdx);
      }
      
      // Default: select first option that is not 'select' or empty
      const firstRealIdx = options.findIndex(o => 
        !o.text.toLowerCase().includes('select') && 
        o.value.trim() !== ''
      );
      return firstRealIdx !== -1 ? String(firstRealIdx) : '0';
    });

    const parsedIdx = parseInt(answer.trim(), 10);
    if (!isNaN(parsedIdx) && parsedIdx >= 0 && parsedIdx < options.length) {
      return options[parsedIdx].value;
    }
    return options[0]?.value || '';
  }
}
