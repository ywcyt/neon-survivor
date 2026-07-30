'use strict';
/* ============ 游戏主逻辑 ============ */
const Game = {
  state: 'menu',
  time: 0, elapsed: 0,
  wave: 1, score: 0, kills: 0,
  combo: 0, comboT: 0, maxCombo: 0,
  spawnT: 1, trauma: 0, flash: 0,
  hitstop: 0, timeScale: 1, overT: 0,
  boss: null, pendingLevels: 0,
  pickStreak: 0, pickT: 0,
  best: { score: 0, time: 0 },
  _hash: new Map(),
  _uiTick: 0,
  CELL: 96,
  // 多人模式
  mode: 'solo', p2: null, _snapTick: 0, _remoteSnap: null, _levelUpPlayer: 0,

  init() {
    try {
      const b = JSON.parse(localStorage.getItem('neonSurvivor.best') || 'null');
      if (b && typeof b.score === 'number') this.best = b;
    } catch (e) { /* ignore */ }
    UI.setBest(this.best.score);

    addEventListener('keydown', (e) => {
      if (e.code === 'KeyM') {
        const m = AudioSys.toggleMute();
        if (this.state !== 'menu') UI.announce(m ? '已静音' : '声音开启');
        return;
      }
      if (e.code === 'Escape' || e.code === 'KeyP') {
        if (this.state === 'playing' || this.state === 'paused') this.togglePause();
        return;
      }
      if (this.state === 'levelup') {
        if (e.code === 'Digit1' || e.code === 'Numpad1') UI.pickByIndex(0);
        if (e.code === 'Digit2' || e.code === 'Numpad2') UI.pickByIndex(1);
        if (e.code === 'Digit3' || e.code === 'Numpad3') UI.pickByIndex(2);
        return;
      }
      if (e.code === 'Enter') {
        AudioSys.init(); AudioSys.resume();
        if (this.state === 'menu' || this.state === 'over') this.start();
      }
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'playing') this.togglePause();
    });

    // ---- 联机回调 ----
    Net.onConnect = () => {
      if (Net.mode === 'host') UI.setLobby('客机已连接 ✓', true);
      else if (Net.mode === 'guest') UI.setLobby('已连接主机 ✓', true);
    };
    Net.onDisconnect = () => {
      UI.setLobby('连接断开', false);
      this.mode = 'solo'; this.p2 = null;
    };
    Net.onGameStart = (seed) => {
      if (Net.mode === 'guest') this.startGuest();
    };
    Net.onRemoteLevelUp = (msg) => {
      if (Net.mode === 'guest' && msg.cards) {
        this.state = 'levelup';
        AudioSys.levelup(); AudioSys.duck(0.12);
        // 用主机发来的卡片数据构建选项
        const opts = msg.cards.map((c, i) => ({ _lvCard: c, _idx: i }));
        UI.showUpgradesRemote(opts);
      }
    };
    Net.onRemoteLevelPick = (i) => {
      if (Net.mode === 'host') {
        const opts = UI._curOpts;
        if (opts && opts[i]) {
          AudioSys.uiClick();
          applyUpgrade(opts[i]);
          if (this.pendingLevels > 0) {
            this.pendingLevels--;
            this.state = 'levelup';
            AudioSys.levelup();
            FX.ring(player.x, player.y, '#7ef9ff', 140, 4);
            const opts2 = rollUpgrades();
            UI.showUpgrades(opts2);
          } else {
            this.state = 'playing'; UI.showScreen(null); AudioSys.duck(0.3);
            Net.send({ type: 'lvdone' });
          }
        }
      }
    };
    Net.onRemoteLevelDone = () => {
      if (Net.mode === 'guest') {
        this.state = 'playing'; UI.showScreen(null); AudioSys.duck(0.3);
      }
    };
    Net.onSnapshot = (snap) => {
      if (Net.mode === 'guest') this.applySnapshot(snap);
    };
    Net.onRemotePause = () => { if (this.state === 'playing') this.togglePause(true); };
    Net.onRemoteResume = () => { if (this.state === 'paused') this.togglePause(true); };
    Net.onPeerGone = () => {
      this.mode = 'solo'; this.p2 = null;
      if (this.state === 'playing') UI.announce('队友断开连接');
    };
  },

  /* ---------- 流程 ---------- */
  start() {
    resetEntities();
    FX.clear();
    player = createPlayer();
    WeaponSys.add('blaster');
    this.state = 'playing';
    this.time = 0; this.wave = 1;
    this.score = 0; this.kills = 0;
    this.combo = 0; this.comboT = 0; this.maxCombo = 0;
    this.spawnT = 0.6; this.trauma = 0; this.flash = 0;
    this.hitstop = 0; this.timeScale = 1;
    this.boss = null; this.pendingLevels = 0;
    this.pickStreak = 0;
    AudioSys.intensity = 0;
    UI._cache = {};
    UI.weaponsDirty = true;
    UI.showScreen(null);
    World.snapCam(player.x, player.y);
    AudioSys.init();
    AudioSys.resume();
    AudioSys.startMusic();
    AudioSys.duck(0.3);
    UI.announce('第 1 波');
  },

  togglePause(fromRemote) {
    if (this.state === 'playing') {
      this.state = 'paused';
      UI.showScreen('pause');
      AudioSys.duck(0.08);
      if (!fromRemote && (this.mode === 'host' || this.mode === 'guest')) {
        Net.send({ type: 'pause' });
      }
    } else if (this.state === 'paused') {
      this.state = 'playing';
      UI.showScreen(null);
      AudioSys.duck(0.3);
      if (!fromRemote && (this.mode === 'host' || this.mode === 'guest')) {
        Net.send({ type: 'resume' });
      }
    }
  },

  gameOver() {
    this.state = 'over';
    this.timeScale = 1;
    const isRecord = this.score > this.best.score;
    if (isRecord) {
      this.best = { score: this.score, time: this.time };
      try { localStorage.setItem('neonSurvivor.best', JSON.stringify(this.best)); } catch (e) { /* ignore */ }
    }
    UI.setBest(this.best.score);
    UI.showGameOver({
      time: this.time, wave: this.wave, level: player.level,
      kills: this.kills, maxCombo: this.maxCombo,
      score: this.score, best: this.best.score,
    }, isRecord);
  },

  /* ---------- 数值 ---------- */
  hpMul() { return 1 + (this.wave - 1) * 0.22 + this.time * 0.004; },
  dmgMulE() { return 1 + (this.wave - 1) * 0.05; },

  /* ---------- 主更新 ---------- */
  update(rdt) {
    this.elapsed += rdt;
    if (this.state === 'menu') {
      World.update(rdt, World.W / 2 + Math.sin(this.elapsed * 0.1) * 260, World.H / 2 + Math.cos(this.elapsed * 0.13) * 200);
      FX.update(rdt);
      return;
    }
    if (this.state === 'paused' || this.state === 'levelup' || this.state === 'over') return;

    // 多人主机模式走独立更新
    if (this.mode === 'host' && this.p2) { this.updateMultiplayer(rdt); return; }
    // 客机：发送世界坐标输入 + 本地预测
    if (this.mode === 'guest') {
      if ((Net._inputTick = (Net._inputTick + 1) % 2) === 0) {
        const mwX = Input.mouseX + World.camX - World.vw / 2;
        const mwY = Input.mouseY + World.camY - World.vh / 2;
        Net.send({ type: 'in', mx: mwX, my: mwY, dash: Input.consumeDash() });
      }
      // 本地预测 P2 移动 & 武器（即时反馈，主机仍为权威）
      if (this.p2 && this.p2.alive) {
        const origPlayer = player;
        player = this.p2;
        updatePlayer(rdt);
        WeaponSys.update(rdt);
        player = origPlayer;
      }
      // 更新子弹/飞弹位置（避免快照间冻结）
      updateBullets(rdt);
      updateMissiles(rdt);
      // 更新本地粒子特效
      FX.update(rdt);
      return;
    }

    let dt = rdt * this.timeScale;
    if (this.hitstop > 0) { this.hitstop -= rdt; dt *= 0.12; }

    if (this.state === 'dying') {
      this.timeScale = U.lerp(this.timeScale, 0.25, Math.min(1, rdt * 4));
      this.overT -= rdt;
      FX.update(dt);
      updateEBullets(dt);
      World.update(dt, player.x, player.y);
      this.trauma = Math.max(0, this.trauma - rdt * 1.2);
      this.flash = Math.max(0, this.flash - rdt * 2);
      if (this.overT <= 0) this.gameOver();
      return;
    }

    // playing
    this.time += dt;
    const newWave = Math.floor(this.time / 30) + 1;
    if (newWave !== this.wave) {
      this.wave = newWave;
      this.onWave();
    }
    this.comboT -= dt;
    if (this.comboT <= 0) this.combo = 0;
    this.pickT -= dt;
    if (this.pickT <= 0) this.pickStreak = 0;
    this.flash = Math.max(0, this.flash - rdt * 2.4);
    this.trauma = Math.max(0, this.trauma - rdt * 1.7);

    this.director(dt);
    updatePlayer(dt);
    updateEnemies(dt);
    // 构建空间哈希供武器/碰撞复用
    this.buildHash();
    WeaponSys.update(dt);
    updateBullets(dt);
    updateMissiles(dt);
    updateEBullets(dt);
    updateGems(dt);
    updatePickups(dt);
    this.collide(dt);
    FX.update(dt);
    World.update(dt, player.x, player.y);
    if ((this._uiTick = (this._uiTick + 1) % 3) === 0) UI.updateHUD();

    if (this.pendingLevels > 0 && this.state === 'playing') this.openLevelUp();
  },

  onWave() {
    if (this.wave % 5 === 0) {
      this.spawnBoss();
    } else {
      UI.announce(`第 ${this.wave} 波`);
    }
  },

  /* ---------- 刷怪导演 ---------- */
  director(dt) {
    this.spawnT -= dt;
    if (this.spawnT > 0) return;
    const bossAlive = this.boss && !this.boss.dead;
    const interval = Math.max(0.32, 1.15 * Math.pow(0.93, this.wave - 1) - this.time * 0.0006);
    this.spawnT = interval * (bossAlive ? 1.9 : 1);
    if (enemies.length >= 240) return;
    const batch = 1 + Math.floor(this.wave / 3) + (this.time > 240 ? 1 : 0);
    for (let i = 0; i < batch; i++) this.spawnOne();
  },

  spawnOne() {
    const w = this.wave;
    const table = [{ v: 'chaser', w: Math.max(35, 100 - w * 6) }];
    if (w >= 2) table.push({ v: 'darter', w: 26 + w * 2 });
    if (w >= 3) table.push({ v: 'splitter', w: 20 });
    if (w >= 3) table.push({ v: 'shooter', w: 14 + w });
    if (w >= 4) table.push({ v: 'tank', w: 12 + w });
    const type = U.weightedPick(table);
    const pos = this.spawnPos();
    const elite = w >= 4 && Math.random() < Math.min(0.14, 0.04 + w * 0.008);
    spawnEnemy(type, pos.x, pos.y, elite, this.hpMul(), this.dmgMulE());
  },

  spawnPos() {
    const R = Math.hypot(World.vw, World.vh) / 2 + U.rand(70, 210);
    for (let i = 0; i < 6; i++) {
      const a = U.rand(TAU);
      const x = U.clamp(player.x + Math.cos(a) * R, 40, World.W - 40);
      const y = U.clamp(player.y + Math.sin(a) * R, 40, World.H - 40);
      if (Math.abs(x - World.camX) > World.vw / 2 + 30 || Math.abs(y - World.camY) > World.vh / 2 + 30) {
        return { x, y };
      }
    }
    return { x: U.rand(40, World.W - 40), y: U.rand(40, World.H - 40) };
  },

  spawnBoss() {
    UI.announce('⚠ 警告：虚空哨兵 逼近 ⚠', true);
    AudioSys.alarm();
    AudioSys.intensity = 1;
    const k = this.wave / 5;
    const a = U.rand(TAU);
    const x = U.clamp(player.x + Math.cos(a) * 620, 100, World.W - 100);
    const y = U.clamp(player.y + Math.sin(a) * 620, 100, World.H - 100);
    const e = spawnEnemy('boss', x, y, false, 1, 1);
    e.hp = e.maxHp = Math.round(1500 * k * (1 + (k - 1) * 0.55));
    e.dmg = 20 + 5 * k;
    e.spd = 62 + 4 * k;
    e.score = 1500 * k;
    this.boss = e;
    this.trauma += 0.4;
  },

  bossDown(e) {
    this.boss = null;
    AudioSys.intensity = 0;
    UI.announce('BOSS 击破！');
    AudioSys.explode(2);
    AudioSys.levelup();
    dropGems(e.x, e.y, 60);
    spawnPickup(e.x + 40, e.y, 'heart');
    spawnPickup(e.x - 40, e.y, 'nuke');
    for (let i = 0; i < 5; i++) {
      FX.explosion(e.x + U.rand(-60, 60), e.y + U.rand(-60, 60), U.pick(['#ff2ea6', '#ffd54d', '#7ef9ff']), 2);
    }
    FX.ring(e.x, e.y, '#ff2ea6', 320, 6);
    this.trauma += 1;
    this.flash = Math.max(this.flash, 0.5);
    this.hitstop = 0.12;
  },

  /* ---------- 空间哈希 ---------- */
  _cellKey(cx, cy) { return (cx << 16) | cy; },  // 数值键，避免字符串拼接 GC

  buildHash() {
    this._hash.clear();
    const C = this.CELL;
    for (const e of enemies) {
      if (e.dead) continue;
      const k = this._cellKey((e.x / C) | 0, (e.y / C) | 0);
      let arr = this._hash.get(k);
      if (!arr) { arr = []; this._hash.set(k, arr); }
      arr.push(e);
    }
  },

  queryCircle(x, y, r, cb) {
    const C = this.CELL;
    const x0 = ((x - r) / C) | 0, x1 = ((x + r) / C) | 0;
    const y0 = ((y - r) / C) | 0, y1 = ((y + r) / C) | 0;
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        const arr = this._hash.get(this._cellKey(cx, cy));
        if (!arr) continue;
        for (const e of arr) {
          if (e.dead) continue;
          const rr = r + e.r;
          if (U.dist2(x, y, e.x, e.y) <= rr * rr) {
            if (cb(e) === false) return;
          }
        }
      }
    }
  },

  /* ---------- 碰撞 ---------- */
  collide(dt) {
    const p = player;

    // 敌人分离
    for (let i = 0, len = enemies.length; i < len; i++) {
      const e = enemies[i];
      if (e.dead || e.boss) continue;
      this.queryCircle(e.x, e.y, e.r * 0.9, (o) => {
        if (o === e || o.boss) return;
        const d2 = U.dist2(e.x, e.y, o.x, o.y);
        const min = (e.r + o.r) * 0.82;
        if (d2 > 0.01 && d2 < min * min) {
          const d = Math.sqrt(d2);
          const push = (min - d) / d * 26;
          e.kx += (e.x - o.x) * push * dt;
          e.ky += (e.y - o.y) * push * dt;
        }
      });
    }

    // 玩家子弹 → 敌人
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      let removed = false;
      this.queryCircle(b.x, b.y, b.r, (e) => {
        if (b.hit && b.hit.has(e)) return;
        if (!b.hit) b.hit = new Set();
        b.hit.add(e);
        this.damageEnemy(e, b.dmg, { kb: 90, ax: b.x - b.vx * 0.01, ay: b.y - b.vy * 0.01 });
        FX.sparks(b.x, b.y, '#ffe9a3', 3, 300);
        if (b.pierce > 0) {
          b.pierce--;
        } else {
          bullets[i] = bullets[bullets.length - 1];
          bullets.pop();
          removed = true;
        }
        return false;
      });
      if (removed) continue;
    }

    // 环刃 → 敌人
    for (let wi = 0, wlen = p.weapons.length; wi < wlen; wi++) {
      const w = p.weapons[wi];
      if (w.key !== 'orbs') continue;
      const S = WeaponSys.stats(w);
      const positions = WeaponSys.orbPositions(w);
      for (let oi = 0, olen = positions.length; oi < olen; oi++) {
        const o = positions[oi];
        this.queryCircle(o.x, o.y, 14, (e) => {
          if (e.orbT > 0) return;
          e.orbT = 0.35;
          this.damageEnemy(e, S.dmg * p.dmgMul, { kb: 240, ax: p.x, ay: p.y });
          FX.sparks(o.x, o.y, '#a78bfa', 4, 320);
        });
      }
    }

    // 敌人 → 玩家
    if (p.alive) {
      this.queryCircle(p.x, p.y, 14, (e) => {
        if (p.iTime > 0) return false;
        this.hurtPlayer(e.dmg);
        const a = U.angleTo(e.x, e.y, p.x, p.y);
        p.vx += Math.cos(a) * 190;
        p.vy += Math.sin(a) * 190;
        if (!e.boss) {
          e.kx -= Math.cos(a) * 140;
          e.ky -= Math.sin(a) * 140;
        }
        return false;
      });

      // 敌方子弹 → 玩家
      for (let i = ebullets.length - 1; i >= 0; i--) {
        const b = ebullets[i];
        if (U.dist2(b.x, b.y, p.x, p.y) < (b.r + 12) * (b.r + 12)) {
          if (p.iTime <= 0) this.hurtPlayer(b.dmg);
          FX.burst(b.x, b.y, b.col, 5, 160, 4, 0.35);
          ebullets[i] = ebullets[ebullets.length - 1];
          ebullets.pop();
        }
      }
    }
  },

  /* ---------- 伤害 ---------- */
  damageEnemy(e, dmg, opts = {}) {
    if (e.dead) return;
    let crit = false;
    if (!opts.noCrit && Math.random() < player.critC) {
      dmg *= player.critM;
      crit = true;
    }
    e.hp -= dmg;
    e.flash = 0.08;
    if (!opts.silent || crit) FX.damage(e.x, e.y - e.r, dmg, crit);
    AudioSys.hit();
    if (opts.kb) {
      const a = U.angleTo(opts.ax !== undefined ? opts.ax : player.x, opts.ay !== undefined ? opts.ay : player.y, e.x, e.y);
      const kb = e.boss ? opts.kb * 0.04 : opts.kb;
      e.kx += Math.cos(a) * kb;
      e.ky += Math.sin(a) * kb;
    }
    if (e.hp <= 0) this.killEnemy(e);
  },

  areaDamage(x, y, r, dmg, kb = 0) {
    this.buildHash();
    this.queryCircle(x, y, r, (e) => {
      this.damageEnemy(e, dmg, { kb, ax: x, ay: y });
    });
  },

  killEnemy(e) {
    if (e.dead) return;
    e.dead = true;
    this.kills++;
    this.combo++;
    this.comboT = 3;
    if (this.combo > this.maxCombo) this.maxCombo = this.combo;
    this.score += Math.round(e.score * (1 + this.combo * 0.03));

    const big = e.boss ? 2 : (e.r >= 19 ? 1 : 0);
    FX.explosion(e.x, e.y, e.col, big);
    AudioSys.explode(big);
    this.trauma += e.boss ? 0.5 : (big ? 0.22 : 0.05);
    if (big) this.hitstop = Math.max(this.hitstop, 0.05);

    if (e.type === 'splitter') {
      for (let i = 0; i < 3; i++) {
        const a = U.rand(TAU);
        spawnEnemy('mini', e.x + Math.cos(a) * 16, e.y + Math.sin(a) * 16, false, this.hpMul(), this.dmgMulE());
      }
    }
    if (e.boss) {
      this.bossDown(e);
      return;
    }
    dropGems(e.x, e.y, e.xp);
    if (e.elite) {
      if (Math.random() < 0.4) spawnPickup(e.x, e.y, 'heart');
      else if (Math.random() < 0.35) spawnPickup(e.x, e.y, 'nuke');
    }
  },

  hurtPlayer(dmg) {
    const p = player;
    if (!p.alive || p.iTime > 0) return;
    p.hp -= dmg;
    p.iTime = 0.75;
    this.trauma += 0.45;
    this.flash = Math.max(this.flash, 0.22);
    AudioSys.hurt();
    FX.burst(p.x, p.y, '#ff4d6d', 12, 260, 5, 0.5);
    if (p.hp <= 0) {
      p.hp = 0;
      p.alive = false;
      this.state = 'dying';
      this.overT = 1.5;
      this.trauma = 1.2;
      this.flash = 0.7;
      FX.explosion(p.x, p.y, '#3df2ff', 2);
      FX.explosion(p.x, p.y, '#ffffff', 2);
      FX.ring(p.x, p.y, '#7ef9ff', 260, 5);
      AudioSys.explode(2);
      AudioSys.stopMusic();
    }
  },

  /* ---------- 武器触发 ---------- */
  novaBlast(S) {
    const p = player;
    FX.ring(p.x, p.y, '#5eead4', S.r, 5);
    FX.flashGlow(p.x, p.y, '#5eead4', S.r * 0.9);
    AudioSys.nova();
    this.trauma += 0.12;
    this.areaDamage(p.x, p.y, S.r, S.dmg * p.dmgMul, 340);
  },

  laserTick(w, S) {
    const p = player;
    const silent = Math.random() < 0.7;
    // 空间哈希过滤：仅检查光束长度范围内的敌人
    this.queryCircle(p.x, p.y, S.len + 24, (e) => {
      for (let bi = 0; bi < S.n; bi++) {
        const a = w.rot + bi / S.n * TAU;
        const x2 = p.x + Math.cos(a) * S.len;
        const y2 = p.y + Math.sin(a) * S.len;
        const hitR = e.r + 8;
        if (U.ptSegDist2(e.x, e.y, p.x, p.y, x2, y2) < hitR * hitR) {
          this.damageEnemy(e, S.dps * 0.1 * p.dmgMul, { silent, noCrit: false });
          if (!silent) FX.sparks(e.x, e.y, '#ff5ecf', 2, 240);
          return; // 每个敌人每 tick 仅命中一次
        }
      }
    });
  },

  /* ---------- 拾取 ---------- */
  collectGem(g) {
    this.pickStreak++;
    this.pickT = 0.9;
    AudioSys.pickup(this.pickStreak);
    FX.burst(g.x, g.y, GEM_TIERS[g.tier].col, 3, 120, 3, 0.3);
    this.gainXP(g.val);
  },

  gainXP(v) {
    const p = player;
    p.xp += v * p.xpMul;
    while (p.xp >= p.xpNext) {
      p.xp -= p.xpNext;
      p.level++;
      p.xpNext = xpFor(p.level);
      this.pendingLevels++;
    }
  },

  applyPickup(type, x, y) {
    if (type === 'heart') {
      player.hp = Math.min(player.maxHp, player.hp + 30);
      AudioSys.heart();
      FX.burst(x, y, '#66ffa3', 14, 220, 5, 0.6);
      FX.ring(x, y, '#66ffa3', 60, 3);
    } else if (type === 'nuke') {
      AudioSys.nuke();
      this.flash = 0.55;
      this.trauma += 0.8;
      this.hitstop = 0.08;
      FX.ring(x, y, '#ffd54d', 420, 8);
      this.areaDamage(player.x, player.y, 1300, 260, 500);
      for (const b of ebullets) FX.burst(b.x, b.y, b.col, 2, 90, 3, 0.3);
      ebullets.length = 0;
    }
  },

  /* ---------- 升级流程 ---------- */
  openLevelUp() {
    this.pendingLevels--;
    this.state = 'levelup';
    AudioSys.levelup();
    AudioSys.duck(0.12);
    FX.ring(player.x, player.y, '#7ef9ff', 140, 4);
    UI.showUpgrades(rollUpgrades());
  },

  chooseUpgrade(opt) {
    applyUpgrade(opt);
    if (this.pendingLevels > 0) {
      this.pendingLevels--;
      UI.showUpgrades(rollUpgrades());
    } else {
      this.state = 'playing';
      UI.showScreen(null);
      AudioSys.duck(0.3);
    }
  },

  /* ---------- 渲染 ---------- */
  render(ctx) {
    const sx = this.trauma * this.trauma * 15 * U.rand(-1, 1);
    const sy = this.trauma * this.trauma * 15 * U.rand(-1, 1);

    World.drawBackdrop(ctx);

    // 客机：用快照中 P1 位置驱动镜头
    if (this.mode === 'guest' && this._remoteSnap) {
      const sp = this._remoteSnap.p[0];
      if (sp) { World.camX = sp[0]; World.camY = sp[1]; }
    }

    ctx.save();
    ctx.translate(Math.round(World.vw / 2 - World.camX + sx), Math.round(World.vh / 2 - World.camY + sy));

    World.drawGrid(ctx);
    drawGems(ctx);
    drawPickups(ctx);
    drawEnemies(ctx);
    drawEBullets(ctx);
    if (player && this.state !== 'menu') {
      WeaponSys.draw(ctx);
      drawBullets(ctx);
      drawMissiles(ctx);
      drawPlayer(ctx);
    }
    FX.draw(ctx);

    // 绘制 P2 武器（联机模式，需先于 P2 机体）
    if (this.p2 && this.p2.alive && (this.mode === 'host' || this._remoteSnap)) {
      const origPlayer = player;
      player = this.p2;
      WeaponSys.draw(ctx);
      player = origPlayer;
    }

    // 绘制 P2（联机模式）
    if (this.p2 && this.p2.alive && (this.mode === 'host' || this._remoteSnap)) {
      drawRemotePlayer(ctx, this.p2);
    }

    ctx.restore();
  },

  /* ========== 多人联机 ========== */

  /** 主机：创建房间后开始 */
  startHost() {
    this.mode = 'host';
    this.start();
    // 创建 P2
    const p = createPlayer();
    p.x = World.W / 2 + 120; p.y = World.H / 2 - 80;
    p.col = '#ff5ecf';
    this.p2 = p;
    Net.send({ type: 'start', seed: Math.random() });
  },

  /** 客机：收到 start 后开始 */
  startGuest() {
    this.mode = 'guest';
    resetEntities();
    FX.clear();
    this.state = 'playing';
    this.time = 0; this.wave = 1;
    this.score = 0; this.kills = 0; this.combo = 0; this.maxCombo = 0;
    this.trauma = 0; this.flash = 0;
    this.boss = null; this.pendingLevels = 0;
    this._remoteSnap = null;
    player = createPlayer();
    this.p2 = createPlayer();
    this.p2.col = '#ff5ecf';
    World.snapCam(player.x, player.y);
    UI.showScreen(null);
    AudioSys.init(); AudioSys.resume(); AudioSys.startMusic(); AudioSys.duck(0.3);
    UI.announce('联机已就绪');
  },

  /** 快照序列化（主机 → 客机） */
  serializeState() {
    const TYPE_IDX = { chaser:0, darter:1, splitter:2, mini:3, tank:4, shooter:5, boss:6 };
    const COL_IDX = { '#ff5ecf':0, '#59f0ff':1, '#ffb454':2 };
    const pw = (p) => p.weapons.map(w => [w.key, w.lv, w.rot, w.cd]);
    const pp = (p) => [p.x|0, p.y|0, Math.ceil(p.hp), p.maxHp, p.alive ? 1 : 0,
      p.iTime > 0 ? 1 : 0, Math.round(p.level)];
    const snap = {
      t: this.time, w: this.wave, sc: [this.score, this.kills], co: [this.combo, this.maxCombo],
      p: [pp(player), pp(this.p2)],
      pw: [pw(player), pw(this.p2)],
      e: [], b: [], eb: [], g: [],
      bh: this.boss && !this.boss.dead ? this.boss.hp : 0,
      bm: this.boss && !this.boss.dead ? this.boss.maxHp : 0,
    };
    for (const e of enemies) {
      if (e.dead) continue;
      snap.e.push([e.x|0, e.y|0, Math.ceil(e.hp), e.r, TYPE_IDX[e.type] || 0, e.elite ? 1 : 0, e.boss ? 1 : 0, e.flash > 0 ? 1 : 0, e.col]);
    }
    for (const b of bullets) snap.b.push([b.x|0, b.y|0, b.vx|0, b.vy|0]);
    for (const b of ebullets) snap.eb.push([b.x|0, b.y|0, b.vx|0, b.vy|0, b.r, COL_IDX[b.col] || 0]);
    for (const g of gems) snap.g.push([g.x|0, g.y|0, g.tier]);
    return snap;
  },

  /** 快照应用（客机渲染） */
  applySnapshot(snap) {
    this._remoteSnap = snap;
    this.time = snap.t; this.wave = snap.w;
    this.score = snap.sc[0]; this.kills = snap.sc[1];
    this.combo = snap.co[0]; this.maxCombo = snap.co[1];
    // P1
    const d1 = snap.p[0];
    player.x = d1[0]; player.y = d1[1]; player.hp = d1[2]; player.maxHp = d1[3];
    player.alive = !!d1[4]; player.iTime = d1[5] ? 0.3 : -1;
    player.level = d1[6]; player.angle = 0;
    // P1 weapons（复用对象减少 GC）
    const pw1 = snap.pw[0] || [];
    player.weapons.length = pw1.length;
    for (let i = 0; i < pw1.length; i++) {
      const d = pw1[i];
      let w = player.weapons[i];
      if (!w) { w = {}; player.weapons[i] = w; }
      w.key = d[0]; w.lv = d[1]; w.rot = d[2] || 0; w.cd = d[3] || 0; w.tick = 0;
    }
    // P2（仅联机模式存在）
    if (this.p2) {
      const d2 = snap.p[1];
      this.p2.x = d2[0]; this.p2.y = d2[1]; this.p2.hp = d2[2]; this.p2.maxHp = d2[3];
      this.p2.alive = !!d2[4]; this.p2.iTime = d2[5] ? 0.3 : -1;
      this.p2.level = d2[6];
      // P2 weapons（复用对象减少 GC）
      const pw2 = snap.pw[1] || [];
      this.p2.weapons.length = pw2.length;
      for (let i = 0; i < pw2.length; i++) {
        const d = pw2[i];
        let w = this.p2.weapons[i];
        if (!w) { w = {}; this.p2.weapons[i] = w; }
        w.key = d[0]; w.lv = d[1]; w.rot = d[2] || 0; w.cd = d[3] || 0; w.tick = 0;
      }
    }
    // Enemies
    const TYPE_NAMES = ['chaser','darter','splitter','mini','tank','shooter','boss'];
    const COL_NAMES = ['#ff5ecf','#59f0ff','#ffb454'];
    const oldLen = enemies.length;
    enemies.length = snap.e.length;
    for (let i = 0; i < snap.e.length; i++) {
      const d = snap.e[i];
      let e = i < oldLen ? enemies[i] : null;
      if (!e) { e = {}; enemies[i] = e; }
      e.x = d[0]; e.y = d[1]; e.hp = d[2]; e.r = d[3]; e.type = TYPE_NAMES[d[4]]; e.elite = !!d[5];
      e.boss = !!d[6]; e.flash = d[7] ? 0.08 : 0; e.col = d[8]; e.dead = false;
      e.maxHp = e.maxHp || d[2];
    }
    // Bullets
    bullets.length = snap.b.length;
    for (let i = 0; i < snap.b.length; i++) {
      const d = snap.b[i];
      let b = bullets[i];
      if (!b) { b = { hit: null, life: 1, pierce: 0, dmg: 0, col: '#7ef9ff' }; bullets[i] = b; }
      b.x = d[0]; b.y = d[1]; b.vx = d[2]; b.vy = d[3];
    }
    // Enemy bullets
    ebullets.length = snap.eb.length;
    for (let i = 0; i < snap.eb.length; i++) {
      const d = snap.eb[i];
      let b = ebullets[i];
      if (!b) { b = { life: 7, dmg: 0 }; ebullets[i] = b; }
      b.x = d[0]; b.y = d[1]; b.vx = d[2]; b.vy = d[3]; b.r = d[4]; b.col = COL_NAMES[d[5]] || '#ff5ecf';
    }
    // Gems
    gems.length = snap.g.length;
    for (let i = 0; i < snap.g.length; i++) {
      const d = snap.g[i];
      let g = gems[i];
      if (!g) { g = { phase: Math.random() * TAU, mag: false, val: 1 }; gems[i] = g; }
      g.x = d[0]; g.y = d[1]; g.tier = d[2];
    }
    // Boss bar
    if (snap.bh > 0) {
      if (!this.boss) { const eb = {}; eb.hp = snap.bh; eb.maxHp = snap.bm; eb.dead = false; this.boss = eb; }
      else { this.boss.hp = snap.bh; this.boss.maxHp = snap.bm; this.boss.dead = false; }
    } else { this.boss = null; }
  },

  /** 主机：双人模式的主更新入口 */
  updateMultiplayer(rdt) {
    let dt = rdt * this.timeScale;
    if (this.hitstop > 0) { this.hitstop -= rdt; dt *= 0.12; }

    this.time += dt;
    const newWave = Math.floor(this.time / 30) + 1;
    if (newWave !== this.wave) { this.wave = newWave; this.onWave(); }

    this.comboT -= dt; if (this.comboT <= 0) this.combo = 0;
    this.pickT -= dt; if (this.pickT <= 0) this.pickStreak = 0;
    this.flash = Math.max(0, this.flash - rdt * 2.4);
    this.trauma = Math.max(0, this.trauma - rdt * 1.7);

    this.director(dt);

    // P1 & P2 移动更新
    const p1 = player;
    updatePlayer(dt);
    player = this.p2;
    updateRemotePlayer(dt);
    player = p1;

    updateEnemies(dt);
    // 构建空间哈希供武器/碰撞复用
    this.buildHash();

    // P1 & P2 武器更新
    WeaponSys.update(dt);
    player = this.p2;
    WeaponSys.update(dt);
    player = p1;

    updateBullets(dt);
    updateMissiles(dt);
    updateEBullets(dt);
    updateGemsMulti(dt);   // 双人拾取
    updatePickupsMulti(dt); // 双人拾取
    this.collideMulti(dt);  // 双人碰撞
    FX.update(dt);
    World.update(dt, player.x, player.y);
    UI.updateHUD();
    UI.updateP2HUD();

    // 发送快照
    if ((this._snapTick = (this._snapTick + 1) % 3) === 0) {
      Net.send({ type: 'snap', ...this.serializeState() });
    }

    if (this.pendingLevels > 0 && this.state === 'playing') this.openLevelUpMulti();
  },

  /** 双人碰撞 */
  collideMulti(dt) {
    // 敌人分离
    for (let i = 0, len = enemies.length; i < len; i++) {
      const e = enemies[i];
      if (e.dead || e.boss) continue;
      this.queryCircle(e.x, e.y, e.r * 0.9, (o) => {
        if (o === e || o.boss) return;
        const d2 = U.dist2(e.x, e.y, o.x, o.y);
        const min = (e.r + o.r) * 0.82;
        if (d2 > 0.01 && d2 < min * min) {
          const d = Math.sqrt(d2);
          const push = (min - d) / d * 26;
          e.kx += (e.x - o.x) * push * dt;
          e.ky += (e.y - o.y) * push * dt;
        }
      });
    }
    // 子弹 → 敌人
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i]; let removed = false;
      this.queryCircle(b.x, b.y, b.r, (e) => {
        if (b.hit && b.hit.has(e)) return;
        if (!b.hit) b.hit = new Set(); b.hit.add(e);
        this.damageEnemy(e, b.dmg, { kb: 90, ax: b.x, ay: b.y });
        FX.sparks(b.x, b.y, '#ffe9a3', 3, 300);
        if (b.pierce > 0) b.pierce--; else { bullets[i] = bullets[bullets.length - 1]; bullets.pop(); removed = true; }
        return false;
      });
      if (removed) continue;
    }
    // 环刃
    for (const pp of [player, this.p2]) {
      for (let wi = 0; wi < pp.weapons.length; wi++) {
        const w = pp.weapons[wi];
        if (w.key !== 'orbs') continue;
        const S = WeaponSys.stats(w);
        const positions = WeaponSys.orbPositionsFor(w, pp);
        for (let oi = 0; oi < positions.length; oi++) {
          const o = positions[oi];
          this.queryCircle(o.x, o.y, 14, (e) => {
            if (e.orbT > 0) return; e.orbT = 0.35;
            this.damageEnemy(e, S.dmg * pp.dmgMul, { kb: 240, ax: pp.x, ay: pp.y });
            FX.sparks(o.x, o.y, '#a78bfa', 4, 320);
          });
        }
      }
    }
    // 敌人 → 双玩家
    for (const pp of [player, this.p2]) {
      if (!pp.alive) continue;
      this.queryCircle(pp.x, pp.y, 14, (e) => {
        if (pp.iTime > 0) return false;
        this.hurtPlayerMulti(pp, e.dmg);
        return false;
      });
      for (let i = ebullets.length - 1; i >= 0; i--) {
        const b = ebullets[i];
        if (U.dist2(b.x, b.y, pp.x, pp.y) < (b.r + 12) * (b.r + 12)) {
          if (pp.iTime <= 0) this.hurtPlayerMulti(pp, b.dmg);
          FX.burst(b.x, b.y, b.col, 5, 160, 4, 0.35);
          ebullets[i] = ebullets[ebullets.length - 1]; ebullets.pop();
        }
      }
    }
  },

  hurtPlayerMulti(pp, dmg) {
    if (pp.iTime > 0) return;
    pp.hp -= dmg; pp.iTime = 0.75;
    this.trauma += 0.35; this.flash = Math.max(this.flash, 0.18);
    AudioSys.hurt();
    FX.burst(pp.x, pp.y, '#ff4d6d', 10, 220, 4, 0.4);
    if (pp.hp <= 0) {
      pp.hp = 0; pp.alive = false;
      if (pp === player) { this.state = 'dying'; this.overT = 1.5; this.trauma = 1.2; this.flash = 0.7;
        FX.explosion(pp.x, pp.y, '#3df2ff', 2); AudioSys.stopMusic(); }
      else { FX.explosion(pp.x, pp.y, '#ff5ecf', 1); }
    }
  },

  /** 双人升级流程 */
  openLevelUpMulti() {
    this.pendingLevels--;
    this._levelUpPlayer = 0; // P1 always picks first
    this.state = 'levelup';
    AudioSys.levelup(); AudioSys.duck(0.12);
    FX.ring(player.x, player.y, '#7ef9ff', 140, 4);
    const opts = rollUpgrades();
    // 发送升级选项给客机
    Net.send({ type: 'lvup', who: 1, cards: opts.map(o => upgradeCardMeta(o)) });
    UI.showUpgrades(opts);
  },

  chooseUpgradeMulti(opt) {
    applyUpgrade(opt);
    // 通知客机选了哪张卡
    Net.send({ type: 'lvpick', i: opt._idx });
    if (this.pendingLevels > 0) {
      this.pendingLevels--;
      this.state = 'levelup';
      AudioSys.levelup();
      FX.ring(player.x, player.y, '#7ef9ff', 140, 4);
      const opts2 = rollUpgrades();
      Net.send({ type: 'lvup', who: 1, cards: opts2.map(o => upgradeCardMeta(o)) });
      UI.showUpgrades(opts2);
    } else {
      this.state = 'playing'; UI.showScreen(null); AudioSys.duck(0.3);
      Net.send({ type: 'lvdone' });
    }
  },
};
