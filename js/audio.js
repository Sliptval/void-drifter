// audio.js — procedural SFX via Web Audio API. No asset files.

import { CFG } from './config.js';

let ctx = null;
let master = null;
let muted = CFG.audio.muted;

function ensure() {
  if (ctx) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : CFG.audio.master;
  master.connect(ctx.destination);
}

// Resume on first user gesture (browsers autosuspend audio).
export function unlockAudio() {
  ensure();
  if (ctx && ctx.state === 'suspended') ctx.resume();
}

export function toggleMute() {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : CFG.audio.master;
  return muted;
}
// Force a mute state (used by ad playback / tab visibility). Does not touch the
// user's manual mute preference toggled via M.
export function setMuted(v) {
  muted = !!v;
  if (master) master.gain.value = muted ? 0 : CFG.audio.master;
}
export function isMuted() { return muted; }

// Core tone helper: oscillator with frequency sweep + gain envelope.
function tone({ type = 'sine', f0, f1, dur, vol = 0.5, attack = 0.002 }) {
  if (!ctx || muted) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(f0, t);
  if (f1 && f1 !== f0) osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g); g.connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function noise({ dur, vol = 0.4, hp = 400 }) {
  if (!ctx || muted) return;
  const t = ctx.currentTime;
  const n = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'highpass'; f.frequency.value = hp;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(master);
  src.start(t);
}

// Throttle very frequent sounds (shots) to avoid clipping.
let lastShot = 0;
export const Sfx = {
  shoot() {
    if (!ctx) return;
    if (ctx.currentTime - lastShot < 0.03) return;
    lastShot = ctx.currentTime;
    tone({ type: 'square', f0: 880, f1: 360, dur: 0.07, vol: 0.10 });
  },
  hit() { tone({ type: 'triangle', f0: 320, f1: 180, dur: 0.05, vol: 0.10 }); },
  enemyDeath() { noise({ dur: 0.18, vol: 0.18, hp: 300 }); tone({ type: 'sawtooth', f0: 220, f1: 60, dur: 0.18, vol: 0.10 }); },
  playerHurt() { tone({ type: 'sawtooth', f0: 200, f1: 50, dur: 0.3, vol: 0.28 }); noise({ dur: 0.2, vol: 0.18, hp: 200 }); },
  pickup() { tone({ type: 'sine', f0: 660, f1: 990, dur: 0.06, vol: 0.10 }); },
  levelUp() { tone({ type: 'sine', f0: 523, f1: 1046, dur: 0.18, vol: 0.22 }); tone({ type: 'sine', f0: 784, f1: 1568, dur: 0.28, vol: 0.16 }); },
  dash() { tone({ type: 'sine', f0: 180, f1: 520, dur: 0.14, vol: 0.16 }); },
  bossSpawn() { tone({ type: 'sawtooth', f0: 120, f1: 40, dur: 0.7, vol: 0.3 }); },
  bossDeath() { noise({ dur: 0.9, vol: 0.35, hp: 120 }); tone({ type: 'sawtooth', f0: 300, f1: 30, dur: 0.9, vol: 0.25 }); },
  shieldBreak() { tone({ type: 'triangle', f0: 700, f1: 200, dur: 0.18, vol: 0.18 }); },
  enemyShoot() { if (ctx && ctx.currentTime - lastShot > 0.02) tone({ type: 'triangle', f0: 300, f1: 220, dur: 0.05, vol: 0.05 }); },
};
