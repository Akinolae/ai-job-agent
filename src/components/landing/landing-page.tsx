'use client';

import React, { useState } from 'react';
import { 
  FiArrowRight, 
  FiSearch, 
  FiGlobe, 
  FiTarget, 
  FiClock, 
  FiZap, 
  FiCheckCircle, 
  FiCheck, 
  FiMapPin, 
  FiTool, 
  FiSend,
  FiFileText,
  FiExternalLink,
  FiAward
} from 'react-icons/fi';
import { TbBrain, TbSparkles } from 'react-icons/tb';

interface LandingPageProps {
  onOpenAuth: (mode: 'signin' | 'signup') => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onOpenAuth }) => {
  const [activeTab, setActiveTab] = useState<'scorer' | 'crawler' | 'apply'>('scorer');

  return (
    <div className="landing-wrapper">
      {/* 1. Header Navigation */}
      <header className="landing-header">
        <div className="landing-container landing-header-content">
          <div className="landing-logo">
            <div className="landing-logo-badge">AI</div>
            <span className="landing-logo-text">AI Job Agent</span>
          </div>

          <nav className="landing-nav">
            <a href="#features" className="landing-nav-link">Features</a>
            <a href="#simulator" className="landing-nav-link">Pipeline Demo</a>
            <a href="#how-it-works" className="landing-nav-link">How It Works</a>
          </nav>

          <div className="landing-header-actions">
            <button 
              className="btn-landing-ghost"
              onClick={() => onOpenAuth('signin')}
            >
              Sign In
            </button>
            <button 
              className="btn-landing-cta"
              onClick={() => onOpenAuth('signup')}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                Get Started Free <FiArrowRight />
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* 2. Hero Section */}
      <section className="landing-hero">
        <div className="landing-container landing-hero-content">
          <h1 className="hero-title">
            Discover & Win High-Match Roles <br />
            <span className="hero-title-gradient">On Autonomous Autopilot</span>
          </h1>

          <p className="hero-subtitle">
            Upload your CV once. Our autonomous agent discovers high-match roles across 10+ global job boards, evaluates opportunities with a rigorous 100-point semantic rubric, and generates custom tailored pitches for 1-click applications.
          </p>

          <div className="hero-cta-group">
            <button 
              className="btn-hero-primary"
              onClick={() => onOpenAuth('signup')}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                <FiSend /> Launch Your AI Agent
              </span>
            </button>
            <a href="#simulator" className="btn-hero-secondary">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                <FiSearch /> Explore Live Pipeline
              </span>
            </a>
          </div>

          {/* Quick Value Pillars */}
          <div className="hero-pillars-row">
            <div className="hero-pillar-item">
              <span className="pillar-icon"><FiGlobe style={{ color: '#38bdf8' }} /></span>
              <span>100% Remote & Relocation Opportunity Discovery</span>
            </div>
            <div className="hero-pillar-item">
              <span className="pillar-icon"><FiTarget style={{ color: '#818cf8' }} /></span>
              <span>100-Point Semantic ATS Match Scorer</span>
            </div>
            <div className="hero-pillar-item">
              <span className="pillar-icon"><FiFileText style={{ color: '#f59e0b' }} /></span>
              <span>AI-Tailored Pitches & Cover Letters</span>
            </div>
            <div className="hero-pillar-item">
              <span className="pillar-icon"><FiExternalLink style={{ color: '#ec4899' }} /></span>
              <span>1-Click Direct Portal Application Links</span>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Interactive Pipeline Simulator */}
      <section id="simulator" className="landing-section simulator-section">
        <div className="landing-container">
          <div className="section-header-center">
            <div className="section-eyebrow">INTELLIGENT PIPELINE</div>
            <h2 className="section-title">See How Your AI Agent Works In Real Time</h2>
            <p className="section-desc">
              Watch how our pipeline transforms a raw resume into tailored, high-converting job opportunities.
            </p>
          </div>

          <div className="simulator-card">
            <div className="simulator-tabs">
              <button 
                className={`simulator-tab-btn ${activeTab === 'scorer' ? 'active' : ''}`}
                onClick={() => setActiveTab('scorer')}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                  <FiTarget /> 100-Point Scorer
                </span>
              </button>
              <button 
                className={`simulator-tab-btn ${activeTab === 'crawler' ? 'active' : ''}`}
                onClick={() => setActiveTab('crawler')}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                  <FiGlobe /> Multi-Board Crawler
                </span>
              </button>
              <button 
                className={`simulator-tab-btn ${activeTab === 'apply' ? 'active' : ''}`}
                onClick={() => setActiveTab('apply')}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                  <FiFileText /> Tailored Pitch & Apply
                </span>
              </button>
            </div>

            <div className="simulator-body">
              {activeTab === 'scorer' && (
                <div className="sim-panel-grid">
                  <div className="sim-panel-left">
                    <div className="sim-badge-label">TARGET CANDIDATE PROFILE</div>
                    <h3 style={{ margin: '0.5rem 0', fontSize: '1.25rem', color: '#ffffff' }}>Alex Morgan</h3>
                    <div style={{ color: 'var(--accent-color)', fontSize: '0.875rem', fontWeight: 600, marginBottom: '1rem' }}>
                      Social Media Strategist & Growth Marketing Manager
                    </div>
                    
                    <div className="sim-tag-group">
                      <span className="tag-pill tag-pill-purple"><FiTarget /> Social Media Strategy</span>
                      <span className="tag-pill tag-pill-purple"><FiTarget /> Growth Marketing</span>
                      <span className="tag-pill tag-pill-cyan"><TbSparkles /> Content Strategy</span>
                      <span className="tag-pill tag-pill-cyan"><TbSparkles /> Brand Marketing</span>
                      <span className="tag-pill tag-pill-amber"><FiTool /> Meta Ads</span>
                      <span className="tag-pill tag-pill-amber"><FiTool /> Canva & HubSpot</span>
                    </div>

                    <div style={{ marginTop: '1.5rem', fontSize: '0.8125rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <FiMapPin style={{ color: '#22c55e' }} /> Location Preference: <strong>Worldwide, Remote EU, US, UK, Germany</strong>
                    </div>
                  </div>

                  <div className="sim-panel-right">
                    <div className="sim-badge-label" style={{ color: '#22c55e' }}>AI RUBRIC EVALUATION</div>
                    <div className="sim-match-header">
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#ffffff' }}>Lead Growth Marketing Manager</div>
                        <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>FinTech Global • Worldwide Remote • €75k - €95k</div>
                      </div>
                      <div className="sim-score-circle">
                        <span>94</span>
                        <small>/100</small>
                      </div>
                    </div>

                    <div className="sim-rubric-breakdown">
                      <div className="sim-rubric-row">
                        <span>Core Domain & Skills Match (Max 40)</span>
                        <strong style={{ color: '#86efac' }}>38 / 40</strong>
                      </div>
                      <div className="sim-rubric-row">
                        <span>Seniority & Scope (Max 25)</span>
                        <strong style={{ color: '#86efac' }}>23 / 25</strong>
                      </div>
                      <div className="sim-rubric-row">
                        <span>Modality & Relocation (Max 20)</span>
                        <strong style={{ color: '#86efac' }}>20 / 20 (Fully Remote)</strong>
                      </div>
                      <div className="sim-rubric-row">
                        <span>System Architecture & Scale (Max 15)</span>
                        <strong style={{ color: '#86efac' }}>13 / 15</strong>
                      </div>
                    </div>

                    <div className="sim-decision-box">
                      <FiCheckCircle style={{ color: '#22c55e', fontSize: '1.5rem', flexShrink: 0 }} />
                      <div>
                        <strong style={{ color: '#86efac', display: 'block' }}>High Match Confirmed</strong>
                        <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                          Synthesized custom tailored pitch and verified direct career portal link.
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'crawler' && (
                <div className="sim-crawler-view">
                  <div className="sim-crawler-header">
                    <div className="live-indicator">
                      <span className="live-dot"></span>
                      <span>Crawling 10+ Remote Job Boards</span>
                    </div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                      Total Harvester Queries: <strong>48 roles / hour</strong>
                    </div>
                  </div>

                  <div className="sim-board-grid">
                    <div className="sim-board-card">
                      <div className="sim-board-title">RemoteOK API</div>
                      <div className="sim-board-stat">12 new matches today</div>
                      <div className="sim-board-badge badge-ok">Active Sync</div>
                    </div>
                    <div className="sim-board-card">
                      <div className="sim-board-title">Jobicy Global Remote</div>
                      <div className="sim-board-stat">18 remote EU/Worldwide</div>
                      <div className="sim-board-badge badge-ok">Active Sync</div>
                    </div>
                    <div className="sim-board-card">
                      <div className="sim-board-title">Working Nomads</div>
                      <div className="sim-board-stat">9 marketing & tech roles</div>
                      <div className="sim-board-badge badge-ok">Active Sync</div>
                    </div>
                    <div className="sim-board-card">
                      <div className="sim-board-title">Greenhouse / Lever Direct</div>
                      <div className="sim-board-stat">Direct career portals</div>
                      <div className="sim-board-badge badge-ok">Active Sync</div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'apply' && (
                <div className="sim-apply-view">
                  <div className="sim-browser-bar">
                    <div className="browser-dots">
                      <span></span><span></span><span></span>
                    </div>
                    <div className="browser-url">https://jobs.lever.co/fintech-global/lead-growth-marketer</div>
                    <div className="browser-status-badge" style={{ background: '#22c55e', color: '#ffffff' }}>Direct Apply Ready</div>
                  </div>

                  <div className="sim-apply-content">
                    <div className="sim-step-item completed">
                      <span className="step-check"><FiCheck /></span>
                      <span>Extracted complete job description & responsibilities</span>
                    </div>
                    <div className="sim-step-item completed">
                      <span className="step-check"><FiCheck /></span>
                      <span>Evaluated 100-point match rubric score: <strong>94/100</strong></span>
                    </div>
                    <div className="sim-step-item completed">
                      <span className="step-check"><FiCheck /></span>
                      <span>Generated tailored pitch letter highlighting your verified career accomplishments</span>
                    </div>
                    <div className="sim-step-item in-progress">
                      <span className="step-spinner"><FiZap /></span>
                      <span>Ready! 1-Click to open official job portal and submit with tailored pitch.</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 4. Core Features Grid */}
      <section id="features" className="landing-section">
        <div className="landing-container">
          <div className="section-header-center">
            <div className="section-eyebrow">ENGINEERED FOR RESULTS</div>
            <h2 className="section-title">Everything You Need To Fast-Track Your Job Search</h2>
            <p className="section-desc">
              Built with advanced AI reasoning models to maximize opportunity discovery while maintaining elite ATS relevance and custom tailored messaging.
            </p>
          </div>

          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon-wrapper icon-purple"><TbBrain style={{ fontSize: '1.6rem', color: '#818cf8' }} /></div>
              <h3 className="feature-card-title">Dynamic Cross-Domain AI Parsing</h3>
              <p className="feature-card-desc">
                No hardcoded keyword lists. Our AI extracts your true skills, experience, and adjacent career tracks dynamically across any discipline (Marketing, Software, Legal, Product, Finance).
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon-wrapper icon-cyan"><FiTarget style={{ fontSize: '1.5rem', color: '#38bdf8' }} /></div>
              <h3 className="feature-card-title">100-Point Semantic Match Rubric</h3>
              <p className="feature-card-desc">
                Objective scoring evaluates technical stack match, seniority years, relocation openness, and modality so you never waste time on low-probability positions.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon-wrapper icon-green"><FiGlobe style={{ fontSize: '1.5rem', color: '#22c55e' }} /></div>
              <h3 className="feature-card-title">Remote & Visa Relocation Priority</h3>
              <p className="feature-card-desc">
                Prioritize 100% remote global positions or companies offering relocation packages and visa sponsorship across Europe, the UK, US, and Worldwide.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon-wrapper icon-amber"><FiFileText style={{ fontSize: '1.5rem', color: '#f59e0b' }} /></div>
              <h3 className="feature-card-title">AI-Tailored Pitches & Cover Letters</h3>
              <p className="feature-card-desc">
                For every high-match role, the AI generates a customized cover letter and executive pitch addressing the company&apos;s specific requirements.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon-wrapper icon-pink"><FiClock style={{ fontSize: '1.5rem', color: '#ec4899' }} /></div>
              <h3 className="feature-card-title">24/7 Scheduled Cron Discovery</h3>
              <p className="feature-card-desc">
                Set and forget. The background crawler harvests new jobs every hour, executes scoring, and notifies you when high-match opportunities emerge.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon-wrapper icon-indigo"><FiAward style={{ fontSize: '1.5rem', color: '#a5b4fc' }} /></div>
              <h3 className="feature-card-title">Verified Direct Apply Links</h3>
              <p className="feature-card-desc">
                Skip third-party scrapers and outdated listings. Access verified direct applicant links for Greenhouse, Lever, Workday, and company career pages.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. How It Works (3 Steps) */}
      <section id="how-it-works" className="landing-section how-it-works-section">
        <div className="landing-container">
          <div className="section-header-center">
            <div className="section-eyebrow">SIMPLE 3-STEP ONBOARDING</div>
            <h2 className="section-title">Get Running In Less Than 2 Minutes</h2>
            <p className="section-desc">
              Zero complicated configurations. Upload your resume and let the AI find your best opportunities.
            </p>
          </div>

          <div className="steps-container">
            <div className="step-card">
              <div className="step-number">01</div>
              <h3 className="step-title">Upload Your Resume</h3>
              <p className="step-desc">
                Upload your PDF or Word resume. Our AI agent parses your work history, domain competencies, and generates adjacent career titles automatically.
              </p>
            </div>

            <div className="step-card">
              <div className="step-number">02</div>
              <h3 className="step-title">Set Your Targets</h3>
              <p className="step-desc">
                Use our interactive tag manager to define target roles, remote regions, and minimum ATS match scores.
              </p>
            </div>

            <div className="step-card">
              <div className="step-number">03</div>
              <h3 className="step-title">Review & Apply</h3>
              <p className="step-desc">
                The agent harvests opportunities 24/7, scores alignment, drafts tailored pitches, and delivers verified direct apply links.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Impact Stats Banner */}
      <section className="landing-stats-banner">
        <div className="landing-container">
          <div className="stats-row">
            <div className="stat-box">
              <div className="stat-big-num">10+</div>
              <div className="stat-subtext">Job Boards & APIs Integrated</div>
            </div>
            <div className="stat-box">
              <div className="stat-big-num">94.8%</div>
              <div className="stat-subtext">Average ATS Scoring Accuracy</div>
            </div>
            <div className="stat-box">
              <div className="stat-big-num">24/7</div>
              <div className="stat-subtext">Continuous Opportunity Harvesting</div>
            </div>
            <div className="stat-box">
              <div className="stat-big-num">&lt; 2s</div>
              <div className="stat-subtext">Match Evaluation Time</div>
            </div>
          </div>
        </div>
      </section>

      {/* 7. Call To Action Banner */}
      <section className="landing-cta-banner">
        <div className="landing-container">
          <div className="cta-card">
            <h2 className="cta-title">Ready To Supercharge Your Career Hunt?</h2>
            <p className="cta-desc">
              Discover high-converting roles, score compatibility in real time, and apply with tailored pitches.
            </p>
            <div className="cta-btn-wrap">
              <button 
                className="btn-cta-large"
                onClick={() => onOpenAuth('signup')}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                  Launch Your Autonomous Agent Free <FiArrowRight />
                </span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 8. Footer */}
      <footer className="landing-footer">
        <div className="landing-container landing-footer-content">
          <div className="footer-left">
            <div className="landing-logo">
              <div className="landing-logo-badge">AI</div>
              <span className="landing-logo-text">AI Job Agent</span>
            </div>
            <p className="footer-tagline">
              Autonomous AI Agent for job discovery, ATS scoring, and tailored application pitches.
            </p>
          </div>

          <div className="footer-links">
            <a href="#features">Features</a>
            <a href="#simulator">Pipeline Demo</a>
            <a href="#how-it-works">How It Works</a>
            <button className="footer-auth-link" onClick={() => onOpenAuth('signin')}>Sign In</button>
          </div>
        </div>
        <div className="landing-container footer-bottom">
          <span>&copy; {new Date().getFullYear()} AI Job Agent. All rights reserved.</span>
          <span>Powered by Advanced Autonomous AI Engine</span>
        </div>
      </footer>
    </div>
  );
};
