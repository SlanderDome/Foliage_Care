function waitForFirebase(cb) {
  if (window.firebaseReady) cb();
  else setTimeout(() => waitForFirebase(cb), 50);
}

waitForFirebase(() => {
  const auth = window.firebaseAuth;
  const authLink = document.getElementById("auth-link");

  const skeletons = document.querySelectorAll(".nav-skeleton");
  const realItems = document.querySelectorAll(".nav-real");

  window.onAuthStateChanged(auth, (user) => {
    if (user) {
      authLink.textContent = "Profile";
      authLink.href = "profile.html";
    } else {
      authLink.textContent = "Login / Signup";
      authLink.href = "login.html";
    }
document.querySelector(".nav-links").style.visibility = "visible";

    // Remove skeletons
    skeletons.forEach(s => s.remove());

    // Show real nav
    realItems.forEach(i => i.classList.remove("hidden"));
  });
});
