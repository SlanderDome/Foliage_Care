// js/profile.js

// 1. Helper to wait for Firebase to load
function waitForFirebase(cb) {
  if (window.firebaseReady) {
    cb();
  } else {
    setTimeout(() => waitForFirebase(cb), 50);
  }
}

// 2. Main Logic
waitForFirebase(() => {
  const auth = window.firebaseAuth;
  const db = window.db;

  // --- AUTH LISTENER ---
  window.onAuthStateChanged(auth, (user) => {
    if (!user) {
      window.location.href = "login.html"; 
      return;
    }

    console.log("✅ User Logged In:", user.email);

    // --- POPULATE PROFILE DATA ---
    const displayName = user.displayName || "Foliage User";
    
    const nameEl = document.getElementById("profile-name");
    if (nameEl) nameEl.innerText = displayName;

    // Add this line to update the welcome message too
const welcomeEl = document.getElementById("welcome-name");
if (welcomeEl) welcomeEl.innerText = displayName.split(' ')[0]; // Shows just the first name

    const emailEl = document.getElementById("profile-email");
    if (emailEl) emailEl.innerText = user.email;

    const picEl = document.getElementById("profile-pic");
    if (picEl && user.photoURL) picEl.src = user.photoURL;

    // Load History
    loadUserHistory(user.uid);
    
    // Initialize Edit Features (Pass user to function)
    initializeEditFeature(user);
  });

  // --- HISTORY LOADER ---
  async function loadUserHistory(uid) {
    const historyList = document.querySelector(".scan-history-list");
    if (!historyList) return;

    historyList.innerHTML = "<p style='text-align:center; color:#888;'>Loading history...</p>";

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
        historyList.innerHTML = "<p style='text-align:center; color:#888;'>No scans yet. Start diagnosing!</p>";
        return;
      }

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const date = data.timestamp ? data.timestamp.toDate().toLocaleDateString() : "Just now";
        const isHealthy = data.disease.toLowerCase().includes("healthy");
        const statusClass = isHealthy ? "status-healthy" : "status-risk";
        const iconClass = isHealthy ? "fa-seedling" : "fa-exclamation-triangle";

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
    } catch (error) {
      console.error("❌ Error loading history:", error);
      if (error.message && error.message.includes("requires an index")) {
          console.warn("⚠️ DATABASE INDEX MISSING: Check console link");
          historyList.innerHTML = "<p style='color:orange; text-align:center;'>Index Required (See Console)</p>";
      } else {
          historyList.innerHTML = "<p style='color:red; text-align:center;'>Could not load history.</p>";
      }
    }
  }

  // --- EDIT NAME LOGIC ---
  function initializeEditFeature(user) {
      const editBtn = document.getElementById("edit-name-btn");
      const displayArea = document.getElementById("name-display-area");
      const editArea = document.getElementById("edit-name-ui");
      const nameInput = document.getElementById("new-name-input");
      const saveBtn = document.getElementById("save-name-btn");
      const cancelBtn = document.getElementById("cancel-name-btn");

      // Debug: Check if elements exist
      if (!editBtn || !displayArea || !editArea) {
          console.error("❌ Edit elements missing from HTML. Check IDs.");
          return;
      }

      // Pre-fill input
      if(nameInput) nameInput.value = user.displayName || "";

      // 1. Pen Click -> Show Input
      // We use 'onclick' to overwrite any previous listeners to be safe
      editBtn.onclick = function() {
          console.log("✏️ Pen Clicked!");
          displayArea.style.display = "none";
          editArea.style.display = "flex";
          if(nameInput) nameInput.focus();
      };

      // 2. Cancel Click -> Hide Input
      if(cancelBtn) {
          cancelBtn.onclick = function() {
              console.log("✖️ Cancel Clicked");
              editArea.style.display = "none";
              displayArea.style.display = "flex";
              if(nameInput && document.getElementById("profile-name")) {
                  nameInput.value = document.getElementById("profile-name").innerText;
              }
          };
      }

      // 3. Save Click -> Update Firebase
      if(saveBtn) {
          saveBtn.onclick = async function() {
              console.log("💾 Save Clicked");
              const newName = nameInput.value.trim();
              if (!newName) return alert("Name cannot be empty");

              try {
                  await window.updateProfile(user, { displayName: newName });
                  
                  // Update UI
                  document.getElementById("profile-name").innerText = newName;
                  
                  // Hide Input
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

  // --- LOGOUT LOGIC ---
  const logoutBtn = document.getElementById("logoutBtn");
  if(logoutBtn) {
      logoutBtn.addEventListener("click", async () => {
        if(confirm("Are you sure you want to log out?")) {
            await window.signOut(auth);
            window.location.href = "login.html";
        }
      });
  }
});