// utils.js — math, RNG, color and glow-sprite helpers. No game state here.

export const TAU = Math.PI * 2;

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const sign = (v) => (v < 0 ? -1 : v > 0 ? 1 : 0);

// Distance squared (avoid sqrt in hot loops)
export const dist2 = (ax, ay, bx, by) => {
  const dx = ax - bx, dy = ay - by;
  return dx * dx + dy * dy;
};
export const dist = (ax, ay, bx, by) => Math.sqrt(dist2(ax, ay, bx, by));

// Angle from (ax,ay) toward (bx,by)
export const angleTo = (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax);

// Shortest signed angular difference a->b in (-PI, PI]
export function angleDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

// --- Seedable RNG (mulberry32). Global instance used for spawns/upgrades ---
export function makeRng(seed = (Math.random() * 1e9) | 0) {
  let s = seed >>> 0;
  const fn = () => {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  fn.range = (lo, hi) => lo + fn() * (hi - lo);
  fn.int = (lo, hi) => (lo + Math.floor(fn() * (hi - lo + 1)));
  fn.pick = (arr) => arr[(fn() * arr.length) | 0];
  fn.chance = (p) => fn() < p;
  return fn;
}
export const rng = makeRng();

// --- Glow sprite cache: pre-render radial-gradient discs once, drawImage later ---
const glowCache = new Map();
export function glowSprite(color, radius) {
  const key = color + '|' + radius;
  let c = glowCache.get(key);
  if (c) return c;
  const size = Math.ceil(radius * 2);
  c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(radius, radius, 0, radius, radius, radius);
  grd.addColorStop(0, color);
  grd.addColorStop(0.35, color);
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.beginPath();
  g.arc(radius, radius, radius, 0, TAU);
  g.fill();
  glowCache.set(key, c);
  return c;
}

// Draw additive glow centered at (x,y) with given screen radius
export function drawGlow(ctx, color, x, y, radius) {
  const spr = glowSprite(color, 32);          // fixed sprite, scaled on draw
  ctx.drawImage(spr, x - radius, y - radius, radius * 2, radius * 2);
}

// Convert #rrggbb to "rgba()" with alpha
export function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return `rgba(${r},${g},${b},${a})`;
}

export const fmtTime = (s) => {
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${m}:${ss < 10 ? '0' : ''}${ss}`;
};
