# AeroTwin: MALE UAV Propulsion Digital Twin

<div align="center">
  <p><strong>Physics-Synchronized Digital Twin and Structural Health Monitoring for MALE UAV Aero-Piston Engines</strong></p>
  <img src="frontend/assets/logo-light-alt.png" alt="AeroTwin Logo" width="250" />
</div>

<br>

## 1. Overview

AeroTwin is a real-time structural health monitoring (SHM) and intelligence framework developed to simulate, visualize, and predict the operational state of Medium Altitude Long Endurance (MALE) UAV propulsion systems. Built to adhere to defense-grade telemetry and diagnostic standards, the architecture integrates a synchronized 3D Digital Twin, a dynamic mission simulator, and a machine learning pipeline for predictive maintenance and fault isolation.

---

## 2. Core Capabilities

### 2.1. 3D Digital Twin Environment
A fully synchronized, interactive 360° representation of the UAV airframe and aero-piston engine core (Rotax 914 / AE300 Hybrid). Diagnostic view modes include:
*   **Thermal & X-Ray Diagnostics**: Real-time stress and temperature heatmaps mapped to individual engine cylinders.
*   **Cutaway & Exploded Views**: Subsystem isolation for the turbocharger, crankshaft, and fuel injectors.
*   **CAN Node Inspector**: Interactive 3D spatial mapping of localized CAN bus telemetry data.

### 2.2. Live Telemetry & Diagnostics
Real-time ingestion and processing of high-frequency engine sensor arrays (RPM, MAP, CHT, EGT, Vibration, Fuel Flow). The system processes telemetry at 100Hz, aggregated and visualized at 2-second intervals for the operator dashboard.

### 2.3. Predictive Analytics (AI/ML)
*   **Fault Classification**: A trained `RandomForest` classifier isolates 7 specific engine failure modes (e.g., Cylinder Misfire, Injector Clogging) with a demonstrated validation accuracy exceeding 93%.
*   **Remaining Useful Life (RUL)**: A `GradientBoosting` regression model calculates the estimated RUL based on aggregate degradation metrics and operational load.
*   **Anomaly Detection**: An `IsolationForest` model provides unsupervised detection of out-of-distribution engine behaviors and novel failure states.

### 2.4. Mission Simulation Engine
An interactive testing environment capable of simulating various operational conditions (Standard ISA, Hot Desert, High Altitude). Operators can inject specific mechanical faults during the simulation to evaluate system degradation and validate ML model responsiveness.

---

## 3. Technology Stack

*   **Frontend**: HTML5, JavaScript (ES6+), CSS3
*   **3D Rendering**: `Three.js` (WebGL), `OrbitControls`
*   **Data Visualization**: `Chart.js`
*   **Backend / Simulation Engine**: `Node.js`, `Express.js`
*   **Machine Learning**: `Python 3.8+`, `scikit-learn`, `pandas`, `numpy`, `joblib`

---

## 4. Project Structure

```text
AeroTwin/
├── backend/
│   ├── server.js            # Express server for telemetry streaming and mission simulation
│   ├── package.json         # Node.js configuration and dependencies
├── frontend/
│   ├── index.html           # Main Single Page Application (SPA) dashboard
│   ├── app.js               # Frontend logic (WebSockets, Three.js, Chart.js)
│   ├── style.css            # System stylesheets and theme variables
│   └── assets/              # Static assets and organization logos
├── ml/
│   ├── dataset.py           # Synthetic telemetry generator for MALE UAV flight phases
│   ├── train.py             # ML model training and validation pipeline
│   └── inference.py         # Testing scripts for serialized models
└── ml_artifacts/            # Serialized models (.pkl) and metric reports (.json)
```

---

## 5. Setup and Execution

### 5.1. Prerequisites
*   Node.js (v16.0 or higher)
*   Python (v3.8 or higher, required only for ML retraining)

### 5.2. Initializing the Simulation Server
Navigate to the backend directory, install the required dependencies, and initialize the simulation engine.
```bash
cd backend
npm install
node server.js
```
*Note: The backend service binds to `http://localhost:3001`.*

### 5.3. Launching the Operator Dashboard
The frontend operates as a static Single Page Application. It can be served using any standard HTTP server.
```bash
cd frontend
npx http-server . -p 8080
```
*Access the dashboard via `http://localhost:8080` in a standard web browser.*

---

## 6. Machine Learning Pipeline (Optional)
To regenerate synthetic telemetry data or retrain the predictive models:
```bash
cd ml
pip install -r requirements.txt

# Generate updated synthetic flight data
python dataset.py

# Execute the training pipeline (outputs to ml_artifacts/)
python train.py
```

---

## 7. Notice
This repository contains a prototype software framework developed for the **Smart India Hackathon (SIH)**. The data simulated within this application does not reflect classified, proprietary, or operational flight data from active military or DRDO assets.
