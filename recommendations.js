// recommendations.js

const API_CONFIG = {
    baseUrl: 'http://localhost:8000', 
    endpoints: {
        readings: '/api/readings',
        recommend: '/recommend_meal',
        feedback: '/submit_feedback' 
    }
};

// Global array to track foods currently displayed (for the dislike checklist)
let currentRecommendedFoods = [];

const userId = localStorage.getItem('user_id');
if (!userId) {
    alert("Please log in.");
    window.location.href = "login.html";
}

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Auto-load based on history
    await loadDailyPlanFromHistory();
    
    // 2. Setup Manual Form
    const manualForm = document.getElementById('manualRecForm');
    if (manualForm) {
        manualForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const val = parseFloat(document.getElementById('manualSugar').value);
            const context = document.getElementById('manualContext').value;
            if (val) {
                updateContextBadge(`Manual Entry: ${val} mg/dL`);
                window.scrollTo({ top: 0, behavior: 'smooth' });
                await generateFullDayPlan(val, context);
            }
        });
    }

    // 3. Setup General App Feedback System (The Modal)
    setupGeneralFeedbackModal();
});

async function loadDailyPlanFromHistory() {
    try {
        setLoadingState();
        const response = await fetch(`${API_CONFIG.baseUrl}${API_CONFIG.endpoints.readings}?user_id=${userId}&limit=1`);
        if (!response.ok) throw new Error("Failed to fetch history");
        const data = await response.json();

        if (data && data.length > 0) {
            const reading = data[0];
            const val = reading.value;
            const contextStr = reading.meal_context || "";
            const isFasting = contextStr.toLowerCase().includes('before');
            const type = isFasting ? 'fasting' : 'random';

            updateContextBadge(`${val} mg/dL (${contextStr})`);
            await generateFullDayPlan(val, type);
        } else {
            updateContextBadge("No recent data found");
            showEmptyState();
        }
    } catch (error) {
        console.error("Error loading plan:", error);
        updateContextBadge("Error loading data");
    }
}

async function generateFullDayPlan(sugarValue, type) {
    setLoadingState();
    
    // Reset global food tracker
    currentRecommendedFoods = [];

    // 1. Prepare Query Params
    const queryParam = type === 'fasting' ? `fbs_level=${sugarValue}` : `rbs_level=${sugarValue}`;
    const meals = ['breakfast', 'lunch', 'dinner'];
    
    try {
        const promises = meals.map(meal => 
            fetch(`${API_CONFIG.baseUrl}${API_CONFIG.endpoints.recommend}?${queryParam}&meal_type=${meal}&num_alternatives_per_slot=1&user_id=${userId}`)
                .then(res => {
                    if (!res.ok) throw new Error(`Failed to fetch ${meal}`);
                    return res.json();
                })
        );

        const results = await Promise.all(promises);

        // 2. Extract Tip
        if (results[0] && results[0].tip) {
            updateInsightCard(results[0].tip, sugarValue);
        }

        // 3. Render Meals (Populates currentRecommendedFoods)
        renderMealList('rec-breakfast', results[0].recommendations);
        renderMealList('rec-lunch', results[1].recommendations);
        renderMealList('rec-dinner', results[2].recommendations);
        
        // 4. SHOW THE NEW FEEDBACK SECTION
        showInlineFeedbackSection();

    } catch (error) {
        console.error("Error generating plan:", error);
        alert("Could not generate meal plan. Please check your server connection.");
    }
}

function renderMealList(elementId, foodItems) {
    const list = document.getElementById(elementId);
    if (!list) return;
    
    list.innerHTML = ''; 

    if (!foodItems || foodItems.length === 0) {
        list.innerHTML = '<li style="padding:10px; color:#718096;">No specific recommendations.</li>';
        return;
    }

    foodItems.forEach(item => {
        // 1. Extract the Name
        let foodName = "Unknown Item";
        let nutrients = { calories: '-', carbs: '-', fiber: '-' };
        
        if (typeof item === 'object' && item !== null) {
            foodName = item.name;
            nutrients = item.nutrients || nutrients;
        } else if (typeof item === 'string') {
            foodName = item.replace(/[\[\]"']/g, '');
        }

        // 2. Track for Feedback (CRITICAL FOR CHECKBOXES)
        currentRecommendedFoods.push(foodName);

        // 3. Create the HTML Structure
        const li = document.createElement('li');
        li.style.padding = '0.75rem 0';
        li.style.borderBottom = '1px solid #f0f0f0';
        li.style.listStyle = 'none';

        let nutrientText = "";
        if (nutrients.calories !== '-') {
            nutrientText = `
                <div style="font-size: 0.8rem; color: #718096; margin-top: 4px;">
                    <i class="fas fa-fire-alt" style="font-size:0.7rem;"></i> ${nutrients.calories} kcal  &nbsp;•&nbsp; 
                    Carbs: ${nutrients.carbs}g  &nbsp;•&nbsp; 
                    Fiber: ${nutrients.fiber}g
                </div>
            `;
        }

        li.innerHTML = `
            <div style="display:flex; flex-direction:column;">
                <div style="font-weight: 600; color: var(--text-primary); font-size: 1rem;">
                    <i class="fas fa-check-circle" style="color:var(--success-color); margin-right:8px;"></i>
                    ${foodName}
                </div>
                <div style="padding-left: 28px;">
                    ${nutrientText}
                </div>
            </div>
        `;
        
        list.appendChild(li);
    });
}

// --- INLINE FEEDBACK LOGIC (With Loading Spinners) ---

function showInlineFeedbackSection() {
    const section = document.getElementById('recommendation-feedback');
    if (section) {
        section.style.display = 'block';
        // Reset state
        document.getElementById('feedback-buttons').style.display = 'flex';
        document.getElementById('dislike-form').style.display = 'none';
        document.getElementById('feedback-thankyou').style.display = 'none';
    }
}

// These must be attached to window so HTML onclick="..." can find them
window.handleFeedback = async function(type, btnElement) {
    if (type === 'like') {
        // --- ADDED LOADING EFFECT FOR LIKE BUTTON ---
        // If the button element was passed (via `this`), use it. Otherwise, find it.
        const likeBtn = btnElement || document.querySelector('.btn-success');
        const originalContent = likeBtn ? likeBtn.innerHTML : 'Like';
        
        if(likeBtn) {
            likeBtn.disabled = true;
            likeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
        }

        try {
            await fetch(`${API_CONFIG.baseUrl}${API_CONFIG.endpoints.feedback}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: userId,
                    rating: 5,
                    liked_food: true,
                    feedback_text: "User accepted daily menu"
                })
            });
            
            document.getElementById('feedback-buttons').style.display = 'none';
            document.getElementById('feedback-thankyou').style.display = 'block';
        } catch (error) {
            console.error("Feedback error", error);
            // Revert button if error
            if(likeBtn) {
                likeBtn.disabled = false;
                likeBtn.innerHTML = originalContent;
            }
        }
    } else if (type === 'dislike') {
        // Populate Checkboxes
        const container = document.getElementById('dislike-options');
        container.innerHTML = ''; 

        const uniqueFoods = [...new Set(currentRecommendedFoods)].filter(f => f);
        
        uniqueFoods.forEach(food => {
            const label = document.createElement('label');
            label.className = 'dislike-label';
            label.innerHTML = `
                <input type="checkbox" value="${food}" class="checkbox-input">
                <span>${food}</span>
            `;
            container.appendChild(label);
        });

        // Show Form
        document.getElementById('feedback-buttons').style.display = 'none';
        document.getElementById('dislike-form').style.display = 'block';
    }
};

window.submitDislike = async function() {
    const checkboxes = document.querySelectorAll('.checkbox-input:checked');
    const dislikedItems = Array.from(checkboxes).map(cb => cb.value).join(', ');
    const reason = document.getElementById('dislike-reason').value;

    if (!dislikedItems && !reason) {
        alert("Please select a food or enter a reason.");
        return;
    }

    // --- ADDED LOADING EFFECT FOR DISLIKE SUBMIT ---
    // Try to find the button inside the form. 
    // We assume it's the only button or has a specific class.
    const submitBtn = document.querySelector('#dislike-form button');
    let originalText = "Submit";
    
    if (submitBtn) {
        originalText = submitBtn.innerHTML;
        submitBtn.disabled = true;
        // The spinning icon!
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
    }

    try {
        await fetch(`${API_CONFIG.baseUrl}${API_CONFIG.endpoints.feedback}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: userId,
                rating: 1,
                liked_food: false,
                disliked_items: dislikedItems,
                feedback_text: reason
            })
        });

        document.getElementById('dislike-form').style.display = 'none';
        document.getElementById('feedback-thankyou').style.display = 'block';
        document.getElementById('feedback-thankyou').innerHTML = '<i class="fas fa-check-circle"></i> Got it! We will avoid those foods next time.';

    } catch (error) {
        console.error("Error submitting dislike", error);
        alert("Something went wrong submitting feedback.");
        
        // Revert button if error
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        }
    }
};

// --- HELPER FUNCTIONS ---

function updateContextBadge(text) {
    const badge = document.getElementById('contextBadge');
    if (badge) badge.innerHTML = `<i class="fas fa-wave-square"></i> Based on reading: <strong>${text}</strong>`;
}

function setLoadingState() {
    const ids = ['rec-breakfast', 'rec-lunch', 'rec-dinner'];
    const skeletonHTML = `<li><div class="skeleton-text"></div></li><li><div class="skeleton-text short"></div></li><li><div class="skeleton-text"></div></li>`;
    ids.forEach(id => {
        const el = document.getElementById(id);
        if(el) el.innerHTML = skeletonHTML;
    });
    // Hide feedback while loading
    const feedback = document.getElementById('recommendation-feedback');
    if(feedback) feedback.style.display = 'none';
}

function showEmptyState() {
    toggleManualForm(); 
    const badge = document.getElementById('contextBadge');
    if (badge) badge.innerHTML = `<i class="fas fa-exclamation-circle"></i> No data. Please enter a reading below.`;
    ['rec-breakfast', 'rec-lunch', 'rec-dinner'].forEach(id => {
        document.getElementById(id).innerHTML = '<li>No data available.</li>';
    });
}

function updateInsightCard(tip, sugarVal) {
    const text = document.getElementById('insightText');
    const card = document.getElementById('insightCard');
    const icon = document.getElementById('insightIcon');
    
    if (text) text.innerHTML = tip; 
    
    if (card && icon) {
        card.className = 'insight-card'; 
        // Remove old classes
        card.classList.remove('warning', 'danger', 'success');
        
        if (sugarVal > 180) {
            card.classList.add('warning');
            icon.className = 'fas fa-exclamation-triangle';
        } else if (sugarVal < 70) {
            card.classList.add('danger');
            icon.className = 'fas fa-bolt';
        } else {
            card.classList.add('success');
            icon.className = 'fas fa-check-circle';
        }
    }
}

// --- GENERAL FEEDBACK MODAL (Bottom Right Bubble) ---

function setupGeneralFeedbackModal() {
    const modal = document.getElementById('feedbackModal');
    const trigger = document.getElementById('feedbackTrigger');
    const closeBtn = document.getElementById('closeFeedbackModal');
    const form = document.getElementById('feedbackForm');
    const stars = document.querySelectorAll('#ratingStars i');
    const ratingInput = document.getElementById('ratingValue');

    if(trigger) trigger.onclick = () => modal.style.display = 'flex';
    if(closeBtn) closeBtn.onclick = () => modal.style.display = 'none';
    window.onclick = (event) => { if (event.target === modal) modal.style.display = 'none'; };

    stars.forEach(star => {
        star.addEventListener('click', function() {
            const val = this.getAttribute('data-value');
            if(ratingInput) ratingInput.value = val;
            stars.forEach(s => {
                if(s.getAttribute('data-value') <= val) s.classList.add('active');
                else s.classList.remove('active');
            });
        });
    });

    if(form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            // --- ADDED LOADING EFFECT FOR GENERAL FEEDBACK ---
            const btn = document.getElementById('feedbackSubmitBtn');
            const originalText = btn.innerText;
            
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...'; 
            btn.disabled = true;

            const payload = {
                user_id: userId,
                rating: parseInt(ratingInput.value) || 0,
                feedback_text: document.getElementById('feedbackText').value,
                contact_email: document.getElementById('feedbackEmail').value
            };

            try {
                const res = await fetch(`${API_CONFIG.baseUrl}${API_CONFIG.endpoints.feedback}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                
                if(res.ok) {
                    alert("Thank you for your feedback!");
                    modal.style.display = 'none';
                    form.reset();
                    stars.forEach(s => s.classList.remove('active'));
                } else {
                    throw new Error('Failed');
                }
            } catch (error) {
                alert("Failed to send feedback. Please try again.");
            } finally {
                btn.innerText = originalText; btn.disabled = false;
            }
        });
    }
}