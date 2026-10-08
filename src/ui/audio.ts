import { t } from "../i18n";
import { playVoice } from "../audio/instruments";
import type { SynthRuntime } from "../audio/instruments";
import { MOOD_TONE, gapSeconds, mulberry32, playSequence, renderCached } from "../audio/playlist";
import { MOOD_PIECES } from "../audio/pieces";
import type { Accent, Mood, RenderedPiece } from "../audio/types";
import { mediaElementPlayer, userTrackUrl } from "../audio/userTracks";
import type { UserPlayer } from "../audio/userTracks";
import type { GameState } from "../sim/core/state";
import { toAbsoluteDay } from "../sim/core/time";
import type { BattleState } from "../sim/tactical/types";

/**
 * Audio (04 §7, P8, AUD) : synthèse WebAudio uniquement, aucune musique de l'œuvre ni de jeu vidéo.
 * - Musique : pièces du domaine public transcrites en notes et pièces originales (`src/audio/`), rendues en événements
 *   déterministes. Classique rythmé en paix (carte, menu), marches en tension et au combat. Chaque état a ses pièces, son
 *   filtre passe-bas et son niveau ; des silences séparent les pièces ; jamais de bourdon ni de dissonance tenue (E-UX-4).
 * - Pistes de l'utilisateur (`assets_user/musique/`) : ajoutées aux listes des états, réglables dans les options.
 * - Ambiances (vent, ville, forêt, mur), sons d'interface et de notification, bruits de bataille : tous synthétisés.
 * - Mixage : quatre bus (musique, ambiances, effets, interface) sous un maître ; ducking sur les événements majeurs,
 *   silence dramatique ; option « musique en combat seulement » ; sous-titres des sons importants.
 * La partie « composition » est pure et testée sans navigateur.
 */

export type { Accent, Mood };
export type Ambience = "aucune" | "vent" | "ville" | "foret" | "mur";
export const AMBIENCES: readonly Ambience[] = ["aucune", "vent", "ville", "foret", "mur"];
export type Sfx =
  | "gaz" | "cable" | "lame" | "impact_chair" | "impact_pierre" | "pas_titan" | "cri" | "canon" | "transformation"
  | "cloche" | "tampon" | "papier" | "encre"
  | "clic" | "ouvrir" | "fermer" | "valider" | "refus" | "notification" | "alerte";

export const MOODS: readonly Mood[] = ["calme", "tension", "combat"];
export const SFX_IDS: readonly Sfx[] = [
  "gaz", "cable", "lame", "impact_chair", "impact_pierre", "pas_titan", "cri", "canon", "transformation",
  "cloche", "tampon", "papier", "encre", "clic", "ouvrir", "fermer", "valider", "refus", "notification", "alerte",
];
/** Bus de chaque effet : bataille sur « effets », tout le reste (interface, notifications, cloche) sur « interface ». */
export const SFX_BUS: Readonly<Record<Sfx, "sfx" | "ui">> = {
  gaz: "sfx", cable: "sfx", lame: "sfx", impact_chair: "sfx", impact_pierre: "sfx", pas_titan: "sfx", cri: "sfx", canon: "sfx", transformation: "sfx",
  cloche: "ui", tampon: "ui", papier: "ui", encre: "ui", clic: "ui", ouvrir: "ui", fermer: "ui", valider: "ui", refus: "ui", notification: "ui", alerte: "ui",
};
/** Sons « importants » sous-titrés (accessibilité, 09 ACC). */
export const CAPTIONED: ReadonlySet<Sfx> = new Set<Sfx>(["pas_titan", "cri", "canon", "cloche", "transformation"]);

export interface Volumes {
  master: number;
  music: number;
  ambient: number;
  sfx: number;
  ui: number;
  subtitles: boolean;
  /** La musique ne joue qu'au combat. */
  musicCombatOnly: boolean;
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


/** Fondu entre les pièces des états : seul l'état courant est audible (les pièces changent, pas de couches empilées). */
export function layerTargets(m: Mood): Record<Mood, number> {
  return { calme: m === "calme" ? 1 : 0, tension: m === "tension" ? 1 : 0, combat: m === "combat" ? 1 : 0 };
}

export function accentOf(player: string | undefined): Accent {
  return player === "fac_marley" ? "marley" : player === "fac_hizuru" ? "hizuru" : "paradis";
}

/** Gains des bus : maître × curseur du bus ; musique atténuée par le ducking, coupée par le silence ou hors combat si demandé. */
export function busGains(v: Volumes, ducked: boolean, silent: boolean, mood: Mood = "calme"): { music: number; ambient: number; sfx: number; ui: number } {
  const c = (x: number): number => Math.max(0, Math.min(100, x)) / 100;
  const muted = silent || (v.musicCombatOnly && mood !== "combat");
  return {
    music: muted ? 0 : c(v.master) * c(v.music) * (ducked ? 0.25 : 1),
    ambient: c(v.master) * c(v.ambient),
    sfx: c(v.master) * c(v.sfx),
    ui: c(v.master) * c(v.ui),
  };
}

export { midiToHz } from "../audio/instruments";

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
const SFX_GAP: Record<Sfx, number> = {
  gaz: 0.15, cable: 0.08, lame: 0.05, impact_chair: 0.1, impact_pierre: 0.12, pas_titan: 0.7, cri: 1.2, canon: 0.2, transformation: 1.5,
  cloche: 1.5, tampon: 0.1, papier: 0.08, encre: 0.1, clic: 0.04, ouvrir: 0.15, fermer: 0.15, valider: 0.15, refus: 0.2, notification: 6, alerte: 1.5,
};

/** Fenêtre de planification de la musique (s). */
export const LOOKAHEAD_S = 1.5;
/** Durée de croisement entre deux états (constante de temps, s). */
const MOOD_FADE_S = 0.9;

export interface PieceLog {
  id: string;
  mood: Mood;
  at: number;
}

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
  ambient: number;
  ui: number;
  ambience: Ambience;
  /** Pièce en cours (identifiant, ou `u:fichier` pour une piste de l'utilisateur), vide pendant un silence. */
  piece: string;
  /** Pièces commencées, dans l'ordre (les 200 dernières). */
  pieces: PieceLog[];
}

/** Bibliothèque musicale choisie dans les options : source et pistes de l'utilisateur affectées à chaque état. */
export interface MusicLibrary {
  source: "synthese" | "mixte" | "perso";
  tracks: readonly { file: string; mood: Mood }[];
}

interface Current {
  id: string;
  rendered: RenderedPiece | null;
  t0: number;
  next: number;
  user: { stop: () => void } | null;
}
interface Seq {
  counter: number;
  cur: Current | null;
  nextStart: number;
}

/** Identifiants jouables d'un état d'après la bibliothèque : pièces synthétisées et pistes de l'utilisateur. */
export function libraryIds(lib: MusicLibrary, mood: Mood): string[] {
  const synth = lib.source === "perso" ? [] : [...MOOD_PIECES[mood]];
  const own = lib.source === "synthese" ? [] : lib.tracks.filter((x) => x.mood === mood).map((x) => `u:${x.file}`);
  const all = [...synth, ...own];
  return all.length > 0 ? all : [...MOOD_PIECES[mood]];
}

/**
 * Moteur audio : un contexte WebAudio créé au premier geste (politique de lecture automatique des navigateurs),
 * quatre bus sous un gain maître, une rangée de pièces par état. L'horloge est celle du contexte.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private ambBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private uiBus: GainNode | null = null;
  private readonly deck = new Map<Mood, GainNode>();
  private noise: AudioBuffer | null = null;
  private duckUntil = 0;
  private silentUntil = 0;
  private readonly lastSfx = new Map<Sfx, number>();
  /** Dernier affichage de chaque sous-titre : un même texte n'est pas répété en moins de `CAPTION_GAP_S` (R0.2a). */
  private readonly lastCaption = new Map<string, number>();
  private readonly seq: Record<Mood, Seq> = {
    calme: { counter: 0, cur: null, nextStart: 0 },
    tension: { counter: 0, cur: null, nextStart: 0 },
    combat: { counter: 0, cur: null, nextStart: 0 },
  };
  private library: MusicLibrary = { source: "mixte", tracks: [] };
  private amb: { kind: Ambience; gain: GainNode; sources: AudioBufferSourceNode[]; oscs: OscillatorNode[] } | null = null;
  private ambNext = 0;
  private readonly ambRng = mulberry32(20261009);
  readonly stats: AudioStats = {
    mood: "calme", accent: "paradis", layers: layerTargets("calme"), notes: { calme: 0, tension: 0, combat: 0 }, sfx: {},
    ducks: 0, silences: 0, captions: 0, music: 0, effects: 0, ambient: 0, ui: 0, ambience: "aucune", piece: "", pieces: [],
  };

  constructor(
    private readonly factory: () => AudioContext | null,
    private volumes: Volumes,
    private readonly onCaption: (text: string) => void = () => undefined,
    private readonly userPlayer: ((ctx: AudioContext) => UserPlayer) | null = null,
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
    const bus = (): GainNode => {
      const g = ctx.createGain();
      g.connect(this.master as GainNode);
      return g;
    };
    this.ambBus = bus();
    this.sfxBus = bus();
    this.uiBus = bus();
    // Musique : un fondu par état → filtre passe-bas de l'état → mélange → (sec + réverbération légère) → compresseur → maître.
    const comp = ctx.createDynamicsCompressor();
    comp.connect(this.master);
    this.musicBus = ctx.createGain();
    this.musicBus.connect(comp);
    const mix = ctx.createGain();
    const dry = ctx.createGain();
    dry.gain.value = 0.85;
    mix.connect(dry);
    dry.connect(this.musicBus);
    const verb = ctx.createConvolver();
    const ir = ctx.createBuffer(2, Math.floor(ctx.sampleRate * 1.6), ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      let x = 0x1234567 + ch * 7919;
      for (let i = 0; i < d.length; i++) {
        x = (Math.imul(x, 1103515245) + 12345) >>> 0;
        d[i] = ((x / 0xffffffff) * 2 - 1) * (1 - i / d.length) ** 2.5;
      }
    }
    verb.buffer = ir;
    const wet = ctx.createGain();
    wet.gain.value = 0.2;
    mix.connect(verb);
    verb.connect(wet);
    wet.connect(this.musicBus);
    for (const m of MOODS) {
      const g = ctx.createGain();
      g.gain.value = this.stats.layers[m] * MOOD_TONE[m].gain;
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = MOOD_TONE[m].cutoff;
      lp.Q.value = 0.5;
      g.connect(lp);
      lp.connect(mix);
      this.deck.set(m, g);
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
    for (const m of MOODS) this.seq[m].nextStart = ctx.currentTime + 0.4;
    this.applyBuses();
    this.buildAmbience(this.stats.ambience);
  }

  setVolumes(v: Volumes): void {
    this.volumes = v;
    this.applyBuses();
  }

  setAccent(a: Accent): void {
    this.stats.accent = a;
  }

  /** Source de la musique et pistes de l'utilisateur ; la pièce en cours n'est pas interrompue. */
  setLibrary(lib: MusicLibrary): void {
    this.library = lib;
  }

  setMood(m: Mood): void {
    if (m === this.stats.mood) return;
    const previous = this.stats.mood;
    this.stats.mood = m;
    this.stats.layers = layerTargets(m);
    const ctx = this.ctx;
    if (!ctx) return;
    // L'ancien état s'efface (ses notes déjà planifiées s'éteignent dans le fondu) ; le nouveau reprend à sa pièce suivante.
    this.stopCurrent(previous);
    this.seq[m].nextStart = ctx.currentTime + 0.5;
    for (const l of MOODS) this.deck.get(l)?.gain.setTargetAtTime(this.stats.layers[l] * MOOD_TONE[l].gain, ctx.currentTime, MOOD_FADE_S);
    this.applyBuses();
  }

  /** Ambiance du lieu : fondu entre deux ambiances. */
  setAmbience(kind: Ambience): void {
    if (kind === this.stats.ambience) return;
    this.stats.ambience = kind;
    if (this.ctx) this.buildAmbience(kind);
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
    if (!ctx || !this.musicBus || !this.sfxBus || !this.ambBus || !this.uiBus) return;
    const now = ctx.currentTime;
    const g = busGains(this.volumes, now < this.duckUntil, now < this.silentUntil, this.stats.mood);
    this.stats.music = g.music;
    this.stats.effects = g.sfx;
    this.stats.ambient = g.ambient;
    this.stats.ui = g.ui;
    this.musicBus.gain.setTargetAtTime(g.music, now, 0.25);
    this.ambBus.gain.setTargetAtTime(g.ambient, now, 0.3);
    this.sfxBus.gain.setTargetAtTime(g.sfx, now, 0.02);
    this.uiBus.gain.setTargetAtTime(g.ui, now, 0.02);
  }

  private stopCurrent(m: Mood): void {
    const s = this.seq[m];
    s.cur?.user?.stop();
    s.cur = null;
    if (this.stats.mood === m || this.stats.piece) this.stats.piece = "";
  }

  /** La musique doit-elle sonner ? Non si son curseur est à zéro ou si « en combat seulement » et hors combat. */
  get musicWanted(): boolean {
    const v = this.volumes;
    return v.master > 0 && v.music > 0 && !(v.musicCombatOnly && this.stats.mood !== "combat");
  }

  private startPiece(m: Mood, at: number): void {
    const s = this.seq[m];
    const ids = libraryIds(this.library, m);
    const id = playSequence(ids, s.counter + 1)[s.counter] ?? (MOOD_PIECES[m][0] as string);
    const index = s.counter;
    s.counter++;
    this.stats.piece = id;
    this.stats.pieces.push({ id, mood: m, at });
    if (this.stats.pieces.length > 200) this.stats.pieces.shift();
    if (id.startsWith("u:")) {
      const deck = this.deck.get(m);
      const make = this.userPlayer && this.ctx ? this.userPlayer(this.ctx) : null;
      if (!make || !deck) {
        s.nextStart = at + 1;
        return;
      }
      const cur: Current = { id, rendered: null, t0: at, next: 0, user: null };
      s.cur = cur;
      cur.user = make(userTrackUrl(id.slice(2)), deck, () => {
        if (s.cur === cur) {
          s.cur = null;
          s.nextStart = (this.ctx?.currentTime ?? 0) + gapSeconds(m, index);
          this.stats.piece = "";
        }
      });
      return;
    }
    s.cur = { id, rendered: renderCached(id, m, this.stats.accent), t0: at, next: 0, user: null };
  }

  /** Planifie la musique (fenêtre de 1,5 s), l'ambiance, et rétablit les bus en fin de ducking ou de silence. */
  tick(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    this.applyBuses();
    this.tickAmbience(ctx.currentTime);
    if (!this.musicWanted) return;
    const m = this.stats.mood;
    const s = this.seq[m];
    const now = ctx.currentTime;
    if (!s.cur) {
      if (now < s.nextStart) return;
      this.startPiece(m, Math.max(now + 0.1, s.nextStart));
    }
    const cur = s.cur;
    if (!cur?.rendered) return;
    const out = this.deck.get(m);
    if (!out) return;
    const rt: SynthRuntime = { ctx, noise: this.noise };
    const ev = cur.rendered.events;
    while (cur.next < ev.length && cur.t0 + (ev[cur.next]?.t ?? 0) < now + LOOKAHEAD_S) {
      const e = ev[cur.next];
      cur.next++;
      if (!e) break;
      const at = cur.t0 + e.t;
      if (at < now - 0.05) continue;
      playVoice(rt, out, e.voice, e.midi, Math.max(at, now), e.dur, e.vel);
      this.stats.notes[m]++;
    }
    if (cur.next >= ev.length && now >= cur.t0 + cur.rendered.seconds) {
      s.cur = null;
      s.nextStart = now + gapSeconds(m, s.counter - 1);
      this.stats.piece = "";
    }
  }

  // ---- Ambiances ----

  private buildAmbience(kind: Ambience): void {
    const ctx = this.ctx;
    if (!ctx || !this.ambBus || !this.noise) return;
    const now = ctx.currentTime;
    const old = this.amb;
    if (old) {
      old.gain.gain.setTargetAtTime(0, now, 0.8);
      for (const s of old.sources) s.stop(now + 5);
      for (const o of old.oscs) o.stop(now + 5);
    }
    this.amb = null;
    if (kind === "aucune") return;
    // Lit de bruit filtré, deux lectures de vitesses différentes (la boucle d'une seconde ne s'entend pas), modulé lentement.
    const P: Record<Exclude<Ambience, "aucune">, { bp: number; q: number; lp: number; hp: number; amp: number; lfo: number; depth: number }> = {
      vent: { bp: 520, q: 0.5, lp: 1500, hp: 180, amp: 0.5, lfo: 0.07, depth: 0.25 },
      mur: { bp: 680, q: 0.6, lp: 1900, hp: 220, amp: 0.6, lfo: 0.05, depth: 0.35 },
      ville: { bp: 420, q: 0.8, lp: 1200, hp: 200, amp: 0.26, lfo: 0.11, depth: 0.08 },
      foret: { bp: 2600, q: 0.7, lp: 5000, hp: 1500, amp: 0.14, lfo: 0.13, depth: 0.06 },
    };
    const p = P[kind];
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.setTargetAtTime(1, now, 1.5);
    g.connect(this.ambBus);
    const amp = ctx.createGain();
    amp.gain.value = p.amp;
    amp.connect(g);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = p.lp;
    lp.connect(amp);
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = p.hp;
    hp.connect(lp);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = p.bp;
    bp.Q.value = p.q;
    bp.connect(hp);
    const sources: AudioBufferSourceNode[] = [];
    for (const rate of [1, 0.87]) {
      const s = ctx.createBufferSource();
      s.buffer = this.noise;
      s.loop = true;
      s.playbackRate.value = rate;
      s.connect(bp);
      s.start(now);
      sources.push(s);
    }
    const lfo = ctx.createOscillator();
    const depth = ctx.createGain();
    lfo.frequency.value = p.lfo;
    depth.gain.value = p.amp * p.depth;
    lfo.connect(depth);
    depth.connect(amp.gain);
    lfo.start(now);
    this.amb = { kind, gain: g, sources, oscs: [lfo] };
    this.ambNext = now + 4 + this.ambRng() * 6;
  }

  /** Événements rares de l'ambiance : chants d'oiseaux dans la forêt, cloche lointaine en ville. */
  private tickAmbience(now: number): void {
    const kind = this.amb?.kind;
    if (!kind || now < this.ambNext || !this.ambBus) return;
    const out = this.ambBus;
    const rt: SynthRuntime = { ctx: this.ctx as AudioContext, noise: this.noise };
    if (kind === "foret") {
      const base = 2300 + Math.floor(this.ambRng() * 1200);
      const n = 2 + Math.floor(this.ambRng() * 3);
      for (let i = 0; i < n; i++) this.chirp(rt, out, base + i * 90, now + 0.02 + i * 0.16);
      this.ambNext = now + 7 + this.ambRng() * 9;
    } else if (kind === "ville") {
      const g = rt.ctx.createGain();
      g.connect(out);
      for (const [r, a] of [[1, 1], [2.4, 0.4], [3, 0.25]] as const) {
        const o = rt.ctx.createOscillator();
        o.type = "sine";
        o.frequency.setValueAtTime(262 * r, now);
        const pg = rt.ctx.createGain();
        pg.gain.value = a;
        o.connect(pg);
        pg.connect(g);
        o.start(now);
        o.stop(now + 4);
      }
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(0.12, now + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 3.6);
      this.ambNext = now + 38 + this.ambRng() * 35;
    } else this.ambNext = now + 30;
  }

  private chirp(rt: SynthRuntime, out: AudioNode, hz: number, at: number): void {
    const o = rt.ctx.createOscillator();
    const g = rt.ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(hz, at);
    o.frequency.exponentialRampToValueAtTime(hz * 1.35, at + 0.09);
    o.connect(g);
    g.connect(out);
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(0.05, at + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.11);
    o.start(at);
    o.stop(at + 0.15);
  }

  // ---- Effets ----

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

  /** Une note de carillon (partiels doux) pour les notifications. */
  private chime(hz: number, at: number, out: AudioNode, level: number, ring: number): void {
    const g = (this.ctx as AudioContext).createGain();
    g.connect(out);
    this.osc("sine", hz, at, at + ring + 0.1, g);
    const h = (this.ctx as AudioContext).createGain();
    h.gain.value = 0.25;
    h.connect(g);
    this.osc("sine", hz * 2.76, at, at + ring * 0.5, h);
    this.env(g, at, 0.004, 0.01, ring, level);
  }

  /** Joue un effet ; sous-titre les sons importants si l'option est active. Retourne vrai s'il a été joué. */
  play(id: Sfx, gain = 1): boolean {
    const ctx = this.ctx;
    const out = SFX_BUS[id] === "ui" ? this.uiBus : this.sfxBus;
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
        const o = this.osc("sine", 150, at, at + 0.25, g);
        o.frequency.exponentialRampToValueAtTime(85, at + 0.2);
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
        // Un pas lourd mais bref : pas de sous-grave (plancher 70 Hz), jamais plus de 0,5 s.
        const o = this.osc("sine", 90, at, at + 0.45, g);
        o.frequency.exponentialRampToValueAtTime(70, at + 0.3);
        this.noiseSrc(at, at + 0.35, this.filter("lowpass", 220, 1, g));
        this.env(g, at, 0.01, 0.04, 0.3, 0.42 * v);
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
        this.noiseSrc(at, at + 0.8, this.filter("lowpass", 900, 0.7, g));
        const o = this.osc("sine", 110, at, at + 0.7, g);
        o.frequency.exponentialRampToValueAtTime(70, at + 0.45);
        this.env(g, at, 0.004, 0.05, 0.55, 0.5 * v);
        break;
      }
      case "transformation": {
        // Éclair et onde de choc : grondement bref (1,2 s), sans bourdon.
        this.noiseSrc(at, at + 1.3, this.filter("lowpass", 420, 0.7, g));
        const o = this.osc("sine", 120, at, at + 1.1, g);
        o.frequency.exponentialRampToValueAtTime(75, at + 0.9);
        this.env(g, at, 0.01, 0.15, 0.9, 0.55 * v);
        break;
      }
      case "cloche": {
        // Cloche des Murs : partiels inharmoniques, longue résonance.
        for (const [r, a] of [[1, 1], [2.4, 0.5], [3, 0.35], [4.5, 0.2], [0.5, 0.4]] as const) {
          const pg = ctx.createGain();
          pg.gain.value = a;
          pg.connect(g);
          this.osc("sine", 330 * r, at, at + 3.5, pg);
        }
        this.env(g, at, 0.005, 0.05, 3.2, 0.24 * v);
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
      case "clic": {
        // Petit tic de bois : bruit bref et sinus qui retombe.
        this.noiseSrc(at, at + 0.03, this.filter("bandpass", 2600, 1.2, g));
        const o = this.osc("sine", 1300, at, at + 0.06, g);
        o.frequency.exponentialRampToValueAtTime(900, at + 0.04);
        this.env(g, at, 0.001, 0.005, 0.04, 0.2 * v);
        break;
      }
      case "ouvrir": {
        const o = this.osc("sine", 520, at, at + 0.2, g);
        o.frequency.exponentialRampToValueAtTime(700, at + 0.12);
        this.env(g, at, 0.01, 0.04, 0.12, 0.16 * v);
        break;
      }
      case "fermer": {
        const o = this.osc("sine", 640, at, at + 0.2, g);
        o.frequency.exponentialRampToValueAtTime(440, at + 0.12);
        this.env(g, at, 0.01, 0.04, 0.12, 0.14 * v);
        break;
      }
      case "valider": {
        this.osc("sine", 660, at, at + 0.2, g);
        this.osc("sine", 830, at + 0.07, at + 0.3, g);
        this.env(g, at, 0.005, 0.1, 0.12, 0.15 * v);
        break;
      }
      case "refus": {
        const o = this.osc("sine", 300, at, at + 0.25, g);
        o.frequency.exponentialRampToValueAtTime(240, at + 0.12);
        this.env(g, at, 0.01, 0.06, 0.1, 0.12 * v);
        break;
      }
      case "notification": {
        this.chime(880, at, g, 0.16 * v, 0.5);
        this.chime(1175, at + 0.14, g, 0.14 * v, 0.6);
        break;
      }
      case "alerte": {
        this.chime(659, at, g, 0.2 * v, 0.6);
        this.chime(784, at + 0.15, g, 0.18 * v, 0.6);
        this.chime(988, at + 0.3, g, 0.18 * v, 0.9);
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
  const engine = new AudioEngine(() => (typeof window.AudioContext === "function" ? new window.AudioContext() : null), volumes, caption, mediaElementPlayer);
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
    d["audioPiece"] = engine.stats.piece;
    d["audioAmbience"] = engine.stats.ambience;
  }, 250);
  return engine;
}
