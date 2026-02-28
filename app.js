const canvas = document.getElementById("sky");
const ctx = canvas.getContext("2d");

const ui = {
  latitude: document.getElementById("latitude"),
  longitude: document.getElementById("longitude"),
  timeSpeed: document.getElementById("timeSpeed"),
  starDensity: document.getElementById("starDensity"),
  latitudeValue: document.getElementById("latitudeValue"),
  longitudeValue: document.getElementById("longitudeValue"),
  timeSpeedValue: document.getElementById("timeSpeedValue"),
  starDensityValue: document.getElementById("starDensityValue"),
  togglePlay: document.getElementById("togglePlay"),
  toggleGrid: document.getElementById("toggleGrid"),
  resetView: document.getElementById("resetView"),
  statusPanel: document.getElementById("statusPanel"),
};

const state = {
  lat: Number(ui.latitude.value),
  lon: Number(ui.longitude.value),
  speed: Number(ui.timeSpeed.value),
  density: Number(ui.starDensity.value),
  time: new Date(),
  running: true,
  showGrid: true,
  heading: 180,
  pitch: 18,
  fov: 100,
  stars: [],
  dragging: false,
  dragStart: null,
};

const planets = [
  { name: "Mercury", period: 88, color: "#f7d9ab", size: 2.8, baseRA: 7 },
  { name: "Venus", period: 225, color: "#ffd37f", size: 4.1, baseRA: 2 },
  { name: "Mars", period: 687, color: "#ff916f", size: 3.7, baseRA: 9 },
  { name: "Jupiter", period: 4333, color: "#ffe3b7", size: 5, baseRA: 12 },
  { name: "Saturn", period: 10759, color: "#ffe8a3", size: 4.3, baseRA: 16 },
];

function degToRad(deg) {
  return (deg * Math.PI) / 180;
}

function radToDeg(rad) {
  return (rad * 180) / Math.PI;
}

function normalizeAngle(deg) {
  return ((deg % 360) + 360) % 360;
}

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const width = window.innerWidth;
  const height = window.innerHeight;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function randomStar(seed = Math.random()) {
  const ra = seed * 24;
  const dec = -90 + Math.random() * 180;
  const mag = 0.3 + Math.random() * 4.2;
  const twinkle = 0.5 + Math.random() * 0.8;
  return { ra, dec, mag, twinkle };
}

function generateStars(count) {
  state.stars = Array.from({ length: count }, () => randomStar());
}

function julianDate(date) {
  return date.getTime() / 86400000 + 2440587.5;
}

function localSiderealTime(date, longitudeDeg) {
  const jd = julianDate(date);
  const t = (jd - 2451545.0) / 36525;
  const gmst =
    280.46061837 +
    360.98564736629 * (jd - 2451545) +
    0.000387933 * t * t -
    (t * t * t) / 38710000;
  return normalizeAngle(gmst + longitudeDeg);
}

function equatorialToHorizontal(raHours, decDeg, latDeg, lstDeg) {
  const raDeg = raHours * 15;
  const hourAngle = degToRad(normalizeAngle(lstDeg - raDeg));
  const dec = degToRad(decDeg);
  const lat = degToRad(latDeg);

  const sinAlt = Math.sin(dec) * Math.sin(lat) + Math.cos(dec) * Math.cos(lat) * Math.cos(hourAngle);
  const alt = Math.asin(sinAlt);

  const y = -Math.sin(hourAngle);
  const x = Math.tan(dec) * Math.cos(lat) - Math.sin(lat) * Math.cos(hourAngle);
  const az = Math.atan2(y, x);

  return {
    alt: radToDeg(alt),
    az: normalizeAngle(radToDeg(az)),
  };
}

function skyToScreen(azDeg, altDeg) {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;

  const yaw = normalizeAngle(azDeg - state.heading);
  const xNorm = ((yaw > 180 ? yaw - 360 : yaw) / state.fov) * 2;
  const yNorm = ((state.pitch - altDeg) / (state.fov * 0.55)) * 2;

  return {
    x: width * (0.5 + xNorm * 0.5),
    y: height * (0.5 + yNorm * 0.5),
    visible: Math.abs(xNorm) <= 1.05 && Math.abs(yNorm) <= 1.05,
  };
}

function drawBackground() {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const g = ctx.createLinearGradient(0, 0, 0, height);
  g.addColorStop(0, "#091229");
  g.addColorStop(0.6, "#030713");
  g.addColorStop(1, "#000");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);
}

function drawGrid(lstDeg) {
  if (!state.showGrid) return;
  ctx.strokeStyle = "rgba(109, 173, 255, 0.22)";
  ctx.lineWidth = 1;

  for (let alt = -10; alt <= 80; alt += 10) {
    ctx.beginPath();
    let started = false;
    for (let az = 0; az <= 360; az += 4) {
      const p = skyToScreen(az, alt);
      if (!p.visible) {
        started = false;
        continue;
      }
      if (!started) {
        ctx.moveTo(p.x, p.y);
        started = true;
      } else {
        ctx.lineTo(p.x, p.y);
      }
    }
    ctx.stroke();
  }

  for (let az = 0; az < 360; az += 15) {
    ctx.beginPath();
    let started = false;
    for (let alt = -10; alt <= 85; alt += 2) {
      const p = skyToScreen(az, alt);
      if (!p.visible) {
        started = false;
        continue;
      }
      if (!started) {
        ctx.moveTo(p.x, p.y);
        started = true;
      } else {
        ctx.lineTo(p.x, p.y);
      }
    }
    ctx.stroke();
  }

  const cardinalPoints = [
    { label: "N", az: 0 },
    { label: "E", az: 90 },
    { label: "S", az: 180 },
    { label: "W", az: 270 },
  ];

  ctx.fillStyle = "rgba(149, 219, 255, 0.9)";
  ctx.font = "bold 14px system-ui";
  cardinalPoints.forEach(({ label, az }) => {
    const p = skyToScreen(az, 0);
    if (p.visible) ctx.fillText(label, p.x - 6, p.y - 6);
  });

  const zenith = skyToScreen(state.heading, 90);
  if (zenith.visible) {
    ctx.fillStyle = "rgba(183, 235, 255, 0.95)";
    ctx.fillText("Zenith", zenith.x - 20, zenith.y - 6);
  }

  const lstHours = (lstDeg / 15).toFixed(2);
  ctx.fillStyle = "rgba(135, 198, 255, 0.8)";
  ctx.fillText(`LST ${lstHours}h`, 18, canvas.clientHeight - 20);
}

function drawHorizon() {
  ctx.strokeStyle = "rgba(95, 255, 217, 0.95)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  let started = false;

  for (let az = 0; az <= 360; az += 3) {
    const p = skyToScreen(az, 0);
    if (!p.visible) {
      started = false;
      continue;
    }
    if (!started) {
      ctx.moveTo(p.x, p.y);
      started = true;
    } else {
      ctx.lineTo(p.x, p.y);
    }
  }

  ctx.stroke();
}

function starColor(mag) {
  const blue = Math.floor(200 + Math.max(0, (4.5 - mag) * 10));
  return `rgba(220, 235, ${blue}, ${Math.max(0.3, 1 - mag / 7)})`;
}

function drawStars(lstDeg, frameTime) {
  state.stars.forEach((star) => {
    const horizontal = equatorialToHorizontal(star.ra, star.dec, state.lat, lstDeg);
    if (horizontal.alt < -8) return;

    const p = skyToScreen(horizontal.az, horizontal.alt);
    if (!p.visible) return;

    const flicker = 0.75 + Math.sin(frameTime * 0.0025 * star.twinkle) * 0.25;
    const radius = Math.max(0.5, 3.2 - star.mag * 0.55) * flicker;

    ctx.beginPath();
    ctx.fillStyle = starColor(star.mag);
    ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
    ctx.fill();
  });
}

function getPlanetRaDec(planet, date) {
  const day = julianDate(date) - 2451545.0;
  const phase = normalizeAngle((day / planet.period) * 360 + planet.baseRA * 15);
  const ra = normalizeAngle(phase) / 15;
  const dec = Math.sin(degToRad(phase * 0.7)) * 18;
  return { ra, dec };
}

function drawPlanets(lstDeg) {
  ctx.font = "12px system-ui";
  planets.forEach((planet) => {
    const eq = getPlanetRaDec(planet, state.time);
    const horizontal = equatorialToHorizontal(eq.ra, eq.dec, state.lat, lstDeg);
    if (horizontal.alt < -5) return;

    const p = skyToScreen(horizontal.az, horizontal.alt);
    if (!p.visible) return;

    ctx.beginPath();
    ctx.fillStyle = planet.color;
    ctx.shadowColor = planet.color;
    ctx.shadowBlur = 8;
    ctx.arc(p.x, p.y, planet.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = "rgba(255, 242, 200, 0.95)";
    ctx.fillText(planet.name, p.x + 6, p.y - 6);
  });
}

function drawCrosshair() {
  const x = canvas.clientWidth / 2;
  const y = canvas.clientHeight / 2;
  ctx.strokeStyle = "rgba(166, 201, 255, 0.65)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x - 14, y);
  ctx.lineTo(x + 14, y);
  ctx.moveTo(x, y - 14);
  ctx.lineTo(x, y + 14);
  ctx.stroke();
}

function updateStatus(lstDeg) {
  ui.statusPanel.innerHTML = `
    <div><strong>${state.time.toUTCString()}</strong></div>
    <div>Lat ${state.lat.toFixed(1)}° / Lon ${state.lon.toFixed(1)}°</div>
    <div>Heading ${state.heading.toFixed(1)}° / Pitch ${state.pitch.toFixed(1)}°</div>
    <div>Field of view ${state.fov.toFixed(0)}°</div>
    <div>Local sidereal time ${(lstDeg / 15).toFixed(2)}h</div>
    <div>Stars ${state.stars.length}</div>
  `;
}

function render(frameTime = 0) {
  drawBackground();
  const lstDeg = localSiderealTime(state.time, state.lon);
  drawGrid(lstDeg);
  drawHorizon();
  drawStars(lstDeg, frameTime);
  drawPlanets(lstDeg);
  drawCrosshair();
  updateStatus(lstDeg);
}

function tick(frameTime) {
  if (state.running) {
    const msStep = 1000 * Math.max(0, state.speed);
    state.time = new Date(state.time.getTime() + msStep / 60);
  }
  render(frameTime);
  requestAnimationFrame(tick);
}

function updateLabels() {
  ui.latitudeValue.textContent = `${state.lat.toFixed(1)}°`;
  ui.longitudeValue.textContent = `${state.lon.toFixed(1)}°`;
  ui.timeSpeedValue.textContent = `${state.speed.toFixed(0)}x`;
  ui.starDensityValue.textContent = `${state.density}`;
}

function bindUI() {
  ui.latitude.addEventListener("input", (event) => {
    state.lat = Number(event.target.value);
    updateLabels();
  });

  ui.longitude.addEventListener("input", (event) => {
    state.lon = Number(event.target.value);
    updateLabels();
  });

  ui.timeSpeed.addEventListener("input", (event) => {
    state.speed = Number(event.target.value);
    updateLabels();
  });

  ui.starDensity.addEventListener("input", (event) => {
    state.density = Number(event.target.value);
    generateStars(state.density);
    updateLabels();
  });

  ui.togglePlay.addEventListener("click", () => {
    state.running = !state.running;
    ui.togglePlay.textContent = state.running ? "Pause" : "Resume";
  });

  ui.toggleGrid.addEventListener("click", () => {
    state.showGrid = !state.showGrid;
    ui.toggleGrid.textContent = state.showGrid ? "Hide Grid" : "Show Grid";
  });

  ui.resetView.addEventListener("click", () => {
    state.heading = 180;
    state.pitch = 18;
    state.fov = 100;
  });

  canvas.addEventListener("mousedown", (event) => {
    state.dragging = true;
    state.dragStart = { x: event.clientX, y: event.clientY, heading: state.heading, pitch: state.pitch };
  });

  window.addEventListener("mousemove", (event) => {
    if (!state.dragging || !state.dragStart) return;
    const dx = event.clientX - state.dragStart.x;
    const dy = event.clientY - state.dragStart.y;
    state.heading = normalizeAngle(state.dragStart.heading - dx * 0.15);
    state.pitch = Math.max(-15, Math.min(85, state.dragStart.pitch + dy * 0.12));
  });

  window.addEventListener("mouseup", () => {
    state.dragging = false;
    state.dragStart = null;
  });

  canvas.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      state.fov = Math.max(35, Math.min(150, state.fov + event.deltaY * 0.045));
    },
    { passive: false },
  );

  window.addEventListener("resize", () => {
    resizeCanvas();
    render();
  });
}

function init() {
  resizeCanvas();
  generateStars(state.density);
  updateLabels();
  bindUI();
  requestAnimationFrame(tick);
}

init();
