const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { spawn, exec } = require('child_process');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'frontend')));

const ML_DIR = path.join(__dirname, '..', 'ml');
const ARTIFACTS_DIR = path.join(__dirname, '..', 'ml_artifacts');

// ══════════════════════════════════════════════════════════════════
// SIMULATION STATE
// ══════════════════════════════════════════════════════════════════
const simState = {
  running: false,
  mission_id: 'MALE-ISR-DRDO-2026-09',
  uav_tail: 'UAV-MALE-04',
  flight_phase: 'PRE_FLIGHT',
  mission_time_sec: 0,
  cycle: 0,
  degradation: 0.05,
  fault_type: 'NOMINAL',
  env_preset: 'STANDARD_ISA',
  startTime: null,
  buffer: [],
  interval: null
};

// Flight phases timeline
const FLIGHT_PHASES = [
  { name: 'TAXI_OUT', duration: 120 },
  { name: 'TAKEOFF', duration: 60 },
  { name: 'CLIMB', duration: 600 },
  { name: 'CRUISE', duration: 1200 },
  { name: 'ISR_LOITER', duration: 3600 },
  { name: 'CRUISE_RETURN', duration: 1200 },
  { name: 'DESCENT', duration: 600 },
  { name: 'APPROACH', duration: 300 },
  { name: 'LANDING', duration: 60 },
  { name: 'TAXI_IN', duration: 120 }
];

// Environment presets
const ENV_PRESETS = {
  STANDARD_ISA: { temp_offset: 0, alt_offset: 0, label: 'Standard ISA (15°C SL)' },
  HOT_DESERT_48C: { temp_offset: 33, alt_offset: 0, label: 'Hot Desert (48°C)' },
  HIGH_ALTITUDE_25K: { temp_offset: -15, alt_offset: 10000, label: 'High Altitude (25,000 ft)' },
  COLD_ARCTIC: { temp_offset: -40, alt_offset: 0, label: 'Cold Arctic (-25°C)' },
  TROPICAL_MARITIME: { temp_offset: 12, alt_offset: -2000, label: 'Tropical Maritime (37°C)' }
};

// Fault injection profiles
const FAULT_PROFILES = {
  NOMINAL: {},
  CYLINDER_MISFIRE: { cht_2_offset: 65, egt_2_offset: 240, vib_mult: 2.5, rpm_offset: -400 },
  INJECTOR_CLOGGING: { fuel_flow_mult: 0.68, fuel_press_mult: 0.63, egt_3_offset: 200 },
  COOLING_DEGRADATION: { coolant_offset: 60, cht_all_offset: 65, oil_temp_offset: 40 },
  LUBRICATION_FAILURE: { oil_press_mult: 0.48, oil_temp_offset: 60, vib_mult: 2.8 },
  SENSOR_DRIFT: { batt_offset: -4.2, alt_curr_mult: 0.67 },
  COMBUSTION_INSTABILITY: { map_offset: -6.5, egt_all_offset: 160, vib_mult: 2.2, rpm_offset: -500 }
};

function getFlightPhase(missionTimeSec) {
  let elapsed = missionTimeSec;
  for (const phase of FLIGHT_PHASES) {
    if (elapsed < phase.duration) return phase.name;
    elapsed -= phase.duration;
  }
  return 'ISR_LOITER';
}

function generateSensorReading() {
  const env = ENV_PRESETS[simState.env_preset] || ENV_PRESETS.STANDARD_ISA;
  const fault = FAULT_PROFILES[simState.fault_type] || {};
  const phase = getFlightPhase(simState.mission_time_sec);
  simState.flight_phase = phase;

  // Phase-dependent base parameters
  let baseRpm = 4600, baseThrottle = 75, baseAlt = 15000, baseAirspeed = 120;
  if (phase === 'TAXI_OUT' || phase === 'TAXI_IN') { baseRpm = 1200; baseThrottle = 15; baseAlt = 0; baseAirspeed = 0; }
  else if (phase === 'TAKEOFF') { baseRpm = 5200; baseThrottle = 100; baseAlt = 500; baseAirspeed = 80; }
  else if (phase === 'CLIMB') { baseRpm = 5000; baseThrottle = 90; baseAlt = 8000; baseAirspeed = 100; }
  else if (phase === 'DESCENT' || phase === 'APPROACH') { baseRpm = 3000; baseThrottle = 35; baseAlt = 5000; baseAirspeed = 90; }
  else if (phase === 'LANDING') { baseRpm = 2000; baseThrottle = 20; baseAlt = 100; baseAirspeed = 60; }

  const r = () => (Math.random() - 0.5) * 2;
  const sensor = {
    rpm: baseRpm + r() * 150 + (fault.rpm_offset || 0),
    throttle_pct: baseThrottle + r() * 5,
    manifold_pressure: 26.5 + r() * 1.8 + (fault.map_offset || 0),
    cht_1: 192 + r() * 8 + (fault.cht_all_offset || 0),
    cht_2: 196 + r() * 8 + (fault.cht_2_offset || 0) + (fault.cht_all_offset || 0),
    cht_3: 190 + r() * 8 + (fault.cht_all_offset || 0),
    cht_4: 189 + r() * 8 + (fault.cht_all_offset || 0),
    egt_1: 1325 + r() * 30 + (fault.egt_all_offset || 0),
    egt_2: 1340 + r() * 30 + (fault.egt_2_offset || 0) + (fault.egt_all_offset || 0),
    egt_3: 1315 + r() * 30 + (fault.egt_3_offset || 0) + (fault.egt_all_offset || 0),
    egt_4: 1330 + r() * 30 + (fault.egt_all_offset || 0),
    fuel_flow: 12.5 * (fault.fuel_flow_mult || 1.0) + r() * 1.0,
    fuel_pressure: 35 * (fault.fuel_press_mult || 1.0) + r() * 2,
    injection_timing_deg: 22 + r() * 1.2,
    oil_pressure: 58 * (fault.oil_press_mult || 1.0) + r() * 4,
    oil_temp: 190 + r() * 6 + (fault.oil_temp_offset || 0),
    coolant_temp: 180 + r() * 5 + (fault.coolant_offset || 0) + env.temp_offset * 0.3,
    vib_x: 0.8 * (fault.vib_mult || 1.0) + r() * 0.2,
    vib_y: 0.7 * (fault.vib_mult || 1.0) + r() * 0.2,
    vib_z: 1.0 * (fault.vib_mult || 1.0) + r() * 0.3,
    vib_rms: 1.5 * (fault.vib_mult || 1.0) + r() * 0.3,
    battery_voltage: 28.2 + r() * 0.3 + (fault.batt_offset || 0),
    alternator_current: 45 * (fault.alt_curr_mult || 1.0) + r() * 3,
    airspeed_kts: baseAirspeed + r() * 8,
    altitude_ft: baseAlt + r() * 500 + (env.alt_offset || 0),
    ambient_temp_c: 25 + r() * 4 + (env.temp_offset || 0)
  };

  // Derived
  sensor.cht_avg = (sensor.cht_1 + sensor.cht_2 + sensor.cht_3 + sensor.cht_4) / 4;
  sensor.egt_spread = Math.max(sensor.egt_1, sensor.egt_2, sensor.egt_3, sensor.egt_4) -
                      Math.min(sensor.egt_1, sensor.egt_2, sensor.egt_3, sensor.egt_4);

  // Simple ML-like prediction inline (no Python call needed for live)
  const faultClass = simState.fault_type;
  const isAnomaly = faultClass !== 'NOMINAL';
  const rul = faultClass === 'NOMINAL' ? 1200 + Math.random() * 600 : 80 + Math.random() * 300;
  const ehi = faultClass === 'NOMINAL' ? 93 + Math.random() * 6 : 40 + Math.random() * 35;
  const deg = 1.0 - ehi / 100;

  const prediction = {
    fault_class: faultClass,
    rul_hours: Math.round(rul * 10) / 10,
    ehi: Math.round(ehi * 10) / 10,
    degradation: Math.round(deg * 1000) / 1000,
    is_anomaly: isAnomaly,
    anomaly_score: isAnomaly ? -(0.1 + Math.random() * 0.3) : 0.1 + Math.random() * 0.2
  };

  return { sensor, prediction, timestamp: Date.now(), phase, mission_time_sec: simState.mission_time_sec };
}

function runSimulationTick() {
  if (!simState.running) return;
  simState.mission_time_sec += 2;
  simState.cycle++;
  const reading = generateSensorReading();
  simState.buffer.push(reading);
  if (simState.buffer.length > 300) simState.buffer.shift();
}

// ══════════════════════════════════════════════════════════════════
// API ROUTES
// ══════════════════════════════════════════════════════════════════

// Status
app.get('/api/status', (req, res) => {
  res.json({
    running: simState.running,
    mission_id: simState.mission_id,
    uav_tail: simState.uav_tail,
    flight_phase: simState.flight_phase,
    mission_time_sec: simState.mission_time_sec,
    cycle: simState.cycle,
    degradation: simState.degradation,
    fault_type: simState.fault_type,
    env_preset: simState.env_preset,
    uptime: process.uptime(),
    buffer_size: simState.buffer.length
  });
});

// Start simulation
app.post('/api/simulation/start', (req, res) => {
  const { env_preset, fault_type, mission_id } = req.body || {};
  if (env_preset) simState.env_preset = env_preset;
  if (fault_type) simState.fault_type = fault_type;
  if (mission_id) simState.mission_id = mission_id;

  if (simState.interval) clearInterval(simState.interval);
  simState.running = true;
  simState.mission_time_sec = 0;
  simState.cycle = 0;
  simState.buffer = [];
  simState.startTime = Date.now();
  simState.interval = setInterval(runSimulationTick, 2000);
  runSimulationTick(); // first tick immediately
  res.json({ status: 'SIMULATION_STARTED', mission_id: simState.mission_id });
});

// Stop simulation
app.post('/api/simulation/stop', (req, res) => {
  simState.running = false;
  if (simState.interval) { clearInterval(simState.interval); simState.interval = null; }
  res.json({ status: 'SIMULATION_STOPPED' });
});

// Configure simulation
app.post('/api/simulation/configure', (req, res) => {
  const { env_preset, fault_type } = req.body || {};
  if (env_preset && ENV_PRESETS[env_preset]) simState.env_preset = env_preset;
  if (fault_type && FAULT_PROFILES[fault_type]) simState.fault_type = fault_type;
  res.json({ env_preset: simState.env_preset, fault_type: simState.fault_type });
});

// Live telemetry
app.get('/api/telemetry/live', (req, res) => {
  if (simState.buffer.length === 0) {
    // Generate a one-shot reading even when sim not running
    const reading = generateSensorReading();
    return res.json(reading);
  }
  res.json(simState.buffer[simState.buffer.length - 1]);
});

// Telemetry history
app.get('/api/telemetry/history', (req, res) => {
  const n = parseInt(req.query.n) || 50;
  res.json(simState.buffer.slice(-n));
});

// ML Metrics
app.get('/api/ml/metrics', (req, res) => {
  const metricsPath = path.join(ARTIFACTS_DIR, 'metrics.json');
  if (!fs.existsSync(metricsPath)) return res.json({ error: 'No metrics found. Train model first.' });
  const metrics = JSON.parse(fs.readFileSync(metricsPath, 'utf-8'));
  res.json(metrics);
});

// ML Training
app.post('/api/train', (req, res) => {
  const { model, epochs, samples } = req.body || {};
  const args = [
    path.join(ML_DIR, 'train.py'),
    '--model', model || 'RandomForest',
    '--epochs', String(epochs || 12),
    '--samples', String(samples || 3000)
  ];
  const proc = spawn('python', args, { cwd: ML_DIR });
  proc.stdout.on('data', d => console.log(`[TRAIN] ${d}`));
  proc.stderr.on('data', d => console.error(`[TRAIN ERR] ${d}`));
  res.json({ status: 'TRAINING_STARTED', model: model || 'RandomForest' });
});

// Training progress
app.get('/api/train/progress', (req, res) => {
  const progPath = path.join(ARTIFACTS_DIR, 'training_progress.json');
  if (!fs.existsSync(progPath)) return res.json({ status: 'NO_TRAINING' });
  res.json(JSON.parse(fs.readFileSync(progPath, 'utf-8')));
});

// Python inference (one-shot)
app.get('/api/inference', (req, res) => {
  const proc = spawn('python', [path.join(ML_DIR, 'inference.py')], { cwd: ML_DIR });
  let output = '';
  proc.stdout.on('data', d => { output += d.toString(); });
  proc.stderr.on('data', d => console.error(`[INFER ERR] ${d}`));
  proc.on('close', () => {
    try {
      const lines = output.trim().split('\n');
      const jsonStr = lines.filter(l => l.startsWith('{')).join('\n');
      res.json(JSON.parse(jsonStr));
    } catch (e) {
      res.json({ error: 'Inference failed', raw: output });
    }
  });
});

// Environment presets list
app.get('/api/env-presets', (req, res) => {
  res.json(ENV_PRESETS);
});

// Fault profiles list
app.get('/api/fault-profiles', (req, res) => {
  res.json(Object.keys(FAULT_PROFILES));
});

// Catch-all: serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n  ╔════════════════════════════════════════════════════════╗`);
  console.log(`  ║  AEROTWIN · DRDO MALE UAV Propulsion Digital Twin     ║`);
  console.log(`  ║  Server running on http://localhost:${PORT}              ║`);
  console.log(`  ╚════════════════════════════════════════════════════════╝\n`);
});
