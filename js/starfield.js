// starfield.js — parallax star background (3 layers).

import { rng, TAU } from './utils.js';
import { CFG } from './config.js';

const LAYERS = [
  { count: 70, speed: 0.12, size: 1.0, alpha: 0.35 },
  { count: 50, speed: 0.28, size: 1.6, alpha: 0.55 },
  { count: 26, speed: 0.5,  size: 2.4, alpha: 0.9 },
];

let layers = [];

export function initStarfield() {
  const { w, h } = CFG.arena;
  layers = LAYERS.map((cfg) => {
    const stars = [];
    for (let i = 0; i < cfg.count; i++) {
      stars.push({
        x: rng() * w, y: rng() * h,
        tw: rng() * TAU,
      });
    }
    return { ...cfg, stars };
  });
}

// camX/camY = camera top-left in world space; for parallax we offset by layer speed.
export function drawStarfield(ctx, camX, camY, W, H, time) {
  const { w, h } = CFG.arena;
  for (const layer of layers) {
    const ox = -(camX * layer.speed) % w;
    const oy = -(camY * layer.speed) % h;
    ctx.fillStyle = `rgba(180,210,255,${layer.alpha})`;
    for (const s of layer.stars) {
      let x = (s.x + ox) % w; if (x < 0) x += w;
      let y = (s.y + oy) % h; if (y < 0) y += h;
      // tile across the visible viewport
      if (x > W || y > H) continue;
      const tw = 0.6 + 0.4 * Math.sin(time * 2 + s.tw);
      ctx.globalAlpha = layer.alpha * tw;
      ctx.fillRect(x, y, layer.size, layer.size);
    }
  }
  ctx.globalAlpha = 1;
}
