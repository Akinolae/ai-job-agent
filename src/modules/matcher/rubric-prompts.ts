import { Type } from '@google/genai';

// Gemini Schema for match scoring
export const matchScoreSchema = {
  type: Type.OBJECT,
  properties: {
    matchScore: { 
      type: Type.INTEGER, 
      description: 'Overall aggregate match score out of 100' 
    },
    matchBreakdown: {
      type: Type.OBJECT,
      properties: {
        techStackScore: { 
          type: Type.INTEGER, 
          description: 'Score for alignment on candidate core technologies, languages, frameworks, tools (max 45)' 
        },
        roleTitleScore: { 
          type: Type.INTEGER, 
          description: 'Score for direct alignment with candidate target roles and core domain (max 25)' 
        },
        seniorityScore: { 
          type: Type.INTEGER, 
          description: 'Score for alignment on years of experience and level of seniority (max 15)' 
        },
        locationScore: { 
          type: Type.INTEGER, 
          description: 'Score for remote modality and relocation/geographic fit (max 15)' 
        }
      },
      required: ['techStackScore', 'roleTitleScore', 'seniorityScore', 'locationScore']
    },
    matchSummary: { 
      type: Type.STRING, 
      description: 'A 1-2 sentence justification summarizing why the candidate fits or does not fit this role.' 
    },
    requiresTailoring: {
      type: Type.BOOLEAN,
      description: 'Determine whether the candidate\'s CV needs to be adapted or tailored specifically to match this job role/description to emphasize matching skills (true if yes).'
    }
  },
  required: ['matchScore', 'matchBreakdown', 'matchSummary', 'requiresTailoring']
};

export const MATCH_SCORER_SYSTEM_PROMPT = `
You are a highly analytical, strict, and discerning technical hiring director evaluating job descriptions against a candidate's structured profile.
Your job is to ensure HIGH-PRECISION matching between the candidate's demonstrated skill set, tools, target roles, and the job requirements.

STRICT EVALUATION PRINCIPLES:
1. PRIMARY TECH STACK & COMPETENCY MATCH (Max 45 points):
   - Compare the mandatory tech stack / tools in the job description against the candidate's actual tools and core competencies listed in their profile.
   - For engineering roles: If the job mandates a completely different core stack (e.g. requires Python/Django/Angular, or C#/ASP.NET, or Java/Spring Boot when candidate specializes in React/Next.js/Node.js/Go/TypeScript), award ≤ 15 points.
   - For marketing/operations roles: Check specific platform requirements (e.g. Meta Ads, Google Analytics, SEO, HubSpot).
   - If the candidate meets 80%+ of the primary requirements, award 38-45 points.

2. ROLE TITLE & DOMAIN ALIGNMENT (Max 25 points):
   - Compare the job title and profession directly against candidate's "targetRoles" and "potentiallyQualifiedRoles".
   - Award 20-25 points if the job title and domain directly align.
   - If the job title belongs to an unrelated industry (e.g. Construction, Post Office, Healthcare, Retail, Sales, Compliance/GRC), award 0 points.

3. SENIORITY & EXPERIENCE SCOPE (Max 15 points):
   - Alignment with candidate's total years of experience and level of responsibility (Junior, Mid, Senior, Lead, Staff).
   - Award 12-15 points for appropriate seniority match.

4. MODALITY & LOCATION FIT (Max 15 points):
   - If the role is 100% Remote, Remote Worldwide, Remote EU/Africa/US, or offers visa/relocation, award 13-15 points.
   - Deduct points if the job strictly requires local in-person presence in a country the candidate does not target and does not sponsor.

CRITICAL HARD CEILING RULES:
- If the job description is in a foreign language (e.g. Spanish, German, French, Portuguese) and the candidate's profile/resume is in English, CAP the overall matchScore at ≤ 45% because the candidate cannot perform effectively in non-English workplaces.
- If the job's primary domain or core stack is a mismatch, the overall matchScore MUST BE STRICTLY BELOW 60%, and the status must be skipped.
- ONLY award an overall score of ≥ 80% if the candidate possesses direct proficiency in the core technologies/skills AND the title directly reflects their career trajectory.
`;

