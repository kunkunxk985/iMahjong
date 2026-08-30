/**
 * Synthesized sound effects using Web Audio API.
 * No external audio files needed — all sounds are generated procedurally.
 */

let ctx: AudioContext | null = null;
let _muted = false;

function getCtx(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext();
  }
  if (ctx.state === 'suspended') {
    ctx.resume();
  }
  return ctx;
}

export function isMuted(): boolean {
  return _muted;
}

export function toggleMute(): boolean {
  _muted = !_muted;
  return _muted;
}

/* ─── Helpers ─────────────────────────────────────────────── */

let cachedNoiseBuf: AudioBuffer | null = null;

function getNoiseBuffer(ac: AudioContext): AudioBuffer {
  if (!cachedNoiseBuf || cachedNoiseBuf.sampleRate !== ac.sampleRate) {
    const len = Math.floor(ac.sampleRate * 0.5);
    cachedNoiseBuf = ac.createBuffer(1, len, ac.sampleRate);
    const data = cachedNoiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = Math.random() * 2 - 1;
    }
  }
  return cachedNoiseBuf;
}

function noise(ac: AudioContext, _duration: number, _gain: number): AudioBufferSourceNode {
  const buf = getNoiseBuffer(ac);
  const src = ac.createBufferSource();
  src.buffer = buf;
  return src;
}

function beep(
  ac: AudioContext,
  freq: number,
  duration: number,
  type: OscillatorType = 'sine',
): { osc: OscillatorNode; gain: GainNode } {
  const osc = ac.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.18, ac.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration);
  osc.connect(gain);
  return { osc, gain };
}

/* ─── Sound Effects ───────────────────────────────────────── */

/** Short percussive click — tile hitting the table */
export function playDiscard(): void {
  if (_muted) return;
  const ac = getCtx();
  const t = ac.currentTime;

  // Sharp click from filtered noise
  const src = noise(ac, 0.08, 0.6);
  const bp = ac.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 1800;
  bp.Q.value = 2.0;
  const env = ac.createGain();
  env.gain.setValueAtTime(0.45, t);
  env.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
  src.connect(bp).connect(env).connect(ac.destination);
  src.start(t);
  src.stop(t + 0.08);

  // Low thud
  const osc = ac.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(220, t);
  osc.frequency.exponentialRampToValueAtTime(80, t + 0.06);
  const g2 = ac.createGain();
  g2.gain.setValueAtTime(0.25, t);
  g2.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
  osc.connect(g2).connect(ac.destination);
  osc.start(t);
  osc.stop(t + 0.09);
}

/** Soft slide sound — drawing a tile from the wall */
export function playDraw(): void {
  if (_muted) return;
  const ac = getCtx();
  const t = ac.currentTime;

  const src = noise(ac, 0.12, 0.3);
  const hp = ac.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.setValueAtTime(4000, t);
  hp.frequency.exponentialRampToValueAtTime(800, t + 0.1);
  const env = ac.createGain();
  env.gain.setValueAtTime(0.15, t);
  env.gain.linearRampToValueAtTime(0.22, t + 0.03);
  env.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  src.connect(hp).connect(env).connect(ac.destination);
  src.start(t);
  src.stop(t + 0.13);
}

/** Double knock — peng (碰) */
export function playPeng(): void {
  if (_muted) return;
  const ac = getCtx();
  const t = ac.currentTime;

  for (let i = 0; i < 2; i++) {
    const offset = i * 0.07;
    const { osc, gain } = beep(ac, 660 + i * 120, 0.1, 'triangle');
    gain.gain.setValueAtTime(0.28, t + offset);
    gain.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.09);
    gain.connect(ac.destination);
    osc.start(t + offset);
    osc.stop(t + offset + 0.1);
  }
}

/** Triple heavy knock — gang (杠) */
export function playGang(): void {
  if (_muted) return;
  const ac = getCtx();
  const t = ac.currentTime;

  for (let i = 0; i < 3; i++) {
    const offset = i * 0.06;
    const { osc, gain } = beep(ac, 520 + i * 80, 0.1, 'square');
    gain.gain.setValueAtTime(0.22, t + offset);
    gain.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.09);
    gain.connect(ac.destination);
    osc.start(t + offset);
    osc.stop(t + offset + 0.1);
  }
}

/** Quick ascending pair — chi (吃) */
export function playChi(): void {
  if (_muted) return;
  const ac = getCtx();
  const t = ac.currentTime;

  const freqs = [523, 659];
  for (let i = 0; i < freqs.length; i++) {
    const offset = i * 0.08;
    const { osc, gain } = beep(ac, freqs[i]!, 0.12, 'sine');
    gain.gain.setValueAtTime(0.2, t + offset);
    gain.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.11);
    gain.connect(ac.destination);
    osc.start(t + offset);
    osc.stop(t + offset + 0.12);
  }
}

/** Rising chord — hu (胡牌) celebration */
export function playHu(): void {
  if (_muted) return;
  const ac = getCtx();
  const t = ac.currentTime;

  const notes = [523, 659, 784, 1047]; // C5 E5 G5 C6
  for (let i = 0; i < notes.length; i++) {
    const offset = i * 0.12;
    const duration = 0.5 - i * 0.05;
    const { osc, gain } = beep(ac, notes[i]!, duration, 'sine');
    gain.gain.setValueAtTime(0.22, t + offset);
    gain.gain.linearRampToValueAtTime(0.25, t + offset + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, t + offset + duration);
    gain.connect(ac.destination);
    osc.start(t + offset);
    osc.stop(t + offset + duration + 0.01);
  }
}

/** Short tick — countdown warning */
export function playTick(): void {
  if (_muted) return;
  const ac = getCtx();
  const t = ac.currentTime;

  const { osc, gain } = beep(ac, 1200, 0.06, 'sine');
  gain.gain.setValueAtTime(0.15, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
  gain.connect(ac.destination);
  osc.start(t);
  osc.stop(t + 0.06);
}

/** Gentle chime — it's your turn */

/** Quick buzz — illegal action / claim rejected */
export function playReject(): void {
  if (_muted) return;
  const ac = getCtx();
  const t = ac.currentTime;
  const osc = ac.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(180, t);
  osc.frequency.exponentialRampToValueAtTime(90, t + 0.1);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.12, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
  const bp = ac.createBiquadFilter();
  bp.type = 'lowpass';
  bp.frequency.value = 600;
  osc.connect(bp).connect(g).connect(ac.destination);
  osc.start(t);
  osc.stop(t + 0.12);
}

/** Soft chime cluster — settlement / draw closure */
export function playSettle(): void {
  if (_muted) return;
  const ac = getCtx();
  const t = ac.currentTime;
  const notes = [523, 659, 784];
  for (let i = 0; i < notes.length; i++) {
    const offset = i * 0.1;
    const { osc, gain } = beep(ac, notes[i]!, 0.35, 'sine');
    gain.gain.setValueAtTime(0.12, t + offset);
    gain.gain.linearRampToValueAtTime(0.16, t + offset + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.35);
    gain.connect(ac.destination);
    osc.start(t + offset);
    osc.stop(t + offset + 0.36);
  }
}

/** Ultra-light tick — button hover feedback */
export function playHover(): void {
  if (_muted) return;
  const ac = getCtx();
  const t = ac.currentTime;
  const { osc, gain } = beep(ac, 2200, 0.03, 'sine');
  gain.gain.setValueAtTime(0.04, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
  gain.connect(ac.destination);
  osc.start(t);
  osc.stop(t + 0.04);
}
export function playMyTurn(): void {
  if (_muted) return;
  const ac = getCtx();
  const t = ac.currentTime;

  const { osc, gain } = beep(ac, 880, 0.2, 'sine');
  gain.gain.setValueAtTime(0.18, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
  gain.connect(ac.destination);
  osc.start(t);
  osc.stop(t + 0.2);

  const { osc: o2, gain: g2 } = beep(ac, 1100, 0.15, 'sine');
  g2.gain.setValueAtTime(0.14, t + 0.1);
  g2.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
  g2.connect(ac.destination);
  o2.start(t + 0.1);
  o2.stop(t + 0.24);
}
