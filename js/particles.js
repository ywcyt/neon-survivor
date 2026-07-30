'use strict';
/* ============ 粒子特效 + 伤害数字 ============ */
const GlowCache = new Map();
function glowSprite(color) {
  let c = GlowCache.get(color);
  if (c) return c;
  const S = 64;
  c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grad.addColorStop(0, 'rgba(255,255,255,0.85)');
  grad.addColorStop(0.22, U.hexA(color, 0.55));
  grad.addColorStop(0.6, U.hexA(color, 0.12));
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, S, S);
  GlowCache.set(color, c);
  return c;
}

const FX = {
  parts: [],
  nums: [],
  MAX: 1000,

  clear() { this.parts.length = 0; this.nums.length = 0; },

  _push(p) {
    if (this.parts.length >= this.MAX) return;
    this.parts.push(p);
  },

  burst(x, y, color, n = 8, spd = 220, size = 5, life = 0.5) {
    for (let i = 0; i < n; i++) {
      const a = U.rand(TAU), s = U.rand(spd * 0.3, spd);
      this._push({
        type: 'glow', x, y,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: U.rand(life * 0.5, life), maxLife: life,
        size: U.rand(size * 0.6, size * 1.4), color, drag: 3,
      });
    }
  },

  sparks(x, y, color, n = 4, spd = 320) {
    for (let i = 0; i < n; i++) {
      const a = U.rand(TAU), s = U.rand(spd * 0.4, spd);
      this._push({
        type: 'spark', x, y,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: U.rand(0.12, 0.3), maxLife: 0.3,
        size: 1, color, drag: 4,
      });
    }
  },

  shards(x, y, color, n = 7, size = 6) {
    for (let i = 0; i < n; i++) {
      const a = U.rand(TAU), s = U.rand(80, 340);
      this._push({
        type: 'shard', x, y,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: U.rand(0.4, 0.85), maxLife: 0.85,
        size: U.rand(size * 0.5, size), color,
        rot: U.rand(TAU), vr: U.rand(-9, 9), drag: 2.2,
      });
    }
  },

  ring(x, y, color, maxR = 90, width = 3) {
    this._push({
      type: 'ring', x, y, vx: 0, vy: 0,
      life: 0.45, maxLife: 0.45,
      size: maxR, width, color, drag: 0,
    });
  },

  flashGlow(x, y, color, size = 80) {
    this._push({
      type: 'glow', x, y, vx: 0, vy: 0,
      life: 0.22, maxLife: 0.22, size, color, drag: 0,
    });
  },

  trail(x, y, color, size = 4, life = 0.3) {
    this._push({
      type: 'glow', x, y,
      vx: U.rand(-14, 14), vy: U.rand(-14, 14),
      life, maxLife: life, size, color, drag: 1,
    });
  },

  ghost(x, y, angle, color) {
    this._push({
      type: 'ghost', x, y, vx: 0, vy: 0,
      life: 0.3, maxLife: 0.3, size: 16, color, rot: angle, drag: 0,
    });
  },

  explosion(x, y, color, big = 0) {
    this.flashGlow(x, y, color, 70 + big * 70);
    this.burst(x, y, color, 10 + big * 8, 200 + big * 140, 5 + big * 2, 0.55);
    this.sparks(x, y, '#ffffff', 4 + big * 4, 380);
    this.shards(x, y, color, 5 + big * 5, 6 + big * 2);
    if (big >= 1) this.ring(x, y, color, 80 + big * 60, 3.5);
  },

  damage(x, y, val, crit) {
    if (this.nums.length > 46) this.nums.shift();
    this.nums.push({
      x: x + U.rand(-8, 8), y: y - 6,
      vy: -52, life: 0.8, maxLife: 0.8,
      val: Math.max(1, Math.round(val)), crit,
    });
  },

  update(dt) {
    const ps = this.parts;
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      p.life -= dt;
      if (p.life <= 0) { ps[i] = ps[ps.length - 1]; ps.pop(); continue; }
      const d = Math.max(0, 1 - p.drag * dt);
      p.vx *= d; p.vy *= d;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.vr) p.rot += p.vr * dt;
    }
    const ns = this.nums;
    for (let i = ns.length - 1; i >= 0; i--) {
      const n = ns[i];
      n.life -= dt;
      if (n.life <= 0) { ns[i] = ns[ns.length - 1]; ns.pop(); continue; }
      n.y += n.vy * dt;
      n.vy *= (1 - 2.4 * dt);
    }
  },

  draw(ctx) {
    const ps = this.parts;
    // 加法混合层
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0, len = ps.length; i < len; i++) {
      const p = ps[i];
      const t = p.life / p.maxLife;
      if (p.type === 'glow') {
        const s = p.size * (0.5 + t) * 2.6;
        ctx.globalAlpha = t * 0.9;
        ctx.drawImage(glowSprite(p.color), p.x - s / 2, p.y - s / 2, s, s);
      } else if (p.type === 'spark') {
        ctx.globalAlpha = t;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03);
        ctx.stroke();
      } else if (p.type === 'ring') {
        const k = 1 - t;
        ctx.globalAlpha = t * 0.9;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.width * t + 0.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (0.2 + k * 0.8), 0, TAU);
        ctx.stroke();
      }
    }
    // 普通混合层
    ctx.globalCompositeOperation = 'source-over';
    for (let i = 0, len = ps.length; i < len; i++) {
      const p = ps[i];
      const t = p.life / p.maxLife;
      if (p.type === 'shard') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = t;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(p.size, 0);
        ctx.lineTo(-p.size * 0.6, p.size * 0.5);
        ctx.lineTo(-p.size * 0.6, -p.size * 0.5);
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
      } else if (p.type === 'ghost') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = t * 0.55;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(18, 0);
        ctx.lineTo(-12, -11);
        ctx.lineTo(-7, 0);
        ctx.lineTo(-12, 11);
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
      }
    }
    // 伤害数字
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const nums = this.nums;
    for (let i = 0, len = nums.length; i < len; i++) {
      const n = nums[i];
      const t = n.life / n.maxLife;
      const pop = t > 0.82 ? 1 + (t - 0.82) * 3 : 1;
      ctx.globalAlpha = Math.min(1, t * 2.2);
      ctx.font = `700 ${(n.crit ? 19 : 13.5) * pop}px Rajdhani, sans-serif`;
      ctx.strokeStyle = 'rgba(4,6,14,0.85)';
      ctx.lineWidth = 3;
      ctx.strokeText(n.val, n.x, n.y);
      ctx.fillStyle = n.crit ? '#ffd54d' : '#eaf6ff';
      ctx.fillText(n.val, n.x, n.y);
    }
    ctx.globalAlpha = 1;
  },
};
