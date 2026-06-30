// player.js — ship: movement, dash (i-frames), auto-fire with weapon mods, drones,
// shield, spikes, slow-field, lifesteal hooks. Draw ship + tiny hitbox dot.

import { CFG } from './config.js';
import { Input } from './input.js';
import { TAU, dist2, clamp, glowSprite, rng } from './utils.js';
import { spawnPlayerBullet, spawnPlayerBulletV } from './bullets.js';
import { Particles } from './particles.js';
import { Sfx } from './audio.js';

const A = CFG.arena;

export function createPlayer(mods) {
  const c = CFG.player;
  const maxHp = Math.round(c.maxHp * (mods ? mods.playerMaxHp : 1));
  return {
    x: A.w / 2, y: A.h / 2, vx: 0, vy: 0,
    r: c.radius, hitR: c.hitRadius,
    maxHp, hp: maxHp,
    speed: c.speed,
    facing: -Math.PI / 2,
    iframes: 0, hurtFlash: 0,
    fireTimer: 0,
    alive: true,
    magnetRadius: c.magnetRadius,
    spikes: 0, slowField: 0, lifesteal: 0,
    droneCount: 0, drones: [],
    moveX: 0, moveY: 0,
    shield: { max: 0, cur: 0, regenTimer: 0 },
    dash: {
      maxCharges: c.dash.charges, charges: c.dash.charges,
      cooldown: c.dash.cooldown, rechargeTimer: 0,
      time: c.dash.time, iframes: c.dash.iframes,
      activeTimer: 0, vx: 0, vy: 0,
    },
    weapon: {
      bulletDmg: c.bulletDmg, bulletSpeed: c.bulletSpeed, bulletRadius: c.bulletRadius,
      bulletLife: c.bulletLife, fireRate: c.fireRate,
      critChance: c.critChance, critMult: c.critMult,
      multishot: 0, spread: 0.16,
      pierce: 0, homing: 0, bounce: 0, explode: 0, split: 0, chain: 0,
      big: false, rearFire: false, sideFire: false,
    },
    upgradeStacks: {},
  };
}

const _mv = { x: 0, y: 0 };

export function updatePlayer(state, dt) {
  const p = state.player;
  const d = p.dash;

  // --- input / movement ---
  Input.moveVec(_mv);
  p.moveX = _mv.x; p.moveY = _mv.y;

  // dash trigger
  if (Input.consumePress('dash') && d.charges > 0 && d.activeTimer <= 0) {
    let dx = _mv.x, dy = _mv.y;
    if (dx === 0 && dy === 0) { dx = Math.cos(p.facing); dy = Math.sin(p.facing); }
    const inv = 1 / (Math.hypot(dx, dy) || 1);
    d.vx = dx * inv * CFG.player.dash.speed;
    d.vy = dy * inv * CFG.player.dash.speed;
    d.activeTimer = d.time;
    d.charges--;
    p.iframes = Math.max(p.iframes, d.iframes);
    Sfx.dash();
    for (let i = 0; i < 10; i++) Particles.burst(p.x, p.y, 1, CFG.colors.player, 240, 3, 0.4);
  }

  if (d.activeTimer > 0) {
    d.activeTimer -= dt;
    p.x += d.vx * dt; p.y += d.vy * dt;
    Particles.trail(p.x, p.y, CFG.colors.player, 4, 0.3);
  } else {
    // smooth accel toward desired velocity
    const desiredX = _mv.x * p.speed, desiredY = _mv.y * p.speed;
    const k = Math.min(1, dt * CFG.player.friction);
    p.vx += (desiredX - p.vx) * k;
    p.vy += (desiredY - p.vy) * k;
    p.x += p.vx * dt; p.y += p.vy * dt;
    if (_mv.x || _mv.y) {
      p.facing = Math.atan2(_mv.y, _mv.x);
      if (rng() < 0.6) Particles.trail(p.x - Math.cos(p.facing) * p.r, p.y - Math.sin(p.facing) * p.r, CFG.colors.player, 2.5, 0.25);
    }
  }
  p.x = clamp(p.x, p.r, A.w - p.r);
  p.y = clamp(p.y, p.r, A.h - p.r);

  // dash recharge
  if (d.charges < d.maxCharges) {
    d.rechargeTimer += dt;
    if (d.rechargeTimer >= d.cooldown) { d.rechargeTimer = 0; d.charges++; }
  }

  // timers
  if (p.iframes > 0) p.iframes -= dt;
  if (p.hurtFlash > 0) p.hurtFlash -= dt;

  // shield regen
  if (p.shield.max > 0 && p.shield.cur < p.shield.max) {
    p.shield.regenTimer += dt;
    if (p.shield.regenTimer >= 6) { p.shield.regenTimer = 0; p.shield.cur++; }
  }

  // --- auto-fire ---
  p.fireTimer -= dt;
  if (p.fireTimer <= 0) {
    const aim = aimAngle(state, p.x, p.y);
    if (aim !== null) {
      p.fireTimer = 1 / p.weapon.fireRate;
      fireVolley(state, p, aim);
      Sfx.shoot();
    } else {
      p.fireTimer = 0.05; // idle poll
    }
  }

  updateDrones(state, p, dt);
  applySlowField(state, p);
}

function aimAngle(state, x, y) {
  if (CFG.flags.mouseAim) {
    return Math.atan2(Input.mouseY - (state.H / 2), Input.mouseX - (state.W / 2));
  }
  const e = nearestEnemy(state, x, y);
  if (!e) return null;
  return Math.atan2(e.y - y, e.x - x);
}

export function nearestEnemy(state, x, y) {
  let best = null, bd = Infinity;
  const es = state.enemies;
  for (let i = 0; i < es.length; i++) {
    const d = dist2(x, y, es[i].x, es[i].y);
    if (d < bd) { bd = d; best = es[i]; }
  }
  if (state.boss && !state.boss.entering) {
    const d = dist2(x, y, state.boss.x, state.boss.y);
    if (d < bd) best = state.boss;
  }
  return best;
}

function fireVolley(state, p, aim) {
  const dirs = [aim];
  if (p.weapon.rearFire) dirs.push(aim + Math.PI);
  if (p.weapon.sideFire) { dirs.push(aim + Math.PI / 2, aim - Math.PI / 2); }
  for (const base of dirs) spread(state, p, base);
}

function spread(state, p, base) {
  const n = 1 + p.weapon.multishot;
  if (n === 1) {
    spawnPlayerBullet(state, p.x, p.y, base);
    return;
  }
  const total = p.weapon.spread * (n - 1);
  const start = base - total / 2;
  for (let i = 0; i < n; i++) spawnPlayerBullet(state, p.x, p.y, start + p.weapon.spread * i);
}

// --- Drones: orbit the player and shoot the nearest enemy ---
function updateDrones(state, p, dt) {
  while (p.drones.length < p.droneCount) {
    p.drones.push({ angle: rng() * TAU, fireTimer: rng() });
  }
  while (p.drones.length > p.droneCount) p.drones.pop();

  const orbit = p.r + 34;
  for (let i = 0; i < p.drones.length; i++) {
    const dr = p.drones[i];
    dr.angle += dt * 2.2;
    const phase = dr.angle + (i / Math.max(1, p.drones.length)) * TAU;
    dr.x = p.x + Math.cos(phase) * orbit;
    dr.y = p.y + Math.sin(phase) * orbit;
    dr.fireTimer -= dt;
    if (dr.fireTimer <= 0) {
      const e = nearestEnemy(state, dr.x, dr.y);
      if (e) {
        dr.fireTimer = 0.55;
        const a = Math.atan2(e.y - dr.y, e.x - dr.x);
        const sp = p.weapon.bulletSpeed * 0.95;
        spawnPlayerBulletV(state, dr.x, dr.y, Math.cos(a) * sp, Math.sin(a) * sp, {
          r: p.weapon.bulletRadius * 0.85, dmg: p.weapon.bulletDmg * 0.55,
          life: p.weapon.bulletLife, pierce: p.weapon.pierce, homing: p.weapon.homing,
          explode: p.weapon.explode, chain: p.weapon.chain,
        });
      } else dr.fireTimer = 0.2;
    }
  }
}

// Slow enemy bullets that enter the stasis field (floored, no stored state).
function applySlowField(state, p) {
  if (p.slowField <= 0) return;
  const r2 = p.slowField * p.slowField;
  const floor = 70;
  const eb = state.eBullets;
  for (let i = 0; i < eb.length; i++) {
    const b = eb[i];
    if (dist2(p.x, p.y, b.x, b.y) < r2) {
      const sp = Math.hypot(b.vx, b.vy);
      if (sp > floor) {
        const s = Math.max(floor / sp, 0.92);
        b.vx *= s; b.vy *= s;
      }
    }
  }
}

// --- Damage entry point (called from game.js collisions) ---
export function hurtPlayer(state, amount) {
  const p = state.player;
  if (p.iframes > 0) return;
  if (p.shield.cur > 0) {
    p.shield.cur--;
    p.iframes = 0.5;
    Sfx.shieldBreak();
    return;
  }
  p.hp -= amount * state.mods.dmgTaken;
  p.iframes = CFG.player.iframesOnHit;
  p.hurtFlash = 0.25;
  Sfx.playerHurt();
  if (p.hp <= 0) { p.hp = 0; p.alive = false; }
}

export function healPlayer(p, amount) {
  p.hp = Math.min(p.maxHp, p.hp + amount);
}

// --- Drawing ---
export function drawPlayer(ctx, state, camX, camY) {
  const p = state.player;
  const sx = p.x - camX, sy = p.y - camY;

  // slow-field aura
  if (p.slowField > 0) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.10;
    ctx.fillStyle = '#46f0ff';
    ctx.beginPath(); ctx.arc(sx, sy, p.slowField, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  // blink during i-frames
  const blink = p.iframes > 0 && (Math.floor(p.iframes * 20) % 2 === 0);

  // drones
  ctx.globalCompositeOperation = 'lighter';
  for (const dr of p.drones) {
    const dx = dr.x - camX, dy = dr.y - camY;
    ctx.drawImage(glowSprite('#9ffcff', 32), dx - 12, dy - 12, 24, 24);
    ctx.fillStyle = '#dffbff';
    ctx.beginPath(); ctx.arc(dx, dy, 4, 0, TAU); ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';

  if (!blink) {
    // glow
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.7;
    ctx.drawImage(glowSprite(CFG.colors.player, 32), sx - p.r * 2, sy - p.r * 2, p.r * 4, p.r * 4);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    // ship triangle
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(p.facing);
    ctx.fillStyle = p.hurtFlash > 0 ? '#fff' : CFG.colors.player;
    ctx.strokeStyle = '#eaffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(p.r, 0);
    ctx.lineTo(-p.r * 0.8, p.r * 0.7);
    ctx.lineTo(-p.r * 0.4, 0);
    ctx.lineTo(-p.r * 0.8, -p.r * 0.7);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  // shield ring
  if (p.shield.cur > 0) {
    ctx.strokeStyle = 'rgba(120,200,255,0.7)';
    ctx.lineWidth = 2;
    for (let i = 0; i < p.shield.cur; i++) {
      ctx.beginPath(); ctx.arc(sx, sy, p.r + 6 + i * 4, 0, TAU); ctx.stroke();
    }
  }

  // tiny bright hitbox dot (always visible)
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(sx, sy, p.hitR, 0, TAU); ctx.fill();
  ctx.fillStyle = '#46f0ff';
  ctx.beginPath(); ctx.arc(sx, sy, p.hitR * 0.5, 0, TAU); ctx.fill();
}
