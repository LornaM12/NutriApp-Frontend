# 🥗 NutriApp: AI-Powered Diabetic Meal Planner

![Project Status](https://img.shields.io/badge/Status-Active_Development-green)
![Python Version](https://img.shields.io/badge/Python-3.9+-blue)
![License](https://img.shields.io/badge/License-MIT-lightgrey)

## 📖 Overview
**NutriApp** is an intelligent dietary recommendation system designed specifically for individuals with diabetes. Unlike generic meal planners, NutriApp utilizes a **Hybrid AI approach**—combining **Unsupervised Learning (Clustering)** with **Content-Based Filtering**—to generate personalized, safe, and medically compliant meal plans based on a user's real-time blood sugar readings.

The system features a **Feedback Loop** that learns from user preferences (Likes/Dislikes) to refine future recommendations, ensuring the diet is both healthy and enjoyable.

---

## 🚀 Key Features
* **🩸 Real-Time Glucose Context:** Adjusts meal safety levels dynamically based on current blood sugar readings (Hypoglycemic, Normal, Hyperglycemic).
* **🧠 Hybrid AI Engine:**
    * **K-Means Clustering:** Categorizes foods into nutritional clusters (e.g., "High Fiber/Low GI", "Complex Carbs").
    * **Content-Based Filtering:** Matches food attributes to user health profiles and historical preferences.
* **🔄 Adaptive Learning:** "Like" and "Dislike" interactions update the user's profile, training the system to avoid disliked ingredients in the future.
* **🛡️ Medical Guardrails:** Hard-coded safety rules prevent high-risk recommendations (e.g., strict sugar caps during hyperglycemia) regardless of user preference.

---

## 🛠️ Tech Stack & Architecture

### **Backend (The Brains)**
* **Language:** Python 3.9+
* **Framework:** FastAPI (High-performance async web framework)
* **Machine Learning:** Scikit-Learn (K-Means Clustering), Pandas, NumPy
* **Data Handling:** Custom CSV/SQL data pipelines for nutritional datasets.

### **Frontend (The Interface)**
* **Core:** HTML5, CSS3, Vanilla JavaScript (ES6+)
* **Interactivity:** Asynchronous API calls (Fetch API) for real-time recommendations without page reloads.

### **Infrastructure**
* **Cloud:** Google Cloud Platform (GCP)


---

## 🏗️ System Architecture
The application follows a **modular architecture** designed for scalability:

1.  **Data Ingestion Layer:** Loads and cleanses nutritional data (Calories, GI, Fiber, Carbs).
2.  **ML Processing Layer:** Runs K-Means clustering to label data points.
3.  **API Layer (FastAPI):** Handles user requests, validates input, and routes logic.
4.  **Recommendation Engine:**
    * *Input:* User Glucose Level + User Preferences.
    * *Process:* Filters clusters -> Applies Safety Rules -> Ranks by Preference.
    * *Output:* JSON response with personalized meal options.

---

nk to your LinkedIn]
* **Email:** [Your Email]
