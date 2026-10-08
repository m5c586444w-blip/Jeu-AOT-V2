import type { SectionDef } from "./types";

/** Notation compacte des mélodies et des accords (AUD.2). Pure et déterministe. */

const LETTER_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const SHARPS = ["F", "C", "G", "D", "A", "E", "B"];
const FLATS = ["B", "E", "A", "D", "G", "C", "F"];
/** Armures : nombre de dièses (positif) ou de bémols (négatif). */
const KEY_SIG: Record<string, number> = {
  C: 0, G: 1, D: 2, A: 3, E: 4, F: -1, Bb: -2, Eb: -3, Ab: -4,
  Am: 0, Em: 1, Bm: 2, "F#m": 3, Dm: -1, Gm: -2, Cm: -3,
};

export interface Note {
  /** Hauteur MIDI, ou null pour un silence. */
  midi: number | null;
  dur: number;
}

/** Remplace les `$motif` (récursif, profondeur bornée) puis retire les barres de mesure `|`. */
export function expand(src: string, motifs: Readonly<Record<string, string>> = {}, depth = 0): string {
  if (depth > 6) throw new Error("motifs imbriqués trop profondément");
  return src
    .replace(/\$([A-Za-z0-9_]+)/g, (_m, name: string) => {
      const m = motifs[name];
      if (m === undefined) throw new Error(`motif inconnu : $${name}`);
      return expand(m, motifs, depth + 1);
    })
    .replace(/\|/g, " ")
    .trim();
}

export function parseMelody(src: string, key: string, motifs: Readonly<Record<string, string>> = {}): Note[] {
  const sig = KEY_SIG[key];
  if (sig === undefined) throw new Error(`armure inconnue : ${key}`);
  const out: Note[] = [];
  for (const tok of expand(src, motifs).split(/\s+/).filter(Boolean)) {
    const rest = /^r:(\d*\.?\d+)$/.exec(tok);
    if (rest) {
      out.push({ midi: null, dur: Number(rest[1]) });
      continue;
    }
    const m = /^([A-G])([#bn]?)(\d):(\d*\.?\d+)$/.exec(tok);
    if (!m) throw new Error(`note illisible : « ${tok} »`);
    const letter = m[1] as string;
    const acc = m[2] ?? "";
    const inSig = sig > 0 ? (SHARPS.slice(0, sig).includes(letter) ? 1 : 0) : sig < 0 ? (FLATS.slice(0, -sig).includes(letter) ? -1 : 0) : 0;
    const off = acc === "#" ? 1 : acc === "b" ? -1 : acc === "n" ? 0 : inSig;
    out.push({ midi: 12 * (Number(m[3]) + 1) + (LETTER_PC[letter] as number) + off, dur: Number(m[4]) });
  }
  return out;
}

export type Quality = "M" | "m" | "7";
export interface Chord {
  /** Classe de hauteur de la fondamentale (0 à 11). */
  pc: number;
  q: Quality;
}

export function parseChord(tok: string): Chord {
  const m = /^([A-G])([#b]?)(m|7)?$/.exec(tok);
  if (!m) throw new Error(`accord illisible : « ${tok} »`);
  const base = LETTER_PC[m[1] as string] as number;
  const pc = (base + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0) + 12) % 12;
  return { pc, q: m[3] === "m" ? "m" : m[3] === "7" ? "7" : "M" };
}

/** Classes de hauteur des notes d'un accord (fondamentale, tierce, quinte, septième éventuelle). */
export function chordPcs(c: Chord): number[] {
  const third = c.q === "m" ? 3 : 4;
  const out = [c.pc, (c.pc + third) % 12, (c.pc + 7) % 12];
  if (c.q === "7") out.push((c.pc + 10) % 12);
  return out;
}

/** Une mesure d'accords : un ou deux accords (moitiés égales). */
export type BarChords = readonly Chord[];

export function parseChords(src: string, motifs: Readonly<Record<string, string>> = {}): BarChords[] {
  return expand(src, motifs)
    .split(/\s+/)
    .filter(Boolean)
    .map((bar) => bar.split(".").map(parseChord));
}

export const transposeChord = (c: Chord, shift: number): Chord => ({ pc: (((c.pc + shift) % 12) + 12) % 12, q: c.q });

export interface ParsedSection {
  melody: Note[];
  chords: BarChords[];
}

/** Lit une section ; vérifie que la mélodie remplit exactement les mesures d'accords. */
export function parseSection(def: SectionDef, key: string, beats: number, motifs: Readonly<Record<string, string>>, shift = 0, label = "section"): ParsedSection {
  const melody = parseMelody(def.melody, key, motifs).map((n) => (n.midi === null ? n : { ...n, midi: n.midi + shift }));
  const chords = parseChords(def.chords, motifs).map((b) => b.map((c) => transposeChord(c, shift)));
  const total = melody.reduce((a, n) => a + n.dur, 0);
  if (Math.abs(total - chords.length * beats) > 1e-6) throw new Error(`${label} : mélodie de ${total} temps pour ${chords.length} mesures de ${beats} temps`);
  return { melody, chords };
}
