// js/profile.js

function waitForFirebase(cb) {
  if (window.firebaseReady) {
    cb();
  } else {
    setTimeout(() => waitForFirebase(cb), 50);
  }
}

waitForFirebase(() => {
  const auth = window.firebaseAuth;
  const db = window.db;

  // --- AUTH STATE LISTENER ---
  window.onAuthStateChanged(auth, (user) => {
    if (!user) {
      window.location.href = "login.html"; // Redirect if not logged in
      return;
    }

    console.log("✅ User Logged In:", user.email);
    console.log("🔑 User UID:", user.uid); // Check this matches your database!

    // 1. SAFER Profile Population (Prevents Crashes)
    const displayName = user.displayName || "Foliage User";
    
    const nameEl = document.getElementById("profile-name");
    if (nameEl) nameEl.innerText = displayName;

    const emailEl = document.getElementById("profile-email");
    if (emailEl) emailEl.innerText = user.email;

    const nameInput = document.getElementById("new-name-input");
    if (nameInput) nameInput.value = displayName;

    const picEl = document.getElementById("profile-pic");
    if (picEl && user.photoURL) picEl.src = user.photoURL;

    // 2. LOAD SCAN HISTORY (This will now run!)
    loadUserHistory(user.uid);
  });

  // --- FUNCTION TO FETCH HISTORY ---
  async function loadUserHistory(uid) {
    const historyList = document.querySelector(".scan-history-list");
    if (!historyList) return; // Safety check

    historyList.innerHTML = "<p style='text-align:center; color:#888;'>Loading history...</p>";

    try {
      // Query: specific user, newest first, max 5
      const q = window.query(
        window.collection(db, "scans"),
        window.where("userId", "==", uid),
        window.orderBy("timestamp", "desc"),
        window.limit(5)
      );

      const querySnapshot = await window.getDocs(q);

      historyList.innerHTML = ""; // Clear loading text

      if (querySnapshot.empty) {
        historyList.innerHTML = "<p style='text-align:center; color:#888;'>No scans yet. Start diagnosing!</p>";
        return;
      }

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        // Convert timestamp to date safely
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
      
      // CHECK FOR INDEX ERROR
      if (error.message.includes("requires an index")) {
          // This is the link you need to click if it appears in console!
          console.warn("⚠️ CLICK THE LINK IN THE ERROR MESSAGE ABOVE TO CREATE THE INDEX");
          historyList.innerHTML = "<p style='color:orange; text-align:center;'>Database Index Required. Check Console.</p>";
      } else {
          historyList.innerHTML = "<p style='color:red; text-align:center;'>Could not load history.</p>";
      }
    }
  }

  // --- EDIT NAME LOGIC ---
  const editBtn = document.getElementById("edit-name-btn");
  if(editBtn) {
      // ... (Your existing edit logic is fine, keep it here) ...
      const displayArea = document.getElementById("name-display-area");
      const editArea = document.getElementById("edit-name-ui");
      const saveBtn = document.getElementById("save-name-btn");
      const cancelBtn = document.getElementById("cancel-name-btn");
      const nameInput = document.getElementById("new-name-input");

      editBtn.addEventListener("click", () => {
        if(displayArea) displayArea.style.display = "none";
        if(editArea) editArea.style.display = "flex";
        if(nameInput) nameInput.focus();
      });
    
      cancelBtn.addEventListener("click", () => {
        if(editArea) editArea.style.display = "none";
        if(displayArea) displayArea.style.display = "flex";
        if(nameInput) nameInput.value = document.getElementById("profile-name").innerText;
      });
    
      saveBtn.addEventListener("click", async () => {
        if(!nameInput) return;
        const newName = nameInput.value.trim();
        if (!newName) return alert("Name cannot be empty");
    
        const user = auth.currentUser;
        if (user) {
            try {
                await window.updateProfile(user, { displayName: newName });
                if(document.getElementById("profile-name")) 
                    document.getElementById("profile-name").innerText = newName;
                if(editArea) editArea.style.display = "none";
                if(displayArea) displayArea.style.display = "flex";
            } catch (error) {
                console.error("Error updating profile:", error);
                alert("Could not update name.");
            }
        }
      });
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