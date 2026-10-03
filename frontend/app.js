/* ══════════════════════════════════════════════════════════════════════════
   AEROTWIN · DRDO MALE UAV PROPULSION DIGITAL TWIN
   Complete Frontend Application (3D Twin + Charts + Simulation + ML)
══════════════════════════════════════════════════════════════════════════ */

const API = 'http://localhost:3001/api';
const state = {
  currentPage: 'overview',
  simRunning: false,
  simPollInterval: null,
  telemetryPollInterval: null,
  charts: {},
  chartData: { cht: [], rpm: [], map: [], vib: [], fuelFlow: [], oilPress: [] },
  alerts: [],
  activeComponent: 'cyl_head_2',
  voiceEnabled: true,
  lastPhase: null,
  lastFault: null
};

// ══════════════════════════════════════════════════════════════════
// VOICE TTS
// ══════════════════════════════════════════════════════════════════
function toggleVoice() {
  state.voiceEnabled = !state.voiceEnabled;
  const btn = document.getElementById('voice-toggle-btn');
  if (btn) btn.innerHTML = `<i data-lucide="${state.voiceEnabled ? 'volume-2' : 'volume-x'}" style="width:14px;height:14px;"></i> Voice: ${state.voiceEnabled ? 'ON' : 'OFF'}`;
  if (window.lucide) window.lucide.createIcons();
}
function announceVoice(msg) {
  if (!state.voiceEnabled || !window.speechSynthesis) return;
  const ut = new SpeechSynthesisUtterance(msg);
  ut.rate = 1.0; ut.pitch = 0.95;
  window.speechSynthesis.speak(ut);
}

// ══════════════════════════════════════════════════════════════════
// NAVIGATION
// ══════════════════════════════════════════════════════════════════
function switchPage(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const el = document.getElementById(`page-${page}`);
  if (el) el.classList.add('active');
  const nav = document.querySelector(`.nav-item[data-page="${page}"]`);
  if (nav) nav.classList.add('active');
  state.currentPage = page;

  if (page === 'analytics') loadMLMetrics();
  if (page === 'telemetry') startTelemetryPolling();
  else stopTelemetryPolling();
  
  // Fix 3D canvas sizing if they were initialized while hidden
  setTimeout(() => {
    if (page === 'overview' && heroTwin) heroTwin.onResize();
    if (page === 'twin' && studioTwin) studioTwin.onResize();
    if (page === 'simulation' && fsTwin) fsTwin.onResize();
  }, 50);
}

// ══════════════════════════════════════════════════════════════════
// THEME TOGGLE
// ══════════════════════════════════════════════════════════════════
function toggleTheme() {
  const html = document.documentElement;
  const isDark = html.getAttribute('data-theme') === 'dark';
  html.setAttribute('data-theme', isDark ? 'light' : 'dark');
  document.getElementById('theme-icon').setAttribute('data-lucide', isDark ? 'moon' : 'sun');
  if (window.lucide) window.lucide.createIcons();
  document.getElementById('theme-label').textContent = isDark ? 'Dark Mode' : 'Light Mode';
  localStorage.setItem('aerotwin-theme', isDark ? 'light' : 'dark');

  // Update chart colors
  Object.values(state.charts).forEach(c => {
    if (c && c.options) {
      const txtColor = isDark ? '#475569' : '#94a3b8';
      const gridColor = isDark ? '#e2e8f0' : '#2d3a4d';
      if (c.options.scales?.x) { c.options.scales.x.ticks.color = txtColor; c.options.scales.x.grid.color = gridColor; }
      if (c.options.scales?.y) { c.options.scales.y.ticks.color = txtColor; c.options.scales.y.grid.color = gridColor; }
      c.update('none');
    }
  });
}

function initTheme() {
  const saved = localStorage.getItem('aerotwin-theme');
  if (saved === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    document.getElementById('theme-icon').setAttribute('data-lucide', 'sun');
    document.getElementById('theme-label').textContent = 'Light Mode';
  }
}

// ══════════════════════════════════════════════════════════════════
// 3D MALE UAV DIGITAL TWIN (Three.js 360° Engine)
// ══════════════════════════════════════════════════════════════════
class MaleUAVDigitalTwin {
  constructor(containerId, isStudio = false) {
    this.container = document.getElementById(containerId);
    if (!this.container) return;
    this.isStudio = isStudio;
    this.viewMode = 'exterior';
    this.exploded = false;
    this.autoRotate = true;
    this.showPins = true;
    this.parts = {};
    this.hotspots = {};
    this.particles = null;
    this.init();
  }

  init() {
    const w = this.container.clientWidth || 800;
    const h = this.container.clientHeight || 400;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x0a1424, 0.010);
    this.camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 1000);
    this.camera.position.set(11, 7, 13);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.container.appendChild(this.renderer.domElement);

    if (typeof THREE.OrbitControls !== 'undefined') {
      this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.06;
      this.controls.minDistance = 2.0;
      this.controls.maxDistance = 55.0;
      this.controls.minPolarAngle = 0.001;
      this.controls.maxPolarAngle = Math.PI - 0.001;
      this.controls.autoRotate = this.autoRotate;
      this.controls.autoRotateSpeed = 2.0;
      this.controls.target.set(0, 0, 0);
    }

    // 360° Omni-directional Lighting
    this.scene.add(new THREE.AmbientLight(0xffffff, 1.15));
    const dirTop = new THREE.DirectionalLight(0x38bdf8, 1.3); dirTop.position.set(12, 18, 10); this.scene.add(dirTop);
    const dirRear = new THREE.DirectionalLight(0x2563eb, 1.0); dirRear.position.set(-12, 4, -12); this.scene.add(dirRear);
    const dirBottom = new THREE.DirectionalLight(0x60a5fa, 0.9); dirBottom.position.set(0, -15, 2); this.scene.add(dirBottom);
    const dirFront = new THREE.DirectionalLight(0xffffff, 0.7); dirFront.position.set(0, 3, 15); this.scene.add(dirFront);

    const grid = new THREE.GridHelper(26, 26, 0x38bdf8, 0x1e293b); grid.position.y = -3.2; this.scene.add(grid);

    this.build3DModel();
    this.buildHotspots();
    this.buildStreamlines();
    window.addEventListener('resize', () => this.onResize());
    this.animate();
  }

  build3DModel() {
    this.rootGroup = new THREE.Group();
    this.uavGroup = new THREE.Group();
    const matAirframe = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.28, metalness: 0.45 });
    const matRadome = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.2 });
    const matPod = new THREE.MeshStandardMaterial({ color: 0x0ea5e9, roughness: 0.15, metalness: 0.8 });

    // Fuselage
    const fuseGeo = new THREE.CylinderGeometry(0.75, 0.9, 8.5, 32); fuseGeo.rotateX(Math.PI / 2);
    this.parts.fuselage = new THREE.Mesh(fuseGeo, matAirframe); this.uavGroup.add(this.parts.fuselage);

    // Nose
    const noseGeo = new THREE.SphereGeometry(0.78, 24, 24); noseGeo.scale(0.9, 0.85, 2.0);
    this.parts.nose = new THREE.Mesh(noseGeo, matRadome); this.parts.nose.position.set(0, 0.25, 4.2); this.uavGroup.add(this.parts.nose);

    // Pitot probe
    const pitotGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.2, 12); pitotGeo.rotateX(Math.PI / 2);
    const pitot = new THREE.Mesh(pitotGeo, new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.7 }));
    pitot.position.set(0, 0.25, 6.4); this.uavGroup.add(pitot);

    // Gimbal pod
    const gimbal = new THREE.Mesh(new THREE.SphereGeometry(0.42, 20, 20), matPod);
    gimbal.position.set(0, -0.75, 2.8); this.uavGroup.add(gimbal);

    // SATCOM fairing
    const satGeo = new THREE.CylinderGeometry(0.35, 0.45, 2.8, 16); satGeo.rotateX(Math.PI / 2); satGeo.scale(1, 0.5, 1);
    const satcom = new THREE.Mesh(satGeo, matAirframe); satcom.position.set(0, 0.85, 1.8); this.uavGroup.add(satcom);

    // Wings
    this.parts.wings = new THREE.Mesh(new THREE.BoxGeometry(16.4, 0.12, 1.6), matAirframe);
    this.parts.wings.position.set(0, 0.3, 0.5); this.uavGroup.add(this.parts.wings);

    // Winglets
    const wlGeo = new THREE.BoxGeometry(0.1, 1.1, 0.9);
    const wlL = new THREE.Mesh(wlGeo, matAirframe); wlL.position.set(-8.2, 0.7, 0.5); wlL.rotation.z = -0.3; this.uavGroup.add(wlL);
    const wlR = new THREE.Mesh(wlGeo, matAirframe); wlR.position.set(8.2, 0.7, 0.5); wlR.rotation.z = 0.3; this.uavGroup.add(wlR);

    // V-Tail
    const tailGeo = new THREE.BoxGeometry(0.12, 2.6, 1.2);
    this.parts.tail_l = new THREE.Mesh(tailGeo, matAirframe); this.parts.tail_l.position.set(-1.2, -0.7, -4.2); this.parts.tail_l.rotation.z = 0.45; this.uavGroup.add(this.parts.tail_l);
    this.parts.tail_r = new THREE.Mesh(tailGeo, matAirframe); this.parts.tail_r.position.set(1.2, -0.7, -4.2); this.parts.tail_r.rotation.z = -0.45; this.uavGroup.add(this.parts.tail_r);

    // LANDING GEAR (Chakka / Wheels)
    const matTire = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
    const matStrut = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8 });
    const tireGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.25, 20); tireGeo.rotateZ(Math.PI/2);
    const strutGeo = new THREE.CylinderGeometry(0.08, 0.08, 1.8, 12);
    
    // Nose Gear
    const noseStrut = new THREE.Mesh(strutGeo, matStrut); noseStrut.position.set(0, -1.2, 3.8); this.uavGroup.add(noseStrut);
    this.parts.wheel_nose = new THREE.Mesh(tireGeo, matTire); this.parts.wheel_nose.position.set(0, -2.1, 3.8); this.uavGroup.add(this.parts.wheel_nose);
    
    // Main Gear Left
    const mainStrutL = new THREE.Mesh(strutGeo, matStrut); mainStrutL.position.set(-1.5, -1.2, -0.5); mainStrutL.rotation.z = 0.2; this.uavGroup.add(mainStrutL);
    this.parts.wheel_l = new THREE.Mesh(tireGeo, matTire); this.parts.wheel_l.position.set(-1.8, -2.1, -0.5); this.uavGroup.add(this.parts.wheel_l);
    
    // Main Gear Right
    const mainStrutR = new THREE.Mesh(strutGeo, matStrut); mainStrutR.position.set(1.5, -1.2, -0.5); mainStrutR.rotation.z = -0.2; this.uavGroup.add(mainStrutR);
    this.parts.wheel_r = new THREE.Mesh(tireGeo, matTire); this.parts.wheel_r.position.set(1.8, -2.1, -0.5); this.uavGroup.add(this.parts.wheel_r);

    this.rootGroup.add(this.uavGroup);

    // ENGINE
    this.engineGroup = new THREE.Group(); this.engineGroup.position.set(0, 0.1, -2.5);
    const matCrank = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.85, roughness: 0.25 });
    const matCyl = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.65, roughness: 0.35 });
    const matTurbo = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.9, roughness: 0.2 });
    const matExh = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8, roughness: 0.4 });

    this.parts.crankcase = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.4, 2.4), matCrank); this.engineGroup.add(this.parts.crankcase);

    // Oil sump
    this.engineGroup.add(new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.4, 1.8), new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.7 })).translateY(-0.85));

    const cylGeo = new THREE.CylinderGeometry(0.5, 0.5, 1.3, 16); cylGeo.rotateZ(Math.PI / 2);
    this.parts.cyl_1 = new THREE.Mesh(cylGeo, matCyl.clone()); this.parts.cyl_1.position.set(-1.4, 0.15, 0.6); this.engineGroup.add(this.parts.cyl_1);
    this.parts.cyl_2 = new THREE.Mesh(cylGeo, matCyl.clone()); this.parts.cyl_2.position.set(1.4, 0.15, 0.6); this.engineGroup.add(this.parts.cyl_2);
    this.parts.cyl_3 = new THREE.Mesh(cylGeo, matCyl.clone()); this.parts.cyl_3.position.set(-1.4, -0.15, -0.6); this.engineGroup.add(this.parts.cyl_3);
    this.parts.cyl_4 = new THREE.Mesh(cylGeo, matCyl.clone()); this.parts.cyl_4.position.set(1.4, -0.15, -0.6); this.engineGroup.add(this.parts.cyl_4);

    // Turbo
    const tGeo = new THREE.TorusGeometry(0.38, 0.18, 16, 24); tGeo.rotateX(Math.PI / 2);
    const turbo = new THREE.Mesh(tGeo, matTurbo); turbo.position.set(0, -0.6, -0.8); this.engineGroup.add(turbo);

    // Exhaust pipes
    const pGeo = new THREE.CylinderGeometry(0.1, 0.1, 1.6, 12); pGeo.rotateZ(Math.PI / 3);
    const exhL = new THREE.Mesh(pGeo, matExh); exhL.position.set(-0.9, -0.4, 0); this.engineGroup.add(exhL);
    const exhR = new THREE.Mesh(pGeo, matExh); exhR.position.set(0.9, -0.4, 0); exhR.rotation.z = -Math.PI / 3; this.engineGroup.add(exhR);

    // Prop
    const hubGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.6, 20); hubGeo.rotateX(Math.PI / 2);
    this.parts.propHub = new THREE.Mesh(hubGeo, matRadome); this.parts.propHub.position.set(0, 0, -2.0);
    this.parts.propBladesGroup = new THREE.Group();
    const blGeo = new THREE.BoxGeometry(0.18, 2.2, 0.05);
    const blMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.3 });
    const b1 = new THREE.Mesh(blGeo, blMat); b1.position.y = 1.1; this.parts.propBladesGroup.add(b1);
    const b2 = new THREE.Mesh(blGeo, blMat); b2.position.set(-0.95, -0.55, 0); b2.rotation.z = (2 * Math.PI) / 3; this.parts.propBladesGroup.add(b2);
    const b3 = new THREE.Mesh(blGeo, blMat); b3.position.set(0.95, -0.55, 0); b3.rotation.z = -(2 * Math.PI) / 3; this.parts.propBladesGroup.add(b3);
    this.parts.propHub.add(this.parts.propBladesGroup);
    this.engineGroup.add(this.parts.propHub);
    this.rootGroup.add(this.engineGroup);
    this.scene.add(this.rootGroup);
  }

  buildHotspots() {
    this.hotspotGroup = new THREE.Group();
    const defs = [
      { id: 'cyl_head_2', pos: [1.8, 0.3, -1.9] }, { id: 'crank_bearings', pos: [0, 0.1, -2.5] },
      { id: 'injector_rail', pos: [-1.4, 0.7, -2.2] }, { id: 'turbocharger', pos: [0, -0.7, -3.3] },
      { id: 'cooling_jacket', pos: [0, 0.8, -3.2] }
    ];
    defs.forEach(d => {
      const pin = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 16), new THREE.MeshBasicMaterial({ color: 0x38bdf8 }));
      pin.position.set(...d.pos);
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.24, 0.32, 20), new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide }));
      ring.rotation.x = Math.PI / 2; pin.add(ring);
      this.hotspots[d.id] = { pin, ring }; this.hotspotGroup.add(pin);
    });
    this.scene.add(this.hotspotGroup);
  }

  buildStreamlines() {
    const count = 140, pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) { pos[i*3] = (Math.random()-0.5)*18; pos[i*3+1] = (Math.random()-0.5)*4; pos[i*3+2] = (Math.random()-0.5)*16; }
    const geom = new THREE.BufferGeometry(); geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.particles = new THREE.Points(geom, new THREE.PointsMaterial({ color: 0x38bdf8, size: 0.09, transparent: true, opacity: 0.65 }));
    this.scene.add(this.particles);
  }

  setMode(mode) {
    this.viewMode = mode;
    this.uavGroup.visible = true;
    this.parts.fuselage.material.wireframe = false;
    this.parts.fuselage.material.opacity = 1.0;
    this.parts.fuselage.material.transparent = false;
    this.parts.fuselage.material.color.setHex(0xe2e8f0);
    [this.parts.cyl_1, this.parts.cyl_2, this.parts.cyl_3, this.parts.cyl_4].forEach(c => c.material.color.setHex(0x1e293b));

    if (mode === 'engine') { this.uavGroup.visible = false; }
    else if (mode === 'cutaway' || mode === 'xray') { this.parts.fuselage.material.wireframe = true; this.parts.fuselage.material.color.setHex(0x38bdf8); }
    else if (mode === 'thermal') {
      this.uavGroup.visible = false;
      this.parts.cyl_1.material.color.setHex(0xd97706); this.parts.cyl_2.material.color.setHex(0xdc2626);
      this.parts.cyl_3.material.color.setHex(0xd97706); this.parts.cyl_4.material.color.setHex(0xd97706);
    }
  }

  updateFromTelemetry(s, p) {
    if (!s || !p) return;
    this.latestRpm = s.rpm || 0;
    this.latestVib = s.vib_rms || 0;
    const f = p.fault_class || 'NOMINAL';
    if (this.viewMode !== 'thermal') {
      [this.parts.cyl_1, this.parts.cyl_2, this.parts.cyl_3, this.parts.cyl_4].forEach(c => c.material.color.setHex(0x1e293b));
      this.parts.crankcase.material.color.setHex(0x475569);
      if (f === 'CYLINDER_MISFIRE') this.parts.cyl_2.material.color.setHex(0xdc2626);
      else if (f === 'INJECTOR_CLOGGING') this.parts.cyl_3.material.color.setHex(0xd97706);
      else if (f === 'COOLING_DEGRADATION') [this.parts.cyl_1, this.parts.cyl_2, this.parts.cyl_3, this.parts.cyl_4].forEach(c => c.material.color.setHex(0xdc2626));
      else if (f === 'LUBRICATION_FAILURE') this.parts.crankcase.material.color.setHex(0xdc2626);
    }
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('hud-rpm', Math.round(s.rpm).toLocaleString());
    set('hud-map', (s.manifold_pressure || 0).toFixed(1) + ' inHg');
    set('hud-cht', (s.cht_avg || 0).toFixed(1) + ' °F');
    set('hud-egt-spread', (s.egt_spread || 0).toFixed(1) + ' °F');
    set('hud-oil-p', (s.oil_pressure || 0).toFixed(1) + ' PSI');
    const hs = document.getElementById('hud-status');
    if (hs) { hs.textContent = f === 'NOMINAL' ? 'OPTIMAL' : f; hs.style.color = f === 'NOMINAL' ? '#059669' : '#dc2626'; }
  }

  setCameraAngle(preset) {
    if (!this.controls) return;
    const targets = {
      iso: { pos: [11,7,13], target: [0,0,0] }, top: { pos: [0,20,0.001], target: [0,0,0] },
      bottom: { pos: [0,-18,0.001], target: [0,0,0] }, front: { pos: [0,0.6,14], target: [0,0.2,0] },
      rear: { pos: [0,1.2,-14], target: [0,0.2,-1.5] }, left: { pos: [-18,1.2,0], target: [0,0,0] },
      right: { pos: [18,1.2,0], target: [0,0,0] }, engine: { pos: [3.4,2.4,-2.2], target: [0,0.2,-2.5] },
      'cyl_head_2': { pos: [3.0, 1.2, -1.0], target: [1.4, 0.15, -2.5] },
      'crank_bearings': { pos: [0, -2.5, -0.5], target: [0, 0.1, -2.5] },
      'injector_rail': { pos: [-3.0, 1.5, -1.5], target: [-1.4, 0.7, -2.2] },
      'turbocharger': { pos: [0, -1.8, -5.0], target: [0, -0.6, -3.3] },
      'cooling_jacket': { pos: [0, 2.8, -5.0], target: [0, 0.8, -3.2] }
    };
    const dest = targets[preset] || targets.iso;
    const sP = this.camera.position.clone(), eP = new THREE.Vector3(...dest.pos);
    const sT = this.controls.target.clone(), eT = new THREE.Vector3(...dest.target);
    const dur = 650, start = performance.now();
    const anim = (now) => {
      const p = Math.min((now - start) / dur, 1.0);
      const ease = p < 0.5 ? 2*p*p : -1+(4-2*p)*p;
      this.camera.position.lerpVectors(sP, eP, ease);
      this.controls.target.lerpVectors(sT, eT, ease);
      this.controls.update();
      if (p < 1.0) requestAnimationFrame(anim);
    };
    requestAnimationFrame(anim);
  }

  toggleAutoRotate() {
    this.autoRotate = !this.autoRotate;
    if (this.controls) this.controls.autoRotate = this.autoRotate;
    return this.autoRotate;
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    const t = Date.now() * 0.001;
    
    // Dynamic Propeller mapping (RPM 0 -> 0 rot, RPM 3000 -> fast rot)
    const rpmVal = this.latestRpm || 0;
    const propSpeed = rpmVal > 100 ? (rpmVal / 2000) * 0.5 : 0.05; // Fallback so it doesn't look dead
    if (this.parts.propBladesGroup) this.parts.propBladesGroup.rotation.z -= propSpeed;
    
    // Spin the wheels (chakka) continuously for dynamic UI look
    if (this.parts.wheel_nose) {
       const wheelSpeed = propSpeed * 0.4;
       this.parts.wheel_nose.rotation.x -= wheelSpeed;
       this.parts.wheel_l.rotation.x -= wheelSpeed;
       this.parts.wheel_r.rotation.x -= wheelSpeed;
    }
    
    // Physical Engine Vibration based on telemetry vib_rms
    const vib = this.latestVib || 0;
    if (this.engineGroup) {
      if (vib > 1.0) {
        const intensity = (vib - 1.0) * 0.05;
        this.engineGroup.position.set(
          (Math.random()-0.5)*intensity,
          0.1 + (Math.random()-0.5)*intensity,
          -2.5 + (Math.random()-0.5)*intensity
        );
      } else {
        this.engineGroup.position.set(0, 0.1, -2.5); // Reset to stable
      }
    }

    if (this.particles) {
      const arr = this.particles.geometry.attributes.position.array;
      for (let i = 0; i < arr.length; i += 3) { arr[i+2] -= 0.22; if (arr[i+2] < -8) arr[i+2] = 8; }
      this.particles.geometry.attributes.position.needsUpdate = true;
    }
    Object.values(this.hotspots).forEach(({ ring }) => { const s = 1.0 + Math.sin(t*5)*0.2; ring.scale.set(s,s,s); });
    
    // Exploded View logic
    if (this.exploded && this.parts.cyl_1) {
      this.parts.cyl_1.position.x = -2.5; this.parts.cyl_2.position.x = 2.5; 
      this.parts.cyl_3.position.x = -2.5; this.parts.cyl_4.position.x = 2.5;
      this.parts.cyl_1.position.y = 1.0; this.parts.cyl_2.position.y = 1.0;
      this.parts.cyl_3.position.y = -1.0; this.parts.cyl_4.position.y = -1.0;
    } else if (this.parts.cyl_1) {
      this.parts.cyl_1.position.x = -1.4; this.parts.cyl_2.position.x = 1.4; 
      this.parts.cyl_3.position.x = -1.4; this.parts.cyl_4.position.x = 1.4;
      this.parts.cyl_1.position.y = 0.15; this.parts.cyl_2.position.y = 0.15;
      this.parts.cyl_3.position.y = -0.15; this.parts.cyl_4.position.y = -0.15;
    }
    if (this.controls) this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  onResize() {
    if (!this.container) return;
    const w = this.container.clientWidth, h = this.container.clientHeight;
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); this.renderer.setSize(w, h);
  }
}

// ══════════════════════════════════════════════════════════════════
// 3D FLIGHT SIMULATOR (MISSION VIEW)
// ══════════════════════════════════════════════════════════════════
class FlightSimulator3D {
  constructor(canvasId) {
    this.container = document.getElementById(canvasId);
    if (!this.container) return;
    
    const T = THREE;
    this.renderer = new T.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    
    const w = this.container.clientWidth || 800;
    const h = this.container.clientHeight || 400;
    this.renderer.setSize(w, h);
    
    this.container.innerHTML = ''; 
    this.container.appendChild(this.renderer.domElement);

    this.scene = new T.Scene();
    this.scene.background = new T.Color(0x0E1518);
    this.scene.fog = new T.Fog(0x0E1518, 200, 950);
    this.camera = new T.PerspectiveCamera(52, w / h, 0.5, 4000);

    this.scene.add(new T.HemisphereLight(0x9FC4D8, 0x14202A, 1.2));
    const sun = new T.DirectionalLight(0xFFEAC6, 1.5);
    sun.position.set(60, 120, 40); 
    this.scene.add(sun);

    this.grid = new T.GridHelper(2400, 60, 0x2A4551, 0x1B3039); 
    this.scene.add(this.grid);
    
    this.disc = new T.Mesh(new T.CircleGeometry(1200, 64), new T.MeshBasicMaterial({ color: 0x0B1215 }));
    this.disc.rotation.x = -Math.PI / 2; 
    this.disc.position.y = -0.6; 
    this.scene.add(this.disc);

    const skin  = new T.MeshStandardMaterial({ color: 0xC6CFD4, roughness: 0.6, metalness: 0.2 });
    const trim  = new T.MeshStandardMaterial({ color: 0x3C4A54, roughness: 0.75 });
    const glass = new T.MeshStandardMaterial({ color: 0x1E2F38, roughness: 0.25, metalness: 0.6 });

    this.uavGroup = new T.Group();
    const fus = new T.Mesh(new T.CylinderGeometry(1.25, 1.0, 12, 16), skin);
    fus.rotation.z = Math.PI / 2; 
    this.uavGroup.add(fus);
    
    const nose = new T.Mesh(new T.SphereGeometry(1.25, 16, 12), skin);
    nose.position.x = 6; 
    nose.scale.x = 1.5; 
    this.uavGroup.add(nose);
    
    const ball = new T.Mesh(new T.SphereGeometry(1.0, 14, 12), glass);
    ball.position.set(4.3, -1.05, 0); 
    this.uavGroup.add(ball);
    
    const wing = new T.Mesh(new T.BoxGeometry(2.0, 0.32, 34), skin);
    wing.position.set(0.4, 1.25, 0); 
    this.uavGroup.add(wing);
    
    [-1, 1].forEach(k => {
      const tip = new T.Mesh(new T.BoxGeometry(1.5, 1.5, 0.3), trim);
      tip.position.set(0.4, 1.9, k * 17); 
      this.uavGroup.add(tip);
      
      const boom = new T.Mesh(new T.CylinderGeometry(0.4, 0.4, 13, 10), trim);
      boom.rotation.z = Math.PI / 2; 
      boom.position.set(-4.5, 1.1, k * 5.2); 
      this.uavGroup.add(boom);
      
      const fin = new T.Mesh(new T.BoxGeometry(2.4, 4.2, 0.28), trim);
      fin.position.set(-10, 2.9, k * 5.2); 
      this.uavGroup.add(fin);
    });
    
    const stab = new T.Mesh(new T.BoxGeometry(2.4, 0.26, 11.4), trim);
    stab.position.set(-10, 4.7, 0); 
    this.uavGroup.add(stab);

    this.prop = new T.Group();
    const spin = new T.Mesh(new T.ConeGeometry(0.62, 1.3, 12), trim);
    spin.rotation.z = Math.PI / 2; 
    spin.position.x = -0.55; 
    this.prop.add(spin);
    
    for (let i = 0; i < 2; i++) {
      const b = new T.Mesh(new T.BoxGeometry(0.16, 6.6, 0.5), trim);
      b.rotation.x = i * Math.PI / 2; 
      this.prop.add(b);
    }
    this.prop.position.x = -6.4; 
    this.uavGroup.add(this.prop);
    
    this.uavGroup.scale.setScalar(1.45); 
    this.scene.add(this.uavGroup);

    this.halo = new T.Mesh(
      new T.SphereGeometry(8.5, 20, 14),
      new T.MeshBasicMaterial({ color: 0xD9615A, transparent: true, opacity: 0, side: T.BackSide })
    );
    this.uavGroup.add(this.halo);

    this.TRAIL = 190;
    this.tgeo = new T.BufferGeometry(); 
    this.tpos = new Float32Array(this.TRAIL * 3);
    for (let i = 0; i < this.TRAIL; i++) { this.tpos[i * 3 + 1] = 16; }
    this.tgeo.setAttribute("position", new T.BufferAttribute(this.tpos, 3));
    this.scene.add(new T.Line(this.tgeo, new T.LineBasicMaterial({ color: 0x3E7D96, transparent: true, opacity: 0.6 })));

    this.yaw = 0.38; 
    this.pitch = 0.18; 
    this.dist = 46; 
    this.drag = false; 
    this.lx = 0; 
    this.ly = 0;

    this.renderer.domElement.addEventListener("pointerdown", e => {
      this.drag = true; this.lx = e.clientX; this.ly = e.clientY; 
      this.renderer.domElement.setPointerCapture(e.pointerId);
    });
    this.renderer.domElement.addEventListener("pointerup", () => { this.drag = false; });
    this.renderer.domElement.addEventListener("pointermove", e => {
      if (!this.drag) return;
      this.yaw -= (e.clientX - this.lx) * 0.006;
      this.pitch = Math.max(-0.3, Math.min(1.1, this.pitch + (e.clientY - this.ly) * 0.005));
      this.lx = e.clientX; this.ly = e.clientY;
    });
    this.renderer.domElement.addEventListener("wheel", e => {
      e.preventDefault(); 
      this.dist = Math.max(26, Math.min(230, this.dist + e.deltaY * 0.09));
    }, { passive: false });

    window.addEventListener('resize', () => this.onResize());
    
    this.simAlt = 0;
    this.simRpm = 0;
    this.simGx = 0;
    this.simHealth = 1.0;
    
    this.animate();
  }
  
  updateState(sensor, pred, env) {
    if (!sensor) return;
    this.simAlt = sensor.altitude_ft * 0.3048 || 0; // m
    this.simRpm = sensor.rpm || 0;
    this.simGx += (sensor.airspeed_kts || 0) * 0.03;
    
    const ehi = pred?.ehi || 100;
    this.simHealth = ehi / 100.0;
    
    if (this.simHealth < 0.55) {
      this.halo.material.opacity = 0.11;
      this.halo.material.color.setHex(0xD9615A);
    } else if (this.simHealth < 0.85) {
      this.halo.material.opacity = 0.05;
      this.halo.material.color.setHex(0xDFAC45);
    } else {
      this.halo.material.opacity = 0;
    }

    let bg = 0x87CEEB, grid1 = 0x4d7c0f, grid2 = 0x2d4c08, discColor = 0x4d7c0f; // STANDARD_ISA
    if (env === 'HOT_DESERT_48C') { bg = 0xedc9af; grid1 = 0xcd853f; grid2 = 0x8b4513; discColor = 0xcd853f; }
    else if (env === 'HIGH_ALTITUDE_25K') { bg = 0x0E1518; grid1 = 0x2A4551; grid2 = 0x1B3039; discColor = 0x0B1215; }
    else if (env === 'COLD_ARCTIC') { bg = 0xe2e8f0; grid1 = 0x94a3b8; grid2 = 0x64748b; discColor = 0xffffff; }
    else if (env === 'TROPICAL_MARITIME') { bg = 0x0ea5e9; grid1 = 0x0284c7; grid2 = 0x0369a1; discColor = 0x0ea5e9; }
    
    this.scene.background.setHex(bg);
    this.scene.fog.color.setHex(bg);
    this.grid.color1 = new THREE.Color(grid1);
    this.grid.color2 = new THREE.Color(grid2);
    this.grid.material.color.setHex(grid1);
    this.disc.material.color.setHex(discColor);
  }
  
  animate() {
    requestAnimationFrame(() => this.animate());
    
    // Convert 7000m to actual Y axis positioning. 
    // Wait! In original code it was alt/7000*150 + 16.
    // Let's cap the altitude visual representation so it doesn't go off screen
    // or maybe the camera wasn't tracking properly?
    const yPos = this.simAlt / 7000 * 150 + 16;
    this.uavGroup.position.set(this.simGx, yPos, 0);
    this.uavGroup.rotation.x = 0; 
    this.uavGroup.rotation.z = 0; 
    
    this.prop.rotation.x += this.simRpm/5500 * 0.9;
    
    this.grid.position.x = Math.round(this.simGx/40)*40;
    this.disc.position.x = this.simGx;
    
    this.tpos.copyWithin(0, 3);
    this.tpos[(this.TRAIL-1)*3] = this.uavGroup.position.x;
    this.tpos[(this.TRAIL-1)*3+1] = this.uavGroup.position.y;
    this.tpos[(this.TRAIL-1)*3+2] = 0;
    this.tgeo.attributes.position.needsUpdate = true;
    
    this.camera.position.set(
      this.uavGroup.position.x - Math.cos(this.yaw)*this.dist,
      this.uavGroup.position.y + Math.sin(this.pitch)*this.dist + 6,
      this.uavGroup.position.z - Math.sin(this.yaw)*this.dist
    );
    this.camera.lookAt(this.uavGroup.position);
    
    this.renderer.render(this.scene, this.camera);
  }
  
  onResize() {
    if (!this.container) return;
    const w = this.container.clientWidth || 800;
    const h = this.container.clientHeight || 400;
    this.camera.aspect = w / h; 
    this.camera.updateProjectionMatrix(); 
    this.renderer.setSize(w, h);
  }
}

let heroTwin = null, studioTwin = null, fsTwin = null;

function init3D() {
  document.getElementById('flight-sim-canvas').innerHTML = '<h1 style="color:red; z-index:9999;">init3D started</h1>';
  if (document.getElementById('overview-3d-canvas')) {
    try { heroTwin = new MaleUAVDigitalTwin('overview-3d-canvas', false); } catch(e) { document.getElementById('flight-sim-canvas').innerHTML += '<br>heroTwin error: ' + e; }
  }
  if (document.getElementById('studio-3d-canvas')) {
    try { studioTwin = new MaleUAVDigitalTwin('studio-3d-canvas', true); } catch(e) { document.getElementById('flight-sim-canvas').innerHTML += '<br>studioTwin error: ' + e; }
  }
  if (document.getElementById('flight-sim-canvas')) {
    try { 
      fsTwin = new FlightSimulator3D('flight-sim-canvas'); 
    } catch(e) { 
      document.getElementById('flight-sim-canvas').innerHTML += '<br>fsTwin error: ' + e; 
    }
  }
}

function setHero3DMode(m) {
  document.querySelectorAll('.hero-controls button').forEach(b => b.classList.remove('active'));
  document.getElementById(`hero-btn-${m}`)?.classList.add('active');
  if (heroTwin) heroTwin.setMode(m);
}
function setHeroCameraAngle(a) { if (heroTwin) heroTwin.setCameraAngle(a); }
function toggleHeroOrbit() {
  if (!heroTwin) return;
  const on = heroTwin.toggleAutoRotate();
  const btn = document.getElementById('hero-v360-orbit');
  if (btn) { btn.classList.toggle('active', on); btn.textContent = `🔄 Auto-Spin: ${on ? 'ON' : 'OFF'}`; }
}
function resetHeroCamera() { if (heroTwin) heroTwin.setCameraAngle('iso'); }

function setStudioView(m) {
  document.querySelectorAll('#page-twin .btn-group button').forEach(b => {
    if(b.id !== 'studio-btn-explode' && !b.id.includes('pins') && !b.id.includes('orbit')) b.classList.remove('active', 'btn-primary');
    if(b.id !== 'studio-btn-explode' && !b.id.includes('pins') && !b.id.includes('orbit')) b.classList.add('btn-ghost');
  });
  const btn = document.getElementById(`studio-btn-${m}`);
  if(btn) { btn.classList.add('active', 'btn-primary'); btn.classList.remove('btn-ghost'); }
  if (studioTwin) studioTwin.setMode(m);
}

function toggleExplodedEngine() {
  const btn = document.getElementById('studio-btn-explode');
  if (studioTwin) {
    studioTwin.exploded = !studioTwin.exploded;
    if (studioTwin.exploded) {
      btn.classList.add('active', 'btn-primary');
      btn.classList.remove('btn-ghost');
    } else {
      btn.classList.remove('active', 'btn-primary');
      btn.classList.add('btn-ghost');
    }
  }
}
function setStudioCameraAngle(a) { if (studioTwin) studioTwin.setCameraAngle(a); }
function toggleStudioPins() { if (!studioTwin) return; studioTwin.hotspotGroup.visible = !studioTwin.hotspotGroup.visible; const b = document.getElementById('studio-btn-pins'); if (b) b.textContent = `CAN Nodes: ${studioTwin.hotspotGroup.visible ? 'ON' : 'OFF'}`; }
function toggleStudioOrbit() {
  if (!studioTwin) return;
  const on = studioTwin.toggleAutoRotate();
  const b = document.getElementById('studio-btn-orbit'); if (b) b.textContent = `Auto-Orbit: ${on ? 'ON' : 'OFF'}`;
  const bh = document.getElementById('studio-v360-orbit'); if (bh) { bh.classList.toggle('active', on); bh.textContent = `🔄 Auto-Spin: ${on ? 'ON' : 'OFF'}`; }
}
function resetStudioCamera() { if (studioTwin) studioTwin.setCameraAngle('iso'); }

function focusComponent(id) {
  state.activeComponent = id;
  document.querySelectorAll('.insp-item').forEach(el => el.classList.remove('active'));
  if (event && event.target) {
    const item = event.target.closest('.insp-item');
    if (item) item.classList.add('active');
  }

  // 1. Move camera to the component
  if (studioTwin) studioTwin.setCameraAngle(id);
  
  // 2. Update the Detail Pane
  const titles = {
    'cyl_head_2': 'Cylinder #2 & Spark Lead (CAN 0x284)',
    'crank_bearings': 'Crankshaft & Main Journal (CAN 0x1A2)',
    'injector_rail': 'Fuel Injector Rail (CAN 0x33F)',
    'turbocharger': 'Turbocharger & Wastegate (CAN 0x4B1)',
    'cooling_jacket': 'Liquid Cooling Radiator (CAN 0x5C0)'
  };
  
  const bodies = {
    'cyl_head_2': '<div class="detail-row"><span>CAN ID</span><span class="mono">0x284 (FADEC_CYL2)</span></div><div class="detail-row"><span>Sample Rate</span><span class="mono">100 Hz</span></div><div class="detail-row"><span>Status</span><strong class="green-text">NOMINAL</strong></div>',
    'crank_bearings': '<div class="detail-row"><span>CAN ID</span><span class="mono">0x1A2 (FADEC_CRANK)</span></div><div class="detail-row"><span>Sample Rate</span><span class="mono">200 Hz</span></div><div class="detail-row"><span>Status</span><strong class="green-text">NOMINAL</strong></div>',
    'injector_rail': '<div class="detail-row"><span>CAN ID</span><span class="mono">0x33F (FADEC_INJ)</span></div><div class="detail-row"><span>Sample Rate</span><span class="mono">50 Hz</span></div><div class="detail-row"><span>Status</span><strong class="green-text">NOMINAL</strong></div>',
    'turbocharger': '<div class="detail-row"><span>CAN ID</span><span class="mono">0x4B1 (FADEC_BOOST)</span></div><div class="detail-row"><span>Sample Rate</span><span class="mono">50 Hz</span></div><div class="detail-row"><span>Status</span><strong class="green-text">NOMINAL</strong></div>',
    'cooling_jacket': '<div class="detail-row"><span>CAN ID</span><span class="mono">0x5C0 (FADEC_COOL)</span></div><div class="detail-row"><span>Sample Rate</span><span class="mono">10 Hz</span></div><div class="detail-row"><span>Status</span><strong class="green-text">NOMINAL</strong></div>'
  };
  
  const tEl = document.getElementById('insp-detail-title');
  const bEl = document.getElementById('insp-detail-body');
  if (tEl && titles[id]) tEl.textContent = titles[id];
  if (bEl && bodies[id]) bEl.innerHTML = bodies[id] + '<div class="detail-row"><span>Last Updated</span><span class="mono">Live</span></div>';
}

// ══════════════════════════════════════════════════════════════════
// CHARTS
// ══════════════════════════════════════════════════════════════════
function isDark() { return document.documentElement.getAttribute('data-theme') === 'dark'; }
function chartColors() { return { txt: isDark() ? '#94a3b8' : '#475569', grid: isDark() ? '#1e293b' : '#f1f5f9' }; }

function initCharts() {
  const cc = chartColors();
  const baseOpts = (title) => ({
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { labels: { color: cc.txt, font: { size: 10 } } } },
    scales: {
      x: { ticks: { color: cc.txt, maxTicksLimit: 8 }, grid: { color: cc.grid } },
      y: { ticks: { color: cc.txt }, grid: { color: cc.grid } }
    }
  });

  // CHT Chart
  const chtCtx = document.getElementById('chart-cht');
  if (chtCtx) {
    state.charts.cht = new Chart(chtCtx, {
      type: 'line', data: {
        labels: [], datasets: [
          { label: 'CHT 1', data: [], borderColor: '#3b82f6', borderWidth: 1.5, pointRadius: 0 },
          { label: 'CHT 2', data: [], borderColor: '#ef4444', borderWidth: 1.5, pointRadius: 0 },
          { label: 'CHT 3', data: [], borderColor: '#f59e0b', borderWidth: 1.5, pointRadius: 0 },
          { label: 'CHT 4', data: [], borderColor: '#10b981', borderWidth: 1.5, pointRadius: 0 }
        ]
      }, options: { ...baseOpts('CHT'), animation: false }
    });
  }

  // RPM/MAP Chart
  const rpmCtx = document.getElementById('chart-rpm-map');
  if (rpmCtx) {
    state.charts.rpmMap = new Chart(rpmCtx, {
      type: 'line', data: {
        labels: [], datasets: [
          { label: 'RPM', data: [], borderColor: '#8b5cf6', borderWidth: 1.5, pointRadius: 0, yAxisID: 'y' },
          { label: 'MAP (inHg)', data: [], borderColor: '#06b6d4', borderWidth: 1.5, pointRadius: 0, yAxisID: 'y1' }
        ]
      }, options: {
        ...baseOpts('RPM vs MAP'), animation: false,
        scales: {
          x: { ticks: { color: cc.txt, maxTicksLimit: 8 }, grid: { color: cc.grid } },
          y: { type: 'linear', position: 'left', ticks: { color: cc.txt }, grid: { color: cc.grid } },
          y1: { type: 'linear', position: 'right', ticks: { color: cc.txt }, grid: { display: false } }
        }
      }
    });
  }

  // Vibration Chart
  const vibCtx = document.getElementById('chart-vibration');
  if (vibCtx) {
    state.charts.vib = new Chart(vibCtx, {
      type: 'line', data: {
        labels: [], datasets: [
          { label: 'Vib X', data: [], borderColor: '#f43f5e', borderWidth: 1.5, pointRadius: 0 },
          { label: 'Vib Y', data: [], borderColor: '#a855f7', borderWidth: 1.5, pointRadius: 0 },
          { label: 'Vib Z', data: [], borderColor: '#14b8a6', borderWidth: 1.5, pointRadius: 0 },
          { label: 'RMS', data: [], borderColor: '#f59e0b', borderWidth: 2, pointRadius: 0 }
        ]
      }, options: { ...baseOpts('Vibration'), animation: false }
    });
  }

  // Fuel/Oil Chart
  const foCtx = document.getElementById('chart-fuel-oil');
  if (foCtx) {
    state.charts.fuelOil = new Chart(foCtx, {
      type: 'line', data: {
        labels: [], datasets: [
          { label: 'Fuel Flow', data: [], borderColor: '#06b6d4', borderWidth: 1.5, pointRadius: 0 },
          { label: 'Oil Press', data: [], borderColor: '#f59e0b', borderWidth: 1.5, pointRadius: 0 }
        ]
      }, options: { ...baseOpts('Fuel & Oil'), animation: false }
    });
  }

  // Sim timeline
  const stCtx = document.getElementById('chart-sim-timeline');
  if (stCtx) {
    state.charts.simTimeline = new Chart(stCtx, {
      type: 'line', data: {
        labels: [], datasets: [
          { label: 'RPM', data: [], borderColor: '#8b5cf6', borderWidth: 1.5, pointRadius: 0 },
          { label: 'CHT Avg', data: [], borderColor: '#ef4444', borderWidth: 1.5, pointRadius: 0 },
          { label: 'Oil Press', data: [], borderColor: '#f59e0b', borderWidth: 1.5, pointRadius: 0 }
        ]
      }, options: { ...baseOpts('Sim Timeline'), animation: false }
    });
  }

  // Health Trend Chart
  const htCtx = document.getElementById('chart-health-trend');
  if (htCtx) {
    state.charts.healthTrend = new Chart(htCtx, {
      type: 'line', data: {
        labels: [], datasets: [
          { label: 'Health Index (EHI)', data: [], borderColor: '#10b981', borderWidth: 2, pointRadius: 0, yAxisID: 'y' },
          { label: 'Degradation', data: [], borderColor: '#ef4444', borderWidth: 2, pointRadius: 0, yAxisID: 'y1' }
        ]
      }, options: {
        ...baseOpts('EHI & Degradation'), animation: false,
        scales: {
          x: { ticks: { color: cc.txt, maxTicksLimit: 8 }, grid: { color: cc.grid } },
          y: { type: 'linear', position: 'left', min: 0, max: 100, ticks: { color: cc.txt }, grid: { color: cc.grid } },
          y1: { type: 'linear', position: 'right', min: 0, max: 1, ticks: { color: cc.txt }, grid: { display: false } }
        }
      }
    });
  }
}

function pushChartData(chart, label, values, maxLen = 50) {
  if (!chart) return;
  chart.data.labels.push(label);
  values.forEach((v, i) => { if (chart.data.datasets[i]) chart.data.datasets[i].data.push(v); });
  if (chart.data.labels.length > maxLen) {
    chart.data.labels.shift();
    chart.data.datasets.forEach(ds => ds.data.shift());
  }
  chart.update('none');
}

// ══════════════════════════════════════════════════════════════════
// TELEMETRY
// ══════════════════════════════════════════════════════════════════
function buildTelemetryGrid() {
  const sensors = [
    { id: 'rpm', label: 'RPM', unit: '' }, { id: 'throttle_pct', label: 'Throttle', unit: '%' },
    { id: 'manifold_pressure', label: 'MAP', unit: 'inHg' },
    { id: 'cht_1', label: 'CHT 1', unit: '°F' }, { id: 'cht_2', label: 'CHT 2', unit: '°F' },
    { id: 'cht_3', label: 'CHT 3', unit: '°F' }, { id: 'cht_4', label: 'CHT 4', unit: '°F' },
    { id: 'egt_1', label: 'EGT 1', unit: '°F' }, { id: 'egt_2', label: 'EGT 2', unit: '°F' },
    { id: 'egt_3', label: 'EGT 3', unit: '°F' }, { id: 'egt_4', label: 'EGT 4', unit: '°F' },
    { id: 'fuel_flow', label: 'Fuel Flow', unit: 'GPH' }, { id: 'fuel_pressure', label: 'Fuel Press', unit: 'PSI' },
    { id: 'oil_pressure', label: 'Oil Press', unit: 'PSI' }, { id: 'oil_temp', label: 'Oil Temp', unit: '°F' },
    { id: 'coolant_temp', label: 'Coolant', unit: '°F' },
    { id: 'vib_rms', label: 'Vib RMS', unit: 'g' }, { id: 'battery_voltage', label: 'Battery', unit: 'V' },
    { id: 'airspeed_kts', label: 'Airspeed', unit: 'kts' }, { id: 'altitude_ft', label: 'Altitude', unit: 'ft' }
  ];
  const grid = document.getElementById('telemetry-grid');
  if (!grid) return;
  grid.innerHTML = sensors.map(s => `
    <div class="tel-card">
      <div class="tel-card-label">${s.label}</div>
      <div class="tel-card-val" id="tel-${s.id}">—</div>
      <div class="tel-card-unit">${s.unit}</div>
    </div>
  `).join('');
}

function updateTelemetryGrid(sensor) {
  Object.keys(sensor).forEach(k => {
    const el = document.getElementById(`tel-${k}`);
    if (el) el.textContent = typeof sensor[k] === 'number' ? sensor[k].toFixed(1) : sensor[k];
  });
}

function startTelemetryPolling() {
  stopTelemetryPolling();
  fetchAndUpdateTelemetry();
  state.telemetryPollInterval = setInterval(fetchAndUpdateTelemetry, 2000);
}

function stopTelemetryPolling() {
  if (state.telemetryPollInterval) { clearInterval(state.telemetryPollInterval); state.telemetryPollInterval = null; }
}

async function fetchAndUpdateTelemetry() {
  try {
    const res = await fetch(`${API}/telemetry/live`);
    const data = await res.json();
    if (data.sensor) {
      updateTelemetryGrid(data.sensor);
      const ts = new Date().toLocaleTimeString();
      pushChartData(state.charts.cht, ts, [data.sensor.cht_1, data.sensor.cht_2, data.sensor.cht_3, data.sensor.cht_4]);
      pushChartData(state.charts.rpmMap, ts, [data.sensor.rpm, data.sensor.manifold_pressure]);
      pushChartData(state.charts.vib, ts, [data.sensor.vib_x, data.sensor.vib_y, data.sensor.vib_z, data.sensor.vib_rms]);
      pushChartData(state.charts.fuelOil, ts, [data.sensor.fuel_flow, data.sensor.oil_pressure]);

      // Update overview KPIs
      if (data.prediction) {
        updateOverviewKPIs(data.sensor, data.prediction);
        updateHealthPage(data.sensor, data.prediction, ts);
        if (heroTwin) heroTwin.updateFromTelemetry(data.sensor, data.prediction);
        if (studioTwin) studioTwin.updateFromTelemetry(data.sensor, data.prediction);
      }
    }
  } catch (e) { /* silent */ }
}

function updateOverviewKPIs(sensor, pred) {
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('kpi-ehi-val', (pred.ehi || 96.5).toFixed(1) + '%');
  set('kpi-ehi-status', pred.ehi > 85 ? 'OPTIMAL' : pred.ehi > 60 ? 'DEGRADED' : 'CRITICAL');
  set('kpi-ehi-deg', (pred.degradation || 0.035).toFixed(3));
  set('kpi-rul-val', Math.round(pred.rul_hours || 1420).toLocaleString() + ' hrs');
  set('kpi-fault-class', pred.fault_class || 'NOMINAL');
  set('kpi-anomaly', pred.is_anomaly ? 'ANOMALY' : 'NORMAL');
  set('kpi-anomaly-score', (pred.anomaly_score || 0.142).toFixed(3));
  set('phase-badge', sensor.phase || state.currentPhase || 'ISR_LOITER');

  const fcEl = document.getElementById('kpi-fault-class');
  if (fcEl) { fcEl.className = pred.fault_class === 'NOMINAL' ? 'kpi-big-number green-text' : 'kpi-big-number red-text'; }
  const anEl = document.getElementById('kpi-anomaly');
  if (anEl) { anEl.className = pred.is_anomaly ? 'kpi-big-number red-text' : 'kpi-big-number green-text'; }

  // Alert for faults
  if (pred.fault_class && pred.fault_class !== 'NOMINAL') {
    addAlert('danger', `Fault Detected: ${pred.fault_class}`, `Confidence: ${(pred.fault_probabilities?.[pred.fault_class] || 0.85) * 100}%. EHI dropped to ${pred.ehi?.toFixed(1)}%`);
  }
}

function updateHealthPage(sensor, pred, ts) {
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('health-ehi', (pred.ehi || 100).toFixed(1) + '%');
  set('health-rul', Math.round(pred.rul_hours || 1200).toLocaleString() + ' hrs');
  set('health-deg', ((pred.degradation || 0) * 100).toFixed(2) + '%');
  set('health-anomaly', pred.is_anomaly ? 'DETECTED' : 'NORMAL');
  set('health-fault', pred.fault_class || 'NOMINAL');

  const ehiEl = document.getElementById('health-ehi');
  if (ehiEl) ehiEl.style.color = (pred.ehi || 100) > 85 ? '#10b981' : ((pred.ehi || 100) > 60 ? '#f59e0b' : '#ef4444');
  const anEl = document.getElementById('health-anomaly');
  if (anEl) { anEl.style.color = pred.is_anomaly ? '#ef4444' : '#10b981'; }

  if (state.charts.healthTrend && ts) {
    pushChartData(state.charts.healthTrend, ts, [pred.ehi || 100, pred.degradation || 0]);
  }
}

// ══════════════════════════════════════════════════════════════════
// SIMULATION
// ══════════════════════════════════════════════════════════════════

async function startSimulation() {
  const envs = ['STANDARD_ISA', 'HOT_DESERT_48C', 'HIGH_ALTITUDE_25K', 'COLD_ARCTIC', 'TROPICAL_MARITIME'];
  const faults = ['NOMINAL', 'CYLINDER_MISFIRE', 'INJECTOR_CLOGGING', 'COOLING_DEGRADATION', 'LUBRICATION_FAILURE', 'SENSOR_DRIFT', 'COMBUSTION_INSTABILITY'];
  
  // 30% chance of Nominal, 70% chance of a random fault
  let fault = 'NOMINAL';
  if (Math.random() > 0.3) {
    fault = faults[Math.floor(Math.random() * (faults.length - 1)) + 1];
  }
  const env = envs[Math.floor(Math.random() * envs.length)];
  
  try {
    await fetch(`${API}/simulation/start`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ env_preset: env, fault_type: fault })
    });
    state.simRunning = true;
    document.getElementById('sim-status-val').textContent = 'RUNNING';
    document.getElementById('sim-status-val').style.color = '#059669';
    document.getElementById('sim-env-val').textContent = env;
    document.getElementById('sim-fault-val').textContent = fault;
    
    // UI Button Updates
    const startBtn = document.getElementById('sim-start-btn');
    if (startBtn) {
      startBtn.style.opacity = '0.7';
      startBtn.style.pointerEvents = 'none';
      startBtn.innerHTML = '<i data-lucide="loader" class="spin-icon" style="width:16px;height:16px;"></i> Live Processing...';
    }
    const stopBtn = document.getElementById('sim-stop-btn');
    if (stopBtn) {
      stopBtn.classList.remove('btn-ghost');
      stopBtn.classList.add('btn-primary');
      stopBtn.style.backgroundColor = '#dc2626'; // Red active stop button
      stopBtn.style.color = '#ffffff';
    }
    if (window.lucide) lucide.createIcons();

    addAlert('success', 'Mission Simulation Started', `Environment: ${env} · Fault: ${fault}`);
    
    state.lastPhase = null;
    state.lastFault = null;
    announceVoice(`Starting mission simulation. Environment set to ${env}. Fault profile: ${fault.replace('_', ' ')}.`);

    if (state.simPollInterval) clearInterval(state.simPollInterval);
    state.simPollInterval = setInterval(pollSimulation, 2000);
  } catch (e) { addAlert('danger', 'Simulation Error', e.message); }
}

async function stopSimulation() {
  try {
    await fetch(`${API}/simulation/stop`, { method: 'POST' });
    state.simRunning = false;
    if (state.simPollInterval) { clearInterval(state.simPollInterval); state.simPollInterval = null; }
    document.getElementById('sim-status-val').textContent = 'STOPPED';
    document.getElementById('sim-status-val').style.color = '#dc2626';
    
    // UI Button Updates Restore
    const startBtn = document.getElementById('sim-start-btn');
    if (startBtn) {
      startBtn.style.opacity = '1';
      startBtn.style.pointerEvents = 'auto';
      startBtn.innerHTML = '<i data-lucide="play" style="width:16px;height:16px;"></i> Start Mission';
    }
    const stopBtn = document.getElementById('sim-stop-btn');
    if (stopBtn) {
      stopBtn.classList.add('btn-ghost');
      stopBtn.classList.remove('btn-primary');
      stopBtn.style.backgroundColor = '';
      stopBtn.style.color = '';
    }
    if (window.lucide) lucide.createIcons();

    addAlert('info', 'Mission Simulation Stopped', 'All telemetry streaming paused.');
    announceVoice('Mission simulation stopped.');
  } catch (e) { /* */ }
}

async function pollSimulation() {
  try {
    const res = await fetch(`${API}/telemetry/live`);
    const data = await res.json();
    if (!data.sensor) return;

    const s = data.sensor, p = data.prediction || {};
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

    // Update sim status
    const sres = await fetch(`${API}/status`);
    const status = await sres.json();
    set('sim-phase-val', status.flight_phase);
    set('sim-cycle-val', status.cycle);
    const secs = status.mission_time_sec || 0;
    const h = Math.floor(secs/3600), m = Math.floor((secs%3600)/60), sec = secs%60;
    set('sim-time-val', `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`);

    // Update live sensor values
    set('sim-rpm', Math.round(s.rpm).toLocaleString());
    set('sim-cht', (s.cht_avg || 0).toFixed(1) + ' °F');
    set('sim-egt', (s.egt_spread || 0).toFixed(1) + ' °F');
    set('sim-oil', (s.oil_pressure || 0).toFixed(1) + ' PSI');
    set('sim-fuel', (s.fuel_flow || 0).toFixed(1) + ' GPH');
    set('sim-vib', (s.vib_rms || 0).toFixed(2) + ' g');
    set('sim-cool', (s.coolant_temp || 0).toFixed(1) + ' °F');
    set('sim-batt', (s.battery_voltage || 0).toFixed(1) + ' V');

    // Update predictions
    set('sim-pred-fault', p.fault_class || 'NOMINAL');
    set('sim-pred-ehi', (p.ehi || 96).toFixed(1) + '%');
    set('sim-pred-rul', Math.round(p.rul_hours || 1200) + ' hrs');
    set('sim-pred-anomaly', p.is_anomaly ? '⚠️ YES' : '✅ NO');
    const predFaultEl = document.getElementById('sim-pred-fault');
    if (predFaultEl) predFaultEl.style.color = p.fault_class === 'NOMINAL' ? '#059669' : '#dc2626';

    // Update 3D Simulator & HUD
    const env = document.getElementById('sim-env-select')?.value || 'STANDARD_ISA';
    if (fsTwin) fsTwin.updateState(s, p, env);
    set('fs-alt', Math.round(s.altitude_ft || 0).toLocaleString() + ' ft');
    set('fs-ias', Math.round(s.airspeed_kts || 0) + ' kt');
    set('fs-ehi', (p.ehi || 100).toFixed(1) + '%');
    set('fs-rpm', Math.round(s.rpm || 0).toLocaleString());
    set('fs-status', p.fault_class || 'NOMINAL');
    
    const fsStatusEl = document.getElementById('fs-status');
    const fsEhiEl = document.getElementById('fs-ehi');
    if (fsStatusEl) fsStatusEl.style.color = p.fault_class === 'NOMINAL' ? '#10b981' : '#dc2626';
    if (fsEhiEl) fsEhiEl.style.color = (p.ehi || 100) > 85 ? '#10b981' : (p.ehi > 60 ? '#f59e0b' : '#dc2626');

    // Voice Announcements
    const curPhase = status.flight_phase || 'UNKNOWN';
    if (curPhase !== state.lastPhase) {
      announceVoice(`Flight phase changed to ${curPhase.replace('_', ' ')}`);
      state.lastPhase = curPhase;
    }

    const curFault = p.fault_class || 'NOMINAL';
    if (curFault !== 'NOMINAL' && curFault !== state.lastFault) {
      announceVoice(`Warning. Fault detected: ${curFault.replace(/_/g, ' ')}. Engine health index dropped to ${p.ehi.toFixed(1)} percent.`);
      state.lastFault = curFault;
    } else if (curFault === 'NOMINAL' && state.lastFault && state.lastFault !== 'NOMINAL') {
      announceVoice(`System recovered. Engine status is nominal.`);
      state.lastFault = 'NOMINAL';
    }

    // Sim timeline chart
    pushChartData(state.charts.simTimeline, status.cycle?.toString() || '', [s.rpm / 100, s.cht_avg, s.oil_pressure]);

    // Also update overview
    updateOverviewKPIs(s, p);
    if (heroTwin) heroTwin.updateFromTelemetry(s, p);
  } catch (e) { /* silent */ }
}

// ══════════════════════════════════════════════════════════════════
// ML ANALYTICS (COMMENTED OUT)
// ══════════════════════════════════════════════════════════════════
/*
async function loadMLMetrics() {
  try {
    const res = await fetch(`${API}/ml/metrics`);
    const m = await res.json();
    if (m.error) return;

    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('ml-accuracy', (m.accuracy * 100).toFixed(1) + '%');
    set('ml-r2', m.rul_r2?.toFixed(3));
    set('ml-rmse', m.rul_rmse_hours?.toFixed(1) + ' hrs');
    set('ml-dataset', m.dataset_size?.toLocaleString() + ' samples');
    set('ml-features', m.features?.length);
    set('kpi-accuracy', (m.accuracy * 100).toFixed(1) + '%');

    // Training curves
    if (m.history && state.charts.training) {
      state.charts.training.destroy();
    }
    const tCtx = document.getElementById('chart-training');
    if (tCtx && m.history) {
      state.charts.training = new Chart(tCtx, {
        type: 'line', data: {
          labels: m.history.map(h => `E${h.epoch}`),
          datasets: [
            { label: 'Train Loss', data: m.history.map(h => h.loss), borderColor: '#ef4444', borderWidth: 2, pointRadius: 3 },
            { label: 'Val Loss', data: m.history.map(h => h.val_loss), borderColor: '#f59e0b', borderWidth: 2, pointRadius: 3 },
            { label: 'Accuracy', data: m.history.map(h => h.accuracy), borderColor: '#10b981', borderWidth: 2, pointRadius: 3, yAxisID: 'y1' }
          ]
        }, options: {
          responsive: true, maintainAspectRatio: false,
          scales: {
            y: { ticks: { color: chartColors().txt }, grid: { color: chartColors().grid } },
            y1: { type: 'linear', position: 'right', ticks: { color: chartColors().txt }, grid: { display: false } },
            x: { ticks: { color: chartColors().txt }, grid: { color: chartColors().grid } }
          }
        }
      });
    }

    // Feature importance
    if (m.feature_ranking) {
      const fCtx = document.getElementById('chart-features');
      if (fCtx) {
        if (state.charts.features) state.charts.features.destroy();
        const top12 = m.feature_ranking.slice(0, 12);
        state.charts.features = new Chart(fCtx, {
          type: 'bar', data: {
            labels: top12.map(f => f.feature),
            datasets: [{ label: 'Importance', data: top12.map(f => f.importance), backgroundColor: '#3b82f6', borderRadius: 4 }]
          }, options: {
            indexAxis: 'y', responsive: true, maintainAspectRatio: false,
            scales: {
              x: { ticks: { color: chartColors().txt }, grid: { color: chartColors().grid } },
              y: { ticks: { color: chartColors().txt, font: { size: 10 } }, grid: { display: false } }
            }
          }
        });
      }
    }

    // Confusion Matrix
    if (m.confusion_matrix && m.classes) {
      buildConfusionMatrix(m.confusion_matrix, m.classes);
    }
  } catch (e) { console.error('ML metrics error:', e); }
}

function buildConfusionMatrix(cm, classes) {
  const wrap = document.getElementById('confusion-matrix');
  if (!wrap) return;
  const n = classes.length;
  wrap.style.gridTemplateColumns = `60px repeat(${n}, 1fr)`;
  let html = '<div class="cm-header"></div>';
  classes.forEach(c => html += `<div class="cm-header">${c.substring(0, 6)}</div>`);

  for (let i = 0; i < n; i++) {
    html += `<div class="cm-header">${classes[i].substring(0, 6)}</div>`;
    const rowMax = Math.max(...cm[i]);
    for (let j = 0; j < n; j++) {
      const val = cm[i][j];
      const intensity = rowMax > 0 ? val / rowMax : 0;
      const bg = i === j
        ? `rgba(5,150,105,${0.15 + intensity * 0.7})`
        : val > 0 ? `rgba(220,38,38,${0.1 + intensity * 0.5})` : 'transparent';
      const color = intensity > 0.5 ? '#fff' : (isDark() ? '#e2e8f0' : '#0f172a');
      html += `<div class="cm-cell" style="background:${bg};color:${color}">${val}</div>`;
    }
  }
  wrap.innerHTML = html;
}
*/

// ══════════════════════════════════════════════════════════════════
// ALERTS
// ══════════════════════════════════════════════════════════════════
function addAlert(type, title, msg) {
  const icons = { danger: 'alert-triangle', warning: 'alert-circle', info: 'info', success: 'check-circle' };
  const list = document.getElementById('alerts-list');
  if (!list) return;

  // Don't spam duplicates within 5 seconds
  const key = `${type}-${title}`;
  if (state.alerts.includes(key)) return;
  state.alerts.push(key);
  setTimeout(() => { state.alerts = state.alerts.filter(a => a !== key); }, 5000);

  const el = document.createElement('div');
  el.className = `alert-item alert-${type}`;
  el.innerHTML = `
    <div class="alert-icon"><i data-lucide="${icons[type] || 'info'}"></i></div>
    <div class="alert-content">
      <div class="alert-title">${title}</div>
      <div class="alert-msg">${msg}</div>
      <div class="alert-time mono">${new Date().toLocaleTimeString()}</div>
    </div>
  `;
  list.prepend(el);
  if (window.lucide) window.lucide.createIcons();
  if (list.children.length > 20) list.removeChild(list.lastChild);
}

// ══════════════════════════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  init3D();
  initCharts();
  buildTelemetryGrid();
  startTelemetryPolling();
  // loadMLMetrics();

  // Start simulation auto so overview has live data
  fetch(`${API}/simulation/start`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ env_preset: 'STANDARD_ISA', fault_type: 'NOMINAL' })
  }).catch(() => {});
});

// ══════════════════════════════════════════════════════════════════
// CHATBOT & EXPLAINABLE AI
// ══════════════════════════════════════════════════════════════════
let chatOpen = false;
function toggleChat() {
  chatOpen = !chatOpen;
  const body = document.getElementById('chat-body');
  const icon = document.getElementById('chat-toggle-icon');
  if (chatOpen) {
    body.style.display = 'flex';
    icon.setAttribute('data-lucide', 'chevron-up');
  } else {
    body.style.display = 'none';
    icon.setAttribute('data-lucide', 'chevron-down');
  }
  if (window.lucide) window.lucide.createIcons();
}

function appendChatMessage(msg, sender) {
  const msgs = document.getElementById('chat-messages');
  const el = document.createElement('div');
  el.className = `chat-msg ${sender === 'user' ? 'user-msg' : 'ai-msg'}`;
  el.textContent = msg;
  msgs.appendChild(el);
  msgs.scrollTop = msgs.scrollHeight;
}

async function sendChatMessage() {
  const input = document.getElementById('chat-input');
  const msg = input.value.trim();
  if (!msg) return;
  
  appendChatMessage(msg, 'user');
  input.value = '';
  
  const env = document.getElementById('sim-env-select')?.options[document.getElementById('sim-env-select').selectedIndex]?.text || 'Standard ISA';
  const ehi = document.getElementById('health-ehi')?.textContent || '100%';
  const rul = document.getElementById('health-rul')?.textContent || 'N/A';
  const fault = document.getElementById('health-fault')?.textContent || 'NOMINAL';
  
  const prompt = `You are the AEROTWIN AI Assistant, an expert aerospace engineer and diagnostician specialized in MALE UAV (Medium-Altitude Long-Endurance) propulsion systems and aero piston engines.

CRITICAL RULES:
1. STRICT DOMAIN: ONLY answer questions related to aerospace, UAVs, engine telemetry, predictive maintenance, aerodynamics, or climate impacts on flight.
2. OUT-OF-DOMAIN: If the user asks something unrelated (e.g., general knowledge, coding, recipes), you MUST politely refuse and state you only answer UAV/Engine queries.
3. CONCISENESS: Provide precise, directly relevant answers without unnecessary fluff.

CURRENT ENGINE TELEMETRY:
- Environment: ${env}
- Engine Health (EHI): ${ehi}
- Remaining Useful Life: ${rul}
- Current Diagnosis: ${fault}

User Query: "${msg}"`;
  
  appendChatMessage("Thinking...", 'ai');
  const msgs = document.getElementById('chat-messages');
  const thinkingEl = msgs.lastChild;
  
  try {
    const res = await fetch(`${API}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });
    const data = await res.json();
    thinkingEl.textContent = data.response || "No response received.";
  } catch (e) {
    thinkingEl.textContent = "Error connecting to AI backend.";
  }
}

function explainClimate() {
  if (!chatOpen) toggleChat();
  const env = document.getElementById('sim-env-select')?.options[document.getElementById('sim-env-select').selectedIndex]?.text || 'Standard ISA';
  const msg = `Explainable AI Request: Explain the aerodynamic and engine performance impact of running an aero piston engine in the ${env} environment on UAV flight.`;
  const input = document.getElementById('chat-input');
  input.value = msg;
  sendChatMessage();
}

function downloadReport() {
  const env = document.getElementById('sim-env-val')?.textContent || 'Standard ISA';
  const fault = document.getElementById('kpi-fault-class')?.textContent || 'NOMINAL';
  const ehi = document.getElementById('kpi-ehi-val')?.textContent || '96.5%';
  const rul = document.getElementById('kpi-rul-val')?.textContent || '1,420 hrs';
  
  const content = `AEROTWIN DETAILED AI PROPULSION REPORT\n======================================\n\n` +
    `DATE: ${new Date().toLocaleString()}\n` +
    `MISSION: MALE-ISR-2026-09\n` +
    `TAIL: UAV-MALE-04\n\n` +
    `--- REAL-TIME AI PREDICTIONS ---\n` +
    `Engine Health Index (EHI)  : ${ehi}\n` +
    `Remaining Useful Life (RUL): ${rul}\n` +
    `Current Fault Status       : ${fault}\n` +
    `Environmental Condition    : ${env}\n\n` +
    `--- SENSOR TELEMETRY SNAPSHOT ---\n` +
    `RPM             : ${document.getElementById('hud-rpm')?.textContent || '4600'}\n` +
    `Manifold Press  : ${document.getElementById('hud-map')?.textContent || '26.5 inHg'}\n` +
    `Avg CHT         : ${document.getElementById('hud-cht')?.textContent || '195.0 °F'}\n` +
    `Oil Pressure    : ${document.getElementById('hud-oil-p')?.textContent || '58.0 PSI'}\n\n` +
    `======================================\n` +
    `Report generated successfully by AeroTwin Intelligence.`;
    
  document.getElementById('report-content').textContent = content;
  document.getElementById('report-modal').style.display = 'block';
  window.lastReportContent = content; // store for download
}

function closeReport() {
  document.getElementById('report-modal').style.display = 'none';
}

function confirmDownloadReport() {
  const content = window.lastReportContent || "AEROTWIN DETAILED AI PROPULSION REPORT\nEmpty report.";
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `AeroTwin_Mission_Report_${new Date().getTime()}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  closeReport();
  addAlert('success', 'Report Downloaded', 'Detailed AI propulsion report has been saved to your device.');
}
