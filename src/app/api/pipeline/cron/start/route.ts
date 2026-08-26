import { NextRequest, NextResponse } from "next/server";
import { PipelineOrchestrator } from "../../../../../jobs/cron-scheduler";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const intervalMinutes = Number(body.intervalMinutes) || 60;
    const dryRun = body.dryRun !== false;
    const result = PipelineOrchestrator.startCron(intervalMinutes, dryRun);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
