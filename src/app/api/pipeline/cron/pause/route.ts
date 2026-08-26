import { NextResponse } from "next/server";
import { PipelineOrchestrator } from "../../../../../jobs/cron-scheduler";

export async function POST() {
  try {
    const result = PipelineOrchestrator.pauseCron();
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
