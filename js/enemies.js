// enemies.js — enemy types, AI, wave spawner, time-based difficulty, boss.

import { CFG } from './config.js';
import { Pool } from './pool.js';
import { rng, TAU, dist2, clamp, glowSprite } from './utils.js';
import * as P from './patterns.js';
import { Sfx } from './audio.js';

const A = CFG.arena;
let nextId = 1;

const pool = new Pool(() => ({
  id: 0, type: '', x: 0, y: 0, vx: 0, vy: 0, hp: 0, maxHp: 0, r: 0,
  dmg: 0, speed: 0, color: '#fff', score: 0,
  fireTimer: 0, fireRate: 0, spin: 0, flash: 0, squash: 1, wander: 0,
}));

// --- Difficulty multipliers from current wave number (wave 1 = baseline) ---
export function waveDifficulty(wave) {
  const k = Math.max(0, wave - 1);
  return {
    hp: Math.pow(1 + CFG.wave.hpScalePerWave, k),
    speed: Math.pow(1 + CFG.wave.speedScalePerWave, k),
    dmg: Math.pow(1 + CFG.wave.dmgScalePerWave, k),
    // target alive enemies for this wave, clamped to the soft cap
    target: Math.min(CFG.wave.targetMax, Math.round(CFG.wave.targetBase + CFG.wave.targetPerWave * k)),
  };
}

// How long a normal wave lasts (seconds).
export function waveDuration(wave) {
  return Math.min(CFG.wave.durationMax, CFG.wave.baseDuration + CFG.wave.durationPerWave * (wave - 1));
}

function unlockedTypes(wave) {
  const u = CFG.wave.unlock;
  const list = [];
  for (const type in u) if (wave >= u[type]) list.push(type);
  return list;
}

// Pick a spawn point just outside a random arena edge.
function edgePoint(out) {
  const m = CFG.spawn.margin;
  const side = (rng() * 4) | 0;
  if (side === 0) { out.x = rng() * A.w; out.y = -m; }
  else if (side === 1) { out.x = A.w + m; out.y = rng() * A.h; }
  else if (side === 2) { out.x = rng() * A.w; out.y = A.h + m; }
  else { out.x = -m; out.y = rng() * A.h; }
  return out;
}

export function spawnEnemy(state, type, x, y) {
  const c = CFG.enemies[type];
  const d = waveDifficulty(state.wave);
  const m = state.mods;
  const e = pool.get();
  e.id = nextId++;
  e.type = type;
  e.x = x; e.y = y; e.vx = 0; e.vy = 0;
  e.maxHp = e.hp = c.hp * d.hp * m.enemyHp;
  e.r = c.radius;
  e.dmg = c.dmg * d.dmg;
  e.speed = c.speed * d.speed * m.enemySpeed;
  e.color = c.color;
  e.score = c.score;
  e.fireRate = c.fireRate || 0;
  e.fireTimer = rng() * 1.5;
  e.spin = rng() * TAU;
  e.flash = 0; e.squash = 1;
  e.wander = rng() * TAU;
  state.enemies.push(e);
  return e;
}

export function releaseEnemy(state, i) {
  pool.release(state.enemies[i]);
  state.enemies[i] = state.enemies[state.enemies.length - 1];
  state.enemies.pop();
}

const _p = { x: 0, y: 0 };

// --- Wave spawner: tops up alive enemies toward the wave's target count. ---
export function updateSpawner(state, dt) {
  // Boss waves run no normal spawns; the boss is the whole wave.
  if (state.isBossWave || state.boss) return;

  state.spawnTimer -= dt;
  if (state.spawnTimer > 0) return;
  state.spawnTimer = CFG.wave.spawnInterval;

  const d = waveDifficulty(state.wave);
  const target = Math.min(CFG.spawn.maxEnemies, Math.round(d.target * state.mods.enemyCount));
  const alive = state.enemies.length;
  if (alive >= target || alive >= CFG.spawn.maxEnemies) return;

  const types = unlockedTypes(state.wave);
  const need = Math.min(CFG.wave.batchPerTick, target - alive);

  // Occasionally arrive as a swarm cluster for variety.
  if (types.includes('swarm') && rng.chance(0.28)) {
    edgePoint(_p);
    const n = Math.min(need + 2, 5);
    for (let i = 0; i < n; i++) spawnEnemy(state, 'swarm', _p.x + (rng() * 60 - 30), _p.y + (rng() * 60 - 30));
    return;
  }
  for (let i = 0; i < need; i++) {
    edgePoint(_p);
    const type = weightedType(types);
    spawnEnemy(state, type, _p.x, _p.y);
  }
}

// Bias spawns toward cheaper enemies, rarer for tanks.
function weightedType(types) {
  const weights = { chaser: 5, swarm: 4, shooter: 3, burster: 2.5, spinner: 2, tank: 1 };
  let total = 0;
  for (const t of types) total += weights[t] || 1;
  let r = rng() * total;
  for (const t of types) { r -= weights[t] || 1; if (r <= 0) return t; }
  return types[0];
}

// --- Enemy AI + shooting ---
export function updateEnemies(state, dt) {
  const px = state.player.x, py = state.player.y;
  const es = state.enemies;
  for (let i = 0; i < es.length; i++) {
    const e = es[i];
    if (e.flash > 0) e.flash -= dt;
    if (e.squash < 1) e.squash = Math.min(1, e.squash + dt * 6);

    const ax = px - e.x, ay = py - e.y;
    const distToP = Math.hypot(ax, ay) || 1;
    const nx = ax / distToP, ny = ay / distToP;

    switch (e.type) {
      case 'chaser':
      case 'tank':
        e.vx = nx * e.speed; e.vy = ny * e.speed;
        break;
      case 'swarm':
        e.wander += (rng() - 0.5) * dt * 6;
        e.vx = (nx + Math.cos(e.wander) * 0.4) * e.speed;
        e.vy = (ny + Math.sin(e.wander) * 0.4) * e.speed;
        break;
      case 'burster':
        e.vx = nx * e.speed; e.vy = ny * e.speed;
        break;
      case 'shooter': {
        const keep = CFG.enemies.shooter.keepDist;
        const dir = distToP > keep + 30 ? 1 : distToP < keep - 30 ? -1 : 0;
        e.vx = nx * e.speed * dir + (-ny) * e.speed * 0.3; // strafe
        e.vy = ny * e.speed * dir + (nx) * e.speed * 0.3;
        e.fireTimer -= dt;
        if (e.fireTimer <= 0 && distToP < 760) {
          e.fireTimer = 1 / e.fireRate;
          P.aimed(state, e.x, e.y, px, py, CFG.ebullet.speed * 1.25, { color: e.color });
        }
        break;
      }
      case 'spinner': {
        e.vx = nx * e.speed * 0.4; e.vy = ny * e.speed * 0.4;
        e.spin += dt * 2.0;
        e.fireTimer -= dt;
        if (e.fireTimer <= 0) {
          e.fireTimer = 0.2;
          P.spiral(state, e.x, e.y, e.spin, 2, CFG.ebullet.speed, { color: e.color });
        }
        break;
      }
    }

    e.x += e.vx * dt; e.y += e.vy * dt;
    e.x = clamp(e.x, -CFG.spawn.margin, A.w + CFG.spawn.margin);
    e.y = clamp(e.y, -CFG.spawn.margin, A.h + CFG.spawn.margin);
  }
}

// On-death side-effects that spawn bullets (burster) — called from game.js.
export function onEnemyDeath(state, e) {
  if (e.type === 'burster') {
    P.radial(state, e.x, e.y, CFG.enemies.burster.burst, CFG.ebullet.speed * 0.9, rng() * TAU, { color: e.color });
  }
}

// --- Boss ---
export function spawnBoss(state) {
  const bossIndex = state.bossCount;
  const b = {
    type: 'boss', x: A.w / 2, y: -CFG.boss.radius * 2,
    vx: 0, vy: 0,
    maxHp: CFG.boss.hp * Math.pow(1 + CFG.boss.hpScalePerBoss, bossIndex) * state.mods.bossHp,
    hp: 0, r: CFG.boss.radius, dmg: CFG.boss.contactDmg,
    color: CFG.boss.color, flash: 0, squash: 1,
    phase: 0, attackTimer: 1.5, spin: 0, sweep: 0, entering: true,
  };
  b.hp = b.maxHp;
  state.boss = b;
  Sfx.bossSpawn();
}

export function updateBoss(state, dt) {
  const b = state.boss;
  if (!b) return;
  if (b.flash > 0) b.flash -= dt;
  const px = state.player.x, py = state.player.y;

  // Entrance: float into the arena.
  if (b.entering) {
    b.y += 90 * dt;
    if (b.y >= A.h * 0.28) b.entering = false;
    return;
  }

  // Slow hover-chase, keeping some distance.
  const ax = px - b.x, ay = py - b.y;
  const dd = Math.hypot(ax, ay) || 1;
  const target = 360;
  const dir = dd > target ? 1 : -0.6;
  b.x += (ax / dd) * CFG.boss.speed * dir * dt;
  b.y += (ay / dd) * CFG.boss.speed * dir * 0.5 * dt;
  b.x = clamp(b.x, b.r, A.w - b.r);
  b.y = clamp(b.y, b.r, A.h * 0.6);

  const frac = b.hp / b.maxHp;
  const phase = frac > 0.66 ? 0 : frac > 0.33 ? 1 : 2;
  b.spin += dt * 1.6;
  b.attackTimer -= dt;

  if (b.attackTimer <= 0) {
    if (phase === 0) {
      // Phase 1: alternating radial rings + aimed fan.
      P.radial(state, b.x, b.y, 14, CFG.ebullet.speed, b.spin, { color: b.color, r: 7 });
      P.fan(state, b.x, b.y, px, py, 4, 0.6, CFG.ebullet.speed * 1.15, { color: '#ff8e3c', r: 6 });
      b.attackTimer = 1.3;
    } else if (phase === 1) {
      // Phase 2: continuous spiral + sweeping wall with a gap.
      b.sweep = (b.sweep + 1) % 9;
      P.wall(state, b.x, b.y, px, py, 11, 1.8, CFG.ebullet.speed * 1.05, b.sweep, 1.6, { color: '#ff4fa3', r: 6 });
      b.attackTimer = 0.7;
    } else {
      // Phase 3: dense spiral storm + aimed bursts.
      P.spiral(state, b.x, b.y, b.spin, 4, CFG.ebullet.speed, { color: '#c45bff', r: 6 });
      P.fan(state, b.x, b.y, px, py, 5, 0.9, CFG.ebullet.speed * 1.2, { color: '#ff3b6b', r: 6 });
      b.attackTimer = 0.42;
    }
  }
}

// --- Drawing ---
export function drawEnemies(ctx, state, camX, camY) {
  const es = state.enemies;
  for (let i = 0; i < es.length; i++) {
    drawEnemy(ctx, es[i], camX, camY);
  }
}

function drawEnemy(ctx, e, camX, camY) {
  const sx = e.x - camX, sy = e.y - camY;
  // additive glow
  ctx.globalCompositeOperation = 'lighter';
  const g = e.r * 2.4;
  ctx.globalAlpha = 0.6;
  ctx.drawImage(glowSprite(e.color, 32), sx - g, sy - g, g * 2, g * 2);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';

  ctx.save();
  ctx.translate(sx, sy);
  const sq = e.squash;
  ctx.scale(sq, 2 - sq);
  ctx.fillStyle = e.flash > 0 ? '#ffffff' : e.color;
  ctx.strokeStyle = e.flash > 0 ? '#ffffff' : '#ffffff';
  ctx.lineWidth = 2;
  drawShape(ctx, e.type, e.r, e.spin);
  ctx.restore();
}

function drawShape(ctx, type, r, spin) {
  ctx.beginPath();
  switch (type) {
    case 'chaser': // triangle
      polygon(ctx, 3, r, spin); break;
    case 'swarm': // small diamond
      polygon(ctx, 4, r, Math.PI / 4); break;
    case 'shooter': // pentagon
      polygon(ctx, 5, r, spin); break;
    case 'spinner': // hexagon
      polygon(ctx, 6, r, spin); break;
    case 'burster': // square
      polygon(ctx, 4, r, spin); break;
    case 'tank': // octagon
      polygon(ctx, 8, r, spin); break;
    default:
      ctx.arc(0, 0, r, 0, TAU);
  }
  ctx.fill();
  ctx.stroke();
}

function polygon(ctx, n, r, rot) {
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * TAU;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

export function drawBoss(ctx, state, camX, camY) {
  const b = state.boss;
  if (!b) return;
  const sx = b.x - camX, sy = b.y - camY;
  ctx.globalCompositeOperation = 'lighter';
  const g = b.r * 2.6;
  ctx.globalAlpha = 0.7;
  ctx.drawImage(glowSprite(b.color, 32), sx - g, sy - g, g * 2, g * 2);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';

  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(b.spin * 0.3);
  ctx.fillStyle = b.flash > 0 ? '#fff' : b.color;
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 3;
  // layered rings
  polygon(ctx, 8, b.r, 0); ctx.fill(); ctx.stroke();
  ctx.beginPath();
  ctx.fillStyle = b.flash > 0 ? '#fff' : '#1a0a14';
  polygon(ctx, 8, b.r * 0.6, Math.PI / 8); ctx.fill();
  ctx.beginPath();
  ctx.fillStyle = b.color;
  ctx.arc(0, 0, b.r * 0.28, 0, TAU); ctx.fill();
  ctx.restore();
}
