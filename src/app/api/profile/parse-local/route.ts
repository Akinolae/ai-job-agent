import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { ProfileService } from '../../../../modules/cv-parser/profile-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { localPath } = body;
    
    if (!localPath || !fs.existsSync(localPath)) {
      return NextResponse.json(
        { error: 'Valid local absolute file path to a resume PDF is required.' },
        { status: 400 }
      );
    }

    const tempDir = path.resolve(process.cwd(), 'storage/temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const destFileName = `resume_${Date.now()}.pdf`;
    const destFilePath = path.join(tempDir, destFileName);
    fs.copyFileSync(localPath, destFilePath);

    const relativeStoragePath = `resumes/${destFileName}`;
    const profile = await ProfileService.parseAndSaveProfile(destFilePath, relativeStoragePath);
    
    return NextResponse.json(profile);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
