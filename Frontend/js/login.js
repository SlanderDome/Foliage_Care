console.log("login.js loaded");

function waitForFirebase(cb) {
  if (window.firebaseReady) {
    cb();
  } else {
    setTimeout(() => waitForFirebase(cb), 50);
  }
}

waitForFirebase(() => {
  console.log("Firebase is ready – binding auth logic");

  const auth = window.firebaseAuth;

  const loginForm = document.getElementById("login");
  const signupForm = document.getElementById("signup");
  const googleBtn = document.getElementById("google-login-button");

  // -----------------------------
  // GOOGLE LOGIN (FIXED FOR GOOD)
  // -----------------------------
  if (googleBtn) {
    googleBtn.addEventListener("click", async (e) => {
      e.preventDefault();

      console.log("Google button clicked");

      try {
        const provider = new window.GoogleAuthProvider();
        provider.setCustomParameters({ prompt: "select_account" });

        const result = await window.signInWithPopup(auth, provider);
        console.log("Google login success:", result.user);
        alert("Google Login SUCCESS");
        window.location.href = "profile.html";
;
      } catch (err) {
        console.error("Google login failed:", err.code, err.message);
        alert(err.code);
      }
    });
  }

  // -----------------------------
  // LOGIN
  // -----------------------------
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = loginForm.querySelector('input[type="email"]').value;
      const password = loginForm.querySelector('input[type="password"]').value;
      await window.signInWithEmailAndPassword(auth, email, password);
      window.location.href = "profile.html";
    });
  }

  // -----------------------------
  // SIGNUP
  // -----------------------------
  if (signupForm) {
    signupForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = signupForm.querySelector('input[type="email"]').value;
      const password = signupForm.querySelector('input[type="password"]').value;
      await window.createUserWithEmailAndPassword(auth, email, password);
    });
  }
  //window.location.href = "index.html";

});
