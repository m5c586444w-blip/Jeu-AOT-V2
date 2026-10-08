import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { chordPcs, parseChords } from "../../src/audio/notation";
import { MOOD_PIECES, PIECES, PIECE_BY_ID } from "../../src/audio/pieces";
import { MOOD_TONE, MUSIC_SEED, cycleSeconds, gapSeconds, playSequence, renderCached } from "../../src/audio/playlist";
import { renderPiece, resolveSection } from "../../src/audio/render";
import type { Accent, MusicEvent, Mood } from "../../src/audio/types";
import { busGains } from "../../src/ui/audio";
import { DEFAULT_SETTINGS, volumesOf } from "../../src/ui/settings";

const MOODS: readonly Mood[] = ["calme", "tension", "combat"];
const ACCENTS: readonly Accent[] = ["paradis", "marley", "hizuru"];
const everyRender = (): { id: string; mood: Mood; accent: Accent; events: readonly MusicEvent[]; seconds: number }[] =>
  MOODS.flatMap((mood) => MOOD_PIECES[mood].flatMap((id) => ACCENTS.map((accent) => ({ ...renderCached(id, mood, accent), accent }))));

/** Grave : en dessous de sol3 (MIDI 55). */
const LOW = 55;

describe("AUD.2 : répertoire", () => {
  it("chaque pièce se lit (mesures complètes) et a un arrangement pour chaque état où elle est jouée", () => {
    expect(new Set(PIECES.map((p) => p.id)).size).toBe(PIECES.length);
    for (const m of MOODS) for (const id of MOOD_PIECES[m]) expect(PIECE_BY_ID.get(id)?.moods[m], `${id} / ${m}`).toBeDefined();
    for (const p of PIECES) for (const name of Object.keys(p.sections)) expect(resolveSection(p, name).chords.length).toBeGreaterThan(0);
    for (const p of PIECES) for (const f of p.form) expect(p.sections[f], `${p.id} forme ${f}`).toBeDefined();
  });

  it("mode majeur ou accords parfaits seulement : aucun accord de septième, aucune quinte diminuée", () => {
    for (const p of PIECES) {
      for (const name of Object.keys(p.sections)) {
        for (const bar of resolveSection(p, name).chords) {
          for (const c of bar) {
            expect(["M", "m"], `${p.id}/${name}`).toContain(c.q);
            const pcs = chordPcs(c);
            expect((pcs[2] as number) - (pcs[0] as number) + 12).toSatisfy((x: number) => x % 12 === 7);
          }
        }
      }
    }
    expect(parseChords("C Am G").map((b) => b[0]?.q)).toEqual(["M", "m", "M"]);
  });

  it("tempo vif : aucun arrangement sous 90 battements par minute (« avec du peps »)", () => {
    for (const p of PIECES) for (const a of Object.values(p.moods)) expect(a?.bpm ?? 999).toBeGreaterThanOrEqual(90);
  });

  it("classique en paix, marches en tension et au combat ; cuivres seulement au combat", () => {
    expect(MOOD_PIECES.calme.every((id) => PIECE_BY_ID.get(id)?.beats !== undefined)).toBe(true);
    for (const m of ["tension", "combat"] as const) {
      for (const id of MOOD_PIECES[m]) {
        const arr = PIECE_BY_ID.get(id)?.moods[m];
        expect(arr?.acc, `${id}/${m}`).toContain("marche");
        expect(arr?.perc, `${id}/${m}`).toBeDefined();
      }
    }
    for (const r of everyRender()) {
      const brass = r.events.some((e) => e.voice === "trompette" || e.voice === "cor");
      expect(brass, `${r.id}/${r.mood}`).toBe(r.mood === "combat");
    }
  });

  it("les états diffèrent par le choix des pièces ET par le filtre et le volume", () => {
    expect(MOOD_TONE.calme.cutoff).toBeLessThan(MOOD_TONE.tension.cutoff);
    expect(MOOD_TONE.tension.cutoff).toBeLessThan(MOOD_TONE.combat.cutoff);
    expect(MOOD_TONE.calme.gain).toBeLessThan(MOOD_TONE.tension.gain);
    expect(MOOD_TONE.tension.gain).toBeLessThanOrEqual(MOOD_TONE.combat.gain);
    expect(MOOD_PIECES.calme.some((id) => !MOOD_PIECES.combat.includes(id))).toBe(true);
    expect(MOOD_PIECES.combat.some((id) => !MOOD_PIECES.calme.includes(id))).toBe(true);
  });
});

describe("CAUD-04 : aucune note grave tenue, aucune dissonance tenue", () => {
  it("aucune note ne dépasse 8 s ; aucune note grave ne dépasse 2 s ; la couverture continue du grave reste sous 8 s", () => {
    let longest = 0;
    let longestLow = 0;
    let coverage = 0;
    for (const r of everyRender()) {
      const low: [number, number][] = [];
      for (const e of r.events) {
        longest = Math.max(longest, e.dur);
        if (e.midi > 0 && e.midi < LOW) {
          longestLow = Math.max(longestLow, e.dur);
          low.push([e.t, e.t + e.dur]);
        }
      }
      // Union des intervalles graves (recollés si l'écart est inférieur à 50 ms).
      low.sort((a, b) => a[0] - b[0]);
      let cur: [number, number] | null = null;
      for (const [s, e] of low) {
        if (cur && s <= cur[1] + 0.05) cur[1] = Math.max(cur[1], e);
        else {
          if (cur) coverage = Math.max(coverage, cur[1] - cur[0]);
          cur = [s, e];
        }
      }
      if (cur) coverage = Math.max(coverage, cur[1] - cur[0]);
    }
    expect(longest).toBeLessThanOrEqual(8);
    expect(longestLow).toBeLessThanOrEqual(2);
    expect(coverage).toBeLessThanOrEqual(8);
    // Mesure publiée dans le rapport.
    console.log(`note la plus longue ${longest.toFixed(2)} s ; grave (< sol3) la plus longue ${longestLow.toFixed(2)} s ; couverture continue du grave ${coverage.toFixed(2)} s`);
  });

  it("aucun intervalle de seconde mineure, de triton ou de septième majeure tenu ensemble plus d'une seconde", () => {
    const bad: string[] = [];
    let pairs = 0;
    for (const r of everyRender()) {
      const held = r.events.filter((e) => e.midi > 0 && e.dur >= 1);
      for (let i = 0; i < held.length; i++) {
        const a = held[i] as MusicEvent;
        for (let j = i + 1; j < held.length; j++) {
          const b = held[j] as MusicEvent;
          if (b.t >= a.t + a.dur) break;
          const overlap = Math.min(a.t + a.dur, b.t + b.dur) - b.t;
          const ic = Math.abs(a.midi - b.midi) % 12;
          if (overlap >= 1) pairs++;
          if (overlap >= 1 && (ic === 1 || ic === 6 || ic === 11)) bad.push(`${r.id}/${r.mood} t=${b.t.toFixed(1)} ${a.midi}-${b.midi}`);
        }
      }
    }
    expect(bad).toEqual([]);
    // Le contrôle porte sur de vraies simultanéités tenues (il n'est pas vide).
    expect(pairs).toBeGreaterThan(500);
    console.log(`${pairs} paires de notes tenues ensemble plus d'une seconde, aucune en seconde mineure, triton ou septième majeure`);
  });
});

describe("CAUD-05 : listes longues et déterministes", () => {
  it("un tour de liste dure au moins 240 s dans chaque état, et une pièce ne revient pas avant 240 s", () => {
    const out: string[] = [];
    for (const m of MOODS) {
      const cycle = cycleSeconds(m);
      expect(cycle, m).toBeGreaterThanOrEqual(240);
      // Trois tours : l'écart entre deux départs de la même pièce.
      const seq = playSequence(MOOD_PIECES[m], MOOD_PIECES[m].length * 3);
      const start = new Map<string, number>();
      let t = 0;
      let minGap = Infinity;
      seq.forEach((id, i) => {
        const prev = start.get(id);
        if (prev !== undefined) minGap = Math.min(minGap, t - prev);
        start.set(id, t);
        t += renderCached(id, m).seconds + gapSeconds(m, i);
      });
      expect(minGap, m).toBeGreaterThanOrEqual(240);
      out.push(`${m} : tour ${cycle.toFixed(0)} s, ${MOOD_PIECES[m].length} pièces, écart minimal entre deux reprises ${minGap.toFixed(0)} s`);
    }
    console.log(out.join("\n"));
  });

  it("la suite ne répète jamais la même pièce deux fois de suite et reproduit toujours le même ordre", () => {
    for (const m of MOODS) {
      const a = playSequence(MOOD_PIECES[m], 40);
      expect(a).toEqual(playSequence(MOOD_PIECES[m], 40));
      for (let i = 1; i < a.length; i++) expect(a[i]).not.toBe(a[i - 1]);
      expect(new Set(a.slice(0, MOOD_PIECES[m].length)).size).toBe(MOOD_PIECES[m].length);
    }
    expect(playSequence(MOOD_PIECES.calme, 12, MUSIC_SEED + 1)).not.toEqual(playSequence(MOOD_PIECES.calme, 12));
  });

  it("génération déterministe : deux rendus identiques à l'octet près ; aucun Math.random ni Date.now dans src/audio", () => {
    for (const p of PIECES) for (const m of MOODS) if (p.moods[m]) expect(JSON.stringify(renderPiece(p, m))).toBe(JSON.stringify(renderPiece(p, m)));
    const files = (dir: string): string[] => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? files(join(dir, f)) : [join(dir, f)]));
    for (const f of files("src/audio").filter((x) => x.endsWith(".ts"))) {
      const code = readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
      expect(code.includes("Math.random"), f).toBe(false);
      expect(code.includes("Date.now"), f).toBe(false);
      expect(code.includes("performance.now"), f).toBe(false);
    }
  });

  it("silences : entre deux pièces, au moins 6 s au calme, 3 s en tension, 1,5 s au combat", () => {
    const floor: Record<Mood, number> = { calme: 6, tension: 3, combat: 1.5 };
    for (const m of MOODS) for (let i = 0; i < 200; i++) expect(gapSeconds(m, i)).toBeGreaterThanOrEqual(floor[m]);
  });
});

describe("CAUD-03 : volume par défaut", () => {
  it("le gain de musique par défaut (général × musique) ne dépasse pas 0,35", () => {
    const g = busGains(volumesOf(DEFAULT_SETTINGS), false, false).music;
    console.log(`gain de musique par défaut : ${g.toFixed(3)}`);
    expect(g).toBeLessThanOrEqual(0.35);
    expect(g).toBeGreaterThan(0);
  });

  it("« musique en combat seulement » coupe la musique hors combat", () => {
    const v = { ...volumesOf(DEFAULT_SETTINGS), musicCombatOnly: true };
    expect(busGains(v, false, false, "calme").music).toBe(0);
    expect(busGains(v, false, false, "tension").music).toBe(0);
    expect(busGains(v, false, false, "combat").music).toBeGreaterThan(0);
  });
});

describe("CAUD-06 : licences à jour", () => {
  it("chaque pièce a son entrée dans docs/ASSETS_LICENSES.md ; œuvres publiées avant 1929, compositeurs morts depuis plus de 70 ans", () => {
    const doc = readFileSync("docs/ASSETS_LICENSES.md", "utf8");
    const death: Record<string, number> = { "Ludwig van Beethoven": 1827, "Christian Petzold (attribué autrefois à J.-S. Bach)": 1733, "Wolfgang Amadeus Mozart": 1791, "Joseph Haydn": 1809 };
    for (const p of PIECES) {
      expect(doc.includes(`\`${p.id}\``), `entrée de ${p.id}`).toBe(true);
      expect(doc.includes(p.title), `titre de ${p.title}`).toBe(true);
      if (p.origin === "domaine_public") {
        expect(death[p.composer], p.composer).toBeDefined();
        expect((death[p.composer] as number) + 70).toBeLessThan(2026);
        expect(p.year).not.toBeNull();
        expect(p.year as number).toBeLessThan(1929);
        expect(doc.includes(p.composer), `compositeur ${p.composer}`).toBe(true);
      } else expect(p.composer).toBe("Projet");
    }
    expect(doc).toContain("composition du domaine public, transcription et synthèse originales du projet");
  });
});
