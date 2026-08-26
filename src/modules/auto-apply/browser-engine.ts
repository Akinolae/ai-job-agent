import { chromium, Browser, BrowserContext, Page } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';

export class BrowserEngine {
  /**
   * Launches a new browser instance with stealth-like settings.
   */
  static async launchBrowser(headless: boolean = true): Promise<{ browser: Browser; context: BrowserContext }> {
    const browser = await chromium.launch({
      headless,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--use-fake-ui-for-media-stream',
        '--window-size=1280,800',
      ],
    });

    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 800 },
      deviceScaleFactor: 1,
      locale: 'en-US',
      timezoneId: 'Europe/Amsterdam',
    });

    // Injects simple script to hide webdriver indicators
    await context.addInitScript(() => {
      const nav = (navigator as any);
      if (nav) {
        Object.defineProperty(nav, 'webdriver', {
          get: () => undefined,
        });
      }
    });

    return { browser, context };
  }

  /**
   * Captures a full page screenshot and saves it locally in storage/temp.
   * Returns the absolute local path.
   */
  static async captureScreenshot(page: Page, prefix: string): Promise<string> {
    const tempDir = path.resolve(process.cwd(), 'storage/temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const filename = `${prefix}_${Date.now()}.png`;
    const screenshotPath = path.join(tempDir, filename);

    await page.screenshot({
      path: screenshotPath,
      fullPage: true,
    });

    return screenshotPath;
  }

  /**
   * Generates a 1x1 transparent PNG mockup file when browser automation is unavailable.
   */
  static createMockScreenshot(prefix: string): string {
    const tempDir = path.resolve(process.cwd(), 'storage/temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const filename = `${prefix}_mock_${Date.now()}.png`;
    const screenshotPath = path.join(tempDir, filename);
    const dummyPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
    fs.writeFileSync(screenshotPath, Buffer.from(dummyPngBase64, 'base64'));

    return screenshotPath;
  }
}
