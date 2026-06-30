// ui.js — HUD, title, upgrade cards, pause, game over (RU). Drawing + hit-testing.

import { CFG, VERSION, DIFFICULTY, DIFFICULTY_ORDER } from './config.js';
import { fmtTime, clamp, TAU } from './utils.js';
import { isMuted } from './audio.js';
import { waveDuration } from './enemies.js';
import { hasYandex } from './yandex.js';

const RARITY_RU = { common: 'ОБЫЧНОЕ', rare: 'РЕДКОЕ', epic: 'ЭПИК' };

// ---------- HUD ----------
export function drawHUD(g) {
  const ctx = g.ctx, W = g.W, p = g.player;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  // HP bar (top-left)
  const hpW = 240, hpH = 16, x = 18, y = 18;
  bar(ctx, x, y, hpW, hpH, p.hp / p.maxHp, '#ff4d6d', '#3a0d18');
  ctx.fillStyle = '#fff'; ctx.font = 'bold 12px monospace';
  ctx.fillText(`HP ${Math.ceil(p.hp)}/${Math.round(p.maxHp)}`, x + 8, y + 12);

  // shield pips
  if (p.shield.max > 0) {
    for (let i = 0; i < p.shield.max; i++) {
      ctx.fillStyle = i < p.shield.cur ? '#78c8ff' : 'rgba(120,200,255,0.25)';
      ctx.beginPath(); ctx.arc(x + 8 + i * 16, y + hpH + 12, 5, 0, TAU); ctx.fill();
    }
  }

  // Wave + countdown (top center)
  ctx.textAlign = 'center';
  ctx.fillStyle = g.isBossWave ? '#ff8ec8' : '#bff7ff';
  ctx.font = 'bold 18px monospace';
  ctx.fillText(g.isBossWave ? `ВОЛНА ${g.wave} — БОСС` : `ВОЛНА ${g.wave}`, W / 2, 24);
  if (!g.isBossWave) {
    const total = waveDuration(g.wave);
    const frac = clamp(g.waveTime / total, 0, 1);
    bar(ctx, W / 2 - 110, 32, 220, 6, frac, '#7CFFB2', 'rgba(20,40,30,0.6)');
    ctx.fillStyle = '#cfe'; ctx.font = 'bold 12px monospace';
    ctx.fillText(`${Math.ceil(g.waveTime)} c`, W / 2, 52);
  }

  // Score + time (top-right)
  ctx.textAlign = 'right'; ctx.fillStyle = '#fff'; ctx.font = 'bold 18px monospace';
  ctx.fillText(g.score.toLocaleString(), W - 18, 26);
  ctx.font = '12px monospace'; ctx.fillStyle = '#9ab';
  ctx.fillText(`ВРЕМЯ ${fmtTime(g.runTime)}  РЕКОРД ${g.highscore.toLocaleString()}`, W - 18, 44);

  // Combo (center-ish)
  if (g.combo > 1) {
    const mult = 1 + Math.min(CFG.combo.maxMult, g.combo * CFG.combo.multStep);
    const t = clamp(g.comboTimer / CFG.combo.timeout, 0, 1);
    const hue = clamp(g.combo * 8, 0, 60);
    ctx.textAlign = 'center';
    ctx.fillStyle = `hsl(${50 - hue}, 100%, 65%)`;
    ctx.font = `bold ${16 + Math.min(20, g.combo)}px monospace`;
    ctx.fillText(`${g.combo}x  (${mult.toFixed(1)}×)`, W / 2, 84);
    bar(ctx, W / 2 - 60, 90, 120, 4, t, '#ffd34d', 'rgba(0,0,0,0.3)');
  }

  // Dash charges (bottom-left)
  ctx.textAlign = 'left'; ctx.fillStyle = '#9ab'; ctx.font = '12px monospace';
  ctx.fillText('РЫВОК', 18, g.H - 24);
  for (let i = 0; i < p.dash.maxCharges; i++) {
    const ready = i < p.dash.charges;
    ctx.fillStyle = ready ? '#46f0ff' : 'rgba(70,240,255,0.2)';
    ctx.fillRect(78 + i * 22, g.H - 34, 16, 10);
  }
  if (p.dash.charges < p.dash.maxCharges) {
    const t = p.dash.rechargeTimer / p.dash.cooldown;
    bar(ctx, 78, g.H - 20, 16 + (p.dash.maxCharges - 1) * 22, 4, t, '#46f0ff', 'rgba(0,0,0,0.3)');
  }

  if (isMuted()) { ctx.fillStyle = '#f66'; ctx.textAlign = 'center'; ctx.fillText('БЕЗ ЗВУКА (M)', g.W / 2, g.H - 16); }

  // Boss HP bar
  if (g.boss && !g.boss.entering) {
    const bw = Math.min(560, g.W - 80), bx = (g.W - bw) / 2, by = g.H - 70;
    ctx.textAlign = 'center'; ctx.fillStyle = '#ff8ec8'; ctx.font = 'bold 13px monospace';
    ctx.fillText('◆ НАДЗИРАТЕЛЬ ◆', g.W / 2, by - 6);
    bar(ctx, bx, by, bw, 14, g.boss.hp / g.boss.maxHp, '#ff2e88', '#2a0a18');
  }
}

function bar(ctx, x, y, w, h, frac, fg, bg) {
  frac = clamp(frac, 0, 1);
  ctx.fillStyle = bg; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = fg; ctx.fillRect(x, y, w * frac, h);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

// ---------- Banner (wave start / clear) ----------
export function drawBanner(g) {
  const ctx = g.ctx;
  const a = clamp(g.bannerTimer * 1.4, 0, 1);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.globalAlpha = a;
  ctx.shadowColor = '#46f0ff'; ctx.shadowBlur = 20;
  ctx.fillStyle = '#bff7ff'; ctx.font = 'bold 40px monospace';
  ctx.fillText(g.bannerText, g.W / 2, g.H * 0.26);
  ctx.restore();
}

// ---------- Difficulty selector (shared layout for draw + hit-test) ----------
const DIFF_BTN = { w: 150, h: 46, gap: 14 };

export function difficultyLayout(g) {
  const order = DIFFICULTY_ORDER;
  const n = order.length;
  const totalW = n * DIFF_BTN.w + (n - 1) * DIFF_BTN.gap;
  const x0 = (g.W - totalW) / 2;
  const y = g.H / 2 - 26;
  return order.map((key, i) => ({
    key, def: DIFFICULTY[key],
    x: x0 + i * (DIFF_BTN.w + DIFF_BTN.gap), y, w: DIFF_BTN.w, h: DIFF_BTN.h,
  }));
}

// Returns the difficulty key under the cursor, or null.
export function difficultyAt(g, mx, my) {
  for (const r of difficultyLayout(g)) {
    if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) return r.key;
  }
  return null;
}

// ---------- Title ----------
export function drawMenu(g) {
  const ctx = g.ctx, W = g.W, H = g.H;
  bgPanel(ctx, W, H, 0.0);
  ctx.textAlign = 'center';
  const t = g.time;
  ctx.save();
  ctx.shadowColor = '#46f0ff'; ctx.shadowBlur = 24;
  ctx.fillStyle = '#bff7ff';
  ctx.font = 'bold 64px monospace';
  ctx.fillText('VOID DRIFTER', W / 2, H / 2 - 130);
  ctx.restore();
  ctx.fillStyle = '#7fd4ff'; ctx.font = '16px monospace';
  ctx.fillText('космический буллет-хелл по волнам', W / 2, H / 2 - 94);

  // difficulty selector
  ctx.fillStyle = '#9ab'; ctx.font = 'bold 14px monospace';
  ctx.fillText('СЛОЖНОСТЬ  (1/2/3 или ◀ ▶)', W / 2, H / 2 - 42);
  for (const r of difficultyLayout(g)) {
    const sel = g.difficulty === r.key;
    ctx.fillStyle = sel ? 'rgba(70,240,255,0.14)' : 'rgba(255,255,255,0.04)';
    roundRect(ctx, r.x, r.y, r.w, r.h, 8); ctx.fill();
    ctx.lineWidth = sel ? 2.5 : 1;
    ctx.strokeStyle = sel ? r.def.color : 'rgba(255,255,255,0.18)';
    roundRect(ctx, r.x, r.y, r.w, r.h, 8); ctx.stroke();
    ctx.fillStyle = sel ? r.def.color : '#8aa';
    ctx.font = sel ? 'bold 18px monospace' : '16px monospace';
    ctx.fillText(r.def.name, r.x + r.w / 2, r.y + r.h / 2 + 6);
  }

  const pulse = 0.6 + 0.4 * Math.sin(t * 3);
  ctx.fillStyle = `rgba(255,255,255,${pulse})`;
  ctx.font = 'bold 22px monospace';
  ctx.fillText('▶  КЛИК или ENTER — ИГРАТЬ', W / 2, H / 2 + 56);

  ctx.fillStyle = '#9ab'; ctx.font = '13px monospace';
  const lines = [
    'WASD / стрелки — движение      ПРОБЕЛ — рывок',
    'Стрельба по ближайшему врагу — автоматически. Уворачивайся!',
    'Переживи волну → выбери 1 из 3 улучшений (клик или 1/2/3, R — реролл)',
    'ESC / P — пауза      M — звук',
  ];
  lines.forEach((l, i) => ctx.fillText(l, W / 2, H / 2 + 98 + i * 22));

  ctx.fillStyle = '#ffd34d'; ctx.font = 'bold 16px monospace';
  ctx.fillText(`РЕКОРД: ${g.highscore.toLocaleString()}`, W / 2, H / 2 + 204);

  // Version tag — bottom-right corner.
  ctx.textAlign = 'right';
  ctx.fillStyle = '#566'; ctx.font = '12px monospace';
  ctx.fillText(`v${VERSION}`, W - 12, H - 12);
}

// ---------- Upgrade screen ----------
const CARD = { w: 220, h: 300, gap: 28 };

export function cardLayout(g) {
  const n = g.choices.length;
  const totalW = n * CARD.w + (n - 1) * CARD.gap;
  const x0 = (g.W - totalW) / 2;
  const y = (g.H - CARD.h) / 2;
  const rects = [];
  for (let i = 0; i < n; i++) rects.push({ x: x0 + i * (CARD.w + CARD.gap), y, w: CARD.w, h: CARD.h });
  return rects;
}

export function rerollRect(g) {
  return { x: g.W / 2 - 90, y: (g.H + CARD.h) / 2 + 24, w: 180, h: 40 };
}

export function adBonusRect(g) {
  return { x: g.W / 2 - 150, y: (g.H + CARD.h) / 2 + 74, w: 300, h: 40 };
}

export function cardAt(g, mx, my) {
  const rects = cardLayout(g);
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i];
    if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) return i;
  }
  return -1;
}
export function rerollAt(g, mx, my) {
  if (g.rerolls <= 0) return false;
  return inRect(rerollRect(g), mx, my);
}
export function adBonusAt(g, mx, my) {
  if (g.adBonusUsed || !hasYandex()) return false;
  return inRect(adBonusRect(g), mx, my);
}
function inRect(r, mx, my) { return mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h; }

export function drawLevelUp(g) {
  const ctx = g.ctx;
  bgPanel(ctx, g.W, g.H, 0.7);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff'; ctx.font = 'bold 28px monospace';
  const title = g.bonusPicks > 0 ? 'БОНУСНОЕ УЛУЧШЕНИЕ' : `ВОЛНА ${g.wave} ПРОЙДЕНА — ВЫБЕРИ УЛУЧШЕНИЕ`;
  ctx.fillText(title, g.W / 2, (g.H - CARD.h) / 2 - 30);

  const rects = cardLayout(g);
  const hover = (g._mx != null) ? cardAt(g, g._mx, g._my) : -1;
  for (let i = 0; i < rects.length; i++) drawCard(ctx, rects[i], g.choices[i], i, hover === i);

  // reroll
  const rr = rerollRect(g);
  button(ctx, rr, g.rerolls > 0, `⟳ РЕРОЛЛ (R) — осталось ${g.rerolls}`, '#7fd4ff');

  // rewarded-ad bonus pick (only on Yandex, once per screen)
  if (!g.adBonusUsed && hasYandex()) {
    const ab = adBonusRect(g);
    button(ctx, ab, true, '🎁 +1 УЛУЧШЕНИЕ ЗА РЕКЛАМУ', '#ffd34d');
  }
}

function drawCard(ctx, r, choice, idx, hover) {
  ctx.save();
  if (hover) { ctx.translate(0, -8); }
  ctx.fillStyle = 'rgba(10,14,26,0.95)';
  roundRect(ctx, r.x, r.y, r.w, r.h, 12); ctx.fill();
  ctx.strokeStyle = choice.color; ctx.lineWidth = hover ? 4 : 2.5;
  ctx.shadowColor = choice.color; ctx.shadowBlur = hover ? 24 : 10;
  roundRect(ctx, r.x, r.y, r.w, r.h, 12); ctx.stroke();
  ctx.shadowBlur = 0;

  const cx = r.x + r.w / 2;
  // rarity tag
  ctx.textAlign = 'center';
  ctx.fillStyle = choice.color; ctx.font = 'bold 12px monospace';
  ctx.fillText(RARITY_RU[choice.rarity] || choice.rarity.toUpperCase(), cx, r.y + 26);

  // icon
  drawIcon(ctx, choice.icon, cx, r.y + 96, 34, choice.color);

  // name
  ctx.fillStyle = '#fff'; ctx.font = 'bold 18px monospace';
  wrapText(ctx, choice.name, cx, r.y + 168, r.w - 24, 22);

  // desc
  ctx.fillStyle = '#9ab'; ctx.font = '13px monospace';
  wrapText(ctx, choice.desc, cx, r.y + 214, r.w - 28, 18);

  // number key
  ctx.fillStyle = choice.color; ctx.font = 'bold 20px monospace';
  ctx.fillText(`[${idx + 1}]`, cx, r.y + r.h - 18);
  ctx.restore();
}

function button(ctx, r, enabled, label, color) {
  ctx.fillStyle = enabled ? 'rgba(120,200,255,0.15)' : 'rgba(120,120,120,0.1)';
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.strokeStyle = enabled ? color : '#555'; ctx.lineWidth = 2;
  ctx.strokeRect(r.x, r.y, r.w, r.h);
  ctx.fillStyle = enabled ? '#fff' : '#777'; ctx.font = 'bold 15px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(label, r.x + r.w / 2, r.y + 26);
}

// ---------- Pause / Game over ----------
export function drawPause(g) {
  const ctx = g.ctx;
  bgPanel(ctx, g.W, g.H, 0.6);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff'; ctx.font = 'bold 44px monospace';
  ctx.fillText('ПАУЗА', g.W / 2, g.H / 2 - 10);
  ctx.fillStyle = '#9ab'; ctx.font = '16px monospace';
  ctx.fillText('ESC / P / клик — продолжить', g.W / 2, g.H / 2 + 30);
}

export function reviveRect(g) {
  return { x: g.W / 2 - 200, y: g.H / 2 + 70, w: 400, h: 46 };
}
export function reviveAt(g, mx, my) {
  return inRect(reviveRect(g), mx, my);
}

export function drawGameOver(g) {
  const ctx = g.ctx;
  bgPanel(ctx, g.W, g.H, 0.78);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff5a6a'; ctx.font = 'bold 56px monospace';
  ctx.fillText('ИГРА ОКОНЧЕНА', g.W / 2, g.H / 2 - 90);

  ctx.fillStyle = g.mods.color; ctx.font = 'bold 15px monospace';
  ctx.fillText(`СЛОЖНОСТЬ: ${g.mods.name}`, g.W / 2, g.H / 2 - 58);

  ctx.font = 'bold 24px monospace'; ctx.fillStyle = '#fff';
  ctx.fillText(`ОЧКИ  ${g.score.toLocaleString()}`, g.W / 2, g.H / 2 - 30);
  ctx.font = '16px monospace'; ctx.fillStyle = '#9ab';
  ctx.fillText(`Волна ${g.wave}   Время ${fmtTime(g.runTime)}   Лучшее комбо ${g.comboMax}x`, g.W / 2, g.H / 2 + 4);

  if (g.newHighscore) {
    const pulse = 0.5 + 0.5 * Math.sin(g.time * 6);
    ctx.fillStyle = `rgba(255,211,77,${pulse})`; ctx.font = 'bold 22px monospace';
    ctx.fillText('★ НОВЫЙ РЕКОРД ★', g.W / 2, g.H / 2 + 40);
  } else {
    ctx.fillStyle = '#ffd34d'; ctx.font = '16px monospace';
    ctx.fillText(`Рекорд ${g.highscore.toLocaleString()}`, g.W / 2, g.H / 2 + 40);
  }

  // rewarded-ad revive button
  if (g.canRevive()) {
    const rr = reviveRect(g);
    const pulse = 0.7 + 0.3 * Math.sin(g.time * 4);
    ctx.fillStyle = `rgba(120,255,200,${0.12 + 0.06 * pulse})`;
    ctx.fillRect(rr.x, rr.y, rr.w, rr.h);
    ctx.strokeStyle = '#78ffc8'; ctx.lineWidth = 2;
    ctx.strokeRect(rr.x, rr.y, rr.w, rr.h);
    ctx.fillStyle = '#dfffe9'; ctx.font = 'bold 18px monospace';
    ctx.fillText('▶ СМОТРЕТЬ РЕКЛАМУ — ПРОДОЛЖИТЬ', g.W / 2, rr.y + 29);
    ctx.fillStyle = '#9ab'; ctx.font = '14px monospace';
    ctx.fillText('или клик / ENTER — в меню', g.W / 2, rr.y + 78);
  } else {
    const pulse = 0.6 + 0.4 * Math.sin(g.time * 3);
    ctx.fillStyle = `rgba(255,255,255,${pulse})`; ctx.font = 'bold 20px monospace';
    ctx.fillText('КЛИК или ENTER — в меню', g.W / 2, g.H / 2 + 110);
  }
}

export function drawFps(g) {
  const ctx = g.ctx;
  ctx.textAlign = 'left'; ctx.fillStyle = '#0f0'; ctx.font = '12px monospace';
  const ents = g.enemies.length, pb = g.pBullets.length, eb = g.eBullets.length;
  ctx.fillText(`FPS ${g.fps}  E:${ents} PB:${pb} EB:${eb}`, 18, g.H - 50);
}

// ---------- helpers ----------
function bgPanel(ctx, W, H, alpha) {
  ctx.fillStyle = `rgba(3,4,10,${alpha})`;
  ctx.fillRect(0, 0, W, H);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapText(ctx, text, cx, y, maxW, lh) {
  const words = text.split(' ');
  let line = '', yy = y;
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) { ctx.fillText(line, cx, yy); line = w; yy += lh; }
    else line = test;
  }
  ctx.fillText(line, cx, yy);
}

// Simple neon icon shapes per upgrade.
function drawIcon(ctx, icon, cx, cy, s, color) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = color; ctx.fillStyle = color;
  ctx.lineWidth = 3; ctx.lineJoin = 'round';
  ctx.shadowColor = color; ctx.shadowBlur = 12;
  ctx.beginPath();
  switch (icon) {
    case 'bolt': ctx.moveTo(-6, -s); ctx.lineTo(4, -4); ctx.lineTo(-2, -2); ctx.lineTo(6, s); ctx.lineTo(-4, 2); ctx.lineTo(2, 0); ctx.closePath(); ctx.fill(); break;
    case 'heart': ctx.moveTo(0, s * 0.7); ctx.bezierCurveTo(-s, -2, -s * 0.4, -s, 0, -s * 0.3); ctx.bezierCurveTo(s * 0.4, -s, s, -2, 0, s * 0.7); ctx.fill(); break;
    case 'fan': for (let i = -2; i <= 2; i++) { ctx.moveTo(0, s); ctx.lineTo(Math.sin(i * 0.3) * s, -s); } ctx.stroke(); break;
    case 'shield': ctx.moveTo(0, -s); ctx.lineTo(s * 0.8, -s * 0.5); ctx.lineTo(s * 0.6, s * 0.6); ctx.lineTo(0, s); ctx.lineTo(-s * 0.6, s * 0.6); ctx.lineTo(-s * 0.8, -s * 0.5); ctx.closePath(); ctx.stroke(); break;
    case 'drone': ctx.arc(0, 0, s * 0.4, 0, TAU); ctx.moveTo(s, 0); ctx.arc(0, 0, s, 0, TAU); ctx.stroke(); break;
    case 'spiral': for (let a = 0; a < TAU * 2; a += 0.3) { const rr = a * 3; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.stroke(); break;
    case 'burst': for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * s, Math.sin(a) * s); } ctx.stroke(); break;
    case 'chain': for (let i = 0; i < 3; i++) { ctx.moveTo(-s + i * s, -s); ctx.lineTo(-s * 0.4 + i * s, s); } ctx.stroke(); break;
    case 'drop': ctx.moveTo(0, -s); ctx.bezierCurveTo(s, 0, s * 0.7, s, 0, s); ctx.bezierCurveTo(-s * 0.7, s, -s, 0, 0, -s); ctx.fill(); break;
    case 'arrow': ctx.moveTo(-s, 0); ctx.lineTo(s, 0); ctx.moveTo(s, 0); ctx.lineTo(s * 0.3, -s * 0.5); ctx.moveTo(s, 0); ctx.lineTo(s * 0.3, s * 0.5); ctx.stroke(); break;
    default: // generic gem
      ctx.moveTo(0, -s); ctx.lineTo(s, 0); ctx.lineTo(0, s); ctx.lineTo(-s, 0); ctx.closePath(); ctx.stroke();
  }
  ctx.restore();
}
