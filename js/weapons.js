'use strict';
/* ============ 武器 & 被动 & 升级池 ============ */
function svgIcon(inner) {
  return `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
}

const WEAPONS = {
  blaster: {
    name: '脉冲机炮', col: '#7ef9ff', max: 8,
    icon: svgIcon('<circle cx="24" cy="24" r="13"/><path d="M24 4v9M24 35v9M4 24h9M35 24h9"/><circle cx="24" cy="24" r="3" fill="currentColor"/>'),
    lv: [
      { dmg: 12, rate: 2.4, n: 1, p: 0 },
      { dmg: 12, rate: 2.4, n: 2, p: 0 },
      { dmg: 16, rate: 2.5, n: 2, p: 0 },
      { dmg: 16, rate: 2.9, n: 3, p: 0 },
      { dmg: 20, rate: 2.9, n: 3, p: 1 },
      { dmg: 24, rate: 3.3, n: 4, p: 1 },
      { dmg: 30, rate: 3.6, n: 4, p: 2 },
      { dmg: 36, rate: 4.0, n: 5, p: 2 },
    ],
    descs: [
      '锁定最近敌人，发射高速脉冲弹',
      '+1 弹头',
      '伤害 +33%',
      '攻速提升，+1 弹头',
      '穿透 +1，伤害提升',
      '+1 弹头，攻速提升',
      '穿透 +1，伤害大幅提升',
      '+1 弹头，全面强化',
    ],
  },
  orbs: {
    name: '离子环刃', col: '#a78bfa', max: 8,
    icon: svgIcon('<circle cx="24" cy="24" r="14" stroke-dasharray="5 6"/><circle cx="24" cy="7" r="4" fill="currentColor"/><circle cx="9" cy="31" r="4" fill="currentColor"/><circle cx="39" cy="31" r="4" fill="currentColor"/>'),
    lv: [
      { n: 2, dmg: 14, rad: 85, spd: 2.6 },
      { n: 3 },
      { dmg: 20 },
      { n: 4, rad: 95 },
      { dmg: 27, spd: 3.0 },
      { n: 5, rad: 105 },
      { dmg: 36 },
      { n: 6, rad: 120, spd: 3.4 },
    ],
    descs: [
      '生成 2 枚环绕机体的离子刃',
      '+1 环刃',
      '伤害 +43%',
      '+1 环刃，环绕半径扩大',
      '伤害与转速提升',
      '+1 环刃，环绕半径扩大',
      '伤害提升',
      '+1 环刃，全面强化',
    ],
  },
  nova: {
    name: '脉冲新星', col: '#5eead4', max: 8,
    icon: svgIcon('<circle cx="24" cy="24" r="6"/><circle cx="24" cy="24" r="13" stroke-dasharray="4 5"/><circle cx="24" cy="24" r="20" stroke-dasharray="2 7"/>'),
    lv: [
      { cd: 3.6, r: 150, dmg: 22 },
      { r: 185 },
      { cd: 3.1, dmg: 30 },
      { r: 215 },
      { cd: 2.6, dmg: 42 },
      { r: 250, dmg: 52 },
      { cd: 2.2 },
      { r: 290, dmg: 66, cd: 2.0 },
    ],
    descs: [
      '周期性释放冲击波，击退周围敌人',
      '范围扩大',
      '冷却缩短，伤害提升',
      '范围扩大',
      '冷却缩短，伤害提升',
      '范围与伤害提升',
      '冷却大幅缩短',
      '毁灭性冲击',
    ],
  },
  missile: {
    name: '追猎飞弹', col: '#ffb454', max: 8,
    icon: svgIcon('<path d="M28 6c6 5 9 12 6 22l-4 4h-8l-4-4c-3-10 0-17 6-22z"/><path d="M18 30l-6 8M30 30l6 8M24 34v9"/>'),
    lv: [
      { n: 1, cd: 2.4, dmg: 32, aoe: 80 },
      { n: 2 },
      { dmg: 44 },
      { n: 3, cd: 2.1 },
      { aoe: 100, dmg: 56 },
      { n: 4, cd: 1.9 },
      { dmg: 72 },
      { n: 5, cd: 1.6, aoe: 120, dmg: 86 },
    ],
    descs: [
      '发射追踪飞弹，命中后爆炸溅射',
      '+1 飞弹',
      '伤害提升',
      '+1 飞弹，冷却缩短',
      '爆炸范围与伤害提升',
      '+1 飞弹，冷却缩短',
      '伤害大幅提升',
      '饱和打击',
    ],
  },
  laser: {
    name: '湮灭光矛', col: '#ff5ecf', max: 8,
    icon: svgIcon('<path d="M8 40L40 8"/><path d="M18 42L42 18" opacity="0.55"/><path d="M6 30L30 6" opacity="0.55"/>'),
    lv: [
      { n: 1, dps: 30, len: 230 },
      { dps: 44 },
      { n: 2, len: 250 },
      { dps: 58 },
      { len: 295, dps: 66 },
      { n: 3, dps: 76 },
      { len: 335, dps: 86 },
      { n: 4, dps: 100, len: 365 },
    ],
    descs: [
      '旋转光矛持续切割敌人',
      '伤害提升',
      '+1 光矛',
      '伤害提升',
      '射程与伤害提升',
      '+1 光矛',
      '射程与伤害提升',
      '湮灭领域',
    ],
  },
};
// 补全每级缺省字段
for (const k in WEAPONS) {
  const lv = WEAPONS[k].lv;
  for (let i = 1; i < lv.length; i++) lv[i] = Object.assign({}, lv[i - 1], lv[i]);
}

const PASSIVES = {
  pdmg:  { name: '聚能核心',   col: '#ff6b8a', max: 5, desc: '伤害 +15%',
           icon: svgIcon('<path d="M24 42V14M14 24l10-10 10 10"/><path d="M14 14l10-8 10 8" opacity="0.5"/>'),
           apply() { player.dmgMul *= 1.15; } },
  prate: { name: '超频芯片',   col: '#7ef9ff', max: 5, desc: '攻击速度 +12%',
           icon: svgIcon('<path d="M26 4L12 28h10l-2 16 16-26H26l2-14z"/>'),
           apply() { player.rateMul *= 1.12; } },
  pspd:  { name: '矢量推进器', col: '#5eead4', max: 5, desc: '移动速度 +10%',
           icon: svgIcon('<path d="M6 14h20M6 24h28M6 34h20"/><path d="M30 8l12 16-12 16" opacity="0.7"/>'),
           apply() { player.speed *= 1.10; } },
  php:   { name: '纳米装甲',   col: '#66ffa3', max: 5, desc: '最大生命 +25 并回复 25',
           icon: svgIcon('<path d="M24 4l16 6v12c0 10-6 17-16 22C14 39 8 32 8 22V10z"/>'),
           apply() { player.maxHp += 25; player.hp = Math.min(player.maxHp, player.hp + 25); } },
  pregen:{ name: '修复纳米云', col: '#a3ffce', max: 4, desc: '生命回复 +0.7/秒',
           icon: svgIcon('<circle cx="24" cy="24" r="17"/><path d="M24 15v18M15 24h18"/>'),
           apply() { player.regen += 0.7; } },
  pmag:  { name: '引力磁场',   col: '#ffd54d', max: 4, desc: '拾取范围 +45%',
           icon: svgIcon('<path d="M14 6v16a10 10 0 0020 0V6"/><path d="M14 6h7M27 6h7" stroke-width="5"/>'),
           apply() { player.magnet *= 1.45; } },
  pxp:   { name: '数据洞察',   col: '#c084fc', max: 4, desc: '经验获取 +15%',
           icon: svgIcon('<path d="M24 5l7 12H17zM10 27h10v14H10zM28 27h10v14H28z" transform="translate(0 -2)"/>'),
           apply() { player.xpMul *= 1.15; } },
  pcrit: { name: '弱点分析',   col: '#ffb454', max: 4, desc: '暴击率 +6%',
           icon: svgIcon('<circle cx="24" cy="24" r="16"/><circle cx="24" cy="24" r="7"/><circle cx="24" cy="24" r="1.5" fill="currentColor"/><path d="M24 2v8M24 38v8M2 24h8M38 24h8" opacity="0.7"/>'),
           apply() { player.critC += 0.06; } },
};

const HEAL_OPT = {
  name: '应急维修', col: '#66ffa3',
  desc: '立即回复 40 点生命',
  icon: svgIcon('<path d="M24 42S7 31 7 18a9 9 0 0117-4 9 9 0 0117 4c0 13-17 24-17 24z"/>'),
};

/* ---------------- 武器系统 ---------------- */
const WeaponSys = {
  add(key) {
    player.weapons.push({ key, lv: 1, cd: 0.3, rot: U.rand(TAU), tick: 0 });
    UI.weaponsDirty = true;
  },
  get(key) { return player.weapons.find(w => w.key === key); },
  stats(w) { return WEAPONS[w.key].lv[w.lv - 1]; },

  update(dt) {
    const p = player;
    for (let wi = 0, wlen = p.weapons.length; wi < wlen; wi++) {
      const w = p.weapons[wi];
      const S = this.stats(w);
      switch (w.key) {
        case 'blaster': {
          w.cd -= dt;
          if (w.cd <= 0) {
            const t = nearestEnemy(p.x, p.y, 950);
            if (t) {
              w.cd = 1 / (S.rate * p.rateMul);
              const base = U.angleTo(p.x, p.y, t.x, t.y);
              for (let i = 0; i < S.n; i++) {
                const a = base + (i - (S.n - 1) / 2) * 0.11;
                spawnBullet(
                  p.x + Math.cos(a) * 18, p.y + Math.sin(a) * 18,
                  Math.cos(a) * 640, Math.sin(a) * 640,
                  S.dmg * p.dmgMul, S.p
                );
              }
              FX.flashGlow(p.x + Math.cos(base) * 22, p.y + Math.sin(base) * 22, '#7ef9ff', 26);
              AudioSys.shoot();
            } else {
              w.cd = 0.08;
            }
          }
          break;
        }
        case 'orbs':
          w.rot += S.spd * dt;
          break;
        case 'nova': {
          w.cd -= dt;
          if (w.cd <= 0) {
            w.cd = S.cd / p.rateMul;
            Game.novaBlast(S);
          }
          break;
        }
        case 'missile': {
          w.cd -= dt;
          if (w.cd <= 0 && enemies.length > 0) {
            w.cd = S.cd / p.rateMul;
            for (let i = 0; i < S.n; i++) {
              const a = p.angle + U.rand(-0.9, 0.9) + (i - (S.n - 1) / 2) * 0.35;
              spawnMissile(p.x, p.y, a, S.dmg * p.dmgMul, S.aoe);
            }
            AudioSys.missile();
          }
          break;
        }
        case 'laser': {
          w.rot += 1.5 * dt;
          w.tick -= dt;
          if (w.tick <= 0) {
            w.tick = 0.1;
            Game.laserTick(w, S);
          }
          break;
        }
      }
    }
  },

  _orbCache: [],
  orbPositions(w) {
    return this.orbPositionsFor(w, player);
  },
  orbPositionsFor(w, pp) {
    const S = this.stats(w);
    const arr = this._orbCache;
    arr.length = 0;
    for (let i = 0; i < S.n; i++) {
      const a = w.rot + i / S.n * TAU;
      arr.push({
        x: pp.x + Math.cos(a) * S.rad,
        y: pp.y + Math.sin(a) * S.rad,
      });
    }
    return arr;
  },

  draw(ctx) {
    const p = player;
    for (let wi = 0, wlen = p.weapons.length; wi < wlen; wi++) {
      const w = p.weapons[wi];
      const S = this.stats(w);
      if (w.key === 'orbs') {
        const pos = this.orbPositions(w);
        ctx.strokeStyle = 'rgba(167,139,250,0.16)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, S.rad, 0, TAU);
        ctx.stroke();
        ctx.globalCompositeOperation = 'lighter';
        for (const o of pos) {
          ctx.globalAlpha = 0.9;
          ctx.drawImage(glowSprite('#a78bfa'), o.x - 19, o.y - 19, 38, 38);
        }
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        for (const o of pos) {
          ctx.beginPath();
          ctx.arc(o.x, o.y, 5.5, 0, TAU);
          ctx.fillStyle = '#efeaff';
          ctx.fill();
          ctx.strokeStyle = '#a78bfa';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      } else if (w.key === 'laser') {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < S.n; i++) {
          const a = w.rot + i / S.n * TAU;
          const x2 = p.x + Math.cos(a) * S.len;
          const y2 = p.y + Math.sin(a) * S.len;
          // 三层描边模拟渐变光束，避免每帧 createLinearGradient 分配
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(x2, y2);
          // 外层光晕
          ctx.strokeStyle = 'rgba(255,94,207,0.2)';
          ctx.lineWidth = 12;
          ctx.stroke();
          // 中层光束
          ctx.strokeStyle = 'rgba(255,94,207,0.55)';
          ctx.lineWidth = 5;
          ctx.stroke();
          // 内层白芯
          ctx.strokeStyle = 'rgba(255,255,255,0.75)';
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.drawImage(glowSprite('#ff5ecf'), x2 - 14, y2 - 14, 28, 28);
        }
        ctx.restore();
        ctx.globalCompositeOperation = 'source-over';
      }
    }
  },
};

/* ---------------- 升级选项 ---------------- */
function rollUpgrades() {
  const pool = [];
  // 武器强化：权重 3（攻击提升类优先）
  for (const w of player.weapons) {
    if (w.lv < WEAPONS[w.key].max) pool.push({ v: { kind: 'wup', key: w.key }, w: 3 });
  }
  // 新武器：权重 1
  if (player.weapons.length < 5) {
    for (const k in WEAPONS) {
      if (!WeaponSys.get(k)) pool.push({ v: { kind: 'wnew', key: k }, w: 1 });
    }
  }
  // 被动：权重 1（基础概率）
  for (const k in PASSIVES) {
    if ((player.passives[k] || 0) < PASSIVES[k].max) pool.push({ v: { kind: 'p', key: k }, w: 1 });
  }

  // 加权不放回抽取 3 个选项
  const picked = [];
  const remaining = pool.slice();
  while (picked.length < 3 && remaining.length > 0) {
    const idx = (() => {
      let tot = 0;
      for (const it of remaining) tot += it.w;
      let r = Math.random() * tot;
      for (let i = 0; i < remaining.length; i++) {
        r -= remaining[i].w;
        if (r <= 0) return i;
      }
      return remaining.length - 1;
    })();
    picked.push(remaining[idx].v);
    remaining.splice(idx, 1);
  }
  while (picked.length < 3) picked.push({ kind: 'heal' });
  picked.forEach((o, i) => { o._idx = i; });
  return picked;
}

function upgradeCardMeta(opt) {
  if (opt.kind === 'wnew') {
    const D = WEAPONS[opt.key];
    return { name: D.name, col: D.col, icon: D.icon, tag: '★ 新武器', desc: D.descs[0] };
  }
  if (opt.kind === 'wup') {
    const D = WEAPONS[opt.key];
    const w = WeaponSys.get(opt.key);
    const nl = w.lv + 1;
    return {
      name: D.name, col: D.col, icon: D.icon,
      tag: `武器强化 Lv${w.lv} → ${nl}`,
      desc: D.descs[nl - 1],
    };
  }
  if (opt.kind === 'p') {
    const P = PASSIVES[opt.key];
    const cur = player.passives[opt.key] || 0;
    return {
      name: P.name, col: P.col, icon: P.icon,
      tag: `被动 Lv${cur} → ${cur + 1}`,
      desc: P.desc,
    };
  }
  return { name: HEAL_OPT.name, col: HEAL_OPT.col, icon: HEAL_OPT.icon, tag: '补给', desc: HEAL_OPT.desc };
}

function applyUpgrade(opt) {
  if (opt.kind === 'wnew') {
    WeaponSys.add(opt.key);
  } else if (opt.kind === 'wup') {
    WeaponSys.get(opt.key).lv++;
    UI.weaponsDirty = true;
  } else if (opt.kind === 'p') {
    player.passives[opt.key] = (player.passives[opt.key] || 0) + 1;
    PASSIVES[opt.key].apply();
  } else {
    player.hp = Math.min(player.maxHp, player.hp + 40);
  }
}
