import { NextRequest, NextResponse } from 'next/server';
import { dbService } from '../../../../config/firebase';

export async function POST(request: NextRequest) {
  try {
    const profileData = await request.json();
    profileData.updatedAt = new Date().toISOString();
    await dbService.saveProfile(profileData);
    return NextResponse.json({ message: 'Profile updated successfully.', profile: profileData });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
