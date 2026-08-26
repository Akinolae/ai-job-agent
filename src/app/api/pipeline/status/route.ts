import { NextResponse } from "next/server";
import { PipelineOrchestrator } from "../../../../jobs/cron-scheduler";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const status = PipelineOrchestrator.getStatus();
    return NextResponse.json(status);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
