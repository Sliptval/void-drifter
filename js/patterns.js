// patterns.js — reusable bullet-hell emitters. Enemies/bosses call these.
// All spawn warm "danger"-colored enemy bullets via spawnEnemyBullet.

import { spawnEnemyBullet } from './bullets.js';
import { TAU } from './utils.js';
import { Sfx } from './audio.js';

// Single/aimed shot at a target point.
export function aimed(state, x, y, tx, ty, speed, opts = {}) {
  const a = Math.atan2(ty - y, tx - x);
  spawnEnemyBullet(state, x, y, Math.cos(a) * speed, Math.sin(a) * speed, opts);
  Sfx.enemyShoot();
}

// Tight spread of K bullets aimed at target (fan toward player).
export function fan(state, x, y, tx, ty, count, spread, speed, opts = {}) {
  const base = Math.atan2(ty - y, tx - x);
  const start = base - spread / 2;
  const step = count > 1 ? spread / (count - 1) : 0;
  for (let i = 0; i < count; i++) {
    const a = start + step * i;
    spawnEnemyBullet(state, x, y, Math.cos(a) * speed, Math.sin(a) * speed, opts);
  }
  Sfx.enemyShoot();
}

// Full radial ring of N bullets.
export function radial(state, x, y, count, speed, offset = 0, opts = {}) {
  const step = TAU / count;
  for (let i = 0; i < count; i++) {
    const a = offset + step * i;
    spawnEnemyBullet(state, x, y, Math.cos(a) * speed, Math.sin(a) * speed, opts);
  }
  Sfx.enemyShoot();
}

// Spiral: caller maintains a running angle and advances it each shot.
export function spiral(state, x, y, angle, arms, speed, opts = {}) {
  const step = TAU / arms;
  for (let i = 0; i < arms; i++) {
    const a = angle + step * i;
    spawnEnemyBullet(state, x, y, Math.cos(a) * speed, Math.sin(a) * speed, opts);
  }
}

// Wall/stream: a line of bullets sweeping toward target with a gap "window".
export function wall(state, x, y, tx, ty, count, spread, speed, gapIndex, gapSize, opts = {}) {
  const base = Math.atan2(ty - y, tx - x);
  const start = base - spread / 2;
  const step = spread / (count - 1);
  for (let i = 0; i < count; i++) {
    if (gapIndex >= 0 && Math.abs(i - gapIndex) < gapSize) continue;  // leave a dodge window
    const a = start + step * i;
    spawnEnemyBullet(state, x, y, Math.cos(a) * speed, Math.sin(a) * speed, opts);
  }
  Sfx.enemyShoot();
}
