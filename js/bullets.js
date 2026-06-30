// bullets.js — player & enemy bullets through a pool. Motion, homing, bounce, draw.
// Collision resolution lives in game.js (it ties bullets<->enemies<->player together).

import { Pool } from './pool.js';
import { CFG } from './config.js';
import { TAU, dist2, glowSprite, clamp } from './utils.js';

function newBullet() {
  return {
    x: 0, y: 0, vx: 0, vy: 0, r: 4, dmg: 0, life: 0, maxLife: 0,
    color: '#fff', crit: false,
    pierce: 0, homing: 0, bounce: 0, explode: 0, split: 0, chain: 0, big: false,
    lastHit: null, trail: 0,
  };
}

const pPool = new Pool(newBullet);
const ePool = new Pool(newBullet);

// --- Spawn player bullet from player's current weapon stats ---
export function spawnPlayerBullet(state, x, y, angle, dmgScale = 1) {
  const w = state.player.weapon;
  const arr = state.pBullets;
  const b = pPool.get();
  const speed = w.bulletSpeed * (w.big ? 0.78 : 1);
  b.x = x; b.y = y;
  b.vx = Math.cos(angle) * speed;
  b.vy = Math.sin(angle) * speed;
  b.r = w.bulletRadius * (w.big ? 1.9 : 1);
  b.crit = Math.random() < w.critChance;
  b.dmg = w.bulletDmg * dmgScale * (b.crit ? w.critMult : 1) * (w.big ? 1.6 : 1);
  b.life = b.maxLife = w.bulletLife;
  b.color = CFG.colors.playerBullet;
  b.pierce = w.pierce; b.homing = w.homing; b.bounce = w.bounce;
  b.explode = w.explode; b.split = w.split; b.chain = w.chain; b.big = w.big;
  b.lastHit = null;
  arr.push(b);
  return b;
}

// Direct-spawn a player bullet with explicit velocity (used by split/drones).
export function spawnPlayerBulletV(state, x, y, vx, vy, opts) {
  const b = pPool.get();
  b.x = x; b.y = y; b.vx = vx; b.vy = vy;
  b.r = opts.r; b.dmg = opts.dmg; b.crit = !!opts.crit;
  b.life = b.maxLife = opts.life;
  b.color = CFG.colors.playerBullet;
  b.pierce = opts.pierce || 0; b.homing = opts.homing || 0; b.bounce = opts.bounce || 0;
  b.explode = opts.explode || 0; b.split = 0; b.chain = opts.chain || 0; b.big = !!opts.big;
  b.lastHit = null;
  state.pBullets.push(b);
  return b;
}

// --- Spawn enemy bullet (called by patterns.js) ---
export function spawnEnemyBullet(state, x, y, vx, vy, opts = {}) {
  const b = ePool.get();
  b.x = x; b.y = y; b.vx = vx; b.vy = vy;
  b.r = opts.r || CFG.ebullet.radius;
  b.dmg = opts.dmg || CFG.ebullet.dmg * (state.eDmgMult || 1);
  b.life = b.maxLife = opts.life || CFG.ebullet.life;
  b.color = opts.color || CFG.ebullet.color;
  b.homing = opts.homing || 0;
  b.bounce = 0; b.pierce = 0; b.explode = 0; b.split = 0; b.chain = 0;
  state.eBullets.push(b);
  return b;
}

export function releasePlayerBullet(state, i) {
  const arr = state.pBullets;
  pPool.release(arr[i]);
  arr[i] = arr[arr.length - 1]; arr.pop();
}
export function releaseEnemyBullet(state, i) {
  const arr = state.eBullets;
  ePool.release(arr[i]);
  arr[i] = arr[arr.length - 1]; arr.pop();
}

function nearestEnemy(state, x, y) {
  let best = null, bd = Infinity;
  const es = state.enemies;
  for (let i = 0; i < es.length; i++) {
    const e = es[i];
    const d = dist2(x, y, e.x, e.y);
    if (d < bd) { bd = d; best = e; }
  }
  if (state.boss) {
    const d = dist2(x, y, state.boss.x, state.boss.y);
    if (d < bd) best = state.boss;
  }
  return best;
}

const A = CFG.arena;

export function updateBullets(state, dt) {
  // player bullets
  const pb = state.pBullets;
  for (let i = 0; i < pb.length; i++) {
    const b = pb[i];
    b.life -= dt;
    if (b.homing) {
      const tgt = nearestEnemy(state, b.x, b.y);
      if (tgt) {
        const desired = Math.atan2(tgt.y - b.y, tgt.x - b.x);
        const cur = Math.atan2(b.vy, b.vx);
        let d = desired - cur;
        while (d > Math.PI) d -= TAU;
        while (d < -Math.PI) d += TAU;
        const turn = clamp(d, -b.homing * dt, b.homing * dt);
        const na = cur + turn;
        const sp = Math.hypot(b.vx, b.vy);
        b.vx = Math.cos(na) * sp; b.vy = Math.sin(na) * sp;
      }
    }
    b.x += b.vx * dt; b.y += b.vy * dt;
    let dead = b.life <= 0;
    if (b.bounce > 0) {
      if (b.x < 0 || b.x > A.w) { b.vx = -b.vx; b.x = clamp(b.x, 0, A.w); b.bounce--; }
      if (b.y < 0 || b.y > A.h) { b.vy = -b.vy; b.y = clamp(b.y, 0, A.h); b.bounce--; }
    } else if (b.x < -40 || b.x > A.w + 40 || b.y < -40 || b.y > A.h + 40) {
      dead = true;
    }
    if (dead) { releasePlayerBullet(state, i); i--; }
  }

  // enemy bullets
  const eb = state.eBullets;
  for (let i = 0; i < eb.length; i++) {
    const b = eb[i];
    b.life -= dt;
    b.x += b.vx * dt; b.y += b.vy * dt;
    if (b.life <= 0 || b.x < -60 || b.x > A.w + 60 || b.y < -60 || b.y > A.h + 60) {
      releaseEnemyBullet(state, i); i--;
    }
  }
}

export function drawBullets(ctx, state, camX, camY) {
  ctx.globalCompositeOperation = 'lighter';

  // enemy bullets (warm/danger). Glow + core.
  const eb = state.eBullets;
  for (let i = 0; i < eb.length; i++) {
    const b = eb[i];
    const sx = b.x - camX, sy = b.y - camY;
    const g = b.r * 3.2;
    ctx.drawImage(glowSprite(b.color, 32), sx - g, sy - g, g * 2, g * 2);
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(sx, sy, b.r * 0.5, 0, TAU); ctx.fill();
  }

  // player bullets (cold cyan/white)
  const pb = state.pBullets;
  for (let i = 0; i < pb.length; i++) {
    const b = pb[i];
    const sx = b.x - camX, sy = b.y - camY;
    const g = b.r * 3.0;
    ctx.drawImage(glowSprite(b.color, 32), sx - g, sy - g, g * 2, g * 2);
    ctx.fillStyle = b.crit ? '#fff7c2' : CFG.colors.playerBulletCore;
    ctx.beginPath(); ctx.arc(sx, sy, b.r * 0.7, 0, TAU); ctx.fill();
  }

  ctx.globalCompositeOperation = 'source-over';
}
