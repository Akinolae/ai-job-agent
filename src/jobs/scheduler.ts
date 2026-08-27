import { PipelineOrchestrator } from './cron-scheduler';
import * as dotenv from 'dotenv';

dotenv.config();

const INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// Keep the long-running scheduler process alive through transient pipeline
// errors so the recurring loop never halts unexpectedly.
process.on('unhandledRejection', (reason) => {
  console.error(`[Scheduler] Unhandled rejection (scheduler kept alive):`, reason);
});
process.on('uncaughtException', (err) => {
  console.error(`[Scheduler] Uncaught exception (scheduler kept alive):`, err);
});

console.log('==================================================');
console.log('AI Job Application Agent Cron Scheduler Started.');
console.log(`Interval: Every 5 minutes (${INTERVAL_MS}ms)`);
console.log('==================================================');

// Register the recurring loop FIRST so a slow or failing initial run can
// never prevent the interval from being scheduled.
setInterval(async () => {
  console.log(`[${new Date().toISOString()}] Triggering scheduled pipeline run...`);
  try {
    const isDryRun = process.env.DRY_RUN !== 'false';
    await PipelineOrchestrator.runFullPipeline(isDryRun);
  } catch (err) {
    console.error('Error in scheduled pipeline run:', err);
  }
}, INTERVAL_MS);

// Run immediately on start
(async () => {
  console.log(`[${new Date().toISOString()}] Running initial pipeline execution...`);
  try {
    const isDryRun = process.env.DRY_RUN !== 'false';
    await PipelineOrchestrator.runFullPipeline(isDryRun);
  } catch (err) {
    console.error('Error in initial pipeline run:', err);
  }
})();
