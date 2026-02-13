// profile-enhanced.js - Enhanced Profile Page with Professional Features

// Wait for Firebase to load
function waitForFirebase(cb) {
  if (window.firebaseReady) {
    cb();
  } else {
    setTimeout(() => waitForFirebase(cb), 50);
  }
}

// Initialize Chart
let healthChart = null;

function initHealthChart() {
  const ctx = document.getElementById('healthChart');
  if (!ctx) return;

  healthChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      datasets: [
        {
          label: 'Healthy',
          data: [12, 19, 15, 25, 22, 30, 28],
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          borderWidth: 3,
          tension: 0.4,
          fill: true,
          pointBackgroundColor: '#10b981',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointRadius: 5,
          pointHoverRadius: 7
        },
        {
          label: 'At Risk',
          data: [5, 8, 6, 4, 8, 5, 7],
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          borderWidth: 3,
          tension: 0.4,
          fill: true,
          pointBackgroundColor: '#ef4444',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointRadius: 5,
          pointHoverRadius: 7
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          padding: 12,
          borderColor: 'rgba(167, 243, 208, 0.3)',
          borderWidth: 1,
          titleColor: '#a7f3d0',
          bodyColor: '#fff',
          cornerRadius: 8
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: {
            color: 'rgba(255, 255, 255, 0.05)',
            drawBorder: false
          },
          ticks: {
            color: '#737373',
            font: {
              size: 11
            }
          }
        },
        x: {
          grid: {
            display: false
          },
          ticks: {
            color: '#737373',
            font: {
              size: 11
            }
          }
        }
      },
      interaction: {
        intersect: false,
        mode: 'index'
      }
    }
  });
}

// Update chart based on time range
function updateChartData(range) {
  if (!healthChart) return;

  const weekData = {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    healthy: [12, 19, 15, 25, 22, 30, 28],
    risk: [5, 8, 6, 4, 8, 5, 7]
  };

  const monthData = {
    labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
    healthy: [65, 72, 68, 85],
    risk: [15, 12, 18, 10]
  };

  const yearData = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    healthy: [120, 150, 180, 190, 200, 220, 210, 230, 240, 250, 260, 280],
    risk: [30, 35, 28, 25, 22, 20, 25, 18, 15, 12, 10, 8]
  };

  let data = weekData;
  if (range === 'month') data = monthData;
  if (range === 'year') data = yearData;

  healthChart.data.labels = data.labels;
  healthChart.data.datasets[0].data = data.healthy;
  healthChart.data.datasets[1].data = data.risk;
  healthChart.update();
}

// Main Logic
waitForFirebase(() => {
  const auth = window.firebaseAuth;
  const db = window.db;

  // Auth Listener
  window.onAuthStateChanged(auth, (user) => {
    if (!user) {
      window.location.href = "login.html";
      return;
    }

    console.log("✅ User Logged In:", user.email);

    // Populate Profile Data
    const displayName = user.displayName || "Gardener";
    const email = user.email || "No email";

    const nameEl = document.getElementById("profile-name");
    const emailEl = document.getElementById("profile-email");
    const picEl = document.getElementById("profile-pic");

    if (nameEl) nameEl.innerText = displayName;
    if (emailEl) emailEl.innerText = email;
    if (picEl && user.photoURL) picEl.src = user.photoURL;

    // Set Member Since (use creation date or fallback)
    const memberSinceEl = document.getElementById("member-since");
    if (memberSinceEl && user.metadata.creationTime) {
      const creationDate = new Date(user.metadata.creationTime);
      const monthYear = creationDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      memberSinceEl.innerText = `Member since ${monthYear}`;
    }

    // Update Current Date
    const dateEl = document.getElementById("current-date");
    if (dateEl) {
      const options = { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' };
      dateEl.innerText = new Date().toLocaleDateString('en-US', options);
    }

    // Initialize Chart
    initHealthChart();

    // Load User History
    loadUserHistory(user.uid);

    // Initialize Features
    initializeEditFeature(user);
    initializeSettings();
    initializeTimeRangeSelector();
    initializeAvatarUpload(user);
  });

  // Load User History
  async function loadUserHistory(uid) {
    const historyList = document.querySelector(".scan-history-list");
    if (!historyList) return;

    historyList.innerHTML = "<p class='loading-text'>Loading history...</p>";

    try {
      const q = window.query(
        window.collection(db, "scans"),
        window.where("userId", "==", uid),
        window.orderBy("timestamp", "desc"),
        window.limit(5)
      );

      const querySnapshot = await window.getDocs(q);
      historyList.innerHTML = "";

      if (querySnapshot.empty) {
        historyList.innerHTML = "<p class='loading-text'>No scans yet. Start diagnosing!</p>";
        return;
      }

      let healthyCount = 0;
      let riskCount = 0;

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const date = data.timestamp ? data.timestamp.toDate().toLocaleDateString() : "Just now";
        const isHealthy = data.disease.toLowerCase().includes("healthy");
        const statusClass = isHealthy ? "status-healthy" : "status-risk";
        const iconClass = isHealthy ? "fa-check-circle" : "fa-exclamation-triangle";

        if (isHealthy) healthyCount++;
        else riskCount++;

        const itemHTML = `
          <div class="scan-item">
            <div class="scan-icon"><i class="fas ${iconClass}"></i></div>
            <div class="scan-details">
              <span class="scan-title">${data.plantName} - ${data.disease}</span>
              <span class="scan-date">${date}</span>
            </div>
            <span class="scan-status ${statusClass}">${isHealthy ? "Healthy" : "Risk"}</span>
          </div>
        `;
        historyList.innerHTML += itemHTML;
      });

      // Update summary stats
      const statHealthy = document.getElementById('stat-healthy');
      const statRisk = document.getElementById('stat-risk');
      if (statHealthy) statHealthy.innerText = healthyCount;
      if (statRisk) statRisk.innerText = riskCount;

    } catch (error) {
      console.error("❌ Error loading history:", error);
      historyList.innerHTML = "<p style='color:orange; text-align:center;'>Could not load history</p>";
    }
  }

  // Edit Name Feature
  function initializeEditFeature(user) {
    const editBtn = document.getElementById("edit-name-btn");
    const displayArea = document.getElementById("name-display-area");
    const editArea = document.getElementById("edit-name-ui");
    const nameInput = document.getElementById("new-name-input");
    const saveBtn = document.getElementById("save-name-btn");
    const cancelBtn = document.getElementById("cancel-name-btn");

    if (!editBtn || !displayArea || !editArea) return;

    if (nameInput) nameInput.value = user.displayName || "";

    editBtn.onclick = function () {
      displayArea.style.display = "none";
      editArea.style.display = "flex";
      if (nameInput) nameInput.focus();
    };

    if (cancelBtn) {
      cancelBtn.onclick = function () {
        editArea.style.display = "none";
        displayArea.style.display = "flex";
        if (nameInput) nameInput.value = document.getElementById("profile-name").innerText;
      };
    }

    if (saveBtn) {
      saveBtn.onclick = async function () {
        const newName = nameInput.value.trim();
        if (!newName) return alert("Name cannot be empty");

        try {
          await window.updateProfile(user, { displayName: newName });
          document.getElementById("profile-name").innerText = newName;
          editArea.style.display = "none";
          displayArea.style.display = "flex";
          console.log("✅ Name updated to:", newName);
        } catch (error) {
          console.error("Error updating profile:", error);
          alert("Update failed. Check console.");
        }
      };
    }
  }

  // Avatar Upload
  function initializeAvatarUpload(user) {
    const avatarInput = document.getElementById('avatar-upload');
    const avatarImg = document.getElementById('profile-pic');

    if (!avatarInput || !avatarImg) return;

    avatarInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      // Preview
      const reader = new FileReader();
      reader.onload = (e) => {
        avatarImg.src = e.target.result;
      };
      reader.readAsDataURL(file);

      // In a real app, you would upload to Firebase Storage here
      console.log("Avatar selected:", file.name);
    });
  }

  // Settings Modal
  function initializeSettings() {
    const settingsBtn = document.getElementById('settingsBtn');
    const modal = document.getElementById('settingsModal');
    const closeBtn = document.getElementById('closeSettings');
    const cancelBtn = document.getElementById('cancelSettings');
    const saveBtn = document.getElementById('saveSettings');

    if (!settingsBtn || !modal) return;

    settingsBtn.onclick = () => {
      modal.classList.add('active');
    };

    const closeModal = () => {
      modal.classList.remove('active');
    };

    if (closeBtn) closeBtn.onclick = closeModal;
    if (cancelBtn) cancelBtn.onclick = closeModal;

    modal.onclick = (e) => {
      if (e.target === modal) closeModal();
    };

    if (saveBtn) {
      saveBtn.onclick = () => {
        // Save settings logic here
        console.log("Settings saved");
        closeModal();
      };
    }
  }

  // Time Range Selector
  function initializeTimeRangeSelector() {
    const timeButtons = document.querySelectorAll('.time-btn');

    timeButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        timeButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const range = btn.dataset.range;
        updateChartData(range);
      });
    });
  }

  // Logout
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      if (confirm("Are you sure you want to sign out?")) {
        await window.signOut(auth);
        window.location.href = "login.html";
      }
    });
  }
});