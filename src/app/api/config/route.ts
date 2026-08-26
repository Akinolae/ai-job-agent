import { NextResponse } from 'next/server';
import { dbService } from '../../../config/firebase';
import { GeminiService } from '../../../config/gemini';

export async function GET() {
  return NextResponse.json({
    geminiMock: GeminiService.isMock(),
    firebaseLocal: !dbService.isUsingFirebase(),
  });
}
