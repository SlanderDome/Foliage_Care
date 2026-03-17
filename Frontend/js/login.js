// js/login.js
console.log("login.js loaded");

// 1. Wait for firebase.js to finish loading
function waitForFirebase(cb) {
  if (window.firebaseReady && window.db) {
    cb();
  } else {
    setTimeout(() => waitForFirebase(cb), 50);
  }
}

function getPostLoginRedirect() {
  const params = new URLSearchParams(window.location.search);
  return params.get("redirect") || sessionStorage.getItem("postLoginRedirect") || "profile.html";
}

function redirectAfterLogin() {
  const target = getPostLoginRedirect();
  sessionStorage.removeItem("postLoginRedirect");
  window.location.href = target;
}

// 2. HELPER: Get User Location
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

// 3. HELPER: Save User to Firestore (Using window globals)
async function saveUserToDB(user, location, fullName = "") {
  try {
    const userRef = window.doc(window.db, "users", user.uid);
    const userSnap = await window.getDoc(userRef);

    if (!userSnap.exists()) {
      // 1. NEW USER: Create Profile
      await window.setDoc(userRef, {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || fullName || "Farmer",
        location: location || { lat: null, lng: null }, // Store initial location
        createdAt: new Date(),
        role: "user"
      });
      console.log("✅ New User saved to DB!");
    } else {
      // 2. EXISTING USER: Update Location if provided
      // This is the magic fix for your Contextual AI
      if (location && location.lat && location.lng) {
        await window.updateDoc(userRef, {
          location: location,
          lastLogin: new Date() // Useful to know when they were last active
        });
        console.log("📍 User location updated for AI Context!");
      } else {
        console.log("User exists, no new location to update.");
      }
    }
  } catch (e) {
    console.error("Error saving user:", e);
  }
}

// 4. Main Logic
waitForFirebase(() => {
  console.log("Firebase Ready - Binding Auth");

  const auth = window.firebaseAuth;
  const loginForm = document.getElementById("login-form");
  const signupForm = document.getElementById("signup-form");
  const googleBtn = document.getElementById("google-login-button");

  // --- GOOGLE LOGIN ---
  if (googleBtn) {
    googleBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      try {
        const provider = new window.GoogleAuthProvider();
        provider.setCustomParameters({ prompt: "select_account" });

        const result = await window.signInWithPopup(auth, provider);

        // Success! Get location & save
        console.log("Logged in. Getting location...");
        const location = await getUserLocation();
        await saveUserToDB(result.user, location);

        redirectAfterLogin();
      } catch (err) {
        alert("Google Login Failed: " + err.message);
      }
    });
  }

  // --- EMAIL SIGNUP ---
  if (signupForm) {
    signupForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const nameInput = signupForm.querySelector('input[type="text"]');
      const email = signupForm.querySelector('input[type="email"]').value;
      const password = signupForm.querySelector('input[type="password"]').value;

      try {
        const cred = await window.createUserWithEmailAndPassword(auth, email, password);

        // Success! Get location & save
        console.log("Account created. Getting location...");
        const location = await getUserLocation();
        await saveUserToDB(cred.user, location, nameInput ? nameInput.value : "");

        redirectAfterLogin();
      } catch (err) {
        alert("Signup Failed: " + err.message);
      }
    });
  }

  // --- EMAIL LOGIN ---
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = loginForm.querySelector('input[type="email"]').value;
      const password = loginForm.querySelector('input[type="password"]').value;

      try {
        const cred = await window.signInWithEmailAndPassword(auth, email, password);
        const location = await getUserLocation();
        await saveUserToDB(cred.user, location);
        redirectAfterLogin();
      } catch (err) {
        alert("Login Failed: " + err.message);
      }
    });
  }
});
