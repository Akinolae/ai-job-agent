import admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

// Ensure the local storage paths exist
const TEMP_DIR = path.resolve(process.cwd(), 'storage/temp');
const LOCAL_DB_PATH = path.join(TEMP_DIR, 'db.json');
const LOCAL_STORAGE_DIR = path.join(TEMP_DIR, 'uploads');

if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}
if (!fs.existsSync(LOCAL_STORAGE_DIR)) {
  fs.mkdirSync(LOCAL_STORAGE_DIR, { recursive: true });
}
if (!fs.existsSync(LOCAL_DB_PATH)) {
  fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify({ profiles: {}, jobs: {}, applications: {} }, null, 2));
}

// Interfaces
export interface CandidateProfile {
  name: string;
  email: string;
  phone: string;
  location: string;
  targetLocations: string[];
  targetRoles: string[];
  potentiallyQualifiedRoles?: string[];
  professionalSummary?: string;
  coreSkills?: string[];
  toolsAndPlatforms?: string[];
  skills: {
    core?: string[];
    tools?: string[];
    frontend?: string[];
    backend?: string[];
    databases?: string[];
    devops?: string[];
    [key: string]: string[] | undefined;
  };
  customCategories?: { name: string; skills: string[] }[];
  experienceYears: number;
  salaryExpectationEUR: {
    min: number;
    target: number;
    currency: string;
  };
  workAuthorization: string;
  cvStoragePath: string;
  updatedAt: string;
}

export interface JobPosting {
  jobId: string;
  title: string;
  company: string;
  location: string;
  workplaceType: string;
  boardType: string;
  applyUrl: string;
  discoveredAt: string;
  postedAt?: string;
  description?: string;
  tailoredCvPath?: string;
  matchScore?: number;
  matchBreakdown?: {
    techStackScore: number;
    seniorityScore: number;
    locationScore: number;
    roleTitleScore?: number;
    architectureScore?: number;
    techCoverage?: number;
    matchedMustHaves?: string[];
    missingMustHaves?: string[];
    matchedNiceToHaves?: string[];
    gateResults?: {
      languagePassed: boolean;
      domainPassed: boolean;
      dealbreakersPassed: boolean;
      reason?: string;
    };
  };
  matchSummary?: string;
  requiresTailoring?: boolean;
  status: 'NEW' | 'QUEUED' | 'IN_PROGRESS' | 'APPLIED' | 'SKIPPED' | 'REJECTED' | 'FAILED' | 'DRY_RUN_COMPLETED' | 'MANUAL_APPLY';
}

export interface ApplicationRecord {
  applicationId: string;
  jobId: string;
  company: string;
  role: string;
  appliedAt: string;
  status: 'SUCCESS' | 'FAILED';
  submittedPayload: any;
  preSubmitScreenshotPath?: string;
  confirmationScreenshotPath?: string;
  notes?: string;
}

class DatabaseService {
  private useFirebase = false;
  private db: any = null; // Firestore Db
  private bucket: any = null; // Storage Bucket

  constructor() {
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    const storageBucket = process.env.FIREBASE_STORAGE_BUCKET;

    if (serviceAccountPath && fs.existsSync(path.resolve(serviceAccountPath))) {
      try {
        const resolvedPath = path.resolve(serviceAccountPath);
        const serviceAccount = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
        if (admin.apps.length === 0) {
          admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            storageBucket: storageBucket || undefined,
          });
        }
        this.db = admin.firestore();
        if (storageBucket) {
          this.bucket = admin.storage().bucket();
        }
        this.useFirebase = true;
        console.log('Firebase Admin SDK initialized successfully.');
      } catch (err) {
        console.error('Failed to initialize Firebase, falling back to local database:', err);
        this.useFirebase = false;
      }
    } else {
      console.log('No Firebase Service Account found. Using Local JSON Database.');
      this.useFirebase = false;
    }
  }

  isUsingFirebase(): boolean {
    return this.useFirebase;
  }

  private handleFirebaseError(operation: string, error: any) {
    console.error(`Firebase operation "${operation}" failed:`, error.message || error);
    console.warn('Disabling Firebase and switching to local database for the remainder of this session.');
    this.useFirebase = false;
  }

  // --- Profile Operations ---
  async getProfile(): Promise<CandidateProfile | null> {
    if (this.useFirebase) {
      try {
        const doc = await this.db.collection('candidate_profile').doc('default').get();
        return doc.exists ? (doc.data() as CandidateProfile) : null;
      } catch (err) {
        this.handleFirebaseError('getProfile', err);
      }
    }
    const data = this.readLocalDb();
    return data.profiles['default'] || null;
  }

  async saveProfile(profile: CandidateProfile): Promise<void> {
    if (this.useFirebase) {
      try {
        await this.db.collection('candidate_profile').doc('default').set(profile);
        return;
      } catch (err) {
        this.handleFirebaseError('saveProfile', err);
      }
    }
    const data = this.readLocalDb();
    data.profiles['default'] = profile;
    this.writeLocalDb(data);
  }

  // --- Job Operations ---
  async getJob(jobId: string): Promise<JobPosting | null> {
    if (this.useFirebase) {
      try {
        const doc = await this.db.collection('job_postings').doc(jobId).get();
        return doc.exists ? (doc.data() as JobPosting) : null;
      } catch (err) {
        this.handleFirebaseError('getJob', err);
      }
    }
    const data = this.readLocalDb();
    return data.jobs[jobId] || null;
  }

  async saveJob(job: JobPosting): Promise<void> {
    if (this.useFirebase) {
      try {
        await this.db.collection('job_postings').doc(job.jobId).set(job);
        return;
      } catch (err) {
        this.handleFirebaseError('saveJob', err);
      }
    }
    const data = this.readLocalDb();
    data.jobs[job.jobId] = job;
    this.writeLocalDb(data);
  }

  async listJobs(): Promise<JobPosting[]> {
    if (this.useFirebase) {
      try {
        const snapshot = await this.db.collection('job_postings').get();
        const jobs: JobPosting[] = [];
        snapshot.forEach((doc: any) => jobs.push(doc.data() as JobPosting));
        return jobs;
      } catch (err) {
        this.handleFirebaseError('listJobs', err);
      }
    }
    const data = this.readLocalDb();
    return Object.values(data.jobs);
  }

  async clearJobs(): Promise<void> {
    if (this.useFirebase) {
      try {
        const snapshot = await this.db.collection('job_postings').get();
        const batch = this.db.batch();
        snapshot.forEach((doc: any) => {
          batch.delete(doc.ref);
        });
        await batch.commit();
        return;
      } catch (err) {
        this.handleFirebaseError('clearJobs', err);
      }
    }
    const data = this.readLocalDb();
    data.jobs = {};
    this.writeLocalDb(data);
  }

  // --- Application Operations ---
  async saveApplication(app: ApplicationRecord): Promise<void> {
    if (this.useFirebase) {
      try {
        await this.db.collection('applications').doc(app.applicationId).set(app);
        return;
      } catch (err) {
        this.handleFirebaseError('saveApplication', err);
      }
    }
    const data = this.readLocalDb();
    data.applications[app.applicationId] = app;
    this.writeLocalDb(data);
  }

  async listApplications(): Promise<ApplicationRecord[]> {
    if (this.useFirebase) {
      try {
        const snapshot = await this.db.collection('applications').get();
        const apps: ApplicationRecord[] = [];
        snapshot.forEach((doc: any) => apps.push(doc.data() as ApplicationRecord));
        return apps;
      } catch (err) {
        this.handleFirebaseError('listApplications', err);
      }
    }
    const data = this.readLocalDb();
    return Object.values(data.applications);
  }

  async clearApplications(): Promise<void> {
    if (this.useFirebase) {
      try {
        const snapshot = await this.db.collection('applications').get();
        const batch = this.db.batch();
        snapshot.forEach((doc: any) => {
          batch.delete(doc.ref);
        });
        await batch.commit();
        return;
      } catch (err) {
        this.handleFirebaseError('clearApplications', err);
      }
    }
    const data = this.readLocalDb();
    data.applications = {};
    this.writeLocalDb(data);
  }

  // --- Storage / Asset Operations ---
  async uploadFile(localFilePath: string, destStoragePath: string): Promise<string> {
    if (!fs.existsSync(localFilePath)) {
      throw new Error(`Local file not found: ${localFilePath}`);
    }

    let resultUrl = '';

    if (this.useFirebase && this.bucket) {
      try {
        const [file] = await this.bucket.upload(localFilePath, {
          destination: destStoragePath,
          public: true,
        });
        resultUrl = file.publicUrl();
      } catch (err) {
        this.handleFirebaseError('uploadFile', err);
      }
    }

    // Local fallback: copy file to local storage dir
    if (!resultUrl) {
      const destPath = path.join(LOCAL_STORAGE_DIR, path.basename(destStoragePath));
      const destDir = path.dirname(destPath);
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }
      fs.copyFileSync(localFilePath, destPath);
      resultUrl = `/static/${path.basename(destStoragePath)}`;
    }

    // Clean up original temporary file from project directory
    try {
      fs.unlinkSync(localFilePath);
      console.log(`Cleaned up original temporary file from local disk: ${localFilePath}`);
    } catch (unlinkErr) {
      console.error(`Failed to delete temporary file ${localFilePath}:`, unlinkErr);
    }

    return resultUrl;
  }

  // --- Helper Methods ---
  private readLocalDb(): { profiles: Record<string, CandidateProfile>; jobs: Record<string, JobPosting>; applications: Record<string, ApplicationRecord> } {
    try {
      const content = fs.readFileSync(LOCAL_DB_PATH, 'utf8');
      const parsed = JSON.parse(content);
      return {
        profiles: parsed.profiles || {},
        jobs: parsed.jobs || {},
        applications: parsed.applications || {}
      };
    } catch (err) {
      return { profiles: {}, jobs: {}, applications: {} };
    }
  }

  private writeLocalDb(data: any): void {
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(data, null, 2));
  }
}

export const dbService = new DatabaseService();
