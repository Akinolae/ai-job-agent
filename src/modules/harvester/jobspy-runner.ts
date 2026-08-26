import { exec } from 'child_process';
import * as path from 'path';
import { JobPosting } from '../../config/firebase';
import { NotificationService } from '../../services/notification-service';

// Maximum time (ms) to wait for all job board scrapes to complete
const SCRAPE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

interface ScrapedJob {
  id: string;
  title: string;
  company: string;
  location: string;
  workplace_type: string;
  job_url: string;
  description: string;
  site: string;
  date_posted?: string;
}

export class JobspyRunner {
  /**
   * Scrapes multiple job boards concurrently using python-jobspy.
   * Accepts multiple search terms and locations for broader coverage.
   * All scraping happens in the Python wrapper via ThreadPoolExecutor.
   */
  static async scrape(
    searchTerms: string | string[],
    locations: string | string[],
    limitPerSite: number = 10,
    hoursOld: number = 336 // 2 weeks
  ): Promise<JobPosting[]> {
    const terms = Array.isArray(searchTerms) ? searchTerms : [searchTerms];
    const locs = Array.isArray(locations) ? locations : [locations];

    const primaryTerm = terms[0] || 'Software Engineer';
    const primaryLoc = locs[0] || '';
    const extraTerms = terms.slice(1);
    const extraLocs = locs.slice(1);

    const pythonScript = path.resolve(process.cwd(), 'jobspy_wrapper.py');

    // Build command with all terms/locations encoded as JSON
    const searchesArg = extraTerms.length > 0
      ? `--searches '${JSON.stringify(extraTerms)}'`
      : '';
    const locationsArg = extraLocs.length > 0
      ? `--locations '${JSON.stringify(extraLocs)}'`
      : '';

    const command = [
      `python3 "${pythonScript}"`,
      `--search "${primaryTerm}"`,
      primaryLoc ? `--location "${primaryLoc}"` : '',
      searchesArg,
      locationsArg,
      `--limit ${limitPerSite}`,
      `--hours ${hoursOld}`,
      `--country uk`,
    ].filter(Boolean).join(' ');

    console.log(`[JobSpy] Launching multi-board scrape across ${terms.length} search term(s) and ${locs.length} location(s)...`);

    return new Promise((resolve) => {
      const child = exec(
        command,
        { maxBuffer: 20 * 1024 * 1024, timeout: SCRAPE_TIMEOUT_MS },
        (error, stdout, stderr) => {
          // Log progress output from the wrapper
          if (stderr) {
            stderr.split('\n').filter(Boolean).forEach(line => console.log(`[JobSpy] ${line}`));
          }

          if (error) {
            const isTimeout = error.killed || (error as any).code === 'ETIMEDOUT';
            const msg = isTimeout
              ? `Job board scrape timed out after ${SCRAPE_TIMEOUT_MS / 1000}s — check your network connection.`
              : `Job board scraper failed: ${error.message}`;
            console.warn(`[JobSpy] ${msg}`);
            NotificationService.send({
              type: 'INFO',
              title: isTimeout ? '⏱ Scrape Timeout' : '⚠️ Scraper Error',
              body: msg,
              timestamp: new Date().toISOString(),
            });
            resolve([]);
            return;
          }

          try {
            const parsed = JSON.parse(stdout);
            if (parsed && (parsed as any).error) {
              const errMsg = `Job board API error: ${(parsed as any).error}`;
              console.warn(`[JobSpy] ${errMsg}`);
              NotificationService.send({
                type: 'INFO',
                title: '⚠️ Scraper API Error',
                body: errMsg,
                timestamp: new Date().toISOString(),
              });
              resolve([]);
              return;
            }

            const rawJobs: ScrapedJob[] = Array.isArray(parsed) ? parsed : [];
            const postings: JobPosting[] = rawJobs
              .filter(job => job.job_url && job.title && job.company)
              .map((job) => {
                const url = job.job_url.trim();
                const boardType = url.includes('lever.co')
                  ? 'lever'
                  : url.includes('greenhouse.io')
                  ? 'greenhouse'
                  : 'custom';

                const companyKey = job.company.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 20);
                const titleKey = job.title.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 25);
                // Clean normalized URL to generate consistent hash
                const cleanUrl = url.toLowerCase().split('?')[0].split('#')[0].replace(/\/+$/, '');
                let hash = 0;
                for (let i = 0; i < cleanUrl.length; i++) {
                  hash = ((hash << 5) - hash) + cleanUrl.charCodeAt(i);
                  hash |= 0;
                }
                const urlHash = Math.abs(hash).toString(36);

                return {
                  jobId: `${boardType}_${companyKey}_${titleKey}_${urlHash}`,
                  title: job.title.trim(),
                  company: job.company.trim(),
                  location: job.location || primaryLoc || 'Remote',
                  workplaceType: job.workplace_type || 'Full-time',
                  boardType: boardType as 'greenhouse' | 'lever' | 'custom',
                  applyUrl: url,
                  postedAt: job.date_posted ? new Date(job.date_posted).toISOString() : new Date().toISOString(),
                  discoveredAt: new Date().toISOString(),
                  status: 'NEW',
                };
              });

            console.log(`[JobSpy] Parsed ${postings.length} unique live job postings.`);
            resolve(postings);
          } catch (parseError) {
            console.warn(`[JobSpy] Failed to parse output: ${parseError}. Returning empty list.`);
            resolve([]);
          }
        }
      );
    });
  }
}
