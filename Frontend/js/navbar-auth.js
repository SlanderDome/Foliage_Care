function showResolvedNav() {
  const navLinks = document.querySelector(".nav-links");
  const skeletons = document.querySelectorAll(".nav-skeleton");
  const realItems = document.querySelectorAll(".nav-real");

  if (navLinks) {
    navLinks.style.visibility = "visible";
  }

  skeletons.forEach((item) => item.remove());
  realItems.forEach((item) => item.classList.remove("hidden"));
}

function updateAuthUi(user) {
  const authLink = document.getElementById("auth-link");
  const fullMapLink = document.getElementById("full-map-link");

  if (authLink) {
    if (user) {
      authLink.innerHTML = 'Profile <span class="deva-inline">&#2346;&#2381;&#2352;&#2379;&#2347;&#2364;&#2366;&#2311;&#2354;</span>';
      authLink.href = "profile.html";
    } else {
      authLink.innerHTML = 'Login / Signup <span class="deva-inline">&#2346;&#2381;&#2352;&#2357;&#2375;&#2358;</span>';
      authLink.href = "login.html";
    }
  }

  if (fullMapLink) {
    if (user) {
      fullMapLink.href = "profile.html";
      fullMapLink.removeAttribute("data-auth-required");
    } else {
      fullMapLink.href = "login.html?redirect=profile.html";
      fullMapLink.setAttribute("data-auth-required", "true");
    }
  }
}

function bindFullMapRedirect() {
  const fullMapLink = document.getElementById("full-map-link");
  if (!fullMapLink || fullMapLink.dataset.redirectBound === "true") return;

  fullMapLink.dataset.redirectBound = "true";
  fullMapLink.addEventListener("click", () => {
    if (fullMapLink.getAttribute("data-auth-required") !== "true") return;
    sessionStorage.setItem("postLoginRedirect", "profile.html");
  });
}

function attachAuthListener() {
  if (!window.firebaseReady || !window.firebaseAuth || !window.onAuthStateChanged) {
    return false;
  }

  try {
    window.onAuthStateChanged(window.firebaseAuth, (user) => {
      updateAuthUi(user && !user.isAnonymous ? user : null);
      showResolvedNav();
    });
    return true;
  } catch (error) {
    console.warn("Navbar auth listener failed:", error);
    return false;
  }
}

function initNavbar() {
  showResolvedNav();
  updateAuthUi(null);
  bindFullMapRedirect();

  if (attachAuthListener()) return;

  const startedAt = Date.now();
  const timer = setInterval(() => {
    if (attachAuthListener()) {
      clearInterval(timer);
      return;
    }

    if (Date.now() - startedAt > 4000) {
      clearInterval(timer);
      showResolvedNav();
    }
  }, 100);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initNavbar, { once: true });
} else {
  initNavbar();
}
