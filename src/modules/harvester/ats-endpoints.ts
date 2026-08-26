import { JobPosting } from '../../config/firebase';

export class AtsEndpoints {
  /**
   * Fetches open job postings from a company's Greenhouse board.
   */
  static async fetchGreenhouseJobs(companyId: string): Promise<JobPosting[]> {
    const url = `https://boards-api.greenhouse.io/v1/boards/${companyId}/jobs`;
    console.log(`Polling Greenhouse API for company '${companyId}'...`);
    
    try {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Failed to fetch Greenhouse postings: ${res.statusText}`);
      }
      const data = (await res.json()) as any;
      
      if (!data.jobs || !Array.isArray(data.jobs)) {
        return [];
      }

      return data.jobs.map((job: any) => ({
        jobId: `greenhouse_${companyId}_${job.id}`,
        title: job.title,
        company: companyId.charAt(0).toUpperCase() + companyId.slice(1),
        location: job.location?.name || 'Remote',
        workplaceType: 'Hybrid', // Assume hybrid unless text says remote
        boardType: 'greenhouse',
        applyUrl: job.absolute_url,
        postedAt: job.updated_at || new Date().toISOString(),
        discoveredAt: new Date().toISOString(),
        status: 'NEW'
      }));
    } catch (err) {
      console.warn(`Greenhouse crawl failed for '${companyId}':`, err);
      return [];
    }
  }

  /**
   * Fetches open job postings from a company's Lever board.
   */
  static async fetchLeverJobs(companyId: string): Promise<JobPosting[]> {
    const url = `https://api.lever.co/v0/postings/${companyId}`;
    console.log(`Polling Lever API for company '${companyId}'...`);

    try {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Failed to fetch Lever postings: ${res.statusText}`);
      }
      const data = (await res.json()) as any;
      
      if (!Array.isArray(data)) {
        return [];
      }

      return data.map((job: any) => ({
        jobId: `lever_${companyId}_${job.id}`,
        title: job.title,
        company: companyId.charAt(0).toUpperCase() + companyId.slice(1),
        location: job.categories?.location || 'Remote',
        workplaceType: job.categories?.commitment || 'Full-time',
        boardType: 'lever',
        applyUrl: job.hostedUrl,
        postedAt: job.createdAt ? new Date(job.createdAt).toISOString() : new Date().toISOString(),
        discoveredAt: new Date().toISOString(),
        status: 'NEW'
      }));
    } catch (err) {
      console.warn(`Lever crawl failed for '${companyId}':`, err);
      return [];
    }
  }

  /**
   * Polls Greenhouse and Lever boards for a pre-defined or custom list of tech companies.
   */
  static async crawlAll(companies: { board: 'greenhouse' | 'lever'; companyId: string }[]): Promise<JobPosting[]> {
    const allJobs: JobPosting[] = [];
    
    for (const target of companies) {
      let jobs: JobPosting[] = [];
      if (target.board === 'greenhouse') {
        jobs = await this.fetchGreenhouseJobs(target.companyId);
      } else if (target.board === 'lever') {
        jobs = await this.fetchLeverJobs(target.companyId);
      }
      allJobs.push(...jobs);
    }
    
    return allJobs;
  }
}
