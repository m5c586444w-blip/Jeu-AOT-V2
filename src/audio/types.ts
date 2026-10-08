/** Types communs de la musique (AUD.2) : purs, sans WebAudio ni DOM. */

export type Mood = "calme" | "tension" | "combat";
export type Accent = "paradis" | "marley" | "hizuru";

/** Timbres de l'orchestre synthétisé (recettes dans `instruments.ts`). */
export type VoiceId =
  | "flute"
  | "hautbois"
  | "clarinette"
  | "violon"
  | "cor"
  | "trompette"
  | "piccolo"
  | "cordes"
  | "piano"
  | "harpe"
  | "pizz"
  | "basse"
  | "tuba"
  | "caisse"
  | "grosse_caisse"
  | "timbale"
  | "cymbale"
  | "triangle";

export const PERCUSSION: ReadonlySet<VoiceId> = new Set<VoiceId>(["caisse", "grosse_caisse", "timbale", "cymbale", "triangle"]);

/** Un événement musical : début et durée en secondes depuis le début de la pièce, hauteur MIDI (0 pour les percussions). */
export interface MusicEvent {
  t: number;
  dur: number;
  midi: number;
  voice: VoiceId;
  vel: number;
}

export type AccStyle = "marche" | "valse" | "alberti" | "pizz" | "pad";
export type PercStyle = "doux" | "marche" | "galop";

/** Orchestration d'une pièce pour un état : tempo, accompagnement, timbres de la mélodie, percussions. */
export interface Arrangement {
  bpm: number;
  acc: readonly AccStyle[];
  /** Rotation des timbres de la mélodie : un groupe (joué ensemble) par section jouée. */
  leads: readonly (readonly VoiceId[])[];
  perc?: PercStyle;
  bass?: VoiceId;
  /** Timbre des accords courts (marche, valse). */
  chordVoice?: VoiceId;
  /** Intensité globale (1 par défaut). */
  vel?: number;
  /** Sections jouées en sourdine (vélocité réduite, sans percussions). */
  soft?: readonly string[];
}

export interface SectionDef {
  /** Mélodie : `Hauteur:durée` (durées en temps), `r:durée` pour un silence, `$motif` pour un motif nommé. */
  melody: string;
  /** Un accord par mesure ; `X.Y` partage la mesure en deux moitiés ; `$motif` autorisé. */
  chords: string;
}
export interface DerivedSection {
  /** Section reprise telle quelle puis transposée (demi-tons) : mélodie et accords. */
  from: string;
  shift: number;
}

export interface PieceDef {
  id: string;
  title: string;
  /** Compositeur et date de publication pour une œuvre du domaine public ; « Projet » pour une pièce originale. */
  composer: string;
  year: number | null;
  origin: "domaine_public" | "original";
  /** Ce que la transcription reprend de l'œuvre, ou le modèle de style d'une pièce originale. */
  basis: string;
  key: string;
  /** Temps par mesure (la noire est le temps). */
  beats: 2 | 3 | 4;
  motifs?: Readonly<Record<string, string>>;
  sections: Readonly<Record<string, SectionDef | DerivedSection>>;
  form: readonly string[];
  moods: Readonly<Partial<Record<Mood, Arrangement>>>;
}

export interface RenderedPiece {
  id: string;
  mood: Mood;
  /** Événements triés par début. */
  events: readonly MusicEvent[];
  /** Durée sonore (dernier événement terminé), en secondes. */
  seconds: number;
}
