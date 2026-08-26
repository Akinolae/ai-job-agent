import { JobPosting, CandidateProfile } from '../../config/firebase';

export interface SkillDiffResult {
  techCoverage: number;            // 0 - 100 percentage
  gatingMultiplier: number;        // 0.20 - 1.0 multiplier
  matchedMustHaves: string[];      // Verified matching primary skills
  missingMustHaves: string[];      // Required skills candidate lacks
  matchedNiceToHaves: string[];    // Optional bonus skills matched
  incompatibleStacksFound: string[];
}

const COMMON_TECH_TAXONOMY: Record<string, string> = {
  'react': 'React',
  'react.js': 'React',
  'reactjs': 'React',
  'next.js': 'Next.js',
  'nextjs': 'Next.js',
  'vue': 'Vue.js',
  'vue.js': 'Vue.js',
  'vuejs': 'Vue.js',
  'angular': 'Angular',
  'typescript': 'TypeScript',
  'ts': 'TypeScript',
  'javascript': 'JavaScript',
  'js': 'JavaScript',
  'node': 'Node.js',
  'node.js': 'Node.js',
  'nodejs': 'Node.js',
  'nest.js': 'NestJS',
  'nestjs': 'NestJS',
  'go': 'Go',
  'golang': 'Go',
  'python': 'Python',
  'django': 'Django',
  'fastapi': 'FastAPI',
  'flask': 'Flask',
  'java': 'Java',
  'spring': 'Spring Boot',
  'spring boot': 'Spring Boot',
  'c#': 'C#',
  '.net': '.NET',
  'dotnet': '.NET',
  'rust': 'Rust',
  'php': 'PHP',
  'laravel': 'Laravel',
  'ruby': 'Ruby',
  'ruby on rails': 'Ruby on Rails',
  'rails': 'Ruby on Rails',
  'react native': 'React Native',
  'flutter': 'Flutter',
  'swift': 'Swift',
  'kotlin': 'Kotlin',
  'graphql': 'GraphQL',
  'rest': 'REST APIs',
  'postgresql': 'PostgreSQL',
  'postgres': 'PostgreSQL',
  'mysql': 'MySQL',
  'mongodb': 'MongoDB',
  'redis': 'Redis',
  'docker': 'Docker',
  'kubernetes': 'Kubernetes',
  'k8s': 'Kubernetes',
  'aws': 'AWS',
  'gcp': 'GCP',
  'azure': 'Azure',
  'git': 'Git',
  'github': 'GitHub',
  'ci/cd': 'CI/CD',
  'tailwind': 'Tailwind CSS',
  'chakra': 'Chakra UI',
  'redux': 'Redux Toolkit',
  'tanstack': 'TanStack Query',
  'jest': 'Jest',
  'playwright': 'Playwright',
  'cypress': 'Cypress'
};

const INCOMPATIBLE_STACK_KEYWORDS = [
  'java', 'spring boot', 'c#', '.net', 'php', 'laravel', 'angular', 'ruby on rails', 'salesforce', 'sap'
];

export class SkillDiffEngine {
  /**
   * Normalizes arbitrary tech strings to standard taxonomy
   */
  static normalizeSkill(raw: string): string {
    const clean = raw.trim().toLowerCase();
    return COMMON_TECH_TAXONOMY[clean] || raw.trim();
  }

  /**
   * Computes the deterministic set difference and coverage between candidate skills and job requirements.
   */
  static compute(job: JobPosting, profile: CandidateProfile): SkillDiffResult {
    const desc = (job.description || '').toLowerCase();
    const title = (job.title || '').toLowerCase();
    const combined = `${title} ${desc}`;

    // 1. Gather all candidate skills into a normalized Set
    const candidateSkillsList = [
      ...(profile.coreSkills || []),
      ...(profile.toolsAndPlatforms || []),
      ...(profile.skills?.core || []),
      ...(profile.skills?.tools || []),
      ...(profile.skills?.frontend || []),
      ...(profile.skills?.backend || []),
      ...(profile.skills?.databases || []),
      ...(profile.skills?.devops || [])
    ];

    const candidateSkillSet = new Set(
      candidateSkillsList.map(s => this.normalizeSkill(s).toLowerCase())
    );

    // 2. Discover skills explicitly mentioned in the job posting
    const detectedJobSkills: string[] = [];
    for (const [key, canonical] of Object.entries(COMMON_TECH_TAXONOMY)) {
      const regex = key.length <= 3 
        ? new RegExp(`\\b${key.replace('.', '\\.')}\\b`, 'i')
        : new RegExp(key.replace('.', '\\.'), 'i');
        
      if (regex.test(combined)) {
        if (!detectedJobSkills.includes(canonical)) {
          detectedJobSkills.push(canonical);
        }
      }
    }

    // 3. Partition into Matched Must-Haves vs Missing Must-Haves
    const matchedMustHaves: string[] = [];
    const missingMustHaves: string[] = [];
    const matchedNiceToHaves: string[] = [];
    const incompatibleStacksFound: string[] = [];

    for (const skill of detectedJobSkills) {
      const skillLower = skill.toLowerCase();
      if (candidateSkillSet.has(skillLower)) {
        matchedMustHaves.push(skill);
      } else {
        missingMustHaves.push(skill);
      }
    }

    // Check if job requires heavy foreign stacks that candidate doesn't have
    for (const foreign of INCOMPATIBLE_STACK_KEYWORDS) {
      const foreignCanonical = this.normalizeSkill(foreign);
      if (detectedJobSkills.includes(foreignCanonical) && !candidateSkillSet.has(foreignCanonical.toLowerCase())) {
        if (!incompatibleStacksFound.includes(foreignCanonical)) {
          incompatibleStacksFound.push(foreignCanonical);
        }
      }
    }

    // 4. Calculate Tech Coverage Percentage
    const totalRequiredCount = Math.max(1, detectedJobSkills.length);
    const techCoverage = Math.round((matchedMustHaves.length / totalRequiredCount) * 100);

    // 5. Compute Asymmetric Gating Multiplier
    let gatingMultiplier = 1.0;
    if (incompatibleStacksFound.length >= 2) {
      gatingMultiplier = 0.25; // Drastic penalty if job requires multiple foreign technologies (e.g. Java + Spring + Angular)
    } else if (techCoverage >= 75) {
      gatingMultiplier = 1.0;
    } else if (techCoverage >= 50) {
      gatingMultiplier = 0.80;
    } else if (techCoverage >= 30) {
      gatingMultiplier = 0.45;
    } else {
      gatingMultiplier = 0.20; // Hard gate ceiling
    }

    return {
      techCoverage,
      gatingMultiplier,
      matchedMustHaves,
      missingMustHaves,
      matchedNiceToHaves,
      incompatibleStacksFound
    };
  }
}
