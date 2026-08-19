'use strict';
/* ============ 实体：玩家 / 敌人 / 子弹 / 宝石 / 掉落 ============ */
let player = null;
const enemies = [];
const bullets = [];        // 权威子弹（主机：双方；客机：仅远端 P1，由快照管理）
const localBullets = [];   // 客机自机本地发射的子弹（纯视觉反馈，快照不覆盖）
const ebullets = [];
const gems = [];
const pickups = [];
const missiles = [];       // 权威飞弹（主机：双方；客机：仅远端 P1）
const localMissiles = [];  // 客机自机本地飞弹（纯视觉）
let fireFromP2 = false;    // 主机更新 P2 武器时置真，用于给子弹/飞弹打上归属标记
let _nextId = 1;
function nextId() { return _nextId++; }   // 实体稳定 id：客机按 id 复用，避免 swap-pop 造成插值对象串位

function resetEntities() {
  enemies.length = 0;
  bullets.length = 0;
  localBullets.length = 0;
  ebullets.length = 0;
  gems.length = 0;
  pickups.length = 0;
  missiles.length = 0;
  localMissiles.length = 0;
  fireFromP2 = false;
}

function xpFor(lv) {
  return Math.round(6 + lv * 4 + Math.pow(lv, 1.5) * 1.6);
}

function createPlayer() {
  return {
    x: World.W / 2, y: World.H / 2,
    vx: 0, vy: 0, angle: -Math.PI / 2,
    hp: 100, maxHp: 100, regen: 0,
    speed: 265, magnet: 95,
    level: 1, xp: 0, xpNext: xpFor(1),
    dmgMul: 1, rateMul: 1, xpMul: 1,
    critC: 0.10, critM: 2.2,
    iTime: 0, dashCd: 0, dashT: 0, dashDx: 0, dashDy: 0,
    trailT: 0, alive: true, col: '#3df2ff',
    weapons: [], passives: {},
  };
}

/* ---------------- 玩家 ---------------- */
function updatePlayer(dt) {
  const p = player;
  if (!p.alive) return;

  if (p.regen > 0) p.hp = Math.min(p.maxHp, p.hp + p.regen * dt);

  const mv = Input.getMove();

  // 鼠标移动：朝向光标位置
  if (Input.usingMouse) {
    const mw = Input.getMouseWorld();
    const dx = mw.x - p.x;
    const dy = mw.y - p.y;
    const d2 = dx * dx + dy * dy;
    if (d2 > 36) {          // 6² = 36，死区
      const inv = 1 / Math.sqrt(d2);
      mv.x = dx * inv;
      mv.y = dy * inv;
    } else {
      mv.x = 0;
      mv.y = 0;
    }
  }

  // 冲刺
  if (Input.consumeDash() && p.dashCd <= 0) {
    let dx = mv.x, dy = mv.y;
    if (dx === 0 && dy === 0) { dx = Math.cos(p.angle); dy = Math.sin(p.angle); }
    const l = Math.hypot(dx, dy) || 1;
    p.dashDx = dx / l; p.dashDy = dy / l;
    p.dashT = 0.16;
    p.dashCd = 2.2;
    p.iTime = Math.max(p.iTime, 0.3);
    AudioSys.dash();
    FX.ring(p.x, p.y, '#7ef9ff', 46, 2.5);
  }
  p.dashCd -= dt;
  p.iTime -= dt;

  if (p.dashT > 0) {
    p.dashT -= dt;
    p.vx = p.dashDx * 920;
    p.vy = p.dashDy * 920;
    FX.ghost(p.x, p.y, p.angle, '#7ef9ff');
  } else {
    const k = Math.min(1, dt * 11);
    p.vx += (mv.x * p.speed - p.vx) * k;
    p.vy += (mv.y * p.speed - p.vy) * k;
  }

  p.x = U.clamp(p.x + p.vx * dt, 18, World.W - 18);
  p.y = U.clamp(p.y + p.vy * dt, 18, World.H - 18);

  // 瞄准最近敌人
  const tgt = nearestEnemy(p.x, p.y, 1000);
  if (tgt) {
    p.angle = U.lerpAngle(p.angle, U.angleTo(p.x, p.y, tgt.x, tgt.y), Math.min(1, dt * 14));
  } else if (Math.abs(p.vx) + Math.abs(p.vy) > 40) {
    p.angle = U.lerpAngle(p.angle, Math.atan2(p.vy, p.vx), Math.min(1, dt * 8));
  }

  // 尾焰
  p.trailT -= dt;
  const moving = Math.hypot(p.vx, p.vy) > 50;
  if (moving && p.trailT <= 0) {
    p.trailT = 0.028;
    const bx = p.x - Math.cos(p.angle) * 14;
    const by = p.y - Math.sin(p.angle) * 14;
    FX.trail(bx + U.rand(-3, 3), by + U.rand(-3, 3), Math.random() < 0.3 ? '#ffd166' : '#3df2ff', U.rand(2.5, 4.5), 0.3);
  }
}

function drawPlayer(ctx) {
  const p = player;
  if (!p.alive) return;
  const flicker = p.iTime > 0 && (Math.floor(Game.elapsed * 26) % 2 === 0);

  ctx.save();
  // 底部光晕
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = flicker ? 0.25 : 0.5;
  const gs = 96;
  ctx.drawImage(glowSprite('#3df2ff'), p.x - gs / 2, p.y - gs / 2, gs, gs);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = flicker ? 0.5 : 1;

  ctx.translate(p.x, p.y);

  // 冲刺冷却指示环
  if (p.dashCd > 0) {
    const frac = 1 - p.dashCd / 2.2;
    ctx.strokeStyle = 'rgba(139,255,176,0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 24, -Math.PI / 2, -Math.PI / 2 + frac * TAU);
    ctx.stroke();
  }
  // 无敌护盾
  if (p.iTime > 0.28) {
    ctx.strokeStyle = 'rgba(126,249,255,0.55)';
    ctx.lineWidth = 1.6;
    ctx.setLineDash([7, 6]);
    ctx.lineDashOffset = Game.elapsed * 40;
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.rotate(p.angle);
  // 引擎火焰
  const fl = U.rand(9, 17);
  ctx.beginPath();
  ctx.moveTo(-11, -4.5);
  ctx.lineTo(-11 - fl, 0);
  ctx.lineTo(-11, 4.5);
  ctx.closePath();
  ctx.fillStyle = Math.random() < 0.5 ? 'rgba(255,209,102,0.9)' : 'rgba(255,255,255,0.85)';
  ctx.fill();
  // 船体
  ctx.shadowColor = '#3df2ff';
  ctx.shadowBlur = 16;
  ctx.beginPath();
  ctx.moveTo(18, 0);
  ctx.lineTo(-12, -11);
  ctx.lineTo(-7, 0);
  ctx.lineTo(-12, 11);
  ctx.closePath();
  ctx.fillStyle = '#06222e';
  ctx.fill();
  ctx.strokeStyle = '#3df2ff';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.shadowBlur = 0;
  // 核心
  ctx.beginPath();
  ctx.arc(1, 0, 3.2, 0, TAU);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.restore();
  ctx.globalAlpha = 1;
}

/* ---- 远程玩家（P2）---- */
function updateRemotePlayer(dt) {
  const p = Game.p2;
  if (!p || !p.alive) return;
  if (p.regen > 0) p.hp = Math.min(p.maxHp, p.hp + p.regen * dt);

  const ri = Net._remoteInput;
  const mv = { x: 0, y: 0 };
  if (ri) {
    // ri.mx / ri.my 已由客机转为世界坐标，直接使用
    const dx = ri.mx - p.x, dy = ri.my - p.y;
    const d2 = dx * dx + dy * dy;
    if (d2 > 36) { const inv = 1 / Math.sqrt(d2); mv.x = dx * inv; mv.y = dy * inv; }
  }

  // 冲刺
  if (ri && ri.dash && p.dashCd <= 0) {
    let dx = mv.x, dy = mv.y;
    if (dx === 0 && dy === 0) { dx = Math.cos(p.angle); dy = Math.sin(p.angle); }
    const l = Math.hypot(dx, dy) || 1;
    p.dashDx = dx / l; p.dashDy = dy / l;
    p.dashT = 0.16; p.dashCd = 2.2;
    p.iTime = Math.max(p.iTime, 0.3);
    FX.ring(p.x, p.y, '#ff5ecf', 46, 2.5);
  }
  p.dashCd -= dt; p.iTime -= dt;

  if (p.dashT > 0) {
    p.dashT -= dt;
    p.vx = p.dashDx * 920; p.vy = p.dashDy * 920;
    FX.ghost(p.x, p.y, p.angle, '#ff5ecf');
  } else {
    const k = Math.min(1, dt * 11);
    p.vx += (mv.x * p.speed - p.vx) * k;
    p.vy += (mv.y * p.speed - p.vy) * k;
  }
  p.x = U.clamp(p.x + p.vx * dt, 18, World.W - 18);
  p.y = U.clamp(p.y + p.vy * dt, 18, World.H - 18);

  const tgt = nearestEnemy(p.x, p.y, 1000);
  if (tgt) p.angle = U.lerpAngle(p.angle, U.angleTo(p.x, p.y, tgt.x, tgt.y), Math.min(1, dt * 14));
  else if (Math.abs(p.vx) + Math.abs(p.vy) > 40) p.angle = U.lerpAngle(p.angle, Math.atan2(p.vy, p.vx), Math.min(1, dt * 8));

  p.trailT -= dt;
  if (Math.hypot(p.vx, p.vy) > 50 && p.trailT <= 0) {
    p.trailT = 0.028;
    FX.trail(p.x - Math.cos(p.angle) * 14 + U.rand(-3, 3), p.y - Math.sin(p.angle) * 14 + U.rand(-3, 3), '#ff5ecf', 3.5, 0.25);
  }
}

function drawRemotePlayer(ctx, p) {
  if (!p || !p.alive) return;
  const flicker = p.iTime > 0 && (Math.floor(Game.elapsed * 26) % 2 === 0);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = flicker ? 0.2 : 0.4;
  const gs = 80;
  ctx.drawImage(glowSprite('#ff5ecf'), p.x - gs / 2, p.y - gs / 2, gs, gs);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = flicker ? 0.45 : 1;
  ctx.translate(p.x, p.y);
  if (p.iTime > 0.28) {
    ctx.strokeStyle = 'rgba(255,94,207,0.5)'; ctx.lineWidth = 1.6;
    ctx.setLineDash([6, 5]); ctx.lineDashOffset = Game.elapsed * 35;
    ctx.beginPath(); ctx.arc(0, 0, 20, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
  }
  ctx.rotate(p.angle);
  ctx.beginPath();
  ctx.moveTo(16, 0); ctx.lineTo(-10, -10); ctx.lineTo(-6, 0);
  ctx.lineTo(-10, 10); ctx.closePath();
  ctx.fillStyle = '#1a0412'; ctx.fill();
  ctx.strokeStyle = '#ff5ecf'; ctx.lineWidth = 2; ctx.stroke();
  ctx.beginPath(); ctx.arc(1, 0, 2.8, 0, TAU);
  ctx.fillStyle = '#ffffff'; ctx.fill();
  ctx.restore();
  ctx.globalAlpha = 1;
}

/* ---- 双人拾取 ---- */
const _PLAYERS = [null, null];   // 复用数组，避免每帧每宝石分配 [player, p2]

function updateGemsMulti(dt) {
  _PLAYERS[0] = player; _PLAYERS[1] = Game.p2;
  for (let i = gems.length - 1; i >= 0; i--) {
    const g = gems[i];
    // 吸引到最近玩家
    let np = player, nd = U.dist2(g.x, g.y, player.x, player.y);
    if (Game.p2 && Game.p2.alive) {
      const d2 = U.dist2(g.x, g.y, Game.p2.x, Game.p2.y);
      if (d2 < nd) { np = Game.p2; nd = d2; }
    }
    const magR2 = np.magnet * np.magnet;
    if (!g.mag) {
      g.vx *= (1 - 3 * dt); g.vy *= (1 - 3 * dt);
      if (nd < magR2) g.mag = true;
    } else {
      const a = U.angleTo(g.x, g.y, np.x, np.y);
      const spd = Math.min(760, Math.hypot(g.vx, g.vy) + 2100 * dt);
      g.vx = Math.cos(a) * spd; g.vy = Math.sin(a) * spd;
    }
    g.x += g.vx * dt; g.y += g.vy * dt;
    // 检查两个玩家（经验归属对应玩家，P2 的升级给 P2）
    let collected = false;
    for (const pp of _PLAYERS) {
      if (!pp || !pp.alive) continue;
      if (U.dist2(g.x, g.y, pp.x, pp.y) < 22 * 22) {
        Game.collectGem(g, pp); collected = true; break;
      }
    }
    if (collected) { gems[i] = gems[gems.length - 1]; gems.pop(); }
  }
}

function updatePickupsMulti(dt) {
  _PLAYERS[0] = player; _PLAYERS[1] = Game.p2;
  for (let i = pickups.length - 1; i >= 0; i--) {
    const pk = pickups[i];
    for (const pp of _PLAYERS) {
      if (!pp || !pp.alive) continue;
      if (U.dist2(pk.x, pk.y, pp.x, pp.y) < 28 * 28) {
        Game.applyPickup(pk.type, pk.x, pk.y, pp);
        // swap-and-pop 替代 O(n) splice
        pickups[i] = pickups[pickups.length - 1];
        pickups.pop();
        break;
      }
    }
  }
}

/* ---------------- 敌人 ---------------- */
const ENEMY_TYPES = {
  chaser:   { r: 13, hp: 22,  spd: [95, 135],  dmg: 10, xp: 1, score: 10,  col: '#ff3b5c' },
  darter:   { r: 11, hp: 16,  spd: [66, 92],   dmg: 12, xp: 2, score: 15,  col: '#ff9f1c' },
  splitter: { r: 15, hp: 34,  spd: [58, 80],   dmg: 10, xp: 2, score: 20,  col: '#3bff7a' },
  mini:     { r: 8,  hp: 9,   spd: [150, 185], dmg: 6,  xp: 1, score: 5,   col: '#8effa9' },
  tank:     { r: 22, hp: 110, spd: [40, 55],   dmg: 18, xp: 6, score: 40,  col: '#b04dff' },
  shooter:  { r: 12, hp: 30,  spd: [72, 95],   dmg: 8,  xp: 3, score: 25,  col: '#28d8ff' },
  boss:     { r: 48, hp: 1500,spd: [62, 62],   dmg: 22, xp: 0, score: 1500,col: '#ff2ea6' },
};
// 预计算渲染色（避免每帧 hexA 解析）
for (const k in ENEMY_TYPES) {
  const t = ENEMY_TYPES[k];
  t.fill = U.hexA(t.col, t === ENEMY_TYPES.boss ? 0.16 : 0.13);
  t.hpRing = U.hexA(t.col, 0.75);
}

function spawnEnemy(type, x, y, elite = false, hpMul = 1, dmgMul = 1) {
  const T = ENEMY_TYPES[type];
  const e = {
    type, x, y, vx: 0, vy: 0,
    r: T.r * (elite ? 1.55 : 1),
    col: T.col,
    hp: T.hp * hpMul * (elite ? 6 : 1),
    spd: U.rand(T.spd[0], T.spd[1]) * (elite ? 0.88 : 1),
    dmg: T.dmg * dmgMul * (elite ? 1.5 : 1),
    xp: T.xp * (elite ? 6 : 1),
    score: T.score * (elite ? 5 : 1),
    elite, boss: type === 'boss',
    flash: 0, seed: U.rand(TAU), ang: 0,
    state: 0, stateT: U.rand(0.6, 1.8),
    fireT: U.rand(1.2, 2.6), orbT: 0,
    kx: 0, ky: 0, dead: false,
    atk: null, last: null,
  };
  e.maxHp = e.hp;
  e.id = nextId();
  enemies.push(e);
  // 通知 Game 空间哈希已过期（分裂/召唤产生的敌人不在哈希内）
  if (typeof Game !== 'undefined') Game._hashDirty = true;
  return e;
}

function nearestEnemy(x, y, maxD = Infinity) {
  let best = null, bd = maxD * maxD;
  for (const e of enemies) {
    if (e.dead) continue;
    const d = U.dist2(x, y, e.x, e.y);
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

function randomEnemyNear(x, y, maxD) {
  const cand = [];
  const m2 = maxD * maxD;
  for (const e of enemies) {
    if (!e.dead && U.dist2(x, y, e.x, e.y) < m2) cand.push(e);
  }
  if (cand.length) return U.pick(cand);
  return nearestEnemy(x, y);
}

function updateEnemies(dt) {
  const p = player;
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    if (e.dead) { enemies[i] = enemies[enemies.length - 1]; enemies.pop(); continue; }
    e.flash -= dt;
    e.orbT -= dt;
    e.seed += dt;

    if (e.boss) {
      updateBoss(e, dt);
    } else if (e.type === 'darter') {
      if (e.state === 0) {
        const a = U.angleTo(e.x, e.y, p.x, p.y) + Math.sin(e.seed * 2) * 0.4;
        e.vx = Math.cos(a) * e.spd;
        e.vy = Math.sin(a) * e.spd;
        e.stateT -= dt;
        if (e.stateT <= 0 && U.dist2(e.x, e.y, p.x, p.y) < 430 * 430) {
          e.state = 1; e.stateT = 0.42;
        }
      } else if (e.state === 1) {
        e.vx *= 0.86; e.vy *= 0.86;
        e.stateT -= dt;
        e.flash = Math.max(e.flash, 0.03);
        if (e.stateT <= 0) {
          e.state = 2; e.stateT = 0.5;
          const a = U.angleTo(e.x, e.y, p.x, p.y);
          e.vx = Math.cos(a) * 470;
          e.vy = Math.sin(a) * 470;
        }
      } else {
        e.stateT -= dt;
        if (e.stateT <= 0) { e.state = 0; e.stateT = U.rand(0.8, 1.7); }
      }
    } else if (e.type === 'shooter') {
      const d = U.dist(e.x, e.y, p.x, p.y);
      const a = U.angleTo(e.x, e.y, p.x, p.y);
      let mx = 0, my = 0;
      if (d > 330) { mx = Math.cos(a); my = Math.sin(a); }
      else if (d < 235) { mx = -Math.cos(a); my = -Math.sin(a); }
      else {
        const strafe = Math.sin(e.seed * 0.9) > 0 ? 1 : -1;
        mx = Math.cos(a + Math.PI / 2) * strafe;
        my = Math.sin(a + Math.PI / 2) * strafe;
      }
      e.vx = mx * e.spd;
      e.vy = my * e.spd;
      e.fireT -= dt;
      if (e.fireT <= 0 && d < 640) {
        e.fireT = U.rand(1.9, 2.6);
        spawnEBullet(e.x, e.y, Math.cos(a) * 245, Math.sin(a) * 245, e.dmg, '#59f0ff', 5);
        FX.flashGlow(e.x, e.y, '#59f0ff', 34);
      }
    } else {
      // chaser / mini / splitter / tank
      const wob = Math.sin(e.seed * 2.2) * 0.35;
      const a = U.angleTo(e.x, e.y, p.x, p.y) + wob;
      e.vx = Math.cos(a) * e.spd;
      e.vy = Math.sin(a) * e.spd;
    }

    // 击退衰减
    const kd = Math.max(0, 1 - 6 * dt);
    e.kx *= kd; e.ky *= kd;
    e.x += (e.vx + e.kx) * dt;
    e.y += (e.vy + e.ky) * dt;
    e.x = U.clamp(e.x, e.r, World.W - e.r);
    e.y = U.clamp(e.y, e.r, World.H - e.r);
  }
}

/* ---- Boss AI ---- */
function updateBoss(e, dt) {
  const p = player;
  const enr = e.hp < e.maxHp * 0.3;
  const sm = enr ? 0.62 : 1;

  if (!e.atk) {
    const a = U.angleTo(e.x, e.y, p.x, p.y);
    e.vx = Math.cos(a) * e.spd;
    e.vy = Math.sin(a) * e.spd;
    e.stateT -= dt;
    if (e.stateT <= 0) {
      const opts = ['burst', 'spread', 'charge', 'summon'].filter(x => x !== e.last);
      const name = U.pick(opts);
      e.last = name;
      e.atk = { name, t: name === 'charge' ? 0.72 : 0, n: 0, dir: 0 };
    }
    return;
  }

  const A = e.atk;
  e.vx *= 0.9; e.vy *= 0.9;
  switch (A.name) {
    case 'burst':
      A.t -= dt;
      if (A.t <= 0) {
        const n = 20 + (enr ? 8 : 0);
        const spd = 205 * (enr ? 1.25 : 1);
        for (let i = 0; i < n; i++) {
          const a = i / n * TAU + e.seed;
          spawnEBullet(e.x, e.y, Math.cos(a) * spd, Math.sin(a) * spd, e.dmg * 0.55, '#ff5ecf', 6);
        }
        AudioSys.explode(0);
        Game.trauma += 0.14;
        FX.ring(e.x, e.y, '#ff5ecf', 120, 3);
        A.n++; A.t = 0.55 * sm;
        if (A.n >= 3) bossEndAtk(e, U.rand(1.4, 2.2) * sm);
      }
      break;
    case 'spread':
      A.t -= dt;
      if (A.t <= 0) {
        const base = U.angleTo(e.x, e.y, p.x, p.y);
        const spd = 265 * (enr ? 1.2 : 1);
        for (let i = 0; i < 5; i++) {
          const a = base + (i / 4 - 0.5) * 0.62;
          spawnEBullet(e.x, e.y, Math.cos(a) * spd, Math.sin(a) * spd, e.dmg * 0.55, '#ff5ecf', 6);
        }
        AudioSys.shoot();
        A.n++; A.t = 0.3 * sm;
        if (A.n >= 4) bossEndAtk(e, U.rand(1.2, 2) * sm);
      }
      break;
    case 'charge':
      if (A.n === 0) {
        A.dir = U.angleTo(e.x, e.y, p.x, p.y);
        A.t -= dt;
        e.flash = Math.max(e.flash, 0.03);
        if (A.t <= 0) {
          A.n = 1; A.t = 0.78;
          AudioSys.dash();
          Game.trauma += 0.2;
        }
      } else {
        e.vx = Math.cos(A.dir) * 660;
        e.vy = Math.sin(A.dir) * 660;
        A.t -= dt;
        FX.trail(e.x + U.rand(-20, 20), e.y + U.rand(-20, 20), '#ff2ea6', 7, 0.35);
        if (A.t <= 0) bossEndAtk(e, U.rand(1, 1.6) * sm);
      }
      break;
    case 'summon':
      if (A.n === 0) {
        A.n = 1; A.t = 0.62;
        FX.ring(e.x, e.y, '#ff2ea6', 210, 4);
        AudioSys.alarm();
      } else {
        A.t -= dt;
        if (A.t <= 0) {
          const cnt = enr ? 10 : 7;
          for (let i = 0; i < cnt; i++) {
            const a = i / cnt * TAU;
            if (enemies.length < 250) {
              spawnEnemy('chaser', e.x + Math.cos(a) * 150, e.y + Math.sin(a) * 150, false, Game.hpMul(), Game.dmgMulE());
            }
          }
          bossEndAtk(e, U.rand(1.4, 2.2) * sm);
        }
      }
      break;
  }
}

function bossEndAtk(e, idle) {
  e.atk = null;
  e.stateT = idle;
}

/* ---- 敌人绘制 ---- */
function drawPoly(ctx, x, y, r, sides, rot) {
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const a = rot + i / sides * TAU;
    if (i === 0) ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    else ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.closePath();
}

function drawEnemies(ctx) {
  const p = player;
  // 光晕层
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0, len = enemies.length; i < len; i++) {
    const e = enemies[i];
    if (e.dead) continue;
    const s = e.r * 4.4;
    ctx.globalAlpha = e.boss ? 0.55 : 0.32;
    ctx.drawImage(glowSprite(e.col), e.x - s / 2, e.y - s / 2, s, s);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';

  // 形体层
  for (let i = 0, len = enemies.length; i < len; i++) {
    const e = enemies[i];
    if (e.dead) continue;
    const T = ENEMY_TYPES[e.type];
    const flashing = e.flash > 0;
    const fill = flashing ? 'rgba(255,255,255,0.85)' : T.fill;
    ctx.fillStyle = fill;
    ctx.strokeStyle = flashing ? '#ffffff' : e.col;
    ctx.lineWidth = e.elite ? 3 : 2;

    switch (e.type) {
      case 'chaser': {
        const a = U.angleTo(e.x, e.y, p.x, p.y);
        ctx.save();
        ctx.translate(e.x, e.y);
        ctx.rotate(a);
        ctx.beginPath();
        ctx.moveTo(e.r * 1.15, 0);
        ctx.lineTo(-e.r * 0.8, -e.r * 0.85);
        ctx.lineTo(-e.r * 0.4, 0);
        ctx.lineTo(-e.r * 0.8, e.r * 0.85);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.restore();
        break;
      }
      case 'darter': {
        const a = e.state === 2 ? Math.atan2(e.vy, e.vx) : U.angleTo(e.x, e.y, p.x, p.y);
        ctx.save();
        ctx.translate(e.x, e.y);
        ctx.rotate(a);
        const pulse = e.state === 1 ? 1 + Math.sin(Game.elapsed * 30) * 0.15 : 1;
        ctx.scale(pulse, pulse);
        ctx.beginPath();
        ctx.moveTo(e.r * 1.5, 0);
        ctx.lineTo(0, -e.r * 0.7);
        ctx.lineTo(-e.r, 0);
        ctx.lineTo(0, e.r * 0.7);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.restore();
        break;
      }
      case 'splitter':
      case 'mini': {
        drawPoly(ctx, e.x, e.y, e.r, 4, e.seed * 1.8);
        ctx.fill(); ctx.stroke();
        break;
      }
      case 'tank': {
        drawPoly(ctx, e.x, e.y, e.r, 6, e.seed * 0.5);
        ctx.fill(); ctx.stroke();
        drawPoly(ctx, e.x, e.y, e.r * 0.55, 6, -e.seed * 0.8);
        ctx.stroke();
        break;
      }
      case 'shooter': {
        drawPoly(ctx, e.x, e.y, e.r, 4, Math.PI / 4);
        ctx.fill(); ctx.stroke();
        if (e.fireT < 0.4) {
          const a = U.angleTo(e.x, e.y, p.x, p.y);
          ctx.beginPath();
          ctx.arc(e.x + Math.cos(a) * e.r * 0.9, e.y + Math.sin(a) * e.r * 0.9, 3.4, 0, TAU);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
        }
        break;
      }
      case 'boss': {
        ctx.save();
        // 蓄力冲撞警示线
        if (e.atk && e.atk.name === 'charge' && e.atk.n === 0) {
          ctx.strokeStyle = 'rgba(255,60,110,0.35)';
          ctx.lineWidth = 5;
          ctx.setLineDash([16, 12]);
          ctx.beginPath();
          ctx.moveTo(e.x, e.y);
          ctx.lineTo(e.x + Math.cos(e.atk.dir) * 780, e.y + Math.sin(e.atk.dir) * 780);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        const enr = e.hp < e.maxHp * 0.3;
        drawPoly(ctx, e.x, e.y, e.r, 5, e.seed * 0.45);
        ctx.fillStyle = flashing ? 'rgba(255,255,255,0.85)' : T.fill;
        ctx.fill();
        ctx.strokeStyle = flashing ? '#fff' : e.col;
        ctx.lineWidth = 3.4;
        ctx.stroke();
        drawPoly(ctx, e.x, e.y, e.r * 0.55, 5, -e.seed * 0.9);
        ctx.lineWidth = 2;
        ctx.stroke();
        if (enr) {
          ctx.globalAlpha = 0.3 + 0.2 * Math.sin(Game.elapsed * 9);
          ctx.strokeStyle = '#ff4d6d';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(e.x, e.y, e.r + 13, 0, TAU);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
        ctx.restore();
        break;
      }
    }

    // 精英金环
    if (e.elite) {
      ctx.strokeStyle = 'rgba(255,213,77,0.85)';
      ctx.lineWidth = 1.8;
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r + 6, e.seed, e.seed + TAU);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // 大型敌人血环
    if ((e.type === 'tank' || e.elite) && !e.boss && e.hp < e.maxHp) {
      const frac = Math.max(0, e.hp / e.maxHp);
      ctx.strokeStyle = T.hpRing;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r + 11, -Math.PI / 2, -Math.PI / 2 + frac * TAU);
      ctx.stroke();
    }
  }
}

/* ---------------- 玩家子弹 ---------------- */
function spawnBullet(x, y, vx, vy, dmg, pierce, col = '#7ef9ff') {
  if (Game.mode === 'guest') {
    // 客机：自机子弹走本地数组（快照不覆盖，保证开火反馈即时）
    localBullets.push({ x, y, vx, vy, dmg, pierce, r: 4, life: 1.15, col, hit: null });
  } else {
    bullets.push({ x, y, vx, vy, dmg, pierce, r: 4, life: 1.15, col, hit: null, p2: fireFromP2, id: nextId() });
  }
}

/** 子弹更新。
 *  主机：完整生命周期（推进+清除，含 P2 标记子弹，伤害权威）。
 *  客机 remoteOnly：仅推进远端子弹位置（快照间按速度推算，删除由快照管理）。 */
function updateBullets(dt, remoteOnly = false) {
  if (remoteOnly) {
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
    }
    return;
  }
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.life -= dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.life <= 0 || b.x < 0 || b.x > World.W || b.y < 0 || b.y > World.H) {
      bullets[i] = bullets[bullets.length - 1];
      bullets.pop();
    }
  }
}

/** 客机本地子弹：完整生命周期（推进+清除），纯视觉 */
function updateLocalBullets(dt) {
  for (let i = localBullets.length - 1; i >= 0; i--) {
    const b = localBullets[i];
    b.life -= dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.life <= 0 || b.x < 0 || b.x > World.W || b.y < 0 || b.y > World.H) {
      localBullets[i] = localBullets[localBullets.length - 1];
      localBullets.pop();
    }
  }
}

function drawBullets(ctx) {
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0, len = bullets.length; i < len; i++) {
    const b = bullets[i];
    const s = 26;
    ctx.globalAlpha = 0.85;
    ctx.drawImage(glowSprite(b.col), b.x - s / 2, b.y - s / 2, s, s);
    const l = Math.hypot(b.vx, b.vy) || 1;
    const nx = b.vx / l, ny = b.vy / l;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(b.x - nx * 10, b.y - ny * 10);
    ctx.lineTo(b.x + nx * 3, b.y + ny * 3);
    ctx.stroke();
  }
  // 客机自机本地子弹
  for (let i = 0, len = localBullets.length; i < len; i++) {
    const b = localBullets[i];
    const s = 26;
    ctx.globalAlpha = 0.85;
    ctx.drawImage(glowSprite(b.col), b.x - s / 2, b.y - s / 2, s, s);
    const l = Math.hypot(b.vx, b.vy) || 1;
    const nx = b.vx / l, ny = b.vy / l;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(b.x - nx * 10, b.y - ny * 10);
    ctx.lineTo(b.x + nx * 3, b.y + ny * 3);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

/* ---------------- 敌方子弹 ---------------- */
function spawnEBullet(x, y, vx, vy, dmg, col = '#ff5ecf', r = 6) {
  if (ebullets.length > 400) return;
  ebullets.push({ x, y, vx, vy, dmg, col, r, life: 7, id: nextId() });
}

/** 敌方子弹。主机：完整生命周期；客机 remoteOnly：仅按速度推进（快照间推算） */
function updateEBullets(dt, remoteOnly = false) {
  if (remoteOnly) {
    for (let i = ebullets.length - 1; i >= 0; i--) {
      const b = ebullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
    }
    return;
  }
  for (let i = ebullets.length - 1; i >= 0; i--) {
    const b = ebullets[i];
    b.life -= dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.life <= 0 || b.x < -20 || b.x > World.W + 20 || b.y < -20 || b.y > World.H + 20) {
      ebullets[i] = ebullets[ebullets.length - 1];
      ebullets.pop();
    }
  }
}

function drawEBullets(ctx) {
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0, len = ebullets.length; i < len; i++) {
    const b = ebullets[i];
    const s = b.r * 5.4;
    ctx.globalAlpha = 0.8;
    ctx.drawImage(glowSprite(b.col), b.x - s / 2, b.y - s / 2, s, s);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  for (let i = 0, len = ebullets.length; i < len; i++) {
    const b = ebullets[i];
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r * 0.55, 0, TAU);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  }
}

/* ---------------- 追踪飞弹 ---------------- */
function spawnMissile(x, y, angle, dmg, aoe) {
  if (Game.mode === 'guest') {
    // 客机：自机飞弹走本地数组（纯视觉，伤害由主机结算）
    localMissiles.push({
      x, y,
      vx: Math.cos(angle) * 300, vy: Math.sin(angle) * 300,
      dmg, aoe, target: randomEnemyNear(x, y, 900),
      life: 4, trailT: 0,
    });
  } else {
    missiles.push({
      x, y,
      vx: Math.cos(angle) * 300, vy: Math.sin(angle) * 300,
      dmg, aoe, target: randomEnemyNear(x, y, 900),
      life: 4, trailT: 0, p2: fireFromP2, id: nextId(),
    });
  }
}

/** 飞弹更新。主机：完整生命周期（追踪+爆炸+清除）。 */
function updateMissiles(dt, remoteOnly = false) {
  if (remoteOnly) {
    // 客机：远端飞弹仅本地追踪+推进位置（删除由快照管理，快照刷新航向）
    for (let i = missiles.length - 1; i >= 0; i--) {
      const m = missiles[i];
      if (!m.target || m.target.dead) m.target = nearestEnemy(m.x, m.y);
      if (m.target) {
        const want = U.angleTo(m.x, m.y, m.target.x, m.target.y);
        const cur = Math.atan2(m.vy, m.vx);
        const a = U.lerpAngle(cur, want, Math.min(1, dt * 6.5));
        const spd = Math.min(560, Math.hypot(m.vx, m.vy) + 620 * dt);
        m.vx = Math.cos(a) * spd;
        m.vy = Math.sin(a) * spd;
      }
      m.x += m.vx * dt;
      m.y += m.vy * dt;
    }
    return;
  }
  for (let i = missiles.length - 1; i >= 0; i--) {
    const m = missiles[i];
    m.life -= dt;
    if (!m.target || m.target.dead) m.target = nearestEnemy(m.x, m.y);
    if (m.target) {
      const want = U.angleTo(m.x, m.y, m.target.x, m.target.y);
      const cur = Math.atan2(m.vy, m.vx);
      const a = U.lerpAngle(cur, want, Math.min(1, dt * 6.5));
      const spd = Math.min(560, Math.hypot(m.vx, m.vy) + 620 * dt);
      m.vx = Math.cos(a) * spd;
      m.vy = Math.sin(a) * spd;
    }
    m.x += m.vx * dt;
    m.y += m.vy * dt;
    m.trailT -= dt;
    if (m.trailT <= 0) {
      m.trailT = 0.022;
      FX.trail(m.x, m.y, '#ffb454', 3.4, 0.28);
    }
    let boom = m.life <= 0;
    if (m.target && !m.target.dead &&
        U.dist2(m.x, m.y, m.target.x, m.target.y) < (m.target.r + 10) * (m.target.r + 10)) {
      boom = true;
    }
    if (boom) {
      Game.areaDamage(m.x, m.y, m.aoe, m.dmg, 200);
      FX.explosion(m.x, m.y, '#ffb454', 0);
      AudioSys.explode(0);
      Game.trauma += 0.05;
      missiles[i] = missiles[missiles.length - 1];
      missiles.pop();
    }
  }
}

/** 客机本地飞弹：完整生命周期（追踪+爆炸+清除），纯视觉 */
function updateLocalMissiles(dt) {
  for (let i = localMissiles.length - 1; i >= 0; i--) {
    const m = localMissiles[i];
    m.life -= dt;
    if (!m.target || m.target.dead) m.target = nearestEnemy(m.x, m.y);
    if (m.target) {
      const want = U.angleTo(m.x, m.y, m.target.x, m.target.y);
      const cur = Math.atan2(m.vy, m.vx);
      const a = U.lerpAngle(cur, want, Math.min(1, dt * 6.5));
      const spd = Math.min(560, Math.hypot(m.vx, m.vy) + 620 * dt);
      m.vx = Math.cos(a) * spd;
      m.vy = Math.sin(a) * spd;
    }
    m.x += m.vx * dt;
    m.y += m.vy * dt;
    m.trailT -= dt;
    if (m.trailT <= 0) {
      m.trailT = 0.022;
      FX.trail(m.x, m.y, '#ffb454', 3.4, 0.28);
    }
    let boom = m.life <= 0;
    if (m.target && !m.target.dead &&
        U.dist2(m.x, m.y, m.target.x, m.target.y) < (m.target.r + 10) * (m.target.r + 10)) {
      boom = true;
    }
    if (boom) {
      FX.explosion(m.x, m.y, '#ffb454', 0);
      AudioSys.explode(0);
      localMissiles[i] = localMissiles[localMissiles.length - 1];
      localMissiles.pop();
    }
  }
}

function drawMissiles(ctx) {
  for (let i = 0, len = missiles.length; i < len; i++) {
    const m = missiles[i];
    const a = Math.atan2(m.vy, m.vx);
    ctx.save();
    ctx.translate(m.x, m.y);
    ctx.rotate(a);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.85;
    ctx.drawImage(glowSprite('#ffb454'), -14, -14, 28, 28);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.moveTo(9, 0);
    ctx.lineTo(-6, -4);
    ctx.lineTo(-3.5, 0);
    ctx.lineTo(-6, 4);
    ctx.closePath();
    ctx.fillStyle = '#2b1a06';
    ctx.fill();
    ctx.strokeStyle = '#ffb454';
    ctx.lineWidth = 1.8;
    ctx.stroke();
    ctx.restore();
  }
  // 客机自机本地飞弹
  for (let i = 0, len = localMissiles.length; i < len; i++) {
    const m = localMissiles[i];
    const a = Math.atan2(m.vy, m.vx);
    ctx.save();
    ctx.translate(m.x, m.y);
    ctx.rotate(a);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.85;
    ctx.drawImage(glowSprite('#ffb454'), -14, -14, 28, 28);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.moveTo(9, 0);
    ctx.lineTo(-6, -4);
    ctx.lineTo(-3.5, 0);
    ctx.lineTo(-6, 4);
    ctx.closePath();
    ctx.fillStyle = '#2b1a06';
    ctx.fill();
    ctx.strokeStyle = '#ffb454';
    ctx.lineWidth = 1.8;
    ctx.stroke();
    ctx.restore();
  }
}

/* ---------------- 经验宝石 ---------------- */
const GEM_TIERS = [
  { col: '#39e6ff', r: 5 },
  { col: '#ff5ecf', r: 6.5 },
  { col: '#ffd54d', r: 8.5 },
];

function spawnGem(x, y, val) {
  const tier = val >= 20 ? 2 : (val >= 5 ? 1 : 0);
  const a = U.rand(TAU), s = U.rand(30, 110);
  // 上限保护：超限丢弃新宝石（swap-pop 删除与环形覆盖会互相冲突，故只 push）
  if (gems.length >= 381) return;
  gems.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
    val, tier, mag: false, phase: U.rand(TAU), id: nextId() });
}

function dropGems(x, y, total) {
  let v = Math.round(total);
  while (v > 0) {
    const take = v >= 20 ? 20 : (v >= 5 ? 5 : 1);
    v -= take;
    spawnGem(x + U.rand(-14, 14), y + U.rand(-14, 14), take);
  }
}

function updateGems(dt) {
  const p = player;
  const magR2 = p.magnet * p.magnet;
  for (let i = gems.length - 1; i >= 0; i--) {
    const g = gems[i];
    if (!g.mag) {
      g.vx *= (1 - 3 * dt);
      g.vy *= (1 - 3 * dt);
      if (U.dist2(g.x, g.y, p.x, p.y) < magR2) g.mag = true;
    } else {
      const a = U.angleTo(g.x, g.y, p.x, p.y);
      const spd = Math.min(760, Math.hypot(g.vx, g.vy) + 2100 * dt);
      g.vx = Math.cos(a) * spd;
      g.vy = Math.sin(a) * spd;
    }
    g.x += g.vx * dt;
    g.y += g.vy * dt;
    if (U.dist2(g.x, g.y, p.x, p.y) < 22 * 22) {
      Game.collectGem(g);
      gems[i] = gems[gems.length - 1];
      gems.pop();
    }
  }
}

function drawGems(ctx) {
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0, len = gems.length; i < len; i++) {
    const g = gems[i];
    const T = GEM_TIERS[g.tier];
    const s = T.r * 4.6;
    ctx.globalAlpha = 0.55;
    ctx.drawImage(glowSprite(T.col), g.x - s / 2, g.y - s / 2, s, s);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  for (let i = 0, len = gems.length; i < len; i++) {
    const g = gems[i];
    const T = GEM_TIERS[g.tier];
    const rot = g.phase + Game.elapsed * 2;
    const bob = Math.sin(g.phase * 2 + Game.elapsed * 3) * 1.5;
    ctx.save();
    ctx.translate(g.x, g.y + bob);
    ctx.rotate(rot);
    ctx.beginPath();
    ctx.moveTo(0, -T.r);
    ctx.lineTo(T.r * 0.7, 0);
    ctx.lineTo(0, T.r);
    ctx.lineTo(-T.r * 0.7, 0);
    ctx.closePath();
    ctx.fillStyle = U.hexA(T.col, 0.35);
    ctx.fill();
    ctx.strokeStyle = T.col;
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.restore();
  }
}

/* ---------------- 掉落道具 ---------------- */
function spawnPickup(x, y, type) {
  pickups.push({ x, y, type, phase: U.rand(TAU), id: nextId() });
}

function updatePickups(dt) {
  const p = player;
  for (let i = pickups.length - 1; i >= 0; i--) {
    const pk = pickups[i];
    if (U.dist2(pk.x, pk.y, p.x, p.y) < 28 * 28) {
      Game.applyPickup(pk.type, pk.x, pk.y);
      // swap-and-pop 替代 O(n) splice
      pickups[i] = pickups[pickups.length - 1];
      pickups.pop();
    }
  }
}

function drawPickups(ctx) {
  for (let i = 0, len = pickups.length; i < len; i++) {
    const pk = pickups[i];
    const bob = Math.sin(pk.phase + Game.elapsed * 3.2) * 3;
    const y = pk.y + bob;
    const col = pk.type === 'heart' ? '#66ffa3' : '#ffd54d';
    const pulse = 1 + Math.sin(Game.elapsed * 5 + pk.phase) * 0.12;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.7;
    const s = 52 * pulse;
    ctx.drawImage(glowSprite(col), pk.x - s / 2, y - s / 2, s, s);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = col;
    ctx.fillStyle = U.hexA(col, 0.15);
    ctx.lineWidth = 2;
    if (pk.type === 'heart') {
      ctx.beginPath();
      ctx.arc(pk.x, y, 11, 0, TAU);
      ctx.fill(); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(pk.x - 5.5, y);
      ctx.lineTo(pk.x + 5.5, y);
      ctx.moveTo(pk.x, y - 5.5);
      ctx.lineTo(pk.x, y + 5.5);
      ctx.lineWidth = 2.6;
      ctx.stroke();
    } else {
      ctx.save();
      ctx.translate(pk.x, y);
      ctx.rotate(Game.elapsed * 1.2);
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const rr = i % 2 === 0 ? 12 : 5.5;
        const a = i / 10 * TAU - Math.PI / 2;
        if (i === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
        else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.restore();
    }
  }
}
