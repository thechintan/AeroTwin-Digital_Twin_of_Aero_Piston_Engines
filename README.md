# AeroTwin: MALE UAV Propulsion Digital Twin

<div align="center">
  <p><strong>Physics-Synchronized Digital Twin and Structural Health Monitoring for MALE UAV Aero-Piston Engines</strong></p>
  <img src="frontend/assets/logo-light-alt.png" alt="AeroTwin Logo" width="250" />
</div>

<br>

## 1. Overview

AeroTwin is a real-time structural health monitoring (SHM) and intelligence framework developed to simulate, visualize, and predict the operational state of Medium Altitude Long Endurance (MALE) UAV propulsion systems. Built to adhere to defense-grade telemetry and diagnostic standards, the architecture integrates a synchronized 3D Digital Twin, a dynamic mission simulator, and Generative AI for Explainable AI (XAI) diagnostics and predictive maintenance.

---

## 2. Core Capabilities

### 2.1. 3D Digital Twin Environment
A fully synchronized, interactive 360° representation of the UAV airframe and aero-piston engine core. Features include dynamic landing gear synchronized with RPM, and interactive camera waypoints focusing on critical engine components (Crankshaft, Cylinder #2, etc.).

### 2.2. Generative AI & Explainable AI (XAI)
*   **Domain-Restricted Chatbot**: Powered by Google Gemini (`gemini-3.5-flash-lite`), the AI Assistant acts as a diagnostic co-pilot. It is strictly constrained to aerospace engineering, UAV mechanics, and propulsion diagnostics.
*   **Climate XAI**: Provides detailed Explainable AI breakdowns of how various environmental conditions (e.g., High Altitude, Hot Desert) impact aerodynamic and engine performance in real-time.

### 2.3. Live Telemetry & Autonomous Simulation
*   **Live Processing**: The dashboard simulates connecting to an active CAN-bus stream, autonomously detecting the environment and diagnosing active engine faults (such as Cylinder Misfire, Cooling Degradation, or Injector Clogging) on-the-fly.
*   **Report Generation**: One-click generation and downloading of detailed `.txt` AI propulsion reports containing real-time EHI (Engine Health Index), RUL (Remaining Useful Life), and sensor snapshots.

### 2.4. Ground Control Station UI
*   **Settings Panel**: A dedicated GCS-style settings panel allowing the operator to toggle UI themes, animations, AI Voice Alerts, and simulate offline vs. datalink operating modes.

---

## 3. Technology Stack

*   **Frontend**: HTML5, Vanilla JavaScript, CSS3 (No framework)
*   **3D Rendering**: `Three.js` (WebGL), `OrbitControls`
*   **Generative AI**: Google Gemini API SDK (`@google/genai`)
*   **Backend**: `Node.js`, `Express.js`

---

## 4. Setup and Execution

### 4.1. Prerequisites
*   Node.js (v18.0 or higher recommended)
*   Google Gemini API Key (Required for AI Chatbot and Climate XAI features)

### 4.2. Environment Setup
Create a `.env` file in the `backend` directory and add your Gemini API key:
```env
GEMINI_API_KEY=your_api_key_here
```

### 4.3. Launching the System
Navigate to the backend directory, install the required dependencies, and initialize the combined API and static file server.
```bash
cd backend
npm install
node server.js
```

*Access the AeroTwin dashboard via `http://localhost:3001` in your web browser.*

---

## 5. Notice
This repository contains a prototype software framework developed for the **Smart India Hackathon (SIH)**. The data simulated within this application does not reflect classified, proprietary, or operational flight data from active military or DRDO assets.
