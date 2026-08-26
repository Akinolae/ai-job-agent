import { NextResponse } from 'next/server';
import { dbService } from '../../../config/firebase';

export async function GET() {
  try {
    const profile = await dbService.getProfile();
    if (!profile) {
      return NextResponse.json({ error: 'No profile found. Please upload/create one.' }, { status: 404 });
    }
    return NextResponse.json(profile);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
