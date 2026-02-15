/**
 * FOLIAGE CARE — Playbook Interactivity
 * Manages the "Digital Greenhouse" ecosystem: Grid, Timeline, and Analytics.
 */

// --- RICH MOCK DATA ---
const PLAYBOOK_PLANTS = [
    {
        id: 1,
        name: "Monstera Deliciosa",
        scientificName: "Monstera deliciosa",
        added: "2024-03-15",
        health: 87,
        status: "healthy",
        img: "https://images.unsplash.com/photo-1545241047-6083a3684587?q=80&w=800&auto=format&fit=crop",
        lastAction: "Watered 2h ago",
        history: [90, 85, 82, 88, 87], // Last 5 scans
        historyLabels: ["Feb 01", "Feb 08", "Feb 15", "Feb 22", "Mar 01"],
        journal: [
            { type: "care", date: "2024-02-14", activity: "Watered", note: "Soil was dry, gave 200ml." },
            { type: "diagnosis", date: "2024-02-12", activity: "Healthy", note: "98.4% confidence. Growth looks optimal." },
            { type: "diagnosis", date: "2024-02-08", activity: "Mild Leaf Spot", icon: "issue", note: "Removed affected leaves, improved airflow." }
        ],
        care: {
            watering: "Every 7 days",
            light: "Bright Indirect",
            fertilizer: "Once a month"
        }
    },
    {
        id: 2,
        name: "Snake Plant",
        scientificName: "Dracaena trifasciata",
        added: "2023-12-05",
        health: 62,
        status: "needs-care",
        img: "https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?q=80&w=800&auto=format&fit=crop",
        lastAction: "Needs Attention",
        history: [80, 75, 70, 65, 62],
        historyLabels: ["Feb 01", "Feb 08", "Feb 15", "Feb 22", "Mar 01"],
        journal: [
            { type: "diagnosis", date: "2024-02-10", activity: "Root Stress", icon: "issue", note: "Soil remains damp too long. Check drainage." },
            { type: "care", date: "2024-01-20", activity: "Repotted", note: "Moved to a terracotta pot." }
        ],
        care: {
            watering: "Every 14-21 days",
            light: "Low to Bright Indirect",
            fertilizer: "Quarterly"
        }
    },
    {
        id: 3,
        name: "Fiddle Leaf Fig",
        scientificName: "Ficus lyrata",
        added: "2024-01-30",
        health: 94,
        status: "healthy",
        img: "https://images.unsplash.com/photo-1459411621453-7b03977f4bfc?q=80&w=800&auto=format&fit=crop",
        lastAction: "Optimal Health",
        history: [85, 88, 90, 92, 94],
        historyLabels: ["Feb 01", "Feb 08", "Feb 15", "Feb 22", "Mar 01"],
        journal: [
            { type: "milestone", date: "2024-02-28", activity: "New Growth", note: "Two new leaves sprouted today!" },
            { type: "care", date: "2024-02-15", activity: "Cleaned Leaves", note: "Wiped dust to improve photosynthesis." }
        ],
        care: {
            watering: "Every 10 days",
            light: "Bright Direct/Indirect",
            fertilizer: "Bi-monthly"
        }
    }
];

// --- CORE RENDERING ---
function renderPlantGrid(targetData = PLAYBOOK_PLANTS) {
    const grid = document.getElementById('main-plant-grid');
    if (!grid) return;

    // Add exit animation to current cards
    const currentCards = grid.querySelectorAll('.plant-card');
    currentCards.forEach(c => c.style.opacity = '0');

    setTimeout(() => {
        grid.innerHTML = targetData.map((plant, index) => `
            <article class="plant-card reveal" onclick="openPlantDetail(${plant.id})" style="animation-delay: ${index * 50}ms">
                <div class="card-image-wrap">
                    <img src="${plant.img}" alt="${plant.name}">
                    <div class="health-dot ${getHealthClass(plant.health)}"></div>
                </div>
                <div class="card-body">
                    <div class="plant-meta">
                        <div>
                            <h3>${plant.name}</h3>
                            <span class="added-date">Added: ${new Date(plant.added).toLocaleDateString()}</span>
                        </div>
                    </div>
                    <div class="h-bar-container" title="Health: ${plant.health}%">
                        <div class="h-bar-fill" style="width: ${plant.health}%; background: ${getHealthColor(plant.health)}"></div>
                    </div>
                    <div class="card-footer">
                        <span class="last-action">${plant.lastAction}</span>
                        <div class="card-btns">
                            <div class="btn-icon-sm" title="View Journal"><i class="fas fa-book"></i></div>
                            <div class="btn-icon-sm" title="Quick Scan"><i class="fas fa-camera"></i></div>
                        </div>
                    </div>
                </div>
            </article>
        `).join('') + `
            <article class="plant-card add-card" onclick="openAddPlantDialog()">
                <div class="add-content">
                    <i class="fas fa-plus-circle"></i>
                    <span>Add to Greenhouse</span>
                </div>
            </article>
        `;
    }, 300);
}

function getHealthClass(score) {
    if (score >= 85) return 'green';
    if (score >= 60) return 'yellow';
    return 'red';
}

function getHealthColor(score) {
    if (score >= 85) return 'var(--accent)';
    if (score >= 60) return '#ffd54f';
    return 'var(--ember)';
}

// --- FILTER & SEARCH ---
function initFilters() {
    const searchInput = document.getElementById('plant-search');
    const sortFilter = document.getElementById('sort-filter');
    const metricCards = document.querySelectorAll('.metric-card');

    searchInput?.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        const filtered = PLAYBOOK_PLANTS.filter(p =>
            p.name.toLowerCase().includes(query) ||
            p.scientificName.toLowerCase().includes(query)
        );
        renderPlantGrid(filtered);
    });

    sortFilter?.addEventListener('change', (e) => {
        const val = e.target.value;
        let sorted = [...PLAYBOOK_PLANTS];
        if (val === 'name') sorted.sort((a, b) => a.name.localeCompare(b.name));
        if (val === 'health') sorted.sort((a, b) => b.health - a.health);
        if (val === 'recent') sorted.sort((a, b) => new Date(b.added) - new Date(a.added));
        renderPlantGrid(sorted);
    });

    metricCards.forEach(card => {
        card.addEventListener('click', () => {
            const filter = card.dataset.filter;
            if (!filter) return;
            let filtered = PLAYBOOK_PLANTS;
            if (filter === 'healthy') filtered = PLAYBOOK_PLANTS.filter(p => p.health >= 85);
            if (filter === 'needs-care') filtered = PLAYBOOK_PLANTS.filter(p => p.health < 85);
            renderPlantGrid(filtered);
        });
    });
}

// --- MODAL & JOURNAL ---
let currentChart = null;

window.openPlantDetail = function (id) {
    const plant = PLAYBOOK_PLANTS.find(p => p.id === id);
    if (!plant) return;

    const modal = document.getElementById('plant-detail-modal');

    // Header & Meta
    document.getElementById('detail-plant-name').textContent = plant.name;
    document.getElementById('detail-plant-img').src = plant.img;
    document.getElementById('detail-plant-meta').textContent = `Added: ${new Date(plant.added).toLocaleDateString()}`;

    const badge = document.getElementById('detail-plant-status');
    badge.textContent = plant.status.replace('-', ' ').toUpperCase();
    badge.className = `status-badge ${getHealthClass(plant.health)}`;

    // Populate Timeline
    renderTimeline(plant.journal);

    // Populate Care
    renderCare(plant.care);

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Analytics Chart
    setTimeout(() => renderHealthChart(plant), 300);
}

function renderTimeline(journal) {
    const container = document.querySelector('.vertical-timeline');
    if (!container) return;

    container.innerHTML = journal.map(entry => `
        <div class="timeline-item">
            <div class="timeline-point ${entry.icon || entry.type}"></div>
            <div class="timeline-card">
                <span class="date">${entry.date}</span>
                <h4>${entry.activity}</h4>
                <p>${entry.note}</p>
            </div>
        </div>
    `).join('');
}

function renderCare(care) {
    const careList = document.querySelector('.schedule-card ul');
    if (!careList) return;
    careList.innerHTML = `
        <li><i class="fas fa-tint"></i> Watering: ${care.watering}</li>
        <li><i class="fas fa-sun"></i> Light: ${care.light}</li>
        <li><i class="fas fa-flask"></i> Fertilizer: ${care.fertilizer}</li>
    `;
}

function renderHealthChart(plant) {
    const ctx = document.getElementById('healthTrendChart');
    if (!ctx) return;

    if (currentChart) currentChart.destroy();

    currentChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: plant.historyLabels,
            datasets: [{
                data: plant.history,
                borderColor: getHealthColor(plant.health),
                backgroundColor: 'rgba(124, 179, 66, 0.1)',
                tension: 0.4,
                fill: true,
                borderWidth: 3,
                pointRadius: 6,
                pointHoverRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { min: 0, max: 100, ticks: { color: '#696960' }, grid: { color: 'rgba(255,255,255,0.05)' } },
                x: { ticks: { color: '#696960' }, grid: { display: false } }
            }
        }
    });
}

window.closePlantDetail = function () {
    const modal = document.getElementById('plant-detail-modal');
    modal.classList.remove('active');
    document.body.style.overflow = 'auto';
}

// --- TAB SWITCHING ---
window.switchTab = function (event, tabId) {
    const buttons = event.currentTarget.parentElement.querySelectorAll('.tab-btn');
    buttons.forEach(btn => btn.classList.remove('active'));
    event.currentTarget.classList.add('active');

    const contents = event.currentTarget.closest('.modal-body').querySelectorAll('.tab-content');
    contents.forEach(content => content.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
};

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
    renderPlantGrid();
    initFilters();

    // Close on backdrop click
    document.getElementById('plant-detail-modal').addEventListener('click', (e) => {
        if (e.target.id === 'plant-detail-modal') closePlantDetail();
    });
});

window.openAddPlantDialog = function () {
    alert("This feature will allow you to link a new AI scan directly to your Greenhouse journal!");
};
