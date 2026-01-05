document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Content Loaded - script.js is running.');

    // --- API Configuration ---
    // For local testing:
    //const API_BASE_URL = "http://127.0.0.1:8000";
    // For live deployment:
    const API_BASE_URL = "https://nutriapp-backend-mnnq.onrender.com";

    // --- Recommendation Form Elements ---
    const fbsLevelInput = document.getElementById('fbs_level');
    const rbsLevelInput = document.getElementById('rbs_level');
    const mealTypeSelect = document.getElementById('meal_type');
    const numAlternativesInput = document.getElementById('num_alternatives');
    const recommendationForm = document.getElementById('recommendationForm');
    const recommendationsOutput = document.getElementById('recommendationsOutput');
    const loadingMessage = document.getElementById('loadingMessage');
    const errorMessage = document.getElementById('errorMessage');
    const noRecommendationsMessage = document.getElementById('noRecommendationsMessage');

    // --- Input mode radio buttons ---
    const manualModeRadio = document.getElementById('manual_mode');
    const latestModeRadio = document.getElementById('latest_mode');
    const manualInputsDiv = document.getElementById('manualInputs');

    // --- Latest Readings Selection Elements ---
    const latestReadingsSection = document.getElementById('latestReadingsSection');
    const loadingReadings = document.getElementById('loadingReadings');
    const noReadingsMessage = document.getElementById('noReadingsMessage');
    const readingsList = document.getElementById('readingsList');

    // --- Latest Readings State ---
    let selectedReading = null;
    let allReadings = [];

    // --- Feedback Form Elements ---
    const feedbackForm = document.getElementById('feedbackForm');
    const ratingStarsContainer = document.getElementById('ratingStars');
    const ratingInput = document.getElementById('rating');
    const feedbackTextInput = document.getElementById('feedback_text');
    const contactEmailInput = document.getElementById('contact_email');
    const feedbackMessage = document.getElementById('feedbackMessage');
    const feedbackErrorMessage = document.getElementById('feedbackErrorMessage');

    // --- Feedback Modal Elements ---
    const feedbackTrigger = document.getElementById('feedbackTrigger');
    const feedbackModal = document.getElementById('feedbackModal');
    const closeFeedbackModal = document.getElementById('closeFeedbackModal');

    // --- Helper Functions ---
    
    /**
     * Format timestamp to readable date
     */
    function formatTimestamp(timestamp) {
        const date = new Date(timestamp);
        const options = { 
            month: 'short', 
            day: 'numeric', 
            year: 'numeric',
            hour: '2-digit', 
            minute: '2-digit'
        };
        return date.toLocaleDateString('en-US', options);
    }

    /**
     * Fetch latest readings from API
     */
    async function fetchLatestReadings() {
        const userId = localStorage.getItem('user_id');
        if (!userId) {
            noReadingsMessage.textContent = 'Please log in to view your readings.';
            loadingReadings.style.display = 'none';
            noReadingsMessage.style.display = 'block';
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/api/Loggedsugar-readings?user_id=${userId}&limit=3`);
            if (!response.ok) throw new Error('Failed to fetch readings');
            
            const readings = await response.json();
            allReadings = readings;
            
            loadingReadings.style.display = 'none';
            
            if (readings.length === 0) {
                noReadingsMessage.style.display = 'block';
                return;
            }

            displayReadings(readings);
        } catch (error) {
            console.error('Error fetching readings:', error);
            loadingReadings.style.display = 'none';
            noReadingsMessage.textContent = 'Error loading readings. Please try again.';
            noReadingsMessage.style.display = 'block';
        }
    }

    /**
     * Display readings as selectable cards
     */
    function displayReadings(readings) {
        readingsList.innerHTML = '';
        
        readings.forEach((reading, index) => {
            const card = document.createElement('div');
            card.className = 'reading-card';
            card.dataset.index = index;
            
            card.innerHTML = `
                <div class="selected-indicator">
                    <i class="fas fa-check"></i>
                </div>
                <div class="reading-card-header">
                    <div class="reading-value">${reading.value} mg/dL</div>
                    <span class="reading-context">${reading.meal_context}</span>
                </div>
                <div class="reading-timestamp">
                    <i class="fas fa-clock"></i> ${formatTimestamp(reading.timestamp)}
                </div>
            `;
            
            card.addEventListener('click', () => selectReading(index));
            readingsList.appendChild(card);
        });
    }

    /**
     * Select a reading card
     */
    function selectReading(index) {
        document.querySelectorAll('.reading-card').forEach(card => {
            card.classList.remove('selected');
        });
        
        const selectedCard = document.querySelector(`[data-index="${index}"]`);
        selectedCard.classList.add('selected');
        selectedReading = allReadings[index];
        console.log('Selected reading:', selectedReading);
    }

    /**
     * Toggle between manual and latest readings mode
     */
    function toggleInputMode() {
        if (latestModeRadio && latestModeRadio.checked) {
            // Show latest readings section
            if (manualInputsDiv) manualInputsDiv.style.display = 'none';
            if (latestReadingsSection) {
                latestReadingsSection.classList.add('show');
                loadingReadings.style.display = 'block';
                noReadingsMessage.style.display = 'none';
                readingsList.innerHTML = '';
                selectedReading = null;
                fetchLatestReadings();
            }
        } else {
            // Show manual inputs
            if (manualInputsDiv) manualInputsDiv.style.display = 'grid';
            if (latestReadingsSection) {
                latestReadingsSection.classList.remove('show');
                selectedReading = null;
            }
        }
    }

    // Attach input mode toggle listeners
    if (manualModeRadio && latestModeRadio) {
        manualModeRadio.addEventListener('change', toggleInputMode);
        latestModeRadio.addEventListener('change', toggleInputMode);
    }

    // --- Event Listener for Recommendation Form ---
    if (recommendationForm) {
        recommendationForm.addEventListener('submit', async function(event) {
            event.preventDefault();
            console.log('Recommendation form submitted.');

            recommendationsOutput.innerHTML = '';
            loadingMessage.style.display = 'none';
            errorMessage.style.display = 'none';
            if (noRecommendationsMessage) noRecommendationsMessage.style.display = 'none';

            let fbsLevel = null;
            let rbsLevel = null;

            // Check which input mode is selected
            const useLatestReadings = latestModeRadio && latestModeRadio.checked;

            if (useLatestReadings) {
                // Use selected reading
                if (!selectedReading) {
                    errorMessage.textContent = 'Please select a reading from your latest readings.';
                    errorMessage.style.display = 'block';
                    return;
                }

                const mealContext = selectedReading.meal_context.toLowerCase();
                if (mealContext === 'fasting') {
                    fbsLevel = parseFloat(selectedReading.value);
                } else {
                    rbsLevel = parseFloat(selectedReading.value);
                }

                console.log('Using selected reading:', selectedReading);
                console.log('FBS:', fbsLevel, 'RBS:', rbsLevel);
            } else {
                // Use manual input
                fbsLevel = fbsLevelInput && fbsLevelInput.value ? parseFloat(fbsLevelInput.value) : null;
                rbsLevel = rbsLevelInput && rbsLevelInput.value ? parseFloat(rbsLevelInput.value) : null;
            }

            const mealType = mealTypeSelect.value;
            const numAlternativesPerSlot = parseInt(numAlternativesInput.value);

            if (fbsLevel === null && rbsLevel === null) {
                errorMessage.textContent = "Please enter at least one blood sugar level (FBS or RBS).";
                errorMessage.style.display = 'block';
                return;
            }

            loadingMessage.style.display = 'block';

            try {
                // Build query parameters
                const params = new URLSearchParams({
                    meal_type: mealType,
                    num_alternatives_per_slot: numAlternativesPerSlot
                });

                if (fbsLevel !== null) {
                    params.append('fbs_level', fbsLevel);
                }
                if (rbsLevel !== null) {
                    params.append('rbs_level', rbsLevel);
                }

                const apiUrl = `${API_BASE_URL}/recommend_meal?${params.toString()}`;
                console.log('Fetching recommendations from:', apiUrl);

                const response = await fetch(apiUrl);
                
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
                }

                const recommendations = await response.json();
                console.log('Recommendations received:', recommendations);

                loadingMessage.style.display = 'none';

                if (recommendations && recommendations.length > 0) {
                    // Display recommendations with enhanced styling
                    recommendationsOutput.innerHTML = `
                        <h3 style="color: var(--text-primary); margin-bottom: 1rem;">Your Personalized Meal Recommendations</h3>
                        <div style="background: var(--bg-secondary); padding: 1rem; border-radius: var(--border-radius); margin-bottom: 1rem;">
                            <strong>Based on:</strong> 
                            ${fbsLevel ? `FBS: ${fbsLevel} mg/dL` : ''} 
                            ${fbsLevel && rbsLevel ? ' | ' : ''}
                            ${rbsLevel ? `RBS: ${rbsLevel} mg/dL` : ''}
                            <br>
                            <strong>Meal Type:</strong> ${mealType.charAt(0).toUpperCase() + mealType.slice(1)}
                        </div>
                        <ul style="list-style: none; display: grid; gap: 1rem;">
                            ${recommendations.map(food => `
                                <li style="background: var(--bg-secondary); padding: 1rem; border-radius: var(--border-radius); border-left: 4px solid var(--primary-color); display: flex; align-items: center; gap: 1rem;">
                                    <i class="fas fa-check-circle" style="color: var(--primary-color); font-size: 1.2rem;"></i>
                                    <span>${food}</span>
                                </li>
                            `).join('')}
                        </ul>
                    `;
                } else {
                    if (noRecommendationsMessage) {
                        noRecommendationsMessage.style.display = 'block';
                    } else {
                        errorMessage.textContent = "No recommendations found. Please try different values.";
                        errorMessage.style.display = 'block';
                    }
                }
            } catch (error) {
                loadingMessage.style.display = 'none';
                errorMessage.textContent = `Error: ${error.message}`;
                errorMessage.style.display = 'block';
                console.error('Fetch error:', error);
            }
        });
    }

    // --- Star Rating Logic for Feedback Form ---
    let currentRating = 0;

    if (ratingStarsContainer) {
        const stars = Array.from(ratingStarsContainer.children);
        console.log('Star rating container found. Number of stars:', stars.length);

        function fillStars(ratingValue) {
            stars.forEach(star => {
                const starVal = parseInt(star.dataset.value);
                if (starVal <= ratingValue) {
                    star.classList.remove('far');
                    star.classList.add('fas');
                } else {
                    star.classList.remove('fas');
                    star.classList.add('far');
                }
            });
        }

        ratingStarsContainer.addEventListener('mouseover', (event) => {
            const hoveredStar = event.target.closest('.fa-star');
            if (hoveredStar) {
                const hoverValue = parseInt(hoveredStar.dataset.value);
                fillStars(hoverValue);
            }
        });

        ratingStarsContainer.addEventListener('mouseout', () => {
            fillStars(currentRating);
        });

        ratingStarsContainer.addEventListener('click', (event) => {
            const clickedStar = event.target.closest('.fa-star');
            if (clickedStar) {
                currentRating = parseInt(clickedStar.dataset.value);
                ratingInput.value = currentRating;
                fillStars(currentRating);
                console.log('Rating selected:', currentRating);
            }
        });
    }

    // --- Event Listener for Feedback Form Submission ---
    if (feedbackForm) {
        console.log('Feedback form found.');
        feedbackForm.addEventListener('submit', async function(event) {
            event.preventDefault();
            console.log('Feedback form submitted.');

            feedbackMessage.style.display = 'none';
            feedbackErrorMessage.style.display = 'none';
            feedbackMessage.textContent = '';
            feedbackErrorMessage.textContent = '';

            const rating = parseInt(ratingInput.value);
            const feedbackText = feedbackTextInput.value.trim();
            const contactEmail = contactEmailInput.value.trim();

            if (rating === 0) {
                feedbackErrorMessage.textContent = "Please provide a star rating.";
                feedbackErrorMessage.style.display = 'block';
                return;
            }

            try {
                const apiUrl = `${API_BASE_URL}/submit_feedback`;
                console.log('Submitting feedback to:', apiUrl);

                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        rating: rating,
                        feedback_text: feedbackText || null,
                        contact_email: contactEmail || null
                    })
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
                }

                const result = await response.json();
                feedbackMessage.textContent = result.message;
                feedbackMessage.style.display = 'block';
                console.log('Feedback submission successful:', result.message);

                currentRating = 0;
                ratingInput.value = 0;
                fillStars(0);
                feedbackTextInput.value = '';
                contactEmailInput.value = '';

            } catch (error) {
                feedbackErrorMessage.textContent = `Failed to submit feedback: ${error.message}`;
                feedbackErrorMessage.style.display = 'block';
                console.error('Feedback submission error:', error);
            }
        });
    }

    // --- Feedback Modal Show/Hide Logic ---
    if (feedbackModal && closeFeedbackModal) {
        console.log('Feedback modal elements found. Attaching listeners.');

        const showFeedbackModal = () => {
            console.log('Showing feedback modal!');
            feedbackModal.classList.add('show-modal');
        };

        if (feedbackTrigger) {
            feedbackTrigger.addEventListener('click', showFeedbackModal);
            console.log('Attached click listener to unified feedback trigger.');
        } else {
            console.warn('Unified feedback trigger element not found.');
        }

        closeFeedbackModal.addEventListener('click', () => {
            console.log('Close modal button clicked.');
            feedbackModal.classList.remove('show-modal');
        });

        window.addEventListener('click', (event) => {
            if (event.target == feedbackModal) {
                console.log('Clicked outside modal. Hiding modal.');
                feedbackModal.classList.remove('show-modal');
            }
        });
    } else {
        console.warn('One or more feedback modal elements not found:', { feedbackModal, closeFeedbackModal });
    }
});