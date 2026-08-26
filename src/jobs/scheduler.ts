import { PipelineOrchestrator } from './cron-scheduler';
import * as dotenv from 'dotenv';

dotenv.config();

const INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

console.log('==================================================');
console.log('AI Job Application Agent Cron Scheduler Started.');
console.log(`Interval: Every 5 minutes (${INTERVAL_MS}ms)`);
console.log('==================================================');

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

// Schedule interval
setInterval(async () => {
  console.log(`[${new Date().toISOString()}] Triggering scheduled pipeline run...`);
  try {
    const isDryRun = process.env.DRY_RUN !== 'false';
    await PipelineOrchestrator.runFullPipeline(isDryRun);
  } catch (err) {
    console.error('Error in scheduled pipeline run:', err);
  }
}, INTERVAL_MS);
