let activeTab = 'dashboard';
let jobsCache = [];
let applicationsCache = [];
let profileCache = null;

document.addEventListener('DOMContentLoaded', () => {
  refreshAllData();
  // Poll every 10 seconds for updates
  setInterval(refreshAllData, 10000);
});

function switchTab(tabId) {
  activeTab = tabId;
  
  // Update nav buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
    if (btn.innerText.toLowerCase().includes(tabId === 'dashboard' ? 'overview' : tabId)) {
      btn.classList.add('active');
    }
  });

  // Update nav panels
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.remove('active');
  });
  document.getElementById(`tab-${tabId}`).classList.add('active');
  
  renderData();
}

async function refreshAllData() {
  try {
    const [profileRes, jobsRes, appsRes] = await Promise.all([
      fetch('/api/profile'),
      fetch('/api/jobs'),
      fetch('/api/applications')
    ]);

    if (profileRes.ok) {
      profileCache = await profileRes.json();
    }
    if (jobsRes.ok) {
      jobsCache = await jobsRes.json();
    }
    if (appsRes.ok) {
      applicationsCache = await appsRes.json();
    }

    renderData();
  } catch (err) {
    console.error('Error refreshing dashboard data:', err);
  }
}

function renderData() {
  // Update Profile Tab Form & Info
  if (profileCache) {
    document.getElementById('profile-last-parsed').innerText = new Date(profileCache.updatedAt).toLocaleString();
    document.getElementById('profile-cv-path').innerText = profileCache.cvStoragePath || '-';
    
    // Only update form inputs if the user isn't currently editing them
    if (document.activeElement?.tagName !== 'INPUT') {
      document.getElementById('prof-name').value = profileCache.name || '';
      document.getElementById('prof-email').value = profileCache.email || '';
      document.getElementById('prof-phone').value = profileCache.phone || '';
      document.getElementById('prof-loc').value = profileCache.location || '';
      document.getElementById('prof-exp').value = profileCache.experienceYears || 0;
      document.getElementById('prof-auth').value = profileCache.workAuthorization || '';
      document.getElementById('prof-roles').value = profileCache.targetRoles ? profileCache.targetRoles.join(', ') : '';
      document.getElementById('prof-locations').value = profileCache.targetLocations ? profileCache.targetLocations.join(', ') : '';
    }
  }

  // Update Metric Cards
  const highMatches = jobsCache.filter(j => j.matchScore && j.matchScore >= 80);
  const queued = jobsCache.filter(j => j.status === 'QUEUED' || j.status === 'MANUAL_APPLY');
  const applied = applicationsCache.filter(a => a.status === 'SUCCESS');

  document.getElementById('metric-match-rate').innerText = highMatches.length;
  document.getElementById('metric-applied').innerText = applied.length;
  document.getElementById('metric-queued').innerText = queued.length;
  document.getElementById('metric-total-discoveries').innerText = jobsCache.length;

  if (activeTab === 'dashboard') {
    renderDashboardOverview();
  } else if (activeTab === 'jobs') {
    renderAllJobs();
  } else if (activeTab === 'applications') {
    renderApplications();
  }
}

// Render Dashboard View
function renderDashboardOverview() {
  const topListEl = document.getElementById('top-jobs-list');
  const highMatches = jobsCache.filter(j => j.matchScore && j.matchScore >= 80);

  if (highMatches.length === 0) {
    topListEl.innerHTML = `
      <div class="placeholder-text" style="padding: 3rem;">
        No high-matching jobs (score &ge; 80) found yet.<br>
        Run a scan to scrape job postings and score them using Gemini.
      </div>
    `;
    return;
  }

  topListEl.innerHTML = highMatches.map(job => `
    <div class="job-item" onclick="selectJob('${job.jobId}')" id="job-item-${job.jobId}">
      <div class="job-header">
        <span class="job-title">${job.title}</span>
        <span class="badge badge-score">${job.matchScore}% Match</span>
      </div>
      <div class="job-header" style="margin-bottom: 0;">
        <span class="job-meta">
          <span>${job.company}</span> • <span>${job.location}</span> • <span>${job.workplaceType}</span>
        </span>
        <span class="badge badge-status status-${job.status.toLowerCase()}">${job.status}</span>
      </div>
    </div>
  `).join('');
}

// Render All Crawled Jobs
function renderAllJobs() {
  const allListEl = document.getElementById('all-jobs-list');

  if (jobsCache.length === 0) {
    allListEl.innerHTML = `
      <div class="placeholder-text" style="padding: 3rem;">
        No job postings found in the database. Run the scan loop to populate.
      </div>
    `;
    return;
  }

  allListEl.innerHTML = jobsCache.map(job => {
    const scoreBadge = job.matchScore 
      ? `<span class="badge badge-score ${job.matchScore < 80 ? 'low' : ''}">${job.matchScore}% Match</span>`
      : `<span class="badge" style="background-color: var(--border-color); color: var(--text-secondary);">Unscored</span>`;

    return `
      <div class="job-item">
        <div class="job-header">
          <span class="job-title">${job.title}</span>
          ${scoreBadge}
        </div>
        <div class="job-header" style="margin-bottom: 0;">
          <span class="job-meta">
            <span>${job.company}</span> • <span>${job.location}</span> • <span>${job.workplaceType}</span> • <span style="font-family: monospace;">${job.boardType}</span>
          </span>
          <span class="badge badge-status status-${job.status.toLowerCase()}">${job.status}</span>
        </div>
        ${job.matchSummary ? `<div style="font-size: 0.8125rem; color: var(--text-secondary); margin-top: 0.5rem; border-top: 1px dashed var(--border-color); padding-top: 0.5rem;">${job.matchSummary}</div>` : ''}
      </div>
    `;
  }).join('');
}

// Render Applications Audit Trail Tab
function renderApplications() {
  const appsListEl = document.getElementById('applications-list');

  if (applicationsCache.length === 0) {
    appsListEl.innerHTML = `
      <div class="placeholder-text" style="padding: 3rem;">
        No submission attempts logged in the database yet.
      </div>
    `;
    return;
  }

  appsListEl.innerHTML = applicationsCache.map(app => `
    <div class="job-item" onclick="selectApplication('${app.applicationId}')" id="app-item-${app.applicationId}">
      <div class="job-header">
        <span class="job-title">${app.role}</span>
        <span class="badge badge-status status-${app.status === 'SUCCESS' ? 'applied' : 'failed'}">${app.status}</span>
      </div>
      <div class="job-header" style="margin-bottom: 0;">
        <span class="job-meta">
          <span>${app.company}</span> • <span>Applied: ${new Date(app.appliedAt).toLocaleString()}</span>
        </span>
      </div>
    </div>
  `).join('');
}

// Selection & Inspection Helpers
function selectJob(jobId) {
  document.querySelectorAll('.job-item').forEach(el => el.classList.remove('selected'));
  document.getElementById(`job-item-${jobId}`)?.classList.add('selected');

  const job = jobsCache.find(j => j.jobId === jobId);
  if (!job) return;

  const detailEl = document.getElementById('assessment-detail');
  
  const bd = job.matchBreakdown || { techStackScore: 0, seniorityScore: 0, locationScore: 0, architectureScore: 0 };

  detailEl.innerHTML = `
    <div class="detail-header">
      <div class="detail-title">${job.title}</div>
      <div class="detail-company">${job.company}</div>
      <div style="font-size: 0.8125rem; color: var(--text-secondary); margin-top: 0.25rem;">
        ${job.location} • ${job.workplaceType}
      </div>
    </div>

    <div class="score-breakdown-box">
      <div style="font-weight: 700; font-size: 1rem; display: flex; justify-content: space-between; margin-bottom: 0.75rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">
        <span>Gemini Match Score</span>
        <span style="color: var(--accent-color);">${job.matchScore}%</span>
      </div>
      <div class="score-row">
        <span class="score-label">Core Tech Stack Match (Max 40)</span>
        <span class="score-val">${bd.techStackScore}/40</span>
      </div>
      <div class="score-row">
        <span class="score-label">Seniority & Track Record (Max 25)</span>
        <span class="score-val">${bd.seniorityScore}/25</span>
      </div>
      <div class="score-row">
        <span class="score-label">Work Authorization & Location (Max 20)</span>
        <span class="score-val">${bd.locationScore}/20</span>
      </div>
      <div class="score-row">
        <span class="score-label">Architecture & Scale (Max 15)</span>
        <span class="score-val">${bd.architectureScore}/15</span>
      </div>
    </div>

    <div class="detail-block">
      <h4>Scoring Rationale</h4>
      <div class="detail-desc">${job.matchSummary || 'No rubric rationale provided.'}</div>
    </div>

    <div class="detail-block">
      <h4>Apply URL</h4>
      <a href="${job.applyUrl}" target="_blank" style="color: var(--accent-color); font-size: 0.875rem; text-decoration: none; word-break: break-all;">
        ${job.applyUrl}
      </a>
    </div>
  `;
}

function selectApplication(appId) {
  document.querySelectorAll('.job-item').forEach(el => el.classList.remove('selected'));
  document.getElementById(`app-item-${appId}`)?.classList.add('selected');

  const app = applicationsCache.find(a => a.applicationId === appId);
  if (!app) return;

  const detailEl = document.getElementById('app-receipt-detail');

  // Build JSON formatted output of pre-filled answers
  const formPayloadHtml = Object.entries(app.submittedPayload).map(([label, val]) => `
    <div style="margin-bottom: 0.5rem; font-size: 0.8125rem;">
      <div style="color: var(--text-secondary); font-weight: 500;">${label}:</div>
      <div style="font-family: monospace; background-color: var(--bg-card); padding: 0.375rem; border-radius: 4px; margin-top: 0.125rem; border: 1px solid var(--border-color);">${val}</div>
    </div>
  `).join('');

  detailEl.innerHTML = `
    <div class="detail-header">
      <div class="detail-title">${app.role}</div>
      <div class="detail-company">${app.company}</div>
      <div style="font-size: 0.8125rem; color: var(--text-secondary); margin-top: 0.25rem;">
        Attempted: ${new Date(app.appliedAt).toLocaleString()}
      </div>
    </div>

    <div class="detail-block">
      <h4>Submission Details & Logs</h4>
      <div class="detail-desc" style="background-color: var(--bg-card); padding: 0.75rem; border-radius: 6px; border: 1px solid var(--border-color); font-family: monospace; font-size: 0.8125rem;">
        ${app.notes || 'No execution log notes.'}
      </div>
    </div>

    <div class="detail-block">
      <h4>Pre-Filled Form Payload</h4>
      <div style="max-height: 250px; overflow-y: auto; padding-right: 0.5rem;">
        ${formPayloadHtml || '<div class="detail-desc">No form payloads enqueued.</div>'}
      </div>
    </div>

    ${app.preSubmitScreenshotPath ? `
      <div class="detail-block">
        <h4>Submission Verification Screenshot</h4>
        <div class="screenshot-box">
          <img src="${app.preSubmitScreenshotPath}" alt="Submission Screenshot">
        </div>
      </div>
    ` : ''}

    ${app.confirmationScreenshotPath ? `
      <div class="detail-block">
        <h4>Confirmation Receipt Screenshot</h4>
        <div class="screenshot-box">
          <img src="${app.confirmationScreenshotPath}" alt="Confirmation Screenshot">
        </div>
      </div>
    ` : ''}
  `;
}

// API Triggers
async function runPipeline(dryRun) {
  const confirmMsg = dryRun 
    ? "Initiate job board crawling and match scoring? (Applications will be enqueued in dry-run mode)" 
    : "WARNING: You are triggering LIVE applications. Playwright will submit active applications. Proceed?";
  
  if (!confirm(confirmMsg)) return;

  try {
    const res = await fetch('/api/pipeline/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dryRun })
    });
    const data = await res.json();
    alert(data.message);
    refreshAllData();
  } catch (err) {
    alert('Failed to trigger pipeline run: ' + err.message);
  }
}

async function saveProfile(e) {
  e.preventDefault();
  
  const targetRoles = document.getElementById('prof-roles').value.split(',').map(s => s.trim()).filter(Boolean);
  const targetLocations = document.getElementById('prof-locations').value.split(',').map(s => s.trim()).filter(Boolean);

  const updatedProfile = {
    ...profileCache,
    name: document.getElementById('prof-name').value,
    email: document.getElementById('prof-email').value,
    phone: document.getElementById('prof-phone').value,
    location: document.getElementById('prof-loc').value,
    experienceYears: parseInt(document.getElementById('prof-exp').value, 10),
    workAuthorization: document.getElementById('prof-auth').value,
    targetRoles,
    targetLocations,
  };

  try {
    const res = await fetch('/api/profile/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedProfile)
    });
    if (res.ok) {
      alert('Profile updated successfully.');
      refreshAllData();
    } else {
      const err = await res.json();
      alert('Failed to update profile: ' + err.error);
    }
  } catch (err) {
    alert('Failed to update profile: ' + err.message);
  }
}

// Modal dialog functions
function openParseModal() {
  document.getElementById('parse-modal').style.display = 'flex';
}

function closeParseModal() {
  document.getElementById('parse-modal').style.display = 'none';
}

async function parseResume() {
  const localPath = document.getElementById('resume-local-path').value;
  if (!localPath) {
    alert('Please enter a valid absolute path to your local resume PDF file.');
    return;
  }

  closeParseModal();
  
  // Show spinner or loading state
  const btn = document.querySelector('[onclick="openParseModal()"]');
  const oldText = btn.innerText;
  btn.innerText = 'Parsing resume text...';
  btn.disabled = true;

  try {
    const res = await fetch('/api/profile/parse-local', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ localPath })
    });
    
    if (res.ok) {
      alert('Resume parsed and structured using Gemini.');
      refreshAllData();
    } else {
      const err = await res.json();
      alert('Failed parsing resume: ' + err.error);
    }
  } catch (err) {
    alert('Error connecting to backend: ' + err.message);
  } finally {
    btn.innerText = oldText;
    btn.disabled = false;
  }
}
