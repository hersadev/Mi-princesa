'use strict';

// Efectos de sonido sintetizados con WebAudio (sin archivos).
const Sfx = {
  ctx: null,
  muted: false,

  unlock() {
    if (!this.ctx) {
      try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  },

  ok() { return this.ctx && !this.muted; },

  toggle() { this.muted = !this.muted; return !this.muted; },

  tone(freq, dur, type = 'square', vol = 0.06, slideTo = null, delay = 0) {
    if (!this.ok()) return;
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  },

  noise(dur = 0.2, vol = 0.15, freq = 900) {
    if (!this.ok()) return;
    const c = this.ctx, n = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = buf;
    f.type = 'lowpass';
    f.frequency.value = freq;
    g.gain.value = vol;
    s.connect(f).connect(g).connect(c.destination);
    s.start();
  },

  jump()   { this.tone(300, 0.12, 'square', 0.04, 620); },
  spring() { this.tone(180, 0.35, 'triangle', 0.09, 950); },
  trap()   { this.tone(950, 0.09, 'square', 0.05, 280); },
  bonk()   { this.tone(160, 0.12, 'square', 0.07, 90); },
  crack()  { this.noise(0.18, 0.12, 1400); },
  thud()   { this.noise(0.25, 0.2, 400); },
  blip()   { this.tone(660, 0.05, 'square', 0.04); },
  taunt()  { [520, 440, 520, 440].forEach((f, i) => this.tone(f, 0.08, 'square', 0.04, null, i * 0.08)); },
  death()  {
    this.tone(420, 0.45, 'sawtooth', 0.06, 50);
    this.noise(0.2, 0.15, 700);
  },
  win() { [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.16, 'square', 0.05, null, i * 0.11)); },
};
