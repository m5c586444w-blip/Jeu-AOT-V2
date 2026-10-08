import type { VoiceId } from "./types";

/**
 * Timbres de l'orchestre (AUD.2) : synthèse soustractive WebAudio, un petit patch par note. Aucun échantillon.
 * Toute note grave (sous do3) est brève (instruments à attaque sèche) ou tenue par des cordes aiguës : aucun bourdon.
 */

export const midiToHz = (m: number): number => 440 * 2 ** ((m - 69) / 12);

export interface SynthRuntime {
  ctx: AudioContext;
  /** Bruit blanc d'une seconde, calculé sans aléa du navigateur. */
  noise: AudioBuffer | null;
}

function gainNode(rt: SynthRuntime, out: AudioNode): GainNode {
  const g = rt.ctx.createGain();
  g.connect(out);
  return g;
}

/** Sous-gain branché sur `out` : dose un partiel par rapport au fondamental. */
function sub(rt: SynthRuntime, out: AudioNode, level: number): GainNode {
  const g = rt.ctx.createGain();
  g.gain.value = level;
  g.connect(out);
  return g;
}

function env(g: GainNode, at: number, attack: number, hold: number, release: number, peak: number): void {
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(peak, at + attack);
  g.gain.setValueAtTime(peak, at + attack + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, at + attack + hold + release);
}

function osc(rt: SynthRuntime, type: OscillatorType, hz: number, at: number, end: number, out: AudioNode, cents = 0): OscillatorNode {
  const o = rt.ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(hz, at);
  if (cents !== 0) o.detune.setValueAtTime(cents, at);
  o.connect(out);
  o.start(at);
  o.stop(end);
  return o;
}

function filter(rt: SynthRuntime, type: BiquadFilterType, hz: number, q: number, out: AudioNode): BiquadFilterNode {
  const f = rt.ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = hz;
  f.Q.value = q;
  f.connect(out);
  return f;
}

function noiseSrc(rt: SynthRuntime, at: number, end: number, out: AudioNode): void {
  if (!rt.noise) return;
  const s = rt.ctx.createBufferSource();
  s.buffer = rt.noise;
  s.loop = true;
  s.connect(out);
  s.start(at);
  s.stop(end);
}

/** Vibrato doux (5 Hz, quelques centièmes de ton) sur un oscillateur déjà démarré. */
function vibrato(rt: SynthRuntime, target: OscillatorNode, at: number, end: number, cents: number): void {
  const lfo = rt.ctx.createOscillator();
  const depth = rt.ctx.createGain();
  lfo.frequency.setValueAtTime(5, at);
  depth.gain.setValueAtTime(cents, at);
  lfo.connect(depth);
  depth.connect(target.detune);
  lfo.start(at);
  lfo.stop(end);
}

/** Joue une note (ou un coup de percussion) : `dur` en secondes, `vel` de 0 à 1. */
export function playVoice(rt: SynthRuntime, out: AudioNode, voice: VoiceId, midi: number, at: number, dur: number, vel: number): void {
  const hz = midiToHz(midi);
  const g = gainNode(rt, out);
  const hold = Math.max(0.02, dur);
  switch (voice) {
    case "flute": {
      const end = at + hold + 0.3;
      const o = osc(rt, "sine", hz, at, end, g);
      osc(rt, "triangle", hz * 2, at, end, sub(rt, g, 0.15));
      vibrato(rt, o, at + 0.15, end, 6);
      noiseSrc(rt, at, at + hold * 0.5 + 0.05, filter(rt, "bandpass", Math.min(7000, hz * 2), 4, sub(rt, g, 0.05)));
      env(g, at, 0.06, hold * 0.85, 0.12, vel * 0.5);
      break;
    }
    case "hautbois": {
      const end = at + hold + 0.3;
      const f = filter(rt, "lowpass", Math.min(3600, hz * 5), 1.2, g);
      const o = osc(rt, "sawtooth", hz, at, end, filter(rt, "bandpass", Math.min(2400, hz * 3), 0.9, f));
      vibrato(rt, o, at + 0.12, end, 5);
      env(g, at, 0.04, hold * 0.85, 0.12, vel * 0.42);
      break;
    }
    case "clarinette": {
      const end = at + hold + 0.3;
      osc(rt, "square", hz, at, end, filter(rt, "lowpass", Math.min(2200, hz * 4), 0.7, g));
      env(g, at, 0.04, hold * 0.85, 0.1, vel * 0.3);
      break;
    }
    case "violon": {
      const end = at + hold + 0.3;
      const f = filter(rt, "lowpass", Math.min(5200, hz * 5), 0.8, g);
      const a = osc(rt, "sawtooth", hz, at, end, f, -6);
      osc(rt, "sawtooth", hz, at, end, f, 6);
      vibrato(rt, a, at + 0.18, end, 7);
      env(g, at, 0.07, hold * 0.85, 0.12, vel * 0.26);
      break;
    }
    case "cor": {
      const end = at + hold + 0.3;
      osc(rt, "sawtooth", hz, at, end, filter(rt, "lowpass", Math.min(1500, hz * 3.5), 0.8, g));
      env(g, at, 0.05, hold * 0.8, 0.14, vel * 0.42);
      break;
    }
    case "trompette": {
      const end = at + hold + 0.3;
      const f = filter(rt, "lowpass", 900, 1.4, g);
      f.frequency.setValueAtTime(900, at);
      f.frequency.linearRampToValueAtTime(Math.min(4200, hz * 5), at + 0.06);
      osc(rt, "sawtooth", hz, at, end, f);
      env(g, at, 0.03, hold * 0.8, 0.12, vel * 0.36);
      break;
    }
    case "piccolo": {
      const end = at + hold + 0.25;
      osc(rt, "sine", hz, at, end, g);
      osc(rt, "triangle", hz * 2, at, end, sub(rt, g, 0.2));
      env(g, at, 0.03, hold * 0.85, 0.08, vel * 0.3);
      break;
    }
    case "cordes": {
      const end = at + hold + 0.9;
      const f = filter(rt, "lowpass", Math.min(2400, hz * 4), 0.6, g);
      for (const c of [-8, 0, 8]) osc(rt, "sawtooth", hz, at, end, f, c);
      env(g, at, Math.min(0.5, hold / 3), hold * 0.6, 0.7, vel * 0.3);
      break;
    }
    case "piano": {
      const ring = Math.min(1.5, hold + 0.7);
      osc(rt, "triangle", hz, at, at + ring + 0.1, g);
      osc(rt, "sine", hz * 2, at, at + ring + 0.1, sub(rt, g, 0.3));
      env(g, at, 0.004, 0.02, ring, vel * 0.5);
      break;
    }
    case "harpe": {
      const ring = 1.1;
      osc(rt, "triangle", hz, at, at + ring + 0.1, g);
      osc(rt, "sine", hz * 3, at, at + 0.3, sub(rt, g, 0.12));
      env(g, at, 0.003, 0.01, ring, vel * 0.5);
      break;
    }
    case "pizz": {
      osc(rt, "triangle", hz, at, at + 0.4, filter(rt, "lowpass", 2400, 0.7, g));
      env(g, at, 0.003, 0.01, 0.26, vel * 0.7);
      break;
    }
    case "basse": {
      const f = filter(rt, "lowpass", 900, 0.7, g);
      osc(rt, "triangle", hz, at, at + 0.5, f);
      osc(rt, "sine", hz, at, at + 0.5, f);
      env(g, at, 0.004, 0.02, 0.32, vel * 0.7);
      break;
    }
    case "tuba": {
      osc(rt, "sawtooth", hz, at, at + hold + 0.2, filter(rt, "lowpass", 520, 0.8, g));
      env(g, at, 0.012, Math.min(0.12, hold * 0.4), 0.18, vel * 0.7);
      break;
    }
    case "caisse": {
      noiseSrc(rt, at, at + 0.2, filter(rt, "highpass", 1800, 0.8, g));
      osc(rt, "sine", 210, at, at + 0.1, sub(rt, g, 0.5));
      env(g, at, 0.002, 0.01, 0.1, vel * 0.7);
      break;
    }
    case "grosse_caisse": {
      const o = osc(rt, "sine", 110, at, at + 0.4, g);
      o.frequency.exponentialRampToValueAtTime(62, at + 0.12);
      env(g, at, 0.004, 0.02, 0.24, vel * 0.9);
      break;
    }
    case "timbale": {
      const o = osc(rt, "sine", 170, at, at + 0.6, g);
      o.frequency.exponentialRampToValueAtTime(100, at + 0.25);
      env(g, at, 0.005, 0.02, 0.4, vel * 0.9);
      break;
    }
    case "cymbale": {
      noiseSrc(rt, at, at + 1.2, filter(rt, "highpass", 5500, 0.7, g));
      env(g, at, 0.004, 0.05, 0.9, vel * 0.3);
      break;
    }
    case "triangle": {
      osc(rt, "sine", 4200, at, at + 0.7, g);
      osc(rt, "sine", 6300, at, at + 0.7, sub(rt, g, 0.5));
      env(g, at, 0.002, 0.02, 0.5, vel * 0.16);
      break;
    }
  }
}
