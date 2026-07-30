'use strict';
/* ============ 工具函数 ============ */
const TAU = Math.PI * 2;

const U = {
  rand(a = 1, b) { return b === undefined ? Math.random() * a : a + Math.random() * (b - a); },
  randInt(a, b) { return Math.floor(U.rand(a, b + 1)); },
  pick(arr) { return arr[(Math.random() * arr.length) | 0]; },
  clamp(v, a, b) { return v < a ? a : (v > b ? b : v); },
  lerp(a, b, t) { return a + (b - a) * t; },
  dist2(ax, ay, bx, by) { const dx = bx - ax, dy = by - ay; return dx * dx + dy * dy; },
  dist(ax, ay, bx, by) { return Math.sqrt(U.dist2(ax, ay, bx, by)); },
  angleTo(ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); },
  lerpAngle(a, b, t) {
    let d = (b - a) % TAU;
    if (d > Math.PI) d -= TAU;
    if (d < -Math.PI) d += TAU;
    return a + d * t;
  },
  fmtTime(s) {
    s = Math.max(0, Math.floor(s));
    return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  },
  _hexACache: Object.create(null),
  hexA(hex, a) {
    const k = hex + a.toFixed(2);
    let v = this._hexACache[k];
    if (v) return v;
    const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    v = `rgba(${r},${g},${b},${a})`;
    this._hexACache[k] = v;
    return v;
  },
  weightedPick(items) {
    let tot = 0;
    for (const it of items) tot += it.w;
    let r = Math.random() * tot;
    for (const it of items) { r -= it.w; if (r <= 0) return it.v; }
    return items[items.length - 1].v;
  },
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  },
  ptSegDist2(px, py, ax, ay, bx, by) {
    const abx = bx - ax, aby = by - ay;
    const t = U.clamp(((px - ax) * abx + (py - ay) * aby) / ((abx * abx + aby * aby) || 1), 0, 1);
    return U.dist2(px, py, ax + abx * t, ay + aby * t);
  },
};
