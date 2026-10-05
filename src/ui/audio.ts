import { t } from "../i18n";
import type { GameState } from "../sim/core/state";
import { toAbsoluteDay } from "../sim/core/time";
import type { BattleState } from "../sim/tactical/types";

/**
 * Audio (04 §7, P8) : synthèse WebAudio uniquement, aucun échantillon externe, aucune musique de l'œuvre.
 * - Musique originale en trois couches adaptatives (calme, tension, combat) qui se croisent selon l'état ;
 *   accents de Marley (caisse claire, fanfare) et d'Hizuru (cordes pincées, gamme in) selon la nation jouée.
 * - SFX : gaz d'ODM, câbles, lames, impacts, pas de Titan, cris lointains, canons, cloches, tampon, papier, encre.
 * - Mixage : ducking lors des événements majeurs, silence dramatique ; volumes réglables ; sous-titres des sons importants.
 * La partie « composition » (humeur, couches, partition d'une mesure, gains) est pure et testée sans navigateur.
 */

export type Mood = "calme" | "tension" | "combat";
export type Accent = "paradis" | "marley" | "hizuru";
export type Voice = "corde" | "orgue" | "cuivre" | "choeur" | "timbale" | "caisse" | "pluck" | "pulse";
export type Sfx = "gaz" | "cable" | "lame" | "impact_chair" | "impact_pierre" | "pas_titan" | "cri" | "canon" | "cloche" | "tampon" | "papier" | "encre" | "transformation";

export const MOODS: readonly Mood[] = ["calme", "tension", "combat"];
export const SFX_IDS: readonly Sfx[] = ["gaz", "cable", "lame", "impact_chair", "impact_pierre", "pas_titan", "cri", "canon", "cloche", "tampon", "papier", "encre", "transformation"];
/** Sons « importants » sous-titrés (accessibilité, 09 ACC). */
export const CAPTIONED: ReadonlySet<Sfx> = new Set<Sfx>(["pas_titan", "cri", "canon", "cloche", "transformation"]);

export interface Volumes {
  master: number;
  music: number;
  sfx: number;
  subtitles: boolean;
}

export interface MoodInput {
  battle: boolean;
  pendingBattle: boolean;
  expeditionOut: boolean;
  atWar: boolean;
  recentAlerts: number;
}

/** Signaux de l'état qui règlent l'humeur ; `battle` vaut vrai quand une scène tactique est ouverte. */
export function moodInput(s: GameState, battle: boolean): MoodInput {
  const today = toAbsoluteDay(s.date);
  const exps = s.military?.expeditions ?? [];
  const player = s.nations?.player ?? "fac_paradis";
  return {
    battle,
    pendingBattle: exps.some((e) => e.pending !== null),
    expeditionOut: exps.some((e) => e.status === "en_route"),
    atWar: (s.nations?.wars ?? []).some((w) => w.split("|").includes(player)),
    recentAlerts: (s.strategic?.log ?? []).filter((l) => l.pause && today - toAbsoluteDay(l.date) <= 10).length,
  };
}

/** Combat en bataille ; tension si une bataille attend, une expédition est dehors, la nation est en guerre ou une alerte est récente. */
export function moodOf(i: MoodInput): Mood {
  if (i.battle) return "combat";
  if (i.pendingBattle || i.expeditionOut || i.atWar || i.recentAlerts > 0) return "tension";
  return "calme";
}

/** Gains cibles des trois couches : la couche inférieure persiste en sourdine sous la supérieure. */
export function layerTargets(m: Mood): Record<Mood, number> {
  if (m === "combat") return { calme: 0, tension: 0.45, combat: 1 };
  if (m === "tension") return { calme: 0.3, tension: 1, combat: 0 };
  return { calme: 1, tension: 0, combat: 0 };
}

export function accentOf(player: string | undefined): Accent {
  return player === "fac_marley" ? "marley" : player === "fac_hizuru" ? "hizuru" : "paradis";
}

/** Gains des bus : maître × musique (atténuée par le ducking, coupée par le silence) ; maître × effets. */
export function busGains(v: Volumes, ducked: boolean, silent: boolean): { music: number; sfx: number } {
  const c = (x: number): number => Math.max(0, Math.min(100, x)) / 100;
  return { music: silent ? 0 : c(v.master) * c(v.music) * (ducked ? 0.25 : 1), sfx: c(v.master) * c(v.sfx) };
}

export interface Note {
  layer: Mood;
  voice: Voice;
  /** Début en temps (noires) depuis le début de la mesure. */
  beat: number;
  /** Durée en temps. */
  dur: number;
  /** Hauteur MIDI (0 pour les percussions). */
  midi: number;
  vel: number;
}

export const TEMPO: Record<Mood, number> = { calme: 60, tension: 80, combat: 118 };
/** Gamme in d'Hizuru sur ré (ré, mi♭, sol, la, si♭). */
export const IN_SCALE = [62, 63, 67, 69, 70] as const;
const PROGRESSION: Record<Mood, readonly (readonly number[])[]> = {
  // ré mineur, si♭, fa, do : grave et ample.
  calme: [[50, 57, 62, 65], [46, 58, 62, 65], [53, 57, 60, 65], [48, 55, 60, 64]],
  // pédale de ré, mi♭ phrygien : l'inquiétude.
  tension: [[50, 57, 62, 65], [51, 58, 63, 67], [50, 57, 62, 65], [51, 55, 63, 66]],
  // ré mineur, si♭, do, la majeur : la poussée.
  combat: [[50, 57, 62, 65], [46, 58, 62, 65], [48, 55, 60, 64], [45, 57, 61, 64]],
};

/** Partition d'une mesure (4 temps), déterministe : l'humeur, l'accent et le numéro de mesure suffisent. */
export function scoreBar(mood: Mood, accent: Accent, bar: number): Note[] {
  const notes: Note[] = [];
  const layers = layerTargets(mood);
  const chordOf = (m: Mood): readonly number[] => PROGRESSION[m][bar % 4] ?? [50, 57, 62, 65];
  if (layers.calme > 0) {
    const ch = chordOf("calme");
    for (const n of ch) notes.push({ layer: "calme", voice: "corde", beat: 0, dur: 4, midi: n, vel: 0.22 });
    if (bar % 2 === 0) notes.push({ layer: "calme", voice: "orgue", beat: 0, dur: 8, midi: (ch[0] ?? 50) - 12, vel: 0.18 });
    if (accent === "hizuru") for (let i = 0; i < 3; i++) notes.push({ layer: "calme", voice: "pluck", beat: i * 1.5, dur: 1, midi: IN_SCALE[(bar * 3 + i * 2) % IN_SCALE.length] ?? 62, vel: 0.3 });
    else if (bar % 4 === 3) notes.push({ layer: "calme", voice: "choeur", beat: 0, dur: 4, midi: (ch[2] ?? 62), vel: 0.12 });
  }
  if (layers.tension > 0) {
    const ch = chordOf("tension");
    for (let b = 0; b < 4; b++) notes.push({ layer: "tension", voice: "pulse", beat: b, dur: 0.5, midi: (ch[0] ?? 50) - 12, vel: b === 0 ? 0.4 : 0.26 });
    notes.push({ layer: "tension", voice: "orgue", beat: 0, dur: 4, midi: ch[1] ?? 57, vel: 0.12 });
    notes.push({ layer: "tension", voice: "corde", beat: 2, dur: 2, midi: ch[3] ?? 65, vel: 0.16 });
    if (accent === "marley") for (let b = 0; b < 8; b++) notes.push({ layer: "tension", voice: "caisse", beat: b * 0.5, dur: 0.1, midi: 0, vel: b % 2 === 0 ? 0.22 : 0.1 });
    if (accent === "hizuru") notes.push({ layer: "tension", voice: "pluck", beat: 3, dur: 1, midi: IN_SCALE[bar % IN_SCALE.length] ?? 62, vel: 0.28 });
  }
  if (layers.combat > 0) {
    const ch = chordOf("combat");
    for (const b of [0, 1.5, 2, 3]) notes.push({ layer: "combat", voice: "timbale", beat: b, dur: 0.5, midi: 0, vel: b === 0 ? 0.6 : 0.4 });
    for (const b of [1, 3]) notes.push({ layer: "combat", voice: "caisse", beat: b, dur: 0.15, midi: 0, vel: 0.3 });
    // Cuivres : quintes et quartes de fanfare (Marley appuie la fanfare).
    const brass = accent === "marley" ? [[0, 0], [0.5, 7], [1, 12], [2, 7]] : [[0, 0], [2, 7]];
    for (const [beat, iv] of brass) notes.push({ layer: "combat", voice: "cuivre", beat: beat ?? 0, dur: 0.9, midi: (ch[0] ?? 50) + (iv ?? 0), vel: 0.24 });
    notes.push({ layer: "combat", voice: "choeur", beat: 0, dur: 4, midi: ch[2] ?? 62, vel: 0.14 });
    for (const n of ch.slice(1)) notes.push({ layer: "combat", voice: "corde", beat: 0, dur: 4, midi: n, vel: 0.13 });
  }
  return notes;
}

export const midiToHz = (m: number): number => 440 * 2 ** ((m - 69) / 12);

/** Instantané des compteurs d'une bataille qui déclenchent des effets. */
export interface CueSnapshot {
  cuts: number;
  napes: number;
  limbs: number;
  gas: number;
  spears: number;
  transformations: number;
  grabs: number;
  hooks: number;
  dead: number;
  /** Positions des Titans debout, pour entendre leurs pas. */
  titans: number[];
}

export function cueSnapshot(st: BattleState): CueSnapshot {
  const titans: number[] = [];
  for (const x of st.titans) if (x.alive) titans.push(x.x, x.y);
  return {
    cuts: st.stats.cuts,
    napes: st.stats.napes,
    limbs: st.stats.limbs,
    gas: st.stats.gasUsed,
    spears: st.stats.spears?.thrown ?? 0,
    transformations: st.stats.transformations ?? 0,
    grabs: st.stats.grabs,
    hooks: st.soldiers.filter((s) => s.mode === "crochet").length,
    dead: st.soldiers.filter((s) => s.mode === "mort").length,
    titans,
  };
}

/** Effets d'une image de bataille d'après l'écart des compteurs (pur, déterministe). */
export function battleCues(a: CueSnapshot, b: CueSnapshot): Sfx[] {
  const out: Sfx[] = [];
  if (b.transformations > a.transformations) out.push("transformation");
  if (b.spears > a.spears) out.push("canon");
  if (b.napes > a.napes) out.push("impact_chair");
  if (b.cuts > a.cuts || b.limbs > a.limbs) out.push("lame");
  if (b.grabs > a.grabs || b.dead > a.dead) out.push("cri");
  if (b.hooks > a.hooks) out.push("cable");
  if (b.gas > a.gas + 0.05) out.push("gaz");
  let moving = false;
  for (let i = 0; i + 1 < b.titans.length && i + 1 < a.titans.length; i += 2) {
    if (Math.hypot((b.titans[i] ?? 0) - (a.titans[i] ?? 0), (b.titans[i + 1] ?? 0) - (a.titans[i + 1] ?? 0)) > 0.05) moving = true;
  }
  if (moving) out.push("pas_titan");
  return out;
}

/** Délai minimal (s) entre deux affichages d'un même sous-titre (R0.2a). */
export const CAPTION_GAP_S = 1;

/** Délai minimal entre deux occurrences d'un même effet (évite les avalanches en bataille). */
const SFX_GAP: Record<Sfx, number> = { gaz: 0.15, cable: 0.08, lame: 0.05, impact_chair: 0.1, impact_pierre: 0.12, pas_titan: 0.45, cri: 1.2, canon: 0.2, cloche: 1.5, tampon: 0.1, papier: 0.08, encre: 0.1, transformation: 1 };

export interface AudioStats {
  mood: Mood;
  accent: Accent;
  layers: Record<Mood, number>;
  notes: Record<Mood, number>;
  sfx: Partial<Record<Sfx, number>>;
  ducks: number;
  silences: number;
  captions: number;
  music: number;
  effects: number;
}

/**
 * Moteur audio : un contexte WebAudio créé au premier geste (politique de lecture automatique des navigateurs),
 * un bus musique (trois couches) et un bus effets sous un gain maître. L'horloge est celle du contexte.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private readonly layerGain = new Map<Mood, GainNode>();
  private noise: AudioBuffer | null = null;
  private nextBar = 0;
  private bar = 0;
  private duckUntil = 0;
  private silentUntil = 0;
  private readonly lastSfx = new Map<Sfx, number>();
  /** Dernier affichage de chaque sous-titre : un même texte n'est pas répété en moins de `CAPTION_GAP_S` (R0.2a). */
  private readonly lastCaption = new Map<string, number>();
  readonly stats: AudioStats = { mood: "calme", accent: "paradis", layers: layerTargets("calme"), notes: { calme: 0, tension: 0, combat: 0 }, sfx: {}, ducks: 0, silences: 0, captions: 0, music: 0, effects: 0 };

  constructor(
    private readonly factory: () => AudioContext | null,
    private volumes: Volumes,
    private readonly onCaption: (text: string) => void = () => undefined,
  ) {}

  get started(): boolean {
    return this.ctx !== null;
  }

  /** Crée le contexte (au premier geste) ; sans WebAudio, le jeu reste muet sans erreur. */
  start(): void {
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return;
    }
    const ctx = this.factory();
    if (!ctx) return;
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.connect(ctx.destination);
    this.musicBus = ctx.createGain();
    this.sfxBus = ctx.createGain();
    this.musicBus.connect(this.master);
    this.sfxBus.connect(this.master);
    for (const m of MOODS) {
      const g = ctx.createGain();
      g.gain.value = this.stats.layers[m];
      g.connect(this.musicBus);
      this.layerGain.set(m, g);
    }
    // Bruit blanc pseudo-aléatoire (générateur congruentiel : pas d'aléa du navigateur), une seconde, réutilisé.
    const len = Math.floor(ctx.sampleRate);
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    let x = 0x2545f491;
    for (let i = 0; i < len; i++) {
      x = (Math.imul(x, 1103515245) + 12345) >>> 0;
      data[i] = (x / 0xffffffff) * 2 - 1;
    }
    this.nextBar = ctx.currentTime + 0.1;
    this.applyBuses();
  }

  setVolumes(v: Volumes): void {
    this.volumes = v;
    this.applyBuses();
  }

  setAccent(a: Accent): void {
    this.stats.accent = a;
  }

  setMood(m: Mood): void {
    if (m === this.stats.mood) return;
    this.stats.mood = m;
    this.stats.layers = layerTargets(m);
    const ctx = this.ctx;
    if (!ctx) return;
    for (const l of MOODS) this.layerGain.get(l)?.gain.setTargetAtTime(this.stats.layers[l], ctx.currentTime, 1.2);
  }

  /** Ducking : la musique s'efface sous un événement majeur. */
  duck(seconds: number): void {
    this.stats.ducks++;
    if (!this.ctx) return;
    this.duckUntil = Math.max(this.duckUntil, this.ctx.currentTime + seconds);
    this.applyBuses();
  }

  /** Silence dramatique : la musique se tait, les effets restent. */
  silence(seconds: number): void {
    this.stats.silences++;
    if (!this.ctx) return;
    this.silentUntil = Math.max(this.silentUntil, this.ctx.currentTime + seconds);
    this.applyBuses();
  }

  private applyBuses(): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicBus || !this.sfxBus) return;
    const now = ctx.currentTime;
    const g = busGains(this.volumes, now < this.duckUntil, now < this.silentUntil);
    this.stats.music = g.music;
    this.stats.effects = g.sfx;
    this.musicBus.gain.setTargetAtTime(g.music, now, 0.25);
    this.sfxBus.gain.setTargetAtTime(g.sfx, now, 0.02);
  }

  /** Planifie les mesures à venir (fenêtre de 1,5 s) et rétablit les bus en fin de ducking ou de silence. */
  tick(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    this.applyBuses();
    if (this.nextBar < ctx.currentTime) this.nextBar = ctx.currentTime + 0.05;
    while (this.nextBar < ctx.currentTime + 1.5) {
      const beat = 60 / TEMPO[this.stats.mood];
      for (const n of scoreBar(this.stats.mood, this.stats.accent, this.bar)) {
        if (this.stats.layers[n.layer] <= 0) continue;
        this.voice(n, this.nextBar + n.beat * beat, n.dur * beat);
        this.stats.notes[n.layer]++;
      }
      this.nextBar += 4 * beat;
      this.bar++;
    }
  }

  private env(g: GainNode, at: number, attack: number, hold: number, release: number, peak: number): void {
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(peak, at + attack);
    g.gain.setValueAtTime(peak, at + attack + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, at + attack + hold + release);
  }

  private osc(type: OscillatorType, hz: number, at: number, end: number, out: AudioNode): OscillatorNode {
    const ctx = this.ctx as AudioContext;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(hz, at);
    o.connect(out);
    o.start(at);
    o.stop(end);
    return o;
  }

  private noiseSrc(at: number, end: number, out: AudioNode): void {
    const ctx = this.ctx as AudioContext;
    if (!this.noise) return;
    const s = ctx.createBufferSource();
    s.buffer = this.noise;
    s.loop = true;
    s.connect(out);
    s.start(at);
    s.stop(end);
  }

  private filter(type: BiquadFilterType, hz: number, q: number, out: AudioNode): BiquadFilterNode {
    const f = (this.ctx as AudioContext).createBiquadFilter();
    f.type = type;
    f.frequency.value = hz;
    f.Q.value = q;
    f.connect(out);
    return f;
  }

  /** Une note d'une couche : chaque timbre est un petit patch soustractif. */
  private voice(n: Note, at: number, dur: number): void {
    const ctx = this.ctx;
    const out = this.layerGain.get(n.layer);
    if (!ctx || !out) return;
    const g = ctx.createGain();
    g.connect(out);
    const hz = midiToHz(n.midi);
    switch (n.voice) {
      case "corde": {
        const f = this.filter("lowpass", 1400, 0.7, g);
        this.osc("sawtooth", hz, at, at + dur + 1.2, f);
        this.osc("sawtooth", hz * 1.004, at, at + dur + 1.2, f);
        this.env(g, at, Math.min(0.6, dur / 3), dur * 0.6, 1, n.vel * 0.5);
        break;
      }
      case "orgue": {
        const f = this.filter("lowpass", 900, 0.5, g);
        this.osc("square", hz, at, at + dur + 0.6, f);
        this.osc("sine", hz * 2, at, at + dur + 0.6, f);
        this.env(g, at, 0.3, dur * 0.8, 0.5, n.vel * 0.5);
        break;
      }
      case "cuivre": {
        const f = this.filter("lowpass", 500, 2, g);
        f.frequency.setValueAtTime(500, at);
        f.frequency.linearRampToValueAtTime(2600, at + 0.08);
        f.frequency.exponentialRampToValueAtTime(900, at + dur);
        this.osc("sawtooth", hz, at, at + dur + 0.3, f);
        this.env(g, at, 0.04, dur * 0.7, 0.25, n.vel);
        break;
      }
      case "choeur": {
        // Formants d'un « a » chanté, sans échantillon.
        const f1 = this.filter("bandpass", 730, 6, g);
        const f2 = this.filter("bandpass", 1090, 8, g);
        for (const d of [1, 1.006, 0.995]) {
          this.osc("sawtooth", hz * d, at, at + dur + 1.5, f1);
          this.osc("sawtooth", hz * d, at, at + dur + 1.5, f2);
        }
        this.env(g, at, 0.8, dur * 0.5, 1.4, n.vel * 1.6);
        break;
      }
      case "timbale": {
        const o = this.osc("sine", 110, at, at + 0.7, g);
        o.frequency.exponentialRampToValueAtTime(48, at + 0.3);
        this.env(g, at, 0.005, 0.02, 0.5, n.vel);
        break;
      }
      case "caisse": {
        this.noiseSrc(at, at + 0.2, this.filter("highpass", 1600, 0.8, g));
        this.env(g, at, 0.002, 0.01, 0.12, n.vel * 0.6);
        break;
      }
      case "pluck": {
        this.osc("triangle", hz, at, at + 1.6, g);
        this.osc("sine", hz * 3, at, at + 0.4, g);
        this.env(g, at, 0.004, 0.01, 1.4, n.vel);
        break;
      }
      case "pulse": {
        this.osc("sine", hz, at, at + dur + 0.3, this.filter("lowpass", 300, 1, g));
        this.env(g, at, 0.01, dur * 0.5, 0.25, n.vel);
        break;
      }
    }
  }

  /** Joue un effet ; sous-titre les sons importants si l'option est active. Retourne vrai s'il a été joué. */
  play(id: Sfx, gain = 1): boolean {
    const ctx = this.ctx;
    const out = this.sfxBus;
    if (!ctx || !out) return false;
    const now = ctx.currentTime;
    const last = this.lastSfx.get(id);
    if (last !== undefined && now - last < SFX_GAP[id]) return false;
    this.lastSfx.set(id, now);
    this.stats.sfx[id] = (this.stats.sfx[id] ?? 0) + 1;
    if (this.volumes.subtitles && CAPTIONED.has(id)) {
      const text = t(`audio.sfx.${id}`);
      const shown = this.lastCaption.get(text);
      if (shown === undefined || now - shown >= CAPTION_GAP_S) {
        this.lastCaption.set(text, now);
        this.stats.captions++;
        this.onCaption(text);
      }
    }
    const g = ctx.createGain();
    g.connect(out);
    const at = now + 0.005;
    const v = Math.max(0, Math.min(1, gain));
    switch (id) {
      case "gaz": {
        const f = this.filter("bandpass", 2400, 1.5, g);
        f.frequency.linearRampToValueAtTime(4200, at + 0.3);
        this.noiseSrc(at, at + 0.4, f);
        this.env(g, at, 0.02, 0.15, 0.2, 0.25 * v);
        break;
      }
      case "cable": {
        const o = this.osc("triangle", 1100, at, at + 0.2, g);
        o.frequency.exponentialRampToValueAtTime(260, at + 0.15);
        this.noiseSrc(at, at + 0.03, this.filter("highpass", 3000, 1, g));
        this.env(g, at, 0.003, 0.02, 0.15, 0.2 * v);
        break;
      }
      case "lame": {
        this.noiseSrc(at, at + 0.1, this.filter("highpass", 5000, 1, g));
        this.osc("sine", 2600, at, at + 0.3, g);
        this.env(g, at, 0.002, 0.02, 0.22, 0.22 * v);
        break;
      }
      case "impact_chair": {
        this.noiseSrc(at, at + 0.2, this.filter("lowpass", 450, 1, g));
        const o = this.osc("sine", 140, at, at + 0.25, g);
        o.frequency.exponentialRampToValueAtTime(60, at + 0.2);
        this.env(g, at, 0.003, 0.03, 0.15, 0.35 * v);
        break;
      }
      case "impact_pierre": {
        this.noiseSrc(at, at + 0.15, this.filter("bandpass", 1200, 2, g));
        this.osc("sine", 190, at, at + 0.15, g);
        this.env(g, at, 0.002, 0.02, 0.1, 0.3 * v);
        break;
      }
      case "pas_titan": {
        const o = this.osc("sine", 52, at, at + 0.7, g);
        o.frequency.exponentialRampToValueAtTime(28, at + 0.5);
        this.noiseSrc(at, at + 0.5, this.filter("lowpass", 160, 1, g));
        this.env(g, at, 0.01, 0.05, 0.5, 0.55 * v);
        break;
      }
      case "cri": {
        // Cri lointain, étouffé par la distance (pas de réalisme cru).
        const o = this.osc("sawtooth", 620, at, at + 0.6, this.filter("bandpass", 900, 4, g));
        o.frequency.exponentialRampToValueAtTime(340, at + 0.5);
        this.env(g, at, 0.05, 0.15, 0.35, 0.08 * v);
        break;
      }
      case "canon": {
        this.noiseSrc(at, at + 1, this.filter("lowpass", 700, 0.7, g));
        const o = this.osc("sine", 75, at, at + 0.9, g);
        o.frequency.exponentialRampToValueAtTime(35, at + 0.6);
        this.env(g, at, 0.004, 0.05, 0.8, 0.6 * v);
        break;
      }
      case "cloche": {
        // Cloche des Murs : partiels inharmoniques, longue résonance.
        for (const [r, a] of [[1, 1], [2.4, 0.5], [3, 0.35], [4.5, 0.2], [0.5, 0.4]] as const) {
          const pg = (this.ctx as AudioContext).createGain();
          pg.gain.value = a;
          pg.connect(g);
          this.osc("sine", 330 * r, at, at + 3.5, pg);
        }
        this.env(g, at, 0.005, 0.05, 3.2, 0.28 * v);
        break;
      }
      case "tampon": {
        this.osc("sine", 150, at, at + 0.1, g);
        this.noiseSrc(at, at + 0.07, this.filter("lowpass", 1600, 1, g));
        this.env(g, at, 0.002, 0.01, 0.07, 0.4 * v);
        break;
      }
      case "papier": {
        this.noiseSrc(at, at + 0.25, this.filter("bandpass", 3800, 0.6, g));
        this.env(g, at, 0.03, 0.05, 0.14, 0.12 * v);
        break;
      }
      case "encre": {
        this.noiseSrc(at, at + 0.15, this.filter("bandpass", 6000, 3, g));
        this.env(g, at, 0.01, 0.06, 0.06, 0.08 * v);
        break;
      }
      case "transformation": {
        // Tonnerre et éclair de transformation : grondement grave et onde de choc.
        this.noiseSrc(at, at + 2, this.filter("lowpass", 320, 0.7, g));
        const o = this.osc("sine", 90, at, at + 1.8, g);
        o.frequency.exponentialRampToValueAtTime(30, at + 1.4);
        this.env(g, at, 0.01, 0.2, 1.5, 0.7 * v);
        break;
      }
    }
    return true;
  }
}

/** Sous-titres des sons importants : zone vivante polie, chaque ligne s'efface après 2,5 s. */
export function mountSubtitles(parent: HTMLElement): (text: string) => void {
  const box = document.createElement("div");
  box.className = "sous-titres";
  box.setAttribute("role", "status");
  box.setAttribute("aria-live", "polite");
  parent.append(box);
  const timers = new Map<HTMLElement, number>();
  return (text: string) => {
    const label = `[${text}]`;
    // Une ligne identique encore affichée est prolongée, jamais doublée (R0.2a).
    const same = [...box.children].find((c): c is HTMLElement => c instanceof HTMLElement && c.textContent === label);
    const line = same ?? document.createElement("p");
    if (!same) {
      line.className = "sous-titres__ligne";
      line.textContent = label;
      box.append(line);
      while (box.children.length > 3) box.firstElementChild?.remove();
    }
    window.clearTimeout(timers.get(line));
    timers.set(
      line,
      window.setTimeout(() => {
        line.remove();
        timers.delete(line);
      }, 2500),
    );
  };
}

let shared: AudioEngine | null = null;

/** Moteur partagé par la carte et la scène tactique ; démarre au premier geste de l'utilisateur. */
export function sharedAudio(volumes: Volumes): AudioEngine {
  if (shared) return shared;
  const caption = mountSubtitles(document.body);
  const engine = new AudioEngine(() => (typeof window.AudioContext === "function" ? new window.AudioContext() : null), volumes, caption);
  shared = engine;
  const begin = (): void => engine.start();
  window.addEventListener("pointerdown", begin, { capture: true });
  window.addEventListener("keydown", begin, { capture: true });
  window.setInterval(() => {
    engine.tick();
    const d = document.documentElement.dataset;
    d["audio"] = engine.started ? engine.stats.mood : "muet";
    d["audioSfx"] = String(Object.values(engine.stats.sfx).reduce((a, b) => a + b, 0));
    d["audioNotes"] = String(engine.stats.notes.calme + engine.stats.notes.tension + engine.stats.notes.combat);
    d["audioMusic"] = engine.stats.music.toFixed(2);
    d["audioCaptions"] = String(engine.stats.captions);
  }, 250);
  return engine;
}
