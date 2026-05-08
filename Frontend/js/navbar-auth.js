const NAVBAR_MIN_SKELETON_MS = 250;
const NAVBAR_AUTH_TIMEOUT_MS = 4000;

function estimateSkeletonWidth(item) {
  const anchor = item.querySelector("a");
  const label = (anchor ? anchor.textContent : item.textContent).replace(/\s+/g, " ").trim();
  const width = Math.max(56, Math.min(148, 24 + label.length * 6));
  return `${width}px`;
}

function ensureSkeletonSlots() {
  const navLinks = document.querySelector(".nav-links");
  const realItems = Array.from(document.querySelectorAll(".nav-real"));

  if (!navLinks || realItems.length === 0) return;

  const skeletons = Array.from(navLinks.querySelectorAll(".nav-skeleton"));
  const targetCount = realItems.length;

  if (skeletons.length < targetCount) {
    const insertBefore = realItems[0];
    for (let i = skeletons.length; i < targetCount; i += 1) {
      const li = document.createElement("li");
      li.className = "nav-skeleton";
      li.setAttribute("aria-hidden", "true");
      navLinks.insertBefore(li, insertBefore);
      skeletons.push(li);
    }
  } else if (skeletons.length > targetCount) {
    skeletons.slice(targetCount).forEach((item) => item.remove());
  }

  Array.from(navLinks.querySelectorAll(".nav-skeleton")).forEach((item, index) => {
    const sourceItem = realItems[index];
    item.style.width = estimateSkeletonWidth(sourceItem);
  });
}

function showLoadingNav() {
  const navLinks = document.querySelector(".nav-links");
  const realItems = document.querySelectorAll(".nav-real");

  ensureSkeletonSlots();

  if (navLinks) {
    navLinks.style.visibility = "visible";
    navLinks.setAttribute("aria-busy", "true");
  }

  realItems.forEach((item) => item.classList.add("hidden"));
}

function showResolvedNav() {
  const navLinks = document.querySelector(".nav-links");
  const skeletons = document.querySelectorAll(".nav-skeleton");
  const realItems = document.querySelectorAll(".nav-real");

  if (navLinks) {
    navLinks.style.visibility = "visible";
    navLinks.setAttribute("aria-busy", "false");
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

function attachAuthListener(onResolved) {
  if (!window.firebaseReady || !window.firebaseAuth || !window.onAuthStateChanged) {
    return false;
  }

  try {
    window.onAuthStateChanged(window.firebaseAuth, (user) => {
      updateAuthUi(user && !user.isAnonymous ? user : null);
      onResolved();
    });
    return true;
  } catch (error) {
    console.warn("Navbar auth listener failed:", error);
    return false;
  }
}

function initNavbar() {
  const startedAt = Date.now();
  let hasResolved = false;

  function resolveNav() {
    if (hasResolved) return;
    hasResolved = true;
    const elapsed = Date.now() - startedAt;
    const remaining = Math.max(0, NAVBAR_MIN_SKELETON_MS - elapsed);
    window.setTimeout(showResolvedNav, remaining);
  }

  showLoadingNav();
  updateAuthUi(null);
  bindFullMapRedirect();

  if (attachAuthListener(resolveNav)) return;

  const timer = setInterval(() => {
    if (attachAuthListener(resolveNav)) {
      clearInterval(timer);
      return;
    }

    if (Date.now() - startedAt > NAVBAR_AUTH_TIMEOUT_MS) {
      clearInterval(timer);
      resolveNav();
    }
  }, 100);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initNavbar, { once: true });
} else {
  initNavbar();
}
