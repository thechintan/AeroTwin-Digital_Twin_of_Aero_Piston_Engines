# AeroTwin: MALE UAV Propulsion Digital Twin 🚁💻

<div align="center">
  <img src="frontend/assets/logo-light-alt.png" alt="AeroTwin Logo" width="300" style="margin-bottom: 20px;" />
  <p><strong>Next-Generation Physics-Synchronized Digital Twin and Structural Health Monitoring (SHM) for Medium Altitude Long Endurance (MALE) UAV Aero-Piston Engines.</strong></p>
  
  ![Status](https://img.shields.io/badge/Status-Active_Prototype-success?style=for-the-badge)
  ![Node.js](https://img.shields.io/badge/Node.js-v18+-339933?style=for-the-badge&logo=nodedotjs)
  ![Python](https://img.shields.io/badge/Python-3.8+-3776AB?style=for-the-badge&logo=python)
  ![Three.js](https://img.shields.io/badge/Three.js-WebGL-black?style=for-the-badge&logo=three.js)
  ![Google Gemini](https://img.shields.io/badge/AI-Google_Gemini-4285F4?style=for-the-badge)
</div>

---

## 📖 Table of Contents
- [Overview](#-overview)
- [Key Features & Capabilities](#-key-features--capabilities)
- [System Architecture](#-system-architecture)
- [Technology Stack](#-technology-stack)
- [Getting Started (Installation)](#-getting-started)
- [Usage Guide](#-usage-guide)
- [Project Directory Structure](#-project-directory-structure)
- [Machine Learning Pipeline](#-machine-learning-pipeline)
- [Notice](#-notice)

---

## 🚀 Overview
**AeroTwin** is a state-of-the-art structural health monitoring (SHM) and intelligence framework developed to simulate, visualize, and predict the operational state of MALE UAV propulsion systems. Built to adhere to strict defense-grade telemetry and diagnostic standards, the architecture integrates a **synchronized 3D Digital Twin**, an autonomous **live mission simulator**, and **Generative AI** for Explainable AI (XAI) diagnostics and predictive maintenance.

The goal of AeroTwin is to drastically reduce unexpected engine failures mid-flight by providing ground control operators with real-time, actionable insights into engine degradation, fault classification, and remaining useful life (RUL).

---

## ✨ Key Features & Capabilities

### 1. Interactive 3D Digital Twin Environment
- **Synchronized Telemetry**: A fully interactive 360° representation of the UAV airframe and aero-piston engine core. The landing gear and propeller animations are physically synchronized with the live RPM sensor data.
- **Dynamic Camera Waypoints**: Operators can instantly focus the camera on critical subsystems (e.g., Cylinder #2, Turbocharger, Fuel Injectors).
- **Advanced Diagnostics**: Real-time stress, temperature heatmaps, and X-Ray cutaway views mapped directly to the 3D engine components.

### 2. Generative AI & Explainable AI (XAI)
- **AeroTwin AI Assistant**: Powered by the **Google Gemini API (`gemini-3.5-flash-lite`)**, this domain-restricted chatbot acts as a diagnostic co-pilot. It is strictly constrained to answer queries related to aerospace engineering, UAV mechanics, and propulsion diagnostics.
- **Climate Impact XAI**: Instantly generates Explainable AI breakdowns detailing how specific environmental conditions (e.g., High Altitude, Tropical Maritime, Cold Arctic) impact aerodynamics and engine combustion efficiency in real-time.

### 3. Live Telemetry & Autonomous Simulation
- **Real-Time Data Processing**: The dashboard simulates connecting to an active UAV CAN-bus stream, autonomously detecting the operating environment.
- **Autonomous Fault Injection**: The system automatically classifies active engine faults (such as Cylinder Misfire, Cooling Degradation, or Injector Clogging) on-the-fly based on sensor drift.
- **One-Click Reporting**: Generate and download detailed `.txt` AI propulsion reports containing real-time snapshots of the Engine Health Index (EHI), Remaining Useful Life (RUL), and raw sensor metrics.

### 4. Professional GCS (Ground Control Station) UI
- **Military-Grade Dashboard**: A grounded, professional Slate/Dark mode UI designed for operations desks.
- **Customizable Settings**: A dedicated GCS settings panel allowing operators to toggle UI themes, animations, AI Voice Alerts, volume levels, and simulate Offline vs. Datalink operating modes.

---

## 🧠 System Architecture

AeroTwin operates on a decoupled client-server architecture:
1. **The Telemetry Engine (Backend)** generates high-frequency synthetic sensor data and hosts the Generative AI integration layers.
2. **The Predictive ML Engine** uses trained `RandomForest` and `GradientBoosting` models to calculate fault classifications and RUL.
3. **The WebGL Visualization Layer (Frontend)** maps the incoming CAN-bus telemetry arrays to the physical attributes of the 3D `.gltf` model.

---

## 🛠 Technology Stack

- **Frontend Interface**: HTML5, Vanilla JavaScript (ES6+), CSS3 (Zero heavy UI frameworks for maximum performance)
- **3D Rendering & WebGL**: `Three.js`, `OrbitControls`
- **Data Visualization**: `Chart.js`
- **Backend Server**: `Node.js`, `Express.js`, `cors`
- **Generative AI Integration**: Google Gemini API SDK (`@google/genai`)
- **Machine Learning (Predictive Maintenance)**: `Python 3.8+`, `scikit-learn`, `pandas`, `numpy`

---

## ⚙️ Getting Started

### Prerequisites
- **Node.js** (v18.0 or higher recommended)
- **Python** (v3.8 or higher, required *only* if you intend to retrain the ML models)
- **Google Gemini API Key** (Required for the AI Chatbot and Climate XAI features)

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/AeroTwin-Digital_Twin_of_Aero_Piston_Engines.git
cd AeroTwin-Digital_Twin_of_Aero_Piston_Engines
```

### 2. Environment Setup
Navigate to the `backend` directory and create a `.env` file based on the provided example:
```bash
cd backend
cp .env.example .env
```
Open the `.env` file and insert your Google Gemini API Key:
```env
GEMINI_API_KEY=your_actual_api_key_here
PORT=3001
```

### 3. Install Dependencies and Run
Install the necessary Node.js packages and start the backend server:
```bash
npm install
node server.js
```

### 4. Access the Dashboard
The `server.js` script handles both the API routes and serves the static frontend files.
Open your standard web browser and navigate to:
**`http://localhost:3001`**

---

## 🖥 Usage Guide
- **Starting a Mission**: Navigate to the *Mission Simulation* tab and click **"Connect & Stream Data"**. The system will autonomously connect to the synthetic telemetry feed and begin detecting faults.
- **Using the AI Assistant**: Click the blue "AEROTWIN AI Assistant" widget at the bottom right. Ask it questions like *"What is the impact of a cylinder misfire on fuel consumption?"*
- **Downloading Reports**: Open the *Settings* tab or look at the bottom of the sidebar and click **"Download Report"** to instantly generate a local text file summarizing the active flight data.

---

## 📁 Project Directory Structure

```text
AeroTwin/
├── backend/
│   ├── server.js            # Express server (Telemetry, API, Gemini Integration, Static File Serving)
│   ├── package.json         # Node.js configuration
│   ├── .env                 # Environment variables (API Keys)
│   └── .env.example         # Template for environment variables
├── frontend/
│   ├── index.html           # Main Single Page Application (SPA) dashboard
│   ├── app.js               # Core Frontend logic (WebSockets, Three.js, Chatbot UI)
│   ├── style.css            # System stylesheets (Dark/Light mode variables)
│   ├── assets/              # Logos, branding, and images
│   └── models/              # 3D .gltf/.glb UAV and Engine assets
├── ml/
│   ├── dataset.py           # Synthetic telemetry generator for various flight phases
│   ├── train.py             # ML model training and validation pipeline
│   └── inference.py         # Testing scripts for serialized predictive models
└── ml_artifacts/            # Serialized models (.pkl) and validation reports (.json)
```

---

## 🔬 Machine Learning Pipeline (Optional)
If you wish to modify the fault parameters, regenerate the synthetic telemetry data, or retrain the predictive maintenance models from scratch:

```bash
cd ml
pip install -r requirements.txt

# 1. Generate updated synthetic flight data CSVs
python dataset.py

# 2. Execute the training pipeline (Outputs new models to ml_artifacts/)
python train.py
```

---

## ⚖️ Notice & Disclaimer
This repository contains a prototype software framework developed for the **Smart India Hackathon (SIH)**. 
*The data simulated within this application is entirely synthetic and generated for demonstration purposes. It does not reflect classified, proprietary, or operational flight data from active military or DRDO assets.*
