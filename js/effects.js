// effects.js — screen shake, slow-mo, vignette, scanlines, chromatic flash, floating text.

import { CFG } from './config.js';
import { clamp, rng, rgba } from './utils.js';
import { Pool, swapRemove } from './pool.js';

export const FX = {
  shake: 0,
  flash: 0,           // white screen flash 0..1 (chromatic/hit)
  flashColor: '255,80,80',
  slowmo: 1,          // time scale 1 = normal
  slowmoTarget: 1,
  slowmoTimer: 0,
  chroma: 0,          // chromatic aberration intensity 0..1
  texts: [],          // floating numbers
  _pool: new Pool(() => ({ x: 0, y: 0, vy: 0, life: 0, max: 0, text: '', color: '#fff', size: 16 })),

  reset() {
    this.shake = 0; this.flash = 0; this.slowmo = 1; this.slowmoTarget = 1;
    this.slowmoTimer = 0; this.chroma = 0; this.texts.length = 0;
  },

  addShake(amt) { this.shake = clamp(this.shake + amt, 0, CFG.fx.maxShake); },
  hitFlash(a, color) { this.flash = Math.max(this.flash, a); if (color) this.flashColor = color; },
  chromaPunch(a) { this.chroma = Math.max(this.chroma, a); },

  doSlowmo(scale, time) {
    this.slowmo = scale; this.slowmoTarget = 1; this.slowmoTimer = time;
  },

  floatText(x, y, text, color = '#fff', size = 16) {
    if (!CFG.flags.damageNumbers) return;
    if (this.texts.length > 120) return;
    const t = this._pool.get();
    t.x = x; t.y = y; t.vy = -38; t.life = 0.7; t.max = 0.7;
    t.text = text; t.color = color; t.size = size;
    this.texts.push(t);
  },

  update(dt) {
    // dt here is REAL dt (unaffected by slowmo) so fx recover in real time
    this.shake = Math.max(0, this.shake - CFG.fx.shakeDecay * dt * (this.shake));
    this.shake *= Math.exp(-CFG.fx.shakeDecay * dt);
    this.flash = Math.max(0, this.flash - dt * 6);
    this.chroma = Math.max(0, this.chroma - dt * 4);

    if (this.slowmoTimer > 0) {
      this.slowmoTimer -= dt;
      if (this.slowmoTimer <= 0) this.slowmo = 1;
    } else {
      this.slowmo += (this.slowmoTarget - this.slowmo) * Math.min(1, dt * 8);
    }

    for (let i = 0; i < this.texts.length; i++) {
      const t = this.texts[i];
      t.life -= dt;
      t.y += t.vy * dt;
      t.vy *= 0.92;
      if (t.life <= 0) { this._pool.release(t); swapRemove(this.texts, i); i--; }
    }
  },

  // Returns {x,y} screen offset to apply before drawing the world.
  shakeOffset(out) {
    if (this.shake < 0.1) { out.x = 0; out.y = 0; return out; }
    out.x = (rng() * 2 - 1) * this.shake;
    out.y = (rng() * 2 - 1) * this.shake;
    return out;
  },

  drawFloatTexts(ctx, camX, camY) {
    for (const t of this.texts) {
      const a = clamp(t.life / t.max, 0, 1);
      ctx.globalAlpha = a;
      ctx.fillStyle = t.color;
      ctx.font = `bold ${t.size}px monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(t.text, t.x - camX, t.y - camY);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  },

  // Full-screen overlays drawn in screen space (after world).
  drawOverlays(ctx, W, H) {
    if (this.flash > 0.01) {
      ctx.fillStyle = rgbaStr(this.flashColor, this.flash * 0.5);
      ctx.fillRect(0, 0, W, H);
    }
    if (CFG.flags.vignette) {
      const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.72);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,0.55)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
    if (CFG.flags.scanlines) {
      ctx.globalAlpha = 0.05;
      ctx.fillStyle = '#000';
      for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);
      ctx.globalAlpha = 1;
    }
  },
};

function rgbaStr(rgb, a) { return `rgba(${rgb},${a})`; }
