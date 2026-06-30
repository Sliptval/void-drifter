// game.js — game state, wave machine, collisions (spatial grid), score, upgrades.

import { CFG, DIFFICULTY, DIFFICULTY_ORDER } from './config.js';
import { clamp, dist2 } from './utils.js';
import { Input } from './input.js';
import { FX } from './effects.js';
import { Particles } from './particles.js';
import { Sfx, toggleMute } from './audio.js';
import { initStarfield, drawStarfield } from './starfield.js';
import {
  createPlayer, updatePlayer, drawPlayer, hurtPlayer, healPlayer,
} from './player.js';
import {
  updateSpawner, updateEnemies, drawEnemies, releaseEnemy, onEnemyDeath,
  spawnBoss, updateBoss, drawBoss, waveDuration, waveDifficulty,
} from './enemies.js';
import { updateBullets, drawBullets, releasePlayerBullet, releaseEnemyBullet } from './bullets.js';
import { generateChoices, applyChoice } from './upgrades.js';
import { showRewardedVideo, hasYandex } from './yandex.js';
import * as UI from './ui.js';

const A = CFG.arena;
const HS_KEY = 'voidDrifter.highscore';
const DIFF_KEY = 'voidDrifter.difficulty';

export const Game = {
  scene: 'menu',
  ctx: null, W: 0, H: 0, camX: 0, camY: 0,
  player: null,
  enemies: [], pBullets: [], eBullets: [],
  runTime: 0, time: 0,
  spawnTimer: 0,
  // waves
  wave: 1, waveTime: 0, isBossWave: false, eDmgMult: 1,
  boss: null, bossCount: 0,
  score: 0, scoreAcc: 0, combo: 0, comboTimer: 0, comboMax: 0,
  rerolls: 0,
  choices: [], bonusPicks: 0, adBonusUsed: false,
  revivesUsed: 0, adActive: false,
  bannerText: '', bannerTimer: 0,
  difficulty: 'normal', mods: DIFFICULTY.normal,
  highscore: 0,
  newHighscore: false,
  grid: null,
  fps: 0, _fpsAcc: 0, _fpsFrames: 0,

  init(ctx, W, H) {
    this.ctx = ctx; this.W = W; this.H = H;
    this.highscore = +(localStorage.getItem(HS_KEY) || 0);
    const savedDiff = localStorage.getItem(DIFF_KEY);
    if (savedDiff && DIFFICULTY[savedDiff]) this.setDifficulty(savedDiff);
    initStarfield();
    this.initGrid();
    this.scene = 'menu';
    Input.onPress((k) => this.onKey(k));
  },

  resize(W, H) { this.W = W; this.H = H; },

  initGrid() {
    const cell = 80;
    const cols = Math.ceil(A.w / cell) + 1;
    const rows = Math.ceil(A.h / cell) + 1;
    const cells = new Array(cols * rows);
    for (let i = 0; i < cells.length; i++) cells[i] = [];
    this.grid = { cell, cols, rows, cells };
  },

  // Switch difficulty preset (persisted); applied to the next run that starts.
  setDifficulty(key) {
    if (!DIFFICULTY[key]) return;
    this.difficulty = key;
    this.mods = DIFFICULTY[key];
    localStorage.setItem(DIFF_KEY, key);
  },

  // Advance to the next difficulty in the menu (left/right cycling).
  cycleDifficulty(dir) {
    const i = DIFFICULTY_ORDER.indexOf(this.difficulty);
    const n = DIFFICULTY_ORDER.length;
    this.setDifficulty(DIFFICULTY_ORDER[(i + dir + n) % n]);
  },

  startRun() {
    this.player = createPlayer(this.mods);
    this.enemies.length = 0; this.pBullets.length = 0; this.eBullets.length = 0;
    this.runTime = 0;
    this.boss = null; this.bossCount = 0;
    this.score = 0; this.scoreAcc = 0; this.combo = 0; this.comboTimer = 0; this.comboMax = 0;
    this.rerolls = Math.max(0, CFG.upgrades.rerollsPerRun + this.mods.rerollBonus);
    this.bonusPicks = 0; this.adBonusUsed = false;
    this.revivesUsed = 0; this.adActive = false;
    this.bannerText = ''; this.bannerTimer = 0;
    this.newHighscore = false;
    Particles.reset(); FX.reset();
    this.startWave(1);
  },

  // ===== waves =====
  startWave(n) {
    this.wave = n;
    this.eDmgMult = waveDifficulty(n).dmg;   // enemy bullet damage scales with wave
    this.isBossWave = (n % CFG.wave.bossEvery === 0);
    this.spawnTimer = 0.3;
    this.scene = 'play';
    if (this.isBossWave) {
      this.waveTime = 0; // boss waves end on boss death, not a timer
      spawnBoss(this);
      this.bossCount++;
      this.banner(`БОСС! ВОЛНА ${n}`, 1.8);
    } else {
      this.waveTime = waveDuration(n);
      this.banner(`ВОЛНА ${n}`, 1.4);
    }
  },

  // Wave finished: clear the field, reward, then open the upgrade screen.
  endWave() {
    this.sweepField();
    healPlayer(this.player, CFG.wave.clearHeal);
    this.addScore(CFG.score.waveClear);
    this.banner(`ВОЛНА ${this.wave} ПРОЙДЕНА`, 1.8);
    Sfx.levelUp();
    this.openUpgrade();
  },

  // Poof all enemies + enemy bullets (breather between waves / on revive).
  sweepField() {
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      Particles.burst(e.x, e.y, 6, e.color, 220, 3, 0.4);
    }
    this.enemies.length = 0;
    this.eBullets.length = 0;
    this.boss = null;
  },

  banner(text, time) { this.bannerText = text; this.bannerTimer = time; },

  openUpgrade() {
    this.bonusPicks = 0;
    this.adBonusUsed = false;
    this.choices = generateChoices(this.player);
    this.scene = 'levelup';
  },

  onKey(k) {
    if (k === 'mute') { toggleMute(); return; }
    if (k === 'fps') { CFG.flags.debugFps = !CFG.flags.debugFps; return; }

    if (this.scene === 'menu') {
      if (k === 'enter' || k === 'dash') this.startRun();
      else if (k === 'left') this.cycleDifficulty(-1);
      else if (k === 'right') this.cycleDifficulty(1);
      else if (k === '1') this.setDifficulty('easy');
      else if (k === '2') this.setDifficulty('normal');
      else if (k === '3') this.setDifficulty('hard');
    } else if (this.scene === 'play') {
      if (k === 'pause') this.scene = 'pause';
    } else if (this.scene === 'pause') {
      if (k === 'pause') this.scene = 'play';
    } else if (this.scene === 'levelup') {
      if (k === '1') this.choose(0);
      else if (k === '2') this.choose(1);
      else if (k === '3') this.choose(2);
      else if (k === 'reroll') this.reroll();
    } else if (this.scene === 'gameover') {
      if (k === 'enter' || k === 'dash') this.scene = 'menu';
    }
  },

  // Mouse clicks routed from main.js
  onClick(mx, my) {
    if (this.adActive) return;
    if (this.scene === 'menu') {
      const d = UI.difficultyAt(this, mx, my);
      if (d) { this.setDifficulty(d); return; }
      this.startRun();
      return;
    }
    if (this.scene === 'gameover') {
      if (this.canRevive() && UI.reviveAt(this, mx, my)) { this.requestRevive(); return; }
      this.scene = 'menu'; return;
    }
    if (this.scene === 'levelup') {
      const idx = UI.cardAt(this, mx, my);
      if (idx >= 0) { this.choose(idx); return; }
      if (UI.rerollAt(this, mx, my)) { this.reroll(); return; }
      if (!this.adBonusUsed && hasYandex() && UI.adBonusAt(this, mx, my)) this.requestAdBonus();
    } else if (this.scene === 'pause') {
      this.scene = 'play';
    }
  },

  choose(i) {
    if (i >= this.choices.length) return;
    applyChoice(this.player, this.choices[i]);
    if (this.bonusPicks > 0) {            // extra pick from a rewarded ad
      this.bonusPicks--;
      this.choices = generateChoices(this.player);
      return;
    }
    this.startWave(this.wave + 1);
  },

  reroll() {
    if (this.rerolls <= 0) return;
    this.rerolls--;
    this.choices = generateChoices(this.player);
  },

  // ===== rewarded ads =====
  canRevive() { return this.revivesUsed < CFG.ads.maxRevives && hasYandex(); },

  requestRevive() {
    if (!this.canRevive() || this.adActive) return;
    showRewardedVideo({
      onOpen: () => { this.adActive = true; },
      onRewarded: () => { this.doRevive(); },
      onClose: () => { this.adActive = false; },
      onError: () => { this.adActive = false; },
    });
  },

  doRevive() {
    this.revivesUsed++;
    const p = this.player;
    p.alive = true;
    p.hp = Math.min(p.maxHp, CFG.ads.reviveHeal);
    p.iframes = 2.2;
    this.sweepField();
    FX.hitFlash(0.4, '120,255,200');
    Sfx.levelUp();
    // resume current wave; give a fresh timer on normal waves
    if (this.isBossWave) this.startWave(this.wave);
    else { this.waveTime = waveDuration(this.wave); this.scene = 'play'; }
  },

  requestAdBonus() {
    if (this.adBonusUsed || this.adActive || !hasYandex()) return;
    showRewardedVideo({
      onOpen: () => { this.adActive = true; },
      onRewarded: () => {
        this.adBonusUsed = true;
        this.bonusPicks += 1;
        this.choices = generateChoices(this.player);
      },
      onClose: () => { this.adActive = false; },
      onError: () => { this.adActive = false; },
    });
  },

  addScore(base) {
    const mult = 1 + Math.min(CFG.combo.maxMult, this.combo * CFG.combo.multStep);
    this.score += Math.round(base * mult);
  },

  onKill(e) {
    this.combo++; this.comboTimer = CFG.combo.timeout;
    if (this.combo > this.comboMax) this.comboMax = this.combo;
    this.addScore(CFG.score.perKillBase * (e.score || 1));
    if (this.player.lifesteal > 0) healPlayer(this.player, this.player.lifesteal);
    Particles.burst(e.x, e.y, 10 + (e.r | 0), e.color, 260, 3, 0.55);
    FX.addShake(Math.min(6, e.r * 0.2));
    Sfx.enemyDeath();
    onEnemyDeath(this, e);
  },

  // ===== main update =====
  update(dt) {
    this.time += dt;
    FX.update(dt);
    if (this.bannerTimer > 0) this.bannerTimer -= dt;
    this._fpsAcc += dt; this._fpsFrames++;
    if (this._fpsAcc >= 0.5) { this.fps = Math.round(this._fpsFrames / this._fpsAcc); this._fpsAcc = 0; this._fpsFrames = 0; }

    if (this.scene === 'play' || this.scene === 'levelup' || this.scene === 'pause') {
      this.updateCamera();
    }
    if (this.scene !== 'play' || this.adActive) { Input.endFrame(); return; }

    const sdt = dt * FX.slowmo; // slow-mo affects simulation only
    this.runTime += sdt;

    // survival score
    this.scoreAcc += sdt * CFG.score.perSecond;
    if (this.scoreAcc >= 1) { const n = Math.floor(this.scoreAcc); this.score += n; this.scoreAcc -= n; }

    // combo decay
    if (this.combo > 0) { this.comboTimer -= sdt; if (this.comboTimer <= 0) this.combo = 0; }

    updateSpawner(this, sdt);
    updateEnemies(this, sdt);
    updateBoss(this, sdt);
    updatePlayer(this, sdt);
    updateBullets(this, sdt);
    Particles.update(sdt);

    this.collide();
    this.updateCamera();

    // wave timer (normal waves only; boss waves end on boss death in killBoss)
    if (!this.isBossWave && this.scene === 'play') {
      this.waveTime -= sdt;
      if (this.waveTime <= 0) this.endWave();
    }

    if (!this.player.alive) this.gameOver();

    Input.endFrame();
  },

  updateCamera() {
    const p = this.player;
    if (!p) return;
    this.camX = A.w <= this.W ? (A.w - this.W) / 2 : clamp(p.x - this.W / 2, 0, A.w - this.W);
    this.camY = A.h <= this.H ? (A.h - this.H) / 2 : clamp(p.y - this.H / 2, 0, A.h - this.H);
  },

  // ===== collisions =====
  buildGrid() {
    const { cell, cols, cells } = this.grid;
    for (let i = 0; i < cells.length; i++) cells[i].length = 0;
    const es = this.enemies;
    for (let i = 0; i < es.length; i++) {
      const e = es[i];
      const cx = clamp((e.x / cell) | 0, 0, cols - 1);
      const cy = clamp((e.y / cell) | 0, 0, this.grid.rows - 1);
      cells[cy * cols + cx].push(i);
    }
  },

  collide() {
    this.buildGrid();
    const { cell, cols, rows, cells } = this.grid;
    const es = this.enemies;
    const p = this.player;

    // --- player bullets vs enemies/boss ---
    const pb = this.pBullets;
    for (let bi = 0; bi < pb.length; bi++) {
      const b = pb[bi];
      let consumed = false;

      // boss
      if (this.boss && !this.boss.entering) {
        const boss = this.boss;
        if (dist2(b.x, b.y, boss.x, boss.y) < (boss.r + b.r) * (boss.r + b.r)) {
          this.damageBoss(b.dmg, b.x, b.y, b.crit);
          consumed = this.resolveBulletHit(b, bi, null, boss.x, boss.y);
          if (consumed) { bi--; continue; }
        }
      }

      // enemies via grid (3x3 around bullet)
      const cx = clamp((b.x / cell) | 0, 0, cols - 1);
      const cy = clamp((b.y / cell) | 0, 0, rows - 1);
      let hitEnemy = null;
      outer:
      for (let gy = cy - 1; gy <= cy + 1; gy++) {
        if (gy < 0 || gy >= rows) continue;
        for (let gx = cx - 1; gx <= cx + 1; gx++) {
          if (gx < 0 || gx >= cols) continue;
          const bucket = cells[gy * cols + gx];
          for (let k = 0; k < bucket.length; k++) {
            const e = es[bucket[k]];
            if (!e || e.hp <= 0 || e === b.lastHit) continue;
            const rr = e.r + b.r;
            if (dist2(b.x, b.y, e.x, e.y) < rr * rr) { hitEnemy = e; break outer; }
          }
        }
      }
      if (hitEnemy) {
        this.damageEnemy(hitEnemy, b.dmg, b.crit);
        consumed = this.resolveBulletHit(b, bi, hitEnemy, hitEnemy.x, hitEnemy.y);
        if (consumed) { bi--; continue; }
      }
    }

    // sweep dead enemies (effects + remove)
    for (let i = 0; i < es.length; i++) {
      if (es[i].hp <= 0) { this.onKill(es[i]); releaseEnemy(this, i); i--; }
    }
    if (this.boss && this.boss.hp <= 0) this.killBoss();

    // --- enemy bullets vs player ---
    const eb = this.eBullets;
    const phr = p.hitR;
    for (let i = 0; i < eb.length; i++) {
      const b = eb[i];
      const rr = b.r + phr;
      if (dist2(b.x, b.y, p.x, p.y) < rr * rr) {
        hurtPlayer(this, b.dmg);
        Particles.burst(b.x, b.y, 4, b.color, 140, 2, 0.3);
        FX.hitFlash(0.35, '255,80,80'); FX.addShake(8);
        releaseEnemyBullet(this, i); i--;
      }
    }

    // --- enemy bodies vs player (contact) + spikes ---
    const bodyR = p.r * 0.5;
    for (let i = 0; i < es.length; i++) {
      const e = es[i];
      const rr = e.r + bodyR;
      if (dist2(e.x, e.y, p.x, p.y) < rr * rr) {
        if (p.spikes > 0) { this.damageEnemy(e, p.spikes * 0.5, false); }
        hurtPlayer(this, e.dmg);
        if (p.iframes <= 0) FX.addShake(8);
      }
    }
    // dead from spikes
    for (let i = 0; i < es.length; i++) {
      if (es[i].hp <= 0) { this.onKill(es[i]); releaseEnemy(this, i); i--; }
    }

    // boss contact
    if (this.boss && !this.boss.entering) {
      const boss = this.boss;
      const rr = boss.r + bodyR;
      if (dist2(boss.x, boss.y, p.x, p.y) < rr * rr) hurtPlayer(this, boss.dmg);
    }
  },

  // Apply on-hit mods. Returns true if the bullet should be removed (consumed).
  resolveBulletHit(b, bi, enemy, hx, hy) {
    Sfx.hit();
    Particles.burst(hx, hy, 4, '#cfe', 160, 2, 0.25);
    if (b.crit) FX.floatText(hx, hy, Math.round(b.dmg) + '', '#fff7c2', 18);
    else if (CFG.flags.damageNumbers) FX.floatText(hx, hy, Math.round(b.dmg) + '', '#bff7ff', 14);

    if (b.explode > 0) this.areaDamage(hx, hy, b.explode, b.dmg * 0.6, b.color);
    if (b.chain > 0 && enemy) this.chainLightning(enemy, b.dmg * 0.7, b.chain);
    if (b.split > 0) this.doSplit(b, hx, hy);

    if (b.pierce > 0) { b.pierce--; b.lastHit = enemy; return false; }
    releasePlayerBullet(this, bi);
    return true;
  },

  doSplit(b, x, y) {
    const ang = Math.atan2(b.vy, b.vx);
    const sp = Math.hypot(b.vx, b.vy) * 0.9;
    for (const off of [Math.PI / 2, -Math.PI / 2]) {
      const a = ang + off;
      spawnSplit(this, x, y, Math.cos(a) * sp, Math.sin(a) * sp, b);
    }
  },

  areaDamage(x, y, radius, dmg, color) {
    Particles.burst(x, y, 14, color, 280, 4, 0.5);
    FX.addShake(5);
    const r2 = radius * radius;
    const es = this.enemies;
    for (let i = 0; i < es.length; i++) {
      const e = es[i];
      if (dist2(x, y, e.x, e.y) < r2) this.damageEnemy(e, dmg, false);
    }
    if (this.boss && dist2(x, y, this.boss.x, this.boss.y) < r2) this.damageBoss(dmg, x, y, false);
  },

  chainLightning(from, dmg, jumps) {
    let cur = from;
    const hit = new Set([cur]);
    for (let j = 0; j < jumps; j++) {
      let best = null, bd = 220 * 220;
      const es = this.enemies;
      for (let i = 0; i < es.length; i++) {
        const e = es[i];
        if (hit.has(e) || e.hp <= 0) continue;
        const d = dist2(cur.x, cur.y, e.x, e.y);
        if (d < bd) { bd = d; best = e; }
      }
      if (!best) break;
      lightningArc(cur.x, cur.y, best.x, best.y);
      this.damageEnemy(best, dmg, false);
      hit.add(best); cur = best;
    }
  },

  damageEnemy(e, dmg, crit) {
    e.hp -= dmg;
    e.flash = CFG.fx.hitFlashTime;
    e.squash = 0.7;
  },

  damageBoss(dmg, x, y, crit) {
    const b = this.boss;
    if (!b) return;
    b.hp -= dmg;
    b.flash = CFG.fx.hitFlashTime;
    FX.floatText(x, y, Math.round(dmg) + '', crit ? '#fff7c2' : '#bff7ff', crit ? 18 : 13);
  },

  killBoss() {
    const b = this.boss;
    this.addScore(CFG.score.bossKill);
    for (let i = 0; i < 60; i++) Particles.burst(b.x, b.y, 1, b.color, 420, 5, 1.0);
    Particles.burst(b.x, b.y, 40, '#fff', 360, 5, 0.8);
    FX.addShake(CFG.fx.maxShake); FX.hitFlash(0.6, '255,120,200'); FX.chromaPunch(1);
    FX.doSlowmo(CFG.fx.slowmoBoss.scale, CFG.fx.slowmoBoss.time);
    Sfx.bossDeath();
    this.boss = null;
    // boss death ends the boss wave
    this.endWave();
  },

  gameOver() {
    this.scene = 'gameover';
    if (this.score > this.highscore) {
      this.highscore = this.score; this.newHighscore = true;
      localStorage.setItem(HS_KEY, String(this.score));
    }
    FX.addShake(CFG.fx.maxShake); FX.hitFlash(0.7, '255,60,60');
  },

  // ===== render =====
  render() {
    const ctx = this.ctx;
    ctx.fillStyle = CFG.colors.bg;
    ctx.fillRect(0, 0, this.W, this.H);

    if (this.scene === 'menu') { UI.drawMenu(this); return; }

    const so = FX.shakeOffset(_off);
    const camX = this.camX - so.x, camY = this.camY - so.y;

    drawStarfield(ctx, camX, camY, this.W, this.H, this.time);
    this.drawArenaBorder(ctx, camX, camY);
    Particles.draw(ctx, camX, camY);
    drawBullets(ctx, this, camX, camY);
    drawEnemies(ctx, this, camX, camY);
    drawBoss(ctx, this, camX, camY);
    drawPlayer(ctx, this, camX, camY);
    FX.drawFloatTexts(ctx, camX, camY);

    FX.drawOverlays(ctx, this.W, this.H);
    UI.drawHUD(this);
    if (this.bannerTimer > 0) UI.drawBanner(this);

    if (this.scene === 'levelup') UI.drawLevelUp(this);
    else if (this.scene === 'pause') UI.drawPause(this);
    else if (this.scene === 'gameover') UI.drawGameOver(this);

    if (CFG.flags.debugFps) UI.drawFps(this);
  },

  drawArenaBorder(ctx, camX, camY) {
    ctx.strokeStyle = 'rgba(70,240,255,0.25)';
    ctx.lineWidth = 3;
    ctx.strokeRect(-camX, -camY, A.w, A.h);
  },
};

const _off = { x: 0, y: 0 };

// Split spawns a weakened player bullet (kept here to access bullets module).
import { spawnPlayerBulletV } from './bullets.js';
function spawnSplit(state, x, y, vx, vy, parent) {
  spawnPlayerBulletV(state, x, y, vx, vy, {
    r: parent.r * 0.8, dmg: parent.dmg * 0.5, crit: parent.crit,
    life: parent.maxLife * 0.7, pierce: 0, homing: parent.homing,
    explode: parent.explode * 0.6, chain: 0,
  });
}

// transient lightning arcs drawn as fading particles line
function lightningArc(x1, y1, x2, y2) {
  const steps = 6;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = x1 + (x2 - x1) * t + (Math.random() * 16 - 8);
    const y = y1 + (y2 - y1) * t + (Math.random() * 16 - 8);
    Particles.spawn(x, y, 0, 0, 0.18, 3, '#9fdcff', true, 1);
  }
}
