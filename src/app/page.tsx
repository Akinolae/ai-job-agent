"use client";

import React, { useState, useEffect, useRef } from 'react';
import type { CandidateProfile, JobPosting, ApplicationRecord } from '../config/firebase';
import { useAuth } from '../context/auth-context';
import { AuthView } from '../components/auth/auth-view';
import { TagInput } from '../components/ui/tag-input';
import { LandingPage } from '../components/landing/landing-page';
import { CandidateProfileForm } from '../components/profile/candidate-profile-form';
import { ConfirmModal } from '../components/ui/confirm-modal';
import { 
  FiUser, 
  FiMail, 
  FiPhone, 
  FiMapPin, 
  FiBriefcase, 
  FiFileText, 
  FiTarget, 
  FiGlobe, 
  FiZap, 
  FiTool, 
  FiLayers, 
  FiFolder, 
  FiStar, 
  FiTrendingUp, 
  FiAward, 
  FiShield, 
  FiCheckCircle, 
  FiAlertCircle, 
  FiSquare, 
  FiPause, 
  FiClock, 
  FiUploadCloud, 
  FiTrash2,
  FiGrid,
  FiLogOut
} from 'react-icons/fi';
import { TbSparkles, TbRobot } from 'react-icons/tb';

export default function Dashboard() {
  const { user, loading: authLoading, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'jobs' | 'profile' | 'applications'>('dashboard');
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [authModalMode, setAuthModalMode] = useState<'signin' | 'signup' | null>(null);
  const [showLandingPreview, setShowLandingPreview] = useState(false);
  
  // Selected detail IDs
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    confirmVariant?: 'primary' | 'danger';
    onConfirm: () => void;
  } | null>(null);

  // Modals / loading states / config
  const [isParseModalOpen, setIsParseModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [sysConfig, setSysConfig] = useState<{ geminiMock: boolean; firebaseLocal: boolean } | null>(null);

  // Toast notifications
  interface Toast { id: number; title: string; body: string; type: string; }
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastIdRef = useRef(0);

  const addToast = (title: string, body: string, type: string) => {
    const id = ++toastIdRef.current;
    setToasts(prev => [...prev, { id, title, body, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 7000);
  };

  // Reusable fetch with AbortController timeout
  const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeoutMs = 60000): Promise<Response> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new Error(`Request to ${url} timed out after ${timeoutMs / 1000}s. Check your network connection.`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  };

  // Pipeline execution & cron state
  const [isPipelineRunning, setIsPipelineRunning] = useState(false);
  const [isCronActive, setIsCronActive] = useState(false);
  const [cronIntervalMinutes, setCronIntervalMinutes] = useState(60);

  // Fetch all data
  const refreshAllData = async () => {
    try {
      const [profileRes, jobsRes, appsRes, statusRes] = await Promise.all([
        fetchWithTimeout('/api/profile'),
        fetchWithTimeout('/api/jobs'),
        fetchWithTimeout('/api/applications'),
        fetchWithTimeout('/api/pipeline/status').catch(() => null)
      ]);

      if (statusRes && statusRes.ok) {
        const statusData = await statusRes.json();
        setIsPipelineRunning(!!statusData.isRunning);
        setIsCronActive(!!statusData.cronActive);
        if (statusData.cronIntervalMinutes) setCronIntervalMinutes(statusData.cronIntervalMinutes);
      }

      if (profileRes.ok) {
        const profileData: CandidateProfile = await profileRes.json();
        setProfile(profileData);
      }

      if (jobsRes.ok) {
        const jobsData = await jobsRes.json();
        setJobs(jobsData);
      }

      if (appsRes.ok) {
        const appsData = await appsRes.json();
        setApplications(appsData);
      }
    } catch (err: any) {
      const isTimeout = err.name === 'AbortError' || err.message?.includes('timed out');
      if (isTimeout) {
        addToast('⏱ Network Timeout', 'Could not reach the server. Check your connection and try again.', 'INFO');
      }
      console.error('Error refreshing dashboard data:', err);
    }
  };

  // Fetch system config (mock mode, local mode, etc.)
  const fetchConfig = async () => {
    try {
      const res = await fetchWithTimeout('/api/config');
      if (res.ok) {
        const data = await res.json();
        setSysConfig(data);
      }
    } catch (err) {
      console.error('Error fetching system configuration:', err);
    }
  };

  // Initial load, polling, and SSE notification subscription
  useEffect(() => {
    fetchConfig();
    refreshAllData();
    const interval = setInterval(refreshAllData, 10000);

    // Request browser notification permission
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    // Subscribe to real-time application notifications via SSE
    const es = new EventSource('/api/notifications');
    es.onmessage = (event) => {
      try {
        const notif = JSON.parse(event.data);
        if (notif.type === 'CONNECTED') return; // Ignore connect ack
        addToast(notif.title, notif.body, notif.type);
        // Also fire a native browser push notification if permitted
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          new Notification(notif.title, { body: notif.body, icon: '/favicon.ico' });
        }
        // Refresh data when an application event fires
        if (notif.type !== 'INFO') refreshAllData();
      } catch (e) {
        console.error('Failed to parse SSE notification:', e);
      }
    };
    es.onerror = () => console.warn('[SSE] Notification stream disconnected, will reconnect automatically.');

    return () => {
      clearInterval(interval);
      es.close();
    };
  }, []);

  // Pagination state
  const [topMatchesPage, setTopMatchesPage] = useState(1);
  const TOP_MATCHES_PER_PAGE = 20;

  const [crawledPage, setCrawledPage] = useState(1);
  const CRAWLED_PER_PAGE = 20;

  const [appsPage, setAppsPage] = useState(1);
  const APPS_PER_PAGE = 20;

  // Modality & region filters and keyword search
  const [filterModality, setFilterModality] = useState<'all' | 'remote' | 'relocation' | 'africa'>('all');
  const [searchKeyword, setSearchKeyword] = useState('');

  // Helper detection functions
  const isJobRemote = (job: JobPosting): boolean => {
    const loc = String(job.location || '').toLowerCase();
    const wp = String(job.workplaceType || '').toLowerCase();
    const desc = String(job.description || '').toLowerCase();
    return (
      loc.includes('remote') ||
      loc.includes('worldwide') ||
      wp.includes('remote') ||
      desc.includes('fully remote') ||
      desc.includes('100% remote') ||
      desc.includes('work from anywhere') ||
      desc.includes('remote-first') ||
      desc.includes('global remote') ||
      (job as any).isRemote === true
    );
  };

  const doesJobOfferRelocation = (job: JobPosting): boolean => {
    const text = `${job.description || ''} ${job.location || ''}`.toLowerCase();
    return (
      text.includes('relocation') ||
      text.includes('visa sponsor') ||
      text.includes('visa support') ||
      text.includes('work permit') ||
      text.includes('relocate') ||
      text.includes('relocation bonus')
    );
  };

  const isJobAfricanStream = (job: JobPosting): boolean => {
    const loc = String(job.location || '').toLowerCase();
    return (
      loc.includes('nigeria') ||
      loc.includes('lagos') ||
      loc.includes('kenya') ||
      loc.includes('nairobi') ||
      loc.includes('ghana') ||
      loc.includes('accra') ||
      loc.includes('rwanda') ||
      loc.includes('kigali') ||
      loc.includes('south africa') ||
      loc.includes('africa')
    );
  };

  // Filter application helper
  const filterJobsList = (list: JobPosting[]) => {
    return list.filter(job => {
      const q = searchKeyword.toLowerCase().trim();
      if (q) {
        const fullText = `${job.title} ${job.company} ${job.location} ${job.workplaceType} ${job.description || ''}`.toLowerCase();
        if (!fullText.includes(q)) return false;
      }

      if (filterModality === 'remote' && !isJobRemote(job)) return false;
      if (filterModality === 'relocation' && !doesJobOfferRelocation(job)) return false;
      if (filterModality === 'africa' && !isJobAfricanStream(job)) return false;

      return true;
    });
  };

  // Calculate statistics
  const highMatches = jobs.filter(j => j.matchScore && j.matchScore >= 80);
  const queued = jobs.filter(j => j.status === 'QUEUED' || j.status === 'IN_PROGRESS' || j.status === 'MANUAL_APPLY');
  const applied = applications.filter(a => a.status === 'SUCCESS');

  // Filtered collections
  const filteredHighMatches = filterJobsList(highMatches);
  const filteredCrawledJobs = filterJobsList(jobs);

  // Paginated slices
  const totalTopMatchesPages = Math.max(1, Math.ceil(filteredHighMatches.length / TOP_MATCHES_PER_PAGE));
  const paginatedTopMatches = filteredHighMatches.slice((topMatchesPage - 1) * TOP_MATCHES_PER_PAGE, topMatchesPage * TOP_MATCHES_PER_PAGE);

  const totalCrawledPages = Math.max(1, Math.ceil(filteredCrawledJobs.length / CRAWLED_PER_PAGE));
  const paginatedCrawledJobs = filteredCrawledJobs.slice((crawledPage - 1) * CRAWLED_PER_PAGE, crawledPage * CRAWLED_PER_PAGE);

  const totalAppsPages = Math.max(1, Math.ceil(applications.length / APPS_PER_PAGE));
  const paginatedApps = applications.slice((appsPage - 1) * APPS_PER_PAGE, appsPage * APPS_PER_PAGE);

  // Trigger single scanning loop
  const executePipeline = async (dryRun: boolean) => {
    try {
      const res = await fetchWithTimeout('/api/pipeline/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun })
      }, 15000);
      const data = await res.json();
      addToast('🚀 Pipeline Started', data.message || 'Pipeline is running in the background.', 'INFO');
      setIsPipelineRunning(true);
      refreshAllData();
    } catch (err: any) {
      const msg = err.message?.includes('timed out')
        ? 'Server did not respond in time. The server may be down.'
        : 'Failed to start pipeline: ' + err.message;
      addToast('❌ Pipeline Error', msg, 'APPLICATION_FAILED');
    }
  };

  const runPipeline = (dryRun: boolean) => {
    if (!dryRun) {
      setConfirmModal({
        isOpen: true,
        title: 'Launch Live Scan & Applications',
        message: 'You are triggering LIVE pipeline mode. The agent will discover matching jobs and enqueue applications. Proceed?',
        confirmLabel: 'Launch Live Scan',
        confirmVariant: 'primary',
        onConfirm: () => executePipeline(false)
      });
    } else {
      executePipeline(true);
    }
  };

  // Start autonomous recurring cron scheduler
  const startCron = async (intervalMinutes = 60, dryRun = true) => {
    try {
      const res = await fetchWithTimeout('/api/pipeline/cron/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intervalMinutes, dryRun })
      });
      const data = await res.json();
      addToast('⏰ Cron Started', data.message || 'Autonomous cron scheduler activated.', 'INFO');
      setIsCronActive(true);
      setIsPipelineRunning(true);
      refreshAllData();
    } catch (err: any) {
      addToast('❌ Cron Error', 'Failed to start cron: ' + err.message, 'APPLICATION_FAILED');
    }
  };

  // Pause autonomous recurring cron scheduler
  const pauseCron = async () => {
    try {
      const res = await fetchWithTimeout('/api/pipeline/cron/pause', { method: 'POST' });
      const data = await res.json();
      addToast('⏸ Cron Paused', data.message || 'Autonomous cron scheduler paused.', 'INFO');
      setIsCronActive(false);
      setIsPipelineRunning(false);
      refreshAllData();
    } catch (err: any) {
      addToast('❌ Error', 'Failed to pause cron: ' + err.message, 'APPLICATION_FAILED');
    }
  };

  // Stop active pipeline execution / cancel running scan
  const executeStopPipeline = async () => {
    try {
      const res = await fetchWithTimeout('/api/pipeline/stop', { method: 'POST' }, 30000);
      const data = await res.json();
      addToast('🛑 Scan Stopped', data.message || 'Pipeline execution stopped.', 'INFO');
      setIsPipelineRunning(false);
      setIsCronActive(false);
      refreshAllData();
    } catch (err: any) {
      addToast('❌ Stop Failed', 'Failed stopping pipeline: ' + err.message, 'APPLICATION_FAILED');
    }
  };

  const stopPipeline = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Stop Job Crawler',
      message: 'Are you sure you want to stop the active crawler and application loop?',
      confirmLabel: 'Stop Scan',
      confirmVariant: 'danger',
      onConfirm: executeStopPipeline
    });
  };

  // Clear all discovered jobs from database
  const executeClearJobs = async () => {
    try {
      const res = await fetchWithTimeout('/api/jobs', { method: 'DELETE' });
      if (res.ok) {
        addToast('🗑️ Database Cleared', 'All job postings have been cleared from the database.', 'INFO');
        setSelectedJobId(null);
        setTopMatchesPage(1);
        setCrawledPage(1);
        refreshAllData();
      } else {
        const err = await res.json();
        addToast('❌ Clear Failed', 'Failed to clear jobs: ' + err.error, 'APPLICATION_FAILED');
      }
    } catch (err: any) {
      addToast('❌ Network Error', 'Error connecting to backend: ' + err.message, 'APPLICATION_FAILED');
    }
  };

  const clearJobs = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Clear Job Database',
      message: 'Are you sure you want to permanently clear ALL discovered job postings from the database? This action cannot be undone.',
      confirmLabel: 'Clear All Jobs',
      confirmVariant: 'danger',
      onConfirm: executeClearJobs
    });
  };

  // Save candidate profile
  const handleProfileSave = async (updatedProfile: CandidateProfile) => {
    setIsUpdatingProfile(true);
    try {
      const res = await fetchWithTimeout('/api/profile/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedProfile)
      });
      if (res.ok) {
        setProfile(updatedProfile);
        addToast('✅ Profile Saved', 'Your profile changes have been saved successfully.', 'APPLICATION_SUBMITTED');
        refreshAllData();
      } else {
        const err = await res.json();
        addToast('❌ Save Failed', 'Failed to update profile: ' + (err.error || 'Unknown error'), 'APPLICATION_FAILED');
      }
    } catch (err: any) {
      const msg = err.message?.includes('timed out') ? 'Server timed out saving profile. Check your connection.' : err.message;
      addToast('❌ Save Error', msg, 'APPLICATION_FAILED');
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  // Clear all application logs
  const executeClearApplications = async () => {
    try {
      const res = await fetchWithTimeout('/api/applications', { method: 'DELETE' });
      if (res.ok) {
        addToast('🗑️ Logs Cleared', 'All application logs have been deleted.', 'INFO');
        refreshAllData();
      } else {
        const err = await res.json();
        addToast('❌ Clear Failed', 'Failed to clear applications: ' + err.error, 'APPLICATION_FAILED');
      }
    } catch (err: any) {
      addToast('❌ Network Error', 'Error connecting to backend: ' + err.message, 'APPLICATION_FAILED');
    }
  };

  const clearApplications = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Clear Application Logs',
      message: 'Are you sure you want to permanently delete all application audit logs?',
      confirmLabel: 'Delete Logs',
      confirmVariant: 'danger',
      onConfirm: executeClearApplications
    });
  };

  // Parse uploaded resume file (PDF/DOCX)
  const parseResume = async () => {
    if (!selectedFile) {
      addToast('⚠️ Action Required', 'Please select a PDF or DOCX resume file first.', 'WARNING');
      return;
    }

    setIsParseModalOpen(false);
    setIsParsing(true);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const res = await fetchWithTimeout('/api/profile/upload', { method: 'POST', body: formData }, 60000); // 60s for CV parsing
      if (res.ok) {
        const profileData: CandidateProfile = await res.json();
        setProfile(profileData);
        setSelectedFile(null);
        addToast('✅ Resume Parsed', `Structured profile for ${profileData.name || 'candidate'} successfully.`, 'APPLICATION_SUBMITTED');
        refreshAllData();
      } else {
        const err = await res.json();
        addToast('❌ Parse Failed', 'Failed parsing resume: ' + err.error, 'APPLICATION_FAILED');
      }
    } catch (err: any) {
      const msg = err.message?.includes('timed out')
        ? 'CV parsing timed out after 60s. The AI service may be slow or unreachable.'
        : 'Error connecting to backend: ' + err.message;
      addToast('❌ Parse Error', msg, 'APPLICATION_FAILED');
    } finally {
      setIsParsing(false);
    }
  };

  // Selected job detail lookup
  const selectedJob = jobs.find(j => j.jobId === selectedJobId);
  const selectedApp = applications.find(a => a.applicationId === selectedAppId);

  // Authentication Loading Screen
  if (authLoading) {
    return (
      <div className="auth-page-container">
        <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
          <div className="auth-logo-badge" style={{ animation: 'spin 1.5s linear infinite' }}>
            <span>AI</span>
          </div>
          <p style={{ marginTop: '1rem', fontSize: '0.9375rem', fontWeight: 500 }}>Initializing security session...</p>
        </div>
      </div>
    );
  }

  // Unauthenticated View: Render high-converting Landing Page with modal Auth
  if (!user) {
    return (
      <>
        <LandingPage onOpenAuth={(mode) => setAuthModalMode(mode)} />
        {authModalMode && (
          <div className="modal" onClick={() => setAuthModalMode(null)}>
            <div onClick={(e) => e.stopPropagation()}>
              <AuthView 
                isModal={true} 
                onClose={() => setAuthModalMode(null)} 
                onSuccess={() => setAuthModalMode(null)} 
              />
            </div>
          </div>
        )}
      </>
    );
  }

  // Authenticated Landing Page Preview Mode
  if (showLandingPreview) {
    return (
      <div style={{ position: 'relative' }}>
        <div style={{ position: 'fixed', bottom: '2rem', right: '2rem', zIndex: 1000 }}>
          <button 
            className="btn-glow-primary"
            onClick={() => setShowLandingPreview(false)}
          >
            ← Return to Agent Dashboard
          </button>
        </div>
        <LandingPage onOpenAuth={() => setShowLandingPreview(false)} />
      </div>
    );
  }

  return (
    <div className="dashboard-layout">
      {/* Left Sidebar Navigation */}
      <aside className="dashboard-sidebar">
        <div className="sidebar-brand-header">
          <div className="brand-logo-icon">A</div>
          <div>
            <div className="brand-title">AI Job Agent</div>
            <div className="brand-subtitle">Autonomous ATS</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="sidebar-nav-heading">Platform</div>
          <button 
            type="button"
            className={`sidebar-item ${activeTab === 'dashboard' ? 'active' : ''}`} 
            onClick={() => setActiveTab('dashboard')}
          >
            <span className="sidebar-item-icon"><FiGrid /></span>
            <span>Overview</span>
          </button>
          
          <button 
            type="button"
            className={`sidebar-item ${activeTab === 'jobs' ? 'active' : ''}`} 
            onClick={() => setActiveTab('jobs')}
          >
            <span className="sidebar-item-icon"><FiBriefcase /></span>
            <span>Discovered Jobs</span>
            {jobs.length > 0 && <span className="sidebar-item-badge">{jobs.length}</span>}
          </button>
          
          <button 
            type="button"
            className={`sidebar-item ${activeTab === 'profile' ? 'active' : ''}`} 
            onClick={() => setActiveTab('profile')}
          >
            <span className="sidebar-item-icon"><FiUser /></span>
            <span>Candidate Profile</span>
          </button>
          
          <button 
            type="button"
            className={`sidebar-item ${activeTab === 'applications' ? 'active' : ''}`} 
            onClick={() => setActiveTab('applications')}
          >
            <span className="sidebar-item-icon"><FiFileText /></span>
            <span>Applications Log</span>
            {applications.length > 0 && <span className="sidebar-item-badge">{applications.length}</span>}
          </button>
        </nav>

        {/* Sidebar Footer with Authenticated User & Sign Out */}
        <div className="sidebar-footer">
          <div className="sidebar-user-card">
            <div className="sidebar-user-avatar">
              {user.photoURL ? (
                <img src={user.photoURL} alt={user.displayName || 'User'} />
              ) : (
                <span>{(user.displayName || user.email || 'U').charAt(0).toUpperCase()}</span>
              )}
            </div>
            <div className="sidebar-user-info">
              <span className="sidebar-user-name">
                {user.displayName || user.email?.split('@')[0]}
              </span>
              <span className="sidebar-user-email">
                {user.email}
              </span>
            </div>
          </div>

          <button 
            type="button" 
            className="btn-signout" 
            style={{ width: '100%', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '0.4rem', borderRadius: '6px' }}
            onClick={logout}
          >
            <FiLogOut /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="dashboard-main">
        {/* Topbar with Breadcrumbs, Live Agent Status, and Actions */}
        <header className="dashboard-topbar">
          <div className="topbar-breadcrumb">
            <span style={{ color: 'var(--text-secondary)' }}>Dashboard /</span>
            <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>
              {activeTab === 'dashboard' && 'Overview'}
              {activeTab === 'jobs' && 'Discovered Jobs'}
              {activeTab === 'profile' && 'Candidate Profile'}
              {activeTab === 'applications' && 'Applications Log'}
            </span>
          </div>

          <div className="topbar-actions">
            {sysConfig?.geminiMock && (
              <div 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.35rem', 
                  background: 'rgba(245, 158, 11, 0.12)', 
                  border: '1px solid rgba(245, 158, 11, 0.35)', 
                  padding: '0.3rem 0.65rem', 
                  borderRadius: '6px',
                  color: 'var(--warning-color)',
                  fontSize: '0.75rem',
                  fontWeight: 600
                }}
                title="Gemini running with simulation fallback. Set GEMINI_API_KEY for live models."
              >
                <span>⚡ Mock Simulation</span>
              </div>
            )}

            {/* Real-time Status Badge */}
            {isPipelineRunning ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(244, 63, 94, 0.15)', border: '1px solid var(--danger-color)', padding: '0.35rem 0.75rem', borderRadius: '8px' }}>
                <span className="pulsating-dot" style={{ backgroundColor: 'var(--danger-color)' }}></span>
                <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--danger-color)' }}>Scan Running</span>
                <button 
                  onClick={stopPipeline}
                  className="btn"
                  title="Stop current scan"
                  style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', backgroundColor: 'var(--danger-color)', borderColor: 'var(--danger-color)', marginLeft: '0.25rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                >
                  <FiSquare /> Stop
                </button>
              </div>
            ) : isCronActive ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid var(--accent-color)', padding: '0.35rem 0.75rem', borderRadius: '8px' }}>
                <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--accent-color)', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                  <FiClock /> Cron Active ({cronIntervalMinutes}m)
                </span>
                <button 
                  onClick={pauseCron}
                  className="btn btn-secondary"
                  title="Pause recurring cron job"
                  style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', borderColor: 'var(--warning-color)', color: 'var(--warning-color)', marginLeft: '0.25rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                >
                  <FiPause /> Pause
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.8125rem', padding: '0.35rem 0.6rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--text-muted)' }}></span>
                <span>Agent Idle</span>
              </div>
            )}
          </div>
        </header>

        <main className="dashboard-page-container">
        {/* Tab 1: Dashboard Overview */}
        {activeTab === 'dashboard' && (
          <div>
            <div className="metrics-grid">
              <div className="metric-card matched">
                <div className="label">High Match Rate (≥80)</div>
                <div className="value">{highMatches.length}</div>
              </div>
              <div className="metric-card applied">
                <div className="label">Applications Submitted</div>
                <div className="value">{applied.length}</div>
              </div>
              <div className="metric-card queued">
                <div className="label">In Queue</div>
                <div className="value">{queued.length}</div>
              </div>
              <div className="metric-card skipped">
                <div className="label">Total Crawler Discoveries</div>
                <div className="value">{jobs.length}</div>
              </div>
            </div>

            <div className="action-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h2>Autonomous Recruitment Loop & Cron Controls</h2>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                  {isPipelineRunning 
                    ? '🔴 Crawler scan is actively scraping and applying to live job boards...'
                    : isCronActive
                      ? `⏰ Autonomous scheduler active: runs automatically every ${cronIntervalMinutes} minute(s).`
                      : 'Trigger single crawler runs or activate autonomous background cron scheduling.'
                  }
                </p>
              </div>

              <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
                {/* Single Scans */}
                {!isPipelineRunning && (
                  <>
                    <button className="btn btn-secondary" onClick={() => runPipeline(true)}>
                      ▶ Dry Run Scan
                    </button>
                    <button className="btn" onClick={() => runPipeline(false)}>
                      🚀 Live Apply Scan
                    </button>
                  </>
                )}

                {/* Cron Start / Pause Controls */}
                {isCronActive ? (
                  <button 
                    className="btn btn-secondary" 
                    onClick={pauseCron}
                    style={{ borderColor: 'var(--warning-color)', color: 'var(--warning-color)', fontWeight: 600 }}
                  >
                    ⏸ Pause Cron Job
                  </button>
                ) : (
                  <button 
                    className="btn btn-secondary" 
                    onClick={() => startCron(60, true)}
                    style={{ borderColor: 'var(--accent-color)', color: 'var(--accent-color)', fontWeight: 600 }}
                  >
                    ⏰ Start 1h Cron
                  </button>
                )}

                {/* Stop Current Scan (Always visible if running or active) */}
                {isPipelineRunning && (
                  <button 
                    className="btn" 
                    onClick={stopPipeline}
                    style={{ backgroundColor: 'var(--danger-color)', borderColor: 'var(--danger-color)', fontWeight: 700 }}
                  >
                    ⏹ Stop Current Scan
                  </button>
                )}

                {/* Clear Database Button */}
                {jobs.length > 0 && !isPipelineRunning && (
                  <button 
                    className="btn btn-secondary" 
                    onClick={clearJobs}
                    style={{ borderColor: 'var(--danger-color)', color: 'var(--danger-color)' }}
                  >
                    🗑️ Clear All Jobs
                  </button>
                )}
              </div>
            </div>

            <div className="section-grid">
              <div className="card-panel">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <h3>Top Matches Available ({filteredHighMatches.length})</h3>
                </div>

                {/* Filter Toolbar for Top Matches */}
                <div className="filter-toolbar">
                  <div className="filter-btn-group">
                    <button 
                      className={`filter-pill ${filterModality === 'all' ? 'active' : ''}`}
                      onClick={() => { setFilterModality('all'); setTopMatchesPage(1); }}
                    >
                      All ({highMatches.length})
                    </button>
                    <button 
                      className={`filter-pill ${filterModality === 'remote' ? 'active' : ''}`}
                      onClick={() => { setFilterModality('remote'); setTopMatchesPage(1); }}
                    >
                      🌐 Remote ({highMatches.filter(isJobRemote).length})
                    </button>
                    <button 
                      className={`filter-pill ${filterModality === 'relocation' ? 'active' : ''}`}
                      onClick={() => { setFilterModality('relocation'); setTopMatchesPage(1); }}
                    >
                      ✈️ Relocation ({highMatches.filter(doesJobOfferRelocation).length})
                    </button>
                    <button 
                      className={`filter-pill ${filterModality === 'africa' ? 'active' : ''}`}
                      onClick={() => { setFilterModality('africa'); setTopMatchesPage(1); }}
                    >
                      🌍 Africa ({highMatches.filter(isJobAfricanStream).length})
                    </button>
                  </div>

                  <input 
                    type="text" 
                    className="search-input-box"
                    placeholder="Search top matches..." 
                    value={searchKeyword}
                    onChange={(e) => { setSearchKeyword(e.target.value); setTopMatchesPage(1); setCrawledPage(1); }}
                  />
                </div>

                <div className="job-list">
                  {filteredHighMatches.length === 0 ? (
                    <div className="placeholder-text-center">
                      No matching jobs found matching the current filter/search.<br />
                      {highMatches.length === 0 ? 'Run a scan to discover and score live postings.' : 'Try selecting "All" or clearing the search.'}
                    </div>
                  ) : (
                    paginatedTopMatches.map(job => (
                      <div 
                        key={job.jobId}
                        className={`job-item ${selectedJobId === job.jobId ? 'selected' : ''}`}
                        onClick={() => setSelectedJobId(job.jobId)}
                      >
                        <div className="job-header">
                          <span className="job-title">{job.title}</span>
                          <span className="badge badge-score">{job.matchScore}% Match</span>
                        </div>
                        <div className="job-header" style={{ marginBottom: 0 }}>
                          <span className="job-meta">
                            <span>{job.company}</span>
                            <span>{job.location}</span>
                            <span>{job.workplaceType}</span>
                          </span>
                          <span className={`badge badge-status status-${job.status.toLowerCase()}`}>
                            {job.status}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.4rem' }}>
                          {isJobRemote(job) && <span className="badge badge-remote">🌐 Fully Remote</span>}
                          {doesJobOfferRelocation(job) && <span className="badge badge-relocation">✈️ Relocation Support</span>}
                          {isJobAfricanStream(job) && <span className="badge badge-africa">🌍 Africa</span>}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {totalTopMatchesPages > 1 && (
                  <div className="pagination-container">
                    <div className="pagination-info">
                      Showing {(topMatchesPage - 1) * TOP_MATCHES_PER_PAGE + 1}–{Math.min(topMatchesPage * TOP_MATCHES_PER_PAGE, filteredHighMatches.length)} of {filteredHighMatches.length} matches
                    </div>
                    <div className="pagination-buttons">
                      <button 
                        className="pagination-btn" 
                        onClick={() => setTopMatchesPage(p => Math.max(1, p - 1))}
                        disabled={topMatchesPage === 1}
                      >
                        ← Prev
                      </button>
                      <span className="pagination-page-indicator">{topMatchesPage} / {totalTopMatchesPages}</span>
                      <button 
                        className="pagination-btn" 
                        onClick={() => setTopMatchesPage(p => Math.min(totalTopMatchesPages, p + 1))}
                        disabled={topMatchesPage === totalTopMatchesPages}
                      >
                        Next →
                      </button>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="card-panel detail-view">
                <h3>Match Assessment</h3>
                {selectedJob ? (
                  <div>
                    <div className="detail-header">
                      <div className="detail-title">{selectedJob.title}</div>
                      <div className="detail-company">{selectedJob.company}</div>
                      <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                        {selectedJob.location} • {selectedJob.workplaceType}
                      </div>
                      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                        {isJobRemote(selectedJob) && <span className="badge badge-remote">🌐 Fully Remote</span>}
                        {doesJobOfferRelocation(selectedJob) && <span className="badge badge-relocation">✈️ Relocation / Visa Support</span>}
                        {isJobAfricanStream(selectedJob) && <span className="badge badge-africa">🌍 Africa</span>}
                      </div>
                    </div>

                    <div className="score-breakdown-box">
                      <div style={{ fontWeight: 700, fontSize: '1rem', display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                        <span>AI Match Score</span>
                        <span style={{ color: 'var(--accent-color)' }}>{selectedJob.matchScore}%</span>
                      </div>
                      <div className="score-row">
                        <span className="score-label">Primary Tech Stack & Tools (Max 45)</span>
                        <span className="score-val">{selectedJob.matchBreakdown?.techStackScore || 0}/45</span>
                      </div>
                      <div className="score-row">
                        <span className="score-label">Role Title & Domain Alignment (Max 25)</span>
                        <span className="score-val">{selectedJob.matchBreakdown?.roleTitleScore ?? selectedJob.matchBreakdown?.architectureScore ?? 0}/25</span>
                      </div>
                      <div className="score-row">
                        <span className="score-label">Seniority & Track Record (Max 15)</span>
                        <span className="score-val">{selectedJob.matchBreakdown?.seniorityScore || 0}/15</span>
                      </div>
                      <div className="score-row">
                        <span className="score-label">Work Authorization & Location (Max 15)</span>
                        <span className="score-val">{selectedJob.matchBreakdown?.locationScore || 0}/15</span>
                      </div>
                    </div>

                    {/* Skill Matrix Breakdown */}
                    {((selectedJob.matchBreakdown?.matchedMustHaves && selectedJob.matchBreakdown.matchedMustHaves.length > 0) ||
                      (selectedJob.matchBreakdown?.missingMustHaves && selectedJob.matchBreakdown.missingMustHaves.length > 0)) && (
                      <div className="detail-block" style={{ marginTop: '1rem' }}>
                        <h4>Skillset Alignment Matrix</h4>
                        {selectedJob.matchBreakdown?.matchedMustHaves && selectedJob.matchBreakdown.matchedMustHaves.length > 0 && (
                          <div style={{ marginBottom: '0.65rem' }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#10b981', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                              <span>✅ Matched Skills ({selectedJob.matchBreakdown.matchedMustHaves.length})</span>
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                              {selectedJob.matchBreakdown.matchedMustHaves.map(skill => (
                                <span key={skill} style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                                  {skill}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {selectedJob.matchBreakdown?.missingMustHaves && selectedJob.matchBreakdown.missingMustHaves.length > 0 && (
                          <div>
                            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#f59e0b', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                              <span>⚠️ Unmatched Stack Requirements ({selectedJob.matchBreakdown.missingMustHaves.length})</span>
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                              {selectedJob.matchBreakdown.missingMustHaves.map(skill => (
                                <span key={skill} style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '4px', background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                                  {skill}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="detail-block">
                      <h4>Scoring Rationale</h4>
                      <div className="detail-desc">{selectedJob.matchSummary || 'No rubric rationale provided.'}</div>
                    </div>

                    <div className="detail-block">
                      <h4>Apply URL</h4>
                      <a 
                        href={selectedJob.applyUrl} 
                        target="_blank" 
                        rel="noreferrer" 
                        style={{ color: 'var(--accent-color)', fontSize: '0.875rem', decoration: 'none', wordBreak: 'break-all' }}
                      >
                        {selectedJob.applyUrl}
                      </a>
                    </div>
                  </div>
                ) : (
                  <div className="placeholder-text">
                    Select a job from the list to view its scoring rubric breakdown.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Discovered Jobs */}
        {activeTab === 'jobs' && (
          <div className="card-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <h3>All Crawled Postings ({filteredCrawledJobs.length})</h3>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                  Total In DB: {jobs.length} postings
                </span>
                {jobs.length > 0 && (
                  <button 
                    className="btn btn-secondary" 
                    onClick={clearJobs} 
                    style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', borderColor: 'var(--danger-color)', color: 'var(--danger-color)' }}
                  >
                    Clear All Jobs
                  </button>
                )}
              </div>
            </div>

            {/* Filter Toolbar for All Discovered Jobs */}
            <div className="filter-toolbar">
              <div className="filter-btn-group">
                <button 
                  className={`filter-pill ${filterModality === 'all' ? 'active' : ''}`}
                  onClick={() => { setFilterModality('all'); setCrawledPage(1); }}
                >
                  All ({jobs.length})
                </button>
                <button 
                  className={`filter-pill ${filterModality === 'remote' ? 'active' : ''}`}
                  onClick={() => { setFilterModality('remote'); setCrawledPage(1); }}
                >
                  🌐 Remote ({jobs.filter(isJobRemote).length})
                </button>
                <button 
                  className={`filter-pill ${filterModality === 'relocation' ? 'active' : ''}`}
                  onClick={() => { setFilterModality('relocation'); setCrawledPage(1); }}
                >
                  ✈️ Relocation ({jobs.filter(doesJobOfferRelocation).length})
                </button>
                <button 
                  className={`filter-pill ${filterModality === 'africa' ? 'active' : ''}`}
                  onClick={() => { setFilterModality('africa'); setCrawledPage(1); }}
                >
                  🌍 Africa ({jobs.filter(isJobAfricanStream).length})
                </button>
              </div>

              <input 
                type="text" 
                className="search-input-box"
                placeholder="Filter by title, company, stack..." 
                value={searchKeyword}
                onChange={(e) => { setSearchKeyword(e.target.value); setCrawledPage(1); }}
              />
            </div>

            <div className="job-list" style={{ marginTop: '0.5rem' }}>
              {filteredCrawledJobs.length === 0 ? (
                <div className="placeholder-text-center">
                  No job postings match the selected filter.
                </div>
              ) : (
                paginatedCrawledJobs.map(job => {
                  const scoreBadge = job.matchScore 
                    ? <span className={`badge badge-score ${job.matchScore < 80 ? 'low' : ''}`}>{job.matchScore}% Match</span>
                    : <span className="badge" style={{ backgroundColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>Unscored</span>;

                  return (
                    <div key={job.jobId} className="job-item">
                      <div className="job-header">
                        <span className="job-title">{job.title}</span>
                        {scoreBadge}
                      </div>
                      <div className="job-header" style={{ marginBottom: 0 }}>
                        <span className="job-meta">
                          <span>{job.company}</span>
                          <span>{job.location}</span>
                          <span>{job.workplaceType}</span>
                          <span style={{ fontFamily: 'monospace' }}>{job.boardType}</span>
                        </span>
                        <span className={`badge badge-status status-${job.status.toLowerCase()}`}>
                          {job.status}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.4rem' }}>
                        {isJobRemote(job) && <span className="badge badge-remote">🌐 Fully Remote</span>}
                        {doesJobOfferRelocation(job) && <span className="badge badge-relocation">✈️ Relocation Support</span>}
                        {isJobAfricanStream(job) && <span className="badge badge-africa">🌍 Africa</span>}
                      </div>
                      {job.matchSummary && (
                        <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '0.5rem', borderTop: '1px dashed var(--border-color)', paddingTop: '0.5rem' }}>
                          {job.matchSummary}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {totalCrawledPages > 1 && (
              <div className="pagination-container">
                <div className="pagination-info">
                  Showing {(crawledPage - 1) * CRAWLED_PER_PAGE + 1}–{Math.min(crawledPage * CRAWLED_PER_PAGE, filteredCrawledJobs.length)} of {filteredCrawledJobs.length} postings
                </div>
                <div className="pagination-buttons">
                  <button 
                    className="pagination-btn" 
                    onClick={() => setCrawledPage(p => Math.max(1, p - 1))}
                    disabled={crawledPage === 1}
                  >
                    ← Prev
                  </button>
                  <span className="pagination-page-indicator">{crawledPage} / {totalCrawledPages}</span>
                  <button 
                    className="pagination-btn" 
                    onClick={() => setCrawledPage(p => Math.min(totalCrawledPages, p + 1))}
                    disabled={crawledPage === totalCrawledPages}
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Candidate Profile */}
        {activeTab === 'profile' && (
          <CandidateProfileForm
            profile={profile}
            onSave={handleProfileSave}
            isUpdating={isUpdatingProfile}
            onOpenParseModal={() => setIsParseModalOpen(true)}
          />
        )}

        {/* Tab 4: Applications Log */}
        {activeTab === 'applications' && (
          <div className="section-grid">
            <div className="card-panel">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3>Submission Audit Trail</h3>
                {applications.length > 0 && (
                  <button 
                    className="btn btn-secondary" 
                    onClick={clearApplications} 
                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', borderColor: 'var(--danger-color)', color: 'var(--danger-color)' }}
                  >
                    Clear All Logs
                  </button>
                )}
              </div>
              <div className="job-list" style={{ marginTop: '1rem' }}>
                {applications.length === 0 ? (
                  <div className="placeholder-text-center">
                    No submission attempts logged in the database yet.
                  </div>
                ) : (
                  paginatedApps.map(app => (
                    <div 
                      key={app.applicationId}
                      className={`job-item ${selectedAppId === app.applicationId ? 'selected' : ''}`}
                      onClick={() => setSelectedAppId(app.applicationId)}
                    >
                      <div className="job-header">
                        <span className="job-title">{app.role}</span>
                        <span className={`badge badge-status status-${app.status === 'SUCCESS' ? 'applied' : 'failed'}`}>
                          {app.status}
                        </span>
                      </div>
                      <div className="job-header" style={{ marginBottom: 0 }}>
                        <span className="job-meta">
                          <span>{app.company}</span>
                          <span>Applied: {new Date(app.appliedAt).toLocaleString()}</span>
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {totalAppsPages > 1 && (
                <div className="pagination-container">
                  <div className="pagination-info">
                    Showing {(appsPage - 1) * APPS_PER_PAGE + 1}–{Math.min(appsPage * APPS_PER_PAGE, applications.length)} of {applications.length} logs
                  </div>
                  <div className="pagination-buttons">
                    <button 
                      className="pagination-btn" 
                      onClick={() => setAppsPage(p => Math.max(1, p - 1))}
                      disabled={appsPage === 1}
                    >
                      ← Prev
                    </button>
                    <span className="pagination-page-indicator">{appsPage} / {totalAppsPages}</span>
                    <button 
                      className="pagination-btn" 
                      onClick={() => setAppsPage(p => Math.min(totalAppsPages, p + 1))}
                      disabled={appsPage === totalAppsPages}
                    >
                      Next →
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="card-panel detail-view">
              <h3>Submission Receipt</h3>
              {selectedApp ? (
                <div>
                  <div className="detail-header">
                    <div className="detail-title">{selectedApp.role}</div>
                    <div className="detail-company">{selectedApp.company}</div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                      Attempted: {new Date(selectedApp.appliedAt).toLocaleString()}
                    </div>
                  </div>

                  <div className="detail-block">
                    <h4>Submission Details & Logs</h4>
                    <div className="detail-desc" style={{ backgroundColor: 'var(--bg-card)', padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--border-color)', fontFamily: 'monospace', fontSize: '0.8125rem' }}>
                      {selectedApp.notes || 'No execution log notes.'}
                    </div>
                  </div>

                  <div className="detail-block">
                    <h4>Pre-Filled Form Payload</h4>
                    <div style={{ maxHeight: '250px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                      {selectedApp.submittedPayload && Object.entries(selectedApp.submittedPayload).length > 0 ? (
                        Object.entries(selectedApp.submittedPayload).map(([label, val]) => (
                          <div key={label} style={{ marginBottom: '0.5rem', fontSize: '0.8125rem' }}>
                            <div style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{label}:</div>
                            <div style={{ fontFamily: 'monospace', backgroundColor: 'var(--bg-card)', padding: '0.375rem', borderRadius: '4px', marginTop: '0.125rem', border: '1px solid var(--border-color)' }}>
                              {String(val)}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="detail-desc">No form payloads enqueued.</div>
                      )}
                    </div>
                  </div>

                  {selectedApp.preSubmitScreenshotPath && (
                    <div className="detail-block">
                      <h4>Submission Verification Screenshot</h4>
                      <div className="screenshot-box">
                        <img src={selectedApp.preSubmitScreenshotPath} alt="Submission Screenshot" />
                      </div>
                    </div>
                  )}

                  {selectedApp.confirmationScreenshotPath && (
                    <div className="detail-block">
                      <h4>Confirmation Receipt Screenshot</h4>
                      <div className="screenshot-box">
                        <img src={selectedApp.confirmationScreenshotPath} alt="Confirmation Screenshot" />
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="placeholder-text">
                  Select an application to view the pre-filled forms and screenshots.
                </div>
              )}
            </div>
          </div>
        )}
      </main>
      </div>

      {/* Parse Resume Modal */}
      {isParseModalOpen && (
        <div className="modal">
          <div className="modal-content">
            <div className="modal-header">Parse PDF or DOCX Resume</div>
            <div className="form-group">
              <label htmlFor="resume-file-input">Choose CV file (PDF or DOCX)</label>
              <input 
                type="file" 
                id="resume-file-input" 
                className="form-control" 
                accept=".pdf,.docx"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    setSelectedFile(e.target.files[0]);
                  }
                }}
              />
            </div>
            <div className="modal-footer">
              <button 
                className="btn btn-secondary" 
                onClick={() => {
                  setIsParseModalOpen(false);
                  setSelectedFile(null);
                }}
              >
                Cancel
              </button>
              <button className="btn" onClick={parseResume}>
                Parse CV with AI
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification Stack */}
      <div style={{
        position: 'fixed',
        bottom: '1.5rem',
        right: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        zIndex: 9999,
        maxWidth: '360px',
        width: '100%',
      }}>
        {toasts.map(toast => {
          const isSuccess = toast.type === 'APPLICATION_SUBMITTED' || toast.type === 'SCAN_COMPLETE';
          const isError = toast.type === 'APPLICATION_FAILED';
          const accentColor = isSuccess ? '#22c55e' : isError ? '#ef4444' : '#6366f1';
          return (
            <div
              key={toast.id}
              style={{
                background: 'var(--bg-card, #1e1e2e)',
                border: `1px solid ${accentColor}`,
                borderLeft: `4px solid ${accentColor}`,
                borderRadius: '10px',
                padding: '0.875rem 1rem',
                boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
                animation: 'slideInToast 0.3s ease',
              }}
            >
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: accentColor, marginBottom: '0.25rem' }}>
                {toast.title}
              </div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary, #94a3b8)', lineHeight: 1.4 }}>
                {toast.body}
              </div>
              <button
                onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
                style={{
                  position: 'absolute',
                  top: '0.5rem',
                  right: '0.6rem',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-secondary, #94a3b8)',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  lineHeight: 1,
                }}
              >×</button>
            </div>
          );
        })}
      </div>

      {/* Confirmation Modal */}
      {confirmModal && (
        <ConfirmModal
          isOpen={confirmModal.isOpen}
          title={confirmModal.title}
          message={confirmModal.message}
          confirmLabel={confirmModal.confirmLabel}
          confirmVariant={confirmModal.confirmVariant}
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal(null)}
        />
      )}

      <style>{`
        @keyframes slideInToast {
          from { opacity: 0; transform: translateX(40px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
