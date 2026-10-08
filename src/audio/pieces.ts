import type { Arrangement, Mood, PieceDef } from "./types";

/**
 * Répertoire (AUD.2, D-114). Aucune musique de jeu vidéo ni de l'œuvre originale ; aucun enregistrement.
 * - « domaine_public » : thème transcrit en notes d'après une composition du domaine public (compositeur mort depuis plus de
 *   70 ans, œuvre publiée avant 1929). La transcription est faite de mémoire, sans partition sous les yeux : elle peut
 *   s'écarter de l'original ; l'orchestration, l'accompagnement et les suites sont ceux du projet.
 * - « original » : composition du projet, dans l'idiome de la marche militaire ou de la musique de salon classique.
 * Notation : `Hauteur:durée` (temps), `r:durée` pour un silence, armure appliquée (`n` = bécarre) ; voir `notation.ts`.
 */

const march = (a: Partial<Arrangement> & Pick<Arrangement, "bpm" | "leads">): Arrangement => ({ acc: ["marche"], ...a });

export const PIECES: readonly PieceDef[] = [
  {
    id: "ode_joie",
    title: "Ode à la joie (en jeu de salon, puis en marche)",
    composer: "Ludwig van Beethoven",
    year: 1824,
    origin: "domaine_public",
    basis: "thème de l'Ode à la joie (finale de la 9e symphonie), seize mesures, transcrit de mémoire ; pont et reprise d'après le thème",
    key: "D",
    beats: 4,
    motifs: {
      i: "F5:1 F5:1 G5:1 A5:1 A5:1 G5:1 F5:1 E5:1 D5:1 D5:1 E5:1 F5:1",
      e1: "F5:1.5 E5:.5 E5:2",
      e2: "E5:1.5 D5:.5 D5:2",
      b: "E5:1 E5:1 F5:1 D5:1 E5:1 F5:.5 G5:.5 F5:1 D5:1 E5:1 F5:.5 G5:.5 F5:1 E5:1 D5:1 E5:1 A4:2",
    },
    sections: {
      A: { melody: "$i $e1 $i $e2", chords: "D A D A D A D D" },
      B: { melody: "$b", chords: "D A D A" },
      C: { melody: "$i $e2", chords: "D A D D" },
    },
    form: ["A", "B", "C", "A", "B", "C", "A", "C"],
    moods: {
      calme: { bpm: 104, acc: ["alberti", "pad"], leads: [["flute"], ["clarinette"], ["violon"], ["hautbois", "flute"]], vel: 0.95 },
      tension: march({ bpm: 108, leads: [["hautbois", "violon"], ["flute", "violon"], ["clarinette", "violon"], ["hautbois", "flute"]], chordVoice: "clarinette", perc: "doux", vel: 0.9 }),
    },
  },
  {
    id: "menuet_sol",
    title: "Menuet en sol",
    composer: "Christian Petzold (attribué autrefois à J.-S. Bach)",
    year: 1725,
    origin: "domaine_public",
    basis: "thème du menuet en sol majeur (BWV Anh. 114), huit mesures, transcrit de mémoire ; reprise une quarte plus bas",
    key: "G",
    beats: 3,
    sections: {
      A: {
        melody: "D5:1 G4:.5 A4:.5 B4:.5 C5:.5 D5:1 G4:1 G4:1 E5:1 C5:.5 D5:.5 E5:.5 F5:.5 G5:1 G4:1 G4:1 C5:1 D5:.5 C5:.5 B4:.5 A4:.5 B4:1 C5:.5 B4:.5 A4:.5 G4:.5 F4:1 G4:.5 A4:.5 B4:.5 G4:.5 A4:1 G4:2",
        chords: "G G C G C G D G",
      },
      B: { from: "A", shift: -5 },
    },
    form: ["A", "B", "A", "B", "A"],
    moods: {
      calme: { bpm: 112, acc: ["pizz", "pad"], leads: [["clarinette"], ["flute"], ["hautbois", "flute"]], vel: 0.95 },
    },
  },
  {
    id: "petite_musique",
    title: "Petite musique de nuit (premier thème)",
    composer: "Wolfgang Amadeus Mozart",
    year: 1787,
    origin: "domaine_public",
    basis: "quatre premières mesures du premier mouvement de la sérénade K. 525 (composée en 1787, publiée en 1827), transcrites de mémoire ; suite écrite par le projet",
    key: "G",
    beats: 4,
    motifs: {
      f: "G4:1 r:.5 D4:.5 G4:1 r:.5 D4:.5 G4:.5 D4:.5 G4:.5 B4:.5 D5:2 C5:1 r:.5 A4:.5 C5:1 r:.5 A4:.5 C5:.5 A4:.5 F4:.5 A4:.5 D5:2",
      g: "B4:1 G4:.5 B4:.5 D5:1 B4:.5 D5:.5 G5:1.5 F5:.5 E5:1 D5:1 C5:1 E5:.5 D5:.5 C5:1 B4:.5 A4:.5 B4:1 D5:1 G4:2",
    },
    sections: {
      A: { melody: "$f $g", chords: "G G D D G G C D.G" },
      B: { from: "A", shift: -5 },
    },
    form: ["A", "A", "B", "A"],
    moods: {
      calme: { bpm: 126, acc: ["pizz", "pad"], leads: [["violon"], ["flute", "violon"], ["hautbois"]], vel: 1 },
    },
  },
  {
    id: "andante_haydn",
    title: "Andante en do (thème de la « Surprise », sans l'accord fort)",
    composer: "Joseph Haydn",
    year: 1791,
    origin: "domaine_public",
    basis: "thème de l'andante de la symphonie n° 94, transcrit de mémoire en do majeur ; l'accord fort du thème n'est pas reproduit",
    key: "C",
    beats: 2,
    sections: {
      A: {
        melody: "C5:.5 C5:.5 E5:.5 E5:.5 G5:.5 G5:.5 E5:1 F5:.5 F5:.5 D5:.5 D5:.5 B4:.5 B4:.5 G4:1 C5:.5 C5:.5 E5:.5 E5:.5 G5:.5 G5:.5 E5:1 F5:.5 F5:.5 D5:.5 D5:.5 B4:.5 D5:.5 C5:1",
        chords: "C C G G C C G G.C",
      },
      B: { from: "A", shift: -5 },
    },
    form: ["A", "B", "A", "B", "A", "A"],
    moods: {
      calme: { bpm: 100, acc: ["pizz", "pad"], leads: [["flute"], ["hautbois"], ["clarinette", "flute"]], vel: 0.95 },
    },
  },
  {
    id: "aube_remparts",
    title: "Aube sur les remparts",
    composer: "Projet",
    year: null,
    origin: "original",
    basis: "composition originale du projet, en sol majeur, dans l'idiome de la musique de salon classique",
    key: "G",
    beats: 4,
    sections: {
      A1: {
        melody: "B4:1.5 A4:.5 G4:1 D5:1 E5:2 D5:1 B4:1 C5:1.5 B4:.5 A4:1 E5:1 D5:3 r:1 B4:1.5 A4:.5 G4:1 D5:1 E5:1 G5:1 E5:1 B4:1 C5:1 E5:1 D5:1 C5:1 D5:1 C5:1 A4:2",
        chords: "G Em C D G Em C D",
      },
      A2: {
        melody: "E5:1.5 D5:.5 C5:1 G4:1 B4:2 D5:1 G5:1 F5:1.5 E5:.5 D5:1 A4:1 G4:1 B4:1 E5:2 E5:1.5 D5:.5 C5:1 E5:1 D5:1 B4:1 G4:2 A4:1 B4:1 C5:1 D5:1 B4:4",
        chords: "C G D Em C G D G",
      },
    },
    form: ["A1", "A2", "A1", "A2"],
    moods: {
      calme: { bpm: 96, acc: ["alberti", "pad"], leads: [["flute"], ["clarinette"], ["hautbois", "flute"], ["violon"]], vel: 0.95 },
    },
  },
  {
    id: "canon_matin",
    title: "Canon du matin",
    composer: "Projet",
    year: null,
    origin: "original",
    basis: "composition originale du projet sur la basse chiffrée courante du canon baroque (ré, la, si mineur, fa dièse mineur, sol, ré, sol, la), dont la suite d'accords est un lieu commun libre de droits",
    key: "D",
    beats: 4,
    sections: {
      A: {
        melody: "A5:1 F5:.5 G5:.5 A5:1 E5:.5 C5:.5 F5:1 D5:.5 F5:.5 A5:1 F5:.5 C5:.5 B5:1 G5:.5 B5:.5 A5:1 F5:.5 D5:.5 G5:1 B5:.5 G5:.5 E5:1.5 C5:.5",
        chords: "D.A Bm.F#m G.D G.A",
      },
      B: {
        melody: "D5:.5 F5:.5 A5:.5 F5:.5 C5:.5 E5:.5 A5:.5 E5:.5 D5:.5 F5:.5 B5:.5 F5:.5 C5:.5 F5:.5 A5:.5 F5:.5 B4:.5 D5:.5 G5:.5 D5:.5 A4:.5 D5:.5 F5:.5 D5:.5 B4:.5 D5:.5 G5:.5 B5:.5 A5:1 E5:1",
        chords: "D.A Bm.F#m G.D G.A",
      },
      C: { melody: "F5:2 E5:2 D5:2 C5:2 B4:2 A4:2 B4:1 D5:1 E5:2", chords: "D.A Bm.F#m G.D G.A" },
    },
    form: ["A", "B", "C", "B", "A", "C", "B", "A"],
    moods: {
      calme: { bpm: 92, acc: ["pizz", "pad"], leads: [["violon"], ["flute"], ["hautbois", "violon"], ["clarinette"]], vel: 0.95 },
    },
  },
  {
    id: "marche_garnison",
    title: "Marche de la garnison",
    composer: "Projet",
    year: null,
    origin: "original",
    basis: "composition originale du projet, en fa majeur, forme de marche militaire (introduction, deux reprises, trio) à la manière des marches de Sousa",
    key: "F",
    beats: 2,
    motifs: {
      p1: "F5:.75 G5:.25 A5:1 C6:.75 A5:.25 F5:1 G5:.75 A5:.25 B5:1 G5:1 r:1",
      p1c: "F F C C",
      p1b: "F5:.75 G5:.25 A5:1 C6:.75 A5:.25 F5:1 G5:.75 A5:.25 B5:1 F5:1 r:1",
      p1bc: "F F C F",
      p2: "F5:.5 A5:.5 C6:.5 A5:.5 D6:.5 C6:.5 B5:.5 A5:.5 G5:.5 B5:.5 D6:.5 B5:.5 C6:1 G5:1",
      p2c: "F Bb Gm C",
      q1: "D5:1 D5:.5 F5:.5 B5:1 A5:.5 G5:.5 F5:1 D5:.5 F5:.5 G5:1.5 r:.5",
      q1c: "Bb Bb Bb Gm",
      q2: "C6:1 C6:.5 A5:.5 B5:1 G5:.5 B5:.5 A5:.5 G5:.5 F5:.5 E5:.5 F5:1 r:1",
      q2c: "F Bb C F",
      q3: "C6:.5 B5:.5 A5:.5 G5:.5 F5:.5 A5:.5 C6:1 A5:.5 F5:.5 C5:.5 F5:.5 F5:1 r:1",
      q3c: "F F C F",
      t1: "D5:1.5 F5:.5 B5:2 A5:1.5 G5:.5 F5:2",
      t1c: "Bb Bb F F",
      t2: "G5:1.5 B5:.5 D6:2 C6:1.5 B5:.5 A5:2",
      t2c: "Gm Gm C F",
      t4: "C6:1.5 A5:.5 B5:1 G5:1 A5:1 F5:1 F5:2",
      t4c: "F C Bb F",
    },
    sections: {
      I: { melody: "C5:.5 C5:.5 F5:1 A5:.5 A5:.5 C6:1 C6:.5 A5:.5 F5:.5 A5:.5 G5:1 C5:1", chords: "F F F C" },
      A: { melody: "$p1 $p1b $p2 $p1b", chords: "$p1c $p1bc $p2c $p1bc" },
      B: { melody: "$q1 $q2 $q1 $q3", chords: "$q1c $q2c $q1c $q3c" },
      T: { melody: "$t1 $t2 $t1 $t4", chords: "$t1c $t2c $t1c $t4c" },
    },
    form: ["I", "A", "B", "T", "A", "B"],
    moods: {
      tension: march({ bpm: 104, leads: [["hautbois", "violon"], ["flute", "violon"], ["clarinette", "violon"], ["hautbois", "flute"]], chordVoice: "clarinette", perc: "doux", vel: 0.9, soft: ["T"] }),
      combat: march({ bpm: 124, leads: [["trompette", "violon"], ["piccolo", "hautbois"], ["cor", "violon"], ["trompette", "piccolo"]], chordVoice: "cor", perc: "marche", soft: ["T"] }),
    },
  },
  {
    id: "marche_bataillons",
    title: "Marche des bataillons",
    composer: "Projet",
    year: null,
    origin: "original",
    basis: "composition originale du projet, en sol majeur, forme de marche militaire en 2/4",
    key: "G",
    beats: 2,
    motifs: {
      a1: "G5:1 B5:.5 D6:.5 C6:1 A5:1 B5:1 G5:.5 B5:.5 A5:1 r:1",
      a2: "G5:1 B5:.5 D6:.5 C6:1 A5:1 B5:.5 A5:.5 G5:.5 F5:.5 G5:1 r:1",
      b1: "D6:.5 D6:.5 D6:1 C6:.5 B5:.5 A5:1 B5:.5 C6:.5 D6:.5 E6:.5 D6:1 r:1",
      b2: "D6:.5 D6:.5 D6:1 C6:.5 B5:.5 A5:1 G5:.5 A5:.5 B5:.5 F5:.5 G5:2",
      t1: "E5:1.5 G5:.5 C6:2 B5:1.5 A5:.5 G5:2",
      t2: "A5:1.5 G5:.5 Fn5:1 A5:1 G5:1 E5:1 C5:2",
    },
    sections: {
      I: { melody: "D5:.5 D5:.5 G5:1 A5:.5 A5:.5 D6:1", chords: "G D" },
      A: { melody: "$a1 $a2", chords: "G C G D G C D G" },
      B: { melody: "$b1 $b2", chords: "G D C D G D D G" },
      T: { melody: "$t1 $t2", chords: "C C G G F F C C" },
    },
    form: ["I", "A", "A", "B", "B", "T", "T", "A", "B"],
    moods: {
      tension: march({ bpm: 100, leads: [["flute", "violon"], ["hautbois", "violon"], ["clarinette", "flute"]], chordVoice: "clarinette", perc: "doux", vel: 0.9, soft: ["T"] }),
      combat: march({ bpm: 126, leads: [["trompette", "violon"], ["piccolo", "trompette"], ["cor", "hautbois"]], chordVoice: "cor", perc: "marche", soft: ["T"] }),
    },
  },
  {
    id: "galop_eclaireurs",
    title: "Galop des éclaireurs",
    composer: "Projet",
    year: null,
    origin: "original",
    basis: "composition originale du projet, en ré majeur, galop en croches à la manière des marches rapides de fanfare",
    key: "D",
    beats: 2,
    motifs: {
      g1: "D5:.5 F5:.5 A5:.5 F5:.5 D5:.5 F5:.5 A5:1 G5:.5 B5:.5 D6:.5 B5:.5 A5:2",
      g2: "D5:.5 F5:.5 A5:.5 F5:.5 D6:.5 C6:.5 B5:.5 A5:.5 G5:.5 F5:.5 E5:.5 G5:.5 D5:2",
      h1: "A5:.5 A5:.5 B5:.5 A5:.5 F5:.5 A5:.5 D6:1 G5:.5 G5:.5 A5:.5 G5:.5 E5:.5 G5:.5 B5:1",
      h2: "A5:.5 A5:.5 B5:.5 A5:.5 F5:.5 A5:.5 D6:1 E6:.5 D6:.5 C6:.5 B5:.5 A5:2",
      u1: "B5:1.5 A5:.5 G5:1 B5:1 D6:1.5 Cn6:.5 B5:2",
      u2: "E6:1.5 D6:.5 Cn6:1 B5:1 A5:1.5 F5:.5 A5:2",
    },
    sections: {
      I: { melody: "A4:.5 A4:.5 D5:.5 F5:.5 A5:2", chords: "D A" },
      A: { melody: "$g1 $g2", chords: "D D G A D A A D" },
      B: { melody: "$h1 $h2", chords: "D D G Em D D A A" },
      T: { melody: "$u1 $u2", chords: "G G C G Em C D D" },
    },
    form: ["I", "A", "A", "B", "B", "T", "T", "A", "B", "A"],
    moods: {
      combat: march({ bpm: 138, leads: [["trompette", "violon"], ["piccolo", "trompette"], ["cor", "violon"], ["trompette", "hautbois"]], chordVoice: "cor", perc: "galop", soft: ["T"] }),
    },
  },
  {
    id: "marche_legion",
    title: "Marche de la Légion",
    composer: "Projet",
    year: null,
    origin: "original",
    basis: "composition originale du projet, en mi bémol majeur, marche à rythmes pointés avec trio en la bémol",
    key: "Eb",
    beats: 2,
    motifs: {
      l1: "G5:.75 G5:.25 B5:1 A5:.75 A5:.25 C6:1 B5:.75 B5:.25 D6:1 E6:1.5 r:.5",
      l2: "E6:.75 D6:.25 C6:1 B5:.75 A5:.25 G5:1 A5:.5 B5:.5 C6:.5 D6:.5 E6:2",
      m1: "B5:.5 B5:.5 B5:.5 G5:.5 A5:.5 A5:.5 A5:.5 E5:.5 B5:.5 B5:.5 D6:.5 B5:.5 G5:2",
      m2: "B5:.5 B5:.5 B5:.5 G5:.5 A5:.5 A5:.5 A5:.5 C6:.5 B5:.5 D6:.5 F6:.5 D6:.5 E6:2",
      mc: "Eb Ab Bb Eb",
      n1: "C6:1.5 B5:.5 A5:1 C6:1 E6:1.5 D6:.5 C6:2",
      n2: "D6:1.5 C6:.5 B5:1 D6:1 G6:1.5 F6:.5 E6:2",
    },
    sections: {
      I: { melody: "E5:.75 r:.25 E5:.5 G5:.5 B5:2", chords: "Eb Bb" },
      A: { melody: "$l1 $l2", chords: "Eb Ab Bb Eb Cm Eb Bb Eb" },
      B: { melody: "$m1 $m2", chords: "$mc $mc" },
      T: { melody: "$n1 $n2", chords: "Ab Ab Bb Ab Bb Bb Eb Eb" },
    },
    form: ["I", "A", "A", "B", "B", "T", "T", "A", "B"],
    moods: {
      combat: march({ bpm: 126, leads: [["trompette", "violon"], ["cor", "hautbois"], ["piccolo", "trompette"]], chordVoice: "cor", perc: "marche", soft: ["T"] }),
    },
  },
  {
    id: "rondo_turque",
    title: "Rondo à la turque (thème, puis épisode en do)",
    composer: "Wolfgang Amadeus Mozart",
    year: 1784,
    origin: "domaine_public",
    basis: "thème en la mineur du rondo de la sonate K. 331 (publiée en 1784), figures de doubles croches transcrites de mémoire ; épisode en do majeur et cadences écrits par le projet",
    key: "Am",
    beats: 2,
    sections: {
      A: {
        melody: "B4:.25 A4:.25 G#4:.25 A4:.25 C5:1 D5:.25 C5:.25 B4:.25 C5:.25 E5:1 F5:.25 E5:.25 D#5:.25 E5:.25 B5:.25 A5:.25 G#5:.25 A5:.25 B5:.25 A5:.25 G#5:.25 A5:.25 C6:1 A5:.5 B5:.5 C6:.5 B5:.5 A5:.25 G#5:.25 A5:.25 B5:.25 E5:1 C6:.5 B5:.5 A5:.5 G#5:.5 A5:1 A4:1",
        chords: "Am Am E Am Am E Am.E Am",
      },
      B: {
        melody: "E5:.5 E5:.5 G5:.5 E5:.5 C5:.5 C5:.5 E5:.5 C5:.5 D5:.5 D5:.5 F5:.5 D5:.5 G4:.5 B4:.5 D5:1 E5:.5 E5:.5 G5:.5 E5:.5 C6:.5 B5:.5 A5:.5 G5:.5 F5:.5 E5:.5 D5:.5 F5:.5 E5:1 C5:1",
        chords: "C C Dm G C C.F G C",
      },
    },
    form: ["A", "A", "B", "A", "B", "A", "A", "B"],
    moods: {
      tension: march({ bpm: 108, leads: [["hautbois", "violon"], ["flute", "violon"]], chordVoice: "clarinette", perc: "doux", vel: 0.9 }),
      combat: march({ bpm: 130, leads: [["trompette", "violon"], ["piccolo", "hautbois"]], chordVoice: "cor", perc: "marche" }),
    },
  },
];

export const PIECE_BY_ID: ReadonlyMap<string, PieceDef> = new Map(PIECES.map((p) => [p.id, p]));

/** Pièces jouées dans chaque état : classique rythmé en paix (carte, menu), marches en guerre (tension) et au combat. */
export const MOOD_PIECES: Readonly<Record<Mood, readonly string[]>> = {
  calme: ["ode_joie", "menuet_sol", "petite_musique", "andante_haydn", "aube_remparts", "canon_matin"],
  tension: ["marche_garnison", "marche_bataillons", "ode_joie", "rondo_turque"],
  combat: ["galop_eclaireurs", "marche_legion", "rondo_turque", "marche_bataillons", "marche_garnison"],
};
