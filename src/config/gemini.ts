import { GoogleGenAI } from '@google/genai';
import * as dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
const isMockMode = !apiKey || apiKey.includes('your_gemini_api_key_here') || apiKey === '';

let aiClient: GoogleGenAI | null = null;

if (!isMockMode) {
  try {
    aiClient = new GoogleGenAI({ apiKey });
    console.log('Gemini API client initialized successfully.');
  } catch (err) {
    console.error('Failed to initialize Gemini Client, running in Mock Mode:', err);
  }
} else {
  console.log('Running Gemini service in MOCK MODE (No active GEMINI_API_KEY set).');
}

// Fast, high-throughput reasoning models prioritized for speed and quota resilience
const DEFAULT_MODEL_CASCADE = Array.from(
  new Set([
    process.env.GEMINI_MODEL,
    'gemini-3.1-flash-lite',
    'gemini-3.5-flash-lite',
    'gemini-3.5-flash',
  ].filter(Boolean))
) as string[];

async function withTimeout<T>(promise: Promise<T>, ms = 30000): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
}

export class GeminiService {
  static isMock(): boolean {
    return isMockMode || !aiClient;
  }

  /**
   * Generates structured JSON from high-tier Gemini model with automatic cascade and timeout.
   */
  static async generateJson<T>(prompt: string, schema: any, mockFallback: () => T): Promise<T> {
    if (this.isMock()) {
      await new Promise((resolve) => setTimeout(resolve, 300));
      return mockFallback();
    }

    for (const model of DEFAULT_MODEL_CASCADE) {
      try {
        const response = await withTimeout(
          aiClient!.models.generateContent({
            model,
            contents: prompt,
            config: {
              responseMimeType: 'application/json',
              responseSchema: schema,
              temperature: 0.1,
            },
          }),
          30000
        );

        const text = response.text;
        if (text) {
          return JSON.parse(text) as T;
        }
      } catch (error: any) {
        console.warn(`Gemini model ${model} unavailable (${error?.status || error?.message || error}), attempting fallback...`);
      }
    }

    console.error('All high-tier Gemini models failed, falling back to mock.');
    return mockFallback();
  }

  /**
   * Simple text generation wrapper for free-form responses with automatic cascade.
   */
  static async generateText(prompt: string, mockFallback: () => string): Promise<string> {
    if (this.isMock()) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      return mockFallback();
    }

    for (const model of DEFAULT_MODEL_CASCADE) {
      try {
        const response = await withTimeout(
          aiClient!.models.generateContent({
            model,
            contents: prompt,
            config: {
              temperature: 0.2,
            },
          }),
          30000
        );

        const text = response.text?.trim();
        if (text) {
          return text;
        }
      } catch (error: any) {
        console.warn(`Gemini model ${model} unavailable (${error?.status || error?.message || error}), attempting fallback...`);
      }
    }

    console.error('All high-tier Gemini models failed, falling back to mock.');
    return mockFallback();
  }
}
