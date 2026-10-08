import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MOOD_PIECES } from "../../src/audio/pieces";
import { renderCached } from "../../src/audio/playlist";
import { defaultMoodOf, parseUserIndex, userTrackUrl } from "../../src/audio/userTracks";
import type { UserPlayer } from "../../src/audio/userTracks";
import { listUserMusic, userMusicIndex } from "../../src/tools/userMusic";
import { AMBIENCES, AudioEngine, SFX_IDS, libraryIds } from "../../src/ui/audio";
import type { Ambience, Volumes } from "../../src/ui/audio";
import { DEFAULT_SETTINGS, libraryOf, loadSettings, saveSettings, volumesOf } from "../../src/ui/settings";
import { FakeContext } from "./fakeAudio";

const VOL: Volumes = { master: 100, music: 100, ambient: 100, sfx: 100, ui: 100, subtitles: true, musicCombatOnly: false };

function make(v: Volumes = VOL, player: ((ctx: AudioContext) => UserPlayer) | null = null): { e: AudioEngine; ctx: FakeContext } {
  const ctx = new FakeContext();
  const e = new AudioEngine(() => ctx as unknown as AudioContext, v, () => undefined, player);
  e.start();
  return { e, ctx };
}

/** Fait avancer l'horloge du contexte factice par pas de 0,25 s (comme l'intervalle du jeu). */
function run(e: AudioEngine, ctx: FakeContext, seconds: number): void {
  const end = ctx.currentTime + seconds;
  while (ctx.currentTime < end) {
    ctx.currentTime += 0.25;
    e.tick();
  }
}

describe("AUD.2 : le moteur en session simulée", () => {
  it("20 minutes au calme : pièces de l'état, silences d'au moins 6 s, aucune reprise avant 240 s", () => {
    const { e, ctx } = make();
    run(e, ctx, 1200);
    const log = e.stats.pieces;
    expect(log.length).toBeGreaterThanOrEqual(6);
    for (const p of log) expect(MOOD_PIECES.calme).toContain(p.id);
    let minSilence = Infinity;
    for (let i = 1; i < log.length; i++) {
      const prev = log[i - 1];
      const end = (prev?.at ?? 0) + renderCached(prev?.id ?? "", "calme").seconds;
      minSilence = Math.min(minSilence, (log[i]?.at ?? 0) - end);
    }
    expect(minSilence).toBeGreaterThanOrEqual(5.9);
    const lastStart = new Map<string, number>();
    let minRepeat = Infinity;
    for (const p of log) {
      const prev = lastStart.get(p.id);
      if (prev !== undefined) minRepeat = Math.min(minRepeat, p.at - prev);
      lastStart.set(p.id, p.at);
    }
    expect(minRepeat).toBeGreaterThanOrEqual(240);
    console.log(`session simulée de 20 min : ${log.length} pièces, silence minimal entre deux pièces ${minSilence.toFixed(1)} s, reprise la plus proche à ${minRepeat.toFixed(0)} s`);
  });

  it("aucun oscillateur grave (20 à 130 Hz) ne dure plus de 1,2 s : ni dans la musique, ni dans les effets", () => {
    const { e, ctx } = make();
    for (const m of ["calme", "tension", "combat"] as const) {
      e.setMood(m);
      run(e, ctx, 150);
    }
    for (const id of SFX_IDS) {
      ctx.currentTime += 3;
      e.play(id);
    }
    const audible = ctx.oscillators.filter((o) => o.hz >= 20 && o.hz < 130);
    expect(audible.length).toBeGreaterThan(50);
    const longest = Math.max(...audible.map((o) => (o.stop ?? Infinity) - o.start));
    expect(longest).toBeLessThanOrEqual(1.2);
    // Les seuls oscillateurs sans fin sont les modulations lentes (sous 1 Hz) de l'ambiance.
    expect(ctx.oscillators.filter((o) => o.stop === null).every((o) => o.hz < 1)).toBe(true);
    console.log(`${audible.length} oscillateurs graves joués, le plus long ${longest.toFixed(2)} s`);
  });

  it("changement d'état : l'ancien état s'efface, le nouveau joue ses propres pièces", () => {
    const { e, ctx } = make();
    run(e, ctx, 30);
    expect(MOOD_PIECES.calme).toContain(e.stats.piece);
    e.setMood("tension");
    run(e, ctx, 10);
    expect(MOOD_PIECES.tension).toContain(e.stats.pieces[e.stats.pieces.length - 1]?.id);
    expect(e.stats.layers).toEqual({ calme: 0, tension: 1, combat: 0 });
  });

  it("« musique en combat seulement » : rien n'est joué en paix, la musique revient au combat", () => {
    const { e, ctx } = make({ ...VOL, musicCombatOnly: true });
    run(e, ctx, 60);
    expect(e.stats.notes.calme).toBe(0);
    expect(e.stats.music).toBe(0);
    expect(e.musicWanted).toBe(false);
    e.setMood("combat");
    run(e, ctx, 30);
    expect(e.stats.notes.combat).toBeGreaterThan(0);
    expect(e.stats.music).toBeGreaterThan(0);
  });

  it("curseurs : ambiances, effets et interface règlent chacun leur bus", () => {
    const { e } = make({ ...VOL, master: 50, ambient: 40, sfx: 20, ui: 80 });
    expect(e.stats.ambient).toBeCloseTo(0.2);
    expect(e.stats.effects).toBeCloseTo(0.1);
    expect(e.stats.ui).toBeCloseTo(0.4);
  });
});

describe("AUD.3 : ambiances et sons", () => {
  it("chaque ambiance démarre ses sources ; « aucune » les coupe ; l'état est publié", () => {
    const { e, ctx } = make();
    for (const kind of AMBIENCES as readonly Ambience[]) {
      const before = ctx.made.source;
      e.setAmbience(kind);
      expect(e.stats.ambience).toBe(kind);
      expect(ctx.made.source - before).toBe(kind === "aucune" ? 0 : 2);
    }
  });

  it("la forêt chante, la ville sonne au loin (événements rares, graine fixe)", () => {
    const { e, ctx } = make();
    e.setAmbience("foret");
    const o0 = ctx.oscillators.length;
    run(e, ctx, 60);
    expect(ctx.oscillators.slice(o0).filter((o) => o.hz > 2000).length).toBeGreaterThan(3);
    e.setAmbience("ville");
    const o1 = ctx.oscillators.length;
    run(e, ctx, 120);
    expect(ctx.oscillators.slice(o1).filter((o) => o.hz > 200 && o.hz < 800 && o.stop !== null).length).toBeGreaterThanOrEqual(3);
  });

  it("sons d'interface : chacun se joue sur le bus d'interface (sans sous-titre)", () => {
    const captions: string[] = [];
    const ctx = new FakeContext();
    const e = new AudioEngine(() => ctx as unknown as AudioContext, VOL, (c) => captions.push(c));
    e.start();
    for (const id of ["clic", "ouvrir", "fermer", "valider", "refus", "notification", "alerte"] as const) {
      ctx.currentTime += 10;
      expect(e.play(id)).toBe(true);
    }
    expect(captions).toEqual([]);
  });
});

describe("CAUD-07 / AUD.4 : pistes de l'utilisateur", () => {
  it("l'index n'accepte que des fichiers mp3 et ogg simples ; l'état se déduit du préfixe", () => {
    const list = parseUserIndex({ fichiers: [{ fichier: "combat-Marche_rapide.mp3", octets: 1 }, { fichier: "Valse.ogg" }, { fichier: "note.txt" }, { fichier: "../x.mp3" }, { fichier: ".cache.ogg" }, { fichier: 3 }] });
    expect(list.map((x) => [x.file, x.name, x.mood])).toEqual([["combat-Marche_rapide.mp3", "Marche rapide", "combat"], ["Valse.ogg", "Valse", "calme"]]);
    expect(parseUserIndex(null)).toEqual([]);
    expect(parseUserIndex({ fichiers: "non" })).toEqual([]);
    expect(defaultMoodOf("tension-a.ogg")).toBe("tension");
    expect(userTrackUrl("a b.mp3")).toBe("musique-utilisateur/a%20b.mp3");
  });

  it("le dossier assets_user/musique/ est listé (mp3 et ogg, sans les autres fichiers) ; absent, la liste est vide", () => {
    const dir = mkdtempSync(join(tmpdir(), "musique-"));
    for (const f of ["b.OGG", "a.mp3", "c.txt", "LISEZ-MOI.md"]) writeFileSync(join(dir, f), "x");
    mkdirSync(join(dir, "sous.mp3"));
    expect(listUserMusic(dir).map((x) => x.fichier)).toEqual(["a.mp3", "b.OGG"]);
    expect(JSON.parse(userMusicIndex(dir))).toEqual({ fichiers: [{ fichier: "a.mp3", octets: 1 }, { fichier: "b.OGG", octets: 1 }] });
    expect(listUserMusic(join(dir, "absent"))).toEqual([]);
    expect(readFileSync("assets_user/musique/LISEZ-MOI.md", "utf8")).toContain("Procédure");
    expect(readFileSync(".gitignore", "utf8")).toContain("assets_user/musique/*");
  });

  it("la source de la musique et l'état de chaque piste viennent des préférences ; une piste écartée est ignorée", () => {
    const tracks = [{ file: "a.mp3", mood: "calme" as const }, { file: "b.ogg", mood: "combat" as const }, { file: "c.mp3", mood: "calme" as const }];
    const s = { ...DEFAULT_SETTINGS, userTracks: { "a.mp3": "tension" as const, "c.mp3": "off" as const } };
    const lib = libraryOf(s, tracks);
    expect(lib.tracks).toEqual([{ file: "a.mp3", mood: "tension" }, { file: "b.ogg", mood: "combat" }]);
    expect(libraryIds({ ...lib, source: "mixte" }, "tension")).toEqual([...MOOD_PIECES.tension, "u:a.mp3"]);
    expect(libraryIds({ ...lib, source: "synthese" }, "tension")).toEqual([...MOOD_PIECES.tension]);
    expect(libraryIds({ ...lib, source: "perso" }, "combat")).toEqual(["u:b.ogg"]);
    expect(libraryIds({ ...lib, source: "perso" }, "calme")).toEqual([...MOOD_PIECES.calme]);
  });

  it("une piste de l'utilisateur est lue par le lecteur injecté, puis la liste reprend après un silence", () => {
    const started: string[] = [];
    const ends: (() => void)[] = [];
    const stopped: number[] = [];
    const player = (): UserPlayer => (url, _out, onEnded) => {
      started.push(url);
      ends.push(onEnded);
      return { stop: () => stopped.push(1) };
    };
    const { e, ctx } = make(VOL, player);
    e.setLibrary({ source: "perso", tracks: [{ file: "calme-a.mp3", mood: "calme" }] });
    run(e, ctx, 5);
    expect(started).toEqual(["musique-utilisateur/calme-a.mp3"]);
    expect(e.stats.piece).toBe("u:calme-a.mp3");
    ends[0]?.();
    expect(e.stats.piece).toBe("");
    run(e, ctx, 20);
    expect(started.length).toBe(2);
    e.setMood("tension");
    expect(stopped.length).toBe(1);
  });

  it("les préférences musicales sont conservées et validées", () => {
    const m = new Map<string, string>();
    const st = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
    const s = { ...DEFAULT_SETTINGS, volAmbient: 10, volUi: 20, musicCombatOnly: true, musicSource: "perso" as const, userTracks: { "x.mp3": "off" as const } };
    saveSettings(st, s);
    expect(loadSettings(st)).toEqual(s);
    m.set("murs-et-sang:preferences", JSON.stringify({ musicSource: "x", userTracks: { a: "zzz", b: "combat" }, volUi: 500 }));
    const l = loadSettings(st);
    expect(l.musicSource).toBe("mixte");
    expect(l.userTracks).toEqual({ b: "combat" });
    expect(l.volUi).toBe(DEFAULT_SETTINGS.volUi);
    expect(volumesOf(DEFAULT_SETTINGS).musicCombatOnly).toBe(false);
  });

  it("le panneau d'options expose cinq curseurs, la case « combat seulement », la source et les pistes", () => {
    const src = readFileSync("src/ui/optionsPanel.ts", "utf8");
    for (const k of ["volMaster", "volMusic", "volAmbient", "volSfx", "volUi", "musicCombatOnly", "musicSource", "userTracks"]) expect(src).toContain(k);
    const fr = JSON.parse(readFileSync("src/i18n/fr.json", "utf8")) as Record<string, string>;
    for (const k of ["volAmbient", "volUi", "musicCombatOnly", "musicSource", "tracks", "tracks_none", "track_off", "source_synthese", "source_mixte", "source_perso"]) expect(fr[`options.${k}`], k).toBeTruthy();
  });
});
