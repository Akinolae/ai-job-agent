import { JobPosting } from '../../config/firebase';
import { isTitleEligible } from './live-sources';

export interface AtsCompanyTarget {
  board: 'greenhouse' | 'lever';
  companyId: string;
  name: string;
  region: 'Europe' | 'Africa' | 'Asia' | 'Americas' | 'Global Remote';
}

export const CURATED_GLOBAL_ATS_COMPANIES: AtsCompanyTarget[] = [
  // Global Remote & Americas
  { board: 'greenhouse', companyId: 'gitlab', name: 'GitLab', region: 'Global Remote' },
  { board: 'greenhouse', companyId: 'automattic', name: 'Automattic', region: 'Global Remote' },
  { board: 'greenhouse', companyId: 'buffer', name: 'Buffer', region: 'Global Remote' },
  { board: 'greenhouse', companyId: 'duckduckgo', name: 'DuckDuckGo', region: 'Global Remote' },
  { board: 'greenhouse', companyId: 'zapier', name: 'Zapier', region: 'Global Remote' },
  { board: 'greenhouse', companyId: 'shopify', name: 'Shopify', region: 'Americas' },
  { board: 'greenhouse', companyId: 'elastic', name: 'Elastic', region: 'Global Remote' },
  { board: 'greenhouse', companyId: 'wikimedia', name: 'Wikimedia', region: 'Global Remote' },
  { board: 'greenhouse', companyId: 'datadog', name: 'Datadog', region: 'Americas' },
  { board: 'greenhouse', companyId: 'postman', name: 'Postman', region: 'Global Remote' },
  { board: 'greenhouse', companyId: 'supabase', name: 'Supabase', region: 'Global Remote' },
  { board: 'greenhouse', companyId: '1password', name: '1Password', region: 'Global Remote' },
  { board: 'greenhouse', companyId: 'cloudflare', name: 'Cloudflare', region: 'Americas' },
  { board: 'greenhouse', companyId: 'grafana', name: 'Grafana Labs', region: 'Global Remote' },
  { board: 'greenhouse', companyId: 'chainlinklabs', name: 'Chainlink Labs', region: 'Global Remote' },
  { board: 'greenhouse', companyId: 'digitalocean', name: 'DigitalOcean', region: 'Global Remote' },

  // Europe
  { board: 'greenhouse', companyId: 'spotify', name: 'Spotify', region: 'Europe' },
  { board: 'greenhouse', companyId: 'miro', name: 'Miro', region: 'Europe' },
  { board: 'greenhouse', companyId: 'personio', name: 'Personio', region: 'Europe' },
  { board: 'greenhouse', companyId: 'adyen', name: 'Adyen', region: 'Europe' },
  { board: 'greenhouse', companyId: 'revolut', name: 'Revolut', region: 'Europe' },
  { board: 'greenhouse', companyId: 'monzo', name: 'Monzo', region: 'Europe' },
  { board: 'greenhouse', companyId: 'deliveryhero', name: 'Delivery Hero', region: 'Europe' },
  { board: 'greenhouse', companyId: 'deepl', name: 'DeepL', region: 'Europe' },
  { board: 'greenhouse', companyId: 'contentful', name: 'Contentful', region: 'Europe' },
  { board: 'greenhouse', companyId: 'skyscanner', name: 'Skyscanner', region: 'Europe' },
  { board: 'greenhouse', companyId: 'taxfix', name: 'Taxfix', region: 'Europe' },
  { board: 'lever', companyId: 'klarna', name: 'Klarna', region: 'Europe' },
  { board: 'lever', companyId: 'n26', name: 'N26', region: 'Europe' },
  { board: 'lever', companyId: 'bolt', name: 'Bolt', region: 'Europe' },

  // Africa
  { board: 'greenhouse', companyId: 'flutterwave', name: 'Flutterwave', region: 'Africa' },
  { board: 'greenhouse', companyId: 'andela', name: 'Andela', region: 'Africa' },
  { board: 'greenhouse', companyId: 'paystack', name: 'Paystack', region: 'Africa' },
  { board: 'lever', companyId: 'chippercash', name: 'Chipper Cash', region: 'Africa' },
  { board: 'lever', companyId: 'kuda', name: 'Kuda', region: 'Africa' },
  { board: 'greenhouse', companyId: 'wave', name: 'Wave', region: 'Africa' },
  { board: 'greenhouse', companyId: 'moniepoint', name: 'Moniepoint', region: 'Africa' },
  { board: 'lever', companyId: 'fairmoney', name: 'FairMoney', region: 'Africa' },
  { board: 'lever', companyId: 'heliumhealth', name: 'Helium Health', region: 'Africa' },
  { board: 'greenhouse', companyId: 'mkopa', name: 'M-KOPA', region: 'Africa' },
  { board: 'greenhouse', companyId: 'sunking', name: 'Sun King', region: 'Africa' },
  { board: 'greenhouse', companyId: 'bboxx', name: 'Bboxx', region: 'Africa' },
  { board: 'greenhouse', companyId: 'sandtechnologies', name: 'Sand Technologies / ALX', region: 'Africa' },
  { board: 'lever', companyId: 'gebeya', name: 'Gebeya', region: 'Africa' },
  { board: 'lever', companyId: 'decagon', name: 'Decagon', region: 'Africa' },
  { board: 'lever', companyId: 'cowrywise', name: 'Cowrywise', region: 'Africa' },
  { board: 'greenhouse', companyId: 'wasoko', name: 'Wasoko', region: 'Africa' },

  // Asia & Middle East
  { board: 'greenhouse', companyId: 'grab', name: 'Grab', region: 'Asia' },
  { board: 'greenhouse', companyId: 'carousell', name: 'Carousell', region: 'Asia' },
  { board: 'greenhouse', companyId: 'razorpay', name: 'Razorpay', region: 'Asia' },
  { board: 'lever', companyId: 'careem', name: 'Careem', region: 'Asia' },
  { board: 'greenhouse', companyId: 'ninjavan', name: 'Ninja Van', region: 'Asia' }
];

export class AtsEndpoints {
  /**
   * Fetches open job postings from a company's Greenhouse board (Max 2 weeks old).
   */
  static async fetchGreenhouseJobs(companyId: string, companyDisplayName?: string): Promise<JobPosting[]> {
    const url = `https://boards-api.greenhouse.io/v1/boards/${companyId}/jobs?content=true`;
    const twoWeeksInMs = 14 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    
    try {
      const res = await fetch(url, {
        headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(20000)
      });
      if (!res.ok) return [];
      const data = (await res.json()) as any;
      
      if (!data.jobs || !Array.isArray(data.jobs)) return [];

      const companyName = companyDisplayName || (companyId.charAt(0).toUpperCase() + companyId.slice(1));

      return data.jobs
        .filter((job: any) => {
          const postedTime = job.updated_at ? new Date(job.updated_at).getTime() : now;
          return (now - postedTime <= twoWeeksInMs);
        })
        .map((job: any) => {
          const locName = job.location?.name || '';
          const titleStr = job.title || '';
          const isRemote = /remote|anywhere|worldwide|distributed|emea|apac|latam/i.test(`${locName} ${titleStr}`);

          return {
            jobId: `greenhouse_${companyId}_${job.id}`,
            title: titleStr.trim(),
            company: companyName,
            location: locName ? (isRemote && !locName.toLowerCase().includes('remote') ? `Remote (${locName})` : locName) : 'Remote Worldwide',
            workplaceType: isRemote ? 'Remote' : 'Hybrid',
            boardType: 'greenhouse' as const,
            applyUrl: job.absolute_url,
            description: (job.content || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 5000),
            postedAt: job.updated_at || new Date().toISOString(),
            discoveredAt: new Date().toISOString(),
            status: 'NEW' as const
          };
        });
    } catch (err) {
      return [];
    }
  }

  /**
   * Fetches open job postings from a company's Lever board (Max 2 weeks old).
   */
  static async fetchLeverJobs(companyId: string, companyDisplayName?: string): Promise<JobPosting[]> {
    const url = `https://api.lever.co/v0/postings/${companyId}?mode=json`;
    const twoWeeksInMs = 14 * 24 * 60 * 60 * 1000;
    const now = Date.now();

    try {
      const res = await fetch(url, {
        headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(20000)
      });
      if (!res.ok) return [];
      const data = (await res.json()) as any;
      
      if (!Array.isArray(data)) return [];

      const companyName = companyDisplayName || (companyId.charAt(0).toUpperCase() + companyId.slice(1));

      return data
        .filter((job: any) => {
          const postedTime = job.createdAt ? new Date(job.createdAt).getTime() : now;
          return (now - postedTime <= twoWeeksInMs);
        })
        .map((job: any) => {
          const locName = job.categories?.location || '';
          const titleStr = job.text || job.title || '';
          const isRemote = /remote|anywhere|worldwide|distributed|emea|apac|latam/i.test(`${locName} ${titleStr}`);

          return {
            jobId: `lever_${companyId}_${job.id}`,
            title: titleStr.trim(),
            company: companyName,
            location: locName ? (isRemote && !locName.toLowerCase().includes('remote') ? `Remote (${locName})` : locName) : 'Remote Worldwide',
            workplaceType: isRemote ? 'Remote' : (job.categories?.commitment || 'Full-time'),
            boardType: 'lever' as const,
            applyUrl: job.hostedUrl,
            description: (job.descriptionPlain || job.description || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 5000),
            postedAt: job.createdAt ? new Date(job.createdAt).toISOString() : new Date().toISOString(),
            discoveredAt: new Date().toISOString(),
            status: 'NEW' as const
          };
        });
    } catch (err) {
      return [];
    }
  }

  /**
   * Polls curated international companies across Europe, Africa, Asia, and Americas in parallel.
   */
  static async crawlCuratedGlobal(targetRoles: string[]): Promise<JobPosting[]> {
    console.log(`[AtsEndpoints] Crawling ${CURATED_GLOBAL_ATS_COMPANIES.length} international companies across Europe, Africa, Asia, Americas, and Global Remote (Max 2 weeks old)...`);
    
    const results = await Promise.all(
      CURATED_GLOBAL_ATS_COMPANIES.map(async (c) => {
        try {
          const jobs = c.board === 'greenhouse'
            ? await this.fetchGreenhouseJobs(c.companyId, c.name)
            : await this.fetchLeverJobs(c.companyId, c.name);

          return jobs.filter(j => isTitleEligible(j.title, targetRoles));
        } catch {
          return [];
        }
      })
    );

    const flat = results.flat();
    console.log(`[AtsEndpoints] Discovered ${flat.length} eligible roles from global enterprise ATS boards.`);
    return flat;
  }
}
