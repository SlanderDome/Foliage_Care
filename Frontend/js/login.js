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
    // Use the global window functions
    const userRef = window.doc(window.db, "users", user.uid);
    const userSnap = await window.getDoc(userRef);

    if (!userSnap.exists()) {
      await window.setDoc(userRef, {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || fullName || "Farmer",
        location: location || { lat: null, lng: null },
        createdAt: new Date(),
        role: "user"
      });
      console.log("User successfully saved to DB!");
    } else {
      console.log("User already exists in DB.");
    }
  } catch (e) {
    console.error("Database Error:", e);
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

        window.location.href = "profile.html";
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

        window.location.href = "profile.html";
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
        await window.signInWithEmailAndPassword(auth, email, password);
        window.location.href = "profile.html";
      } catch (err) {
        alert("Login Failed: " + err.message);
      }
    });
  }
});