import { NextResponse } from 'next/server';
import { dbService } from '../../../config/firebase';

export async function GET() {
  try {
    const rawJobs = await dbService.listJobs();
    rawJobs.sort((a, b) => new Date(b.discoveredAt).getTime() - new Date(a.discoveredAt).getTime());

    // Deduplicate jobs by normalized URL and title+company
    const seen = new Set<string>();
    const uniqueJobs = [];

    const normalizeUrl = (url: string) => (url || '').toLowerCase().split('?')[0].split('#')[0].replace(/\/+$/, '');

    for (const job of rawJobs) {
      const cleanUrl = normalizeUrl(job.applyUrl);
      const key = cleanUrl || `${(job.company || '').toLowerCase().trim()}:::${(job.title || '').toLowerCase().trim()}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueJobs.push(job);
      }
    }

    return NextResponse.json(uniqueJobs);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    await dbService.clearJobs();
    return NextResponse.json({ message: 'All job postings cleared successfully.' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
