import { describe, expect, it } from "vitest";
import fr from "../../src/i18n/fr.json";
import en from "../../src/i18n/en.json";
import { AUTHOR_KEYS, findLeaks, playerText } from "../../src/ui/leaks";
import { isShownTech } from "../../src/ui/panels/researchPanel";
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from "../../src/ui/settings";
import { DEFAULT_BINDINGS } from "../../src/ui/keymap";

// UX0 (E-UX-1) : aucun texte destiné au joueur ne contient de mention interne. Le parcours de tous les écrans dans un
// vrai navigateur, mode auteur coupé puis allumé, est fait par `npm run smoke:ux0`.
const playerTexts = (dict: Record<string, string>): [string, string][] => Object.entries(dict).filter(([k]) => !AUTHOR_KEYS.some((r) => r.test(k)));

describe("UX0 : aucune mention interne visible (CUX0-02)", () => {
  it("le détecteur reconnaît chaque famille de fuite, sans confondre le canon (artillerie)", () => {
    for (const s of ["ÉTABLI", "Calendrier [A]", "Code T-ODM-04", "Mécanique en P9", "pas avant 845", "N'existe pas encore : il faut", "voir 02 §15", "(07 GM09)", "data/balance/economy.json", "(fichier 03)", "Point de brèche canon de 845", "prov_shiganshina"])
      expect(findLeaks(s).length, s).toBeGreaterThan(0);
    for (const s of ["Coup de canon", "Tirer au canon jusqu'à l'aube", "Canons des murs", "Approvisionnement rétabli : gaz", "Exige : Entretien d'ODM standardisé", "Phase de l'expédition : à l'aller"])
      expect(findLeaks(s), s).toEqual([]);
  });

  it("notes de données : renvois et marques retirés, le reste gardé", () => {
    expect(playerText("Murs ≈ 50 m (11 §2).")).toBe("Murs ≈ 50 m.");
    expect(playerText("Épaisseur ≈ 10 m [?] (01 §3.1).")).toBe("Épaisseur ≈ 10 m.");
    expect(playerText("Amiral (07 GM09, A).")).toBe("Amiral.");
    expect(playerText("Garnison (trois régiments).")).toBe("Garnison (trois régiments).");
  });

  it("français : aucun texte destiné au joueur ne contient de mention interne", () => {
    const leaks = playerTexts(fr as Record<string, string>).flatMap(([k, v]) => findLeaks(v).map((l) => `${k} → ${l.pattern} : ${l.excerpt}`));
    expect(leaks).toEqual([]);
  });

  it("anglais : idem", () => {
    const leaks = playerTexts(en as Record<string, string>).flatMap(([k, v]) => findLeaks(v).map((l) => `${k} → ${l.pattern} : ${l.excerpt}`));
    expect(leaks).toEqual([]);
  });
});

describe("UX0 : mode auteur et recherche (CUX0-03, UX0.3)", () => {
  it("mode auteur : F10, désactivé par défaut, persisté", () => {
    expect(DEFAULT_BINDINGS.author_mode).toBe("F10");
    expect(DEFAULT_SETTINGS.authorMode).toBe(false);
    const m = new Map<string, string>();
    const s = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
    saveSettings(s, { ...DEFAULT_SETTINGS, authorMode: true });
    expect(loadSettings(s).authorMode).toBe(true);
    m.set("murs-et-sang:preferences", JSON.stringify({ authorMode: "oui" }));
    expect(loadSettings(s).authorMode).toBe(false);
  });

  it("une étude dont la mécanique n'existe pas encore est absente, sauf acquise, à l'étude ou en mode auteur", () => {
    const future = { id: "tech_x", mechanic_phase: "P9" as const };
    expect(isShownTech(future, [], null)).toBe(false);
    expect(isShownTech(future, ["tech_x"], null)).toBe(true);
    expect(isShownTech(future, [], "tech_x")).toBe(true);
    expect(isShownTech(future, [], null, true)).toBe(true);
    expect(isShownTech({ id: "tech_y", mechanic_phase: "P7" as const }, [], null)).toBe(true);
    expect(isShownTech({ id: "tech_z" }, [], null)).toBe(true);
  });
});
