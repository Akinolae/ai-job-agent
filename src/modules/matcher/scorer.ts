import { dbService, JobPosting, CandidateProfile } from '../../config/firebase';
import { GeminiService } from '../../config/gemini';
import { MATCH_SCORER_SYSTEM_PROMPT, matchScoreSchema } from './rubric-prompts';
import { CvTailorer } from '../cv-parser/cv-tailorer';
import { BinaryGates } from './binary-gates';
import { SkillDiffEngine } from './skill-diff';

interface MatchEvaluationResult {
  matchScore: number;
  matchBreakdown: {
    techStackScore: number;
    roleTitleScore: number;
    seniorityScore: number;
    locationScore: number;
    techCoverage?: number;
    matchedMustHaves?: string[];
    missingMustHaves?: string[];
    matchedNiceToHaves?: string[];
    gateResults?: {
      languagePassed: boolean;
      domainPassed: boolean;
      dealbreakersPassed: boolean;
      reason?: string;
    };
  };
  matchSummary: string;
  requiresTailoring: boolean;
}

export class Scorer {
  /**
   * Fetches the job posting page, stripping out HTML tags/scripts/styles to get raw text description.
   */
  private static async fetchJobDescription(applyUrl: string): Promise<string> {
    try {
      console.log(`[Scorer] Polling job description page: ${applyUrl}`);
      const res = await fetch(applyUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        signal: AbortSignal.timeout(30000)
      });
      if (!res.ok) {
        throw new Error(`Failed to fetch page text: ${res.statusText}`);
      }
      const html = await res.text();
      
      let cleanText = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
      cleanText = cleanText.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
      cleanText = cleanText.replace(/<[^>]+>/g, ' ');
      cleanText = cleanText.replace(/\s+/g, ' ').trim();
      
      return cleanText.substring(0, 8000);
    } catch (err) {
      console.warn(`[Scorer] Could not fetch job description from ${applyUrl}:`, err);
      return '';
    }
  }

  /**
   * Evaluates a JobPosting using the 3-Tier Gated Hybrid Scoring Engine.
   */
  static async evaluateJob(job: JobPosting): Promise<JobPosting> {
    const profile = await dbService.getProfile();
    if (!profile) {
      console.warn('No candidate profile found. Cannot score job posting.');
      return job;
    }

    // 0. Age check: do not process if job posting is over two weeks (14 days) old
    if (job.postedAt) {
      const ageInMs = Date.now() - new Date(job.postedAt).getTime();
      const twoWeeksInMs = 14 * 24 * 60 * 60 * 1000;
      if (ageInMs > twoWeeksInMs) {
        console.log(`[Scorer] Skipping job "${job.title}" at "${job.company}" as it is older than 2 weeks.`);
        job.status = 'SKIPPED';
        job.matchScore = 0;
        job.matchSummary = 'Skipped: Job listing is older than 2 weeks.';
        await dbService.saveJob(job);
        return job;
      }
    }

    console.log(`[3-Tier Engine] Evaluating: "${job.title}" at "${job.company}"`);

    // ==========================================
    // TIER 1: Deterministic Binary Dealbreaker Gates
    // ==========================================
    const gateResult = BinaryGates.evaluate(job, profile);
    if (!gateResult.passed) {
      console.log(`[Tier 1 Gate Hit] Rejected "${job.title}": ${gateResult.rejectionReason}`);
      job.matchScore = 0;
      job.status = 'SKIPPED';
      job.matchBreakdown = {
        techStackScore: 0,
        roleTitleScore: 0,
        seniorityScore: 0,
        locationScore: 0,
        techCoverage: 0,
        matchedMustHaves: [],
        missingMustHaves: [],
        matchedNiceToHaves: [],
        gateResults: {
          languagePassed: gateResult.languagePassed,
          domainPassed: gateResult.domainPassed,
          dealbreakersPassed: gateResult.dealbreakersPassed,
          reason: gateResult.rejectionReason
        }
      };
      job.matchSummary = `Rejected by Tier-1 Gate: ${gateResult.rejectionReason}`;
      job.requiresTailoring = false;
      await dbService.saveJob(job);
      return job;
    }

    // Fetch full description if missing or short (only after passing Tier 1 gates)
    if (!job.description || job.description.length < 100) {
      const description = await this.fetchJobDescription(job.applyUrl);
      if (description) {
        job.description = description;
      }
    }

    // ==========================================
    // TIER 2: Deterministic Skill Diff & Gating Multiplier
    // ==========================================
    const skillDiff = SkillDiffEngine.compute(job, profile);

    // ==========================================
    // TIER 3: Contextual AI Evaluation & Final Synthesis
    // ==========================================
    const prompt = `
      ${MATCH_SCORER_SYSTEM_PROMPT}

      Candidate Profile:
      ---
      ${JSON.stringify(profile, null, 2)}
      ---

      Tier-2 Computed Skill Diff:
      ---
      - Matched Must-Haves: ${skillDiff.matchedMustHaves.join(', ') || 'None'}
      - Missing Must-Haves: ${skillDiff.missingMustHaves.join(', ') || 'None'}
      - Tech Stack Coverage: ${skillDiff.techCoverage}%
      - Incompatible Technologies Found: ${skillDiff.incompatibleStacksFound.join(', ') || 'None'}
      ---

      Job Details:
      ---
      Title: ${job.title}
      Company: ${job.company}
      Location: ${job.location}
      Modality: ${job.workplaceType}
      URL: ${job.applyUrl}
      Description: ${job.description}
      ---
    `;

    const rawResult = await GeminiService.generateJson<MatchEvaluationResult>(
      prompt,
      matchScoreSchema,
      () => this.runMockScoring(job, profile, skillDiff)
    );

    // Apply the Gating Multiplier from Tier 2
    const rawScore = rawResult.matchScore || 0;
    const finalScore = Math.min(100, Math.round(rawScore * skillDiff.gatingMultiplier));

    job.matchScore = finalScore;
    job.matchBreakdown = {
      techStackScore: rawResult.matchBreakdown?.techStackScore || 0,
      roleTitleScore: rawResult.matchBreakdown?.roleTitleScore || 0,
      seniorityScore: rawResult.matchBreakdown?.seniorityScore || 0,
      locationScore: rawResult.matchBreakdown?.locationScore || 0,
      techCoverage: skillDiff.techCoverage,
      matchedMustHaves: skillDiff.matchedMustHaves,
      missingMustHaves: skillDiff.missingMustHaves,
      matchedNiceToHaves: skillDiff.matchedNiceToHaves,
      gateResults: {
        languagePassed: true,
        domainPassed: true,
        dealbreakersPassed: true
      }
    };
    job.matchSummary = rawResult.matchSummary;
    job.requiresTailoring = finalScore >= 80;

    // Threshold rule: only apply if final score >= 80
    if (finalScore >= 80) {
      job.status = 'QUEUED';
      console.log(`[Scorer] High Match (${finalScore}%). Enqueued for tailored pitch & application.`);
      
      if (job.requiresTailoring) {
        try {
          const tailoredUrl = await CvTailorer.tailorCv(profile, job, job.description || '');
          job.tailoredCvPath = tailoredUrl;
        } catch (tailorErr) {
          console.error(`[Scorer] CV tailoring failed for job ${job.jobId}:`, tailorErr);
        }
      }
    } else {
      job.status = 'SKIPPED';
      console.log(`[Scorer] Match score ${finalScore}% (Gated by ${Math.round(skillDiff.gatingMultiplier * 100)}% multiplier). Skipped.`);
    }

    await dbService.saveJob(job);
    return job;
  }

  /**
   * High-precision mock fallback scorer implementing the 3-Tier hybrid rules.
   */
  private static runMockScoring(job: JobPosting, profile: CandidateProfile, skillDiff?: any): MatchEvaluationResult {
    const title = (job.title || '').toLowerCase();
    const loc = (job.location || '').toLowerCase();
    const desc = (job.description || '').toLowerCase();

    const diff = skillDiff || SkillDiffEngine.compute(job, profile);

    // 1. Role Title Alignment (Max 25 points)
    const targetRoles = (profile.targetRoles || []).map((r: string) => r.toLowerCase().trim()).filter(Boolean);
    const qualifiedRoles = (profile.potentiallyQualifiedRoles || []).map((r: string) => r.toLowerCase().trim()).filter(Boolean);
    
    let roleTitleScore = 0;
    if (targetRoles.some((r: string) => title.includes(r))) {
      roleTitleScore = 25;
    } else if (qualifiedRoles.some((r: string) => title.includes(r))) {
      roleTitleScore = 20;
    } else if (title.includes('software') || title.includes('engineer') || title.includes('developer') || title.includes('full stack')) {
      roleTitleScore = 14;
    } else {
      roleTitleScore = 0;
    }

    // 2. Tech Stack Score from Skill Diff (Max 45 points)
    let techStackScore = Math.round((diff.techCoverage / 100) * 45);
    if (diff.incompatibleStacksFound.length > 0) {
      techStackScore = Math.max(0, techStackScore - (diff.incompatibleStacksFound.length * 10));
    }

    // 3. Seniority Score (Max 15 points)
    const expYears = profile.experienceYears || 5;
    let seniorityScore = 12;
    if (title.includes('senior') || title.includes('sr.') || title.includes('lead') || title.includes('principal')) {
      seniorityScore = expYears >= 5 ? 15 : 10;
    }

    // 4. Location / Modality (Max 15 points)
    const isEmeaMatch = /\bemea\b|europe,\s*middle\s*east\s*(?:&|and)\s*africa/i.test(`${loc} ${job.title} ${desc}`);
    const isRemote = loc.includes('remote') || 
                     loc.includes('worldwide') || 
                     loc.includes('anywhere') || 
                     loc.includes('emea') || 
                     loc.includes('apac') || 
                     loc.includes('latam') || 
                     isEmeaMatch ||
                     String(job.workplaceType || '').toLowerCase().includes('remote');

    const candidateHome = (profile.location || '').toLowerCase().trim();
    const isHomeMatch = candidateHome && loc.includes(candidateHome);

    const targetLocs = (profile.targetLocations || []).map((l: string) => l.toLowerCase());
    const isTargetGeoMatch = targetLocs.some((tl: string) => {
      const cleanTl = tl.replace(/[^a-z0-9]/g, ' ').trim();
      return cleanTl.split(/\s+/).some((word: string) => word.length > 2 && loc.includes(word));
    });

    const isGlobalRegionMatch = /europe|uk|germany|netherlands|ireland|sweden|france|spain|poland|africa|nigeria|lagos|abuja|kenya|nairobi|south africa|cape town|johannesburg|ghana|accra|egypt|cairo|rwanda|kigali|asia|singapore|uae|japan|india|americas|canada|us|brazil/i.test(loc);

    let locationScore = 10;
    if (isRemote || isHomeMatch || isEmeaMatch) {
      locationScore = 15;
    } else if (isTargetGeoMatch || isGlobalRegionMatch) {
      locationScore = 14;
    } else if (desc.includes('visa') || desc.includes('relocation')) {
      locationScore = 15;
    }

    let matchScore = techStackScore + roleTitleScore + seniorityScore + locationScore;
    matchScore = Math.min(100, Math.max(0, matchScore));

    let matchSummary = '';
    if (matchScore >= 80 && diff.techCoverage >= 70) {
      const topSkills = diff.matchedMustHaves.slice(0, 4).join(', ') || 'Primary Stack';
      matchSummary = `High technical alignment on target role (${job.title}) with ${diff.techCoverage}% skill match in ${topSkills}.`;
    } else {
      const missing = diff.missingMustHaves.slice(0, 3).join(', ');
      matchSummary = `Below threshold: Required stack has insufficient overlap. Missing: ${missing || 'Core competencies'}.`;
    }

    return {
      matchScore,
      matchBreakdown: {
        techStackScore,
        roleTitleScore,
        seniorityScore,
        locationScore,
        techCoverage: diff.techCoverage,
        matchedMustHaves: diff.matchedMustHaves,
        missingMustHaves: diff.missingMustHaves,
        matchedNiceToHaves: diff.matchedNiceToHaves
      },
      matchSummary,
      requiresTailoring: matchScore >= 80
    };
  }
}
