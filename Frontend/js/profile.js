// profile-enhanced.js - Enhanced Profile Page with Auto-Location Fix

// Wait for Firebase to load
function waitForFirebase(cb) {
  if (window.firebaseReady && window.db) {
    cb();
  } else {
    setTimeout(() => waitForFirebase(cb), 50);
  }
}

// ---------------------------------------
// HELPER: GET LOCATION (Added this to Profile)
// ---------------------------------------
function getUserLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      console.warn("Geolocation not supported");
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        });
      },
      (err) => {
        console.warn("Location denied:", err.message);
        resolve(null);
      },
      { enableHighAccuracy: true, timeout: 5000 }
    );
  });
}

// ---------------------------------------
// WEATHER LOGIC (Open-Meteo API)
// ---------------------------------------
async function fetchWeather(lat, lng) {
  if (!lat || !lng) {
    document.querySelector('.climate-location').innerText = "Location denied";
    return;
  }

  try {
    // 1. Fetch Weather
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,wind_speed_10m&daily=weather_code&timezone=auto`;
    const response = await fetch(url);
    const data = await response.json();

    const temp = Math.round(data.current.temperature_2m);
    const humidity = data.current.relative_humidity_2m;
    const wind = data.current.wind_speed_10m;
    const weatherCode = data.current.weather_code;

    // 2. Update UI
    document.getElementById('climate-temp').innerText = `${temp}°C`;
    document.getElementById('climate-humidity').innerText = `${humidity}%`;
    document.getElementById('climate-wind').innerText = `${wind}km/h`;

    // 3. Reverse Geocoding for City Name
    const geoUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`;
    const geoRes = await fetch(geoUrl);
    const geoData = await geoRes.json();

    const locationName = geoData.city || geoData.locality || "Your Field";
    const countryCode = geoData.countryCode || "";
    document.querySelector('.climate-location').innerText = `${locationName}, ${countryCode}`;

    // 4. Update Icon
    const iconEl = document.querySelector('.climate-icon i');
    iconEl.className = 'fas';
    if (weatherCode === 0) iconEl.classList.add('fa-sun');
    else if (weatherCode <= 3) iconEl.classList.add('fa-cloud-sun');
    else if (weatherCode <= 67) iconEl.classList.add('fa-cloud-rain');
    else if (weatherCode >= 71) iconEl.classList.add('fa-snowflake');
    else iconEl.classList.add('fa-cloud');

  } catch (error) {
    console.error("Weather Error:", error);
  }
}

// 
// CHART LOGIC
// ---------------------------------------
function initHealthChart() {
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
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          borderWidth: 3,
          tension: 0.4,
          fill: true
        },
        {
          label: 'At Risk',
          data: [5, 8, 6, 4, 8, 5, 7],
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          borderWidth: 3,
          tension: 0.4,
          fill: true
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, grid: { color: 'rgba(255, 255, 255, 0.05)' } },
        x: { grid: { display: false } }
      }
    }
  });
}

// ---------------------------------------
// MAIN LOGIC
// ---------------------------------------
waitForFirebase(() => {
  const auth = window.firebaseAuth;
  const db = window.db;

  window.onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = "login.html";
      return;
    }

    console.log("✅ User Logged In:", user.email);

    // 1. Basic Profile Info
    document.getElementById("profile-name").innerText = user.displayName || "Gardener";
    document.getElementById("profile-email").innerText = user.email;
    if (user.photoURL) document.getElementById("profile-pic").src = user.photoURL;

    // 2. LOCATION HANDLING (The Fix)
    try {
      const userRef = window.doc(db, "users", user.uid);
      const userSnap = await window.getDoc(userRef);

      if (userSnap.exists()) {
        const userData = userSnap.data();

        // CASE A: Location exists in DB -> Use it
        if (userData.location && userData.location.lat) {
          console.log("📍 Location found in DB.");
          fetchWeather(userData.location.lat, userData.location.lng);
        }
        // CASE B: Location missing -> Get it now & Save it
        else {
          console.log("⚠️ Location missing. Auto-fixing...");
          document.querySelector('.climate-location').innerText = "Locating...";

          const newLoc = await getUserLocation();

          if (newLoc) {
            // Save to DB so we don't ask next time
            await window.setDoc(userRef, { location: newLoc }, { merge: true });
            console.log("✅ Location saved to DB.");

            // Show Weather
            fetchWeather(newLoc.lat, newLoc.lng);
          } else {
            document.querySelector('.climate-location').innerText = "Permission Denied";
          }
        }
      }
    } catch (e) {
      console.error("Profile Error:", e);
    }

    // 3. Init Other Features
    const dateEl = document.getElementById("current-date");
    if (dateEl) {
      dateEl.innerText = new Date().toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
      });
    }

    initHealthChart();

    // Logout Handler
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", async () => {
        if (confirm("Sign out?")) {
          await window.signOut(auth);
          window.location.href = "login.html";
        }
      });
    }
  });
});