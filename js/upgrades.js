// upgrades.js — upgrade pool, 3-pick generation, rarity, effect application.
// Effects mutate player/weapon stats and STACK. See player.js for the fields.

import { CFG } from './config.js';
import { rng, clamp } from './utils.js';

// rarity magnitude factor
const RF = { common: 1, rare: 1.7, epic: 2.6 };

// Each def: id, name, icon (shape), cat, desc(level→string), max (stacks), apply(p, f)
// `f` is the rarity factor (RF). `p` is the player.
export const POOL = [
  // --- stats ---
  { id: 'damage', name: 'Перегрузка', icon: 'bolt', cat: 'stat', max: 99,
    desc: () => '+25% к урону пуль',
    apply: (p, f) => { p.weapon.bulletDmg *= 1 + 0.25 * f; } },
  { id: 'firerate', name: 'Скорострел', icon: 'arrows', cat: 'stat', max: 99,
    desc: () => '+18% к скорости стрельбы',
    apply: (p, f) => { p.weapon.fireRate *= 1 + 0.18 * f; } },
  { id: 'movespeed', name: 'Двигатели', icon: 'wing', cat: 'stat', max: 99,
    desc: () => '+12% к скорости движения',
    apply: (p, f) => { p.speed *= 1 + 0.12 * f; } },
  { id: 'maxhp', name: 'Усиленный корпус', icon: 'heart', cat: 'stat', max: 99,
    desc: () => '+20 к макс. HP и лечение',
    apply: (p, f) => { const add = 20 * f; p.maxHp += add; p.hp = Math.min(p.maxHp, p.hp + add + 10); } },
  { id: 'bulletspeed', name: 'Рельса', icon: 'arrow', cat: 'stat', max: 99,
    desc: () => '+20% к скорости снарядов',
    apply: (p, f) => { p.weapon.bulletSpeed *= 1 + 0.20 * f; p.weapon.bulletLife *= 1 + 0.06 * f; } },
  { id: 'crit', name: 'Прицел', icon: 'cross', cat: 'stat', max: 99,
    desc: () => '+6% крит, +25% крит-урон',
    apply: (p, f) => { p.weapon.critChance = clamp(p.weapon.critChance + 0.06 * f, 0, 0.85); p.weapon.critMult += 0.25 * f; } },

  // --- weapon mods ---
  { id: 'multishot', name: 'Мультивыстрел', icon: 'fan', cat: 'weapon', max: 8,
    desc: () => '+1 снаряд (веером)',
    apply: (p) => { p.weapon.multishot += 1; } },
  { id: 'pierce', name: 'Бронебойные', icon: 'pierce', cat: 'weapon', max: 6,
    desc: () => 'Пули пробивают +1 врага',
    apply: (p) => { p.weapon.pierce += 1; } },
  { id: 'homing', name: 'Самонаведение', icon: 'spiral', cat: 'weapon', max: 5,
    desc: () => 'Пули наводятся на врагов',
    apply: (p, f) => { p.weapon.homing += 3.2 * f; } },
  { id: 'ricochet', name: 'Рикошет', icon: 'bounce', cat: 'weapon', max: 5,
    desc: () => 'Пули отскакивают +1 раз',
    apply: (p) => { p.weapon.bounce += 1; } },
  { id: 'bigshot', name: 'Тяжёлые снаряды', icon: 'big', cat: 'weapon', max: 3,
    desc: () => 'Крупнее, сильнее, медленнее',
    apply: (p, f) => { p.weapon.big = true; p.weapon.bulletDmg *= 1 + 0.15 * f; } },
  { id: 'explosive', name: 'Взрывные', icon: 'burst', cat: 'weapon', max: 5,
    desc: () => '+взрыв по площади при попадании',
    apply: (p, f) => { p.weapon.explode += 38 * f; } },
  { id: 'split', name: 'Расщепление', icon: 'split', cat: 'weapon', max: 3,
    desc: () => 'Пули делятся при попадании',
    apply: (p) => { p.weapon.split += 1; } },
  { id: 'chain', name: 'Цепь молний', icon: 'chain', cat: 'weapon', max: 5,
    desc: () => 'Удар бьёт +1 врага рядом',
    apply: (p) => { p.weapon.chain += 1; } },
  { id: 'rearfire', name: 'Кормовой огонь', icon: 'rear', cat: 'weapon', max: 1,
    desc: () => 'Стрельба ещё и назад',
    apply: (p) => { p.weapon.rearFire = true; } },
  { id: 'sidefire', name: 'Бортовой залп', icon: 'side', cat: 'weapon', max: 1,
    desc: () => 'Стрельба ещё и по бокам',
    apply: (p) => { p.weapon.sideFire = true; } },
  { id: 'drones', name: 'Дрон', icon: 'drone', cat: 'weapon', max: 4,
    desc: () => '+1 дрон на орбите',
    apply: (p) => { p.droneCount += 1; } },

  // --- defense / utility ---
  { id: 'shield', name: 'Щит', icon: 'shield', cat: 'defense', max: 4,
    desc: () => '+1 заряд щита',
    apply: (p) => { p.shield.max += 1; p.shield.cur += 1; } },
  { id: 'dashplus', name: 'Турбо-рывок', icon: 'dash', cat: 'defense', max: 4,
    desc: () => '−перезарядка, +заряд рывка',
    apply: (p) => { p.dash.maxCharges += 1; p.dash.cooldown *= 0.82; } },
  { id: 'spikes', name: 'Шипы', icon: 'spike', cat: 'defense', max: 6,
    desc: () => 'Урон врагам при касании',
    apply: (p, f) => { p.spikes += 26 * f; } },
  { id: 'slowfield', name: 'Поле стазиса', icon: 'wave', cat: 'defense', max: 4,
    desc: () => 'Замедляет пули врагов рядом',
    apply: (p, f) => { p.slowField += 70 * f; } },
  { id: 'lifesteal', name: 'Вампиризм', icon: 'drop', cat: 'defense', max: 5,
    desc: () => 'Лечение за убийство',
    apply: (p, f) => { p.lifesteal += 1.2 * f; } },
];

const BY_ID = Object.fromEntries(POOL.map((u) => [u.id, u]));

function rollRarity() {
  const w = CFG.upgrades.rarityWeights;
  const total = w.common + w.rare + w.epic;
  let r = rng() * total;
  if ((r -= w.common) < 0) return 'common';
  if ((r -= w.rare) < 0) return 'rare';
  return 'epic';
}

// Generate 3 distinct choices the player hasn't maxed out.
export function generateChoices(player) {
  const taken = player.upgradeStacks;
  const available = POOL.filter((u) => (taken[u.id] || 0) < u.max);
  // dependency: sidefire only after rearfire-ish? keep simple, allow both.
  const picks = [];
  const bag = available.slice();
  for (let n = 0; n < 3 && bag.length; n++) {
    const idx = (rng() * bag.length) | 0;
    const def = bag.splice(idx, 1)[0];
    const rarity = rollRarity();
    picks.push({ id: def.id, name: def.name, icon: def.icon, cat: def.cat,
      desc: def.desc(taken[def.id] || 0), rarity,
      color: CFG.upgrades.rarityColor[rarity] });
  }
  return picks;
}

export function applyChoice(player, choice) {
  const def = BY_ID[choice.id];
  if (!def) return;
  def.apply(player, RF[choice.rarity]);
  player.upgradeStacks[choice.id] = (player.upgradeStacks[choice.id] || 0) + 1;
}
