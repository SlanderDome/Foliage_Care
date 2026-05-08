    const SEVERITY_COLOR = {
        healthy: "#7cb342",
        warning: "#c9a84c",
        critical: "#c0543a",
    };

    const INDIA_BOUNDS = {
        minLat: 6,
        maxLat: 38.5,
        minLng: 68,
        maxLng: 98,
    };

    const INDIA_MAX_BOUNDS = [
        [INDIA_BOUNDS.minLat, INDIA_BOUNDS.minLng],
        [INDIA_BOUNDS.maxLat, INDIA_BOUNDS.maxLng],
    ];

    const mapInstances = [];

    function getSeverity(disease, confidence, savedSeverity) {
        if ((disease || "").toLowerCase().includes("healthy")) return "healthy";
        switch ((savedSeverity || "").toLowerCase()) {
            case "none":
            case "healthy":
                return "healthy";
            case "mild":
            case "moderate":
                return "warning";
            case "severe":
                return "critical";
            default:
                break;
        }
        if ((confidence || 0) >= 0.8) return "critical";
        return "warning";
    }

    function formatDisease(raw) {
        if (!raw) return "Unknown";
        const parts = raw.split("___");
        if (parts.length === 2) {
            const plant = parts[0].replace(/_/g, " ");
            const condition = parts[1].replace(/_/g, " ");
            return condition.toLowerCase() === "healthy"
                ? `${plant} (Healthy)`
                : `${plant} - ${condition}`;
        }
        return raw.replace(/_/g, " ");
    }

    function timeAgo(ms) {
        const diff = Date.now() - ms;
        const minutes = Math.floor(diff / 60000);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        return `${Math.floor(hours / 24)}d ago`;
    }

    function isRecent(ms) {
        return Date.now() - ms < 86400000;
    }

    function hasCoordinates(scan) {
        return Number.isFinite(scan.lat) && Number.isFinite(scan.lng);
    }

    function isInIndia(lat, lng) {
        return (
            lat >= INDIA_BOUNDS.minLat &&
            lat <= INDIA_BOUNDS.maxLat &&
            lng >= INDIA_BOUNDS.minLng &&
            lng <= INDIA_BOUNDS.maxLng
        );
    }

    function normalizeScan(data) {
        const lat = Number(data.latitude);
        const lng = Number(data.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng) || !isInIndia(lat, lng)) return null;

        return {
            disease: data.disease || "Unknown",
            confidence: typeof data.confidence === "number" ? data.confidence : Number(data.confidence) || 0,
            severity: data.severity || "",
            lat,
            lng,
            timestamp: data.timestamp?.toMillis?.() || Date.now(),
        };
    }

    function makeMarkerIcon(severity, recent) {
        const color = SEVERITY_COLOR[severity] || SEVERITY_COLOR.healthy;
        const size = severity === "critical" ? 14 : 11;
        const radius = size + 5;
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${radius * 2}" height="${radius * 2}" viewBox="0 0 ${radius * 2} ${radius * 2}">
            ${recent ? `<circle cx="${radius}" cy="${radius}" r="${radius - 1}" fill="${color}" opacity="0.15">
                <animate attributeName="r" from="${size / 2}" to="${radius - 1}" dur="2s" repeatCount="indefinite"/>
                <animate attributeName="opacity" from="0.4" to="0" dur="2s" repeatCount="indefinite"/>
            </circle>` : ""}
            <circle cx="${radius}" cy="${radius}" r="${size / 2}" fill="${color}" opacity="0.95"/>
            <circle cx="${radius}" cy="${radius}" r="${size / 2}" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="1"/>
        </svg>`;

        return L.divIcon({
            html: svg,
            className: "",
            iconSize: [radius * 2, radius * 2],
            iconAnchor: [radius, radius],
            popupAnchor: [0, -(radius + 4)],
        });
    }

    function makePopupHTML(scan) {
        const severity = getSeverity(scan.disease, scan.confidence, scan.severity);
        const color = SEVERITY_COLOR[severity];
        const confidence = Math.round((scan.confidence || 0) * 100);
        const label = severity.charAt(0).toUpperCase() + severity.slice(1);

        return `<div class="scan-popup">
            <div class="scan-popup-header">
                <span class="popup-severity-dot" style="background:${color};box-shadow:0 0 6px ${color}66;"></span>
                <span class="popup-disease-name">${formatDisease(scan.disease)}</span>
            </div>
            <div class="scan-popup-row"><span class="popup-label">Severity</span><span class="popup-value" style="color:${color}">${label}</span></div>
            <div class="scan-popup-row"><span class="popup-label">Confidence</span><div><div class="popup-confidence-bar"><div class="popup-confidence-fill" style="width:${confidence}%;background:${color};"></div></div></div></div>
            <div class="scan-popup-row"><span class="popup-label">Scanned</span><span class="popup-value">${timeAgo(scan.timestamp)}</span></div>
        </div>`;
    }

    function createMapInstance(ctx) {
        const mapEl = document.getElementById(ctx.mapElId);
        if (!mapEl || typeof L === "undefined" || mapEl._leaflet_id) return null;

        const map = L.map(ctx.mapElId, {
            center: ctx.center || [22.5, 78.9],
            zoom: ctx.zoom || 5,
            zoomControl: ctx.zoomControl !== false,
            attributionControl: ctx.attributionControl !== false,
            dragging: ctx.dragging !== false,
            scrollWheelZoom: ctx.scrollWheelZoom !== false,
            doubleClickZoom: ctx.doubleClickZoom !== false,
            touchZoom: ctx.touchZoom !== false,
            keyboard: ctx.keyboard !== false,
            boxZoom: ctx.boxZoom !== false,
            maxZoom: ctx.maxZoom || 16,
            minZoom: ctx.minZoom || 2,
            maxBounds: ctx.maxBounds || INDIA_MAX_BOUNDS,
            maxBoundsViscosity: ctx.maxBoundsViscosity || 1,
        });

        L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: "abcd",
            maxZoom: 19,
        }).addTo(map);

        if (ctx.zoomControl !== false && map.zoomControl) {
            map.zoomControl.setPosition("topright");
        }

        const instance = { map, markers: [], allScans: [], filter: "all", ctx };
        mapInstances.push(instance);

        if (ctx.filterContainerId) {
            const container = document.getElementById(ctx.filterContainerId) ||
                document.querySelector(`#${ctx.filterContainerId}, .${ctx.filterContainerId}`);

            if (container) {
                container.querySelectorAll(".filter-pill").forEach((pill) => {
                    pill.addEventListener("click", () => {
                        container.querySelectorAll(".filter-pill").forEach((item) => item.classList.remove("active"));
                        pill.classList.add("active");
                        instance.filter = pill.dataset.filter;
                        applyInstanceFilter(instance);
                    });
                });
            }
        }

        return instance;
    }

    function renderInstanceMarkers(instance, scans) {
        instance.markers.forEach(({ marker }) => instance.map.removeLayer(marker));
        instance.markers = [];

        scans.forEach((scan) => {
            if (!hasCoordinates(scan)) return;

            const severity = getSeverity(scan.disease, scan.confidence, scan.severity);
            const marker = L.marker([scan.lat, scan.lng], {
                icon: makeMarkerIcon(severity, isRecent(scan.timestamp)),
                title: formatDisease(scan.disease),
            });

            marker.bindPopup(makePopupHTML(scan), { maxWidth: 260, className: "foliage-popup" });
            marker.on("click", () => {
                instance.map.flyTo([scan.lat, scan.lng], Math.max(instance.map.getZoom(), 8), {
                    animate: true,
                    duration: 0.8,
                });
            });

            if (instance.filter === "all" || instance.filter === severity) {
                marker.addTo(instance.map);
            }

            instance.markers.push({ marker, severity });
        });
    }

    function applyInstanceFilter(instance) {
        instance.markers.forEach(({ marker, severity }) => {
            const shouldShow = instance.filter === "all" || instance.filter === severity;
            if (shouldShow && !instance.map.hasLayer(marker)) marker.addTo(instance.map);
            if (!shouldShow && instance.map.hasLayer(marker)) instance.map.removeLayer(marker);
        });
    }

    function populateInstanceFeed(instance, scans) {
        const feed = document.getElementById(instance.ctx.feedElId);
        if (!feed) return;

        const skeleton = feed.querySelector(".feed-skeleton, #feed-skeleton");
        if (skeleton) skeleton.remove();
        feed.innerHTML = "";

        if (!scans.length) {
            feed.innerHTML = '<div class="feed-item"><div class="feed-info"><div class="feed-disease">No community scans yet</div><div class="feed-meta"><span>Map updates as reports arrive</span></div></div></div>';
            return;
        }

        [...scans].sort((a, b) => b.timestamp - a.timestamp).forEach((scan) => {
            const severity = getSeverity(scan.disease, scan.confidence, scan.severity);
            const confidence = Math.round((scan.confidence || 0) * 100);
            const item = document.createElement("div");
            item.className = "feed-item";
            item.innerHTML = `
                <div class="feed-dot-wrapper"><div class="feed-dot ${severity} ${isRecent(scan.timestamp) ? "recent" : ""}"></div></div>
                <div class="feed-info">
                    <div class="feed-disease">${formatDisease(scan.disease)}</div>
                    <div class="feed-meta"><span>${confidence}% confidence</span><span class="feed-meta-dot"></span><span>${timeAgo(scan.timestamp)}</span></div>
                </div>`;

            item.addEventListener("click", () => {
                if (!hasCoordinates(scan)) return;
                instance.map.flyTo([scan.lat, scan.lng], 10, { animate: true, duration: 1 });
                const match = instance.markers.find((entry) => {
                    const latLng = entry.marker.getLatLng();
                    return Math.abs(latLng.lat - scan.lat) < 0.001 && Math.abs(latLng.lng - scan.lng) < 0.001;
                });
                if (match) match.marker.openPopup();
            });

            feed.appendChild(item);
        });
    }

    function animateNumber(id, target) {
        const el = document.getElementById(id);
        if (!el) return;
        const start = performance.now();
        const duration = 900;

        (function tick(now) {
            const progress = Math.min((now - start) / duration, 1);
            el.textContent = Math.round((1 - Math.pow(1 - progress, 3)) * target);
            if (progress < 1) requestAnimationFrame(tick);
        })(start);
    }

    function computeInstanceStats(instance, scans) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const totals = {
            total: scans.length,
            diseases: new Set(scans.map((scan) => scan.disease)).size,
            critical: scans.filter((scan) => getSeverity(scan.disease, scan.confidence, scan.severity) === "critical").length,
            today: scans.filter((scan) => scan.timestamp >= today.getTime()).length,
        };

        const statIds = instance.ctx.statIds || {};
        if (statIds.total) animateNumber(statIds.total, totals.total);
        if (statIds.diseases) animateNumber(statIds.diseases, totals.diseases);
        if (statIds.critical) animateNumber(statIds.critical, totals.critical);
        if (statIds.today) animateNumber(statIds.today, totals.today);

        const badge = document.getElementById(instance.ctx.badgeElId);
        if (badge) {
            badge.textContent = `${totals.total} scan${totals.total !== 1 ? "s" : ""}`;
        }
    }

    function renderInstanceTopDiseases(instance, scans) {
        const container = document.getElementById(instance.ctx.topDiseasesElId);
        if (!container) return;

        const counts = {};
        scans.forEach((scan) => {
            if ((scan.disease || "").toLowerCase().includes("healthy")) return;
            counts[scan.disease] = (counts[scan.disease] || 0) + 1;
        });

        const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 4);
        const max = sorted[0]?.[1] || 1;

        if (!sorted.length) {
            container.innerHTML = '<div class="top-disease-row"><span class="top-disease-name">No pathogen reports</span><div class="top-disease-bar-wrap"><div class="top-disease-bar" style="width:0"></div></div><span class="top-disease-count">0</span></div>';
            return;
        }

        container.innerHTML = sorted.map(([disease, count]) => `
            <div class="top-disease-row">
                <span class="top-disease-name">${formatDisease(disease)}</span>
                <div class="top-disease-bar-wrap"><div class="top-disease-bar" style="width:${Math.round((count / max) * 100)}%"></div></div>
                <span class="top-disease-count">${count}</span>
            </div>
        `).join("");

        requestAnimationFrame(() => {
            container.querySelectorAll(".top-disease-bar").forEach((bar) => {
                const width = bar.style.width;
                bar.style.width = "0";
                requestAnimationFrame(() => {
                    bar.style.transition = "width 1s cubic-bezier(.16,1,.3,1)";
                    bar.style.width = width;
                });
            });
        });
    }

    function setInstanceData(instance, scans) {
        instance.allScans = scans;
        renderInstanceMarkers(instance, scans);
        populateInstanceFeed(instance, scans);
        computeInstanceStats(instance, scans);
        renderInstanceTopDiseases(instance, scans);

        const emptyState = document.getElementById("map-empty-state");
        if (emptyState && instance.ctx.mapElId === "leaflet-map") {
            emptyState.style.display = scans.length === 0 ? "flex" : "none";
        }
    }

    function waitForFirebase(timeout = 4000) {
        return new Promise((resolve) => {
            if (window.firebaseReady && window.db) {
                resolve();
                return;
            }

            const startedAt = Date.now();
            const interval = setInterval(() => {
                if (window.firebaseReady && window.db) {
                    clearInterval(interval);
                    resolve();
                } else if (Date.now() - startedAt > timeout) {
                    clearInterval(interval);
                    resolve();
                }
            }, 80);
        });
    }

    async function subscribeToScans(onUpdate) {
        try {
            await waitForFirebase();
            const { db, onSnapshot, getDocs, collection, orderBy, query, limit } = window;
            const scansQuery = db && collection && orderBy && query && limit
                ? query(collection(db, "community_scans"), orderBy("timestamp", "desc"), limit(200))
                : null;

            if (scansQuery && onSnapshot) {
                return onSnapshot(
                    scansQuery,
                    (snapshot) => {
                        const scans = snapshot.docs
                            .map((doc) => normalizeScan(doc.data()))
                            .filter(Boolean);
                        onUpdate(scans);
                    },
                    (error) => {
                        console.warn("Realtime community scan subscription failed:", error);
                        onUpdate([]);
                    }
                );
            }

            if (scansQuery && getDocs) {
                const result = await getDocs(scansQuery);
                const scans = result.docs
                    .map((doc) => normalizeScan(doc.data()))
                    .filter(Boolean);
                onUpdate(scans);
                return () => {};
            }
        } catch (error) {
            console.warn("Firebase read failed for community scans:", error);
        }

        onUpdate([]);
        return () => {};
    }

    async function bootInstance(instance) {
        setInstanceData(instance, []);
        instance.unsubscribe = await subscribeToScans((scans) => {
            setInstanceData(instance, scans);
        });
    }

    function invalidateProfileMap() {
        mapInstances.forEach((instance) => {
            if (instance.ctx.mapElId === "profile-leaflet-map") {
                setTimeout(() => instance.map.invalidateSize(), 100);
            }
        });
    }

    document.addEventListener("DOMContentLoaded", async function () {
        const homeMap = document.getElementById("home-map");
        if (homeMap) {
            const instance = createMapInstance({
                mapElId: "home-map",
                statIds: { total: "peek-total", diseases: "peek-diseases" },
                center: [22.5, 78.9],
                zoom: 5,
                minZoom: 4,
                maxBounds: INDIA_MAX_BOUNDS,
                zoomControl: false,
                attributionControl: false,
                dragging: false,
                scrollWheelZoom: false,
                doubleClickZoom: false,
                touchZoom: false,
                keyboard: false,
                boxZoom: false,
            });

            if (instance) {
                await bootInstance(instance);
                setTimeout(() => instance.map.invalidateSize(), 200);
                setTimeout(() => instance.map.invalidateSize(), 800);
            }
        }

        const standaloneMap = document.getElementById("leaflet-map");
        if (standaloneMap) {
            const instance = createMapInstance({
                mapElId: "leaflet-map",
                feedElId: "sidebar-feed",
                badgeElId: "scan-count-badge",
                topDiseasesElId: "top-diseases",
                filterContainerId: "map-filters",
                statIds: { total: "stat-total", diseases: "stat-diseases", critical: "stat-critical", today: "stat-today" },
                center: [22.5, 78.9],
                zoom: 5,
                minZoom: 4,
                maxBounds: INDIA_MAX_BOUNDS,
            });

            if (instance) await bootInstance(instance);
        }

        const profileMap = document.getElementById("profile-leaflet-map");
        if (profileMap) {
            let profileMapBooted = false;

            async function bootProfileMap() {
                if (profileMapBooted) {
                    invalidateProfileMap();
                    return;
                }

                profileMapBooted = true;
                setTimeout(async () => {
                    const instance = createMapInstance({
                        mapElId: "profile-leaflet-map",
                        feedElId: "intel-feed",
                        badgeElId: "intel-badge",
                        topDiseasesElId: "intel-top-diseases",
                        filterContainerId: "profile-map-filters",
                        statIds: { total: "intel-total", diseases: "intel-diseases", critical: "intel-critical", today: "intel-today" },
                        center: [22.5, 78.9],
                        zoom: 5,
                        minZoom: 4,
                        maxBounds: INDIA_MAX_BOUNDS,
                    });

                    if (instance) {
                        await bootInstance(instance);
                        instance.map.invalidateSize();
                        setTimeout(() => instance.map.invalidateSize(), 500);
                    }
                }, 150);
            }

            const tabButton = document.querySelector('.tab-btn[data-tab="intel-map"]');
            if (tabButton) {
                tabButton.addEventListener("click", bootProfileMap);
            }

            document.addEventListener("profile:tab-change", (event) => {
                if (event.detail?.tabName === "intel-map") {
                    bootProfileMap();
                }
            });
        }
    });
