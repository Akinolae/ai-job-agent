# ai-job-agent

**Autonomous AI Job Application Agent** — an end-to-end platform that continuously **discovers**, **scores**, **tailors**, and **submits** job applications on your behalf. It combines live job-board harvesting, a Google Gemini–powered match intelligence engine, Playwright browser automation, and a real-time dashboard into a single extensible monolith.

> **Status:** Beta — `1.0.0-beta.0`

---

## Table of Contents

- [What is it?](#what-is-it)
- [How it works](#how-it-works)
- [Key features](#key-features)
- [The 3-tier match engine](#the-3-tier-match-engine)
- [Architecture](#architecture)
- [Project structure](#project-structure)
- [Sources configured](#sources-configured)
- [Data & persistence](#data--persistence)
- [Authentication](#authentication)
- [HTTP API](#http-api)
- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Scripts](#scripts)
- [Disclaimer / License](#disclaimer--license)

---

## What is it?

Finding and applying to relevant software roles across dozens of boards is slow and tedious. **ai-job-agent** automates that entire loop:

1. **It crawls** job sources (RemoteOK, Remotive, Jobicy, Arbeitnow, direct Greenhouse/Lever ATS boards, and `python-jobspy` — Indeed/LinkedIn — via a wrapper) for roles matching your profile.
2. **It evaluates** every posting with a strict, explainable scoring pipeline that rejects irrelevant roles and awards a 0–100 match score.
3. **It tailors** your master CV into a role-specific A4 PDF that emphasizes your matching skills.
4. **It applies** — in *dry-run* mode by default — by driving a real headless browser (Playwright) through Greenhouse, Lever, and generic apply forms, answering screening questions with Gemini and capturing pre-submit/confirmation screenshots.
5. **It notifies** your live dashboard in real time over Server-Sent Events as discoveries, matches, and submissions happen.

It ships with a **mock / offline mode**: if no Gemini API key or Firebase credentials are set, everything (Gemini parsing/scoring, browser automation, file storage) degrades gracefully into deterministic simulations backed by a local JSON database — perfect for local development.

---

## How it works

The heart is the **PipelineOrchestrator** (`src/jobs/cron-scheduler.ts`). It orchestrates the full pipeline end-to-end:

```text
 ┌───────────┐  ┌────────────┐  ┌────────────┐  ┌──────────────┐  ┌─────────────┐
 │  HARVEST  │─▶│  SCREEN /  │─▶│   TAILOR   │─▶│  AUTO-APPLY  │─▶│  NOTIFY &   │
 │  (crawl)  │  │    GATE    │  │   (CV PDF) │  │  (Playwright)│  │    AUDIT    │
 └───────────┘  └────────────┘  └────────────┘  └──────────────┘  └─────────────┘
      │               │               │               │                 │
   harvester        matcher        cv-parser       auto-apply       notification
   live-sources     (3-tier)      module           module           + Firestore /
   ats-endpoints                                        |           local persistence
                                                          ▼
                                              submission screenshots
                                                ✓ audit trail
```

In more detail:

1. **Harvest** — sources publish a normalized `JobPosting`, **deduplicated** by normalized URL and company/title key.
2. **Score / Gate** — every posting runs through the **3-tier scoring engine** (below). Those scoring **≥ 80** are queued for application and a tailored CV is generated.
3. **Auto-apply** — `UniversalHandler` routes to the right form handler (Greenhouse, Lever, or generic). In *dry-run* it fills and verifies without submitting; in live mode it clicks submit and captures pre-submit and confirmation screenshots.
4. **Audit** — every result persists as an `ApplicationRecord` and surfaces (with screenshots) in the Applications tab.

The pipeline runs **manually** (`/api/pipeline/run`), as a **one-off script** (`npm run harvest`, `npm run scheduler`), or as a **recurring cron** (`/api/pipeline/cron/start`), defaulting to an hourly interval.

---

## Key features

- **Multi-board harvesting** — 4 live JSON APIs + configurable Greenhouse/Lever boards (`src/config/crawl_targets.json`) + `python-jobspy` wrapper for Indeed/LinkedIn.
- **Explainable match scoring** — every score decomposes into tech-stack, role-title, seniority, and location subscores (out of 45 / 25 / 15 / 15).
- **Genre-aware relevance filters** — deterministic hard gates that instantly reject non-software trades, foreign-language postings, and restrictive sponsorship roles.
- **Tailored CV generation** — Gemini rewrites your profile into a job-specific HTML resume, rendered to A4 PDF via Playwright.
- **Autonomous application** — a stealth Playwright browser fills and submits Greenhouse, Lever, and generic apply forms; **dry-run safe** by default.
- **AI screening-question answering** — `ScreenAnswerer` answers free-text questions and picks dropdown/radio options via Gemini (with heuristic fallback).
- **Real-time dashboard** — a polished Next.js UI plus a lightweight Express-served static dashboard, with live SSE notifications and an audit trail with screenshots.
- **Mock mode** — zero-config local development with simulated models, browser, and storage.
- **Resilience-first design** — Gemini model cascades, per-request timeouts, batch/concurrency controls, idempotent job IDs, and local-file fallback everywhere.

---

## The 3-tier match scoring engine

A job is only queued for application if it scores **≥80** and passes all Tier‑1 gates. The engine (`src/modules/matcher/`) combines deterministic logic with Gemini judgment:

| Tier | Component | What it does |
|------|-----------|--------------|
| 1 | **Binary gates** (`binary-gates.ts`) | Instant pass/fail: foreign-language detection, disqualification domains (trades, healthcare, retail, etc.), domain alignment to your `targetRoles` plus a positive software check, and hard dealbreakers (e.g. mandatory security clearance, "no sponsorship"). |
| 2 | **Skill diff** (`skill-diff.ts`) | A deterministic taxonomy matcher that normalizes ~50 technologies (React, Next.js, Node, Go, Python, AWS…) and computes `techCoverage %`, matched vs. missing must-haves, and an **asymmetric gating multiplier (0.20 → 1.0)** that punishes foreign stacks (e.g. Java + Spring + Angular). |
| 3 | **Gemini scorer** (`scorer.ts`, prompts in `rubric-prompts.ts`) | LLM evaluation following a strict rubric with **hard ceilings** (foreign-language caps ≤45%, domain mismatch forces <60%, only true high fits reach ≥80). |

Final breakdown: **tech stack 45 pts · role title 25 · seniority 15 · location/modality 15**. Jobs older than **2 weeks** are auto-skipped.



---

---

## Architecture

The project is a **server monolith** that optionally serves a Next.js frontend. The engine lives in `src/` as framework-agnostic TypeScript modules, so it runs under both the **Express** server (`src/index.ts`, `npm run` scripts) and the **Next.js** API routes.

| Layer | Path | Purpose |
|-------|------|---------|
| **Server** | `src/index.ts` | Express app serving the static dashboard + core JSON API. |
| **Frontend** | `src/app/`, `src/components/`, `src/context/` | Next.js 14 dashboard (React 18) with tabs, profile editor, job detail, match breakdown, SSE toasts. |
| **Static dashboard** | `src/public/` | A drop-in HTML/JS dashboard served by Express. |
| **Jobs / Orchestrator** | `src/jobs/` | `cron-scheduler.ts` (PipelineOrchestrator) and `scheduler.ts` (5‑min loop). |
| **Harvester** | `src/modules/harvester/` | `jobspy-runner.ts`, `live-sources.ts`, `ats-endpoints.ts`. |
| **Matcher** | `src/modules/matcher/` | `binary-gates.ts`, `skill-diff.ts`, `scorer.ts`, `rubric-prompts.ts`. |
| **CV parser** | `src/modules/cv-parser/` | `cv-extractor.ts`, `profile-service.ts`, `cv-tailorer.ts`. |
| **Auto-apply** | `src/modules/auto-apply/` | `browser-engine.ts`, `universal-handler.ts`, `greenhouse-handler.ts`, `lever-handler.ts`, `screen-answerer.ts`. |
| **Services** | `src/services/` | `notification-service.ts` (SSE broadcast). |
| **Config** | `src/config/` | `firebase.ts` (backend + fallback DB), `firebase-client.ts` (auth), `gemini.ts` (model cascade), `crawl_targets.json`, `mock_jobs.json`. |
| **Python wrapper** | `jobspy_wrapper.py` | Thin wrapper exposing `python-jobspy` aggregates via CLI for board harvesting. |

### Request lifecycle for one job

`harvest → normalize/dedupe → [Tier1 gate] → [Tier2 skill-diff] → [Tier3 Gemini] → score ≥ 80? → tailor CV → enqueue → dry-run/live apply → screenshot → audit record → SSE notify`.

---

## Project structure

```text
ai-job-agent/
├── jobspy_wrapper.py          # Python wrapper for python-jobspy board scraping
├── next.config.mjs            # Next.js config (ignores TS build errors for crawler/playwright)
├── package.json               # Scripts + deps
├── tsconfig.json
├── .env.template              # Environment template
├── .gitignore
├── storage/                   # Local assets (ignored uploads, local DB JSON)
├── src/
│   ├── index.ts               # Express backend
│   ├── app/                   # Next.js frontend + API routes
│   ├── components/            # React UI (auth, landing, profile form, modal, tag-input)
│   ├── config/                # firebase.ts / firebase-client.ts / gemini.ts / crawl_targets.json
│   ├── context/               # auth-context.tsx (Firebase Auth)
│   ├── jobs/                  # cron-scheduler.ts (orchestrator) + scheduler.ts
│   ├── modules/
│   │   ├── auto-apply/        # browser-engine + greenhouse/lever/universal + screen-answerer
│   │   ├── cv-parser/         # extractor, profile-service, cv-tailorer
│   │   ├── harvester/         # jobspy-runner, live-sources, ats-endpoints
│   │   └── matcher/           # binary-gates, skill-diff, scorer, rubric-prompts
│   ├── public/                # static dashboard (index.html, app.js)
│   └── services/              # notification-service (SSE)
└── (tsconfig.tsbuildinfo ignored)
```

---

## Sources configured

| Source | Where | Type | Notes |
|--------|-------|------|-------|
| RemoteOK | `live-sources.ts` | JSON API | Remote software roles, filtered by eligibility. |
| Remotive | `live-sources.ts` | JSON API | Remote jobs, filtered. |
| Jobicy | `live-sources.ts` | JSON API | Global remote listings. |
| Arbeitnow | `live-sources.ts` | JSON API | Remote-EU / Worldwide, visa-supporting roles. |
| Greenhouse | `ats-endpoints.ts` | Board API | Pulls posts from `crawl_targets.json` (Adyen, Stripe, Monzo, Wise, N26, SumUp, GoCardless, Marqeta, Brex, Mercury, Wolt, Contentful, Commercetools, Trade Republic). |
| Lever | `ats-endpoints.ts` | Board API | Spotify via `crawl_targets.json`. |
| Indeed / LinkedIn | `jobspy-runner.ts` → `jobspy_wrapper.py` | Python | Multi-term, multi-location scraping via `python-jobspy`. |

All postings normalize into a single `JobPosting` shape with a deterministic, idempotent `jobId`.

---

## Data & persistence

The `dbService` (`src/config/firebase.ts`) is a dual-backend store with automatic failover:

- **Firestore + Storage** (when `FIREBASE_SERVICE_ACCOUNT_PATH` & `FIREBASE_STORAGE_BUCKET` are set). Firestore stores profiles/jobs/applications; Storage stores uploads (resumes, screenshots, tailored CVs).
- **Local JSON fallback** otherwise: `storage/temp/db.json` + local file uploads in `storage/temp/uploads`. Screenshots are served via `/static/...` (Express) or `/api/static/...` (Next).

Collections: `profiles`, `jobs`, `applications`. Job statuses: `NEW › QUEUED › IN_PROGRESS › APPLIED`, plus `SKIPPED`, `REJECTED`, `FAILED`, `DRY_RUN_COMPLETED`, `MANUAL_APPLY`.

`storage/temp/**` is gitignored. A local-session `localStorage` key persists the mock auth user.

---

## Authentication

- **Firebase Authentication** (client SDK) with email/password and Google sign-in (`src/context/auth-context.tsx`).
- Backed by `firebase-client.ts`, which falls back to a **local dev user** when no real `NEXT_PUBLIC_FIREBASE_*` API key is configured — so the UI stays usable without Firebase.
- The React dashboard gates views behind `AuthView`; the Express-served static `src/public/` dashboard is unauthenticated by design.

---

## HTTP API

The same pipelines are exposed through Express (`src/index.ts`) and Next.js App Router routes (`src/app/api/…`).

| Method & Path | Description |
|---------------|-------------|
| `GET  /api/profile` | Return the candidate profile (404 if none). |
| `POST /api/profile/parse-local` | Parse a local resume PDF/DOCX path into a structured profile. |
| `POST /api/profile/upload` | Upload & parse a resume file (multipart) via the Next route. |
| `POST /api/profile/update` | Save/update the candidate profile. |
| `GET  /api/jobs` · `DELETE /api/jobs` | List (deduplicated, newest-first) / clear all postings. |
| `GET  /api/applications` · `DELETE /api/applications` | List / clear application audit trail. |
| `POST /api/pipeline/run` | Trigger a pipeline run in the background (`dryRun` default `true`). |
| `GET  /api/pipeline/status` | Pipeline running? dry-run flag, started-at, cron status/interval. |
| `POST /api/pipeline/cron/start` | Start the recurring cron scheduler. |
| `POST /api/pipeline/cron/pause` | Pause the running cron + active scan. |
| `POST /api/pipeline/stop` | Stop the active pipeline. |
| `GET  /api/notifications` | Server-Sent Events stream (live toasts). |
| `GET  /api/config` | Runtime flags: `geminiMock`, `firebaseLocal`. |
| `GET  /api/static/[...path]` | Serve uploaded screenshots/resumes (Next route, traversal-safe). |
---

## Tech stack

- **Next.js 14** (App Router) + **React 18** (frontend/dashboard)
- **TypeScript** throughout
- **Express 4** (static server)
- **Google Gemini** (`@google/genai`) — profile parsing, match scoring, CV tailoring, screening answers
- **Playwright** — headless browser automation + PDF generation + screenshots
- **Firebase / Firestore / Storage** — production data layer (+ `firebase-admin`)
- **`python-jobspy`** — board harvesting via a small Python wrapper
- **pdf-parse**, **mammoth** — resume text extraction
- **dotenv**, **formik** / **yup**, **react-icons** (utilities)
- **tsx** — run TS scripts directly (`npm run harvest`)

---

## Getting started

### Prerequisites

- Node.js **18+** (and `yarn` or `npm`)
- Python **3.x** (for the `jobspy` wrapper board scraping; `pip install python-jobspy` if you want Indeed/LinkedIn sources)
- A Google Gemini API key (optional — mock mode works without one)

### Install & run

```bash
# 1) Install JS deps
yarn install        # or: npm install

# 2) Configure environment from the template
cp .env.template .env
#   edit .env and add your GEMINI_API_KEY and (optionally) Firebase creds

# 3) Optional: install python-jobspy for Indeed/LinkedIn sourcing
pip install python-jobspy

# 4) Run the dashboard (Next.js)
npm run dev         # → http://localhost:3000

# 5) Or run the Express monolith dashboard
npm run build && npm run start   # serves src/public dashboard
```

### Running the pipeline

```bash
# One-off full pipeline run (dry-run by default)
npm run harvest            # == tsx src/jobs/cron-scheduler.ts

# Recurring scheduler every 5 minutes
npm run scheduler          # == tsx src/jobs/scheduler.ts
```

Manual triggers are also available through the dashboard "Run Pipeline" button and `/api/pipeline/run`.

---

## Environment variables

See `.env.template`:

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | no | HTTP port (default `3000`). |
| `GEMINI_API_KEY` | maybe | Google Gemini key. Omit / placeholder to enable **mock mode** (deterministic scoring, no LLM calls). |
| `GEMINI_MODEL` | no | Optional override; otherwise uses cascade `gemini-3.1-flash-lite → 3.5-flash-lite → 3.5-flash`. |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | no | Server-side Firebase admin JSON. Empty → local JSON DB. |
| `FIREBASE_STORAGE_BUCKET` | no | Firebase Storage bucket for uploads. |
| `NEXT_PUBLIC_FIREBASE_*` | no | Client auth settings (API key, auth domain, project id, app id). Required for real auth; empty → dev/mock auth. |
| `DRY_RUN` | no | `true`/`false` for the CLI harvest/scheduler scripts. |

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the Next.js dev server (dashboard). |
| `npm run build` | Build the Next.js production bundle. |
| `npm start` | Run the `src/index.ts` Express server (static dashboard + JSON API). |
| `npm run harvest` | Execute the full pipeline once via the orchestrator. |
| `npm run scheduler` | Run the recurring pipeline every 5 minutes. |

---

## Disclaimer / License

This project is a **personal beta** (`1.0.0-beta.0`). Automated job applications may be subject to the terms of service of individual recruiters — review each posting and the destination ATS before submitting live applications. Dry-run mode is the safe default and should be used until you are confident in the environment. The authors are not responsible for how you use the tool. See the repository license for further details.
