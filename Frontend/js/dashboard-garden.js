(() => {
  const DASHBOARD_REDIRECT = "dashboard_cinematic_3.html";
  const LEGACY_PLANT_ID = "__legacy__";

  const state = {
    plants: [],
    scans: [],
    selectedPlantId: null,
    user: null,
  };

  const els = {};

  function cacheDom() {
    els.subtitle = document.getElementById("garden-subtitle");
    els.totalScans = document.getElementById("stat-total-scans");
    els.healthyRate = document.getElementById("stat-healthy-rate");
    els.totalPlants = document.getElementById("stat-total-plants");
    els.grid = document.getElementById("garden-grid");
    els.emptyState = document.getElementById("garden-empty-state");
    els.addPlantButton = document.getElementById("add-plant-button");
    els.detailTitle = document.getElementById("detail-plant-title");
    els.detailSubtitle = document.getElementById("detail-plant-subtitle");
    els.detailXAxis = document.getElementById("detail-x-axis");
    els.detailSparkline = document.getElementById("detail-sparkline");
    els.detailHistory = document.getElementById("detail-history-list");
    els.rescanButton = document.getElementById("detail-rescan-button");
    els.chatModal = document.getElementById("chat-modal");
    els.chatModalTitle = document.getElementById("chat-modal-title");
    els.chatModalMeta = document.getElementById("chat-modal-meta");
    els.chatModalBody = document.getElementById("chat-modal-body");
  }

  function waitForFirebase(callback, attempts = 0) {
    if (window.firebaseReady && window.db && window.firebaseAuth) {
      callback();
      return;
    }
    if (attempts > 80) {
      console.warn("Dashboard: Firebase never became ready.");
      return;
    }
    setTimeout(() => waitForFirebase(callback, attempts + 1), 100);
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function parseConfidence(value) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value <= 1 ? value : value / 100;
    }
    if (typeof value === "string") {
      const numeric = Number.parseFloat(value.replace("%", ""));
      if (Number.isFinite(numeric)) {
        return numeric > 1 ? numeric / 100 : numeric;
      }
    }
    return null;
  }

  function parseTimestamp(value) {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value.toDate === "function") return value.toDate();
    if (typeof value.seconds === "number") return new Date(value.seconds * 1000);
    if (typeof value === "number") return new Date(value);
    if (typeof value === "string") {
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    return null;
  }

  function getTimestampMillis(value) {
    if (!value) return 0;
    if (typeof value.toMillis === "function") return value.toMillis();
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
  }

  function formatShortDate(value) {
    const millis = getTimestampMillis(value);
    if (!millis) return "Unknown date";
    return new Date(millis).toLocaleDateString("en-IN", { month: "short", day: "numeric" });
  }

  function formatLongDate(value) {
    const millis = getTimestampMillis(value);
    if (!millis) return "Unknown date";
    return new Date(millis).toLocaleString("en-IN", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function timeAgo(value) {
    const millis = getTimestampMillis(value);
    if (!millis) return "No scans yet";
    const diffMs = Date.now() - millis;
    const diffHours = Math.max(1, Math.round(diffMs / (1000 * 60 * 60)));
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.round(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    const diffWeeks = Math.round(diffDays / 7);
    if (diffWeeks < 5) return `${diffWeeks}w ago`;
    const diffMonths = Math.round(diffDays / 30);
    return `${diffMonths}mo ago`;
  }

  function normalizePlantName(name) {
    const cleaned = String(name || "").replace(/\s+/g, " ").trim();
    return cleaned || "Plant Scan";
  }

  function plantNameKey(name) {
    return normalizePlantName(name).toLowerCase();
  }

  function isGenericPlantName(name) {
    const normalized = normalizePlantName(name).toLowerCase();
    return !normalized
      || normalized === "plant scan"
      || normalized === "unlabeled plant"
      || normalized === "recovered plant"
      || normalized === "my plant";
  }

  function makeLegacyPlantKey(name) {
    const normalized = normalizePlantName(name);
    if (isGenericPlantName(normalized)) return LEGACY_PLANT_ID;
    return `legacy::${normalized.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
  }

  function normalizeSeverity(severity, disease) {
    const value = String(severity || "").toLowerCase();
    if (value) return value;
    return String(disease || "").toLowerCase().includes("healthy") ? "healthy" : "unknown";
  }

  function severityToScore(severity) {
    const map = {
      healthy: 100,
      none: 100,
      mild: 72,
      moderate: 42,
      severe: 14,
      critical: 8,
      unknown: 55,
    };
    return map[normalizeSeverity(severity)] ?? 55;
  }

  function severityColor(severity) {
    const value = normalizeSeverity(severity);
    if (value === "healthy" || value === "none") return "#bbcbb8";
    if (value === "mild") return "#d4c06d";
    if (value === "moderate") return "#c58b58";
    if (value === "severe" || value === "critical") return "#d46a5a";
    return "#8e928b";
  }

  function severityLabel(severity) {
    const value = normalizeSeverity(severity);
    if (value === "none") return "Healthy";
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  function personaLabel(persona) {
    const map = {
      home_gardener: "Home Gardener",
      farmer: "Farmer",
      nursery: "Nursery",
      student: "Student",
      student_research: "Student",
    };
    return map[persona] || "Garden Mode";
  }

  function renderPlaceholderDetail() {
    if (els.detailTitle) els.detailTitle.textContent = "Select a plant";
    if (els.detailSubtitle) els.detailSubtitle.textContent = "Health Trend";
    if (els.detailXAxis) els.detailXAxis.innerHTML = "";
    if (els.detailSparkline) {
      els.detailSparkline.innerHTML = `
        <svg class="w-full h-full preserve-aspect-none" style="filter: drop-shadow(0px 10px 15px rgba(187,203,184,0.3));" viewBox="0 0 100 20">
          <path d="M0,10 L100,10" fill="none" stroke="rgba(196,200,192,0.25)" stroke-linecap="round" stroke-width="0.5"></path>
        </svg>
      `;
    }
    if (els.detailHistory) {
      els.detailHistory.innerHTML = `
        <div class="bg-surface-variant/20 rounded-xl p-4 border border-outline/5 text-on-surface-variant text-sm">
          Select a plant card to view its scan history and replay past conversations.
        </div>
      `;
    }
    if (els.rescanButton) {
      els.rescanButton.onclick = () => {
        window.location.href = "start.html";
      };
    }
  }

  function scanMatchesPlant(scan, plant) {
    if (!scan || !plant) return false;
    if (plant.isLegacy) return scan.gardenPlantId === plant.id;
    if (scan.plantId && scan.plantId === plant.id) return true;

    const scanName = plantNameKey(scan.plantName);
    const plantNickname = plantNameKey(plant.nickname);
    return !scan.plantId
      && !isGenericPlantName(scanName)
      && scanName === plantNickname;
  }

  function getScansForPlant(plant) {
    return state.scans.filter((scan) => scanMatchesPlant(scan, plant));
  }

  function buildLegacyPlants(unlinkedScans) {
    const grouped = new Map();
    unlinkedScans.forEach((scan) => {
      const key = scan.gardenPlantId || LEGACY_PLANT_ID;
      const bucket = grouped.get(key) || [];
      bucket.push(scan);
      grouped.set(key, bucket);
    });

    return Array.from(grouped.entries()).map(([key, scans]) => {
      const latest = scans[0];
      const fallbackName = key === LEGACY_PLANT_ID ? "Legacy Garden" : normalizePlantName(latest.plantName);
      return {
        id: key,
        nickname: fallbackName,
        species: key === LEGACY_PLANT_ID ? "Uncategorized scans" : "Imported from scan history",
        icon: key === LEGACY_PLANT_ID ? "🪴" : "🌿",
        totalScans: scans.length,
        lastStatus: normalizeSeverity(latest.severity, latest.disease),
        lastDisease: latest.disease || "Historical scan",
        lastScannedAt: latest.timestamp,
        isLegacy: true,
      };
    });
  }

  function hydratePlants(plants, scans) {
    const byId = new Map(plants.map((plant) => [plant.id, { ...plant }]));

    scans.forEach((scan) => {
      if (!scan.plantId || byId.has(scan.plantId)) return;
      byId.set(scan.plantId, {
        id: scan.plantId,
        nickname: scan.plantName || "Recovered Plant",
        species: scan.species || "",
        icon: "🌿",
        totalScans: 0,
        lastStatus: normalizeSeverity(scan.severity, scan.disease),
        lastDisease: scan.disease || "Unknown",
        lastScannedAt: scan.timestamp,
      });
    });

    const hydrated = Array.from(byId.values()).map((plant) => {
      const plantScans = scans.filter((scan) => scanMatchesPlant(scan, plant));
      const latest = plantScans[0];
      return {
        ...plant,
        totalScans: plantScans.length || plant.totalScans || 0,
        lastStatus: latest ? normalizeSeverity(latest.severity, latest.disease) : plant.lastStatus || "unknown",
        lastDisease: latest?.disease || plant.lastDisease || "No scans yet",
        lastScannedAt: latest?.timestamp || plant.lastScannedAt || null,
      };
    });

    const matchedScanIds = new Set();
    hydrated.forEach((plant) => {
      scans.forEach((scan) => {
        if (scanMatchesPlant(scan, plant)) matchedScanIds.add(scan.id);
      });
    });
    hydrated.push(...buildLegacyPlants(scans.filter((scan) => !matchedScanIds.has(scan.id))));

    hydrated.sort((a, b) => getTimestampMillis(b.lastScannedAt) - getTimestampMillis(a.lastScannedAt));
    return hydrated;
  }

  function normalizeScanDoc(docSnap, sourceType) {
    const data = docSnap.data();
    const plantName = normalizePlantName(data.plantName || data.plant || data.nickname || "");
    const timestamp = parseTimestamp(data.timestamp || data.createdAt || data.scannedAt || data.date) || new Date(0);
    const scan = {
      id: `${sourceType}-${docSnap.id}`,
      sourceType,
      plantId: data.plantId || data.gardenPlantId || data.plantDocId || data.plant_id || null,
      plantName,
      species: data.species || "",
      disease: data.disease || data.prediction || "Diagnosis unavailable",
      confidence: data.confidence || null,
      confidenceValue: parseConfidence(data.confidence),
      severity: normalizeSeverity(data.severity, data.disease || data.prediction),
      timestamp,
      persona: data.persona || "",
      chatThread: Array.isArray(data.chatThread) ? data.chatThread : [],
    };
    scan.gardenPlantId = scan.plantId || makeLegacyPlantKey(scan.plantName);
    return scan;
  }

  async function fetchTopLevelScans(user) {
    try {
      const scansQuery = window.query(
        window.collection(window.db, "scans"),
        window.where("userId", "==", user.uid)
      );
      const scansSnap = await window.getDocs(scansQuery);
      return scansSnap.docs.map((docSnap) => normalizeScanDoc(docSnap, "scan"));
    } catch (error) {
      console.warn("Dashboard top-level scan load failed:", error);
      return [];
    }
  }

  async function fetchLegacyPredictionScans(user) {
    try {
      const snapshot = await window.getDocs(window.collection(window.db, "users", user.uid, "predictions"));
      return snapshot.docs.map((docSnap) => normalizeScanDoc(docSnap, "legacy"));
    } catch (error) {
      console.warn("Dashboard legacy scan load failed:", error);
      return [];
    }
  }

  async function fetchPlants(user) {
    try {
      const plantsQuery = window.query(
        window.collection(window.db, "plants"),
        window.where("userId", "==", user.uid)
      );
      const plantsSnap = await window.getDocs(plantsQuery);
      return plantsSnap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));
    } catch (error) {
      console.warn("Dashboard plants load failed:", error);
      return [];
    }
  }

  async function loadGarden(user) {
    const [plants, topLevelScans, legacyScans] = await Promise.all([
      fetchPlants(user),
      fetchTopLevelScans(user),
      fetchLegacyPredictionScans(user),
    ]);

    const dedupe = new Set();
    const scans = [...topLevelScans, ...legacyScans]
      .filter((scan) => {
        const key = [
          scan.plantId || "",
          scan.plantName || "",
          scan.disease || "",
          getTimestampMillis(scan.timestamp),
          scan.confidence || "",
        ].join("|");
        if (dedupe.has(key)) return false;
        dedupe.add(key);
        return true;
      })
      .sort((a, b) => getTimestampMillis(b.timestamp) - getTimestampMillis(a.timestamp));

    state.plants = hydratePlants(plants, scans);
    state.scans = scans;

    const requestedPlantId = new URLSearchParams(window.location.search).get("plantId");
    const requestedExists = requestedPlantId && state.plants.some((plant) => plant.id === requestedPlantId);
    state.selectedPlantId = requestedExists
      ? requestedPlantId
      : state.selectedPlantId && state.plants.some((plant) => plant.id === state.selectedPlantId)
        ? state.selectedPlantId
        : state.plants[0]?.id || null;
  }

  function renderStats() {
    const totalScans = state.scans.length;
    const healthyCount = state.scans.filter((scan) => {
      const severity = normalizeSeverity(scan.severity, scan.disease);
      return severity === "healthy" || severity === "none";
    }).length;
    const healthyRate = totalScans ? Math.round((healthyCount / totalScans) * 100) : 0;
    const plantCount = state.plants.length;

    if (els.totalScans) els.totalScans.textContent = String(totalScans);
    if (els.healthyRate) els.healthyRate.textContent = `${healthyRate}%`;
    if (els.totalPlants) els.totalPlants.textContent = String(plantCount);

    if (els.subtitle) {
      if (!plantCount) {
        els.subtitle.textContent = "Start with a scan to begin building your garden history.";
      } else if (healthyRate >= 70) {
        els.subtitle.textContent = `You are tracking ${plantCount} plant${plantCount === 1 ? "" : "s"} and most recent scans look steady.`;
      } else {
        els.subtitle.textContent = `You are tracking ${plantCount} plant${plantCount === 1 ? "" : "s"} and a few need attention soon.`;
      }
    }
  }

  function cardBackground(icon) {
    const palette = {
      "🍅": "linear-gradient(180deg, rgba(94,24,21,0.2), rgba(14,14,12,0.92))",
      "🌹": "linear-gradient(180deg, rgba(88,32,48,0.2), rgba(14,14,12,0.92))",
      "🌵": "linear-gradient(180deg, rgba(35,78,52,0.18), rgba(14,14,12,0.92))",
      "🪴": "linear-gradient(180deg, rgba(82,57,38,0.18), rgba(14,14,12,0.92))",
    };
    return palette[icon] || "linear-gradient(180deg, rgba(47,62,41,0.18), rgba(14,14,12,0.92))";
  }

  function renderGrid() {
    if (!els.grid || !els.emptyState) return;
    if (!state.plants.length) {
      els.grid.innerHTML = "";
      els.emptyState.classList.remove("hidden");
      return;
    }

    els.emptyState.classList.add("hidden");
    els.grid.innerHTML = state.plants.map((plant) => {
      const status = severityLabel(plant.lastStatus);
      const statusColor = severityColor(plant.lastStatus);
      const selectedClass = state.selectedPlantId === plant.id ? "ring-2 ring-primary/60 scale-[1.01]" : "";
      const subtitle = plant.species || (plant.isLegacy ? "Uncategorized scans" : "Awaiting species label");
      return `
        <article class="relative aspect-[4/5] rounded-xl overflow-hidden group bg-surface-dim flex flex-col justify-end transition-transform duration-500 hover:scale-[1.02] border border-outline/10 shadow-[0_4px_30px_rgba(0,0,0,0.5)] ${selectedClass}"
          style="background:${cardBackground(plant.icon || "🌿")}" data-plant-card="${escapeHtml(plant.id)}">
          <div class="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent z-10 pointer-events-none"></div>
          <div class="absolute inset-0 opacity-60 z-0 flex items-center justify-center text-[9rem]">${escapeHtml(plant.icon || "🌿")}</div>
          <div class="relative z-20 p-6 w-full flex flex-col gap-3">
            <div>
              <h3 class="font-headline-lg text-[28px] text-on-surface leading-none mb-1">${escapeHtml(plant.nickname || "Unnamed Plant")}</h3>
              <p class="font-body-md text-[14px] text-primary font-light italic">${escapeHtml(subtitle)}</p>
            </div>
            <div class="flex justify-between items-center bg-surface-variant/40 backdrop-blur-md px-3 py-2 rounded-lg border border-outline/10">
              <div class="flex items-center gap-2">
                <div class="w-2 h-2 rounded-full shadow-[0_0_8px_rgba(197,199,194,0.8)]" style="background:${statusColor}"></div>
                <span class="font-label-sm text-[11px] text-on-surface tracking-wider">${escapeHtml(status)}</span>
              </div>
              <span class="font-label-sm text-[10px] text-on-surface-variant">${escapeHtml(String(plant.totalScans || 0))} SCANS</span>
            </div>
            <div class="font-label-sm text-[11px] text-on-surface-variant uppercase tracking-wider">Last scan: ${escapeHtml(timeAgo(plant.lastScannedAt))}</div>
            <div class="flex gap-2 mt-2">
              <button data-action="scan" data-plant-id="${escapeHtml(plant.id)}"
                class="flex-1 bg-primary-container/20 border border-primary-container/30 text-primary hover:bg-primary-container/40 backdrop-blur-md py-2.5 rounded-lg font-label-sm transition-colors text-center cursor-pointer relative z-30">Scan</button>
              <button data-action="history" data-plant-id="${escapeHtml(plant.id)}"
                class="flex-1 bg-surface-variant/40 border border-outline/20 text-on-surface hover:bg-surface-variant/60 backdrop-blur-md py-2.5 rounded-lg font-label-sm transition-colors text-center cursor-pointer relative z-30">History</button>
            </div>
          </div>
        </article>
      `;
    }).join("");

    els.grid.querySelectorAll("[data-plant-card]").forEach((card) => {
      card.addEventListener("click", (event) => {
        const action = event.target.closest("[data-action]");
        if (action) return;
        selectPlant(card.dataset.plantCard, true);
      });
    });

    els.grid.querySelectorAll('[data-action="scan"]').forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        const plantId = button.dataset.plantId;
        if (plantId && plantId !== LEGACY_PLANT_ID) {
          window.location.href = `start.html?plantId=${encodeURIComponent(plantId)}`;
        } else {
          window.location.href = "start.html";
        }
      });
    });

    els.grid.querySelectorAll('[data-action="history"]').forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        selectPlant(button.dataset.plantId, true);
      });
    });
  }

  function renderSparkline(scans) {
    if (!els.detailSparkline || !els.detailXAxis) return;
    if (!scans.length) {
      els.detailXAxis.innerHTML = "";
      els.detailSparkline.innerHTML = `
        <svg class="w-full h-full preserve-aspect-none" style="filter: drop-shadow(0px 10px 15px rgba(187,203,184,0.3));" viewBox="0 0 100 20">
          <path d="M0,10 L100,10" fill="none" stroke="rgba(196,200,192,0.25)" stroke-linecap="round" stroke-width="0.5"></path>
        </svg>
      `;
      return;
    }

    const ordered = [...scans].sort((a, b) => getTimestampMillis(a.timestamp) - getTimestampMillis(b.timestamp));
    const points = ordered.map((scan, index) => {
      const x = ordered.length === 1 ? 50 : (index / (ordered.length - 1)) * 100;
      const y = 20 - (severityToScore(scan.severity) / 100) * 18 - 1;
      return { x, y };
    });
    const polyline = points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
    const fillPoints = `0,20 ${polyline} 100,20`;
    const last = ordered[ordered.length - 1];
    const color = severityColor(last.severity);

    els.detailSparkline.innerHTML = `
      <svg class="w-full h-full preserve-aspect-none" style="filter: drop-shadow(0px 10px 15px rgba(187,203,184,0.3));" viewBox="0 0 100 20">
        <defs>
          <linearGradient id="garden-spark-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stop-color="${color}" stop-opacity="0.8"></stop>
            <stop offset="100%" stop-color="${color}" stop-opacity="0"></stop>
          </linearGradient>
        </defs>
        <path d="M0,10 L100,10" fill="none" stroke="rgba(196,200,192,0.15)" stroke-linecap="round" stroke-width="0.35"></path>
        <polygon points="${fillPoints}" fill="url(#garden-spark-fill)" opacity="0.22"></polygon>
        <polyline points="${polyline}" fill="none" stroke="${color}" stroke-linecap="round" stroke-linejoin="round" stroke-width="0.7"></polyline>
        ${points.map((point, index) => `<circle cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="${index === points.length - 1 ? 1.2 : 0.9}" fill="${color}" stroke="${index === points.length - 1 ? "#fff" : "none"}" stroke-width="0.25"></circle>`).join("")}
      </svg>
    `;

    els.detailXAxis.innerHTML = ordered.map((scan) => (
      `<span class="font-body-md text-xs font-light text-on-surface-variant/60">${escapeHtml(formatShortDate(scan.timestamp))}</span>`
    )).join("");
  }

  function renderHistory(scans) {
    if (!els.detailHistory) return;
    if (!scans.length) {
      els.detailHistory.innerHTML = `
        <div class="bg-surface-variant/20 rounded-xl p-4 border border-outline/5 text-on-surface-variant text-sm">
          No scans yet for this plant.
        </div>
      `;
      return;
    }

    els.detailHistory.innerHTML = scans.map((scan) => {
      const statusColor = severityColor(scan.severity);
      const hasThread = Array.isArray(scan.chatThread) && scan.chatThread.length > 0;
      return `
        <div class="bg-surface-variant/20 rounded-xl p-4 border border-outline/5 ${hasThread ? "hover:bg-surface-variant/35 transition-colors" : ""}">
          <div class="flex justify-between items-start mb-2">
            <span class="font-body-md text-xs text-on-surface-variant">${escapeHtml(formatShortDate(scan.timestamp))}</span>
            <div class="flex items-center gap-1.5">
              <div class="w-1.5 h-1.5 rounded-full" style="background:${statusColor}"></div>
              <span class="font-label-sm text-[10px]" style="color:${statusColor}">${escapeHtml(scan.confidence || "--")}</span>
            </div>
          </div>
          <h4 class="font-body-md text-[15px] text-on-surface leading-tight mb-3">${escapeHtml(scan.disease || "Unknown diagnosis")}</h4>
          <button ${hasThread ? "" : "disabled"}
            data-chat-scan="${escapeHtml(scan.id)}"
            class="w-full flex items-center justify-center gap-2 border border-outline/20 ${hasThread ? "text-on-surface-variant hover:text-on-surface hover:border-outline/40" : "text-on-surface-variant/50 cursor-not-allowed"} py-1.5 rounded text-xs font-label-sm transition-colors">
            <span class="material-symbols-outlined text-[14px]">chat</span> Chat Replay
          </button>
        </div>
      `;
    }).join("");

    els.detailHistory.querySelectorAll("[data-chat-scan]").forEach((button) => {
      button.addEventListener("click", () => {
        const scan = state.scans.find((item) => item.id === button.dataset.chatScan);
        if (scan) openChatReplay(scan);
      });
    });
  }

  function renderPlantDetail() {
    const plant = state.plants.find((item) => item.id === state.selectedPlantId);
    if (!plant) {
      renderPlaceholderDetail();
      return;
    }

    const scans = getScansForPlant(plant);
    if (els.detailTitle) {
      els.detailTitle.textContent = `${plant.icon || "🌿"} ${plant.nickname || "Unnamed Plant"}`;
    }
    if (els.detailSubtitle) {
      els.detailSubtitle.textContent = plant.species || (plant.isLegacy ? "Legacy scan history" : "Health Trend");
    }
    if (els.rescanButton) {
      els.rescanButton.onclick = () => {
        if (plant.id !== LEGACY_PLANT_ID) {
          window.location.href = `start.html?plantId=${encodeURIComponent(plant.id)}`;
        } else {
          window.location.href = "start.html";
        }
      };
    }

    renderSparkline(scans.slice(0, 6));
    renderHistory(scans);
  }

  function threadEntryHtml(role, text, html) {
    const safeText = escapeHtml(text || "");
    const richText = text || "";
    if (role === "user") {
      return `
        <div class="thread-entry user-entry">
          <div class="entry-meta"><div class="entry-icon"><i class="fas fa-user"></i></div><span>Field Note</span></div>
          <div class="entry-body">"${safeText}"</div>
        </div>
      `;
    }
    if (role === "diagnosis" && html) {
      return `
        <div class="thread-entry ai-entry">
          <div class="entry-meta"><div class="entry-icon">AI</div><span>Diagnosis Report</span></div>
          <div class="entry-body">${richText}</div>
          ${html}
        </div>
      `;
    }
    return `
      <div class="thread-entry ai-entry">
        <div class="entry-meta"><div class="entry-icon">AI</div><span>${role === "diagnosis" ? "Diagnosis Report" : "FoliageCare AI"}</span></div>
        <div class="entry-body">${richText}</div>
      </div>
    `;
  }

  function openChatReplay(scan) {
    if (!els.chatModal || !els.chatModalBody || !els.chatModalMeta || !els.chatModalTitle) return;
    const thread = Array.isArray(scan.chatThread) ? scan.chatThread : [];
    els.chatModalTitle.textContent = "Scan Conversation";
    els.chatModalMeta.textContent = `${formatLongDate(scan.timestamp)} · ${scan.disease || "Diagnosis"} · ${personaLabel(scan.persona)}`;
    els.chatModalBody.innerHTML = thread.length
      ? thread.map((entry) => threadEntryHtml(entry.role, entry.text, entry.html)).join("")
      : `<div class="bg-surface-variant/20 rounded-xl p-4 border border-outline/5 text-on-surface-variant text-sm">No conversation replay was saved for this scan.</div>`;
    els.chatModal.classList.remove("hidden");
  }

  function closeChatReplay() {
    if (els.chatModal) {
      els.chatModal.classList.add("hidden");
    }
  }

  function selectPlant(plantId, scrollIntoView = false) {
    state.selectedPlantId = plantId;
    renderGrid();
    renderPlantDetail();
    if (scrollIntoView) {
      document.getElementById("plant-detail-view")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function bindStaticEvents() {
    els.addPlantButton?.addEventListener("click", () => {
      window.location.href = "start.html";
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeChatReplay();
    });
  }

  function renderAll() {
    renderStats();
    renderGrid();
    renderPlantDetail();
  }

  async function bootGarden(user) {
    state.user = user;
    await loadGarden(user);
    renderAll();
  }

  function initAuthGate() {
    window.onAuthStateChanged(window.firebaseAuth, async (user) => {
      if (!user) {
        sessionStorage.setItem("postLoginRedirect", DASHBOARD_REDIRECT);
        window.location.href = `login.html?redirect=${encodeURIComponent(DASHBOARD_REDIRECT)}`;
        return;
      }
      try {
        await bootGarden(user);
      } catch (error) {
        console.error("Dashboard load failed:", error);
        if (els.subtitle) {
          els.subtitle.textContent = "We couldn't load your garden just now. Please refresh and try again.";
        }
        renderPlaceholderDetail();
      }
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    cacheDom();
    bindStaticEvents();
    renderPlaceholderDetail();
    waitForFirebase(initAuthGate);
  });
})();
