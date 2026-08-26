import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { ProfileService } from '../../../../modules/cv-parser/profile-service';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded.' }, { status: 400 });
    }

    // Validate extension
    const ext = path.extname(file.name).toLowerCase();
    if (ext !== '.pdf' && ext !== '.docx') {
      return NextResponse.json(
        { error: 'Invalid file type. Only PDF and DOCX files are allowed.' },
        { status: 400 }
      );
    }

    const tempDir = path.resolve(process.cwd(), 'storage/temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const destFileName = `resume_${Date.now()}${ext}`;
    const destFilePath = path.join(tempDir, destFileName);

    // Convert File object to Node buffer and save locally
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    fs.writeFileSync(destFilePath, buffer);

    const relativeStoragePath = `resumes/${destFileName}`;
    const profile = await ProfileService.parseAndSaveProfile(destFilePath, relativeStoragePath);
    
    return NextResponse.json(profile);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
