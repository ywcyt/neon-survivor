'use strict';
/* ============ WebAudio 程序化音效 + 背景音乐 ============ */
const AudioSys = {
  ctx: null, master: null, sfxG: null, musG: null,
  delay: null, delayG: null,
  muted: false, intensity: 0,
  _lastShoot: 0, _lastHit: 0,
  _musicTimer: null, _nextNote: 0, _step: 0, _musicOn: false,

  init() {
    if (this.ctx) return;
    try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch (e) { return; }
    const c = this.ctx;
    this.master = c.createGain();
    this.master.gain.value = 0.55;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -18;
    this.master.connect(comp);
    comp.connect(c.destination);
    this.sfxG = c.createGain();
    this.sfxG.gain.value = 0.9;
    this.sfxG.connect(this.master);
    this.musG = c.createGain();
    this.musG.gain.value = 0;
    this.musG.connect(this.master);
    this.delay = c.createDelay(0.7);
    this.delay.delayTime.value = 0.27;
    this.delayG = c.createGain();
    this.delayG.gain.value = 0.34;
    this.delay.connect(this.delayG);
    this.delayG.connect(this.delay);
    this.delayG.connect(this.musG);
  },

  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.55;
    return this.muted;
  },

  now() { return this.ctx ? this.ctx.currentTime : 0; },

  tone(o) {
    if (!this.ctx || this.muted) return;
    const c = this.ctx;
    const t0 = c.currentTime + (o.at || 0);
    const dur = o.dur || 0.15;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(Math.max(20, o.f0 || 440), t0);
    if (o.f1 && o.f1 !== o.f0) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(o.vol || 0.2, t0 + (o.attack || 0.006));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    let out = g;
    if (o.lp) {
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = o.lp;
      g.connect(f);
      out = f;
    }
    out.connect(o.dest || this.sfxG);
    if (o.send && this.delay) {
      const sg = c.createGain();
      sg.gain.value = o.send;
      out.connect(sg);
      sg.connect(this.delay);
    }
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  },

  noise(o) {
    if (!this.ctx || this.muted) return;
    const c = this.ctx;
    const t0 = c.currentTime + (o.at || 0);
    const dur = o.dur || 0.3;
    const len = Math.max(1, (dur * c.sampleRate) | 0);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = o.type || 'lowpass';
    f.frequency.setValueAtTime(o.f0 || 2000, t0);
    if (o.f1) f.frequency.exponentialRampToValueAtTime(Math.max(40, o.f1), t0 + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(o.vol || 0.3, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(o.dest || this.sfxG);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  },

  /* ---- SFX ---- */
  shoot() {
    const t = this.now();
    if (t - this._lastShoot < 0.045) return;
    this._lastShoot = t;
    this.tone({ type: 'square', f0: U.rand(820, 940), f1: 150, dur: 0.09, vol: 0.075 });
  },
  hit() {
    const t = this.now();
    if (t - this._lastHit < 0.035) return;
    this._lastHit = t;
    this.noise({ dur: 0.07, vol: 0.1, f0: 1900, f1: 500 });
  },
  explode(size = 0) {
    this.noise({ dur: 0.32 + size * 0.18, vol: 0.24 + size * 0.14, f0: 2800, f1: 130 });
    this.tone({ type: 'sine', f0: 130, f1: 38, dur: 0.3 + size * 0.15, vol: 0.22 + size * 0.1 });
  },
  pickup(streak = 0) {
    const f = 590 * Math.pow(2, Math.min(streak, 14) / 14);
    this.tone({ type: 'sine', f0: f, f1: f * 1.6, dur: 0.09, vol: 0.09 });
    this.tone({ type: 'triangle', f0: f * 2, f1: f * 2.4, dur: 0.07, vol: 0.045, at: 0.02 });
  },
  heart() {
    this.tone({ type: 'sine', f0: 392, f1: 392, dur: 0.12, vol: 0.14 });
    this.tone({ type: 'sine', f0: 523, f1: 523, dur: 0.16, vol: 0.14, at: 0.09 });
  },
  levelup() {
    const seq = [523, 659, 784, 1046];
    seq.forEach((f, i) => this.tone({ type: 'triangle', f0: f, f1: f, dur: 0.16, vol: 0.13, at: i * 0.07, send: 0.4 }));
  },
  hurt() {
    this.tone({ type: 'sawtooth', f0: 230, f1: 60, dur: 0.24, vol: 0.26, lp: 1200 });
    this.noise({ dur: 0.12, vol: 0.16, f0: 900, f1: 200 });
  },
  dash() {
    this.noise({ type: 'highpass', dur: 0.16, vol: 0.11, f0: 300, f1: 2600 });
    this.tone({ type: 'sine', f0: 280, f1: 620, dur: 0.12, vol: 0.07 });
  },
  missile() {
    this.noise({ type: 'highpass', dur: 0.22, vol: 0.07, f0: 350, f1: 1400 });
    this.tone({ type: 'sawtooth', f0: 210, f1: 90, dur: 0.18, vol: 0.06, lp: 900 });
  },
  nova() {
    this.tone({ type: 'sine', f0: 320, f1: 60, dur: 0.32, vol: 0.2 });
    this.noise({ dur: 0.28, vol: 0.14, f0: 1600, f1: 200 });
  },
  nuke() {
    this.explode(2);
    this.tone({ type: 'sine', f0: 62, f1: 26, dur: 0.7, vol: 0.34 });
    this.noise({ dur: 0.8, vol: 0.2, f0: 4000, f1: 80 });
  },
  alarm() {
    for (let i = 0; i < 3; i++) {
      this.tone({ type: 'square', f0: 660, f1: 660, dur: 0.14, vol: 0.09, at: i * 0.32, lp: 2200 });
      this.tone({ type: 'square', f0: 440, f1: 440, dur: 0.14, vol: 0.09, at: i * 0.32 + 0.16, lp: 2200 });
    }
  },
  uiClick() { this.tone({ type: 'square', f0: 1200, f1: 880, dur: 0.05, vol: 0.06 }); },

  /* ---- 背景音乐 ---- */
  midi(n) { return 440 * Math.pow(2, (n - 69) / 12); },

  startMusic() {
    if (!this.ctx) return;
    if (this._musicOn) {
      if (this.musG) this.musG.gain.linearRampToValueAtTime(0.3, this.now() + 1);
      return;
    }
    this._musicOn = true;
    if (this._musicTimer) { clearInterval(this._musicTimer); this._musicTimer = null; }
    this.musG.gain.cancelScheduledValues(this.now());
    this.musG.gain.linearRampToValueAtTime(0.3, this.now() + 1.2);
    this._nextNote = this.now() + 0.1;
    this._step = 0;
    this._musicTimer = setInterval(() => this._schedule(), 30);
  },

  stopMusic() {
    this._musicOn = false;
    if (this._musicTimer) { clearInterval(this._musicTimer); this._musicTimer = null; }
    if (this.musG) {
      this.musG.gain.cancelScheduledValues(this.now());
      this.musG.gain.linearRampToValueAtTime(0.0001, this.now() + 1.2);
    }
  },

  duck(v) {
    if (this.musG) {
      this.musG.gain.cancelScheduledValues(this.now());
      this.musG.gain.linearRampToValueAtTime(v, this.now() + 0.25);
    }
  },

  _schedule() {
    if (!this.ctx || !this._musicOn) return;
    const stepDur = 60 / 118 / 2;
    while (this._nextNote < this.ctx.currentTime + 0.16) {
      this._playStep(this._step, this._nextNote - this.ctx.currentTime);
      this._step = (this._step + 1) % 32;
      this._nextNote += stepDur;
    }
  },

  _playStep(step, at) {
    if (this.muted) return;
    const chordRoots = [45, 41, 48, 43]; // A2 F2 C3 G2
    const bar = (step / 8 | 0) % 4;
    const root = chordRoots[bar];
    const inBar = step % 8;
    // bass
    if (inBar === 0 || inBar === 4 || inBar === 6) {
      const f = this.midi(root - 12);
      this.tone({ type: 'square', f0: f, f1: f, dur: inBar === 6 ? 0.14 : 0.4, vol: 0.14, at, lp: 420, dest: this.musG });
    }
    // arp
    const offs = [0, 7, 12, 19];
    const oct = this.intensity > 0 ? 24 : 12;
    const n = root + oct + offs[(step * 5 + bar) % 4];
    const f = this.midi(n);
    this.tone({ type: 'triangle', f0: f, f1: f, dur: 0.13, vol: 0.05, at, dest: this.musG, send: 0.55 });
    // hat
    if (inBar % 2 === 1) {
      this.noise({ type: 'highpass', dur: 0.03, vol: this.intensity > 0 ? 0.05 : 0.03, f0: 6500, at, dest: this.musG });
    }
  },
};
