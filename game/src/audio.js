// Ember Valley — Sky Courier: all sound is synthesised live with WebAudio.
// Engine drone, wind rush, ring chimes, touchdown thud, crash and the
// delivery fanfare. Nothing is downloaded; nothing is sampled.

export class SoundBank {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.engineFilter = null;
    this.windSource = null;
    this.windGain = null;
    this.windFilter = null;
    this.muted = false;
    this.enabled = false;
  }

  // Must be called from a user gesture (click / key) the first time.
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
      this.startEngine();
      this.startWind();
      this.enabled = true;
    } catch {
      this.ctx = null;
    }
  }

  startEngine() {
    const ctx = this.ctx;
    this.engineOsc = ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 62;
    this.engineFilter = ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 320;
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0.0;
    this.engineOsc.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.master);
    this.engineOsc.start();
  }

  startWind() {
    const ctx = this.ctx;
    const len = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.windSource = ctx.createBufferSource();
    this.windSource.buffer = buffer;
    this.windSource.loop = true;
    this.windFilter = ctx.createBiquadFilter();
    this.windFilter.type = 'bandpass';
    this.windFilter.frequency.value = 500;
    this.windFilter.Q.value = 0.6;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0.0;
    this.windSource.connect(this.windFilter);
    this.windFilter.connect(this.windGain);
    this.windGain.connect(this.master);
    this.windSource.start();
  }

  // Called every frame while flying: throttle 0..1, speed m/s, airborne bool.
  update(throttle, speed, airborne) {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    const rpm = 52 + throttle * 66 + speed * 0.25;
    this.engineOsc.frequency.setTargetAtTime(rpm, t, 0.08);
    this.engineFilter.frequency.setTargetAtTime(240 + throttle * 620, t, 0.1);
    this.engineGain.gain.setTargetAtTime(airborne ? 0.05 + throttle * 0.075 : 0.02, t, 0.1);
    this.windGain.gain.setTargetAtTime(airborne ? Math.min(0.16, speed * 0.0016) : 0, t, 0.15);
    this.windFilter.frequency.setTargetAtTime(380 + speed * 9, t, 0.15);
  }

  tone(freq, dur, type, vol, when = 0, slideTo = 0) {
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  ring() {
    this.tone(880, 0.35, 'sine', 0.22);
    this.tone(1318, 0.5, 'sine', 0.18, 0.07);
    this.tone(1760, 0.6, 'sine', 0.12, 0.14);
  }

  thud() {
    this.tone(90, 0.3, 'sine', 0.5, 0, 45);
    this.tone(160, 0.18, 'triangle', 0.25, 0.02, 70);
  }

  crash() {
    this.tone(220, 0.7, 'sawtooth', 0.3, 0, 40);
    this.tone(110, 0.9, 'square', 0.2, 0.05, 30);
  }

  fanfare() {
    const notes = [523, 659, 784, 1046];
    notes.forEach((n, i) => this.tone(n, 0.5, 'triangle', 0.2, i * 0.13));
    this.tone(1318, 0.9, 'sine', 0.15, 0.55);
  }

  click() {
    this.tone(660, 0.07, 'square', 0.08);
  }

  stallWarn() {
    this.tone(440, 0.12, 'square', 0.1);
    this.tone(440, 0.12, 'square', 0.1, 0.18);
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    return this.muted;
  }
}
