<p align="center">
  <img src="https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white" />
  <img src="https://img.shields.io/badge/Gemini_Vision-4285F4?style=for-the-badge&logo=google&logoColor=white" />
  <img src="https://img.shields.io/badge/Firebase-FFCA28?style=for-the-badge&logo=firebase&logoColor=black" />
  <img src="https://img.shields.io/badge/Stable_Diffusion-8B5CF6?style=for-the-badge&logoColor=white" />
  <img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" />
</p>

# 🌿 Foliage Care — AI-Powered Phytopathological Consultation Platform

**Foliage Care** is a full-stack, multimodal AI web platform that performs **real-time visual phytopathological analysis** of plant foliage. Rather than relying on a static image classifier, the system leverages **Google Gemini Vision** as its core inference engine — combining visual symptom recognition with **live weather telemetry**, **geolocation-aware seasonal context**, and **user-role-adaptive advisory generation** to deliver diagnosis-to-treatment pipelines tailored for Indian agriculture.

> Built as a final-year capstone project demonstrating the integration of generative AI, geospatial intelligence, and domain-specific prompt engineering for precision agriculture.

---

## 🧠 Core Philosophy

Traditional plant health tools offer a single classification label and generic advice. **Foliage Care** reimagines this as a **multi-stage consultation workflow**:

1. **Diagnose** — Identify the pathology from leaf imagery with visual evidence overlays  
2. **Simulate** — Generate a predictive visual of disease progression if left untreated  
3. **Prescribe** — Produce a structured, seasonally-aware treatment plan with Indian-specific remedies  
4. **Consult** — Engage in a context-aware conversational follow-up with the AI advisor  

Each stage is weather-influenced, season-aware, and personalized to the user's role (farmer, nursery operator, home gardener, or student/researcher).

---

## 🏗️ System Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                         CLIENT (Browser)                     │
│  HTML5 / CSS3 / Vanilla JS (ES6 Modules)                     │
│  Firebase Auth · Leaflet.js Outbreak Map · Dynamic UI        │
└────────────────────────────┬─────────────────────────────────┘
                             │ REST API (CORS)
┌────────────────────────────▼─────────────────────────────────┐
│                    FastAPI GATEWAY (Python)                   │
│             Uvicorn ASGI · Async I/O · v2.1.0                │
├──────────────────────────────────────────────────────────────┤
│  POST /predict         → Gemini Vision Diagnosis + Overlays  │
│  POST /simulate        → Disease Progression Imaging         │
│  POST /get_expert_plan → Structured Treatment Generation     │
│  POST /followup        → Multi-Turn Conversational Advisor   │
└───────┬──────────────────┬───────────────────────────────────┘
        │                  │
  ┌─────▼─────┐      ┌────▼──────────────┐
  │  Gemini   │      │  HuggingFace Hub  │
  │  Vision   │      │  SD 1.5 / FLUX.1  │
  │  2.5 Flash│      │  (3-tier fallback) │
  └───────────┘      └───────────────────┘
```

---

## 🔬 Technical Modules

### Module 1 — Visual Pathology Diagnosis (`/predict`)

- Accepts a leaf/plant image and returns a **structured JSON diagnosis** including plant identification, disease classification, severity scoring, and confidence estimation.
- Generates **pixel-coordinate affected region annotations** (`x_pct`, `y_pct`, `w_pct`, `h_pct`) enabling the frontend to render **bounding-box overlays** directly on the uploaded image.
- Produces **trust signals**: primary diagnosis justification, alternative differential diagnosis, and confidence explanation — improving transparency and user trust.
- Cross-references **live weather data** (temperature, humidity, rainfall trends) with visual symptoms to resolve ambiguous presentations (e.g., leaf yellowing from drought stress vs. root suffocation from overwatering).

### Module 2 — Disease Progression Simulation (`/simulate`)

- Generates a **predictive future-state image** showing the likely visual appearance of the disease after 7 days without intervention.
- Uses a **two-step generative pipeline**: Gemini Vision first constructs a context-aware visual prompt factoring in current season, location, and disease characteristics; the prompt is then fed to **Stable Diffusion** (image-to-image) or **FLUX.1-schnell** with a **3-tier cascading fallback** strategy to ensure reliability.
- Designed as a behavioral nudge — visually communicating urgency to motivate timely treatment.

### Module 3 — Expert Treatment Plan (`/get_expert_plan`)

- Returns a **structured Markdown treatment plan** with escalating intervention tiers:
  - **Tier 1**: Immediate containment using household/desi remedies (neem oil, turmeric paste, wood ash)
  - **Tier 2**: Organic solutions (Jeevamrut, Panchagavya, Trichoderma viride)
  - **Tier 3**: Chemical intervention as last resort — only Indian-market products (Dhanuka, UPL, Bayer India) with mandatory safety/PPE warnings
- Includes seasonal prevention strategies and **Krishi Vigyan Kendra (KVK)** referral guidance.

### Module 4 — Contextual Follow-Up Advisor (`/followup`)

- Maintains a **6-turn sliding conversation window** for multi-turn Q&A grounded in the active diagnosis.
- Supports **multilingual interaction** — auto-detects and responds in the user's language (Hindi, English, or regional).
- Gently redirects off-topic queries back to plant health while remaining conversational and helpful.

---

## 👤 Role-Adaptive Intelligence

The platform dynamically adapts its diagnostic language, remedy recommendations, and treatment detail based on **four user personas**:

| Persona | Adaptation |
|---|---|
| **Farmer** | Acreage-aware, yield-focused advice; Kharif/Rabi/Zaid seasonal context; field containment strategies; KVK referral language |
| **Nursery Operator** | Batch management, stock segregation, propagation hygiene, tool sanitation workflows |
| **Home Gardener** | Warm, jargon-free tone; kitchen-ingredient remedies; balcony/terrace/indoor plant focus |
| **Student / Researcher** | Technical terminology with inline definitions; differential diagnosis reasoning; pathogen-class references |

---

## 🌦️ Environment-Aware Inference

Every diagnosis and treatment plan is influenced by:

- **Real-time weather telemetry** — Temperature, humidity, and rainfall trends fetched via browser Geolocation API
- **Indian seasonal calendar** — Monsoon (Jun–Sep), Post-Monsoon (Oct–Nov), Winter (Dec–Feb), Summer (Mar–May) with region-specific farming context
- **Geolocation** — GPS coordinates used for climate zone inference (e.g., arid Rajasthan vs. humid Konkan coast)

---

## 🗺️ Outbreak Mapping

An interactive **Leaflet.js-powered geospatial map** aggregates anonymized diagnosis data across users to visualize:

- Regional disease concentration patterns
- Emerging outbreak clusters
- Seasonal disease migration trends

This transforms individual diagnoses into **collective agricultural intelligence**.

---

## 🔐 Authentication & User Management

- **Firebase Authentication** with Email/Password and **Google OAuth 2.0** sign-in
- Persistent user profiles with diagnosis history tracking
- Role selection (Farmer / Home Gardener / Nursery / Student) that drives personalized AI behavior

---

## 🛠️ Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | HTML5, CSS3, Vanilla JavaScript (ES6) | Responsive UI with dynamic result rendering and image overlays |
| **Typography & Icons** | Google Fonts (Playfair Display, Roboto), Font Awesome | Premium visual aesthetics |
| **Authentication** | Firebase Authentication (Google OAuth 2.0) | Secure multi-provider user management |
| **Geospatial** | Leaflet.js, OpenStreetMap | Interactive outbreak mapping and location-based services |
| **Backend API** | FastAPI (Python 3.11+) | High-performance async REST API gateway |
| **ASGI Server** | Uvicorn | Production-grade async server |
| **Primary AI Engine** | Google Gemini 2.5 Flash (Vision) | Multimodal diagnosis, treatment generation, and conversational AI |
| **Image Generation** | Stable Diffusion 1.5, FLUX.1-schnell (HuggingFace) | Disease progression simulation with cascading fallback |
| **Image Processing** | Pillow (PIL) | Server-side image preprocessing and format handling |
| **Environment** | python-dotenv | Secure credential and configuration management |

---

## 📂 Project Structure

```
Foliage_Care/
├── Backend/
│   ├── main.py                  # API gateway — all 4 endpoint modules
│   ├── utils/
│   │   ├── gradcam.py           # Grad-CAM visualization utilities
│   │   ├── weather.py           # Weather data integration
│   │   ├── preprocess.py        # Image preprocessing pipeline
│   │   └── img_gen.py           # Image generation helpers
│   └── models/                  # Model weights and class indices
├── Frontend/
│   ├── index.html               # Landing page
│   ├── start.html               # Diagnosis interface
│   ├── profile.html             # User profile & diagnosis history
│   ├── map.html                 # Outbreak map visualization
│   ├── playbook.html            # Treatment playbook
│   ├── login.html               # Authentication
│   ├── about.html               # Project information
│   ├── contact.html             # Feedback & connect
│   ├── css/                     # Stylesheets
│   ├── js/                      # Client-side modules
│   └── assets/                  # Static media
├── requirements.txt
├── render.yaml                  # Render deployment configuration
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites

- Python 3.11+
- [Google Gemini API Key](https://aistudio.google.com/apikey)
- [HuggingFace API Token](https://huggingface.co/settings/tokens)

### Installation

```bash
# Clone the repository
git clone https://github.com/<your-username>/Foliage_Care.git
cd Foliage_Care

# Create and activate virtual environment
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # macOS/Linux

# Install dependencies
pip install -r requirements.txt
```

### Configuration

Create a `.env` file inside the `Backend/` directory:

```env
GEMINI_API_KEY=your_gemini_api_key_here
HF_TOKEN=your_huggingface_token_here
```

### Run

```bash
cd Backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Open the frontend by launching `Frontend/index.html` in a browser, or serve via any static file server.

---

## 📸 Screenshots

### Landing Page
![Main Landing Page](https://github.com/user-attachments/assets/020cf329-6ba1-477c-8351-b8ff026e7a20)

![Landing Page Section](https://github.com/user-attachments/assets/39a6512e-fed8-4f42-a5bf-f55c11aa6d40)

### Diagnosis Interface
![Diagnosis Page](https://github.com/user-attachments/assets/42fca12d-5e2e-48c6-8fb4-7cb54d83aa7f)

<img width="789" height="831" alt="Diagnosis Results" src="https://github.com/user-attachments/assets/2fd3a05e-5006-4ec6-9501-36284af67406" />

![Diagnosis Detail](https://github.com/user-attachments/assets/415aa5f9-a358-40cb-bb7e-e8017d26eeb8)

### About
![About Page](https://github.com/user-attachments/assets/30b3a476-4dd5-4aa3-bf3e-829ee3138121)

![About Section](https://github.com/user-attachments/assets/a925bac1-1f28-4fb5-8476-73d9cbce0abe)

### Authentication
<img width="1784" height="825" alt="Login Page" src="https://github.com/user-attachments/assets/09a34f79-8f78-4ede-9b51-08e856fca2a6" />

### Feedback
![Connect Page](https://github.com/user-attachments/assets/4c5b6b46-b3bf-47e5-8eb9-028983bbb6e0)

![Feedback Form](https://github.com/user-attachments/assets/bd7b809a-9fa4-45ec-85a7-43aeb7d19113)

---

## 📄 License

This project was developed as a **final-year capstone project** for academic evaluation and demonstration purposes.

---

<p align="center">
  Built with 🌱 by the Foliage Care Team
</p>
