import { JobPosting, CandidateProfile } from '../../config/firebase';

export interface GateEvaluationResult {
  passed: boolean;
  languagePassed: boolean;
  domainPassed: boolean;
  dealbreakersPassed: boolean;
  rejectionReason?: string;
}

const FOREIGN_LANGUAGE_INDICATORS = [
  // Spanish
  '\\bbuscamos\\b', '\\brequisitos\\b', '\\bresponsabilidades\\b', '\\bconocimientos\\b', '\\bexperiencia en\\b', '\\bjornada\\b',
  // German
  '\\bwir suchen\\b', '\\banforderungen\\b', '\\baufgaben\\b', '\\bprofil\\b', '\\bvollzeit\\b', '\\bteilzeit\\b', '\\bstandort\\b',
  // French
  '\\bnous recherchons\\b', '\\bexigences\\b', '\\bvotre profil\\b', '\\bmissions\\b', '\\bposte\\b',
  // Portuguese
  '\\bprocuramos\\b', '\\brequisitos\\b', '\\bconhecimentos\\b',
  // Dutch
  '\\bwij zoeken\\b', '\\bfunctie-eisen\\b', '\\bwerkzaamheden\\b'
];

const DISQUALIFIED_DOMAIN_PATTERNS = [
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

const SOFTWARE_DOMAIN_INDICATORS = [
  'software', 'full stack', 'full-stack', 'fullstack', 'frontend', 'front-end', 'front end', 'backend', 'back-end', 'back end',
  'web developer', 'web engineer', 'mobile developer', 'mobile engineer', 'react', 'react native', 'node', 'nodejs',
  'typescript', 'javascript', 'nestjs', 'golang', 'devops', 'cloud engineer', 'solutions architect',
  'software architect', 'tech lead', 'technical lead', 'engineering manager', 'api', 'ios', 'android',
  'python developer', 'application engineer', 'programmer', 'full stack developer', 'frontend developer',
  'backend developer', 'software engineering', 'platform engineer', 'site reliability', 'sre', 'core engineer',
  'data engineer', 'security engineer', 'solution developer', 'solution design', 'lead developer', 'staff engineer',
  'software developer', 'software engineer', 'developer', 'engineer'
];

const HARD_DEALBREAKER_PATTERNS = [
  /\bactive\s+security\s+clearance\s+required\b/i,
  /\bts\/sci\s+clearance\b/i,
  /\bmust\s+be\s+us\s+citizen\s+only\b/i,
  /\bno\s+c2c\s+or\s+sponsorship\s+available\b/i
];

export class BinaryGates {
  /**
   * Evaluates if a job posting passes all Tier-1 non-negotiable binary gates.
   */
  static evaluate(job: JobPosting, profile: CandidateProfile): GateEvaluationResult {
    // Normalize and clean title (remove job board metadata wrappers like "| JOBS IN LAGOS", "AT COMPANY")
    let rawTitle = (job.title || '').trim();
    let cleanedTitle = rawTitle
      .replace(/\|.*$/i, '')
      .replace(/\bat\s+[A-Za-z0-9\s&.-]+$/i, '')
      .replace(/\[.*?\]/g, '')
      .replace(/\(.*?\)/g, '')
      .trim();

    const title = (cleanedTitle || rawTitle).toLowerCase();
    const desc = (job.description || '').toLowerCase();
    const combined = `${title} ${desc}`;

    // 1. Language Gate
    let foreignHits = 0;
    for (const pattern of FOREIGN_LANGUAGE_INDICATORS) {
      if (new RegExp(pattern, 'i').test(desc)) {
        foreignHits++;
      }
    }

    const languagePassed = foreignHits < 2;
    if (!languagePassed) {
      return {
        passed: false,
        languagePassed: false,
        domainPassed: true,
        dealbreakersPassed: true,
        rejectionReason: 'Job posting is written in a non-English foreign language.'
      };
    }

    // 2. Disqualified Domain Check (Hard Disqualification)
    const domainDisqualified = DISQUALIFIED_DOMAIN_PATTERNS.some(pat => pat.test(title));
    if (domainDisqualified) {
      return {
        passed: false,
        languagePassed: true,
        domainPassed: false,
        dealbreakersPassed: true,
        rejectionReason: `Job title "${job.title}" belongs to an unrelated non-target profession.`
      };
    }

    // 3. Positive Domain Alignment Check
    const targetRoles = (profile.targetRoles || []).map((r: string) => r.toLowerCase().trim()).filter(Boolean);
    const qualifiedRoles = (profile.potentiallyQualifiedRoles || []).map((r: string) => r.toLowerCase().trim()).filter(Boolean);
    const allProfileRoles = [...targetRoles, ...qualifiedRoles];

    const isSoftwareProfile = allProfileRoles.some((r: string) => 
      r.includes('software') || r.includes('engineer') || r.includes('developer') || 
      r.includes('frontend') || r.includes('backend') || r.includes('full-stack') || r.includes('full stack') || r.includes('react')
    );

    if (isSoftwareProfile && allProfileRoles.length > 0) {
      const directMatch = allProfileRoles.some(r => title.includes(r) || rawTitle.toLowerCase().includes(r));
      const hasSoftwareIndicator = SOFTWARE_DOMAIN_INDICATORS.some(ind => title.includes(ind) || rawTitle.toLowerCase().includes(ind));

      if (!directMatch && !hasSoftwareIndicator) {
        return {
          passed: false,
          languagePassed: true,
          domainPassed: false,
          dealbreakersPassed: true,
          rejectionReason: `Job title "${job.title}" does not align with candidate's software engineering background.`
        };
      }
    }

    // 3. Dealbreaker Gate
    const hasDealbreaker = HARD_DEALBREAKER_PATTERNS.some(pat => pat.test(combined));
    if (hasDealbreaker) {
      return {
        passed: false,
        languagePassed: true,
        domainPassed: true,
        dealbreakersPassed: false,
        rejectionReason: 'Job requires restrictive government security clearance or strict non-sponsored citizenship.'
      };
    }

    return {
      passed: true,
      languagePassed: true,
      domainPassed: true,
      dealbreakersPassed: true
    };
  }
}
