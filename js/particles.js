// particles.js — pooled particles: explosion shards, trails, sparks.

import { Pool } from './pool.js';
import { rng, TAU, glowSprite } from './utils.js';

const pool = new Pool(() => ({
  x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 0, size: 0,
  color: '#fff', drag: 0.9, glow: true,
}));

export const Particles = {
  list: [],

  reset() { this.list.length = 0; },

  spawn(x, y, vx, vy, life, size, color, glow = true, drag = 0.9) {
    if (this.list.length > 2600) return;
    const p = pool.get();
    p.x = x; p.y = y; p.vx = vx; p.vy = vy;
    p.life = life; p.max = life; p.size = size;
    p.color = color; p.glow = glow; p.drag = drag;
    this.list.push(p);
  },

  // Burst of shards in a color (enemy death, hits)
  burst(x, y, count, color, speed = 220, size = 3, life = 0.5) {
    for (let i = 0; i < count; i++) {
      const a = rng() * TAU;
      const sp = speed * (0.3 + rng() * 0.7);
      this.spawn(x, y, Math.cos(a) * sp, Math.sin(a) * sp,
        life * (0.6 + rng() * 0.6), size * (0.6 + rng() * 0.8), color);
    }
  },

  // Lightweight trail dot
  trail(x, y, color, size = 2, life = 0.3) {
    if (this.list.length > 2600) return;
    this.spawn(x, y, 0, 0, life, size, color, true, 1);
  },

  update(dt) {
    const list = this.list;
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      p.life -= dt;
      if (p.life <= 0) {
        pool.release(p);
        list[i] = list[list.length - 1];
        list.pop();
        i--;
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const d = Math.pow(p.drag, dt * 60);
      p.vx *= d; p.vy *= d;
    }
  },

  draw(ctx, camX, camY) {
    const list = this.list;
    ctx.globalCompositeOperation = 'lighter';
    const spr = glowSprite('#ffffff', 32);
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      const a = p.life / p.max;
      const sx = p.x - camX, sy = p.y - camY;
      if (p.glow) {
        ctx.globalAlpha = a * 0.9;
        ctx.fillStyle = p.color;
        const r = p.size * (0.6 + a * 1.4);
        // tinted glow via fillRect under lighter is cheap; use sprite for soft falloff
        ctx.drawImage(tint(p.color), sx - r, sy - r, r * 2, r * 2);
      } else {
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.fillRect(sx - p.size, sy - p.size, p.size * 2, p.size * 2);
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  },
};

// Cache tinted glow sprites per color (soft additive disc).
const tintCache = new Map();
function tint(color) {
  let c = tintCache.get(color);
  if (c) return c;
  c = glowSprite(color, 32);
  tintCache.set(color, c);
  return c;
}
