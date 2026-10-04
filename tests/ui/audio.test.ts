import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AudioEngine, IN_SCALE, MOODS, SFX_IDS, accentOf, battleCues, busGains, layerTargets, moodOf, scoreBar } from "../../src/ui/audio";
import type { CueSnapshot, MoodInput, Volumes } from "../../src/ui/audio";
import fr from "../../src/i18n/fr.json";

/** Contexte WebAudio factice : enregistre les nœuds créés et la dernière valeur visée par chaque gain. */
class FakeParam {
  value = 0;
  target = 0;
  setValueAtTime(v: number): this {
    this.target = v;
    return this;
  }
  linearRampToValueAtTime(v: number): this {
    this.target = v;
    return this;
  }
  exponentialRampToValueAtTime(v: number): this {
    this.target = v;
    return this;
  }
  setTargetAtTime(v: number): this {
    this.target = v;
    return this;
  }
}
class FakeNode {
  readonly out: FakeNode[] = [];
  connect(n: FakeNode): FakeNode {
    this.out.push(n);
    return n;
  }
}
class FakeGain extends FakeNode {
  readonly gain = new FakeParam();
}
class FakeOsc extends FakeNode {
  type = "sine";
  readonly frequency = new FakeParam();
  start(): void {}
  stop(): void {}
}
class FakeFilter extends FakeNode {
  type = "lowpass";
  readonly frequency = new FakeParam();
  readonly Q = new FakeParam();
}
class FakeSource extends FakeNode {
  buffer: unknown = null;
  loop = false;
  start(): void {}
  stop(): void {}
}
class FakeContext {
  currentTime = 0;
  readonly sampleRate = 8000;
  state = "running";
  readonly destination = new FakeNode();
  readonly made = { gain: 0, osc: 0, filter: 0, source: 0, buffer: 0 };
  readonly gains: FakeGain[] = [];
  createGain(): FakeGain {
    this.made.gain++;
    const g = new FakeGain();
    this.gains.push(g);
    return g;
  }
  createOscillator(): FakeOsc {
    this.made.osc++;
    return new FakeOsc();
  }
  createBiquadFilter(): FakeFilter {
    this.made.filter++;
    return new FakeFilter();
  }
  createBufferSource(): FakeSource {
    this.made.source++;
    return new FakeSource();
  }
  createBuffer(_c: number, len: number): { getChannelData: () => Float32Array } {
    this.made.buffer++;
    const d = new Float32Array(len);
    return { getChannelData: () => d };
  }
  resume(): Promise<void> {
    return Promise.resolve();
  }
}

const VOL: Volumes = { master: 100, music: 100, sfx: 100, subtitles: true };
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

  it("partition déterministe ; percussions en combat seulement ; accents de Marley (caisse claire) et d'Hizuru (gamme in)", () => {
    for (const m of MOODS) expect(scoreBar(m, "paradis", 5)).toEqual(scoreBar(m, "paradis", 5));
    const voices = (m: (typeof MOODS)[number], a: "paradis" | "marley" | "hizuru"): Set<string> => new Set([0, 1, 2, 3].flatMap((b) => scoreBar(m, a, b).map((n) => n.voice)));
    expect(voices("calme", "paradis").has("timbale")).toBe(false);
    expect(voices("combat", "paradis").has("timbale")).toBe(true);
    expect(voices("combat", "paradis").has("cuivre")).toBe(true);
    expect(voices("tension", "marley").has("caisse")).toBe(true);
    expect(voices("tension", "paradis").has("caisse")).toBe(false);
    const plucks = [0, 1, 2, 3].flatMap((b) => scoreBar("calme", "hizuru", b)).filter((n) => n.voice === "pluck");
    expect(plucks.length).toBeGreaterThan(0);
    expect(plucks.every((n) => (IN_SCALE as readonly number[]).includes(n.midi))).toBe(true);
    expect(accentOf("fac_marley")).toBe("marley");
    expect(accentOf(undefined)).toBe("paradis");
  });

  it("le moteur planifie les couches de l'humeur et croise les gains au changement", () => {
    const { e, ctx } = engine();
    e.tick();
    expect(e.stats.notes.calme).toBeGreaterThan(0);
    expect(e.stats.notes.combat).toBe(0);
    e.setMood("combat");
    ctx.currentTime = 10;
    e.tick();
    expect(e.stats.notes.combat).toBeGreaterThan(0);
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

  it("aucun échantillon externe : ni fichier son dans le dépôt, ni chargement audio dans le code", () => {
    const files = (dir: string): string[] => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? files(join(dir, f)) : [join(dir, f)]));
    const all = [...files("src"), ...files("public")];
    expect(all.filter((f) => /\.(mp3|ogg|wav|flac|m4a|aac|opus)$/i.test(f))).toEqual([]);
    const code = all.filter((f) => /\.ts$/.test(f)).map((f) => readFileSync(f, "utf8")).join("\n");
    expect(code.includes("decodeAudioData")).toBe(false);
    expect(/new Audio\(/.test(code)).toBe(false);
  });
});
