import { NextRequest, NextResponse } from 'next/server';
import { PipelineOrchestrator } from '../../../../jobs/cron-scheduler';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const dryRun = body.dryRun !== false; // Defaults to true

    console.log(`Triggering pipeline manually via Next.js API. Dry-run mode: ${dryRun}`);
    
    // Fire and forget background execution (as in the Express code)
    PipelineOrchestrator.runFullPipeline(dryRun)
      .then(() => console.log('Manual pipeline execution finished.'))
      .catch((err) => console.error('Error running manual pipeline:', err));

    return NextResponse.json({ message: 'Pipeline run initiated in the background.', dryRun });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
