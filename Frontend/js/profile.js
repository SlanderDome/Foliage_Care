
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const icons = {
    success: 'fa-check-circle',
    error: 'fa-exclamation-circle',
    info: 'fa-circle-info'
  };

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i><span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast-exit');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  }, 3200);
}

function waitForFirebaseProfile(callback) {
  if (window.firebaseReady && window.db && window.firebaseAuth) {
    callback();
    return;
  }

  setTimeout(() => waitForFirebaseProfile(callback), 80);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(value) {
  if (!value) return 'Unknown date';

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown date';

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function formatMonthYear(value) {
  if (!value) return '-';

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  return date.toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric'
  });
}

function formatRelative(value) {
  if (!value) return '-';

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  const diff = Date.now() - date.getTime();
  const hour = 60 * 60 * 1000;
  const day = 24 * hour;

  if (diff < hour) return 'Less than an hour ago';
  if (diff < day) return `${Math.max(1, Math.round(diff / hour))}h ago`;
  if (diff < 7 * day) return `${Math.max(1, Math.round(diff / day))}d ago`;

  return formatDate(date);
}

function parseConfidence(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value <= 1 ? value : value / 100;
  }

  if (typeof value === 'string') {
    const numeric = Number.parseFloat(value.replace('%', ''));
    if (Number.isFinite(numeric)) {
      return numeric > 1 ? numeric / 100 : numeric;
    }
  }

  return null;
}

function parseTimestamp(raw) {
  if (!raw) return null;
  if (raw instanceof Date) return raw;
  if (typeof raw.toDate === 'function') return raw.toDate();
  if (typeof raw.seconds === 'number') return new Date(raw.seconds * 1000);
  if (typeof raw === 'number') return new Date(raw);
  if (typeof raw === 'string') {
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

function inferSeverity(label, savedSeverity) {
  const severity = String(savedSeverity || '').toLowerCase();
  if (severity === 'healthy') return 'healthy';
  if (severity === 'critical' || severity === 'severe') return 'critical';
  if (severity === 'warning' || severity === 'moderate' || severity === 'mild') return 'attention';

  const text = String(label || '').toLowerCase();
  if (!text) return 'attention';
  if (text.includes('healthy')) return 'healthy';
  if (text.includes('blight') || text.includes('rot') || text.includes('wilt') || text.includes('mildew') || text.includes('spot')) {
    return 'critical';
  }
  return 'attention';
}

function severityLabel(severity) {
  return {
    healthy: 'Healthy',
    attention: 'Needs attention',
    critical: 'Critical'
  }[severity] || 'Needs attention';
}

function severityIcon(severity) {
  return {
    healthy: 'fa-circle-check',
    attention: 'fa-triangle-exclamation',
    critical: 'fa-circle-exclamation'
  }[severity] || 'fa-triangle-exclamation';
}

function getInitials(name) {
  return String(name || 'FC')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('') || 'FC';
}

function createAvatarDataUrl(text) {
  const initials = escapeHtml(getInitials(text));
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#8cc63f" />
          <stop offset="100%" stop-color="#476d28" />
        </linearGradient>
      </defs>
      <rect width="120" height="120" rx="60" fill="url(#g)" />
      <text x="50%" y="53%" dominant-baseline="middle" text-anchor="middle"
        font-family="Arial, sans-serif" font-size="42" font-weight="700" fill="#f6f5ee">${initials}</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

const state = {
  user: null,
  profile: {},
  scans: [],
  historyFilter: 'all',
  scansLoaded: false,
  tabsReady: false,
  exportBound: false,
  settingsBound: false,
  avatarBound: false,
  logoutBound: false,
  filtersBound: false
};

function setProfileImage(src, fallbackText) {
  const avatar = document.getElementById('profile-pic');
  if (!avatar) return;
  avatar.src = src || createAvatarDataUrl(fallbackText || 'FC');
}

function activateTab(tabName) {
  const buttons = document.querySelectorAll('.tab-btn');
  const panels = document.querySelectorAll('.tab-panel');
  const indicator = document.querySelector('.tab-indicator');
  const targetButton = document.querySelector(`.tab-btn[data-tab="${tabName}"]`);

  if (!targetButton) return;

  buttons.forEach((button) => {
    const active = button.dataset.tab === tabName;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', active ? 'true' : 'false');

    if (active && indicator) {
      indicator.style.width = `${button.offsetWidth}px`;
      indicator.style.transform = `translateX(${button.offsetLeft}px)`;
    }
  });

  panels.forEach((panel) => {
    const active = panel.id === `panel-${tabName}`;
    panel.classList.toggle('active', active);
    panel.hidden = !active;
  });

  document.dispatchEvent(new CustomEvent('profile:tab-change', { detail: { tabName } }));
}
function initTabs() {
  if (state.tabsReady) return;
  state.tabsReady = true;

  const tabs = document.querySelector('.profile-tabs');
  tabs?.addEventListener('click', (event) => {
    const button = event.target.closest('.tab-btn');
    if (!button || !tabs.contains(button)) return;
    activateTab(button.dataset.tab);
  });

  const initial = document.querySelector('.tab-btn.active');
  if (initial) activateTab(initial.dataset.tab);

  window.addEventListener('resize', () => {
    const active = document.querySelector('.tab-btn.active');
    if (active) activateTab(active.dataset.tab);
  });

  document.getElementById('view-all-history')?.addEventListener('click', () => activateTab('history'));
  document.getElementById('overview-settings-btn')?.addEventListener('click', () => activateTab('settings'));
  document.getElementById('jump-to-settings')?.addEventListener('click', () => activateTab('settings'));
}

function renderIdentity() {
  const user = state.user;
  const profile = state.profile;
  const latestScan = state.scans[0];
  const displayName = profile.displayName || user?.displayName || 'Gardener';
  const bio = profile.bio?.trim() || 'Add a short note about your garden or growing focus.';
  const createdAt = user?.metadata?.creationTime ? new Date(user.metadata.creationTime) : null;

  document.getElementById('profile-name').textContent = displayName;
  document.getElementById('profile-email').textContent = user?.email || '';
  document.getElementById('profile-bio').textContent = bio;
  document.getElementById('member-since').textContent = `Member since ${formatMonthYear(createdAt)}`;
  document.getElementById('settings-member-since').textContent = formatMonthYear(createdAt);
  document.getElementById('settings-email').value = user?.email || '';
  document.getElementById('last-scan-pill').textContent = latestScan
    ? `Last scan ${formatRelative(latestScan.timestamp)}`
    : 'Last scan -';

  setProfileImage(profile.photoURL || user?.photoURL, displayName);
}

function computeSummary(scans) {
  const plantCounts = new Map();
  const diagnosisCounts = new Map();
  let healthy = 0;
  let attention = 0;
  let confidenceSum = 0;
  let confidenceCount = 0;

  scans.forEach((scan) => {
    if (scan.severity === 'healthy') healthy += 1;
    else attention += 1;

    if (scan.plantName) {
      plantCounts.set(scan.plantName, (plantCounts.get(scan.plantName) || 0) + 1);
    }

    if (scan.diagnosis) {
      diagnosisCounts.set(scan.diagnosis, (diagnosisCounts.get(scan.diagnosis) || 0) + 1);
    }

    if (typeof scan.confidence === 'number') {
      confidenceSum += scan.confidence;
      confidenceCount += 1;
    }
  });

  const topPlant = [...plantCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 'No scans yet';
  const topDiagnosis = [...diagnosisCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 'No scans yet';
  const latest = scans[0];
  const uniquePlants = plantCounts.size;
  const healthyRate = scans.length ? Math.round((healthy / scans.length) * 100) : 0;
  const averageConfidence = confidenceCount ? `${Math.round((confidenceSum / confidenceCount) * 100)}%` : '-';

  return {
    total: scans.length,
    attention,
    uniquePlants,
    healthyRate,
    topPlant,
    topDiagnosis,
    latestDiagnosis: latest ? latest.diagnosis : 'No scans yet',
    averageConfidence
  };
}

function renderSummary() {
  const summary = computeSummary(state.scans);

  document.getElementById('total-diagnoses').textContent = summary.total;
  document.getElementById('pathology-index').textContent = `${summary.healthyRate}%`;
  document.getElementById('species-count').textContent = summary.uniquePlants;
  document.getElementById('attention-count').textContent = summary.attention;
  document.getElementById('settings-total-scans').textContent = summary.total;

  document.getElementById('top-plant').textContent = summary.topPlant;
  document.getElementById('top-diagnosis').textContent = summary.topDiagnosis;
  document.getElementById('latest-diagnosis').textContent = summary.latestDiagnosis;
  document.getElementById('avg-confidence').textContent = summary.averageConfidence;
}

function renderRecent() {
  const list = document.getElementById('recent-list');
  const empty = document.getElementById('recent-empty');
  if (!list || !empty) return;

  list.innerHTML = '';

  const recent = state.scans.slice(0, 4);
  empty.style.display = recent.length ? 'none' : 'flex';
  list.style.display = recent.length ? 'grid' : 'none';

  recent.forEach((scan) => {
    const article = document.createElement('article');
    article.className = `recent-card ${scan.severity}`;
    article.innerHTML = `
      <div class="recent-top">
        <span class="status-chip ${scan.severity}">
          <i class="fas ${severityIcon(scan.severity)}"></i>
          ${severityLabel(scan.severity)}
        </span>
        <span class="recent-date">${formatDate(scan.timestamp)}</span>
      </div>
      <h3>${escapeHtml(scan.diagnosis)}</h3>
      <p>${escapeHtml(scan.plantName || 'Plant scan')}</p>
      <div class="recent-meta">
        <span>${scan.confidence != null ? `${Math.round(scan.confidence * 100)}% confidence` : 'Confidence unavailable'}</span>
        <span>${escapeHtml(scan.sourceLabel)}</span>
      </div>
    `;
    list.appendChild(article);
  });
}

function renderGarden() {
  const grid = document.getElementById('garden-grid');
  const empty = document.getElementById('garden-empty');
  if (!grid || !empty) return;

  grid.innerHTML = '';

  const grouped = new Map();
  state.scans.forEach((scan) => {
    const key = scan.plantName || 'Unlabeled plant';
    const current = grouped.get(key) || {
      plantName: key,
      total: 0,
      latest: scan,
      healthy: 0,
      attention: 0
    };

    current.total += 1;
    current.latest = scan.timestamp > current.latest.timestamp ? scan : current.latest;
    if (scan.severity === 'healthy') current.healthy += 1;
    else current.attention += 1;

    grouped.set(key, current);
  });

  const plants = [...grouped.values()].sort((a, b) => b.latest.timestamp - a.latest.timestamp);
  empty.style.display = plants.length ? 'none' : 'flex';
  grid.style.display = plants.length ? 'grid' : 'none';

  plants.forEach((plant) => {
    const card = document.createElement('article');
    card.className = 'garden-card';
    card.innerHTML = `
      <div class="garden-icon">${escapeHtml(getInitials(plant.plantName))}</div>
      <div class="garden-copy">
        <h3>${escapeHtml(plant.plantName)}</h3>
        <p>${plant.total} scan${plant.total === 1 ? '' : 's'} saved</p>
      </div>
      <div class="garden-stats">
        <span>${plant.healthy} healthy</span>
        <span>${plant.attention} flagged</span>
      </div>
    `;
    grid.appendChild(card);
  });
}
function getFilteredHistory() {
  if (state.historyFilter === 'healthy') {
    return state.scans.filter((scan) => scan.severity === 'healthy');
  }

  if (state.historyFilter === 'attention') {
    return state.scans.filter((scan) => scan.severity !== 'healthy');
  }

  return state.scans;
}

function renderHistory() {
  const list = document.getElementById('history-list');
  const empty = document.getElementById('history-empty');
  const count = document.getElementById('history-count');
  if (!list || !empty) return;

  list.innerHTML = '';

  const entries = getFilteredHistory();
  const total = state.scans.length;

  if (count) {
    if (!state.scansLoaded) {
      count.textContent = 'Loading records...';
    } else if (!total) {
      count.textContent = '0 records';
    } else if (state.historyFilter === 'all') {
      count.textContent = `${total} record${total === 1 ? '' : 's'}`;
    } else {
      count.textContent = `${entries.length} of ${total} record${total === 1 ? '' : 's'}`;
    }
  }

  empty.style.display = state.scansLoaded && !entries.length ? 'flex' : 'none';
  list.style.display = entries.length ? 'grid' : 'none';

  entries.forEach((scan) => {
    const row = document.createElement('article');
    row.className = `history-row ${scan.severity}`;
    row.innerHTML = `
      <div class="history-icon">${escapeHtml(getInitials(scan.plantName || scan.diagnosis))}</div>
      <div class="history-main">
        <div class="history-title-row">
          <h3>${escapeHtml(scan.diagnosis)}</h3>
          <span class="status-chip ${scan.severity}">
            <i class="fas ${severityIcon(scan.severity)}"></i>
            ${severityLabel(scan.severity)}
          </span>
        </div>
        <div class="history-meta">
          <span>${escapeHtml(scan.plantName || 'Plant scan')}</span>
          <span>${formatDate(scan.timestamp)}</span>
          <span>${scan.confidence != null ? `${Math.round(scan.confidence * 100)}% confidence` : 'Confidence unavailable'}</span>
          <span>${escapeHtml(scan.sourceLabel)}</span>
        </div>
      </div>
    `;
    list.appendChild(row);
  });
}

function renderAll() {
  renderIdentity();
  renderSummary();
  renderRecent();
  renderGarden();
  renderHistory();
}

function normalizeScanRecord(data, sourceLabel, idHint) {
  const diagnosis = data.disease || data.prediction || data.diagnosis?.disease || data.result || 'Diagnosis unavailable';
  const plantName = data.plantName || data.plant || data.species || data.diagnosis?.plant || 'Plant scan';
  const timestamp = parseTimestamp(data.timestamp || data.createdAt || data.scannedAt || data.date) || new Date(0);
  const confidence = parseConfidence(data.confidence);
  const severity = inferSeverity(diagnosis, data.severity);
  const sourceId = data.id || idHint || `${diagnosis}-${timestamp.getTime()}`;

  return {
    id: sourceId,
    diagnosis,
    plantName,
    confidence,
    severity,
    timestamp,
    sourceLabel
  };
}

async function fetchScansFromTopLevel(user) {
  try {
    const scansRef = window.collection(window.db, 'scans');
    const scanQuery = window.query(scansRef, window.where('userId', '==', user.uid));
    const snapshot = await window.getDocs(scanQuery);

    return snapshot.docs.map((docSnap) => normalizeScanRecord(docSnap.data(), 'scan history', docSnap.id));
  } catch (error) {
    console.warn('Top-level scan load failed:', error);
    return [];
  }
}

async function fetchLegacyPredictionScans(user) {
  try {
    const snapshot = await window.getDocs(window.collection(window.db, 'users', user.uid, 'predictions'));
    return snapshot.docs.map((docSnap) => normalizeScanRecord(docSnap.data(), 'legacy profile record', docSnap.id));
  } catch (error) {
    console.warn('Legacy scan load failed:', error);
    return [];
  }
}

async function loadScans(user) {
  state.scansLoaded = false;
  renderHistory();

  const [topLevel, legacy] = await Promise.all([
    fetchScansFromTopLevel(user),
    fetchLegacyPredictionScans(user)
  ]);

  const seen = new Set();
  const merged = [...topLevel, ...legacy].filter((scan) => {
    const key = `${scan.diagnosis}|${scan.plantName}|${scan.timestamp.getTime()}|${scan.confidence ?? 'na'}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  merged.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  state.scans = merged;
  state.scansLoaded = true;
}

async function loadProfileDoc(user) {
  try {
    const snapshot = await window.getDoc(window.doc(window.db, 'users', user.uid));
    state.profile = snapshot.exists() ? snapshot.data() : {};
  } catch (error) {
    console.warn('Profile load failed:', error);
    state.profile = {};
  }
}

function bindHistoryFilters() {
  if (state.filtersBound) return;
  state.filtersBound = true;

  document.querySelectorAll('.filter-btn').forEach((button) => {
    button.addEventListener('click', () => {
      state.historyFilter = button.dataset.filter;
      document.querySelectorAll('.filter-btn').forEach((item) => item.classList.remove('active'));
      button.classList.add('active');
      renderHistory();
    });
  });
}

async function exportScans() {
  if (!state.scans.length) {
    showToast('No scan history to export yet.', 'info');
    return;
  }

  const header = ['Plant Name', 'Diagnosis', 'Severity', 'Confidence', 'Date', 'Source'];
  const rows = state.scans.map((scan) => [
    scan.plantName,
    scan.diagnosis,
    severityLabel(scan.severity),
    scan.confidence != null ? `${Math.round(scan.confidence * 100)}%` : '',
    scan.timestamp.toISOString(),
    scan.sourceLabel
  ]);

  const csv = [header, ...rows]
    .map((row) => row.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `foliage-care-history-${Date.now()}.csv`;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);

  showToast('History exported.', 'success');
}
function initExportButtons() {
  if (state.exportBound) return;
  state.exportBound = true;

  ['export-data-btn', 'export-records', 'overview-export-btn'].forEach((id) => {
    document.getElementById(id)?.addEventListener('click', exportScans);
  });
}

function initLogoutButtons() {
  if (state.logoutBound) return;
  state.logoutBound = true;

  const handler = async () => {
    if (!window.firebaseAuth || typeof window.signOut !== 'function') {
      showToast('Sign out is still loading. Please try again.', 'info');
      return;
    }

    if (!window.confirm('Sign out of Foliage Care?')) return;

    try {
      await window.signOut(window.firebaseAuth);
      sessionStorage.removeItem('postLoginRedirect');
      window.location.href = 'login.html';
    } catch (error) {
      console.error('Sign out failed:', error);
      showToast('Unable to sign out right now.', 'error');
    }
  };

  document.getElementById('heroLogoutBtn')?.addEventListener('click', handler);
  document.getElementById('logoutBtn')?.addEventListener('click', handler);
}

function initSettings() {
  if (state.settingsBound) return;
  state.settingsBound = true;

  document.getElementById('save-settings-btn')?.addEventListener('click', async () => {
    const user = state.user;
    if (!user) return;

    const saveButton = document.getElementById('save-settings-btn');
    const displayName = document.getElementById('settings-name').value.trim();
    const bio = document.getElementById('settings-bio').value.trim();
    const language = document.getElementById('pref-language').value;

    const payload = {
      displayName,
      bio,
      preferences: {
        language
      }
    };

    try {
      if (saveButton) {
        saveButton.disabled = true;
        saveButton.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i><span>Saving...</span>';
      }

      await window.setDoc(window.doc(window.db, 'users', user.uid), payload, { merge: true });

      if (displayName && typeof window.updateProfile === 'function') {
        await window.updateProfile(user, { displayName });
      }

      state.profile = {
        ...state.profile,
        ...payload,
        preferences: {
          ...(state.profile.preferences || {}),
          language
        }
      };

      renderIdentity();
      showToast('Profile updated.', 'success');
    } catch (error) {
      console.error('Settings save failed:', error);
      showToast('Could not save profile settings.', 'error');
    } finally {
      if (saveButton) {
        saveButton.disabled = false;
        saveButton.innerHTML = '<i class="fas fa-check"></i><span>Save changes</span>';
      }
    }
  });
}

function fillSettingsForm() {
  const user = state.user;
  const profile = state.profile;

  document.getElementById('settings-name').value = profile.displayName || user?.displayName || '';
  document.getElementById('settings-bio').value = profile.bio || '';
  document.getElementById('pref-language').value = profile.preferences?.language || 'en';
}

function initAvatarUpload() {
  if (state.avatarBound) return;
  state.avatarBound = true;

  document.getElementById('avatar-upload')?.addEventListener('change', (event) => {
    const file = event.target.files?.[0];
    if (!file || !state.user) return;

    if (file.size > 2 * 1024 * 1024) {
      showToast('Profile photo must be under 2 MB.', 'error');
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = async (loadEvent) => {
      const photoURL = loadEvent.target?.result;
      if (typeof photoURL !== 'string') return;

      try {
        await window.setDoc(window.doc(window.db, 'users', state.user.uid), { photoURL }, { merge: true });
        state.profile.photoURL = photoURL;
        setProfileImage(photoURL, state.profile.displayName || state.user.displayName || 'FC');
        showToast('Profile photo updated.', 'success');
      } catch (error) {
        console.error('Avatar save failed:', error);
        showToast('Could not save profile photo.', 'error');
      } finally {
        event.target.value = '';
      }
    };

    reader.readAsDataURL(file);
  });
}

async function handleAuthenticatedUser(user) {
  state.user = user;

  await Promise.all([
    loadProfileDoc(user),
    loadScans(user)
  ]);

  fillSettingsForm();
  renderAll();
}

function bindProfileAuth() {
  initTabs();
  bindHistoryFilters();
  initExportButtons();
  initLogoutButtons();
  initSettings();
  initAvatarUpload();

  window.onAuthStateChanged(window.firebaseAuth, async (user) => {
    if (!user) {
      window.location.href = 'login.html';
      return;
    }

    try {
      await handleAuthenticatedUser(user);
    } catch (error) {
      console.error('Profile bootstrap failed:', error);
      showToast('Unable to load your profile right now.', 'error');
    }
  });
}

document.addEventListener('DOMContentLoaded', initTabs);
waitForFirebaseProfile(bindProfileAuth);
