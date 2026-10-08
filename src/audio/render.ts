import { chordPcs, parseSection, transposeChord } from "./notation";
import type { BarChords, Chord, ParsedSection } from "./notation";
import type { Accent, Arrangement, DerivedSection, MusicEvent, Mood, PieceDef, RenderedPiece, SectionDef, VoiceId } from "./types";

/**
 * Rendu d'une pièce en événements musicaux (AUD.2) : pur, déterministe, sans aléa ni horloge.
 * La mélodie vient de la partition transcrite ; l'accompagnement et les percussions en sont déduits par motifs fixes.
 */

const isDerived = (d: SectionDef | DerivedSection): d is DerivedSection => "from" in d;

/** Lit une section (transposée si elle en dérive). */
export function resolveSection(def: PieceDef, name: string, depth = 0): ParsedSection {
  const s = def.sections[name];
  if (!s) throw new Error(`${def.id} : section inconnue « ${name} »`);
  if (depth > 3) throw new Error(`${def.id} : sections dérivées imbriquées`);
  if (isDerived(s)) {
    const base = resolveSection(def, s.from, depth + 1);
    return {
      melody: base.melody.map((n) => (n.midi === null ? n : { ...n, midi: n.midi + s.shift })),
      chords: base.chords.map((b) => b.map((c) => transposeChord(c, s.shift))),
    };
  }
  return parseSection(s, def.key, def.beats, def.motifs ?? {}, 0, `${def.id}/${name}`);
}

/** Plus petite hauteur MIDI ≥ `lo` de classe `pc`. */
const placeIn = (pc: number, lo: number): number => lo + ((((pc - lo) % 12) + 12) % 12);
/** Hauteur de classe `pc` la plus proche de `around`. */
const nearest = (pc: number, around: number): number => {
  const up = placeIn(pc, around);
  return up - around <= 6 ? up : up - 12;
};
const triad = (c: Chord, around: number): number[] =>
  chordPcs(c)
    .slice(0, 3)
    .map((pc) => nearest(pc, around))
    .sort((a, b) => a - b);

type PercHit = readonly [number, VoiceId, number];
const PERC2: Record<string, readonly PercHit[]> = {
  doux: [[0, "grosse_caisse", 0.3], [1, "caisse", 0.18]],
  marche: [[0, "grosse_caisse", 0.42], [0, "caisse", 0.22], [0.5, "caisse", 0.14], [0.75, "caisse", 0.12], [1, "caisse", 0.3], [1.5, "caisse", 0.14], [1.75, "caisse", 0.12]],
  galop: [[0, "grosse_caisse", 0.45], [0, "caisse", 0.28], [0.5, "caisse", 0.18], [1, "grosse_caisse", 0.3], [1, "caisse", 0.28], [1.5, "caisse", 0.18]],
};
const PERC3: readonly PercHit[] = [[0, "grosse_caisse", 0.25], [1, "triangle", 0.2], [2, "triangle", 0.14]];

interface Seg {
  c: Chord;
  start: number;
  len: number;
}

function segments(bar: BarChords, barStart: number, beats: number): Seg[] {
  const a = bar[0] as Chord;
  const b = bar[1];
  return b ? [{ c: a, start: barStart, len: beats / 2 }, { c: b, start: barStart + beats / 2, len: beats / 2 }] : [{ c: a, start: barStart, len: beats }];
}

export function renderPiece(def: PieceDef, mood: Mood, accent: Accent = "paradis"): RenderedPiece {
  const arr: Arrangement | undefined = def.moods[mood];
  if (!arr) throw new Error(`${def.id} : pas d'arrangement pour « ${mood} »`);
  const spb = 60 / arr.bpm;
  const ev: MusicEvent[] = [];
  const push = (beat: number, durSec: number, midi: number, voice: VoiceId, vel: number): void => {
    ev.push({ t: beat * spb, dur: durSec, midi, voice, vel: Math.round(vel * 1000) / 1000 });
  };
  const gain = arr.vel ?? 1;
  const bassV: VoiceId = arr.bass ?? "tuba";
  let cursor = 0;
  let played = 0;
  for (const name of def.form) {
    const sec = resolveSection(def, name);
    const soft = arr.soft?.includes(name) ?? false;
    const g = gain * (soft ? 0.7 : 1);
    const lead = arr.leads[played % arr.leads.length] as readonly VoiceId[];
    // Mélodie.
    let at = cursor;
    for (const n of sec.melody) {
      const pitch = n.midi;
      if (pitch !== null) {
        const accentBeat = (at - cursor) % def.beats === 0 ? 1.12 : 1;
        lead.forEach((v, i) => {
          const midi = v === "piccolo" ? pitch + 12 : pitch;
          push(at, n.dur * spb * 0.94, midi, v, 0.62 * g * accentBeat * (i === 0 ? 1 : 0.75));
        });
        if (accent === "hizuru" && n.dur >= 0.5) push(at, Math.min(1.1, n.dur * spb), pitch + 12, "harpe", 0.26 * g);
      }
      at += n.dur;
    }
    // Accompagnement mesure par mesure.
    sec.chords.forEach((bar, b) => {
      const barStart = cursor + b * def.beats;
      for (const seg of segments(bar, barStart, def.beats)) {
        const whole = Math.floor(seg.len + 1e-9);
        const root = placeIn(seg.c.pc, 40);
        const fifth = placeIn((seg.c.pc + 7) % 12, 40);
        for (const style of arr.acc) {
          if (style === "marche" || style === "valse") {
            const cv: VoiceId = arr.chordVoice ?? "cor";
            for (let k = 0; k < whole; k++) {
              const bassBeat = style === "valse" ? k === 0 : k % 2 === 0;
              if (bassBeat) push(seg.start + k, Math.min(0.32, 0.7 * spb), (k / 2) % 2 === 0 || style === "valse" ? root : fifth, bassV, 0.5 * g);
              else for (const m of triad(seg.c, 66)) push(seg.start + k, Math.min(0.24, 0.5 * spb), m, cv, 0.2 * g);
            }
          } else if (style === "alberti") {
            const t3 = triad(seg.c, 62);
            const pat = [0, 2, 1, 2] as const;
            const cv: VoiceId = arr.chordVoice ?? "piano";
            for (let j = 0; j < Math.floor(seg.len * 2 + 1e-9); j++) push(seg.start + j * 0.5, spb * 0.9, t3[pat[j % 4] as number] as number, cv, (j === 0 ? 0.26 : 0.18) * g);
            push(seg.start, Math.min(0.4, spb * 0.8), placeIn(seg.c.pc, 43), "basse", 0.3 * g);
          } else if (style === "pizz") {
            for (let k = 0; k < whole; k++) {
              for (const m of triad(seg.c, 64)) push(seg.start + k, Math.min(0.3, spb * 0.6), m, "pizz", (k === 0 ? 0.2 : 0.14) * g);
              if (k % 2 === 0) push(seg.start + k, Math.min(0.4, spb * 0.8), (k / 2) % 2 === 0 ? placeIn(seg.c.pc, 43) : placeIn((seg.c.pc + 7) % 12, 43), "basse", 0.3 * g);
            }
          } else {
            const dur = seg.len * spb - 0.05;
            for (const m of triad(seg.c, 66)) push(seg.start, dur, m, "cordes", 0.11 * g);
          }
        }
      }
      // Percussions.
      if (arr.perc && !soft) {
        if (def.beats === 3) for (const [o, v, vel] of PERC3) push(barStart + o, 0.2, 0, v, vel * g);
        else {
          const pat = PERC2[arr.perc] as readonly PercHit[];
          for (let r = 0; r < def.beats / 2; r++) for (const [o, v, vel] of pat) push(barStart + r * 2 + o, v === "grosse_caisse" ? 0.3 : 0.12, 0, v, vel * g);
          if (accent === "marley") for (let r = 0; r < def.beats / 2; r++) push(barStart + r * 2 + 1.25, 0.1, 0, "caisse", 0.12 * g);
        }
        if (b === 0 && played > 0 && arr.perc !== "doux") push(barStart, 1.0, 0, "cymbale", 0.2 * g);
      }
    });
    cursor += sec.chords.length * def.beats;
    played++;
  }
  ev.sort((a, b) => a.t - b.t || a.midi - b.midi);
  let seconds = 0;
  for (const e of ev) seconds = Math.max(seconds, e.t + e.dur);
  return { id: def.id, mood, events: ev, seconds };
}
