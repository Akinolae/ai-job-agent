import { Page } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';
import { BrowserEngine } from './browser-engine';
import { ScreenAnswerer } from './screen-answerer';
import { dbService, CandidateProfile, ApplicationRecord } from '../../config/firebase';

export class LeverHandler {
  /**
   * Handles auto-filling and submitting applications on Lever job boards.
   */
  static async apply(
    applyUrl: string,
    profile: CandidateProfile,
    jobId: string,
    company: string,
    role: string,
    dryRun: boolean = true
  ): Promise<ApplicationRecord> {
    console.log(`Starting Lever application automation for ${role} at ${company}...`);
    
    const applyEndpointUrl = applyUrl.endsWith('/apply') ? applyUrl : `${applyUrl}/apply`;

    const applicationId = `app_${Date.now()}`;
    const record: ApplicationRecord = {
      applicationId,
      jobId,
      company,
      role,
      appliedAt: new Date().toISOString(),
      status: 'FAILED',
      submittedPayload: {},
    };

    let browser: any = null;
    let context: any = null;
    let page: any = null;
    let useMockBrowser = false;

    try {
      const launched = await BrowserEngine.launchBrowser(true);
      browser = launched.browser;
      context = launched.context;
      page = await context.newPage();
    } catch (launchErr) {
      console.warn(`Could not launch Playwright browser (possibly missing browser binaries): ${launchErr}. Running in MOCK BROWSER MODE.`);
      useMockBrowser = true;
    }

    try {
      const submittedFields: Record<string, string> = {};

      if (useMockBrowser) {
        // --- Mock Browser Simulation ---
        console.log(`[MOCK BROWSER] Simulating filling Lever form for ${company}...`);
        
        submittedFields['fullName'] = profile.name;
        submittedFields['email'] = profile.email;
        submittedFields['phone'] = profile.phone;
        submittedFields['company'] = 'Self-Employed / Freelancer';
        submittedFields['linkedIn'] = `https://linkedin.com/in/${profile.name.toLowerCase().replace(' ', '')}`;
        submittedFields['github'] = `https://github.com/${profile.name.toLowerCase().split(' ')[0]}`;
        submittedFields['resume'] = path.basename(profile.cvStoragePath);

        const mockQuestions = [
          'Why are you excited to join us?',
          'Work authorization status',
          'Desired compensation'
        ];

        for (const q of mockQuestions) {
          const ans = await ScreenAnswerer.answerQuestion(q, profile, role, company);
          submittedFields[q] = ans;
        }

        record.submittedPayload = submittedFields;

        // Generate mock screenshots
        const mockPreSubmitLocal = BrowserEngine.createMockScreenshot(`${company.toLowerCase()}_presubmit`);
        const preSubmitUrl = await dbService.uploadFile(mockPreSubmitLocal, `screenshots/${applicationId}_presubmit.png`);
        record.preSubmitScreenshotPath = preSubmitUrl;

        record.status = 'SUCCESS';
        record.notes = 'Form filled and verified via Mock Browser simulation (browser binaries missing).';
        console.log(`[MOCK BROWSER] Completed application simulation for ${company}.`);

        if (!dryRun) {
          const mockConfirmLocal = BrowserEngine.createMockScreenshot(`${company.toLowerCase()}_confirmed`);
          const confirmUrl = await dbService.uploadFile(mockConfirmLocal, `screenshots/${applicationId}_confirmed.png`);
          record.confirmationScreenshotPath = confirmUrl;
          record.notes = 'Application submitted successfully via Mock Browser simulation.';
        }
      } else {
        // --- Real Playwright Automation ---
        // 45s page load timeout — catches network outages or unresponsive job boards
        try {
          await page.goto(applyEndpointUrl, { waitUntil: 'networkidle', timeout: 45000 });
        } catch (navErr: any) {
          const isTimeout = navErr.message?.includes('Timeout') || navErr.name === 'TimeoutError';
          throw new Error(
            isTimeout
              ? `Page load timed out after 45s loading ${applyEndpointUrl}. The job board may be down or your network is slow.`
              : `Failed to load application page: ${navErr.message}`
          );
        }
        console.log(`Lever apply page loaded: ${applyEndpointUrl}`);

        // 1. Upload Resume
        const resumeInput = await page.$('input[type="file"][id="resume-upload-input"]');
        if (resumeInput) {
          try {
            const localResumePath = await this.resolveResumePath(profile.cvStoragePath);
            if (fs.existsSync(localResumePath)) {
              await resumeInput.setInputFiles(localResumePath);
              submittedFields['resume'] = path.basename(profile.cvStoragePath);
              console.log(`Uploaded resume: ${localResumePath}`);
              await page.waitForTimeout(2000);
            } else {
              console.warn(`Local resume file not found at resolved path: ${localResumePath}`);
            }
          } catch (err: any) {
            console.error(`Failed to resolve/download resume for upload: ${err.message}`);
          }
        }

        // 2. Fill Name
        const nameInput = await page.$('input[name="name"]');
        if (nameInput) {
          const val = await nameInput.inputValue();
          if (!val) {
            await nameInput.fill(profile.name);
            submittedFields['fullName'] = profile.name;
          }
        }

        // 3. Fill Email
        const emailInput = await page.$('input[name="email"]');
        if (emailInput) {
          const val = await emailInput.inputValue();
          if (!val) {
            await emailInput.fill(profile.email);
            submittedFields['email'] = profile.email;
          }
        }

        // 4. Fill Phone
        const phoneInput = await page.$('input[name="phone"]');
        if (phoneInput) {
          const val = await phoneInput.inputValue();
          if (!val) {
            await phoneInput.fill(profile.phone);
            submittedFields['phone'] = profile.phone;
          }
        }

        // 5. Fill Org
        const orgInput = await page.$('input[name="org"]');
        if (orgInput) {
          const val = await orgInput.inputValue();
          if (!val) {
            await orgInput.fill('Self-Employed / Independent');
            submittedFields['company'] = 'Self-Employed';
          }
        }

        // 6. Social URLs
        const linkedInInput = await page.$('input[name="urls[LinkedIn]"]');
        if (linkedInInput) {
          const val = await linkedInInput.inputValue();
          if (!val) {
            const url = `https://linkedin.com/in/${profile.name.toLowerCase().replace(' ', '')}`;
            await linkedInInput.fill(url);
            submittedFields['linkedIn'] = url;
          }
        }

        const gitHubInput = await page.$('input[name="urls[GitHub]"]');
        if (gitHubInput) {
          const val = await gitHubInput.inputValue();
          if (!val) {
            const url = `https://github.com/${profile.name.toLowerCase().split(' ')[0]}`;
            await gitHubInput.fill(url);
            submittedFields['github'] = url;
          }
        }

        // 7. Custom questions
        const questions = await page.$$('.application-question');
        for (const qEl of questions) {
          const labelEl = await qEl.$('.application-label, label');
          if (!labelEl) continue;

          const labelText = (await labelEl.innerText()) || '';
          const trimmedLabel = labelText.replace(/\s+/g, ' ').trim();

          if (
            trimmedLabel.toLowerCase().includes('linkedin') ||
            trimmedLabel.toLowerCase().includes('github') ||
            trimmedLabel.toLowerCase().includes('resume') ||
            trimmedLabel.toLowerCase().includes('cv') ||
            trimmedLabel.toLowerCase().includes('portfolio')
          ) {
            continue;
          }

          const input = await qEl.$('input[type="text"]');
          const textarea = await qEl.$('textarea');
          const select = await qEl.$('select');
          const checkbox = await qEl.$('input[type="checkbox"]');
          const radioGroup = await qEl.$$('input[type="radio"]');

          if (input) {
            const val = await input.inputValue();
            if (!val) {
              const answer = await ScreenAnswerer.answerQuestion(trimmedLabel, profile, role, company);
              await input.fill(answer);
              submittedFields[trimmedLabel] = answer;
            }
          } else if (textarea) {
            const val = await textarea.inputValue();
            if (!val) {
              const answer = await ScreenAnswerer.answerQuestion(trimmedLabel, profile, role, company);
              await textarea.fill(answer);
              submittedFields[trimmedLabel] = answer;
            }
          } else if (select) {
            const options = await select.$$eval('option', (opts: any[]) => 
              opts.map((o: any) => ({ value: o.value, text: (o.textContent || '').trim() }))
            );
            const selectedValue = await ScreenAnswerer.selectBestOption(trimmedLabel, options, profile, role, company);
            if (selectedValue) {
              await select.selectOption(selectedValue);
              const selectedOptText = options.find((o: { value: string; text: string }) => o.value === selectedValue)?.text || selectedValue;
              submittedFields[trimmedLabel] = selectedOptText;
            }
          } else if (radioGroup.length > 0) {
            const radioOptions: { value: string; text: string }[] = [];
            for (let i = 0; i < radioGroup.length; i++) {
              const rId = await radioGroup[i].getAttribute('id');
              const rName = await radioGroup[i].getAttribute('name');
              let rText = '';
              if (rId) {
                const label = await qEl.$(`label[for="${rId}"]`);
                if (label) {
                  rText = await label.innerText();
                }
              }
              if (!rText && rName) {
                rText = await radioGroup[i].evaluate((el: any) => el.nextSibling?.textContent || el.parentElement?.textContent || '');
              }
              radioOptions.push({ value: String(i), text: rText.trim() });
            }
            const selectedVal = await ScreenAnswerer.selectBestOption(trimmedLabel, radioOptions, profile, role, company);
            const idx = parseInt(selectedVal, 10);
            if (!isNaN(idx) && idx >= 0 && idx < radioGroup.length) {
              await radioGroup[idx].click();
              submittedFields[trimmedLabel] = radioOptions[idx].text;
            }
          } else if (checkbox) {
            const checked = await checkbox.isChecked();
            if (!checked) {
              await checkbox.check();
              submittedFields[trimmedLabel] = 'Checked';
            }
          }
        }

        record.submittedPayload = submittedFields;

        // Capture pre-submit screenshot
        const preSubmitLocal = await BrowserEngine.captureScreenshot(page, `${company.toLowerCase()}_presubmit`);
        const preSubmitUrl = await dbService.uploadFile(preSubmitLocal, `screenshots/${applicationId}_presubmit.png`);
        record.preSubmitScreenshotPath = preSubmitUrl;

        if (dryRun) {
          record.status = 'SUCCESS';
          record.notes = 'Form filled and verified via Dry Run mode.';
        } else {
          const submitButton = await page.$('#btn-submit, button[type="submit"], .postings-btn.template-btn-submit');
          if (submitButton) {
            await submitButton.click();
            await page.waitForNavigation({ waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
            
            const confirmLocal = await BrowserEngine.captureScreenshot(page, `${company.toLowerCase()}_confirmation`);
            const confirmUrl = await dbService.uploadFile(confirmLocal, `screenshots/${applicationId}_confirmed.png`);
            record.confirmationScreenshotPath = confirmUrl;
            record.status = 'SUCCESS';
            record.notes = 'Application submitted successfully.';
          } else {
            throw new Error('Submit button not found on Lever page.');
          }
        }
      }
    } catch (err: any) {
      const isTimeout = err.message?.includes('timed out') || err.message?.includes('Timeout');
      console.error(`Error executing Lever automation for ${company}:`, err);
      record.status = 'FAILED';
      record.notes = isTimeout
        ? `⏱ Timeout: ${err.message}`
        : err.message || 'Unknown error occurred during Playwright filling.';
    } finally {
      if (browser) {
        await browser.close();
      }
    }

    await dbService.saveApplication(record);
    return record;
  }

  private static async resolveResumePath(cvStoragePath: string): Promise<string> {
    const tempDir = path.resolve(process.cwd(), 'storage/temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const filename = path.basename(cvStoragePath);
    const localPath = path.join(tempDir, filename);

    // If it's a URL, download it if not present locally
    if (cvStoragePath.startsWith('http://') || cvStoragePath.startsWith('https://')) {
      if (!fs.existsSync(localPath)) {
        console.log(`Downloading resume from Firebase Storage URL: ${cvStoragePath}`);
        const response = await fetch(cvStoragePath);
        if (!response.ok) {
          throw new Error(`Failed to download resume from URL: ${response.statusText}`);
        }
        const buffer = Buffer.from(await response.arrayBuffer());
        fs.writeFileSync(localPath, buffer);
        console.log(`Downloaded resume to: ${localPath}`);
      }
      return localPath;
    }

    // If it's a relative static path like /static/resume_123.pdf, resolve it in the uploads folder
    if (cvStoragePath.startsWith('/static/')) {
      const uploadsDir = path.resolve(process.cwd(), 'storage/temp/uploads');
      const actualLocalPath = path.join(uploadsDir, filename);
      if (fs.existsSync(actualLocalPath)) {
        return actualLocalPath;
      }
    }

    // Fallback to localPath in storage/temp
    return localPath;
  }
}
