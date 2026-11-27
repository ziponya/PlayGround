import * as THREE from './vendor/three.module.min.js';

// ─────────────────────────────────────────────────────────────
//  Тихий сад — a small 3D farming game
// ─────────────────────────────────────────────────────────────

const CROPS = {
  carrot: {
    name: 'Морковь', emoji: '🥕', price: 12, sell: 26, grow: 32, yield: 2, xp: 10,
    level: 1, color: '#e8873a', tint: '#ffead9',
    blurb: 'Быстрый и надёжный урожай'
  },
  lettuce: {
    name: 'Салат', emoji: '🥬', price: 16, sell: 34, grow: 38, yield: 2, xp: 12,
    level: 1, color: '#6eaa54', tint: '#e8f3dc',
    blurb: 'Сочные листья для рынка'
  },
  tomato: {
    name: 'Помидор', emoji: '🍅', price: 24, sell: 52, grow: 45, yield: 3, xp: 16,
    level: 1, color: '#d55f47', tint: '#fbe5df',
    blurb: 'Щедрый и прибыльный'
  },
  sunflower: {
    name: 'Подсолнух', emoji: '🌻', price: 32, sell: 70, grow: 52, yield: 2, xp: 20,
    level: 2, color: '#e8b83e', tint: '#fff2c9',
    blurb: 'Солнечный цветок'
  },
  strawberry: {
    name: 'Клубника', emoji: '🍓', price: 28, sell: 62, grow: 48, yield: 3, xp: 18,
    level: 3, color: '#d95f62', tint: '#fae2e3',
    blurb: 'Сладкая ягода'
  },
  pumpkin: {
    name: 'Тыква', emoji: '🎃', price: 46, sell: 104, grow: 62, yield: 2, xp: 26,
    level: 4, color: '#d98336', tint: '#fbe8d2',
    blurb: 'Главный приз осени'
  }
};
const CROP_IDS = Object.keys(CROPS);

const LEVELS = [0, 80, 200, 360, 560, 800, 1100, 1450, 1850];

const UPGRADES = [
  {
    id: 'compost', name: 'Живой компост', icon: '🌿', price: 160, level: 2,
    desc: '+12% к цене каждого проданного плода.'
  },
  {
    id: 'sprinkler', name: 'Автолейка', icon: '💧', price: 260, level: 3,
    desc: 'Все растения сразу политы. Новые — тоже.'
  },
  {
    id: 'warmbed', name: 'Тёплая грядка', icon: '🏡', price: 380, level: 4,
    desc: 'Растения созревают на 15% быстрее.'
  },
  {
    id: 'stall', name: 'Свой прилавок', icon: '🏪', price: 520, level: 5,
    desc: '+1 монета за каждый проданный плод.'
  }
];

const QUESTS = [
  { id: 'harvest3', title: 'Первые всходы', desc: 'Собери 3 урожая', metric: 'harvested', target: 3, reward: 70, icon: '🧺' },
  { id: 'earn150', title: 'Удачная сделка', desc: 'Заработай 150 монет на продажах', metric: 'earned', target: 150, reward: 90, icon: '🪙' },
  { id: 'water5', title: 'Заботливый сад', desc: 'Полей 5 растений', metric: 'watered', target: 5, reward: 60, icon: '💧' },
  { id: 'harvest12', title: 'Щедрая грядка', desc: 'Собери 12 урожаев', metric: 'harvested', target: 12, reward: 150, icon: '🌾' },
  { id: 'earn500', title: 'Мастер торговли', desc: 'Заработай 500 монет на продажах', metric: 'earned', target: 500, reward: 220, icon: '🏅' }
];

const SAVE_KEY = 'quiet-garden-save-v1';
const EMPTY_STATS = { harvested: 0, earned: 0, watered: 0, planted: 0, sold: 0 };

const $ = (selector) => document.querySelector(selector);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const rand = (min, max) => min + Math.random() * (max - min);
const nowMs = () => Date.now();
const fmt = new Intl.NumberFormat('ru-RU');

function hashString(value) {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function makePlot(crop, progress = 0, watered = false, base = nowMs()) {
  if (!crop) return { crop: null, plantedAt: 0, watered: false };
  const speed = 1 + (watered ? 0.25 : 0);
  return {
    crop,
    plantedAt: base - (progress * CROPS[crop].grow * 1000) / speed,
    watered
  };
}

function createDefaultState() {
  const base = nowMs();
  const plots = Array.from({ length: 9 }, () => ({ crop: null, plantedAt: 0, watered: false }));
  plots[0] = makePlot('carrot', 1, true, base);
  plots[1] = makePlot('tomato', 0.78, false, base);
  plots[3] = makePlot('lettuce', 0.48, true, base);
  plots[4] = makePlot('carrot', 0.9, true, base);
  plots[2] = makePlot('sunflower', 0.72, true, base);
  plots[6] = makePlot('lettuce', 0.78, true, base);
  plots[8] = makePlot('tomato', 0.5, false, base);
  return {
    version: 1,
    coins: 230,
    xp: 18,
    seeds: { carrot: 3, lettuce: 2, tomato: 2, sunflower: 0, strawberry: 0, pumpkin: 0 },
    produce: { carrot: 2, tomato: 1 },
    plots,
    upgrades: [],
    stats: { ...EMPTY_STATS },
    quest: { index: 0, baseline: 0, celebrated: false },
    muted: false,
    lastSeen: base,
    totalPlayMs: 0
  };
}

function normalizeState(raw) {
  const fresh = createDefaultState();
  if (!raw || typeof raw !== 'object') return fresh;
  const state = {
    ...fresh,
    ...raw,
    seeds: { ...fresh.seeds, ...(raw.seeds || {}) },
    produce: { ...fresh.produce, ...(raw.produce || {}) },
    stats: { ...EMPTY_STATS, ...(raw.stats || {}) },
    upgrades: Array.isArray(raw.upgrades) ? raw.upgrades.filter((id) => UPGRADES.some((u) => u.id === id)) : [],
    quest: { ...fresh.quest, ...(raw.quest || {}) }
  };
  if (!Array.isArray(raw.plots) || raw.plots.length !== 9) {
    state.plots = fresh.plots;
  } else {
    state.plots = raw.plots.map((plot) => {
      if (!plot || !plot.crop || !CROPS[plot.crop]) return { crop: null, plantedAt: 0, watered: false };
      return {
        crop: plot.crop,
        plantedAt: Number(plot.plantedAt) || nowMs(),
        watered: !!plot.watered
      };
    });
  }
  for (const id of CROP_IDS) {
    state.seeds[id] = Math.max(0, Math.floor(Number(state.seeds[id]) || 0));
    state.produce[id] = Math.max(0, Math.floor(Number(state.produce[id]) || 0));
  }
  state.coins = Math.max(0, Math.floor(Number(state.coins) || 0));
  state.xp = Math.max(0, Math.floor(Number(state.xp) || 0));
  state.quest.index = clamp(Math.floor(Number(state.quest.index) || 0), 0, QUESTS.length);
  state.quest.baseline = Math.max(0, Number(state.quest.baseline) || 0);
  state.quest.celebrated = !!state.quest.celebrated;
  state.muted = !!state.muted;
  return state;
}

let state;
let offlineGap = 0;
try {
  const raw = localStorage.getItem(SAVE_KEY);
  const parsed = raw ? JSON.parse(raw) : null;
  state = normalizeState(parsed);
  if (parsed?.lastSeen) offlineGap = Math.max(0, nowMs() - Number(parsed.lastSeen));
} catch {
  state = createDefaultState();
}

let currentMarketTab = 'seeds';
let pickerPlotIndex = null;
let hoveredPlot = null;
let resetArmed = false;
let resetTimer = null;
let saveSuppressed = false;

const dom = {
  canvas: $('#scene'),
  coins: $('#coins'),
  coinPill: $('#coin-pill'),
  level: $('#level'),
  xpText: $('#xp-text'),
  xpFill: $('#xp-fill'),
  questCard: $('#quest-card'),
  questIcon: $('#quest-icon'),
  questTitle: $('#quest-title'),
  questDesc: $('#quest-desc'),
  questReward: $('#quest-reward'),
  questFill: $('#quest-fill'),
  questCount: $('#quest-count'),
  questClaim: $('#quest-claim'),
  markers: $('#markers'),
  hoverTip: $('#hover-tip'),
  toastStack: $('#toast-stack'),
  hintPill: $('#hint-pill'),
  hintText: $('#hint-text'),
  sellBadge: $('#sell-badge'),
  waterCount: $('#water-count'),
  seedPicker: $('#seed-picker'),
  pickerPlotNumber: $('#picker-plot-number'),
  seedStrip: $('#seed-strip'),
  pickerClose: $('#picker-close'),
  modal: $('#modal'),
  panelBody: $('#panel-body'),
  panelFoot: $('#panel-foot'),
  tabSellCount: $('#tab-sell-count'),
  helpLayer: $('#help-layer'),
  settingsMenu: $('#settings-menu'),
  loader: $('#loader'),
  soundBtn: $('#sound-btn'),
  resetGameBtn: $('#reset-game-btn'),
  marketBtn: $('#market-btn')
};

// ── Audio ─────────────────────────────────────────────────────
let audioCtx = null;
let noiseBuffer = null;

function ensureAudio() {
  if (state.muted) return null;
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    audioCtx = new AC();
    const length = Math.floor(audioCtx.sampleRate * 0.6);
    noiseBuffer = audioCtx.createBuffer(1, length, audioCtx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  }
  if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
  return audioCtx;
}

function tone(freq, duration = 0.14, type = 'sine', volume = 0.045, delay = 0) {
  const ctx = ensureAudio();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const start = ctx.currentTime + delay;
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + duration + 0.03);
}

function waterSound() {
  const ctx = ensureAudio();
  if (!ctx || !noiseBuffer) return;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(1100, ctx.currentTime);
  filter.frequency.exponentialRampToValueAtTime(500, ctx.currentTime + 0.28);
  filter.Q.value = 0.8;
  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.055, ctx.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.34);
  src.connect(filter).connect(gain).connect(ctx.destination);
  src.start();
  src.stop(ctx.currentTime + 0.4);
}

function soundPlant() {
  tone(330, 0.12, 'sine', 0.04);
  tone(440, 0.16, 'sine', 0.03, 0.06);
}
function soundHarvest() {
  tone(523, 0.16, 'triangle', 0.045);
  tone(659, 0.18, 'triangle', 0.04, 0.07);
  tone(784, 0.25, 'triangle', 0.035, 0.14);
}
function soundCoin() {
  tone(880, 0.1, 'sine', 0.035);
  tone(1175, 0.16, 'sine', 0.03, 0.055);
}
function soundBuy() {
  tone(392, 0.1, 'triangle', 0.035);
  tone(587, 0.12, 'triangle', 0.03, 0.05);
}
function soundError() {
  tone(150, 0.12, 'sawtooth', 0.018);
  tone(120, 0.16, 'sawtooth', 0.015, 0.09);
}
function soundLevelUp() {
  [523, 659, 784, 1047].forEach((freq, i) => tone(freq, 0.28, 'sine', 0.04, i * 0.09));
}

// ── Game math ─────────────────────────────────────────────────
function hasUpgrade(id) {
  return state.upgrades.includes(id);
}

function growthSpeed(plot) {
  return 1 + (plot.watered ? 0.25 : 0) + (hasUpgrade('warmbed') ? 0.15 : 0);
}

function plotProgress(plot) {
  if (!plot || !plot.crop) return 0;
  const crop = CROPS[plot.crop];
  return clamp(((nowMs() - plot.plantedAt) * growthSpeed(plot)) / (crop.grow * 1000), 0, 1);
}

function plotStage(plot) {
  const progress = plotProgress(plot);
  if (progress >= 1) return 3;
  if (progress >= 0.66) return 2;
  if (progress >= 0.33) return 1;
  return 0;
}

function timeLeft(plot) {
  if (!plot?.crop) return 0;
  const crop = CROPS[plot.crop];
  const elapsed = nowMs() - plot.plantedAt;
  return Math.max(0, Math.ceil(crop.grow - (elapsed * growthSpeed(plot)) / 1000));
}

function levelFromXp(xp) {
  let level = 1;
  for (let i = 1; i < LEVELS.length; i++) {
    if (xp >= LEVELS[i]) level = i + 1;
  }
  return level;
}

function levelInfo() {
  const level = levelFromXp(state.xp);
  const base = LEVELS[level - 1] || 0;
  const next = LEVELS[level] ?? null;
  return {
    level,
    current: Math.max(0, state.xp - base),
    need: next ? next - base : 1,
    next
  };
}

function marketPhase() {
  return Math.floor(nowMs() / 180000);
}

function marketMultiplier(cropId) {
  const hash = hashString(`${cropId}:${marketPhase()}`);
  return 0.88 + ((hash % 1000) / 1000) * 0.26;
}

function cropSellPrice(cropId) {
  let price = CROPS[cropId].sell * marketMultiplier(cropId);
  if (hasUpgrade('compost')) price *= 1.12;
  if (hasUpgrade('stall')) price += 1;
  return Math.max(1, Math.round(price));
}

function totalProduce() {
  return CROP_IDS.reduce((sum, id) => sum + (state.produce[id] || 0), 0);
}

function questValue(quest) {
  return state.stats[quest.metric] || 0;
}

function activeQuest() {
  return QUESTS[state.quest.index] || null;
}

function questProgress() {
  const quest = activeQuest();
  if (!quest) return { quest: null, progress: 0, complete: true };
  const progress = Math.min(quest.target, Math.max(0, questValue(quest) - state.quest.baseline));
  return { quest, progress, complete: progress >= quest.target };
}

// ── Save ──────────────────────────────────────────────────────
function save() {
  if (saveSuppressed) return;
  state.lastSeen = nowMs();
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch {
    // Storage can be unavailable in private mode; the game still works for the session.
  }
}

// ── Toasts and floats ─────────────────────────────────────────
function toast(text, type = 'info', icon = '') {
  const icons = { info: '🌿', success: '✨', gold: '🪙', error: '💡' };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span class="toast-icon">${icon || icons[type] || '🌿'}</span><span>${text}</span>`;
  dom.toastStack.appendChild(el);
  while (dom.toastStack.children.length > 3) dom.toastStack.firstElementChild.remove();
  setTimeout(() => {
    el.classList.add('leaving');
    setTimeout(() => el.remove(), 300);
  }, 3200);
}

function coinFly(text, negative = false) {
  const el = document.createElement('div');
  el.className = 'coin-fly';
  el.textContent = text;
  if (negative) el.style.color = '#b26345';
  const rect = dom.coinPill.getBoundingClientRect();
  el.style.left = `${rect.left + rect.width * 0.55}px`;
  el.style.top = `${rect.top + rect.height * 0.6}px`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1000);
}

function bumpCoins() {
  dom.coinPill.classList.remove('bump');
  void dom.coinPill.offsetWidth;
  dom.coinPill.classList.add('bump');
}

// ─────────────────────────────────────────────────────────────
//  Three.js world
// ─────────────────────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({
  canvas: dom.canvas,
  antialias: true,
  alpha: true,
  powerPreference: 'high-performance'
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.setClearColor(0x000000, 0);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xdbe9d2, 34, 76);

const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 180);

const cam = {
  theta: 0.53,
  phi: 0.72,
  dist: 27,
  target: new THREE.Vector3(0, 1.15, 0.35),
  thetaGoal: 0.53,
  phiGoal: 0.72,
  distGoal: 27
};

const clock = new THREE.Clock();
const plotMeshes = [];
const actionMeshes = [];
const bursts = [];
const butterflies = [];
const smokePuffs = [];
const clouds = [];
let duck = null;
let pollen = null;
let sunSprite = null;
let sceneReady = false;
let lastPortrait = null;

// Cached materials
const flatMaterials = new Map();
function flat(color, extra = {}) {
  const key = `${color}:${extra.opacity || 1}:${extra.emissive || ''}`;
  if (!extra.opacity && !extra.emissive && flatMaterials.has(key)) return flatMaterials.get(key);
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.92,
    metalness: 0,
    flatShading: true,
    ...extra
  });
  if (!extra.opacity && !extra.emissive) flatMaterials.set(key, material);
  return material;
}

function smooth(color, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0, ...extra });
}

function addMesh(parent, geometry, material, x = 0, y = 0, z = 0, options = {}) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  if (options.rotation) mesh.rotation.set(...options.rotation);
  if (options.scale) {
    if (typeof options.scale === 'number') mesh.scale.setScalar(options.scale);
    else mesh.scale.set(...options.scale);
  }
  mesh.castShadow = options.castShadow !== false;
  mesh.receiveShadow = options.receiveShadow !== false;
  parent.add(mesh);
  return mesh;
}

function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function makeLabel(text, options = {}) {
  const width = 512;
  const height = 150;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const bg = options.bg || '#fff9e9';
  const fg = options.fg || '#35563d';
  const border = options.border || '#cdbd97';
  ctx.clearRect(0, 0, width, height);
  ctx.save();
  ctx.shadowColor = 'rgba(36, 58, 38, .25)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 8;
  roundedRect(ctx, 13, 11, width - 26, height - 28, 42);
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.restore();
  roundedRect(ctx, 13, 11, width - 26, height - 28, 42);
  ctx.lineWidth = 7;
  ctx.strokeStyle = border;
  ctx.stroke();
  ctx.fillStyle = fg;
  ctx.font = '900 58px Nunito, Trebuchet MS, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, width / 2, height / 2 + 1);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    toneMapped: false
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(2.35, 0.69, 1);
  return sprite;
}

function makeGlowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(128, 128, 2, 128, 128, 128);
  gradient.addColorStop(0, 'rgba(255, 250, 212, .95)');
  gradient.addColorStop(0.25, 'rgba(255, 235, 154, .58)');
  gradient.addColorStop(0.7, 'rgba(255, 226, 130, .12)');
  gradient.addColorStop(1, 'rgba(255, 226, 130, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 256, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function initLights() {
  const hemi = new THREE.HemisphereLight(0xfff7dd, 0x64835b, 1.85);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfff0cf, 2.85);
  sun.position.set(13, 21, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -17;
  sun.shadow.camera.right = 17;
  sun.shadow.camera.top = 17;
  sun.shadow.camera.bottom = -17;
  sun.shadow.camera.near = 2;
  sun.shadow.camera.far = 55;
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.035;
  scene.add(sun);

  const fill = new THREE.DirectionalLight(0xcfe4ef, 0.55);
  fill.position.set(-12, 9, -8);
  scene.add(fill);
}

function initSky() {
  return;
  const skyGeometry = new THREE.SphereGeometry(95, 32, 18);
  const skyMaterial = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColor: { value: new THREE.Color('#76b8d9') },
      midColor: { value: new THREE.Color('#c5e5e2') },
      bottomColor: { value: new THREE.Color('#f5e8c8') }
    },
    vertexShader: `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 midColor;
      uniform vec3 bottomColor;
      varying vec3 vWorldPosition;
      void main() {
        float h = normalize(vWorldPosition).y;
        vec3 color = mix(bottomColor, midColor, smoothstep(-0.08, 0.25, h));
        color = mix(color, topColor, smoothstep(0.22, 0.78, h));
        gl_FragColor = vec4(color, 1.0);
      }
    `
  });
  scene.add(new THREE.Mesh(skyGeometry, skyMaterial));

  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeGlowTexture(),
    color: 0xfff4cf,
    transparent: true,
    opacity: 0.95,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false
  }));
  glow.position.set(-31, 27, -45);
  glow.scale.set(25, 25, 1);
  scene.add(glow);
  sunSprite = glow;
}

function makeCloud(x, y, z, scale) {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({
    color: 0xfffdf2,
    roughness: 1,
    flatShading: true,
    transparent: true,
    opacity: 0.94
  });
  const puffs = [
    [-1.1, 0, 0, 0.75], [-0.3, 0.18, 0.1, 1], [0.6, 0.05, 0, 0.8],
    [1.35, -0.05, 0.12, 0.6], [0.1, -0.2, 0.2, 0.72]
  ];
  for (const [px, py, pz, s] of puffs) {
    const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), material);
    puff.position.set(px, py, pz);
    puff.scale.set(s * 1.6, s * 0.7, s);
    group.add(puff);
  }
  group.position.set(x, y, z);
  group.scale.setScalar(scale);
  group.userData.baseX = x;
  group.userData.speed = rand(0.05, 0.11);
  group.userData.phase = rand(0, Math.PI * 2);
  scene.add(group);
  clouds.push(group);
}

function initClouds() {
  makeCloud(-16, 7.2, -29, 1.25);
  makeCloud(13, 9.5, -34, 1.55);
  makeCloud(23, 5.2, -16, 0.95);
  makeCloud(-25, 7.8, -8, 1.05);
  makeCloud(2, 11.5, -46, 1.4);
}

function initIsland() {
  const grassMaterial = new THREE.MeshStandardMaterial({ color: 0x7fb266, roughness: 1 });
  const top = new THREE.Mesh(new THREE.CylinderGeometry(10.45, 10.45, 0.55, 64), grassMaterial);
  top.position.y = -0.275;
  top.receiveShadow = true;
  scene.add(top);

  const dirtMaterial = new THREE.MeshStandardMaterial({ color: 0x895a3b, roughness: 1, flatShading: true });
  const cliff = new THREE.Mesh(new THREE.CylinderGeometry(10.45, 9.7, 2.45, 64, 3), dirtMaterial);
  cliff.position.y = -1.75;
  cliff.receiveShadow = true;
  cliff.castShadow = true;
  scene.add(cliff);

  const lowerRock = new THREE.Mesh(
    new THREE.CylinderGeometry(9.7, 7.8, 1.35, 48, 2),
    new THREE.MeshStandardMaterial({ color: 0x77503a, roughness: 1, flatShading: true })
  );
  lowerRock.position.y = -3.6;
  lowerRock.castShadow = true;
  scene.add(lowerRock);

  const underside = new THREE.Mesh(
    new THREE.ConeGeometry(7.8, 3.4, 48),
    new THREE.MeshStandardMaterial({ color: 0x654633, roughness: 1, flatShading: true })
  );
  underside.position.y = -5.9;
  underside.rotation.x = Math.PI;
  scene.add(underside);

  // Soft mossy patches on the lawn
  const patchColors = [0x8cbd72, 0x77a961, 0x94c37b, 0x6f9f5c];
  for (let i = 0; i < 28; i++) {
    const angle = rand(0, Math.PI * 2);
    const radius = rand(4.7, 9.8);
    const x = Math.sin(angle) * radius;
    const z = Math.cos(angle) * radius;
    if (Math.abs(x) < 4.6 && z > -4.6 && z < 4.5) continue;
    const patch = new THREE.Mesh(
      new THREE.CircleGeometry(rand(0.35, 1.15), 12),
      new THREE.MeshStandardMaterial({ color: patchColors[i % patchColors.length], roughness: 1, transparent: true, opacity: 0.55 })
    );
    patch.rotation.x = -Math.PI / 2;
    patch.rotation.z = rand(0, Math.PI);
    patch.position.set(x, 0.008 + i * 0.0001, z);
    patch.receiveShadow = true;
    scene.add(patch);
  }

  // Scattered grass tufts
  const grassGeometry = new THREE.ConeGeometry(0.055, 0.26, 3);
  const grassInstances = new THREE.InstancedMesh(grassGeometry, flat(0x6f9d59), 150);
  const dummy = new THREE.Object3D();
  let placed = 0;
  let attempts = 0;
  while (placed < 150 && attempts < 900) {
    attempts++;
    const angle = rand(0, Math.PI * 2);
    const radius = rand(4.2, 10);
    const x = Math.sin(angle) * radius;
    const z = Math.cos(angle) * radius;
    if (Math.abs(x) < 4.9 && z > -4.5 && z < 4.6) continue;
    dummy.position.set(x, 0.12, z);
    dummy.rotation.set(rand(-0.1, 0.1), rand(0, Math.PI * 2), rand(-0.18, 0.18));
    dummy.scale.setScalar(rand(0.6, 1.5));
    dummy.updateMatrix();
    grassInstances.setMatrixAt(placed++, dummy.matrix);
  }
  grassInstances.count = placed;
  grassInstances.castShadow = true;
  scene.add(grassInstances);

  // Small boulders around the rim
  for (let i = 0; i < 13; i++) {
    const angle = rand(0, Math.PI * 2);
    const radius = rand(8.7, 10);
    const rock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(rand(0.16, 0.45), 0),
      flat(i % 3 === 0 ? 0x9b9a83 : 0xaaa78d)
    );
    rock.position.set(Math.sin(angle) * radius, rand(0.04, 0.14), Math.cos(angle) * radius);
    rock.rotation.set(rand(0, 2), rand(0, 2), rand(0, 2));
    rock.scale.y = rand(0.5, 0.85);
    rock.castShadow = true;
    rock.receiveShadow = true;
    scene.add(rock);
  }
}

function makeTree(scale, palette = 'green') {
  const group = new THREE.Group();
  const trunkColor = 0x8a5f3f;
  addMesh(group, new THREE.CylinderGeometry(0.14, 0.24, 1.7, 6), flat(trunkColor), 0, 0.85, 0);
  const colors = palette === 'pink'
    ? [0xf1b5ae, 0xf6c9bd, 0xeaa69f]
    : [0x6b9e53, 0x84b766, 0x5e924c];
  const clusters = [
    [0, 2.05, 0, 0.92], [-0.58, 1.72, 0.12, 0.66], [0.58, 1.78, -0.08, 0.7],
    [0.14, 2.55, 0.12, 0.62], [-0.25, 2.2, -0.38, 0.58]
  ];
  clusters.forEach(([x, y, z, s], index) => {
    const foliage = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), flat(colors[index % colors.length]));
    foliage.position.set(x, y, z);
    foliage.scale.set(s * 0.92, s * 0.78, s * 0.9);
    foliage.rotation.set(rand(0, 2), rand(0, 2), rand(0, 2));
    foliage.castShadow = true;
    foliage.receiveShadow = true;
    group.add(foliage);
  });
  group.scale.setScalar(scale);
  return group;
}

function makeBush(scale = 1, color = 0x7aac62) {
  const group = new THREE.Group();
  const colors = [color, 0x8abb6e, 0x679c53];
  for (let i = 0; i < 5; i++) {
    const sphere = new THREE.Mesh(new THREE.IcosahedronGeometry(rand(0.28, 0.48), 0), flat(colors[i % 3]));
    sphere.position.set(rand(-0.42, 0.42), rand(0.2, 0.42), rand(-0.34, 0.34));
    sphere.scale.y = rand(0.65, 0.9);
    sphere.castShadow = true;
    sphere.receiveShadow = true;
    group.add(sphere);
  }
  group.scale.setScalar(scale);
  return group;
}

function addFlower(x, z, color, scale = 1) {
  const group = new THREE.Group();
  addMesh(group, new THREE.CylinderGeometry(0.012, 0.018, 0.28, 4), flat(0x5d8e4c), 0, 0.14, 0, { castShadow: false });
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2;
    const petal = new THREE.Mesh(new THREE.SphereGeometry(0.055, 5, 4), flat(color));
    petal.position.set(Math.cos(angle) * 0.055, 0.3, Math.sin(angle) * 0.055);
    petal.scale.set(1.4, 0.45, 1);
    petal.castShadow = false;
    group.add(petal);
  }
  addMesh(group, new THREE.SphereGeometry(0.038, 6, 5), flat(0xf4c94c), 0, 0.305, 0, { castShadow: false });
  group.position.set(x, 0, z);
  group.rotation.y = rand(0, Math.PI * 2);
  group.scale.setScalar(scale);
  scene.add(group);
}

function initFoliage() {
  const trees = [
    [-8.75, -3.9, 1.18, 'green'], [-9.25, 1.1, 0.92, 'green'],
    [8.75, -4.75, 1.25, 'green'], [8.25, 5.2, 0.82, 'green'],
    [-4.1, -8.15, 1.1, 'green'], [3.7, -8.4, 1.02, 'green'],
    [9.15, 0.7, 0.8, 'green'], [-9.05, 6.55, 0.88, 'pink']
  ];
  for (const [x, z, scale, palette] of trees) {
    const tree = makeTree(scale, palette);
    tree.position.set(x, 0, z);
    tree.rotation.y = rand(0, Math.PI * 2);
    scene.add(tree);
  }

  const bushes = [
    [-6.2, -6.8, 1.25], [5.5, -7.1, 1.1], [8.9, 3.3, 0.95],
    [-8.6, 4.1, 0.8], [-3.9, 7.5, 0.9], [4.6, 7.3, 0.85]
  ];
  for (const [x, z, scale] of bushes) {
    const bush = makeBush(scale, 0x79aa60);
    bush.position.set(x, 0, z);
    scene.add(bush);
  }

  const flowerColors = [0xf2a7a1, 0xf4d36f, 0xefb1d1, 0xf8f0d7, 0xc9a8df];
  let flowers = 0;
  let tries = 0;
  while (flowers < 34 && tries < 300) {
    tries++;
    const angle = rand(0, Math.PI * 2);
    const radius = rand(4.6, 9.8);
    const x = Math.sin(angle) * radius;
    const z = Math.cos(angle) * radius;
    if (Math.abs(x) < 4.9 && z > -4.6 && z < 4.8) continue;
    addFlower(x, z, flowerColors[flowers % flowerColors.length], rand(0.8, 1.35));
    flowers++;
  }
}

function initPaths() {
  const stoneMaterial = flat(0xcdbd9f);
  const stones = [];
  for (let i = 0; i < 7; i++) stones.push([rand(-0.18, 0.18), 4.4 + i * 0.78]);
  stones.push([-4.6, 3.1], [-5.4, 2.85], [-6.15, 2.55]);
  stones.push([4.3, 1.25], [5.15, 0.85], [5.9, 0.25], [6.45, -0.45]);
  stones.forEach(([x, z], index) => {
    const stone = new THREE.Mesh(new THREE.BoxGeometry(rand(0.82, 1.02), 0.07, rand(0.55, 0.72)), stoneMaterial);
    stone.position.set(x, 0.035, z);
    stone.rotation.y = rand(-0.18, 0.18);
    stone.receiveShadow = true;
    stone.castShadow = true;
    scene.add(stone);
    if (index < 5) {
      const pebble = new THREE.Mesh(new THREE.DodecahedronGeometry(rand(0.06, 0.12), 0), flat(0xb9aa8c));
      pebble.position.set(x + rand(-0.5, 0.5), 0.04, z + rand(-0.3, 0.3));
      pebble.castShadow = true;
      scene.add(pebble);
    }
  });
}

function initFence() {
  const fenceMaterial = flat(0xc6a678);
  const posts = [];
  const segments = 30;
  const radius = 9.88;
  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const x = Math.sin(angle) * radius;
    const z = Math.cos(angle) * radius;
    if (Math.abs(angle) < 0.17 || Math.abs(angle - Math.PI * 2) < 0.17) continue;
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.82, 0.12), fenceMaterial);
    post.position.set(x, 0.41, z);
    post.rotation.y = angle;
    post.castShadow = true;
    post.receiveShadow = true;
    scene.add(post);
    posts.push({ x, z, angle });
  }
  for (let i = 0; i < posts.length - 1; i++) {
    const a = posts[i];
    const b = posts[i + 1];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const length = Math.hypot(dx, dz);
    if (length > 3) continue;
    for (const y of [0.34, 0.62]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(length, 0.07, 0.055), fenceMaterial);
      rail.position.set((a.x + b.x) / 2, y, (a.z + b.z) / 2);
      rail.rotation.y = Math.atan2(-dz, dx);
      rail.castShadow = true;
      rail.receiveShadow = true;
      scene.add(rail);
    }
  }
  // Gate posts
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.12, 0.18), fenceMaterial);
    post.position.set(side * 1.72, 0.56, 9.76);
    post.castShadow = true;
    scene.add(post);
  }
}

function initPond() {
  const group = new THREE.Group();
  group.position.set(-6.55, 0, 6.05);

  const bank = new THREE.Mesh(new THREE.RingGeometry(1.35, 1.68, 40), flat(0xc7b68e));
  bank.rotation.x = -Math.PI / 2;
  bank.position.y = 0.018;
  bank.receiveShadow = true;
  group.add(bank);

  const water = new THREE.Mesh(
    new THREE.CircleGeometry(1.38, 40),
    new THREE.MeshPhysicalMaterial({
      color: 0x65b5cb,
      roughness: 0.18,
      metalness: 0.02,
      transmission: 0,
      transparent: true,
      opacity: 0.88,
      clearcoat: 0.8,
      clearcoatRoughness: 0.15
    })
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.035;
  water.receiveShadow = true;
  water.userData.isPond = true;
  group.add(water);

  for (let i = 0; i < 11; i++) {
    const angle = (i / 11) * Math.PI * 2 + rand(-0.12, 0.12);
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(rand(0.16, 0.32), 0), flat(i % 2 ? 0x9a9a83 : 0xaea98e));
    rock.position.set(Math.cos(angle) * rand(1.45, 1.65), rand(0.06, 0.16), Math.sin(angle) * rand(1.45, 1.65));
    rock.rotation.set(rand(0, 2), rand(0, 2), rand(0, 2));
    rock.castShadow = true;
    group.add(rock);
  }

  for (let i = 0; i < 3; i++) {
    const pad = new THREE.Mesh(new THREE.CircleGeometry(rand(0.16, 0.26), 10), flat(0x659a55));
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(rand(-0.8, 0.8), 0.045 + i * 0.001, rand(-0.7, 0.7));
    group.add(pad);
    if (i === 1) {
      const flower = new THREE.Mesh(new THREE.SphereGeometry(0.055, 6, 5), flat(0xf6e7ef));
      flower.position.set(pad.position.x, 0.09, pad.position.z);
      group.add(flower);
    }
  }

  // Cattails
  for (let i = 0; i < 5; i++) {
    const angle = rand(0, Math.PI * 2);
    const radius = rand(1.2, 1.55);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.018, rand(0.55, 0.85), 4), flat(0x698b4e));
    stem.position.set(Math.cos(angle) * radius, 0.32, Math.sin(angle) * radius);
    stem.castShadow = true;
    group.add(stem);
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.16, 6), flat(0x79563c));
    tip.position.set(stem.position.x, 0.76, stem.position.z);
    tip.castShadow = true;
    group.add(tip);
  }

  // A tiny wooden jetty
  const jetty = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.05, 0.18), flat(0xb1875d));
    plank.position.set(-0.1, 0.08, 1.18 + i * 0.17);
    plank.castShadow = true;
    jetty.add(plank);
  }
  group.add(jetty);

  // Duck
  duck = new THREE.Group();
  const duckBody = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 6), flat(0xf5f0dd));
  duckBody.scale.set(1.25, 0.75, 1);
  duckBody.castShadow = true;
  duck.add(duckBody);
  const duckHead = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), flat(0xf8f4e4));
  duckHead.position.set(0.16, 0.14, 0);
  duckHead.castShadow = true;
  duck.add(duckHead);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.1, 6), flat(0xe9a33e));
  beak.rotation.z = -Math.PI / 2;
  beak.position.set(0.27, 0.13, 0);
  duck.add(beak);
  duck.position.set(0.35, 0.16, -0.35);
  group.add(duck);

  scene.add(group);
}

function initMarketStand() {
  const group = new THREE.Group();
  group.position.set(-7.05, 0, 2.15);
  group.rotation.y = 0.18;

  addMesh(group, new THREE.BoxGeometry(2.6, 0.12, 1.5), flat(0xb2865c), 0, 0.06, 0);
  for (const x of [-1.05, 1.05]) {
    for (const z of [-0.58, 0.58]) {
      addMesh(group, new THREE.CylinderGeometry(0.055, 0.07, 2.15, 6), flat(0xa87c53), x, 1.1, z);
    }
  }

  // Counter
  addMesh(group, new THREE.BoxGeometry(2.25, 0.68, 0.7), flat(0xc79a6a), 0, 0.58, 0.28);
  addMesh(group, new THREE.BoxGeometry(2.32, 0.08, 0.78), flat(0xe0b884), 0, 0.94, 0.28);

  // Striped canopy
  const canopy = new THREE.Group();
  canopy.position.y = 2.18;
  canopy.rotation.x = 0.08;
  for (let i = 0; i < 7; i++) {
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(0.37, 0.07, 1.65),
      flat(i % 2 ? 0xe5d2ae : 0xc76f50)
    );
    stripe.position.x = -1.11 + i * 0.37;
    stripe.castShadow = true;
    canopy.add(stripe);
  }
  group.add(canopy);

  // Crates and produce
  for (let i = 0; i < 2; i++) {
    const crate = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.28, 0.45), flat(0xb48457));
    box.castShadow = true;
    crate.add(box);
    for (let j = 0; j < 5; j++) {
      const fruit = new THREE.Mesh(new THREE.SphereGeometry(0.075, 6, 5), flat(j % 2 ? 0xe27b4b : 0xdaa33e));
      fruit.position.set(rand(-0.19, 0.19), 0.16, rand(-0.12, 0.12));
      fruit.castShadow = true;
      crate.add(fruit);
    }
    crate.position.set(-0.58 + i * 1.1, 1.02, 0.33);
    crate.rotation.y = rand(-0.12, 0.12);
    group.add(crate);
  }

  // Jars on the counter
  for (let i = 0; i < 3; i++) {
    const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.2, 8), new THREE.MeshPhysicalMaterial({
      color: 0xbfd8cf, roughness: 0.1, transparent: true, opacity: 0.55
    }));
    jar.position.set(0.62 + i * 0.18, 1.1, 0.2);
    jar.castShadow = true;
    group.add(jar);
  }

  const sign = makeLabel('РЫНОК', { bg: '#fff8e7', fg: '#35563d', border: '#c7b68c' });
  sign.position.set(0, 2.95, 0.1);
  group.add(sign);

  const hit = new THREE.Mesh(
    new THREE.BoxGeometry(3.0, 2.4, 2.0),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false })
  );
  hit.position.set(0, 1.2, 0);
  hit.userData.action = 'market';
  group.add(hit);
  actionMeshes.push(hit);

  scene.add(group);
}

function initHouse() {
  const group = new THREE.Group();
  group.position.set(7.1, 0, -3.2);
  group.rotation.y = -0.42;

  addMesh(group, new THREE.BoxGeometry(3.1, 2.15, 2.6), smooth(0xf3e5c8), 0, 1.08, 0);
  addMesh(group, new THREE.BoxGeometry(3.24, 0.16, 2.74), flat(0xd9c8a5), 0, 0.1, 0);

  const roof = new THREE.Mesh(new THREE.ConeGeometry(2.52, 1.4, 4), flat(0xc76f50));
  roof.position.y = 2.75;
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  roof.receiveShadow = true;
  group.add(roof);
  addMesh(group, new THREE.BoxGeometry(3.35, 0.11, 2.85), flat(0xb65f45), 0, 2.18, 0);

  addMesh(group, new THREE.BoxGeometry(0.65, 1.1, 0.08), flat(0x8a5d3d), 0, 0.65, 1.32);
  addMesh(group, new THREE.SphereGeometry(0.035, 6, 5), flat(0xe4bd63), 0.19, 0.67, 1.38);

  const windowFrame = addMesh(group, new THREE.BoxGeometry(0.62, 0.62, 0.08), flat(0x8a5d3d), 0.92, 1.38, 1.32);
  windowFrame.castShadow = true;
  addMesh(group, new THREE.PlaneGeometry(0.5, 0.5), new THREE.MeshStandardMaterial({
    color: 0xffe0a0, emissive: 0xefae4f, emissiveIntensity: 0.55, roughness: 0.7
  }), 0.92, 1.38, 1.37, { castShadow: false });
  addMesh(group, new THREE.BoxGeometry(0.05, 0.5, 0.03), flat(0x8a5d3d), 0.92, 1.38, 1.39, { castShadow: false });

  // Chimney and smoke
  addMesh(group, new THREE.BoxGeometry(0.34, 0.9, 0.34), flat(0xa06b4b), 0.82, 3.2, -0.4);
  for (let i = 0; i < 7; i++) {
    const puff = new THREE.Mesh(
      new THREE.SphereGeometry(0.1 + i * 0.016, 6, 5),
      new THREE.MeshBasicMaterial({ color: 0xf1eee2, transparent: true, opacity: 0.3 - i * 0.025, depthWrite: false })
    );
    puff.position.set(0.82 + i * 0.08, 3.75 + i * 0.22, -0.4);
    puff.userData.baseY = puff.position.y;
    puff.userData.phase = i * 0.5;
    group.add(puff);
    smokePuffs.push(puff);
  }

  const sign = makeLabel('ДОМ', { bg: '#f8efd9', fg: '#486247', border: '#d6c19b' });
  sign.position.set(-0.7, 3.45, 0.3);
  sign.scale.set(1.55, 0.46, 1);
  group.add(sign);

  const hit = new THREE.Mesh(
    new THREE.BoxGeometry(3.6, 3.2, 3.0),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false })
  );
  hit.position.set(0, 1.6, 0);
  hit.userData.action = 'house';
  group.add(hit);
  actionMeshes.push(hit);

  const warmLight = new THREE.PointLight(0xffc879, 2.3, 6, 2);
  warmLight.position.set(0.9, 1.3, 1.7);
  group.add(warmLight);

  scene.add(group);
}

function initAmbientLife() {
  // Floating pollen
  const count = 110;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const angle = rand(0, Math.PI * 2);
    const radius = rand(1.5, 10);
    positions[i * 3] = Math.sin(angle) * radius;
    positions[i * 3 + 1] = rand(0.4, 5.8);
    positions[i * 3 + 2] = Math.cos(angle) * radius;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: 0xfff0b0,
    size: 0.055,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true
  });
  pollen = new THREE.Points(geometry, material);
  scene.add(pollen);

  // Butterflies
  const wingGeometry = new THREE.SphereGeometry(0.12, 5, 4);
  const palettes = [0xf4c84f, 0xed956c, 0x89b9dc, 0xf3d7a1];
  for (let i = 0; i < 4; i++) {
    const group = new THREE.Group();
    const material = flat(palettes[i]);
    const leftWing = new THREE.Mesh(wingGeometry, material);
    leftWing.scale.set(1.25, 0.1, 0.9);
    leftWing.position.x = -0.1;
    leftWing.castShadow = false;
    const rightWing = leftWing.clone();
    rightWing.position.x = 0.1;
    group.add(leftWing, rightWing);
    group.userData = {
      leftWing, rightWing,
      center: new THREE.Vector3(rand(-4, 4), rand(1.2, 2.6), rand(-2.5, 3.8)),
      radiusX: rand(1.1, 2.5),
      radiusZ: rand(0.8, 1.9),
      speed: rand(0.25, 0.48),
      phase: rand(0, Math.PI * 2),
      bob: rand(0.25, 0.5)
    };
    scene.add(group);
    butterflies.push(group);
  }

  // A few birds high in the sky
  const birdMaterial = new THREE.MeshBasicMaterial({ color: 0x516d62, side: THREE.DoubleSide, transparent: true, opacity: 0.55 });
  for (let i = 0; i < 5; i++) {
    const bird = new THREE.Group();
    for (const side of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.09), birdMaterial);
      wing.position.x = side * 0.16;
      wing.rotation.z = side * 0.35;
      bird.add(wing);
    }
    bird.position.set(rand(-24, 24), rand(13, 19), rand(-30, -12));
    bird.rotation.y = rand(-0.3, 0.3);
    bird.userData.phase = rand(0, Math.PI * 2);
    scene.add(bird);
    butterflies.push(bird);
  }
}

// ── Crop models ───────────────────────────────────────────────
const cropTemplates = {};

function part(group, mesh, minStage = 0) {
  mesh.userData.minStage = minStage;
  mesh.castShadow = true;
  mesh.receiveShadow = false;
  group.add(mesh);
  return mesh;
}

function buildCropTemplate(id) {
  const group = new THREE.Group();
  const green = flat(0x6ca24f);
  const greenLight = flat(0x8ec568);
  const greenDark = flat(0x54873f);

  if (id === 'carrot') {
    const root = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.56, 7), flat(0xe8873a));
    root.rotation.x = Math.PI;
    root.position.y = 0.26;
    part(group, root, 1);
    const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), flat(0xef9946));
    shoulder.scale.y = 0.52;
    shoulder.position.y = 0.52;
    part(group, shoulder, 1);
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.6, 4), flat(i % 2 ? 0x75aa51 : 0x5f9547));
      leaf.position.set(Math.cos(angle) * 0.1, 0.8, Math.sin(angle) * 0.1);
      leaf.rotation.z = -Math.cos(angle) * 0.52;
      leaf.rotation.x = Math.sin(angle) * 0.52;
      part(group, leaf, 0);
    }
  } else if (id === 'lettuce') {
    const layers = [
      [0.47, 0.15, 0.58, 0.24, 0x6da14f],
      [0.37, 0.28, 0.48, 0.2, 0x83b85d],
      [0.27, 0.4, 0.38, 0.18, 0x9bcb73]
    ];
    layers.forEach(([radius, y, sx, sy, color], index) => {
      const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), flat(color));
      leaf.scale.set(sx, sy, sx);
      leaf.position.y = y;
      leaf.rotation.y = index * 0.7;
      part(group, leaf, index);
    });
    for (let i = 0; i < 7; i++) {
      const angle = (i / 7) * Math.PI * 2;
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.22, 6, 4), flat(i % 2 ? 0x78ad55 : 0x91c169));
      leaf.position.set(Math.cos(angle) * 0.37, 0.1, Math.sin(angle) * 0.37);
      leaf.scale.set(1.45, 0.28, 0.72);
      leaf.rotation.y = -angle;
      leaf.rotation.z = 0.24;
      part(group, leaf, 0);
    }
  } else if (id === 'tomato') {
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.95, 5), greenDark);
    stem.position.y = 0.48;
    part(group, stem, 0);
    const leafSpots = [
      [-0.13, 0.34, 0.04, 0.55], [0.15, 0.49, -0.03, -0.5], [-0.14, 0.64, 0.02, 0.7],
      [0.12, 0.79, 0.03, -0.65], [0.02, 0.9, -0.1, 0.2]
    ];
    for (const [x, y, z, rot] of leafSpots) {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 4), flat(0x71a751));
      leaf.scale.set(1.55, 0.3, 0.7);
      leaf.position.set(x, y, z);
      leaf.rotation.z = rot;
      part(group, leaf, 0);
    }
    const fruitPositions = [[0.19, 0.56, 0.08], [-0.17, 0.68, -0.04], [0.04, 0.45, 0.19]];
    fruitPositions.forEach(([x, y, z], index) => {
      const fruit = new THREE.Mesh(new THREE.SphereGeometry(0.145, 8, 6), flat(index === 1 ? 0xdb6448 : 0xe77550));
      fruit.scale.y = 0.92;
      fruit.position.set(x, y, z);
      part(group, fruit, 2);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.07, 5), flat(0x5e8d49));
      cap.position.set(x, y + 0.13, z);
      part(group, cap, 2);
    });
    for (let i = 0; i < 2; i++) {
      const flower = new THREE.Mesh(new THREE.SphereGeometry(0.045, 5, 4), flat(0xf4d05e));
      flower.position.set(i ? 0.11 : -0.1, 0.82, i ? -0.05 : 0.07);
      part(group, flower, 1);
    }
  } else if (id === 'sunflower') {
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 1.32, 5), greenDark);
    stem.position.y = 0.66;
    part(group, stem, 0);
    for (let i = 0; i < 4; i++) {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.18, 6, 4), flat(i % 2 ? 0x6da34f : 0x82b75c));
      leaf.scale.set(1.6, 0.28, 0.7);
      leaf.position.set(i % 2 ? 0.18 : -0.18, 0.42 + i * 0.22, 0.02);
      leaf.rotation.z = i % 2 ? -0.35 : 0.35;
      part(group, leaf, 0);
    }
    const head = new THREE.Group();
    head.position.set(0, 1.34, 0.04);
    head.rotation.x = -0.18;
    const center = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.08, 12), flat(0x76502f));
    center.rotation.x = Math.PI / 2;
    center.position.z = 0.03;
    center.userData.minStage = 2;
    center.castShadow = true;
    head.add(center);
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const petal = new THREE.Mesh(new THREE.SphereGeometry(0.12, 5, 4), flat(i % 2 ? 0xf3c843 : 0xf8d85c));
      petal.position.set(Math.cos(angle) * 0.25, Math.sin(angle) * 0.25, 0.015);
      petal.scale.set(1.5, 0.55, 0.16);
      petal.rotation.z = angle;
      petal.userData.minStage = 2;
      petal.castShadow = true;
      head.add(petal);
    }
    head.scale.setScalar(1.22);
    group.add(head);
  } else if (id === 'strawberry') {
    for (let i = 0; i < 9; i++) {
      const angle = (i / 9) * Math.PI * 2;
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.2, 6, 4), flat(i % 2 ? 0x6ca34f : 0x8cbd63));
      leaf.position.set(Math.cos(angle) * 0.25, 0.16 + (i % 3) * 0.05, Math.sin(angle) * 0.25);
      leaf.scale.set(1.45, 0.28, 0.7);
      leaf.rotation.y = -angle;
      leaf.rotation.z = 0.18;
      part(group, leaf, 0);
    }
    const berries = [[0.18, 0.3, 0.1], [-0.18, 0.26, -0.08], [0.02, 0.33, -0.2]];
    berries.forEach(([x, y, z], index) => {
      const berry = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.22, 7), flat(index === 1 ? 0xcf4f57 : 0xdf5e63));
      berry.rotation.x = Math.PI;
      berry.position.set(x, y, z);
      part(group, berry, 2);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.05, 6), flat(0x5d8b47));
      cap.position.set(x, y + 0.1, z);
      part(group, cap, 2);
    });
    for (let i = 0; i < 3; i++) {
      const flower = new THREE.Mesh(new THREE.SphereGeometry(0.04, 5, 4), flat(0xf8f1df));
      flower.position.set(Math.cos(i * 2.1) * 0.25, 0.3, Math.sin(i * 2.1) * 0.25);
      part(group, flower, 1);
    }
  } else if (id === 'pumpkin') {
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.46, 12, 8), flat(0xe18a38));
    body.scale.set(1.12, 0.72, 1.12);
    body.position.y = 0.35;
    part(group, body, 2);
    for (let i = 0; i < 4; i++) {
      const ridge = new THREE.Mesh(new THREE.SphereGeometry(0.46, 10, 6), flat(i % 2 ? 0xd77d31 : 0xec9a42));
      ridge.scale.set(0.2, 0.68, 0.98);
      ridge.position.set(Math.cos((i / 4) * Math.PI) * 0.38, 0.35, 0);
      ridge.rotation.y = (i / 4) * Math.PI;
      part(group, ridge, 2);
    }
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.075, 0.2, 5), flat(0x668c46));
    stem.position.y = 0.72;
    part(group, stem, 2);
    for (let i = 0; i < 3; i++) {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.24, 6, 4), flat(i % 2 ? 0x5f9447 : 0x77aa57));
      leaf.scale.set(1.5, 0.22, 0.85);
      leaf.position.set(rand(-0.48, 0.48), 0.11, rand(-0.48, 0.48));
      leaf.rotation.y = rand(0, Math.PI);
      part(group, leaf, 1);
    }
  }

  return group;
}

function initCropTemplates() {
  for (const id of CROP_IDS) cropTemplates[id] = buildCropTemplate(id);
}

// ── Garden beds ───────────────────────────────────────────────
function initGarden() {
  const bedWood = flat(0xb07b4e);
  const bedWoodDark = flat(0x93633f);
  const bedPositions = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      bedPositions.push({ x: (col - 1) * 3.0, z: (row - 1) * 2.75 + 0.35 });
    }
  }

  bedPositions.forEach((position, index) => {
    const group = new THREE.Group();
    group.position.set(position.x, 0, position.z);
    scene.add(group);

    const base = new THREE.Mesh(new THREE.BoxGeometry(2.72, 0.34, 2.42), bedWood);
    base.position.y = 0.17;
    base.castShadow = true;
    base.receiveShadow = true;
    group.add(base);

    const rim = new THREE.Mesh(new THREE.BoxGeometry(2.82, 0.09, 2.52), bedWoodDark);
    rim.position.y = 0.36;
    rim.castShadow = true;
    group.add(rim);

    for (const x of [-1.34, 1.34]) {
      for (const z of [-1.19, 1.19]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.5, 0.14), bedWoodDark);
        post.position.set(x, 0.26, z);
        post.castShadow = true;
        group.add(post);
      }
    }

    const soilMaterial = new THREE.MeshStandardMaterial({ color: 0x73503a, roughness: 1 });
    const soil = new THREE.Mesh(new THREE.BoxGeometry(2.46, 0.07, 2.16), soilMaterial);
    soil.position.y = 0.39;
    soil.receiveShadow = true;
    group.add(soil);

    for (let row = 0; row < 4; row++) {
      const furrow = new THREE.Mesh(new THREE.BoxGeometry(2.12, 0.025, 0.075), flat(0x60412f));
      furrow.position.set(0, 0.435, -0.66 + row * 0.44);
      furrow.receiveShadow = true;
      group.add(furrow);
    }

    const highlight = new THREE.Mesh(
      new THREE.PlaneGeometry(2.86, 2.56),
      new THREE.MeshBasicMaterial({ color: 0xffd66b, transparent: true, opacity: 0, depthWrite: false })
    );
    highlight.rotation.x = -Math.PI / 2;
    highlight.position.y = 0.447;
    highlight.renderOrder = 2;
    group.add(highlight);

    const root = new THREE.Group();
    root.position.y = 0.43;
    group.add(root);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.55, 0.72, 32),
      new THREE.MeshBasicMaterial({ color: 0xffd45e, transparent: true, opacity: 0.75, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.025;
    ring.visible = false;
    root.add(ring);

    const sparkleGeometry = new THREE.BufferGeometry();
    const sparklePositions = new Float32Array(24 * 3);
    for (let i = 0; i < 24; i++) {
      const angle = rand(0, Math.PI * 2);
      const radius = rand(0.35, 0.9);
      sparklePositions[i * 3] = Math.cos(angle) * radius;
      sparklePositions[i * 3 + 1] = rand(0.25, 1.45);
      sparklePositions[i * 3 + 2] = Math.sin(angle) * radius;
    }
    sparkleGeometry.setAttribute('position', new THREE.BufferAttribute(sparklePositions, 3));
    const sparkles = new THREE.Points(sparkleGeometry, new THREE.PointsMaterial({
      color: 0xffdc7b, size: 0.075, transparent: true, opacity: 0.9,
      depthWrite: false, blending: THREE.AdditiveBlending
    }));
    sparkles.visible = false;
    root.add(sparkles);

    const hit = new THREE.Mesh(
      new THREE.BoxGeometry(2.85, 1.15, 2.55),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false })
    );
    hit.position.y = 0.65;
    hit.userData.plotIndex = index;
    group.add(hit);
    plotMeshes.push(hit);

    plotMeshes[index].userData.group = group;
    plotMeshes[index].userData.position = new THREE.Vector3(position.x, 0, position.z);
    plotMeshes[index].root = root;
    plotMeshes[index].ring = ring;
    plotMeshes[index].sparkles = sparkles;
    plotMeshes[index].soilMaterial = soilMaterial;
    plotMeshes[index].highlight = highlight;
    plotMeshes[index].cropGroup = null;
    plotMeshes[index].stage = -1;
    plotMeshes[index].spawnAt = 0;
    plotMeshes[index].baseSoil = new THREE.Color(0x73503a);
    plotMeshes[index].wetSoil = new THREE.Color(0x5b3f2d);
  });
}

function removeCropGroup(plotData) {
  if (!plotData.cropGroup) return;
  plotData.root.remove(plotData.cropGroup);
  plotData.cropGroup = null;
  plotData.stage = -1;
}

function applyCropStage(index) {
  const plotData = plotMeshes[index];
  if (!plotData?.cropGroup) return;
  const plot = state.plots[index];
  if (!plot.crop) return;
  const stage = plotStage(plot);
  if (stage === plotData.stage) return;
  plotData.stage = stage;
  plotData.cropGroup.traverse((object) => {
    if (object.userData.minStage !== undefined) {
      object.visible = stage >= object.userData.minStage;
    }
  });
  const scale = [0.55, 0.82, 1.02, 1.16][stage];
  plotData.cropGroup.scale.setScalar(scale);
}

function refreshPlot(index, animate = false) {
  const plotData = plotMeshes[index];
  const plot = state.plots[index];
  if (!plotData) return;

  if (!plot.crop) {
    removeCropGroup(plotData);
    plotData.ring.visible = false;
    plotData.sparkles.visible = false;
    plotData.soilMaterial.color.copy(plotData.baseSoil);
    return;
  }

  if (!plotData.cropGroup) {
    const template = cropTemplates[plot.crop];
    plotData.cropGroup = template.clone(true);
    plotData.cropGroup.traverse((object) => {
      if (object.isMesh) {
        object.castShadow = true;
        object.receiveShadow = false;
      }
    });
    plotData.root.add(plotData.cropGroup);
    plotData.stage = -1;
    plotData.spawnAt = animate ? performance.now() : 0;
    plotData.root.scale.setScalar(animate ? 0.001 : 1);
  }

  applyCropStage(index);
  const mature = plotProgress(plot) >= 1;
  plotData.ring.visible = mature;
  plotData.sparkles.visible = mature;
  plotData.soilMaterial.color.copy(plot.watered ? plotData.wetSoil : plotData.baseSoil);
}

function refreshAllPlots(animate = false) {
  state.plots.forEach((_, index) => refreshPlot(index, animate));
}

// ── Particles and bursts ──────────────────────────────────────
function spawnBurst(position, color, count = 14, options = {}) {
  const positions = new Float32Array(count * 3);
  const velocities = [];
  for (let i = 0; i < count; i++) {
    positions[i * 3] = position.x + rand(-0.12, 0.12);
    positions[i * 3 + 1] = position.y + rand(-0.05, 0.15);
    positions[i * 3 + 2] = position.z + rand(-0.12, 0.12);
    velocities.push(new THREE.Vector3(rand(-0.9, 0.9), rand(0.8, 2.1), rand(-0.9, 0.9)));
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color,
    size: options.size || 0.12,
    transparent: true,
    opacity: 1,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const points = new THREE.Points(geometry, material);
  scene.add(points);
  bursts.push({
    points,
    velocities,
    life: 1,
    decay: options.decay || 1.5,
    gravity: options.gravity ?? 2.1
  });
}

function updateBursts(delta) {
  for (let i = bursts.length - 1; i >= 0; i--) {
    const burst = bursts[i];
    burst.life -= delta * burst.decay;
    const positions = burst.points.geometry.attributes.position.array;
    for (let j = 0; j < burst.velocities.length; j++) {
      const velocity = burst.velocities[j];
      velocity.y -= burst.gravity * delta;
      positions[j * 3] += velocity.x * delta;
      positions[j * 3 + 1] += velocity.y * delta;
      positions[j * 3 + 2] += velocity.z * delta;
    }
    burst.points.geometry.attributes.position.needsUpdate = true;
    burst.points.material.opacity = Math.max(0, burst.life);
    if (burst.life <= 0) {
      scene.remove(burst.points);
      burst.points.geometry.dispose();
      burst.points.material.dispose();
      bursts.splice(i, 1);
    }
  }
}

// ─────────────────────────────────────────────────────────────
//  Camera and input
// ─────────────────────────────────────────────────────────────
const raycaster = new THREE.Raycaster();
const pointerNdc = new THREE.Vector2();
const pointerState = {
  down: false,
  moved: false,
  startX: 0,
  startY: 0,
  lastX: 0,
  lastY: 0,
  id: null,
  downAt: 0,
  pinchStart: 0,
  pinchDist: 0,
  pointers: new Map()
};

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const aspect = width / height;
  renderer.setSize(width, height, false);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, width < 700 ? 1.75 : 2));
  camera.aspect = aspect;
  camera.fov = aspect < 0.72 ? 40 : 36;
  camera.updateProjectionMatrix();
  const portrait = aspect < 0.8;
  if (lastPortrait === null || portrait !== lastPortrait) {
    cam.distGoal = portrait ? 32 : 27;
    cam.dist = cam.distGoal;
    lastPortrait = portrait;
  }
}

function updateCamera(delta) {
  const smoothFactor = 1 - Math.exp(-delta * 9);
  cam.theta += (cam.thetaGoal - cam.theta) * smoothFactor;
  cam.phi += (cam.phiGoal - cam.phi) * smoothFactor;
  cam.dist += (cam.distGoal - cam.dist) * smoothFactor;

  const horizontal = Math.cos(cam.phi) * cam.dist;
  camera.position.set(
    cam.target.x + Math.sin(cam.theta) * horizontal,
    cam.target.y + Math.sin(cam.phi) * cam.dist,
    cam.target.z + Math.cos(cam.theta) * horizontal
  );
  camera.lookAt(cam.target);
  if (sunSprite) sunSprite.material.opacity = 0.9;
}

function resetCamera() {
  cam.thetaGoal = 0.53;
  cam.phiGoal = 0.72;
  cam.distGoal = window.innerWidth / window.innerHeight < 0.8 ? 32 : 27;
  toast('Камера вернулась к саду', 'info', '⌖');
}

function setPointerNdc(clientX, clientY) {
  const rect = dom.canvas.getBoundingClientRect();
  pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
}

function raycastAt(clientX, clientY) {
  setPointerNdc(clientX, clientY);
  raycaster.setFromCamera(pointerNdc, camera);
  const hits = raycaster.intersectObjects([...actionMeshes, ...plotMeshes], false);
  if (!hits.length) return null;
  const hit = hits[0].object;
  if (hit.userData.action) return { type: 'action', action: hit.userData.action, object: hit };
  if (hit.userData.plotIndex !== undefined) return { type: 'plot', index: hit.userData.plotIndex, object: hit };
  return null;
}

function setHoveredPlot(index) {
  if (hoveredPlot === index) return;
  if (hoveredPlot !== null && plotMeshes[hoveredPlot]) {
    plotMeshes[hoveredPlot].highlight.material.opacity = 0;
  }
  hoveredPlot = index;
  if (index !== null && plotMeshes[index]) {
    plotMeshes[index].highlight.material.opacity = 0.2;
  }
}

function hideHoverTip() {
  dom.hoverTip.classList.remove('show');
  setHoveredPlot(null);
  dom.canvas.classList.remove('pointing');
}

function showHoverTip(hit, clientX, clientY) {
  if (!hit) {
    hideHoverTip();
    return;
  }
  let title = '';
  let subtitle = '';
  let progress = null;
  let accent = '';
  if (hit.type === 'plot') {
    const plot = state.plots[hit.index];
    if (!plot.crop) {
      title = 'Свободная грядка';
      subtitle = 'Нажми, чтобы посадить семечко';
      accent = '🌱';
    } else {
      const crop = CROPS[plot.crop];
      const progressValue = plotProgress(plot);
      if (progressValue >= 1) {
        title = `${crop.emoji} ${crop.name}`;
        subtitle = 'Урожай созрел — нажми, чтобы собрать';
        progress = 1;
      } else if (!plot.watered) {
        title = `${crop.emoji} ${crop.name}`;
        subtitle = 'Хочет пить — нажми, чтобы полить';
        progress = progressValue;
      } else {
        title = `${crop.emoji} ${crop.name}`;
        subtitle = `Растёт · ${Math.round(progressValue * 100)}% · ещё ${timeLeft(plot)} с`;
        progress = progressValue;
      }
    }
    setHoveredPlot(hit.index);
    dom.canvas.classList.add('pointing');
  } else {
    setHoveredPlot(null);
    dom.canvas.classList.add('pointing');
    if (hit.action === 'market') {
      title = '🏪 Деревенский рынок';
      subtitle = 'Купить семена или продать урожай';
    } else if (hit.action === 'house') {
      title = '🏡 Дом';
      subtitle = 'Уютное место для отдыха';
    }
  }
  const x = clamp(clientX, 110, window.innerWidth - 110);
  const y = clamp(clientY, 96, window.innerHeight - 24);
  dom.hoverTip.innerHTML = `
    <div class="tip-title"><span>${accent || ''}</span>${title}</div>
    <div class="tip-sub">${subtitle}</div>
    ${progress !== null ? `<div class="tip-progress"><i style="width:${Math.round(progress * 100)}%"></i></div>` : ''}
  `;
  dom.hoverTip.style.left = `${x}px`;
  dom.hoverTip.style.top = `${y}px`;
  dom.hoverTip.classList.add('show');
}

function handleSceneClick(clientX, clientY) {
  const hit = raycastAt(clientX, clientY);
  if (!hit) {
    if (!dom.seedPicker.hidden) closeSeedPicker();
    return;
  }
  if (hit.type === 'action') {
    if (hit.action === 'market') {
      const tab = totalProduce() > 0 ? 'sell' : 'seeds';
      openMarket(tab);
    } else if (hit.action === 'house') {
      toast('Дом, милый дом. Чайник уже греется ☕', 'info', '🏡');
    }
    return;
  }

  const plot = state.plots[hit.index];
  if (!plot.crop) {
    openSeedPicker(hit.index);
    return;
  }
  if (plotProgress(plot) >= 1) {
    harvestPlot(hit.index);
  } else if (!plot.watered) {
    waterPlot(hit.index);
  } else {
    toast('Росток уже полит — скоро всё вырастет', 'info', '🌿');
  }
}

function onPointerDown(event) {
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  ensureAudio();
  dom.canvas.setPointerCapture?.(event.pointerId);
  pointerState.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (pointerState.pointers.size === 1) {
    pointerState.down = true;
    pointerState.moved = false;
    pointerState.startX = event.clientX;
    pointerState.startY = event.clientY;
    pointerState.lastX = event.clientX;
    pointerState.lastY = event.clientY;
    pointerState.id = event.pointerId;
    pointerState.downAt = performance.now();
    pointerState.pinchStart = 0;
  } else if (pointerState.pointers.size === 2) {
    const values = [...pointerState.pointers.values()];
    pointerState.pinchDist = Math.hypot(values[0].x - values[1].x, values[0].y - values[1].y);
    pointerState.pinchStart = cam.distGoal;
    pointerState.moved = true;
  }
  dom.canvas.classList.add('dragging');
  hideHoverTip();
}

function onPointerMove(event) {
  if (pointerState.pointers.has(event.pointerId)) {
    pointerState.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  }

  if (pointerState.pointers.size === 2) {
    const values = [...pointerState.pointers.values()];
    const distance = Math.hypot(values[0].x - values[1].x, values[0].y - values[1].y);
    if (pointerState.pinchDist > 0) {
      cam.distGoal = clamp(pointerState.pinchStart * (pointerState.pinchDist / Math.max(distance, 1)), 20, 40);
    }
    return;
  }

  if (pointerState.down && event.pointerId === pointerState.id) {
    const dx = event.clientX - pointerState.lastX;
    const dy = event.clientY - pointerState.lastY;
    pointerState.lastX = event.clientX;
    pointerState.lastY = event.clientY;
    if (Math.hypot(event.clientX - pointerState.startX, event.clientY - pointerState.startY) > 5) {
      pointerState.moved = true;
      hideHoverTip();
    }
    if (pointerState.moved) {
      cam.thetaGoal = clamp(cam.thetaGoal - dx * 0.0055, -1.15, 1.15);
      cam.phiGoal = clamp(cam.phiGoal + dy * 0.004, 0.38, 1.12);
    }
    return;
  }

  if (event.pointerType === 'mouse' && !pointerState.down) {
    const hit = raycastAt(event.clientX, event.clientY);
    showHoverTip(hit, event.clientX, event.clientY);
  }
}

function onPointerUp(event) {
  const wasDown = pointerState.down && event.pointerId === pointerState.id;
  pointerState.pointers.delete(event.pointerId);
  if (wasDown) {
    pointerState.down = false;
    const duration = performance.now() - pointerState.downAt;
    if (!pointerState.moved && duration < 700) {
      handleSceneClick(event.clientX, event.clientY);
    }
    pointerState.id = null;
  }
  if (pointerState.pointers.size < 2) pointerState.pinchStart = 0;
  if (pointerState.pointers.size === 0) dom.canvas.classList.remove('dragging');
}

function onPointerLeave() {
  if (!pointerState.down) hideHoverTip();
}

function initInput() {
  dom.canvas.addEventListener('pointerdown', onPointerDown);
  dom.canvas.addEventListener('pointermove', onPointerMove);
  dom.canvas.addEventListener('pointerup', onPointerUp);
  dom.canvas.addEventListener('pointercancel', onPointerUp);
  dom.canvas.addEventListener('pointerleave', onPointerLeave);
  dom.canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  dom.canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    cam.distGoal = clamp(cam.distGoal + event.deltaY * 0.016, 20, 40);
  }, { passive: false });
  dom.canvas.addEventListener('dblclick', resetCamera);
  window.addEventListener('resize', resize);
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeSeedPicker();
      closeMarket();
      closeHelp();
      dom.settingsMenu.hidden = true;
    }
  });
}

// ─────────────────────────────────────────────────────────────
//  Markers over the garden
// ─────────────────────────────────────────────────────────────
const markerElements = [];

function initMarkers() {
  for (let i = 0; i < 9; i++) {
    const element = document.createElement('div');
    element.className = 'marker';
    element.dataset.plot = String(i);
    dom.markers.appendChild(element);
    markerElements.push(element);
  }
  dom.markers.addEventListener('click', (event) => {
    const button = event.target.closest('[data-marker-action]');
    if (!button) return;
    event.stopPropagation();
    const index = Number(button.dataset.plot);
    if (button.dataset.markerAction === 'harvest') harvestPlot(index);
    if (button.dataset.markerAction === 'water') waterPlot(index);
  });
}

const markerProjection = new THREE.Vector3();

function updateMarkers() {
  const modalOpen = dom.modal.classList.contains('open') || dom.helpLayer.classList.contains('open');
  state.plots.forEach((plot, index) => {
    const element = markerElements[index];
    if (!element) return;
    if (modalOpen || !plot.crop) {
      element.style.display = 'none';
      element.dataset.state = '';
      return;
    }
    const progress = plotProgress(plot);
    const mature = progress >= 1;
    const dry = !mature && !plot.watered;
    const stateKey = mature ? 'mature' : dry ? 'dry' : '';
    if (!stateKey) {
      element.style.display = 'none';
      element.dataset.state = '';
      return;
    }
    if (element.dataset.state !== stateKey) {
      element.dataset.state = stateKey;
      element.className = `marker ${stateKey}`;
      if (mature) {
        element.innerHTML = `<button class="marker-action" data-marker-action="harvest" data-plot="${index}"><span class="marker-spark">✦</span> Собрать</button>`;
      } else {
        element.innerHTML = `<button class="water-drop" data-marker-action="water" data-plot="${index}" aria-label="Полить растение"><span>💧</span></button>`;
      }
    }
    const plotData = plotMeshes[index];
    markerProjection.copy(plotData.userData.position);
    markerProjection.y = mature ? 1.85 : 1.28;
    markerProjection.project(camera);
    if (markerProjection.z > 1 || markerProjection.z < -1) {
      element.style.display = 'none';
      return;
    }
    const x = (markerProjection.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-markerProjection.y * 0.5 + 0.5) * window.innerHeight;
    if (x < -40 || x > window.innerWidth + 40 || y < 60 || y > window.innerHeight + 20) {
      element.style.display = 'none';
      return;
    }
    element.style.display = 'block';
    element.style.left = `${x}px`;
    element.style.top = `${y}px`;
  });
}

// ─────────────────────────────────────────────────────────────
//  Core game actions
// ─────────────────────────────────────────────────────────────
function addXp(amount, silent = false) {
  if (!amount) return;
  const beforeLevel = levelFromXp(state.xp);
  state.xp += amount;
  const afterLevel = levelFromXp(state.xp);
  if (afterLevel > beforeLevel) {
    let reward = 0;
    for (let level = beforeLevel + 1; level <= afterLevel; level++) reward += level * 25;
    state.coins += reward;
    if (!silent) {
      toast(`Новый уровень ${afterLevel}! Награда: ${reward} монет`, 'gold', '🎉');
      coinFly(`+${reward}`);
      bumpCoins();
      soundLevelUp();
    }
  }
  updateHUD();
}

function updateQuestUI() {
  const quest = activeQuest();
  if (!quest) {
    dom.questCard.classList.add('complete');
    dom.questIcon.textContent = '🏆';
    dom.questTitle.textContent = 'Сад в порядке';
    dom.questDesc.textContent = 'Все задания выполнены. Ты отличный садовник!';
    dom.questReward.textContent = '✓';
    dom.questFill.style.width = '100%';
    dom.questCount.textContent = 'готово';
    dom.questClaim.hidden = true;
    return;
  }

  const { progress, complete } = questProgress();
  dom.questIcon.textContent = quest.icon;
  dom.questTitle.textContent = quest.title;
  dom.questDesc.textContent = quest.desc;
  dom.questReward.textContent = String(quest.reward);
  dom.questFill.style.width = `${Math.min(100, (progress / quest.target) * 100)}%`;
  dom.questCount.textContent = `${progress} / ${quest.target}`;
  dom.questCard.classList.toggle('complete', complete);
  dom.questClaim.hidden = !complete;
  dom.questClaim.textContent = `Забрать ${quest.reward} монет`;

  if (complete && !state.quest.celebrated) {
    state.quest.celebrated = true;
    save();
    setTimeout(() => toast(`Задание «${quest.title}» выполнено!`, 'gold', '🏅'), 450);
  }
}

function updateHint() {
  const overlayOpen = dom.modal.classList.contains('open') || dom.helpLayer.classList.contains('open') || !dom.seedPicker.hidden;
  if (overlayOpen) {
    dom.hintPill.classList.add('hide');
    return;
  }
  dom.hintPill.classList.remove('hide');
  const mature = state.plots.filter((plot) => plot.crop && plotProgress(plot) >= 1).length;
  const dry = state.plots.filter((plot) => plot.crop && plotProgress(plot) < 1 && !plot.watered).length;
  const empty = state.plots.filter((plot) => !plot.crop).length;
  if (mature > 0) {
    dom.hintText.textContent = `Урожай созрел — нажми на золотую метку (${mature})`;
  } else if (dry > 0) {
    dom.hintText.textContent = `Ростки хотят пить — нажми на каплю (${dry})`;
  } else if (empty > 0) {
    dom.hintText.textContent = 'Нажми на свободную грядку, чтобы посадить';
  } else {
    dom.hintText.textContent = 'Все грядки заняты — скоро будет урожай';
  }
}

function updateHUD() {
  dom.coins.textContent = fmt.format(state.coins);
  const info = levelInfo();
  dom.level.textContent = String(info.level);
  dom.xpFill.style.width = `${info.next ? Math.min(100, (info.current / info.need) * 100) : 100}%`;
  dom.xpText.textContent = info.next ? `${info.current} / ${info.need}` : 'максимум';

  const produceCount = totalProduce();
  dom.sellBadge.textContent = produceCount > 99 ? '99+' : String(produceCount);
  dom.sellBadge.classList.toggle('show', produceCount > 0);
  dom.tabSellCount.textContent = produceCount ? `(${produceCount})` : '';

  const dryCount = state.plots.filter((plot) => plot.crop && plotProgress(plot) < 1 && !plot.watered).length;
  dom.waterCount.textContent = dryCount > 0 ? `${dryCount} ждут воды` : 'всё полито';

  dom.soundBtn.classList.toggle('muted', state.muted);
  dom.soundBtn.setAttribute('aria-label', state.muted ? 'Включить звук' : 'Выключить звук');

  updateQuestUI();
  updateHint();
}

function plantCrop(index, cropId) {
  const crop = CROPS[cropId];
  if (!crop) return;
  if (levelFromXp(state.xp) < crop.level) {
    toast(`«${crop.name}» откроется на уровне ${crop.level}`, 'error', '🔒');
    soundError();
    return;
  }
  if ((state.seeds[cropId] || 0) <= 0) {
    toast('Семена закончились — загляни в магазин', 'error', '🛒');
    soundError();
    openMarket('seeds');
    return;
  }
  const plot = state.plots[index];
  if (plot.crop) return;

  state.seeds[cropId]--;
  plot.crop = cropId;
  plot.plantedAt = nowMs();
  plot.watered = hasUpgrade('sprinkler');
  state.stats.planted++;
  refreshPlot(index, true);
  addXp(3, true);
  updateHUD();
  save();
  closeSeedPicker();
  soundPlant();

  const position = plotMeshes[index].userData.position;
  spawnBurst(new THREE.Vector3(position.x, 0.8, position.z), 0xb7dd82, 13, { decay: 1.7 });
  toast(`${crop.emoji} ${crop.name} посажена${hasUpgrade('sprinkler') ? ' и полита автолейкой' : ''}`, 'success', '🌱');
}

function waterPlot(index, options = {}) {
  const plot = state.plots[index];
  if (!plot?.crop) return false;
  const progress = plotProgress(plot);
  if (progress >= 1) {
    if (!options.silent) toast('Урожай уже созрел — его пора собирать', 'info', '✨');
    return false;
  }
  if (plot.watered) {
    if (!options.silent) toast('Это растение уже полито', 'info', '💧');
    return false;
  }

  const crop = CROPS[plot.crop];
  plot.watered = true;
  plot.plantedAt = nowMs() - (progress * crop.grow * 1000) / growthSpeed(plot);
  state.stats.watered++;
  refreshPlot(index);
  const position = plotMeshes[index].userData.position;
  spawnBurst(new THREE.Vector3(position.x, 0.8, position.z), 0x8ed9f1, 18, { decay: 1.9, gravity: 1.5, size: 0.1 });
  if (!options.silent) {
    waterSound();
    toast('Полито! Росток стал крепче и даст больше плодов', 'success', '💧');
  }
  updateHUD();
  save();
  return true;
}

function waterAll() {
  const dry = [];
  state.plots.forEach((plot, index) => {
    if (plot.crop && plotProgress(plot) < 1 && !plot.watered) dry.push(index);
  });
  if (!dry.length) {
    toast('Все ростки уже политы — можно немного отдохнуть', 'info', '🌤');
    return;
  }
  dry.forEach((index) => waterPlot(index, { silent: true }));
  waterSound();
  updateHUD();
  save();
  toast(`Полито растений: ${dry.length}`, 'success', '💧');
}

function harvestPlot(index) {
  const plot = state.plots[index];
  if (!plot?.crop) return;
  const progress = plotProgress(plot);
  if (progress < 1) {
    toast('Урожай ещё не созрел', 'info', '⏳');
    return;
  }
  const crop = CROPS[plot.crop];
  const amount = crop.yield + (plot.watered ? 1 : 0);
  state.produce[plot.crop] = (state.produce[plot.crop] || 0) + amount;
  state.stats.harvested++;
  const position = plotMeshes[index].userData.position;
  spawnBurst(new THREE.Vector3(position.x, 1.05, position.z), 0xffd565, 24, { decay: 1.2, size: 0.14 });
  const wasFirst = state.stats.harvested === 1;

  plot.crop = null;
  plot.plantedAt = 0;
  plot.watered = false;
  refreshPlot(index);
  addXp(crop.xp);
  updateHUD();
  save();
  soundHarvest();
  toast(`Собрано: ${crop.emoji} ${crop.name} ×${amount}`, 'gold', '🧺');
  if (wasFirst) {
    setTimeout(() => toast('Урожай в корзине. Открой «Рынок», чтобы продать', 'info', '🪙'), 1100);
  }
}

function claimQuest() {
  const { quest, complete } = questProgress();
  if (!quest || !complete) return;
  state.coins += quest.reward;
  addXp(15, true);
  state.quest.index++;
  state.quest.celebrated = false;
  const next = activeQuest();
  state.quest.baseline = next ? questValue(next) : 0;
  updateHUD();
  save();
  soundCoin();
  bumpCoins();
  coinFly(`+${quest.reward}`);
  toast(`Награда получена: +${quest.reward} монет`, 'gold', '🪙');
  if (!next) setTimeout(() => toast('Все задания выполнены. Ты настоящий садовник!', 'gold', '🏆'), 900);
}

function rebaseGrowth(progressSnapshot) {
  const base = nowMs();
  state.plots.forEach((plot, index) => {
    if (!plot.crop || progressSnapshot[index] >= 1) return;
    const crop = CROPS[plot.crop];
    plot.plantedAt = base - (progressSnapshot[index] * crop.grow * 1000) / growthSpeed(plot);
  });
}

function buySeed(cropId) {
  const crop = CROPS[cropId];
  if (!crop) return;
  if (levelFromXp(state.xp) < crop.level) {
    toast(`Семена откроются на уровне ${crop.level}`, 'error', '🔒');
    soundError();
    return;
  }
  if (state.coins < crop.price) {
    toast('Недостаточно монет — продай немного урожая', 'error', '🪙');
    soundError();
    return;
  }
  state.coins -= crop.price;
  state.seeds[cropId] = (state.seeds[cropId] || 0) + 1;
  updateHUD();
  save();
  soundBuy();
  bumpCoins();
  coinFly(`−${crop.price}`, true);
  toast(`Куплено: ${crop.emoji} ${crop.name} ×1`, 'success', '🛒');
  if (dom.modal.classList.contains('open')) renderMarket();
}

function buyUpgrade(upgradeId) {
  const upgrade = UPGRADES.find((item) => item.id === upgradeId);
  if (!upgrade || hasUpgrade(upgradeId)) return;
  if (levelFromXp(state.xp) < upgrade.level) {
    toast(`Улучшение откроется на уровне ${upgrade.level}`, 'error', '🔒');
    soundError();
    return;
  }
  if (state.coins < upgrade.price) {
    toast('Пока не хватает монет', 'error', '🪙');
    soundError();
    return;
  }

  const progressSnapshot = state.plots.map((plot) => plotProgress(plot));
  state.coins -= upgrade.price;
  state.upgrades.push(upgradeId);

  if (upgradeId === 'warmbed') rebaseGrowth(progressSnapshot);
  if (upgradeId === 'sprinkler') {
    state.plots.forEach((plot, index) => {
      if (plot.crop && plotProgress(plot) < 1 && !plot.watered) waterPlot(index, { silent: true });
    });
  }

  updateHUD();
  save();
  soundLevelUp();
  bumpCoins();
  coinFly(`−${upgrade.price}`, true);
  toast(`Улучшение куплено: ${upgrade.icon} ${upgrade.name}`, 'gold', '🛠');
  if (dom.modal.classList.contains('open')) renderMarket();
}

function sellProduce(cropId, quantity = 1, options = {}) {
  const crop = CROPS[cropId];
  const available = state.produce[cropId] || 0;
  const qty = Math.min(available, Math.max(1, Math.floor(quantity)));
  if (!crop || available <= 0) return 0;
  const unit = cropSellPrice(cropId);
  const total = unit * qty;
  state.produce[cropId] -= qty;
  state.coins += total;
  state.stats.earned += total;
  state.stats.sold += qty;
  addXp(Math.max(1, Math.round(total / 12)), true);
  updateHUD();
  save();
  if (!options.silent) {
    soundCoin();
    bumpCoins();
    coinFly(`+${total}`);
    toast(`Продано: ${crop.emoji} ×${qty} · +${total} монет`, 'gold', '🪙');
  }
  if (dom.modal.classList.contains('open')) renderMarket();
  return total;
}

function sellAll() {
  let total = 0;
  let count = 0;
  for (const id of CROP_IDS) {
    const available = state.produce[id] || 0;
    if (!available) continue;
    const unit = cropSellPrice(id);
    total += unit * available;
    count += available;
    sellProduce(id, available, { silent: true });
  }
  if (!total) {
    toast('Корзина пуста — сначала собери урожай', 'info', '🧺');
    return;
  }
  soundCoin();
  bumpCoins();
  coinFly(`+${total}`);
  toast(`Продано ${count} плодов · +${total} монет`, 'gold', '🪙');
  if (dom.modal.classList.contains('open')) renderMarket();
}

// ─────────────────────────────────────────────────────────────
//  Seed picker
// ─────────────────────────────────────────────────────────────
function openSeedPicker(index) {
  pickerPlotIndex = index;
  dom.pickerPlotNumber.textContent = String(index + 1);
  renderSeedPicker();
  dom.seedPicker.hidden = false;
  dom.settingsMenu.hidden = true;
  updateHint();
}

function closeSeedPicker() {
  dom.seedPicker.hidden = true;
  pickerPlotIndex = null;
  updateHint();
}

function renderSeedPicker() {
  if (pickerPlotIndex === null) return;
  const level = levelFromXp(state.xp);
  dom.seedStrip.innerHTML = CROP_IDS.map((id) => {
    const crop = CROPS[id];
    const count = state.seeds[id] || 0;
    const locked = level < crop.level;
    return `
      <button class="seed-choice ${count <= 0 ? 'empty' : ''} ${locked ? 'locked' : ''}" data-seed="${id}" ${locked ? 'disabled' : ''} style="--seed-tint:${crop.tint}">
        <span class="seed-emoji">${locked ? '🔒' : crop.emoji}</span>
        <span class="seed-info">
          <b>${crop.name}</b>
          <span>${locked ? `уровень ${crop.level}` : `${crop.grow} с · ${crop.yield + 1} шт`}</span>
        </span>
        ${locked ? '' : `<span class="seed-stock ${count <= 0 ? 'none' : ''}">${count}</span>`}
      </button>
    `;
  }).join('');
}

// ─────────────────────────────────────────────────────────────
//  Market panel
// ─────────────────────────────────────────────────────────────
function openMarket(tab = 'seeds') {
  currentMarketTab = tab;
  hideHoverTip();
  closeSeedPicker();
  dom.settingsMenu.hidden = true;
  dom.modal.classList.add('open');
  dom.modal.setAttribute('aria-hidden', 'false');
  renderMarket();
  updateHint();
}

function closeMarket() {
  if (!dom.modal.classList.contains('open')) return;
  hideHoverTip();
  dom.modal.classList.remove('open');
  dom.modal.setAttribute('aria-hidden', 'true');
  updateHint();
}

function marketTrend(cropId) {
  const multiplier = marketMultiplier(cropId);
  if (multiplier > 1.035) return { arrow: '▲', className: 'trend-up', label: `+${Math.round((multiplier - 1) * 100)}%` };
  if (multiplier < 0.965) return { arrow: '▼', className: 'trend-down', label: `${Math.round((multiplier - 1) * 100)}%` };
  return { arrow: '•', className: '', label: 'стабильно' };
}

function gardenStatsHTML(showTip = false) {
  return `
    <div class="garden-stats">
      <div class="section-head"><h3>Статистика сада</h3><p>за всё время</p></div>
      <div class="stats-grid">
        <div><span>🧺</span><b>${state.stats.harvested}</b><small>урожаев</small></div>
        <div><span>🪙</span><b>${fmt.format(state.stats.earned)}</b><small>выручка</small></div>
        <div><span>💧</span><b>${state.stats.watered}</b><small>поливов</small></div>
        <div><span>🌱</span><b>${state.stats.planted}</b><small>посадок</small></div>
      </div>
      ${showTip ? '<div class="market-tip"><span>💡</span><span><b>Совет:</b> полей растение до сбора урожая — оно даст на один плод больше.</span></div>' : ''}
    </div>
  `;
}

function renderMarket() {
  const level = levelFromXp(state.xp);
  const tabs = document.querySelectorAll('.tab');
  tabs.forEach((tab) => tab.classList.toggle('active', tab.dataset.tab === currentMarketTab));
  dom.tabSellCount.textContent = totalProduce() ? `(${totalProduce()})` : '';

  if (currentMarketTab === 'seeds') {
    dom.panelBody.innerHTML = `
      <div class="market-note"><span>🌿</span><span><b>Свежие семена каждое утро.</b> Цены на урожай меняются каждые 3 минуты — продавай, когда выгодно.</span></div>
      <div class="section-head"><h3>Семена</h3><p>${CROP_IDS.length} видов</p></div>
      <div class="seed-grid">
        ${CROP_IDS.map((id) => {
          const crop = CROPS[id];
          const locked = level < crop.level;
          return `
            <article class="seed-card ${locked ? 'locked' : ''}">
              <div class="seed-card-top">
                <div class="seed-card-emoji" style="--seed-tint:${crop.tint}">${crop.emoji}</div>
                <span class="seed-level ${locked ? '' : 'ok'}">${locked ? `🔒 ур. ${crop.level}` : `в сумке: ${state.seeds[id] || 0}`}</span>
              </div>
              <h4>${crop.name}</h4>
              <div class="seed-meta"><span>⏱ ${crop.grow} с</span><span>🧺 ${crop.yield}–${crop.yield + 1}</span><span>💧 +1</span></div>
              <div class="seed-card-bottom">
                <span class="seed-price"><i class="mini-coin"></i>${crop.price}</span>
                <button class="buy-btn" data-buy-seed="${id}" ${locked ? 'disabled' : ''}>Купить</button>
              </div>
              ${locked ? '<div class="lock-ribbon"><span>🔒</span>Откроется на уровне ' + crop.level + '</div>' : ''}
            </article>
          `;
        }).join('')}
      </div>
    `;
    dom.panelFoot.innerHTML = `
      <div class="sell-all-row">
        <div class="sell-total"><span>В кошельке</span><b>${fmt.format(state.coins)} ●</b></div>
        <button class="ghost-btn" data-jump-tab="sell">Перейти к продаже →</button>
      </div>
    `;
  } else if (currentMarketTab === 'sell') {
    const rows = CROP_IDS.filter((id) => (state.produce[id] || 0) > 0).map((id) => {
      const crop = CROPS[id];
      const quantity = state.produce[id] || 0;
      const unit = cropSellPrice(id);
      const trend = marketTrend(id);
      return `
        <div class="inv-row">
          <div class="inv-emoji" style="--seed-tint:${crop.tint}">${crop.emoji}</div>
          <div class="inv-copy">
            <b>${crop.name}</b>
            <span class="${trend.className}">${trend.arrow} ${trend.label} к базовой цене</span>
          </div>
          <span class="inv-qty">×${quantity}</span>
          <div class="inv-price"><b>${unit} ●</b><span>за штуку</span></div>
          <button class="sell-btn" data-sell="${id}">Продать</button>
        </div>
      `;
    }).join('');
    const total = CROP_IDS.reduce((sum, id) => sum + (state.produce[id] || 0) * cropSellPrice(id), 0);
    dom.panelBody.innerHTML = `
      <div class="market-note"><span>🪙</span><span><b>Сегодняшние цены.</b> Обновление через ${Math.ceil((180000 - (nowMs() % 180000)) / 1000)} с. Продажа даёт опыт.</span></div>
      <div class="section-head"><h3>Корзина</h3><p>${totalProduce()} плодов</p></div>
      ${rows ? `<div class="inv-list">${rows}</div>` : `
        <div class="empty-state">
          <div class="empty-icon">🧺</div>
          <h3>Корзина пока пуста</h3>
          <p>Собери созревший урожай на грядках,<br>и он появится здесь.</p>
        </div>
      `}
      ${gardenStatsHTML(false)}
      <div class="price-board">
        <div class="section-head"><h3>Цены на рынке</h3><p>обновление каждые 3 мин</p></div>
        <div class="price-grid">
          ${CROP_IDS.map((id) => {
            const crop = CROPS[id];
            const trend = marketTrend(id);
            return `<div class="price-chip">
              <span class="price-emoji" style="--seed-tint:${crop.tint}">${crop.emoji}</span>
              <span class="price-name">${crop.name}</span>
              <b>${cropSellPrice(id)} ●</b>
              <small class="${trend.className}">${trend.arrow} ${trend.label}</small>
            </div>`;
          }).join('')}
        </div>
      </div>
    `;
    dom.panelFoot.innerHTML = totalProduce() ? `
      <div class="sell-all-row">
        <div class="sell-total"><span>Всего за урожай</span><b>${fmt.format(total)} ●</b></div>
        <button class="primary-btn" data-sell-all>Продать всё</button>
      </div>
    ` : '';
  } else {
    dom.panelBody.innerHTML = `
      <div class="market-note"><span>🛠</span><span><b>Вложи монеты в сад.</b> Улучшения покупаются один раз и работают навсегда.</span></div>
      <div class="section-head"><h3>Улучшения</h3><p>${state.upgrades.length} / ${UPGRADES.length}</p></div>
      <div class="upgrade-list">
        ${UPGRADES.map((upgrade) => {
          const owned = hasUpgrade(upgrade.id);
          const locked = level < upgrade.level;
          return `
            <article class="upgrade-card ${owned ? 'owned' : ''}">
              <div class="upgrade-icon">${upgrade.icon}</div>
              <div class="upgrade-copy"><b>${upgrade.name}</b><p>${upgrade.desc}</p></div>
              <div class="upgrade-action">
                ${owned ? '<span class="owned-tag">✓ куплено</span>' : locked
                  ? `<span class="upgrade-lock">🔒 ур. ${upgrade.level}</span>`
                  : `<button class="buy-btn" data-buy-upgrade="${upgrade.id}">${upgrade.price} ●</button>`}
              </div>
            </article>
          `;
        }).join('')}
      </div>
      ${gardenStatsHTML(true)}
    `;
    dom.panelFoot.innerHTML = `<div class="sell-total"><span>В кошельке</span><b>${fmt.format(state.coins)} ●</b></div>`;
  }
}

// ─────────────────────────────────────────────────────────────
//  UI wiring
// ─────────────────────────────────────────────────────────────
function openHelp() {
  dom.helpLayer.classList.add('open');
  dom.helpLayer.setAttribute('aria-hidden', 'false');
  dom.settingsMenu.hidden = true;
  hideHoverTip();
  updateHint();
}

function closeHelp() {
  if (!dom.helpLayer.classList.contains('open')) return;
  dom.helpLayer.classList.remove('open');
  dom.helpLayer.setAttribute('aria-hidden', 'true');
  updateHint();
}

function initUI() {
  $('#shop-btn').addEventListener('click', () => openMarket('seeds'));
  dom.marketBtn.addEventListener('click', () => openMarket('sell'));
  $('#water-all-btn').addEventListener('click', waterAll);
  dom.questClaim.addEventListener('click', claimQuest);
  dom.pickerClose.addEventListener('click', closeSeedPicker);
  $('#modal-close').addEventListener('click', closeMarket);
  $('#help-btn').addEventListener('click', openHelp);
  $('#reset-camera-btn').addEventListener('click', () => {
    resetCamera();
    dom.settingsMenu.hidden = true;
  });

  document.querySelectorAll('[data-close-modal]').forEach((element) => element.addEventListener('click', closeMarket));
  document.querySelectorAll('[data-close-help]').forEach((element) => element.addEventListener('click', closeHelp));

  document.querySelector('.tabs').addEventListener('click', (event) => {
    const tab = event.target.closest('.tab');
    if (!tab) return;
    currentMarketTab = tab.dataset.tab;
    renderMarket();
  });

  dom.panelBody.addEventListener('click', (event) => {
    const buySeedButton = event.target.closest('[data-buy-seed]');
    if (buySeedButton) {
      buySeed(buySeedButton.dataset.buySeed);
      return;
    }
    const buyUpgradeButton = event.target.closest('[data-buy-upgrade]');
    if (buyUpgradeButton) {
      buyUpgrade(buyUpgradeButton.dataset.buyUpgrade);
      return;
    }
    const sellButton = event.target.closest('[data-sell]');
    if (sellButton) {
      sellProduce(sellButton.dataset.sell, 1);
      return;
    }
    const jumpButton = event.target.closest('[data-jump-tab]');
    if (jumpButton) {
      currentMarketTab = jumpButton.dataset.jumpTab;
      renderMarket();
      return;
    }
    if (event.target.closest('[data-sell-all]')) sellAll();
  });

  dom.panelFoot.addEventListener('click', (event) => {
    if (event.target.closest('[data-sell-all]')) {
      sellAll();
      return;
    }
    const jumpButton = event.target.closest('[data-jump-tab]');
    if (jumpButton) {
      currentMarketTab = jumpButton.dataset.jumpTab;
      renderMarket();
    }
  });

  dom.seedStrip.addEventListener('click', (event) => {
    const button = event.target.closest('.seed-choice');
    if (!button || button.disabled || pickerPlotIndex === null) return;
    const cropId = button.dataset.seed;
    const crop = CROPS[cropId];
    if (levelFromXp(state.xp) < crop.level) {
      toast(`Семена откроются на уровне ${crop.level}`, 'error', '🔒');
      return;
    }
    if ((state.seeds[cropId] || 0) <= 0) {
      toast('Семян нет — купи их на рынке', 'error', '🛒');
      soundError();
      openMarket('seeds');
      return;
    }
    plantCrop(pickerPlotIndex, cropId);
  });

  dom.soundBtn.addEventListener('click', () => {
    state.muted = !state.muted;
    save();
    updateHUD();
    if (!state.muted) {
      ensureAudio();
      tone(660, 0.12, 'sine', 0.04);
      toast('Звук включён', 'info', '🔊');
    } else {
      toast('Звук выключен', 'info', '🔇');
    }
  });

  $('#settings-btn').addEventListener('click', (event) => {
    event.stopPropagation();
    dom.settingsMenu.hidden = !dom.settingsMenu.hidden;
  });

  dom.resetGameBtn.addEventListener('click', () => {
    if (!resetArmed) {
      resetArmed = true;
      dom.resetGameBtn.textContent = '↺ Точно начать заново?';
      clearTimeout(resetTimer);
      resetTimer = setTimeout(() => {
        resetArmed = false;
        dom.resetGameBtn.innerHTML = '<span>↺</span> Начать заново';
      }, 3500);
      return;
    }
    saveSuppressed = true;
    localStorage.removeItem(SAVE_KEY);
    location.reload();
  });

  document.addEventListener('pointerdown', (event) => {
    if (!dom.settingsMenu.hidden && !event.target.closest('#settings-menu') && !event.target.closest('#settings-btn')) {
      dom.settingsMenu.hidden = true;
    }
  });

  dom.modal.addEventListener('transitionend', () => {
    if (!dom.modal.classList.contains('open')) updateHint();
  });

  window.addEventListener('beforeunload', save);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) save();
  });

  updateHUD();
  renderSeedPicker();
}

// ─────────────────────────────────────────────────────────────
//  Ambient animation
// ─────────────────────────────────────────────────────────────
let hudAccumulator = 0;
let marketRefreshAccumulator = 0;

function updatePlotsVisual(time, delta) {
  state.plots.forEach((plot, index) => {
    const plotData = plotMeshes[index];
    if (!plotData) return;
    if (!plot.crop) return;

    applyCropStage(index);
    const progress = plotProgress(plot);
    const mature = progress >= 1;
    plotData.ring.visible = mature;
    plotData.sparkles.visible = mature;

    if (mature) {
      plotData.ring.rotation.z += delta * 0.75;
      const pulse = 0.62 + Math.sin(time * 2.4 + index) * 0.18;
      plotData.ring.material.opacity = pulse;
      plotData.ring.scale.setScalar(1 + Math.sin(time * 2.4 + index) * 0.035);
      plotData.sparkles.rotation.y += delta * 0.45;
      if (plotData.cropGroup) {
        plotData.cropGroup.position.y = Math.sin(time * 1.8 + index) * 0.025;
        plotData.cropGroup.rotation.z = Math.sin(time * 1.25 + index * 0.8) * 0.018;
      }
    } else if (plotData.cropGroup) {
      plotData.cropGroup.position.y = 0;
      plotData.cropGroup.rotation.z = 0;
    }

    if (plotData.spawnAt) {
      const elapsed = performance.now() - plotData.spawnAt;
      const k = clamp(elapsed / 480, 0, 1);
      const eased = 1 - Math.pow(1 - k, 3);
      plotData.root.scale.setScalar(Math.max(0.001, eased));
      if (k >= 1) plotData.spawnAt = 0;
    }
  });
}

function updateAmbient(time, delta) {
  clouds.forEach((cloud, index) => {
    cloud.position.x = cloud.userData.baseX + Math.sin(time * cloud.userData.speed + cloud.userData.phase) * 2.2;
    cloud.position.y += Math.sin(time * 0.16 + index) * delta * 0.025;
  });

  butterflies.forEach((creature, index) => {
    const data = creature.userData;
    if (data.leftWing) {
      const angle = time * data.speed + data.phase;
      creature.position.set(
        data.center.x + Math.cos(angle) * data.radiusX,
        data.center.y + Math.sin(angle * 2.3) * data.bob,
        data.center.z + Math.sin(angle) * data.radiusZ
      );
      creature.rotation.y = -angle + Math.PI / 2;
      const flap = Math.sin(time * 13 + index) * 0.55;
      data.leftWing.rotation.z = flap;
      data.rightWing.rotation.z = -flap;
    } else {
      // Distant birds
      creature.position.x += delta * (0.35 + index * 0.025);
      if (creature.position.x > 28) creature.position.x = -28;
      const flap = Math.sin(time * 5 + data.phase) * 0.3;
      creature.children.forEach((wing, wingIndex) => {
        wing.rotation.z = (wingIndex === 0 ? -1 : 1) * (0.35 + flap);
      });
    }
  });

  if (duck) {
    duck.position.y = 0.16 + Math.sin(time * 1.7) * 0.012;
    duck.rotation.y = Math.sin(time * 0.45) * 0.8;
    duck.position.x = 0.35 + Math.sin(time * 0.33) * 0.2;
    duck.position.z = -0.35 + Math.cos(time * 0.33) * 0.16;
  }

  if (pollen) {
    pollen.rotation.y = time * 0.018;
    pollen.position.y = Math.sin(time * 0.22) * 0.1;
  }

  smokePuffs.forEach((puff, index) => {
    puff.position.y = puff.userData.baseY + Math.sin(time * 0.8 + puff.userData.phase) * 0.05;
    puff.position.x = 0.82 + index * 0.08 + Math.sin(time * 0.5 + index) * 0.04;
  });
}

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.05);
  const time = performance.now() / 1000;

  updateCamera(delta);
  updatePlotsVisual(time, delta);
  updateAmbient(time, delta);
  updateBursts(delta);
  updateMarkers();
  renderer.render(scene, camera);

  hudAccumulator += delta;
  if (hudAccumulator > 0.65) {
    hudAccumulator = 0;
    updateHUD();
  }

  if (dom.modal.classList.contains('open')) {
    marketRefreshAccumulator += delta;
    if (marketRefreshAccumulator > 30) {
      marketRefreshAccumulator = 0;
      renderMarket();
    }
  } else {
    marketRefreshAccumulator = 0;
  }
}

// ─────────────────────────────────────────────────────────────
//  Boot
// ─────────────────────────────────────────────────────────────
function initWorld() {
  initLights();
  // initSky();
  initClouds();
  initIsland();
  initPaths();
  initFence();
  initFoliage();
  initPond();
  initMarketStand();
  initHouse();
  initCropTemplates();
  initGarden();
  refreshAllPlots(false);
  initAmbientLife();
}

function boot() {
  initWorld();
  initInput();
  initMarkers();
  initUI();
  resize();
  updateCamera(1);
  updateHUD();
  renderer.render(scene, camera);
  sceneReady = true;
  dom.canvas.classList.add('ready');
  requestAnimationFrame(animate);

  setTimeout(() => dom.loader.classList.add('hidden'), 320);

  setTimeout(() => {
    if (offlineGap > 60000) {
      toast('С возвращением! Сад рос, пока тебя не было', 'success', '🌤');
    } else {
      toast('Сад готов! Собери первый урожай', 'info', '🌻');
    }
  }, 1050);

  setInterval(() => {
    updateHUD();
    save();
  }, 8000);
}

boot();




