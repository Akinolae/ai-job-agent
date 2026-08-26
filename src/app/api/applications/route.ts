import { NextResponse } from 'next/server';
import { dbService } from '../../../config/firebase';

export async function GET() {
  try {
    const apps = await dbService.listApplications();
    apps.sort((a, b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime());
    return NextResponse.json(apps);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    await dbService.clearApplications();
    return NextResponse.json({ message: 'All applications cleared successfully.' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
