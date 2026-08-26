import * as fs from 'fs';
import * as path from 'path';
import pdf from 'pdf-parse';
import mammoth from 'mammoth';

/**
 * Extracts raw text from a PDF or DOCX file.
 * Falls back to mock text if parsing errors occur.
 */
export async function extractTextFromCv(filePath: string): Promise<string> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`CV file not found at: ${filePath}`);
  }

  const ext = path.extname(filePath).toLowerCase();

  try {
    if (ext === '.pdf') {
      const dataBuffer = fs.readFileSync(filePath);
      const data = await pdf(dataBuffer);
      return data.text || '';
    } else if (ext === '.docx') {
      const result = await mammoth.extractRawText({ path: filePath });
      return result.value || '';
    } else {
      throw new Error(`Unsupported file extension: ${ext}. Please upload a PDF or DOCX file.`);
    }
  } catch (error: any) {
    console.error(`Error parsing CV file at ${filePath}:`, error);
    throw new Error(`Could not extract text from uploaded resume: ${error.message}`);
  }
}
