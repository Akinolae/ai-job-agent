import { JobPosting } from '../../config/firebase';

/**
 * Common utilities for network requests, text cleaning, and ID generation
 */
async function safeFetchJson<T>(url: string, headers: HeadersInit = {}): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        ...headers
      },
      signal: AbortSignal.timeout(45000)
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch (err) {
    console.warn(`[LiveSources] Network request failed for ${url}:`, err);
    return null;
  }
}

function cleanDescription(html: string, maxLen: number = 5000): string {
  return (html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, maxLen);
}

function buildJobId(source: string, company: string, title: string, url: string): string {
  const companyKey = (company || 'company').toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 20);
  const titleKey = (title || 'role').toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 25);
  
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    hash = ((hash << 5) - hash) + url.charCodeAt(i);
    hash |= 0;
  }
  const urlHash = Math.abs(hash).toString(36);
  return `${source}_${companyKey}_${titleKey}_${urlHash}`;
}

const HARD_DISQUALIFIED_TITLE_PATTERNS = [
  // Non-tech trades & manual labor
  /\b(laborer|tradesperson|technician|machinist|fitter|mechanic|welder|carpenter|plumber|electrician)\b/i,
  /\b(hvac|pipefitter|ironworker|driver|forklift|warehouse|packer|loader|cleaner|janitor|housekeep\w*)\b/i,
  // Construction & non-software engineering disciplines
  /\b(civil|mechanical|electrical|structural|chemical|petroleum|mining|marine|acoustic|environmental|geotechnical)\s+engineer\b/i,
  /\b(quantity\s+surveyor|costing\s+engineer|estimator|drafter|draftsperson|site\s+engineer|cad\s+operator)\b/i,
  /\b(construction\s+manager|building\s+surveyor|structural\s+designer)\b/i,
  // Hospitality, Food & Retail
  /\b(hotel|bell\s+captain|concierge|receptionist|front\s+desk|waiter|waitress|bartender|chef|cook|baker|barista)\b/i,
  /\b(cashier|retail\s+associate|store\s+manager|merchandiser|teller)\b/i,
  // Healthcare & Medical
  /\b(nurse|nursing|dental|dentist|pharmacist|pharmacy|medical\s+assistant|physician|therapist|caregiver)\b/i,
  // Publishing / Clerical / Sales / Support
  /\b(dtp\s+operator|pagemaker|typist|data\s+entry|clerk|bookkeeper)\b/i,
  /\b(accounts?\s+receivable|accounts?\s+payable|tax\s+preparer)\b/i,
  /\b(account\s+executive|sales\s+representative|telemarketing|call\s+center|cold\s+caller)\b/i,
  /\b(post\s+office|mail\s+carrier|courier)\b/i,
  /\b(governance\s+risk|compliance\s+analyst|grc\s+analyst)\b/i,
];

const SOFTWARE_DOMAIN_KEYWORDS = [
  'software', 'full stack', 'full-stack', 'fullstack', 'frontend', 'front-end', 'backend', 'back-end',
  'web developer', 'web engineer', 'mobile developer', 'mobile engineer', 'react', 'node', 'nodejs',
  'typescript', 'javascript', 'nestjs', 'golang', 'devops', 'cloud engineer', 'solutions architect',
  'software architect', 'tech lead', 'technical lead', 'engineering manager', 'api', 'ios', 'android',
  'python developer', 'application engineer'
];

export function isTitleEligible(title: string, targetRoles: string[]): boolean {
  if (!title) return false;
  const lowerTitle = title.toLowerCase().trim();

  // 1. Reject explicitly disqualified non-target job titles
  if (HARD_DISQUALIFIED_TITLE_PATTERNS.some(pat => pat.test(lowerTitle))) {
    return false;
  }

  if (!targetRoles.length) {
    // If no target roles specified, ensure it belongs to software/tech domain
    return SOFTWARE_DOMAIN_KEYWORDS.some(kw => lowerTitle.includes(kw));
  }

  // 2. Check direct substring match with candidate's target roles
  const directMatch = targetRoles.some(role => {
    const roleLower = role.toLowerCase().trim();
    return lowerTitle.includes(roleLower);
  });
  if (directMatch) return true;

  // 3. Multi-term domain keyword match
  return targetRoles.some(role => {
    const roleLower = role.toLowerCase().trim();

    // Specific tech keywords (e.g. react, node, nestjs, fullstack, mobile, frontend, backend)
    const specificTechs = ['react', 'next', 'vue', 'angular', 'node', 'nest', 'golang', 'go', 'python', 'mobile', 'ios', 'android', 'full stack', 'fullstack', 'frontend', 'backend', 'web', 'software', 'cloud', 'devops'];
    const roleTechKeywords = specificTechs.filter(t => roleLower.includes(t));

    if (roleTechKeywords.length > 0) {
      // Title must contain at least one primary domain technology/role descriptor
      const hasTechMatch = roleTechKeywords.some(t => {
        const regex = new RegExp(`\\b${t}\\b`, 'i');
        return regex.test(lowerTitle);
      });
      const hasDevNoun = /\b(engineer|developer|architect|lead|manager|programmer)\b/i.test(lowerTitle);
      if (hasTechMatch && hasDevNoun) return true;
    }

    // Check key non-generic tokens
    const keyTerms = roleLower
      .split(/[\s/,-]+/)
      .filter(w => w.length > 2 && !['senior', 'lead', 'principal', 'junior', 'staff', 'manager', 'head', 'director', 'specialist', 'strategist', 'engineer', 'developer'].includes(w));

    if (keyTerms.length > 0) {
      const allTermsPresent = keyTerms.every(term => lowerTitle.includes(term));
      const hasDevNoun = /\b(engineer|developer|architect|lead|manager|programmer|specialist)\b/i.test(lowerTitle);
      if (allTermsPresent && hasDevNoun) return true;
    }

    return false;
  });
}

export class LiveJobSources {
  /**
   * Fetches live remote tech & marketing jobs from RemoteOK API (Worldwide, US, EU, UK).
   */
  static async fetchRemoteOK(targetRoles: string[]): Promise<JobPosting[]> {
    console.log('[LiveSources] Fetching live jobs from RemoteOK (Global Remote)...');
    const data = await safeFetchJson<any[]>('https://remoteok.com/api');
    if (!Array.isArray(data)) return [];

    const rawJobs = data.slice(1); // First item is API terms/metadata

    return rawJobs
      .filter(job => {
        const title = job.position || job.title || '';
        return isTitleEligible(title, targetRoles);
      })
      .map(job => {
        const title = job.position || job.title || 'Untitled';
        const company = job.company || 'RemoteOK Listing';
        const applyUrl = (job.url || job.apply_url || `https://remoteok.com/remote-jobs/${job.id}`).trim();

        return {
          jobId: buildJobId('remoteok', company, title, applyUrl),
          title,
          company,
          location: job.location || 'Worldwide Remote',
          workplaceType: 'Remote',
          boardType: 'custom',
          applyUrl,
          description: cleanDescription(job.description),
          postedAt: job.date ? new Date(job.date).toISOString() : new Date().toISOString(),
          discoveredAt: new Date().toISOString(),
          status: 'NEW' as const
        };
      });
  }

  /**
   * Fetches live remote jobs across all categories from Remotive API.
   */
  static async fetchRemotive(targetRoles: string[]): Promise<JobPosting[]> {
    console.log('[LiveSources] Fetching live jobs from Remotive (Global Remote)...');
    const data = await safeFetchJson<{ jobs?: any[] }>('https://remotive.com/api/remote-jobs?limit=50');
    const rawJobs = data?.jobs || [];

    return rawJobs
      .filter(job => isTitleEligible(job.title, targetRoles))
      .map(job => {
        const title = job.title || 'Untitled';
        const company = job.company_name || 'Remotive Listing';
        const applyUrl = (job.url || '').trim();

        return {
          jobId: buildJobId('remotive', company, title, applyUrl),
          title,
          company,
          location: job.candidate_required_location || 'Worldwide Remote',
          workplaceType: 'Remote',
          boardType: 'custom',
          applyUrl,
          description: cleanDescription(job.description),
          postedAt: job.publication_date ? new Date(job.publication_date).toISOString() : new Date().toISOString(),
          discoveredAt: new Date().toISOString(),
          status: 'NEW' as const
        };
      });
  }

  /**
   * Fetches live remote jobs from Jobicy API.
   */
  static async fetchJobicy(targetRoles: string[]): Promise<JobPosting[]> {
    console.log('[LiveSources] Fetching live jobs from Jobicy (Global Remote)...');
    const data = await safeFetchJson<{ jobs?: any[] }>('https://jobicy.com/api/v2/remote-jobs?count=50');
    const rawJobs = data?.jobs || [];

    return rawJobs
      .filter(job => isTitleEligible(job.jobTitle, targetRoles))
      .map(job => {
        const title = job.jobTitle || 'Untitled';
        const company = job.companyName || 'Jobicy Listing';
        const applyUrl = (job.url || '').trim();

        return {
          jobId: buildJobId('jobicy', company, title, applyUrl),
          title,
          company,
          location: job.jobGeo || 'Worldwide Remote',
          workplaceType: job.jobType || 'Remote',
          boardType: 'custom',
          applyUrl,
          description: cleanDescription(job.jobDescription),
          postedAt: job.pubDate ? new Date(job.pubDate).toISOString() : new Date().toISOString(),
          discoveredAt: new Date().toISOString(),
          status: 'NEW' as const
        };
      });
  }

  /**
   * Fetches live remote jobs from Arbeitnow API (Remote EU & Worldwide only).
   */
  static async fetchArbeitnow(targetRoles: string[]): Promise<JobPosting[]> {
    console.log('[LiveSources] Fetching live jobs from Arbeitnow (Remote EU/Worldwide only)...');
    const data = await safeFetchJson<{ data?: any[] }>('https://www.arbeitnow.com/api/job-board-api');
    const rawJobs = (data?.data || []).filter(job => job.remote === true || job.visa_sponsorship === true);

    return rawJobs
      .filter(job => isTitleEligible(job.title, targetRoles))
      .map(job => {
        const title = job.title || 'Untitled';
        const company = job.company_name || 'Arbeitnow Listing';
        const applyUrl = (job.url || '').trim();

        return {
          jobId: buildJobId('arbeitnow', company, title, applyUrl),
          title,
          company,
          location: job.location ? `${job.location} (Remote / Visa Ready)` : 'Remote EU / Worldwide',
          workplaceType: 'Remote',
          boardType: 'custom',
          applyUrl,
          description: cleanDescription(job.description),
          postedAt: job.created_at ? new Date(job.created_at * 1000).toISOString() : new Date().toISOString(),
          discoveredAt: new Date().toISOString(),
          status: 'NEW' as const
        };
      });
  }

  /**
   * Fetches from all live open job boards in parallel.
   */
  static async fetchAll(targetRoles: string[]): Promise<JobPosting[]> {
    const [remoteok, remotive, jobicy, arbeitnow] = await Promise.all([
      this.fetchRemoteOK(targetRoles),
      this.fetchRemotive(targetRoles),
      this.fetchJobicy(targetRoles),
      this.fetchArbeitnow(targetRoles)
    ]);

    const combined = [...remoteok, ...remotive, ...jobicy, ...arbeitnow];
    console.log(`[LiveSources] Aggregated ${combined.length} relevant jobs from RemoteOK (${remoteok.length}), Remotive (${remotive.length}), Jobicy (${jobicy.length}), and Arbeitnow (${arbeitnow.length}).`);
    return combined;
  }
}
