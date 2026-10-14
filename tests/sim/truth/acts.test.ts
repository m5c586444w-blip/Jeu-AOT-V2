import { describe, expect, it } from "vitest";
import { actAtYear, actOf, actPillars, actsInOrder, advanceActs, capabilitiesOf, eventsForFaction, hasCapability, initActs, knows, reveal, viewForSeat, viewForFaction } from "../../../src/sim/truth";
import type { TruthState } from "../../../src/sim/truth";
import { FA, FB, fresh, put, T0, tbal, tweak } from "./helpers";

const II = tbal.acts.find((a) => a.order === 2)?.id ?? "";
const III = tbal.acts.find((a) => a.order === 3)?.id ?? "";
const I = tbal.acts.find((a) => a.order === 1)?.id ?? "";
const II_FACTS = tbal.acts.find((a) => a.id === II)?.requires ?? [];
const III_FACTS = tbal.acts.find((a) => a.id === III)?.requires ?? [];

/** Dossier solide (4 preuves matérielles indépendantes) : fiabilité A. */
function solid(s: TruthState, faction: string, fact: string, claim: boolean): TruthState {
  let x = s;
  for (let i = 0; i < 4; i++) x = put(x, faction, fact, "preuve_materielle", claim);
  return x;
}

describe("P6 trois actes qui changent les règles", () => {
  it("acte de départ selon l'année du scénario (845, 850, 854) et ordre I < II < III", () => {
    expect(actsInOrder(tbal).map((a) => a.id)).toEqual([I, II, III]);
    expect([845, 846, 850, 853, 854, 900].map((y) => actAtYear(y, tbal))).toEqual([I, I, II, II, III, III]);
    expect(actAtYear(800, tbal)).toBe(I);
  });

  it("initActs : factions au départ de l'année, jamais de rétrogradation", () => {
    let s = initActs(fresh(), [FA, FB], 850, tbal);
    expect(actOf(s, FA, tbal)).toBe(II);
    s = initActs(s, [FA], 845, tbal);
    expect(actOf(s, FA, tbal)).toBe(II);
    s = initActs(s, [FA], 854, tbal);
    expect(actOf(s, FA, tbal)).toBe(III);
    expect(actOf(fresh(), FA, tbal)).toBe(I);
  });

  it("l'acte II se débloque par découverte (faits requis connus), pas autrement", () => {
    let s = initActs(fresh(), [FA, FB], 845, tbal);
    expect(advanceActs(s, FA, T0, tbal)).toBe(s);
    // Un seul fait sur deux : rien.
    s = solid(s, FA, II_FACTS[0] as string, true);
    expect(actOf(advanceActs(s, FA, T0, tbal), FA, tbal)).toBe(I);
    // Les deux faits : l'acte II est atteint, l'événement est visible de FA seule.
    for (const f of II_FACTS) s = solid(s, FA, f, true);
    const adv = advanceActs(s, FA, T0 + 3, tbal);
    expect(actOf(adv, FA, tbal)).toBe(II);
    expect(eventsForFaction(adv, FA)).toContainEqual({ type: "act_reached", day: T0 + 3, faction: FA, act: II });
    expect(actOf(adv, FB, tbal)).toBe(I);
    expect(eventsForFaction(adv, FB)).toEqual([]);
    // L'acte III exige d'autres faits : on reste en II.
    expect(actOf(adv, FA, tbal)).not.toBe(III);
  });

  it("une croyance fausse ou trop peu fiable ne débloque rien (on ne découvre pas en croyant)", () => {
    let wrong = initActs(fresh(), [FA], 845, tbal);
    for (const f of II_FACTS) wrong = solid(wrong, FA, f, false); // sûrs de l'inverse de la vérité
    expect(knows(wrong, FA, II_FACTS[0] as string, "D", T0, tbal)).toBe(false);
    expect(actOf(advanceActs(wrong, FA, T0, tbal), FA, tbal)).toBe(I);
    let weak = initActs(fresh(), [FA], 845, tbal);
    for (const f of II_FACTS) weak = put(weak, FA, f, "temoin", true); // vrai mais grade D (min_grade B exigé)
    expect(knows(weak, FA, II_FACTS[0] as string, "D", T0, tbal)).toBe(true);
    expect(actOf(advanceActs(weak, FA, T0, tbal), FA, tbal)).toBe(I);
    // Levier min_grade : abaisser l'exigence à D débloque.
    const lax = { ...tbal, acts: tbal.acts.map((a) => (a.id === II ? { ...a, min_grade: "D" as const } : a)) };
    expect(actOf(advanceActs(weak, FA, T0, lax), FA, lax)).toBe(II);
  });

  it("une vérification (reveal) débloque, et enchaîne II puis III si tous les faits sont connus", () => {
    let s = initActs(fresh(), [FA], 845, tbal);
    for (const f of [...II_FACTS, ...III_FACTS]) s = reveal(s, FA, f, T0, tbal);
    const adv = advanceActs(s, FA, T0, tbal);
    expect(actOf(adv, FA, tbal)).toBe(III);
    expect(adv.events.filter((e) => e.type === "act_reached").map((e) => (e as { act: string }).act)).toEqual([II, III]);
  });

  it("un acte atteint n'est jamais perdu, même si le dossier se dégrade (vieillissement)", () => {
    let s = initActs(fresh(), [FA], 845, tbal);
    for (const f of II_FACTS) s = put(s, FA, f, "archive", true);
    s = advanceActs(s, FA, T0, tbal);
    expect(actOf(s, FA, tbal)).toBe(II);
    expect(actOf(advanceActs(s, FA, T0 + 100_000, tbal), FA, tbal)).toBe(II);
    expect(knows(s, FA, II_FACTS[0] as string, "B", T0 + 100_000, tbal)).toBe(false);
  });

  it("capacités : la mer et l'extérieur s'ouvrent à l'acte II, la géopolitique à l'acte III ; marine et aviation réservées (jamais Paradis)", () => {
    const facs = ["fac_paradis", "fac_marley", "fac_hizuru", "fac_allies"];
    let s = fresh();
    for (const f of facs) expect(capabilitiesOf(s, f, tbal)).toEqual([]);
    s = initActs(s, facs, 850, tbal);
    for (const f of facs) expect(capabilitiesOf(s, f, tbal)).toEqual(["exterieur", "mer", "ports"]);
    s = initActs(s, facs, 854, tbal);
    expect(capabilitiesOf(s, "fac_paradis", tbal)).toEqual(["artillerie_moderne", "exterieur", "geopolitique", "mer", "ports"]);
    for (const f of ["fac_marley", "fac_hizuru", "fac_allies"]) {
      expect(hasCapability(s, f, "marine", tbal)).toBe(true);
      expect(hasCapability(s, f, "aviation", tbal)).toBe(true);
    }
    expect(hasCapability(s, "fac_paradis", "marine", tbal)).toBe(false);
    expect(hasCapability(s, "fac_paradis", "aviation", tbal)).toBe(false);
    // Levier : l'acte requis d'une capacité décale son ouverture.
    const late = tweak("capabilities", { ...tbal.capabilities, mer: { act: III, factions: null } });
    expect(hasCapability(initActs(fresh(), ["fac_paradis"], 850, late), "fac_paradis", "mer", late)).toBe(false);
  });

  it("piliers dominants par acte (26 §7) : I = P1, P2, P3", () => {
    expect(actPillars(I, tbal)).toEqual(["P1", "P2", "P3"]);
    expect(actPillars(III, tbal)).toContain("P7");
  });

  it("la vue expose l'acte et les capacités de la faction, par siège aussi ; siège inconnu : rien", () => {
    const s = initActs(fresh(), ["fac_paradis", "fac_marley"], 854, tbal);
    const v = viewForFaction(s, "fac_marley", T0, tbal);
    expect(v).toMatchObject({ faction: "fac_marley", act: III });
    expect(v.capabilities).toContain("marine");
    const seats = { seats: { seat_1: { faction: "fac_paradis" }, seat_2: { faction: "fac_marley" } } };
    expect(viewForSeat(s, "seat_2", seats, "fac_paradis", T0, tbal).capabilities).toContain("marine");
    expect(viewForSeat(s, "seat_1", seats, "fac_paradis", T0, tbal).capabilities).not.toContain("marine");
    expect(viewForSeat(s, "seat_9", seats, "fac_paradis", T0, tbal)).toEqual({ faction: "", act: "", capabilities: [], dossier: [] });
    expect(viewForSeat(s, "seat_1", undefined, "fac_paradis", T0, tbal).faction).toBe("fac_paradis");
    expect(viewForSeat(s, "seat_2", undefined, "fac_paradis", T0, tbal).faction).toBe("");
  });
});
