import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AudioEngine, MOODS, SFX_BUS, SFX_IDS, accentOf, battleCues, busGains, layerTargets, moodOf } from "../../src/ui/audio";
import { MOOD_PIECES } from "../../src/audio/pieces";
import { renderCached } from "../../src/audio/playlist";
import { FakeContext } from "../audio/fakeAudio";
import type { CueSnapshot, MoodInput, Volumes } from "../../src/ui/audio";
import fr from "../../src/i18n/fr.json";

const VOL: Volumes = { master: 100, music: 100, ambient: 100, sfx: 100, ui: 100, subtitles: true, musicCombatOnly: false };
const calmInput: MoodInput = { battle: false, pendingBattle: false, expeditionOut: false, atWar: false, recentAlerts: 0 };

function engine(v: Volumes = VOL): { e: AudioEngine; ctx: FakeContext; captions: string[] } {
  const ctx = new FakeContext();
  const captions: string[] = [];
  const e = new AudioEngine(() => ctx as unknown as AudioContext, v, (c) => captions.push(c));
  e.start();
  return { e, ctx, captions };
}

describe("audio (AC8-06)", () => {
  it("trois couches qui suivent l'état : calme, tension (bataille en attente, expédition, guerre, alerte), combat", () => {
    expect(moodOf(calmInput)).toBe("calme");
    for (const k of ["pendingBattle", "expeditionOut", "atWar"] as const) expect(moodOf({ ...calmInput, [k]: true })).toBe("tension");
    expect(moodOf({ ...calmInput, recentAlerts: 2 })).toBe("tension");
    expect(moodOf({ ...calmInput, atWar: true, battle: true })).toBe("combat");
    expect(layerTargets("calme")).toEqual({ calme: 1, tension: 0, combat: 0 });
    expect(layerTargets("tension").tension).toBe(1);
    expect(layerTargets("combat").combat).toBe(1);
    expect(layerTargets("combat").calme).toBe(0);
  });

  it("pièces déterministes ; percussions et cuivres : pas de cuivre en paix ni en tension ; accents de Marley (caisse) et d'Hizuru (harpe)", () => {
    const voices = (m: (typeof MOODS)[number], a: "paradis" | "marley" | "hizuru"): Set<string> =>
      new Set(MOOD_PIECES[m].flatMap((id) => renderCached(id, m, a).events.map((e) => e.voice)));
    for (const m of MOODS) expect(renderCached(MOOD_PIECES[m][0] as string, m)).toEqual(renderCached(MOOD_PIECES[m][0] as string, m));
    expect(voices("calme", "paradis").has("caisse")).toBe(false);
    expect(voices("combat", "paradis").has("caisse")).toBe(true);
    expect(voices("combat", "paradis").has("trompette")).toBe(true);
    for (const m of ["calme", "tension"] as const) {
      expect(voices(m, "paradis").has("trompette")).toBe(false);
      expect(voices(m, "paradis").has("cor")).toBe(false);
    }
    const snare = (a: "paradis" | "marley"): number => renderCached("marche_garnison", "tension", a).events.filter((e) => e.voice === "caisse").length;
    expect(snare("marley")).toBeGreaterThan(snare("paradis"));
    expect(renderCached("ode_joie", "calme", "hizuru").events.some((e) => e.voice === "harpe")).toBe(true);
    expect(renderCached("ode_joie", "calme", "paradis").events.some((e) => e.voice === "harpe")).toBe(false);
    expect(accentOf("fac_marley")).toBe("marley");
    expect(accentOf(undefined)).toBe("paradis");
  });

  it("le moteur joue les pièces de l'état et croise les états au changement", () => {
    const { e, ctx } = engine();
    ctx.currentTime = 1;
    e.tick();
    expect(e.stats.notes.calme).toBeGreaterThan(0);
    expect(e.stats.notes.combat).toBe(0);
    expect(MOOD_PIECES.calme).toContain(e.stats.piece);
    e.setMood("combat");
    ctx.currentTime = 10;
    e.tick();
    expect(e.stats.notes.combat).toBeGreaterThan(0);
    expect(MOOD_PIECES.combat).toContain(e.stats.piece);
    expect(e.stats.layers).toEqual(layerTargets("combat"));
    expect(ctx.made.osc).toBeGreaterThan(10);
  });

  it("volumes réglables, ducking et silence dramatique sur le bus de musique", () => {
    expect(busGains({ ...VOL, master: 50, music: 50 }, false, false).music).toBeCloseTo(0.25);
    expect(busGains(VOL, true, false).music).toBeCloseTo(0.25);
    expect(busGains(VOL, false, true).music).toBe(0);
    expect(busGains({ ...VOL, sfx: 0 }, false, false).sfx).toBe(0);
    const { e, ctx } = engine();
    e.setVolumes({ ...VOL, music: 40 });
    expect(e.stats.music).toBeCloseTo(0.4);
    e.duck(3);
    expect(e.stats.music).toBeCloseTo(0.1);
    ctx.currentTime = 4;
    e.tick();
    expect(e.stats.music).toBeCloseTo(0.4);
    e.silence(2);
    expect(e.stats.music).toBe(0);
    expect(e.stats.effects).toBe(1);
  });

  it("SFX : chacun se joue, avec un délai anti-avalanche ; sous-titres des sons importants si l'option est active", () => {
    const { e, ctx, captions } = engine();
    for (const id of SFX_IDS) expect(e.play(id)).toBe(true);
    expect(Object.keys(e.stats.sfx).sort()).toEqual([...SFX_IDS].sort());
    expect(e.play("cloche")).toBe(false);
    ctx.currentTime = 5;
    expect(e.play("cloche")).toBe(true);
    expect(captions).toContain(fr["audio.sfx.cloche"]);
    expect(captions).toContain(fr["audio.sfx.pas_titan"]);
    expect(captions).not.toContain(fr["audio.sfx.papier"]);
    const muted = engine({ ...VOL, subtitles: false });
    muted.e.play("canon");
    expect(muted.captions).toEqual([]);
    for (const id of SFX_IDS) expect((fr as Record<string, string>)[`audio.sfx.${id}`]).toBeTruthy();
  });

  it("R0.2a : un même sous-titre n'est pas répété en moins d'une seconde", () => {
    const { e, ctx, captions } = engine();
    for (const at of [0, 0.5, 0.9]) {
      ctx.currentTime = at;
      e.play("pas_titan");
    }
    expect(captions.filter((c) => c === fr["audio.sfx.pas_titan"])).toHaveLength(1);
    ctx.currentTime = 1.6;
    e.play("pas_titan");
    expect(captions.filter((c) => c === fr["audio.sfx.pas_titan"])).toHaveLength(2);
    // Deux sons différents au même instant gardent chacun leur sous-titre.
    ctx.currentTime = 1.7;
    e.play("canon");
    expect(captions).toContain(fr["audio.sfx.canon"]);
  });

  it("sans WebAudio, le jeu reste muet sans erreur", () => {
    const e = new AudioEngine(() => null, VOL);
    e.start();
    e.tick();
    expect(e.play("cloche")).toBe(false);
    expect(e.started).toBe(false);
  });

  it("effets de bataille tirés de l'écart des compteurs", () => {
    const a: CueSnapshot = { cuts: 0, napes: 0, limbs: 0, gas: 0, spears: 0, transformations: 0, grabs: 0, hooks: 0, dead: 0, titans: [0, 0] };
    expect(battleCues(a, a)).toEqual([]);
    const b: CueSnapshot = { ...a, cuts: 1, napes: 1, gas: 1, spears: 1, transformations: 1, hooks: 2, titans: [1, 0] };
    expect(battleCues(a, b).sort()).toEqual(["cable", "canon", "gaz", "impact_chair", "lame", "pas_titan", "transformation"]);
  });

  it("aucun échantillon dans le dépôt ; un seul module crée un lecteur de fichier audio (pistes de l'utilisateur)", () => {
    const files = (dir: string): string[] => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? files(join(dir, f)) : [join(dir, f)]));
    const all = [...files("src"), ...files("public")];
    expect(all.filter((f) => /\.(mp3|ogg|wav|flac|m4a|aac|opus)$/i.test(f))).toEqual([]);
    const code = all.filter((f) => /\.ts$/.test(f));
    expect(code.filter((f) => readFileSync(f, "utf8").includes("decodeAudioData"))).toEqual([]);
    expect(code.filter((f) => /new Audio\(/.test(readFileSync(f, "utf8")))).toEqual([join("src", "audio", "userTracks.ts")]);
  });

  it("chaque effet a son bus : bataille sur « effets », interface et notifications sur « interface »", () => {
    for (const id of SFX_IDS) expect(["sfx", "ui"]).toContain(SFX_BUS[id]);
    for (const id of ["gaz", "cable", "lame", "canon", "pas_titan", "transformation"] as const) expect(SFX_BUS[id]).toBe("sfx");
    for (const id of ["clic", "ouvrir", "fermer", "valider", "refus", "notification", "alerte", "cloche"] as const) expect(SFX_BUS[id]).toBe("ui");
    const g = busGains({ ...VOL, ui: 0, sfx: 50 }, false, false);
    expect(g.ui).toBe(0);
    expect(g.sfx).toBeCloseTo(0.5);
  });
});
