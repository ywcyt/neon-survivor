'use strict';
/* ============ 世界：星空 / 星云 / 网格 / 边界 ============ */
const World = {
  W: 3200, H: 3200,
  camX: 1600, camY: 1600,
  vw: 0, vh: 0,
  t: 0,
  starLayers: [],
  nebulas: [],
  bgGrad: null,
  TILE: 1024,

  init() {
    // 三层视差星空
    this.starLayers = [];
    const defs = [
      { f: 0.22, n: 60, rMin: 0.5, rMax: 1.1, a: 0.5 },
      { f: 0.45, n: 52, rMin: 0.7, rMax: 1.6, a: 0.7 },
      { f: 0.75, n: 40, rMin: 0.9, rMax: 2.2, a: 0.95 },
    ];
    for (const d of defs) {
      const stars = [];
      for (let i = 0; i < d.n; i++) {
        stars.push({
          x: U.rand(this.TILE), y: U.rand(this.TILE),
          r: U.rand(d.rMin, d.rMax),
          tw: U.rand(TAU), tws: U.rand(0.5, 2.4),
        });
      }
      this.starLayers.push({ f: d.f, a: d.a, stars });
    }
    // 星云
    this.nebulas = [];
    const cols = [
      ['#20308f', 0.24], ['#5b1a86', 0.22], ['#0b4a5e', 0.26],
      ['#7a1650', 0.16], ['#123c73', 0.22],
    ];
    for (let i = 0; i < 5; i++) {
      const S = 440;
      const cv = document.createElement('canvas');
      cv.width = cv.height = S;
      const g = cv.getContext('2d');
      const [col, alpha] = cols[i % cols.length];
      for (let b = 0; b < 4; b++) {
        const bx = S / 2 + U.rand(-70, 70), by = S / 2 + U.rand(-70, 70);
        const br = U.rand(90, 200);
        const grad = g.createRadialGradient(bx, by, 0, bx, by, br);
        grad.addColorStop(0, U.hexA(col, alpha));
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = grad;
        g.fillRect(0, 0, S, S);
      }
      this.nebulas.push({
        img: cv,
        x: U.rand(2200), y: U.rand(2200),
        sc: U.rand(1.6, 3),
        dx: U.rand(-4, 4), dy: U.rand(-4, 4),
      });
    }
  },

  resize(w, h) {
    this.vw = w; this.vh = h;
    this.bgGrad = null;
  },

  update(dt, tx, ty) {
    this.t += dt;
    const k = Math.min(1, dt * 5.5);
    this.camX += (tx - this.camX) * k;
    this.camY += (ty - this.camY) * k;
    if (this.vw < this.W) this.camX = U.clamp(this.camX, this.vw / 2, this.W - this.vw / 2);
    else this.camX = this.W / 2;
    if (this.vh < this.H) this.camY = U.clamp(this.camY, this.vh / 2, this.H - this.vh / 2);
    else this.camY = this.H / 2;
  },

  snapCam(x, y) {
    this.camX = x; this.camY = y;
    this.update(0, x, y);
  },

  /* 屏幕空间：背景渐变 + 星云 + 星星 */
  drawBackdrop(ctx) {
    if (!this.bgGrad) {
      const g = ctx.createRadialGradient(
        this.vw * 0.5, this.vh * 0.38, 0,
        this.vw * 0.5, this.vh * 0.5, Math.max(this.vw, this.vh) * 0.75
      );
      g.addColorStop(0, '#0b0f26');
      g.addColorStop(0.55, '#070919');
      g.addColorStop(1, '#03040c');
      this.bgGrad = g;
    }
    ctx.fillStyle = this.bgGrad;
    ctx.fillRect(0, 0, this.vw, this.vh);

    // 星云（加法混合，低速视差）
    ctx.globalCompositeOperation = 'lighter';
    const span = 2600;
    for (const n of this.nebulas) {
      const f = 0.14;
      const s = n.img.width * n.sc;
      let px = (n.x + n.dx * this.t - this.camX * f) % span;
      let py = (n.y + n.dy * this.t - this.camY * f) % span;
      if (px < -s) px += span; if (px > span) px -= span;
      if (py < -s) py += span; if (py > span) py -= span;
      px -= (span - this.vw) / 2;
      py -= (span - this.vh) / 2;
      ctx.globalAlpha = 0.8;
      ctx.drawImage(n.img, px - s / 2, py - s / 2, s, s);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    // 星星
    const T = this.TILE;
    for (const layer of this.starLayers) {
      const ox = ((-this.camX * layer.f) % T + T) % T;
      const oy = ((-this.camY * layer.f) % T + T) % T;
      const nx = Math.ceil(this.vw / T) + 1;
      const ny = Math.ceil(this.vh / T) + 1;
      for (let gx = -1; gx < nx; gx++) {
        for (let gy = -1; gy < ny; gy++) {
          for (const st of layer.stars) {
            const sx = st.x + gx * T + ox;
            const sy = st.y + gy * T + oy;
            if (sx < -4 || sx > this.vw + 4 || sy < -4 || sy > this.vh + 4) continue;
            const tw = 0.55 + 0.45 * Math.sin(st.tw + this.t * st.tws);
            ctx.globalAlpha = layer.a * tw;
            ctx.fillStyle = '#cfe4ff';
            ctx.fillRect(sx, sy, st.r, st.r);
          }
        }
      }
    }
    ctx.globalAlpha = 1;
  },

  /* 世界空间：网格 + 边界 */
  drawGrid(ctx) {
    const left = this.camX - this.vw / 2 - 8;
    const right = this.camX + this.vw / 2 + 8;
    const top = this.camY - this.vh / 2 - 8;
    const bottom = this.camY + this.vh / 2 + 8;
    const GS = 128;

    ctx.lineWidth = 1;
    // 细网格
    ctx.strokeStyle = 'rgba(88,132,255,0.055)';
    ctx.beginPath();
    for (let x = Math.max(0, Math.floor(left / GS) * GS); x <= Math.min(this.W, right); x += GS) {
      ctx.moveTo(x, Math.max(0, top));
      ctx.lineTo(x, Math.min(this.H, bottom));
    }
    for (let y = Math.max(0, Math.floor(top / GS) * GS); y <= Math.min(this.H, bottom); y += GS) {
      ctx.moveTo(Math.max(0, left), y);
      ctx.lineTo(Math.min(this.W, right), y);
    }
    ctx.stroke();
    // 粗网格
    ctx.strokeStyle = 'rgba(96,180,255,0.1)';
    ctx.beginPath();
    const GB = 512;
    for (let x = Math.max(0, Math.floor(left / GB) * GB); x <= Math.min(this.W, right); x += GB) {
      ctx.moveTo(x, Math.max(0, top));
      ctx.lineTo(x, Math.min(this.H, bottom));
    }
    for (let y = Math.max(0, Math.floor(top / GB) * GB); y <= Math.min(this.H, bottom); y += GB) {
      ctx.moveTo(Math.max(0, left), y);
      ctx.lineTo(Math.min(this.W, right), y);
    }
    ctx.stroke();

    // 边界墙
    ctx.save();
    ctx.strokeStyle = 'rgba(34,211,238,0.12)';
    ctx.lineWidth = 16;
    ctx.strokeRect(0, 0, this.W, this.H);
    ctx.shadowColor = '#22d3ee';
    ctx.shadowBlur = 14;
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(0, 0, this.W, this.H);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(94,234,212,0.55)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([26, 20]);
    ctx.lineDashOffset = -this.t * 70;
    ctx.strokeRect(-6, -6, this.W + 12, this.H + 12);
    ctx.setLineDash([]);
    ctx.restore();
  },
};
