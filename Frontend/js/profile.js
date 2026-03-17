// ═══════════════════════════════════════════════════
// FOLIAGE CARE — Profile Page JavaScript
// Tab system, Firebase integration, all features
// ═══════════════════════════════════════════════════

// ─── Toast System ───
function showToast(message, type = 'success') {
  const c = document.getElementById('toast-container');
  if (!c) return;
  const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', info: 'fa-info-circle' };
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i><span>${message}</span>`;
  c.appendChild(t);
  setTimeout(() => { t.classList.add('toast-exit'); t.addEventListener('animationend', () => t.remove()); }, 3500);
}

// ─── Firebase Wait ───
function waitForFirebase(cb) {
  if (window.firebaseReady && window.db) cb();
  else setTimeout(() => waitForFirebase(cb), 80);
}

let tabsInitialized = false;
let chartInitialized = false;
let climateInitialized = false;
let tipsInitialized = false;
let bookmarkInitialized = false;
let timeRangeInitialized = false;
let profileAuthBound = false;

// ═══════════════════════════════════════════════════
// TAB SYSTEM
// ═══════════════════════════════════════════════════
function initTabs() {
  if (tabsInitialized) return;
  tabsInitialized = true;

  const buttons = document.querySelectorAll('.tab-btn');
  const panels = document.querySelectorAll('.tab-panel');
  const indicator = document.querySelector('.tab-indicator');
  function activateTab(tabName) {
    buttons.forEach((btn) => {
      const isActive = btn.dataset.tab === tabName;
      btn.classList.toggle('active', isActive);
      if (isActive && indicator) {
        indicator.style.width = `${btn.offsetWidth}px`;
        indicator.style.transform = `translateX(${btn.offsetLeft}px)`;
      }
    });
    panels.forEach(p => {
      const isActive = p.id === `panel-${tabName}`;
      p.classList.toggle('active', isActive);
    });

    document.dispatchEvent(new CustomEvent('profile:tab-change', {
      detail: { tabName }
    }));
  }

  buttons.forEach(btn => {
    btn.addEventListener('click', () => activateTab(btn.dataset.tab));
  });

  // "View All" link switches to Records tab
  const viewAllLink = document.getElementById('view-all-records');
  if (viewAllLink) {
    viewAllLink.addEventListener('click', (e) => {
      e.preventDefault();
      activateTab('records');
    });
  }

  const activeButton = document.querySelector('.tab-btn.active');
  if (activeButton) activateTab(activeButton.dataset.tab);

  window.addEventListener('resize', () => {
    const current = document.querySelector('.tab-btn.active');
    if (current) activateTab(current.dataset.tab);
  });
}

// ═══════════════════════════════════════════════════
// WEATHER / CLIMATE INTELLIGENCE
// ═══════════════════════════════════════════════════
async function fetchWeather(lat, lng) {
  try {
    const data = await (await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&timezone=auto`
    )).json();
    const c = data.current;
    document.getElementById('climate-temp').textContent = `${Math.round(c.temperature_2m)}°C`;
    document.getElementById('climate-humidity').textContent = `${c.relative_humidity_2m}%`;
    document.getElementById('climate-wind').textContent = `${c.wind_speed_10m} km/h`;

    // Reverse geocode
    const geo = await (await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`
    )).json();
    document.getElementById('climate-location').textContent = `${geo.city || geo.locality || 'Your Area'}, ${geo.countryCode || ''}`;
  } catch (e) { console.error('Weather error:', e); }
}

function initClimate() {
  if (climateInitialized) return;
  climateInitialized = true;

  if (!navigator.geolocation) {
    document.getElementById('climate-location').textContent = 'Location unavailable';
    return;
  }
  navigator.geolocation.getCurrentPosition(
    pos => fetchWeather(pos.coords.latitude, pos.coords.longitude),
    () => { document.getElementById('climate-location').textContent = 'Permission denied'; },
    { enableHighAccuracy: true, timeout: 5000 }
  );
}

// ═══════════════════════════════════════════════════
// CHART.JS — Pathology Trend
// ═══════════════════════════════════════════════════
function initChart() {
  if (chartInitialized) return;
  chartInitialized = true;

  const ctx = document.getElementById('healthChart');
  if (!ctx) return;
  new Chart(ctx, {
    type: 'line',
    data: {
      labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      datasets: [
        {
          label: 'Healthy',
          data: [12, 19, 15, 25, 22, 30, 28],
          borderColor: '#7cb342',
          backgroundColor: 'rgba(124,179,66,.06)',
          borderWidth: 2.5, tension: .4, fill: true,
          pointBackgroundColor: '#7cb342', pointRadius: 3, pointHoverRadius: 6
        },
        {
          label: 'Under Observation',
          data: [5, 8, 6, 4, 8, 5, 7],
          borderColor: '#c9a84c',
          backgroundColor: 'rgba(201,168,76,.06)',
          borderWidth: 2.5, tension: .4, fill: true,
          pointBackgroundColor: '#c9a84c', pointRadius: 3, pointHoverRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#a0a090', usePointStyle: true, pointStyle: 'circle', padding: 16, font: { size: 11, family: "'DM Sans', sans-serif" } }
        },
        tooltip: {
          backgroundColor: 'rgba(8,10,8,.95)', titleColor: '#e8e6dc', bodyColor: '#a0a090',
          borderColor: 'rgba(124,179,66,.2)', borderWidth: 1, cornerRadius: 10, padding: 12
        }
      },
      scales: {
        y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,.04)' }, ticks: { color: '#696960', font: { size: 10 } } },
        x: { grid: { display: false }, ticks: { color: '#696960', font: { size: 10 } } }
      }
    }
  });
}

// ═══════════════════════════════════════════════════
// DAILY TIPS
// ═══════════════════════════════════════════════════
const TIPS = [
  { text: '"Inspect the undersides of leaves regularly — many pathogens hide there to avoid sunlight and can cause significant damage if undetected."', category: 'Observation' },
  { text: '"Water early in the morning to reduce evaporation and allow leaf surfaces to dry before evening, minimizing fungal pathology risks."', category: 'Watering' },
  { text: '"Yellowing lower leaves often indicate nitrogen deficiency. Consider a balanced fertilizer or compost amendment for recovery."', category: 'Nutrition' },
  { text: '"Rotate container plants quarterly to ensure even light exposure and balanced growth on all sides."', category: 'Care Protocol' },
  { text: '"Quarantine new plants for 2 weeks before introducing them to your collection to prevent pathogen spread."', category: 'Biosecurity' },
  { text: '"Neem oil is an effective organic solution against aphids, whiteflies, and spider mites — apply weekly as preventive."', category: 'Organic Solutions' },
  { text: '"Mulching around plants helps retain moisture, suppress weeds, and regulate soil temperature for optimal root health."', category: 'Soil Health' }
];

function initTips() {
  if (tipsInitialized) return;
  tipsInitialized = true;

  const tip = TIPS[new Date().getDay() % TIPS.length];
  const el = document.getElementById('tip-text');
  const cat = document.getElementById('tip-category');
  const dt = document.getElementById('tip-date');
  if (el) el.textContent = tip.text;
  if (cat) cat.innerHTML = `<i class="fas fa-tag"></i> ${tip.category}`;
  if (dt) dt.textContent = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function initBookmark() {
  if (bookmarkInitialized) return;
  bookmarkInitialized = true;

  const btn = document.getElementById('bookmark-tip-btn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const bookmarked = btn.classList.toggle('bookmarked');
    btn.querySelector('i').className = bookmarked ? 'fas fa-bookmark' : 'far fa-bookmark';
    showToast(bookmarked ? 'Tip bookmarked!' : 'Bookmark removed', 'info');
  });
}

// ═══════════════════════════════════════════════════
// NAME EDITING
// ═══════════════════════════════════════════════════
function initNameEdit(user) {
  const editBtn = document.getElementById('edit-name-btn');
  const displayArea = document.getElementById('name-display-area');
  const editUI = document.getElementById('edit-name-ui');
  const nameInput = document.getElementById('new-name-input');
  const saveBtn = document.getElementById('save-name-btn');
  const cancelBtn = document.getElementById('cancel-name-btn');
  const nameEl = document.getElementById('profile-name');
  if (!editBtn) return;

  editBtn.addEventListener('click', () => {
    nameInput.value = nameEl.textContent;
    displayArea.style.display = 'none';
    editUI.style.display = 'flex';
    nameInput.focus();
  });

  cancelBtn.addEventListener('click', () => {
    editUI.style.display = 'none';
    displayArea.style.display = 'flex';
  });

  saveBtn.addEventListener('click', async () => {
    const name = nameInput.value.trim();
    if (!name) { showToast('Name cannot be empty', 'error'); return; }
    try {
      await window.setDoc(window.doc(window.db, 'users', user.uid), { displayName: name }, { merge: true });
      if (window.updateProfile) await window.updateProfile(user, { displayName: name });
      nameEl.textContent = name;
      editUI.style.display = 'none';
      displayArea.style.display = 'flex';
      showToast('Name updated!', 'success');
    } catch (e) { console.error(e); showToast('Failed to update name', 'error'); }
  });

  nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveBtn.click();
    if (e.key === 'Escape') cancelBtn.click();
  });
}

// ═══════════════════════════════════════════════════
// AVATAR UPLOAD
// ═══════════════════════════════════════════════════
function initAvatar(user) {
  const input = document.getElementById('avatar-upload');
  const img = document.getElementById('profile-pic');
  if (!input) return;

  input.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { showToast('Image must be under 2MB', 'error'); return; }

    const reader = new FileReader();
    reader.onload = async (ev) => {
      img.src = ev.target.result;
      try {
        await window.setDoc(window.doc(window.db, 'users', user.uid), { photoURL: ev.target.result }, { merge: true });
        showToast('Profile photo updated!', 'success');
      } catch (err) { console.error(err); showToast('Failed to save photo', 'error'); }
    };
    reader.readAsDataURL(file);
  });
}

// ═══════════════════════════════════════════════════
// DIAGNOSIS RECORDS
// ═══════════════════════════════════════════════════
function classifyStatus(prediction) {
  if (!prediction) return 'observation';
  const p = prediction.toLowerCase();
  if (p.includes('healthy')) return 'healthy';
  if (p.includes('blight') || p.includes('rot') || p.includes('wilt') || p.includes('mold')) return 'critical';
  return 'observation';
}

function statusLabel(status) {
  return { healthy: 'Healthy', observation: 'Under Observation', critical: 'Critical' }[status] || 'Unknown';
}

function statusIcon(status) {
  return { healthy: 'fa-check-circle', observation: 'fa-exclamation-circle', critical: 'fa-times-circle' }[status] || 'fa-question-circle';
}

async function loadDiagnoses(user) {
  const listEl = document.getElementById('diagnoses-list');
  const emptyEl = document.getElementById('diagnoses-empty');
  const timelineEl = document.getElementById('records-timeline');
  const recordsEmpty = document.getElementById('records-empty');
  if (!listEl) return;

  try {
    const ref = window.collection(window.db, 'users', user.uid, 'predictions');
    const q = window.query(ref, window.orderBy('timestamp', 'desc'), window.limit(20));
    const snap = await window.getDocs(q);

    if (snap.empty) {
      if (emptyEl) emptyEl.style.display = 'block';
      if (recordsEmpty) recordsEmpty.style.display = 'block';
      return;
    }

    let healthyCount = 0, totalCount = 0;
    const species = new Set();

    snap.forEach((docSnap) => {
      const d = docSnap.data();
      const status = classifyStatus(d.prediction);
      if (status === 'healthy') healthyCount++;
      totalCount++;
      if (d.plantName) species.add(d.plantName.toLowerCase());

      const dateStr = d.timestamp
        ? new Date(d.timestamp.seconds * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : 'Unknown date';

      // Recent diagnoses (first 5 only)
      if (totalCount <= 5) {
        const item = document.createElement('div');
        item.className = 'diagnosis-item';
        item.innerHTML = `
          <div class="diagnosis-dot ${status}"><i class="fas ${statusIcon(status)}"></i></div>
          <div class="diagnosis-info">
            <span class="diagnosis-name">${d.prediction || 'Analysis pending'}</span>
            <span class="diagnosis-date">${dateStr}</span>
          </div>
          <span class="diagnosis-badge ${status}">${statusLabel(status)}</span>
        `;
        listEl.appendChild(item);
      }

      // Full records timeline
      if (timelineEl) {
        const entry = document.createElement('div');
        entry.className = `record-entry ${status}`;
        entry.innerHTML = `
          <img class="record-thumb" src="${d.imageURL || 'assets/default-plant.png'}" alt="Plant" loading="lazy">
          <div class="record-details">
            <p class="record-verdict">${d.prediction || 'Analysis pending'}</p>
            <div class="record-meta">
              <span>${dateStr}</span>
              ${d.confidence ? `<span>· ${Math.round(d.confidence * 100)}% confidence</span>` : ''}
            </div>
          </div>
          <span class="record-confidence">${statusLabel(status)}</span>
        `;
        timelineEl.appendChild(entry);
      }
    });

    // Update hero stats
    const totalEl = document.getElementById('total-diagnoses');
    const speciesEl = document.getElementById('species-count');
    const indexEl = document.getElementById('pathology-index');
    const ringFill = document.getElementById('index-ring-fill');

    if (totalEl) totalEl.textContent = totalCount;
    if (speciesEl) speciesEl.textContent = species.size || totalCount;

    const indexPercent = totalCount > 0 ? Math.round((healthyCount / totalCount) * 100) : 0;
    if (indexEl) indexEl.textContent = `${indexPercent}%`;

    // Animate the SVG ring
    if (ringFill) {
      const circumference = 2 * Math.PI * 34; // r=34
      const offset = circumference - (indexPercent / 100) * circumference;
      ringFill.style.strokeDashoffset = offset;

      // Color based on score
      if (indexPercent >= 70) ringFill.style.stroke = '#7cb342';
      else if (indexPercent >= 40) ringFill.style.stroke = '#c9a84c';
      else ringFill.style.stroke = '#c0543a';
    }

  } catch (e) {
    console.warn('Diagnoses load error:', e);
    if (emptyEl) emptyEl.style.display = 'block';
  }
}

// ═══════════════════════════════════════════════════
// MY GARDEN
// ═══════════════════════════════════════════════════
async function loadGarden(user) {
  const gridEl = document.getElementById('garden-grid');
  const emptyEl = document.getElementById('garden-empty');
  if (!gridEl) return;

  try {
    const ref = window.collection(window.db, 'users', user.uid, 'predictions');
    const q = window.query(ref, window.orderBy('timestamp', 'desc'));
    const snap = await window.getDocs(q);

    if (snap.empty) {
      if (emptyEl) emptyEl.style.display = 'block';
      return;
    }

    // Group by plant name for unique entries
    const plantMap = new Map();
    snap.forEach(docSnap => {
      const d = docSnap.data();
      const name = d.prediction || 'Unknown Plant';
      if (!plantMap.has(name)) {
        plantMap.set(name, { ...d, count: 1 });
      } else {
        plantMap.get(name).count++;
      }
    });

    plantMap.forEach((plant, name) => {
      const status = classifyStatus(name);
      const healthPercent = status === 'healthy' ? 92 : status === 'observation' ? 55 : 25;
      const card = document.createElement('div');
      card.className = 'garden-plant-card';
      card.innerHTML = `
        <img class="plant-card-image" src="${plant.imageURL || 'assets/default-plant.png'}" alt="${name}" loading="lazy">
        <div class="plant-card-body">
          <h4 class="plant-card-name">${name}</h4>
          <p class="plant-card-status">${statusLabel(status)} · ${plant.count} diagnosis${plant.count > 1 ? 'es' : ''}</p>
          <div class="plant-health-bar">
            <div class="plant-health-fill ${status === 'critical' ? 'critical' : status === 'observation' ? 'warning' : ''}" style="width: ${healthPercent}%"></div>
          </div>
        </div>
      `;
      gridEl.appendChild(card);
    });

  } catch (e) {
    console.warn('Garden load error:', e);
    if (emptyEl) emptyEl.style.display = 'block';
  }
}

// ═══════════════════════════════════════════════════
// SETTINGS — Inline Save
// ═══════════════════════════════════════════════════
function initSettings(user) {
  const saveBtn = document.getElementById('save-settings-btn');
  if (!saveBtn) return;

  // Load existing settings
  (async () => {
    try {
      const snap = await window.getDoc(window.doc(window.db, 'users', user.uid));
      if (snap.exists()) {
        const d = snap.data();
        document.getElementById('settings-name').value = d.displayName || user.displayName || '';
        document.getElementById('settings-bio').value = d.bio || '';
        if (d.preferences) {
          document.getElementById('notif-email').checked = d.preferences.emailNotif !== false;
          document.getElementById('notif-health').checked = d.preferences.healthAlerts !== false;
          if (d.preferences.language) document.getElementById('pref-language').value = d.preferences.language;
        }
      }
    } catch (e) { console.warn('Settings load:', e); }
  })();

  saveBtn.addEventListener('click', async () => {
    try {
      const payload = {
        displayName: document.getElementById('settings-name').value.trim(),
        bio: document.getElementById('settings-bio').value.trim(),
        preferences: {
          emailNotif: document.getElementById('notif-email').checked,
          healthAlerts: document.getElementById('notif-health').checked,
          language: document.getElementById('pref-language').value
        }
      };

      await window.setDoc(window.doc(window.db, 'users', user.uid), payload, { merge: true });

      // Update visible profile
      if (payload.displayName) document.getElementById('profile-name').textContent = payload.displayName;
      if (payload.bio) document.getElementById('profile-bio').textContent = payload.bio;

      showToast('Settings saved!', 'success');
    } catch (e) { console.error(e); showToast('Failed to save settings', 'error'); }
  });
}

// ═══════════════════════════════════════════════════
// EXPORT DATA
// ═══════════════════════════════════════════════════
function initExport(user) {
  const btn = document.getElementById('export-data-btn');
  const recordsBtn = document.getElementById('export-records');
  if (!btn && !recordsBtn) return;

  async function doExport() {
    try {
      const ref = window.collection(window.db, 'users', user.uid, 'predictions');
      const snap = await window.getDocs(ref);
      if (snap.empty) { showToast('No data to export', 'info'); return; }

      let csv = 'Prediction,Date,Confidence\n';
      snap.forEach(doc => {
        const d = doc.data();
        const date = d.timestamp ? new Date(d.timestamp.seconds * 1000).toISOString() : '';
        csv += `"${d.prediction || ''}","${date}","${d.confidence || ''}"\n`;
      });

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `foliage-care-records-${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Data exported!', 'success');
    } catch (e) { console.error(e); showToast('Export failed', 'error'); }
  }

  if (btn) btn.addEventListener('click', doExport);
  if (recordsBtn) recordsBtn.addEventListener('click', doExport);
}

// ═══════════════════════════════════════════════════
// TIME RANGE BUTTONS
// ═══════════════════════════════════════════════════
function initTimeRange() {
  if (timeRangeInitialized) return;
  timeRangeInitialized = true;

  document.querySelectorAll('.range-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.range-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
}

function initStaticProfileUI() {
  initTabs();
  initChart();
  initClimate();
  initTips();
  initBookmark();
  initTimeRange();
}

// ═══════════════════════════════════════════════════
// MAIN INIT
// ═══════════════════════════════════════════════════
function bindProfileAuth() {
  if (profileAuthBound) return;
  profileAuthBound = true;

  const auth = window.firebaseAuth;

  window.onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.href = 'login.html'; return; }

    // Profile identity
    document.getElementById('profile-name').textContent = user.displayName || 'Gardener';
    document.getElementById('profile-email').textContent = user.email;
    if (user.photoURL) document.getElementById('profile-pic').src = user.photoURL;

    // Member since
    if (user.metadata && user.metadata.creationTime) {
      const d = new Date(user.metadata.creationTime);
      document.getElementById('member-since').textContent =
        `Member since ${d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`;
    }

    // Load user data from Firestore
    try {
      const snap = await window.getDoc(window.doc(window.db, 'users', user.uid));
      if (snap.exists()) {
        const d = snap.data();
        if (d.displayName) document.getElementById('profile-name').textContent = d.displayName;
        if (d.bio) document.getElementById('profile-bio').textContent = d.bio;
        if (d.photoURL) document.getElementById('profile-pic').src = d.photoURL;
      }
    } catch (e) { console.warn('Profile load:', e); }

    // Initialize all features
    initStaticProfileUI();
    initNameEdit(user);
    initAvatar(user);
    initSettings(user);
    initExport(user);

    // Load data
    loadDiagnoses(user);
    loadGarden(user);

    // Logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        if (confirm('Sign out of Foliage Care?')) {
          await window.signOut(auth);
          window.location.href = 'login.html';
        }
      });
    }
  });
}

document.addEventListener('DOMContentLoaded', initStaticProfileUI);
waitForFirebase(bindProfileAuth);
