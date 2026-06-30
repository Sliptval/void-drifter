// config.js — all balance numbers in one place. Tune here, not in logic.

// Game version — MAJOR.MINOR.PATCH.BUILD.
// MAJOR: large reworks / breaking saves. MINOR: new features/content.
// PATCH: balance tweaks & bug fixes. BUILD: tiny iterations during dev.
// Bump this on every release. It's the single source of truth.
export const VERSION = '0.0.0.2';

// --- Difficulty presets (multipliers applied on top of the base balance) ---
// enemyHp/enemySpeed/enemyCount scale the foes; playerMaxHp scales the ship's
// health; dmgTaken scales incoming damage; bossHp scales boss health;
// rerollBonus adjusts the number of upgrade rerolls per run.
export const DIFFICULTY = {
  easy:   { name: 'ЛЁГКИЙ',  color: '#7CFFB2', enemyHp: 0.80, enemySpeed: 0.90, enemyCount: 0.80, playerMaxHp: 1.30, dmgTaken: 0.65, bossHp: 0.80, rerollBonus: 2 },
  normal: { name: 'ОБЫЧНЫЙ', color: '#7fd4ff', enemyHp: 1.00, enemySpeed: 1.00, enemyCount: 1.00, playerMaxHp: 1.00, dmgTaken: 1.00, bossHp: 1.00, rerollBonus: 0 },
  hard:   { name: 'СЛОЖНЫЙ', color: '#ff5a52', enemyHp: 1.30, enemySpeed: 1.12, enemyCount: 1.30, playerMaxHp: 0.80, dmgTaken: 1.40, bossHp: 1.35, rerollBonus: -1 },
};
export const DIFFICULTY_ORDER = ['easy', 'normal', 'hard'];

export const CFG = {
  // --- Arena / loop ---
  arena: { w: 2000, h: 1300 },     // world size (camera follows player)
  maxDt: 0.05,                      // clamp delta-time (s) to survive tab freezes

  // --- Feature flags ---
  flags: {
    mouseAim: false,                // aim weapon with mouse instead of nearest enemy
    damageNumbers: true,            // floating damage numbers
    scanlines: true,
    vignette: true,
    chromatic: true,
    debugFps: false,                // toggle with F3
  },

  // --- Player ---
  player: {
    radius: 14,                     // visual radius
    hitRadius: 4,                   // tiny bullet-hell hitbox
    maxHp: 120,                     // a touch tankier (kid-friendly)
    speed: 330,                     // px/s
    accel: 2600,                    // movement smoothing
    friction: 12,
    iframesOnHit: 1.1,              // s of invulnerability after taking damage
    fireRate: 3.4,                  // shots/s (base)
    bulletSpeed: 740,
    bulletDmg: 13,
    bulletRadius: 4,
    bulletLife: 1.4,                // s
    critChance: 0.05,
    critMult: 2.0,
    magnetRadius: 130,              // kept for compatibility (gems removed)
    dash: {
      speed: 1150, time: 0.14, iframes: 0.24, cooldown: 1.0, charges: 1,
    },
  },

  // --- Wave system (Brotato-style) ---
  wave: {
    bossEvery: 5,                   // every Nth wave is a boss wave
    baseDuration: 22,               // s for wave 1 (survival timer)
    durationPerWave: 1.4,           // +s per wave
    durationMax: 42,                // cap wave length
    // difficulty scaling per wave (wave 1 = no scaling)
    hpScalePerWave: 0.11,           // +11% enemy hp per wave
    speedScalePerWave: 0.022,       // +2.2% enemy speed per wave
    dmgScalePerWave: 0.05,          // +5%/wave to enemy contact & bullet damage
                                    // (compounds: ~2.5x by wave 20, ~4x by wave 30)
                                    // keeps late waves threatening as the ship powers up
    // on-screen enemy target (spawner tops up toward this)
    targetBase: 7,                  // target alive enemies on wave 1
    targetPerWave: 1.1,             // +per wave
    targetMax: 34,                  // soft cap on simultaneous enemies (readability)
    spawnInterval: 0.65,            // s between top-up spawn ticks
    batchPerTick: 2,                // enemies added per top-up tick
    clearHeal: 14,                  // HP healed when a wave is cleared
    // enemy type unlocks by wave number (gentle ramp)
    unlock: { chaser: 1, swarm: 2, shooter: 4, burster: 6, spinner: 8, tank: 11 },
  },

  // --- Score / combo ---
  combo: {
    timeout: 2.8,                   // s without a kill resets combo
    perKill: 1,
    multStep: 0.04,                 // score multiplier added per combo point
    maxMult: 4.0,
  },
  score: {
    perKillBase: 10,
    perSecond: 2,
    bossKill: 1500,
    waveClear: 120,                 // bonus for surviving a wave
  },

  // --- Enemies (base stats; scaled by wave difficulty) ---
  enemies: {
    chaser:  { hp: 18,  speed: 140, radius: 13, dmg: 12, score: 1, color: '#ff5a52' },
    swarm:   { hp: 7,   speed: 220, radius: 8,  dmg: 8,  score: 1, color: '#ff8e3c' },
    shooter: { hp: 30,  speed: 90,  radius: 14, dmg: 11, score: 2, color: '#ff4fa3', fireRate: 0.55, keepDist: 340 },
    spinner: { hp: 46,  speed: 65,  radius: 17, dmg: 11, score: 3, color: '#c45bff', fireRate: 1.0 },
    burster: { hp: 26,  speed: 120, radius: 14, dmg: 11, score: 2, color: '#ff3b6b', burst: 12 },
    tank:    { hp: 200, speed: 52,  radius: 26, dmg: 18, score: 8, color: '#ff6a00' },
  },

  // --- Enemy bullets ---
  ebullet: { speed: 205, radius: 6, dmg: 9, life: 7, color: '#ff5a52' },

  // --- Wave spawner safety cap ---
  spawn: {
    margin: 60,                     // spawn distance outside arena edge
    maxEnemies: 60,                 // hard cap for perf (well below old 420)
  },

  // --- Boss (spawns on boss waves) ---
  boss: {
    hp: 2200,
    hpScalePerBoss: 0.55,           // +hp each subsequent boss
    radius: 54,
    speed: 58,
    dmg: 24,
    contactDmg: 24,
    color: '#ff2e88',
  },

  // --- Upgrades ---
  upgrades: {
    rerollsPerRun: 3,
    rarityWeights: { common: 68, rare: 26, epic: 6 },
    rarityColor: { common: '#7fd4ff', rare: '#b78bff', epic: '#ffd34d' },
  },

  // --- Rewarded ads (Yandex SDK) ---
  ads: {
    maxRevives: 1,                  // rewarded revives allowed per run
    reviveHeal: 70,                 // HP restored on revive
  },

  // --- Effects ---
  fx: {
    shakeDecay: 9,
    maxShake: 34,
    hitFlashTime: 0.07,
    slowmoBoss: { scale: 0.12, time: 0.9 },
  },

  // --- Audio ---
  audio: { master: 0.35, muted: false },

  // --- Colors ---
  colors: {
    player: '#46f0ff',
    playerBullet: '#bff7ff',
    playerBulletCore: '#ffffff',
    gem: '#7CFFB2',
    bg: '#05060d',
  },
};
