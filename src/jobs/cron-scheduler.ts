import { dbService, JobPosting, CandidateProfile } from "../config/firebase";
import { JobspyRunner } from "../modules/harvester/jobspy-runner";
import { LiveJobSources } from "../modules/harvester/live-sources";
import { Scorer } from "../modules/matcher/scorer";
import { ProfileService } from "../modules/cv-parser/profile-service";
import { NotificationService } from "../services/notification-service";
import * as path from "path";
import * as fs from "fs";

export class PipelineOrchestrator {
  private static isRunning: boolean = false;
  private static isCancelled: boolean = false;
  private static activeDryRun: boolean = true;
  private static startedAt: string | null = null;
  private static isCronActive: boolean = false;
  private static cronIntervalMinutes: number = 60;
  private static cronTimer: NodeJS.Timeout | null = null;
  private static crashGuardsInstalled: boolean = false;

  static getStatus(): {
    isRunning: boolean;
    dryRun: boolean;
    startedAt: string | null;
    cronActive: boolean;
    cronIntervalMinutes: number;
  } {
    return {
      isRunning: this.isRunning,
      dryRun: this.activeDryRun,
      startedAt: this.startedAt,
      cronActive: this.isCronActive,
      cronIntervalMinutes: this.cronIntervalMinutes,
    };
  }

  static startCron(
    intervalMinutes: number = 60,
    dryRun: boolean = true,
  ): { success: boolean; message: string } {
    this.cronIntervalMinutes = intervalMinutes;
    this.isCronActive = true;

    if (this.cronTimer) {
      clearInterval(this.cronTimer);
      this.cronTimer = null;
    }

    console.log(
      `[Pipeline] Autonomous cron scheduler activated: running every ${intervalMinutes} minute(s).`,
    );

    // Robustness: keep the recurring loop alive even if a single run throws.
    this.installCrashGuards();

    // Trigger immediate run (isolated so a failure never halts the timer)
    this.runCronTick(dryRun, "immediate").catch((e) =>
      console.error("[Pipeline Cron Error]", e),
    );

    // Schedule recurring runs
    this.cronTimer = setInterval(() => {
      console.log(
        `[Pipeline] Triggering scheduled cron run (every ${intervalMinutes}m)...`,
      );
      this.runCronTick(dryRun, "interval").catch((e) =>
        console.error("[Pipeline Cron Error]", e),
      );
    }, intervalMinutes * 60 * 1000);

    NotificationService.send({
      type: "SCAN_COMPLETE",
      title: "⏰ Autonomous Cron Started",
      body: `Autonomous job search scheduled to run automatically every ${intervalMinutes} minute(s).`,
      timestamp: new Date().toISOString(),
    });

    return {
      success: true,
      message: `Autonomous cron scheduler started (every ${intervalMinutes}m).`,
    };
  }

  static pauseCron(): { success: boolean; message: string } {
    this.isCronActive = false;
    if (this.cronTimer) {
      clearInterval(this.cronTimer);
      this.cronTimer = null;
    }
    this.stopPipeline();

    NotificationService.send({
      type: "SCAN_COMPLETE",
      title: "⏸ Cron Paused / Stopped",
      body: "The recurring cron scheduler and active scan have been paused.",
      timestamp: new Date().toISOString(),
    });

    console.log("[Pipeline] Autonomous cron scheduler paused.");
    return {
      success: true,
      message: "Autonomous cron scheduler and scan paused.",
    };
  }

  static stopPipeline(): { success: boolean; message: string } {
    const wasRunning = this.isRunning;
    this.isCancelled = true;
    this.isRunning = false;
    this.startedAt = null;

    if (this.cronTimer) {
      clearInterval(this.cronTimer);
      this.cronTimer = null;
      this.isCronActive = false;
    }

    NotificationService.send({
      type: "SCAN_COMPLETE",
      title: "🛑 Scan Stopped",
      body: wasRunning
        ? "The active recruitment loop / cron job was manually stopped by user."
        : "Cron scheduler stopped.",
      timestamp: new Date().toISOString(),
    });
    console.log("[Pipeline] Execution stopped manually by user.");
    return {
      success: true,
      message: "Pipeline scan and cron job stopped successfully.",
    };
  }

  /**
   * Crash-safe wrapper around runFullPipeline. Guarantees that an error in a
   * single tick is logged and swallowed — it can never clear the recurring
   * timer or halt the scheduler loop.
   */
  private static async runCronTick(
    dryRun: boolean,
    source: string,
  ): Promise<void> {
    try {
      await this.runFullPipeline(dryRun);
    } catch (err) {
      console.error(`[Pipeline Cron Error] during ${source} run:`, err);
      // Never propagate: the recurring timer must keep firing on the next tick.
    }
  }

  /**
   * Installs process-level crash guards so an unexpected error inside the
   * background scheduler can never silently kill the process (which would
   * stop the cron loop permanently). Handlers are installed only once.
   */
  private static installCrashGuards(): void {
    if (this.crashGuardsInstalled) return;
    this.crashGuardsInstalled = true;

    process.on("unhandledRejection", (reason) => {
      console.error(
        "[Pipeline] Unhandled promise rejection caught (cron kept alive):",
        reason,
      );
    });

    process.on("uncaughtException", (err) => {
      // Do not exit: an autonomous scheduler must survive a stray top-level error.
      console.error(
        "[Pipeline] Uncaught exception handled (cron kept alive):",
        err,
      );
    });

    console.log("[Pipeline] Process crash guards installed for cron loop.");
  }

  /**
   * Runs the full end-to-end harvest, score, and apply workflow.
   */
  static async runFullPipeline(dryRun: boolean = true): Promise<void> {
    if (this.isRunning) {
      console.warn("[Pipeline] Pipeline is already running.");
      return;
    }

    this.isRunning = true;
    this.isCancelled = false;
    this.activeDryRun = dryRun;
    this.startedAt = new Date().toISOString();

    try {
      console.log("--- STARTING AI JOB AGENT PIPELINE RUN ---");

      // 1. Load profile
      let profile = await dbService.getProfile();
      if (!profile) {
        console.warn(
          "No candidate profile found. Loading default fallback profile from config...",
        );
        const mockProfile = ProfileService.getMockProfile("master_resume.pdf");

        // Ensure local dummy resume exists for testing
        const tempDir = path.resolve(process.cwd(), "storage/temp");
        const dummyPdfPath = path.join(tempDir, "master_resume.pdf");
        if (!fs.existsSync(dummyPdfPath)) {
          fs.mkdirSync(tempDir, { recursive: true });
          fs.writeFileSync(
            dummyPdfPath,
            "MOCK PDF RESUME CONTENT: Makinde Akinola, Senior Frontend Engineer.",
          );
        }

        await dbService.saveProfile(mockProfile);
        profile = mockProfile;
      }

      if (this.isCancelled) return;

      const activeProfile = (await dbService.getProfile())!;

      // 2. Job Discovery Phase — exhaustive search across target roles AND AI-identified potentially qualified roles
      console.log(
        "Phase 2: Scraping live job boards across target roles and potentially qualified roles...",
      );

      const explicitRoles = activeProfile.targetRoles?.length
        ? activeProfile.targetRoles
        : [];
      const qualifiedRoles = activeProfile.potentiallyQualifiedRoles?.length
        ? activeProfile.potentiallyQualifiedRoles
        : [];

      // Primary core search roles (prioritize candidate's direct target roles)
      let searchRoles: string[] = Array.from(
        new Set(
          [...explicitRoles, ...qualifiedRoles.slice(0, 3)]
            .map((r) => r.trim())
            .filter(Boolean),
        ),
      );

      // Fallback: read directly from local db.json if profile targetRoles was empty
      if (searchRoles.length === 0) {
        try {
          const dbJsonPath = path.resolve(
            process.cwd(),
            "storage/temp/db.json",
          );
          if (fs.existsSync(dbJsonPath)) {
            const dbData = JSON.parse(fs.readFileSync(dbJsonPath, "utf-8"));
            const p = dbData.profiles?.default;
            if (p) {
              const fromDb = [
                ...(p.targetRoles || []),
                ...(p.potentiallyQualifiedRoles || []),
              ];
              searchRoles = Array.from(
                new Set(fromDb.map((r) => String(r).trim()).filter(Boolean)),
              );
            }
          }
        } catch (e) {
          console.warn("[Pipeline] Could not read db.json fallback roles:", e);
        }
      }

      if (searchRoles.length === 0) {
        searchRoles = ["Senior Full-Stack Engineer", "Software Engineer"];
      }

      const profileLocs = activeProfile.targetLocations?.length
        ? activeProfile.targetLocations
        : [];
      const basePriorityLocs = ["Remote", "Worldwide", "Remote Worldwide", "United Kingdom", "United States"];
      const targetLocations = Array.from(
        new Set([...profileLocs, ...basePriorityLocs]),
      ).slice(0, 6); // Keep focused to avoid combinatorial search explosion

      console.log(
        `[Pipeline] Targeted search for ${searchRoles.length} role(s): ${searchRoles.join(", ")} across locations: ${targetLocations.join(", ")}`,
      );

      const [liveApiJobs, scrapedJobs] = await Promise.all([
        LiveJobSources.fetchAll(searchRoles),
        JobspyRunner.scrape(searchRoles.slice(0, 4), targetLocations.slice(0, 3), 10, 336),
      ]);

      if (this.isCancelled) return;

      const discoveredJobs: JobPosting[] = [...liveApiJobs, ...scrapedJobs];
      console.log(
        `[Pipeline] Discovered total ${discoveredJobs.length} live job postings across Arbeitnow, Remotive, Jobicy, Indeed, and LinkedIn.`,
      );

      // 3. Deduplication & Concurrent Matching
      console.log("Phase 3: Processing and scoring new job postings with high-precision gating...");
      const newlyQueuedJobs: JobPosting[] = [];
      const allExistingJobs = await dbService.listJobs();

      const normalizeUrl = (url: string) =>
        (url || "")
          .toLowerCase()
          .split("?")[0]
          .split("#")[0]
          .replace(/\/+$/, "");
      const existingJobIds = new Set(allExistingJobs.map((j) => j.jobId));
      const existingUrls = new Set(
        allExistingJobs.map((j) => normalizeUrl(j.applyUrl)).filter(Boolean),
      );
      const existingKeys = new Set(
        allExistingJobs.map(
          (j) =>
            `${(j.company || "").toLowerCase().trim()}:::${(j.title || "").toLowerCase().trim()}`,
        ),
      );

      // Deduplicate first
      const jobsToProcess: JobPosting[] = [];
      for (const rawJob of discoveredJobs) {
        const cleanUrl = normalizeUrl(rawJob.applyUrl);
        const companyTitleKey = `${(rawJob.company || "").toLowerCase().trim()}:::${(rawJob.title || "").toLowerCase().trim()}`;

        if (
          existingJobIds.has(rawJob.jobId) ||
          (cleanUrl && existingUrls.has(cleanUrl)) ||
          existingKeys.has(companyTitleKey)
        ) {
          continue;
        }

        existingJobIds.add(rawJob.jobId);
        if (cleanUrl) existingUrls.add(cleanUrl);
        existingKeys.add(companyTitleKey);
        jobsToProcess.push(rawJob);
      }

      console.log(`[Pipeline] Scoring ${jobsToProcess.length} newly discovered unique postings in parallel batches...`);

      // Process in concurrent batches of 6 for speed
      const BATCH_SIZE = 6;
      for (let i = 0; i < jobsToProcess.length; i += BATCH_SIZE) {
        if (this.isCancelled) return;
        const batch = jobsToProcess.slice(i, i + BATCH_SIZE);

        const evaluatedBatch = await Promise.all(
          batch.map(async (job) => {
            await dbService.saveJob(job);
            try {
              return await Scorer.evaluateJob(job);
            } catch (jobErr) {
              // One failing posting must not abort the whole run.
              console.error(
                `[Scorer] Evaluation failed for ${job.jobId} "${job.title}" — skipping job, continuing batch:`,
                jobErr,
              );
              return job;
            }
          })
        );

        for (const evaluatedJob of evaluatedBatch) {
          if (evaluatedJob.status === "QUEUED") {
            newlyQueuedJobs.push(evaluatedJob);
          }
        }
      }

      if (this.isCancelled) return;

      console.log(
        `Scoring finished. Identified ${newlyQueuedJobs.length} new high-matching opportunities.`,
      );

      // 4. Match Summary & Direct Apply Notification
      if (newlyQueuedJobs.length > 0) {
        for (const job of newlyQueuedJobs) {
          NotificationService.send({
            type: "MATCH_FOUND",
            title: `🎯 High Match Found (${job.matchScore}%) — ${job.company}`,
            body: `New role "${job.title}" at ${job.company} matches your profile (${job.matchScore}%). Direct apply link and tailored pitch ready.`,
            company: job.company,
            role: job.title,
            timestamp: new Date().toISOString(),
          });
        }
      }

      NotificationService.send({
        type: "SCAN_COMPLETE",
        title: "🏁 Discovery & Match Scan Complete",
        body: `Scan finished. ${discoveredJobs ? discoveredJobs.length : 0} jobs scraped, ${newlyQueuedJobs.length} high-match position(s) evaluated and ready for direct apply.`,
        timestamp: new Date().toISOString(),
      });
      console.log("--- PIPELINE RUN FINISHED SUCCESSFULLY ---");
    } finally {
      this.isRunning = false;
      this.isCancelled = false;
      this.startedAt = null;
    }
  }
}

// Support executing directly from command line (e.g. npm run harvest)
if (
  process.argv[1] &&
  (import.meta.url === `file://${process.argv[1]}` ||
    process.argv[1].endsWith("cron-scheduler.ts"))
) {
  (async () => {
    const isDryRun = process.env.DRY_RUN !== "false"; // Defaults to true
    await PipelineOrchestrator.runFullPipeline(isDryRun);
  })();
}
