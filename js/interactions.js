/* ---------- MOTOR CINÉTICO 60FPS, FÍSICA DE FLUIDOS, RÉGUA TÁTIL & HOLD-TO-BREW (Brewer v3) ---------- */
import { fmtDur } from './utils.js';

let audioCtx = null;

function ensureAudio() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!audioCtx) audioCtx = new AC();
  if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
  return audioCtx;
}

export function playTactileTick(freq = 560, dur = 0.016, gainVal = 0.038) {
  try {
    const ctx = ensureAudio();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.42, now + dur);
    g.gain.setValueAtTime(gainVal, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + dur + 0.005);
  } catch (e) {}
}

export function playSoftChime() {
  try {
    const ctx = ensureAudio();
    if (!ctx) return;
    const now = ctx.currentTime;
    [523.25, 659.25].forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now + idx * 0.065);
      g.gain.setValueAtTime(0.032, now + idx * 0.065);
      g.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.065 + 0.24);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(now + idx * 0.065);
      osc.stop(now + idx * 0.065 + 0.26);
    });
  } catch (e) {}
}

export function playLiquidDrop(pitch = 380) {
  try {
    const ctx = ensureAudio();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(pitch * 0.85, now);
    osc.frequency.exponentialRampToValueAtTime(pitch * 1.32, now + 0.14);
    g.gain.setValueAtTime(0.022, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.24);
  } catch (e) {}
}

export function playBrewLaunchChord() {
  try {
    if (navigator.vibrate) navigator.vibrate([22, 30, 40]);
    const ctx = ensureAudio();
    if (!ctx) return;
    const now = ctx.currentTime;
    [293.66, 440.0, 587.33, 739.99].forEach((f, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now + i * 0.045);
      g.gain.setValueAtTime(0.0001, now + i * 0.045);
      g.gain.exponentialRampToValueAtTime(0.035 / (i * 0.3 + 1), now + i * 0.045 + 0.08);
      g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.045 + 0.75);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(now + i * 0.045);
      osc.stop(now + i * 0.045 + 0.78);
    });
  } catch (e) {}
}

export const MOOD_META = {
  alvorada:   { label: 'Alvorada Rosé',    desc: 'Céu de amanhecer, mel e pêssego suave',  dark: false, swatch: 'linear-gradient(135deg,#F9E2D2 0%,#F2A98A 55%,#D97B7C 100%)', motes: 'rgba(255, 240, 220, 0.65)' },
  manha:      { label: 'Sol Botânico',     desc: 'Luz natural da janela e verde sálvia',   dark: false, swatch: 'linear-gradient(135deg,#F8F6EF 0%,#DCE8DA 58%,#93B89E 100%)', motes: 'rgba(255, 248, 224, 0.72)' },
  entardecer: { label: 'Cânion Terracota', desc: 'Pôr do sol cobre, areia e âmbar quente', dark: true,  swatch: 'linear-gradient(135deg,#5E2514 0%,#B84B24 55%,#EA8E47 100%)', motes: 'rgba(255, 212, 148, 0.56)' },
  torrefacao: { label: 'Noite Espresso',   desc: 'Veludo noturno, lâmpada âmbar e calma',  dark: true,  swatch: 'linear-gradient(135deg,#0B0D14 0%,#1E1614 55%,#4B2A18 100%)', motes: 'rgba(244, 194, 122, 0.48)' }
};

export const MOOD_ORDER = ['alvorada', 'manha', 'entardecer', 'torrefacao'];

export function autoCafeMood() {
  const h = new Date().getHours();
  if (h >= 5 && h < 10) return 'alvorada';
  if (h >= 10 && h < 16) return 'manha';
  if (h >= 16 && h < 20) return 'entardecer';
  return 'torrefacao';
}

export function resolveCafeMood(manual) {
  if (manual && MOOD_META[manual]) return manual;
  return autoCafeMood();
}

/* ---------- 1. ATMOSFERA VIVA GLOBAL EM 100vw x 100dvh ---------- */
let canvasRunning = false;
export function initLivingAtmosphere() {
  if (canvasRunning) return;
  const canvas = document.getElementById('livingCanvas');
  if (!canvas) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  canvasRunning = true;

  const ctx = canvas.getContext('2d');
  let w = 0, h = 0, dpr = Math.min(2, window.devicePixelRatio || 1);
  const motes = Array.from({ length: 30 }, (_, i) => ({
    x: Math.random(),
    y: Math.random(),
    r: 1.2 + (i % 5) * 0.75,
    vx: (Math.random() - 0.5) * 0.00018,
    vy: -0.00012 - Math.random() * 0.00022,
    ph: Math.random() * Math.PI * 2
  }));

  function resize() {
    const rect = canvas.getBoundingClientRect();
    w = Math.max(1, Math.round(rect.width || window.innerWidth));
    h = Math.max(1, Math.round(rect.height || window.innerHeight));
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize, { passive: true });

  let t = 0;
  function frame() {
    t += 0.012;
    ctx.clearRect(0, 0, w, h);
    const tab = document.body.dataset.tab || 'hoje';
    if (tab !== 'vontade' && tab !== 'foco') {
      const mood = document.body.dataset.mood || 'torrefacao';
      const meta = MOOD_META[mood] || MOOD_META.torrefacao;
      ctx.fillStyle = meta.motes;
      for (let i = 0; i < motes.length; i++) {
        const m = motes[i];
        m.x += m.vx + Math.sin(t + m.ph) * 0.00009;
        m.y += m.vy;
        if (m.y < -0.04) { m.y = 1.04; m.x = Math.random(); }
        if (m.x < -0.04) m.x = 1.04;
        if (m.x > 1.04) m.x = -0.04;
        const alpha = 0.25 + 0.55 * (0.5 + 0.5 * Math.sin(t * 1.4 + m.ph));
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(m.x * w, m.y * h, m.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

/* ---------- 2. ENGINE DE FLUIDO VISCOSO INTERATIVO — PAUSA (THE VISCOUS THRESHOLD) ---------- */
let pausaRaf = 0;
let pausaCanvasRef = null;
const pausaRipples = [];
const pausaDrops = [];
const pausaTrail = [];
let pausaLastDropSound = 0;
let pausaTouchCount = 0;

export function initPausaFluidCanvas(getGateInfo) {
  const canvas = document.getElementById('pausaFluidCanvas');
  if (!canvas) {
    if (pausaRaf) { cancelAnimationFrame(pausaRaf); pausaRaf = 0; }
    pausaCanvasRef = null;
    return;
  }
  if (canvas === pausaCanvasRef && pausaRaf) return;
  if (pausaRaf) cancelAnimationFrame(pausaRaf);
  pausaCanvasRef = canvas;

  const ctx = canvas.getContext('2d');
  let w = 0, h = 0, dpr = Math.min(2, window.devicePixelRatio || 1);
  let waveEnergy = 0;
  let lastPointer = null;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    w = Math.max(1, Math.round(rect.width || window.innerWidth));
    h = Math.max(1, Math.round(rect.height || window.innerHeight));
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();

  const spawnRipple = (clientX, clientY, speed) => {
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const calm = speed < 22;
    pausaRipples.push({
      x, y,
      r: calm ? 12 : 6,
      maxR: calm ? Math.min(w, h) * 0.42 : 95,
      alpha: calm ? 0.55 : 0.32,
      speed: calm ? 2.1 : 3.4,
      hue: calm ? '#FFD998' : '#E98D57',
      lw: calm ? 2.2 : 1.2
    });
    const count = calm ? 3 : 6;
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = (calm ? 0.4 : 1.2) + Math.random() * 1.1;
      pausaDrops.push({
        x, y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 0.35,
        r: 1.5 + Math.random() * 2.8,
        life: 1
      });
    }
    waveEnergy = Math.min(24, waveEnergy + (calm ? 3.5 : 1.8));
    pausaTouchCount++;
    const hint = document.getElementById('pausaTouchHint');
    if (hint && pausaTouchCount > 6) hint.classList.add('is-faded');

    const now = performance.now();
    if (now - pausaLastDropSound > 165) {
      pausaLastDropSound = now;
      playLiquidDrop(320 + (1 - y / Math.max(1, h)) * 240);
    }
  };

  if (canvas.dataset.bound !== '1') {
    canvas.dataset.bound = '1';
    let down = false;
    const onDown = (e) => {
      if (e.target && e.target.closest && e.target.closest('button')) return;
      down = true;
      lastPointer = { x: e.clientX, y: e.clientY };
      spawnRipple(e.clientX, e.clientY, 5);
    };
    const onMove = (e) => {
      if (!down) return;
      const rect = canvas.getBoundingClientRect();
      pausaTrail.push({ x: e.clientX - rect.left, y: e.clientY - rect.top, life: 1 });
      if (pausaTrail.length > 42) pausaTrail.shift();
      const dx = lastPointer ? e.clientX - lastPointer.x : 0;
      const dy = lastPointer ? e.clientY - lastPointer.y : 0;
      const dist = Math.hypot(dx, dy);
      if (dist > 18) {
        spawnRipple(e.clientX, e.clientY, dist);
        lastPointer = { x: e.clientX, y: e.clientY };
      }
    };
    const onUp = () => { down = false; lastPointer = null; pausaTrail.push(null); };

    const host = canvas.closest('.headspace-gate-v2') || canvas;
    host.addEventListener('pointerdown', onDown, { passive: true });
    host.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerup', onUp, { passive: true });
  }

  let t = 0;
  function loop() {
    if (!document.body.contains(canvas) || document.body.dataset.tab !== 'vontade') {
      pausaRaf = 0;
      pausaCanvasRef = null;
      return;
    }
    t += 0.016;
    const rNow = canvas.getBoundingClientRect();
    if (Math.abs(rNow.width - w) > 2 || Math.abs(rNow.height - h) > 2) resize();
    waveEnergy *= 0.965;
    ctx.clearRect(0, 0, w, h);

    const info = getGateInfo ? getGateInfo() : { elapsedMs: t * 1000, pct: 0 };
    const cycle = (info.elapsedMs % 10000) / 10000; // 0..0.4 inspira, 0.4..1.0 solta
    let breath = 0;
    if (cycle < 0.4) {
      const p = cycle / 0.4;
      breath = 0.5 - 0.5 * Math.cos(p * Math.PI); // 0 -> 1 suave
    } else {
      const p = (cycle - 0.4) / 0.6;
      breath = 0.5 + 0.5 * Math.cos(p * Math.PI); // 1 -> 0 suave
    }

    /* Aura respiratória sutil no centro sincronizada com 4s/6s */
    const cx = w * 0.5, cy = h * 0.45;
    const auraR = Math.min(w, h) * (0.26 + breath * 0.17);
    const ag = ctx.createRadialGradient(cx, cy, 8, cx, cy, auraR);
    ag.addColorStop(0, `rgba(255, 212, 138, ${0.14 + breath * 0.14})`);
    ag.addColorStop(0.55, `rgba(226, 128, 72, ${0.06 + breath * 0.08})`);
    ag.addColorStop(1, 'rgba(226, 128, 72, 0)');
    ctx.fillStyle = ag;
    ctx.beginPath();
    ctx.arc(cx, cy, auraR, 0, Math.PI * 2);
    ctx.fill();

    /* 3 camadas de maré líquida de café respirando com física real */
    const layers = [
      { base: 0.76 - breath * 0.085, amp: 14 + waveEnergy * 0.65, freq: 0.0052, spd: 0.9,  col: 'rgba(244, 174, 96, 0.16)' },
      { base: 0.82 - breath * 0.065, amp: 11 + waveEnergy * 0.45, freq: 0.0068, spd: -0.7, col: 'rgba(218, 114, 62, 0.24)' },
      { base: 0.88 - breath * 0.045, amp: 8 + waveEnergy * 0.30,  freq: 0.0085, spd: 1.15, col: 'rgba(132, 56, 36, 0.38)' }
    ];
    for (let li = 0; li < layers.length; li++) {
      const L = layers[li];
      const y0 = h * L.base;
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let x = 0; x <= w + 16; x += 14) {
        const y = y0 + Math.sin(x * L.freq + t * L.spd + li * 1.4) * L.amp + Math.cos(x * L.freq * 0.5 - t * 0.6) * (L.amp * 0.4);
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fillStyle = L.col;
      ctx.fill();

      /* Fio luminoso suave na crista da onda */
      ctx.beginPath();
      for (let x = 0; x <= w + 16; x += 14) {
        const y = y0 + Math.sin(x * L.freq + t * L.spd + li * 1.4) * L.amp + Math.cos(x * L.freq * 0.5 - t * 0.6) * (L.amp * 0.4);
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = `rgba(255, 224, 168, ${0.14 + breath * 0.12 - li * 0.03})`;
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }

    /* Fita luminosa de seda (Silk Trail) que acompanha o dedo devagar e se dissolve sem peso */
    for (let i = pausaTrail.length - 1; i >= 0; i--) {
      if (!pausaTrail[i]) continue;
      pausaTrail[i].life -= 0.022;
      if (pausaTrail[i].life <= 0) pausaTrail.splice(i, 1);
    }
    if (pausaTrail.length > 1) {
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (let i = 1; i < pausaTrail.length; i++) {
        const a = pausaTrail[i - 1], b = pausaTrail[i];
        if (!a || !b) continue;
        const alpha = Math.min(a.life, b.life) * 0.62;
        ctx.strokeStyle = `rgba(255, 224, 162, ${alpha})`;
        ctx.lineWidth = 1.5 + Math.min(a.life, b.life) * 5;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      ctx.restore();
    }

    /* Ondulações (ripples) viscosas criadas pelo toque do polegar */
    for (let i = pausaRipples.length - 1; i >= 0; i--) {
      const rp = pausaRipples[i];
      rp.r += rp.speed;
      rp.speed *= 0.985;
      rp.alpha *= 0.968;
      if (rp.alpha < 0.015 || rp.r > rp.maxR) {
        pausaRipples.splice(i, 1);
        continue;
      }
      ctx.save();
      ctx.globalAlpha = rp.alpha;
      ctx.strokeStyle = rp.hue;
      ctx.lineWidth = rp.lw;
      ctx.beginPath();
      ctx.arc(rp.x, rp.y, rp.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = rp.alpha * 0.35;
      ctx.beginPath();
      ctx.arc(rp.x, rp.y, rp.r * 0.65, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    /* Gotículas luminosas que se dissolvem sem peso */
    for (let i = pausaDrops.length - 1; i >= 0; i--) {
      const dr = pausaDrops[i];
      dr.x += dr.vx;
      dr.y += dr.vy;
      dr.vx *= 0.97;
      dr.vy *= 0.97;
      dr.life -= 0.018;
      if (dr.life <= 0) { pausaDrops.splice(i, 1); continue; }
      ctx.save();
      ctx.globalAlpha = dr.life * 0.65;
      ctx.fillStyle = '#FFE4B0';
      ctx.beginPath();
      ctx.arc(dr.x, dr.y, dr.r * dr.life, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    pausaRaf = requestAnimationFrame(loop);
  }
  pausaRaf = requestAnimationFrame(loop);
}

/* ---------- 3. CÂMARA VIVA DE EXTRAÇÃO DE CAFÉ 60FPS — FOCO & LAUNCH ---------- */
let vesselRaf = 0;
let vesselCanvasRef = null;
const vesselState = {
  pct: 0,
  paused: false,
  pouring: false,
  holdPct: 0,
  slosh: 0,
  theme: 'crema'
};

export function updateFocusVesselState(patch) {
  Object.assign(vesselState, patch);
}

export function initFocusVesselCanvas(getFocusState) {
  const canvas = document.getElementById('brewVesselCanvas');
  if (!canvas) {
    if (vesselRaf) { cancelAnimationFrame(vesselRaf); vesselRaf = 0; }
    vesselCanvasRef = null;
    return;
  }
  if (canvas === vesselCanvasRef && vesselRaf) return;
  if (vesselRaf) cancelAnimationFrame(vesselRaf);
  vesselCanvasRef = canvas;

  const ctx = canvas.getContext('2d');
  let w = 0, h = 0, dpr = Math.min(2, window.devicePixelRatio || 1);
  let smoothFill = 0.14;

  const bubbles = Array.from({ length: 26 }, () => ({
    x: Math.random(),
    y: Math.random(),
    r: 1.5 + Math.random() * 3.8,
    vy: 0.0005 + Math.random() * 0.0014,
    ph: Math.random() * Math.PI * 2
  }));

  const steam = Array.from({ length: 14 }, (_, i) => ({
    x: 0.25 + (i / 14) * 0.5,
    y: Math.random(),
    r: 18 + Math.random() * 28,
    vy: 0.0008 + Math.random() * 0.0008,
    ph: Math.random() * Math.PI * 2
  }));

  function resize() {
    const rect = canvas.getBoundingClientRect();
    w = Math.max(1, Math.round(rect.width || window.innerWidth));
    h = Math.max(1, Math.round(rect.height || window.innerHeight));
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();

  if (canvas.dataset.bound !== '1') {
    canvas.dataset.bound = '1';
    const host = canvas.closest('.focus-living-v3, .brew-launch-stage') || canvas;
    host.addEventListener('pointerdown', (e) => {
      if (e.target && e.target.closest && e.target.closest('button')) return;
      vesselState.slosh = Math.min(26, vesselState.slosh + 14);
      playLiquidDrop(260 + Math.random() * 90);
    }, { passive: true });
  }

  const PALETTES = {
    crema:   { skyTop: '#160D09', skyBot: '#2D1A12', liqTop: '#B55B24', liqMid: '#6E2E14', liqBot: '#261009', rim: '#F7C97B', steam: 'rgba(255, 228, 188, 0.08)' },
    ambar:   { skyTop: '#1C1310', skyBot: '#3D2216', liqTop: '#E28A38', liqMid: '#9B481B', liqBot: '#3B190C', rim: '#FFE09E', steam: 'rgba(255, 232, 195, 0.10)' },
    noturno: { skyTop: '#0B0C12', skyBot: '#18141E', liqTop: '#7B4628', liqMid: '#412114', liqBot: '#140B08', rim: '#E5B273', steam: 'rgba(235, 215, 255, 0.06)' }
  };

  let t = 0;
  function loop() {
    if (!document.body.contains(canvas) || document.body.dataset.tab !== 'foco') {
      vesselRaf = 0;
      vesselCanvasRef = null;
      return;
    }
    const st = getFocusState ? getFocusState() : vesselState;
    const paused = !!st.paused;
    const pouring = !!st.pouring || (vesselState.holdPct > 0.02);
    const pal = PALETTES[st.theme || vesselState.theme] || PALETTES.crema;

    t += paused ? 0.004 : 0.022;
    vesselState.slosh *= 0.955;

    /* Nível alvo do líquido: 16% -> 86% durante a sessão (ou sobe rápido durante hold-to-brew) */
    const targetFill = st.isPre
      ? (0.14 + vesselState.holdPct * 0.42)
      : (0.16 + Math.max(0, Math.min(1, st.pct || 0)) * 0.70);
    smoothFill += (targetFill - smoothFill) * 0.06;

    const rNow2 = canvas.getBoundingClientRect();
    if (Math.abs(rNow2.width - w) > 2 || Math.abs(rNow2.height - h) > 2) resize();
    ctx.clearRect(0, 0, w, h);

    /* Fundo da câmara de vidro */
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, pal.skyTop);
    bg.addColorStop(1, pal.skyBot);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    const surfaceY = h * (1 - smoothFill);

    /* Jato contínuo de café caindo SOMENTE durante o Hold-to-Brew (sem cortar os números do relógio ativo!) */
    if (pouring && st.isPre) {
      const streamAlpha = Math.min(1, 0.45 + vesselState.holdPct * 0.55);
      const sx = w * 0.5;
      const sg = ctx.createLinearGradient(sx, 0, sx, surfaceY + 12);
      sg.addColorStop(0, `rgba(247, 201, 123, ${streamAlpha * 0.85})`);
      sg.addColorStop(0.6, `rgba(210, 114, 46, ${streamAlpha})`);
      sg.addColorStop(1, `rgba(255, 224, 158, ${streamAlpha})`);
      ctx.save();
      ctx.strokeStyle = sg;
      ctx.lineWidth = 3 + vesselState.holdPct * 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(sx, 0);
      ctx.quadraticCurveTo(sx + Math.sin(t * 4) * 3, surfaceY * 0.5, sx, surfaceY + 8);
      ctx.stroke();

      /* Brilho de impacto na superfície (Bloom) */
      const impactG = ctx.createRadialGradient(sx, surfaceY, 2, sx, surfaceY, 44 + vesselState.holdPct * 40);
      impactG.addColorStop(0, `rgba(255, 228, 168, ${streamAlpha * 0.65})`);
      impactG.addColorStop(1, 'rgba(255, 228, 168, 0)');
      ctx.fillStyle = impactG;
      ctx.beginPath();
      ctx.arc(sx, surfaceY, 44 + vesselState.holdPct * 40, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    /* Vapor suave subindo acima do café */
    if (!paused) {
      for (let i = 0; i < steam.length; i++) {
        const sm = steam[i];
        sm.y -= sm.vy;
        if (sm.y < 0) { sm.y = 1; sm.x = 0.22 + Math.random() * 0.56; }
        const py = surfaceY - (1 - sm.y) * Math.min(240, surfaceY * 0.85);
        const px = sm.x * w + Math.sin(t * 0.8 + sm.ph) * 22;
        const alpha = Math.sin(sm.y * Math.PI);
        if (py > -30 && py < surfaceY) {
          ctx.save();
          ctx.globalAlpha = alpha;
          const sg2 = ctx.createRadialGradient(px, py, 2, px, py, sm.r);
          sg2.addColorStop(0, pal.steam);
          sg2.addColorStop(1, 'rgba(255,228,188,0)');
          ctx.fillStyle = sg2;
          ctx.beginPath();
          ctx.arc(px, py, sm.r, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
    }

    /* Onda traseira de crema */
    const ampBase = (paused ? 2.5 : 8.5) + vesselState.slosh + (pouring ? 6 : 0);
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w + 16; x += 12) {
      const y = surfaceY - 5 + Math.sin(x * 0.008 - t * 1.15) * (ampBase * 0.72);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fillStyle = 'rgba(247, 201, 123, 0.20)';
    ctx.fill();

    /* Corpo principal do café vivo com gradiente rico */
    const lg = ctx.createLinearGradient(0, surfaceY - 12, 0, h);
    lg.addColorStop(0, pal.liqTop);
    lg.addColorStop(0.32, pal.liqMid);
    lg.addColorStop(1, pal.liqBot);
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w + 16; x += 10) {
      const y = surfaceY + Math.sin(x * 0.009 + t * 1.45) * ampBase + Math.cos(x * 0.004 - t * 0.8) * (ampBase * 0.35);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fillStyle = lg;
    ctx.fill();

    /* Linha brilhante de crema dourada na crista */
    ctx.beginPath();
    for (let x = 0; x <= w + 16; x += 10) {
      const y = surfaceY + Math.sin(x * 0.009 + t * 1.45) * ampBase + Math.cos(x * 0.004 - t * 0.8) * (ampBase * 0.35);
      if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = pal.rim;
    ctx.lineWidth = 2.4;
    ctx.globalAlpha = paused ? 0.38 : 0.78;
    ctx.stroke();
    ctx.globalAlpha = 1;

    /* Micro-bolhas de crema subindo dentro do líquido */
    for (let i = 0; i < bubbles.length; i++) {
      const b = bubbles[i];
      if (!paused) b.y -= b.vy * (pouring ? 2.2 : 1);
      if (b.y < 0) { b.y = 1; b.x = Math.random(); }
      const by = surfaceY + 14 + b.y * Math.max(20, h - surfaceY - 14);
      const bx = b.x * w + Math.sin(t + b.ph) * 6;
      const depthFade = Math.max(0, 1 - b.y * 0.85);
      ctx.save();
      ctx.globalAlpha = depthFade * (paused ? 0.14 : 0.34);
      ctx.fillStyle = pal.rim;
      ctx.beginPath();
      ctx.arc(bx, by, b.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    vesselRaf = requestAnimationFrame(loop);
  }
  vesselRaf = requestAnimationFrame(loop);
}

/* ---------- 4. HOLD-TO-FILL PILL (SEGURE 1.1s PARA INICIAR COM PREENCHIMENTO CREME) ---------- */
export function bindHoldToBrew(onComplete) {
  const btn = document.getElementById('holdBrewBtn');
  if (!btn || btn.dataset.bound === '1') return;
  btn.dataset.bound = '1';

  const txts = btn.querySelectorAll('.hpb-txt');
  const hint = document.getElementById('holdBrewHint');
  const HOLD_MS = 1050;
  let start = 0;
  let raf = 0;
  let triggered = false;
  let lastTickStep = -1;

  const setTxt = (s) => txts.forEach((n) => { n.textContent = s; });

  const reset = () => {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    start = 0;
    lastTickStep = -1;
    vesselState.holdPct = 0;
    vesselState.pouring = false;
    btn.classList.remove('is-holding');
    btn.style.setProperty('--hold', '0%');
    if (!triggered) {
      setTxt('Segure para começar');
      if (hint) hint.textContent = 'Segure por 1 segundo para entrar no foco';
    }
  };

  const step = () => {
    const elapsed = performance.now() - start;
    const p = Math.min(1, elapsed / HOLD_MS);
    vesselState.holdPct = p;
    vesselState.pouring = true;
    vesselState.slosh = Math.max(vesselState.slosh, 5 + p * 8);
    btn.style.setProperty('--hold', (p * 100).toFixed(1) + '%');
    setTxt(p < 0.95 ? 'Preparando...' : 'Iniciando!');
    if (hint) hint.textContent = p < 0.95 ? 'Mantenha pressionado...' : 'Foco iniciado';

    const tickStep = Math.floor(p * 6);
    if (tickStep > lastTickStep) {
      lastTickStep = tickStep;
      playTactileTick(340 + tickStep * 52, 0.018, 0.032);
    }

    if (p >= 1 && !triggered) {
      triggered = true;
      playBrewLaunchChord();
      btn.classList.add('is-launched');
      setTimeout(() => {
        vesselState.holdPct = 0;
        vesselState.pouring = false;
        onComplete();
      }, 140);
      return;
    }
    raf = requestAnimationFrame(step);
  };

  btn.addEventListener('pointerdown', (e) => {
    if (triggered) return;
    e.preventDefault();
    start = performance.now();
    btn.classList.add('is-holding');
    try { btn.setPointerCapture(e.pointerId); } catch (_) {}
    raf = requestAnimationFrame(step);
  });
  btn.addEventListener('pointerup', () => { if (!triggered) reset(); });
  btn.addEventListener('pointercancel', () => { if (!triggered) reset(); });
}

/* ---------- 5. MÉTODOS, RÉGUA TÁTIL & SWIPE ---------- */
export function methodForMins(m) {
  if (m <= 20) return { name: 'Espresso Curto', img: 'assets/cafe/v2/maquina_espresso.png', note: 'Arranque rápido', glow: 'rgba(232, 131, 58, 0.28)' };
  if (m <= 40) return { name: 'Hario V60',      img: 'assets/cafe/v2/metodo_v60.png',      note: 'Fluxo equilibrado', glow: 'rgba(244, 185, 59, 0.28)' };
  if (m <= 60) return { name: 'Cafeteira Moka', img: 'assets/cafe/v2/moka.png',            note: 'Extração profunda', glow: 'rgba(216, 98, 56, 0.30)' };
  return              { name: 'Chemex Artesanal', img: 'assets/cafe/v2/chemex.png',        note: 'Imersão prolongada', glow: 'rgba(176, 94, 52, 0.32)' };
}

export function finishAtLabel(mins) {
  const d = new Date(Date.now() + Math.max(1, mins) * 60000);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return 'Termina às ' + hh + ':' + mm;
}

const STEP_PX = 20;

export function updateDialVisuals(mins, kind) {
  const m = Math.max(5, Math.min(120, Math.round(mins)));
  const idx = Math.round((m - 5) / 5);
  const meth = methodForMins(m);

  const track = document.getElementById('brewRulerTrack');
  if (track) {
    track.style.transform = `translate3d(${(-idx * STEP_PX).toFixed(1)}px, 0, 0)`;
  }

  const stage = document.querySelector('.open-focus-stage');
  if (stage) {
    stage.style.setProperty('--brew-glow', meth.glow);
  }

  const dv = document.getElementById('durVal');
  if (dv) dv.textContent = m < 1 ? '00:10' : String(m).padStart(2, '0') + ':00';

  const fin = document.getElementById('brewFinishAt');
  if (fin) fin.textContent = finishAtLabel(m);

  const yv = document.getElementById('brewYieldVal');
  if (yv) {
    const kd = kind === 'parcial' ? 'parcial' : 'total';
    const est = kd === 'parcial' ? Math.max(1, Math.floor(m / 2)) : m;
    yv.textContent = '+' + est + 'g' + (kd === 'total' ? ' + bônus' : '');
  }

  const ctaTxt = document.getElementById('brewStartDur');
  if (ctaTxt) ctaTxt.textContent = fmtDur(m);

  document.querySelectorAll('.br-tick').forEach((tk, i) => {
    tk.classList.toggle('is-active', i === idx);
  });
}

export function bindScrubRuler(getState, onMinuteChange) {
  const ruler = document.getElementById('brewRuler');
  if (!ruler || ruler.dataset.bound === '1') return;
  ruler.dataset.bound = '1';

  let dragging = false;
  let startX = 0;
  let startMins = 25;
  let lastM = getState().mins || 25;

  const applyMins = (next) => {
    const snapped = Math.max(5, Math.min(120, Math.round(next / 5) * 5));
    if (snapped !== lastM) {
      lastM = snapped;
      playTactileTick(460 + snapped * 3.1, 0.014, 0.04);
      onMinuteChange(snapped);
      updateDialVisuals(snapped, getState().kind);
    }
  };

  ruler.addEventListener('pointerdown', (e) => {
    dragging = true;
    startX = e.clientX;
    startMins = getState().mins || 25;
    lastM = startMins;
    ruler.classList.add('is-dragging');
    try { ruler.setPointerCapture(e.pointerId); } catch (_) {}
  });

  ruler.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    e.preventDefault();
    const dx = e.clientX - startX;
    const deltaSteps = Math.round(-dx / STEP_PX);
    applyMins(startMins + deltaSteps * 5);
  });

  const stop = () => {
    if (!dragging) return;
    dragging = false;
    ruler.classList.remove('is-dragging');
  };
  ruler.addEventListener('pointerup', stop);
  ruler.addEventListener('pointercancel', stop);

  ruler.addEventListener('wheel', (e) => {
    e.preventDefault();
    const dir = (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) > 0 ? 5 : -5;
    applyMins((getState().mins || 25) + dir);
  }, { passive: false });
}

export function bindBrewDial(getState, onMinuteChange) {
  bindScrubRuler(getState, onMinuteChange);
}

export function bindSwipeTriageDeck(handlers) {
  const card = document.querySelector('.triage-swipe-card.is-top');
  if (!card || card.dataset.bound === '1') return;
  card.dataset.bound = '1';

  let startX = 0, startY = 0, dx = 0, dy = 0, active = false;
  const id = card.dataset.id;

  const setStamp = (dir) => {
    card.dataset.swipe = dir || '';
  };

  card.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    active = true;
    startX = e.clientX;
    startY = e.clientY;
    dx = 0; dy = 0;
    card.style.transition = 'none';
    try { card.setPointerCapture(e.pointerId); } catch (_) {}
  });

  card.addEventListener('pointermove', (e) => {
    if (!active) return;
    dx = e.clientX - startX;
    dy = e.clientY - startY;
    const rot = Math.max(-14, Math.min(14, dx * 0.065));
    card.style.transform = `translate3d(${dx}px, ${dy * 0.55}px, 0) rotate(${rot}deg)`;
    if (dx > 52) setStamp('confirm');
    else if (dx < -52) setStamp('ignore');
    else if (dy < -52 && Math.abs(dx) < 55) setStamp('today');
    else setStamp('');
  });

  const finish = () => {
    if (!active) return;
    active = false;
    card.style.transition = 'transform 0.32s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.28s ease';
    if (dx > 82) {
      playSoftChime();
      card.style.transform = 'translate3d(420px, -20px, 0) rotate(18deg)';
      card.style.opacity = '0';
      setTimeout(() => handlers.onConfirm(id), 220);
    } else if (dx < -82) {
      playTactileTick(310, 0.025, 0.05);
      card.style.transform = 'translate3d(-420px, 20px, 0) rotate(-18deg)';
      card.style.opacity = '0';
      setTimeout(() => handlers.onIgnore(id), 220);
    } else if (dy < -72 && Math.abs(dx) < 60) {
      playSoftChime();
      card.style.transform = 'translate3d(0, -320px, 0) scale(0.95)';
      card.style.opacity = '0';
      setTimeout(() => handlers.onToday(id), 220);
    } else {
      card.style.transform = 'translate3d(0, 0, 0) rotate(0deg)';
      setStamp('');
    }
  };

  card.addEventListener('pointerup', finish);
  card.addEventListener('pointercancel', finish);
}

export function triggerCheckRipple(el) {
  if (!el) return;
  playSoftChime();
  const rect = el.getBoundingClientRect();
  const ring = document.createElement('span');
  ring.className = 'check-burst-ring';
  ring.style.left = (rect.left + rect.width / 2) + 'px';
  ring.style.top = (rect.top + rect.height / 2) + 'px';
  document.body.appendChild(ring);
  setTimeout(() => ring.remove(), 520);
}
