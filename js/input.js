'use strict';
/* ============ 输入：键盘 + 鼠标 + 触屏虚拟摇杆 ============ */
const Input = {
  keys: Object.create(null),
  joy: { active: false, id: null, ox: 0, oy: 0, x: 0, y: 0 },
  dashQueued: false,
  joyEl: null, stickEl: null,
  mouseX: 0, mouseY: 0, lastMouseMove: 0, _mwCache: { x: 0, y: 0 },

  init(canvas) {
    addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      if (!e.repeat) {
        if (e.code === 'Space' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.dashQueued = true;
      }
      this.keys[e.code] = true;
    });
    addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    addEventListener('blur', () => { this.keys = Object.create(null); this.joy.active = false; });

    // 全局鼠标追踪（每 3 帧更新一次，减少开销）
    let _mmThrottle = 0;
    document.addEventListener('mousemove', (e) => {
      if (++_mmThrottle % 3 !== 0) return;
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
      this.lastMouseMove = performance.now();
    });
    // 左键按下 → 立即冲刺
    document.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
      this.lastMouseMove = performance.now();
      if (typeof Game !== 'undefined' && Game.state === 'playing') {
        this.dashQueued = true;
      }
    });
    // 触屏时清掉鼠标时间戳，回退到摇杆
    canvas.addEventListener('touchstart', () => { this.lastMouseMove = 0; }, { passive: true });

    this.joyEl = document.getElementById('joystick');
    this.stickEl = document.getElementById('stick');
    const dashBtn = document.getElementById('dashBtn');

    const onStart = (e) => {
      document.body.classList.add('touch');
      if (typeof Game === 'undefined' || Game.state !== 'playing') return;
      for (const t of e.changedTouches) {
        if (t.clientX < innerWidth * 0.62 && !this.joy.active) {
          e.preventDefault();
          this.joy.active = true;
          this.joy.id = t.identifier;
          this.joy.ox = t.clientX;
          this.joy.oy = t.clientY;
          this.joy.x = 0; this.joy.y = 0;
          this.joyEl.style.display = 'block';
          this.joyEl.style.left = (t.clientX - 55) + 'px';
          this.joyEl.style.top = (t.clientY - 55) + 'px';
          this.stickEl.style.transform = 'translate(0px,0px)';
        }
      }
    };
    const onMove = (e) => {
      for (const t of e.changedTouches) {
        if (this.joy.active && t.identifier === this.joy.id) {
          e.preventDefault();
          let dx = t.clientX - this.joy.ox, dy = t.clientY - this.joy.oy;
          const l = Math.hypot(dx, dy), max = 48;
          if (l > max) { dx = dx / l * max; dy = dy / l * max; }
          this.joy.x = dx / max;
          this.joy.y = dy / max;
          this.stickEl.style.transform = `translate(${dx}px,${dy}px)`;
        }
      }
    };
    const onEnd = (e) => {
      for (const t of e.changedTouches) {
        if (this.joy.active && t.identifier === this.joy.id) {
          this.joy.active = false;
          this.joy.x = 0; this.joy.y = 0;
          this.joyEl.style.display = 'none';
        }
      }
    };
    canvas.addEventListener('touchstart', onStart, { passive: false });
    canvas.addEventListener('touchmove', onMove, { passive: false });
    canvas.addEventListener('touchend', onEnd);
    canvas.addEventListener('touchcancel', onEnd);

    dashBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.dashQueued = true;
    }, { passive: false });
    dashBtn.addEventListener('click', (e) => { e.preventDefault(); this.dashQueued = true; });
  },

  _mvCache: { x: 0, y: 0 },

  getMove() {
    let x = 0, y = 0;
    if (this.keys.KeyW || this.keys.ArrowUp) y -= 1;
    if (this.keys.KeyS || this.keys.ArrowDown) y += 1;
    if (this.keys.KeyA || this.keys.ArrowLeft) x -= 1;
    if (this.keys.KeyD || this.keys.ArrowRight) x += 1;
    if (this.joy.active) { x = this.joy.x; y = this.joy.y; }
    const l = Math.hypot(x, y);
    if (l > 1) { x /= l; y /= l; }
    this._mvCache.x = x;
    this._mvCache.y = y;
    return this._mvCache;
  },

  consumeDash() {
    const d = this.dashQueued;
    this.dashQueued = false;
    return d;
  },

  /** 鼠标屏幕坐标 → 世界坐标（复用对象，避免 GC） */
  getMouseWorld() {
    this._mwCache.x = this.mouseX + World.camX - World.vw / 2;
    this._mwCache.y = this.mouseY + World.camY - World.vh / 2;
    return this._mwCache;
  },

  /** 最近 3 秒内有鼠标活动则为桌面模式 */
  get usingMouse() {
    return performance.now() - this.lastMouseMove < 3000;
  },
};
