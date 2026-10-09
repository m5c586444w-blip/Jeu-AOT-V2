import { describe, expect, it } from "vitest";
import fr from "../../src/i18n/fr.json";
import { PANEL_IDS } from "../../src/ui/registers";
import { DEFAULT_SETTINGS, DEFAULT_TUTORIAL, loadSettings, saveSettings } from "../../src/ui/settings";
import { HINT_IDS } from "../../src/ui/tutorial/hints";
import { placeBubble } from "../../src/ui/tutorial/placement";
import { canContinue, enter, isFinished, next, resolveAnchor, settle, TUTORIAL_STEPS } from "../../src/ui/tutorial/steps";
import type { TutorialFacts } from "../../src/ui/tutorial/steps";

const text = fr as Record<string, string>;
const facts = (o: Partial<TutorialFacts> = {}): TutorialFacts => ({ panel: null, provinceOpen: false, mapMoved: false, daysPassed: 0, battle: false, ...o });

describe("TUT.1 : étapes du guide", () => {
  it("de 10 à 14 étapes, identifiants uniques, couvrant carte, province, ressources, armées, cabinet, recherche, missions, événements, bataille", () => {
    const ids = TUTORIAL_STEPS.map((s) => s.id);
    expect(ids.length).toBeGreaterThanOrEqual(10);
    expect(ids.length).toBeLessThanOrEqual(14);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ["carte", "province", "ressources", "armees", "cabinet", "recherche", "missions", "evenements", "bataille"]) expect(ids, id).toContain(id);
  });

  it("chaque étape a un titre, une explication, et une action si elle en demande une (texte sobre, en français)", () => {
    for (const s of TUTORIAL_STEPS) {
      expect(text[`tuto.${s.id}.titre`], s.id).toBeTruthy();
      expect(text[`tuto.${s.id}.corps`], s.id).toBeTruthy();
      if (s.action) expect(text[`tuto.${s.id}.action`], s.id).toBeTruthy();
      if (s.leave) expect(text[`tuto.${s.id}.attente`], s.id).toBeTruthy();
      expect(s.anchor.length, s.id).toBeGreaterThan(0);
    }
  });

  it("aucun texte du guide ne parle de phase, de canon, d'identifiant ni de spécification", () => {
    const all = Object.entries(text).filter(([k]) => /^(tuto|aide|menu\.tutorial|options\.(tutorial|hints))/.test(k));
    expect(all.length).toBeGreaterThan(40);
    for (const [k, v] of all) expect(v, k).not.toMatch(/\bphase\b|\bcanon\b|\bP\d{1,2}\b|\[[AC?]\]|\b(?:prov|char|evt|tech|mis)_|§|fichier \d/i);
  });

  it("l'action accomplie ouvre l'explication ; « Suivant » n'est permis qu'ensuite", () => {
    const i = TUTORIAL_STEPS.findIndex((s) => s.id === "economie");
    let cur = enter(i);
    expect(cur.phase).toBe("action");
    expect(canContinue(cur, facts({ panel: "economie" }))).toBe(false);
    expect(settle(cur, facts({ panel: "cabinet" })).phase).toBe("action");
    cur = settle(cur, facts({ panel: "economie" }));
    expect(cur.phase).toBe("explain");
    expect(canContinue(cur, facts({ panel: "economie" }))).toBe(true);
  });

  it("étape sans action : explication d'emblée ; étape de bataille : « Suivant » verrouillé tant que la bataille est ouverte", () => {
    expect(enter(0).phase).toBe("explain");
    const i = TUTORIAL_STEPS.findIndex((s) => s.id === "bataille");
    let cur = enter(i);
    cur = settle(cur, facts({ battle: true }));
    expect(cur.phase).toBe("explain");
    expect(canContinue(cur, facts({ battle: true }))).toBe(false);
    expect(canContinue(cur, facts({ battle: false }))).toBe(true);
  });

  it("le temps : un jour écoulé suffit ; la carte : un déplacement", () => {
    const t = enter(TUTORIAL_STEPS.findIndex((s) => s.id === "temps"));
    expect(settle(t, facts({ daysPassed: 0 })).phase).toBe("action");
    expect(settle(t, facts({ daysPassed: 1 })).phase).toBe("explain");
    const c = enter(TUTORIAL_STEPS.findIndex((s) => s.id === "carte"));
    expect(settle(c, facts({ mapMoved: true })).phase).toBe("explain");
  });

  it("le guide va jusqu'au bout, sautant les étapes facultatives dont l'élément est absent", () => {
    let cur = enter(0);
    const visited: string[] = [];
    while (!isFinished(cur)) {
      visited.push(TUTORIAL_STEPS[cur.index]?.id ?? "");
      cur = next(cur, () => true);
    }
    expect(visited).toEqual(TUTORIAL_STEPS.map((s) => s.id));
    // Sans missions ni recherche : ces étapes sont sautées, le reste suit.
    const absent = (sel: string): boolean => !/recherche|missions/.test(sel);
    cur = enter(0);
    const some: string[] = [];
    while (!isFinished(cur)) {
      some.push(TUTORIAL_STEPS[cur.index]?.id ?? "");
      cur = next(cur, absent);
    }
    expect(some).not.toContain("recherche");
    expect(some).not.toContain("missions");
    expect(some).toContain("fin");
  });

  it("« a || b » : le premier sélecteur qui existe", () => {
    const dom = new Set(["b"]);
    const q = (s: string): Element | null => (dom.has(s) ? ({} as Element) : null);
    expect(resolveAnchor("a || b", q)).not.toBeNull();
    expect(resolveAnchor("a || c", q)).toBeNull();
  });
});

describe("TUT.1 : placement de la bulle", () => {
  const vp = { width: 1366, height: 768 };
  const bubble = { width: 368, height: 180 };
  const overlaps = (a: { left: number; top: number }, b: { left: number; top: number; width: number; height: number }): boolean => a.left < b.left + b.width && b.left < a.left + bubble.width && a.top < b.top + b.height && b.top < a.top + bubble.height;

  it("sous un petit élément du haut, au-dessus d'un élément du bas ; toujours dans la fenêtre et hors de l'élément", () => {
    for (const anchor of [{ left: 1020, top: 10, width: 300, height: 40 }, { left: 380, top: 715, width: 70, height: 45 }, { left: 20, top: 300, width: 100, height: 40 }]) {
      const p = placeBubble(anchor, bubble, vp);
      expect(p.left).toBeGreaterThanOrEqual(8);
      expect(p.top).toBeGreaterThanOrEqual(8);
      expect(p.left + bubble.width).toBeLessThanOrEqual(vp.width - 8);
      expect(p.top + bubble.height).toBeLessThanOrEqual(vp.height - 8);
      expect(overlaps(p, anchor)).toBe(false);
    }
    expect(placeBubble({ left: 380, top: 715, width: 70, height: 45 }, bubble, vp).side).toBe("haut");
  });

  it("registre qui occupe presque toute la largeur : la bulle se range au bord, sans le masquer", () => {
    const panel = { left: 10, top: 82, width: 1030, height: 604 };
    const p = placeBubble(panel, bubble, vp);
    expect(p.side).toBe("bord");
    expect(p.left + bubble.width).toBeLessThanOrEqual(vp.width - 8);
    const hidden = Math.max(0, Math.min(p.left + bubble.width, panel.left + panel.width) - Math.max(p.left, panel.left));
    expect(hidden).toBeLessThanOrEqual(bubble.width * 0.25);
  });

  it("élément plein écran : la bulle se pose dedans, ou dans le coin demandé", () => {
    const full = { left: 0, top: 0, width: 1366, height: 768 };
    expect(placeBubble(full, bubble, vp).side).toBe("dedans");
    const dock = placeBubble(full, bubble, vp, 14, 8, [], "bas-droite");
    expect(dock.left + bubble.width).toBeGreaterThan(vp.width - 40);
    expect(dock.top + bubble.height).toBeGreaterThan(vp.height - 40);
  });

  it("évite les barres à garder lisibles", () => {
    const bar = { left: 0, top: 700, width: 1366, height: 68 };
    const p = placeBubble({ left: 0, top: 60, width: 1366, height: 640 }, bubble, vp, 14, 8, [bar]);
    expect(overlaps(p, bar)).toBe(false);
  });
});

describe("TUT.2 : préférences locales et aides contextuelles", () => {
  const memory = () => {
    const m = new Map<string, string>();
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
  };

  it("par défaut : guide ni fait ni désactivé, aides coupées jusqu'au premier guide", () => {
    expect(DEFAULT_SETTINGS.tutorial).toEqual({ done: false, disabled: false, hints: false, seen: [] });
    expect(loadSettings(null).tutorial).toEqual(DEFAULT_TUTORIAL);
  });

  it("conservées d'une session à l'autre ; valeurs invalides ignorées ; anciennes préférences sans guide acceptées", () => {
    const s = memory();
    saveSettings(s, { ...DEFAULT_SETTINGS, tutorial: { done: true, disabled: false, hints: true, seen: ["cabinet", "economie"] } });
    expect(loadSettings(s).tutorial).toEqual({ done: true, disabled: false, hints: true, seen: ["cabinet", "economie"] });
    s.setItem("murs-et-sang:preferences", JSON.stringify({ tutorial: { done: "oui", hints: 1, seen: [3, "cabinet", "cabinet", { a: 1 }] } }));
    expect(loadSettings(s).tutorial).toEqual({ done: false, disabled: false, hints: false, seen: ["cabinet"] });
    s.setItem("murs-et-sang:preferences", JSON.stringify({ uiScale: 125 }));
    expect(loadSettings(s).tutorial).toEqual(DEFAULT_TUTORIAL);
    expect(loadSettings(s).uiScale).toBe(125);
  });

  it("une aide par registre et par élément de jeu, chacune avec son texte", () => {
    for (const id of PANEL_IDS) expect(HINT_IDS, id).toContain(id);
    for (const id of HINT_IDS) expect(text[`aide.${id}`], id).toBeTruthy();
    expect(new Set(HINT_IDS).size).toBe(HINT_IDS.length);
  });

  it("le guide n'écrit rien dans l'état de partie : aucune référence au guide dans src/sim", async () => {
    const { readdirSync, readFileSync, statSync } = await import("node:fs");
    const { join } = await import("node:path");
    const files = (d: string): string[] => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? files(join(d, f)) : [join(d, f)]));
    const hits = files("src/sim").filter((f) => /tutorial|tutoriel/i.test(readFileSync(f, "utf8")));
    expect(hits).toEqual([]);
  });
});
