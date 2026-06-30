// main.js — entry point: canvas setup, resize, input wiring, rAF loop, Yandex SDK.

import { CFG } from './config.js';
import { Game } from './game.js';
import { Input } from './input.js';
import { unlockAudio, setMuted, isMuted } from './audio.js';
import { initYandex, gameplayStart, gameplayStop } from './yandex.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  canvas.width = w; canvas.height = h;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  Game.resize(w, h);
}
window.addEventListener('resize', resize);
resize();

Input.init(canvas);
Game.init(ctx, canvas.width, canvas.height);

// Initialize the Yandex SDK (safe no-op off-platform) and signal load complete.
initYandex();

// Map a DOM event to canvas pixel coords.
function evToCanvas(e, out) {
  const r = canvas.getBoundingClientRect();
  out.x = (e.clientX - r.left) * (canvas.width / r.width);
  out.y = (e.clientY - r.top) * (canvas.height / r.height);
  return out;
}
const _m = { x: 0, y: 0 };

canvas.addEventListener('mousedown', (e) => {
  unlockAudio();
  evToCanvas(e, _m);
  Game.onClick(_m.x, _m.y);
});
canvas.addEventListener('mousemove', (e) => {
  evToCanvas(e, _m);
  Game._mx = _m.x; Game._my = _m.y;
});
window.addEventListener('keydown', unlockAudio, { once: true });

// Mute audio while the tab is hidden; restore the player's prior mute state.
let wasMuted = false;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { wasMuted = isMuted(); setMuted(true); }
  else setMuted(wasMuted);
});

// --- game loop ---
let last = performance.now();
let wasPlaying = false;
function frame(now) {
  let dt = (now - last) / 1000;
  last = now;
  if (dt > CFG.maxDt) dt = CFG.maxDt;   // clamp (tab refocus / hitches)
  Game.update(dt);
  Game.render();

  // Bracket active play for the platform (ad/focus management).
  const playing = Game.scene === 'play';
  if (playing !== wasPlaying) { playing ? gameplayStart() : gameplayStop(); wasPlaying = playing; }

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
