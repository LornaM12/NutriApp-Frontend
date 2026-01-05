// Check if user is logged in
const userId = localStorage.getItem('user_id');
if (!userId) {
    alert("Please log in first.");
    window.location.href = "login.html";
}

// Configuration for API endpoints
const API_CONFIG = {
    // For local deployment
    //baseUrl: 'http://localhost:8000', 

    // Live deployment
    baseUrl: "https://nutriapp-backend-mnnq.onrender.com",

    endpoints: {
        sugarReadings: '/api/sugar-readings',
        waterIntake: '/api/water-intake',
        exercise: '/api/exercise',
        getReadings: '/api/readings',
        getDashboardData: '/api/dashboard-data'
    }
};

// Global variables
let currentModal = null;
let sugarTrendChart = null;
let weeklyChart = null;

// --- API Helper ---
async function makeAPICall(endpoint, method = 'GET', data = null) {
    const url = `${API_CONFIG.baseUrl}${endpoint}`;
    const options = {
        method: method,
        headers: { 'Content-Type': 'application/json' }
    };
    if (data && method !== 'GET') options.body = JSON.stringify(data);
    try {
        const response = await fetch(url, options);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error('API call failed:', error);
        // Optional: showNotification('Connection error', 'error');
        throw error;
    }
}

// --- Data Loading ---
async function loadDashboardData() {
    try {
        const userId = localStorage.getItem("user_id");
        const data = await makeAPICall(`${API_CONFIG.endpoints.getDashboardData}?user_id=${userId}`);
        updateDashboardUI(data);
    } catch (error) {
        console.error("Error loading dashboard:", error);
        loadFallbackData();
    }
}

async function loadRecentReadings() {
    try {
        const userId = localStorage.getItem("user_id");
        const readings = await makeAPICall(`${API_CONFIG.endpoints.getReadings}?user_id=${userId}&limit=5`);
        updateRecentReadingsList(readings);
    } catch (error) {
        updateRecentReadingsList([]);
    }
}

function populateDashboard(userData) {
    document.querySelector(".user-name").textContent = userData.username || "User";
    document.querySelector(".welcome-title").textContent = `Good morning, ${userData.username || "User"}!`;
}

// --- UI Updates ---
function updateDashboardUI(data) {
    // 1. Current Reading & Status
    if (data.currentReading) {
        const val = data.currentReading.value;
        const mainEl = document.getElementById('mainSugarReading');
        const statusEl = document.getElementById('statusIndicator');
        const quickEl = document.getElementById('currentReading');

        if (quickEl) quickEl.textContent = val;

        if (mainEl) {
            const colorClass = getReadingColor(val);
            mainEl.innerHTML = `${val}<span class="sugar-unit">mg/dL</span>`;
            mainEl.style.color = `var(--${colorClass}-color)`;
            
            let statusText = 'Normal';
            let statusIcon = 'fa-check-circle';
            let statusCss = 'status-normal';
            
            if (val < 70) { statusText = 'Low'; statusIcon = 'fa-arrow-down'; statusCss = 'status-warning'; }
            else if (val > 180) { statusText = 'High'; statusIcon = 'fa-exclamation-circle'; statusCss = 'status-danger'; }

            statusEl.className = `status-indicator ${statusCss}`;
            statusEl.innerHTML = `<i class="fas ${statusIcon}"></i> ${statusText}`;
        }
    }

    // --- NEW: Update "In Range" Percentage Text ---
    if (data.chartData && data.chartData.weeklyOverview && data.chartData.weeklyOverview.data) {
        const weeklyData = data.chartData.weeklyOverview.data;
        const inRangeEl = document.getElementById('inRangeValue');
        
        if (inRangeEl) {
            // Calculate total to see if we have data
            const total = weeklyData.reduce((a, b) => a + b, 0);
            
            if (total === 0) {
                inRangeEl.textContent = "--%";
            } else {
                // The API sends [Range, High, Low], so Index 0 is Range
                inRangeEl.textContent = `${weeklyData[0]}%`;
            }
        }
    }

    // 2. Update Progress Bars
    if (data.todaysGoals) {
        updateProgressBar('readings', data.todaysGoals.readings);
        updateProgressBar('water', data.todaysGoals.water);
        updateProgressBar('exercise', data.todaysGoals.exercise);
    }

    // 3. Update Charts
    if (data.chartData) {
        updateCharts(data.chartData);
    }
}

    

function updateProgressBar(type, data) {
    const barId = `${type}ProgressBar`;
    const textId = `${type}Progress`;
    const bar = document.getElementById(barId);
    const text = document.getElementById(textId);

    if (bar && text && data) {
        const pct = Math.min((data.current / data.target) * 100, 100);
        bar.style.width = `${pct}%`;
        text.textContent = `${data.current}/${data.target} ${data.unit}`;
    }
}

function updateRecentReadingsList(readings) {
    const list = document.getElementById('recentReadingsList');
    if (!list) return;
    
    if (!readings || readings.length === 0) {
        list.innerHTML = `<div class="reading-item"><span>No readings yet</span><span>--</span></div>`;
        return;
    }

    list.innerHTML = readings.map(r => {
        const date = new Date(r.timestamp);
        const timeStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
        const color = getReadingColor(r.value);
        return `
            <div class="reading-item">
                <span class="reading-time">${timeStr}</span>
                <span class="reading-value" style="color: var(--${color}-color); font-weight:bold;">
                    ${r.value} mg/dL
                </span>
            </div>
        `;
    }).join('');
}

function getReadingColor(val) {
    if (val < 70) return 'warning';
    if (val > 180) return 'error';
    return 'success';
}

// --- CHART LOGIC ---

async function initCharts() {
    // Destroy old instances if they exist (prevents hover glitches)
    if (sugarTrendChart) sugarTrendChart.destroy();
    if (weeklyChart) weeklyChart.destroy();

    const ctx1 = document.getElementById('sugarTrendChart')?.getContext('2d');
    const ctx2 = document.getElementById('weeklyChart')?.getContext('2d');

    if (ctx1) {
        sugarTrendChart = new Chart(ctx1, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Blood Sugar',
                    data: [],
                    borderColor: '#FF8C42',
                    backgroundColor: 'rgba(255, 140, 66, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: false }, x: { grid: { display: false } } }
            }
        });
    }

    if (ctx2) {
        weeklyChart = new Chart(ctx2, {
            type: 'doughnut',
            data: {
                labels: ['No Data'],
                datasets: [{
                    data: [1],
                    backgroundColor: ['#E2E8F0'],
                    borderWidth: 0,
                    cutout: '70%'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom', labels: { usePointStyle: true, padding: 20 } },
                    tooltip: { enabled: false }
                }
            }
        });
    }
}

function updateCharts(chartData) {
    // Update Sugar Trend
    if (sugarTrendChart && chartData.sugarTrend) {
        sugarTrendChart.data.labels = chartData.sugarTrend.labels;
        sugarTrendChart.data.datasets[0].data = chartData.sugarTrend.values;
        sugarTrendChart.update();
    }

    // Update Weekly Overview
    if (weeklyChart && chartData.weeklyOverview) {
        const rawData = chartData.weeklyOverview.data; // Expecting [Range, High, Low]
        const total = rawData.reduce((a,b) => a+b, 0);

        if (total === 0) {
            // Empty State
            weeklyChart.data.datasets[0].data = [1];
            weeklyChart.data.datasets[0].backgroundColor = ['#E2E8F0'];
            weeklyChart.data.labels = ['No Data'];
            weeklyChart.options.plugins.tooltip.enabled = false;
        } else {
            // Data State
            weeklyChart.data.datasets[0].data = rawData;
            // API Order is [Range, High, Low] -> Map to [Green, Red, Yellow]
            weeklyChart.data.datasets[0].backgroundColor = ['#48BB78', '#E53E3E', '#ECC94B'];
            weeklyChart.data.labels = ['In Range', 'High', 'Low'];
            weeklyChart.options.plugins.tooltip.enabled = true;
        }
        weeklyChart.update();
    }
}

function loadFallbackData() {
    // In case API fails completely
    updateDashboardUI({
        currentReading: { value: '--' },
        todaysGoals: { 
            readings: { current:0, target:4, unit:'' },
            water: { current:0, target:8, unit:'cups' },
            exercise: { current:0, target:30, unit:'min' }
        },
        chartData: {
            sugarTrend: { labels: [], values: [] },
            weeklyOverview: { data: [0,0,0] }
        }
    });
}

// --- Modals & Forms ---

function openModal(type) {
    const map = { 'sugar': 'sugarModal', 'water': 'waterModal', 'exercise': 'exerciseModal' };
    const id = map[type];
    if (id) {
        document.getElementById(id).style.display = 'flex';
        currentModal = id;
        
        // Set current time
        const now = new Date();
        const iso = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
        const timeInput = document.getElementById(type + 'Time');
        if (timeInput) timeInput.value = iso;
    }
}

function closeModal() {
    if (currentModal) {
        document.getElementById(currentModal).style.display = 'none';
        currentModal = null;
        // Reset buttons
        document.querySelectorAll('.btn-primary').forEach(b => {
            b.disabled = false;
            if(b.innerText === 'Saving...') b.innerText = 'Save';
        });
    }
}

// Form Listeners
function setupForms() {
    document.getElementById('sugarForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('sugarSubmitBtn');
        btn.innerText = 'Saving...'; btn.disabled = true;

        const data = {
            value: parseFloat(document.getElementById('sugarReading').value),
            timestamp: document.getElementById('sugarTime').value,
            meal_context: document.getElementById('mealType').value,
            user_id: userId
        };

        try {
            await makeAPICall(API_CONFIG.endpoints.sugarReadings, 'POST', data);
            closeModal();
            await loadDashboardData();
            await loadRecentReadings();
        } catch (e) { alert("Failed to save reading"); }
        btn.innerText = 'Save'; btn.disabled = false;
    });

    document.getElementById('waterForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('waterSubmitBtn');
        btn.innerText = 'Saving...'; btn.disabled = true;

        const data = {
            amount: parseFloat(document.getElementById('waterAmount').value),
            unit: document.getElementById('waterUnit').value,
            timestamp: document.getElementById('waterTime').value,
            user_id: userId
        };

        try {
            await makeAPICall(API_CONFIG.endpoints.waterIntake, 'POST', data);
            closeModal();
            await loadDashboardData();
        } catch (e) { alert("Failed to save water"); }
        btn.innerText = 'Save'; btn.disabled = false;
    });

    document.getElementById('exerciseForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('exerciseSubmitBtn');
        btn.innerText = 'Saving...'; btn.disabled = true;

        const data = {
            exercise_type: document.getElementById('exerciseType').value,
            duration_minutes: parseInt(document.getElementById('exerciseDuration').value),
            intensity: document.getElementById('exerciseIntensity').value,
            timestamp: document.getElementById('exerciseTime').value,
            user_id: userId
        };

        try {
            await makeAPICall(API_CONFIG.endpoints.exercise, 'POST', data);
            closeModal();
            await loadDashboardData();
        } catch (e) { alert("Failed to save exercise"); }
        btn.innerText = 'Save'; btn.disabled = false;
    });
}

// Close modals on outside click
document.querySelectorAll('.modal-overlay').forEach(m => {
    m.addEventListener('click', (e) => { if (e.target === m) closeModal(); });
});

// --- Initialization ---
document.addEventListener('DOMContentLoaded', async function() {
    const userData = JSON.parse(localStorage.getItem("userData"));
    if (userData) populateDashboard(userData);

    await initCharts(); // Create empty charts first
    setupForms();       // Attach event listeners
    await loadDashboardData(); // Fetch real data
    await loadRecentReadings();
});