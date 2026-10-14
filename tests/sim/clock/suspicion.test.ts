import { describe, expect, it } from "vitest";
import { addEvidence, createClockState, levelOf, registerBearer, stepSuspicionDay, updateMind } from "../../../src/sim/clock";
import type { ClockState } from "../../../src/sim/clock";
import { cb, input, tweak, withBearer } from "./helpers";

const rec = (s: ClockState, t: string, o: string) => s.suspects[t]?.[o];
/** Ajoute des preuves du même type jusqu'au démasquage ; renvoie l'état et le nombre de preuves nécessaires. */
function untilUnmasked(s: ClockState, kind: string, b = cb, target = "r", observer = "paradis") {
  let x = s;
  let n = 0;
  while (!x.events.some((e) => e.type === "unmasked") && n < 500) {
    x = addEvidence(x, target, observer, kind, n, b);
    n++;
  }
  return { x, n };
}

describe("P5 suspicion : accumulation et démasquage", () => {
  it("le gain d'une preuve = poids × (1 − cover_k × couverture/100), et la couverture s'érode", () => {
    const s = addEvidence(withBearer(input("r")), "r", "paradis", "temoin", 1, cb);
    const w = cb.suspicion.evidence["temoin"] as number;
    const cover0 = cb.cover.initial["infiltre"] as number;
    const gain = w * (1 - (cb.suspicion.cover_k * cover0) / 100);
    expect(rec(s, "r", "paradis")?.value).toBeCloseTo(gain, 9);
    expect(s.bearers["r"]?.cover).toBeCloseTo(cover0 - cb.suspicion.cover_loss_per_point * gain, 9);
  });

  it("chaque type de preuve compte, plus lourd = plus de suspicion ; type inconnu refusé", () => {
    const kinds = Object.entries(cb.suspicion.evidence).sort((a, c) => a[1] - c[1]);
    const vals = kinds.map(([k]) => rec(addEvidence(withBearer(input("r", { role: "civil" })), "r", "paradis", k, 1, cb), "r", "paradis")?.value ?? 0);
    for (const v of vals) expect(v).toBeGreaterThan(0);
    for (let i = 1; i < vals.length; i++) expect(vals[i]).toBeGreaterThanOrEqual(vals[i - 1] as number);
    expect(() => addEvidence(withBearer(input("r")), "r", "paradis", "rumeur_inconnue", 1, cb)).toThrow(RangeError);
  });

  it("monotone : plus de preuves, jamais moins de suspicion ; démasquage au seuil, événement unique, dossier clos", () => {
    let s = withBearer(input("r", { role: "civil" }));
    let last = 0;
    for (let i = 0; i < 6 && !s.events.length; i++) {
      s = addEvidence(s, "r", "paradis", "fuite", i, cb);
      const v = rec(s, "r", "paradis")?.value ?? 0;
      expect(v).toBeGreaterThanOrEqual(last);
      last = v;
    }
    expect(s.events).toEqual([{ type: "unmasked", day: expect.any(Number) as number, bearer: "r", observer: "paradis" }]);
    expect(last).toBeGreaterThanOrEqual(cb.suspicion.unmask_threshold);
    const again = addEvidence(s, "r", "paradis", "transformation_vue", 99, cb);
    expect(again).toBe(s);
    expect(s.bearers["r"]?.exposedTo).toEqual(["marley", "paradis"]);
  });

  it("démasqué pour un observateur seulement : les autres factions ne savent rien", () => {
    const { x } = untilUnmasked(withBearer(input("r", { role: "civil" })), "interrogatoire");
    expect(x.bearers["r"]?.exposedTo).toContain("paradis");
    expect(x.bearers["r"]?.exposedTo).not.toContain("hizuru");
    expect(rec(x, "r", "hizuru")).toBeUndefined();
  });

  it("la couverture protège : un infiltré demande plus de preuves qu'un porteur connu", () => {
    const n = (role: string) => untilUnmasked(withBearer(input("r", { role })), "temoin").n;
    expect(n("infiltre")).toBeGreaterThan(n("civil"));
    expect(n("civil")).toBeGreaterThan(n("connu"));
    expect(n("connu")).toBe(Math.ceil(cb.suspicion.unmask_threshold / (cb.suspicion.evidence["temoin"] as number)));
  });

  it("cover_k, cover_loss_per_point, unmask_threshold et after_unmask changent le résultat", () => {
    const base = untilUnmasked(withBearer(input("r")), "temoin").n;
    expect(untilUnmasked(withBearer(input("r")), "temoin", tweak("suspicion", { cover_k: 0 })).n).toBeLessThan(base);
    expect(untilUnmasked(withBearer(input("r")), "temoin", tweak("suspicion", { cover_loss_per_point: 0 })).n).toBeGreaterThan(base);
    expect(untilUnmasked(withBearer(input("r")), "temoin", tweak("suspicion", { unmask_threshold: 40 })).n).toBeLessThan(base);
    expect(untilUnmasked(withBearer(input("r")), "temoin", tweak("cover", { after_unmask: 33 })).x.bearers["r"]?.cover).toBe(33);
    expect(untilUnmasked(withBearer(input("r")), "temoin").x.bearers["r"]?.cover).toBe(cb.cover.after_unmask);
  });

  it("la couverture ne devient jamais négative", () => {
    let s = withBearer(input("r"));
    for (let i = 0; i < 4; i++) s = addEvidence(s, "r", "paradis", "temoin", i, tweak("suspicion", { cover_loss_per_point: 100 }));
    expect(s.bearers["r"]?.cover).toBe(0);
  });

  it("niveaux de suspicion aux seuils exacts", () => {
    const t = cb.suspicion;
    expect(levelOf(t.suspect_threshold - 0.01, cb)).toBe("aucun");
    expect(levelOf(t.suspect_threshold, cb)).toBe("soupcon");
    expect(levelOf(t.strong_threshold - 0.01, cb)).toBe("soupcon");
    expect(levelOf(t.strong_threshold, cb)).toBe("fort");
    expect(levelOf(t.suspect_threshold, tweak("suspicion", { suspect_threshold: 40 }))).toBe("aucun");
  });

  it("sa propre faction et un observateur déjà informé n'ajoutent rien", () => {
    const s = withBearer(input("r"));
    expect(addEvidence(s, "r", "marley", "fuite", 1, cb)).toBe(s);
  });

  it("un innocent poussé au seuil déclenche une fausse accusation, sans exposer personne", () => {
    let s = createClockState();
    for (let i = 0; i < 5; i++) s = addEvidence(s, "pierre", "paradis", "interrogatoire", i, cb);
    expect(s.events).toEqual([{ type: "false_accusation", day: expect.any(Number) as number, target: "pierre", observer: "paradis" }]);
    expect(Object.keys(s.bearers)).toEqual([]);
    expect(addEvidence(s, "pierre", "paradis", "fuite", 9, cb)).toBe(s);
  });

  it("ne modifie pas l'état d'entrée (pureté) et reste déterministe", () => {
    const s = withBearer(input("r"));
    const snap = JSON.stringify(s);
    const a = addEvidence(s, "r", "paradis", "fuite", 3, cb);
    expect(JSON.stringify(s)).toBe(snap);
    expect(JSON.stringify(addEvidence(s, "r", "paradis", "fuite", 3, cb))).toBe(JSON.stringify(a));
  });
});

describe("P5 suspicion : décroissance et enregistrement", () => {
  const warm = () => addEvidence(withBearer(input("r", { role: "civil" })), "r", "paradis", "anomalie", 10, cb);
  it("aucune décroissance avant quiet_days, puis decay_per_day par jour, plancher 0", () => {
    const v0 = rec(warm(), "r", "paradis")?.value as number;
    const day = (d: number) => rec(stepSuspicionDay(warm(), d, cb), "r", "paradis")?.value as number;
    expect(day(10 + cb.suspicion.quiet_days - 1)).toBe(v0);
    expect(day(10 + cb.suspicion.quiet_days)).toBeCloseTo(v0 - cb.suspicion.decay_per_day, 9);
    expect(rec(stepSuspicionDay(warm(), 11 + cb.suspicion.quiet_days, tweak("suspicion", { decay_per_day: 1000 })), "r", "paradis")?.value).toBe(0);
    expect(day(10 + 1000)).toBeLessThanOrEqual(day(10 + cb.suspicion.quiet_days));
    expect(rec(stepSuspicionDay(warm(), 10 + cb.suspicion.quiet_days, tweak("suspicion", { quiet_days: 100 })), "r", "paradis")?.value).toBe(v0);
  });

  it("une nouvelle preuve repart l'horloge du calme ; un dossier clos (démasqué) ne décroît plus", () => {
    let s = warm();
    for (let d = 11; d < 40; d++) s = stepSuspicionDay(s, d, cb);
    const dropped = rec(s, "r", "paradis")?.value as number;
    s = addEvidence(s, "r", "paradis", "temoin", 40, cb);
    const after = stepSuspicionDay(s, 40 + cb.suspicion.quiet_days - 1, cb);
    expect(rec(after, "r", "paradis")?.value).toBe(rec(s, "r", "paradis")?.value);
    expect(rec(s, "r", "paradis")?.value as number).toBeGreaterThan(dropped);
    const { x } = untilUnmasked(withBearer(input("r", { role: "civil" })), "fuite");
    const v = rec(x, "r", "paradis")?.value;
    expect(rec(stepSuspicionDay(x, 500, cb), "r", "paradis")?.value).toBe(v);
  });

  it("registerBearer : couverture selon le rôle, rôle inconnu refusé, état d'esprit borné, anciens soupçons effacés", () => {
    for (const role of Object.keys(cb.cover.initial)) expect(withBearer(input("r", { role })).bearers["r"]?.cover).toBe(cb.cover.initial[role]);
    expect(() => withBearer(input("r", { role: "fantome" }))).toThrow(RangeError);
    expect(withBearer(input("r", { will: 250, stress: -5 })).bearers["r"]).toMatchObject({ will: 100, stress: 0 });
    let s = createClockState();
    s = addEvidence(s, "r", "paradis", "fuite", 1, cb);
    expect(rec(s, "r", "paradis")).toBeDefined();
    s = registerBearer(s, input("r"), cb);
    expect(s.suspects["r"]).toBeUndefined();
  });

  it("updateMind borne et ignore l'inconnu", () => {
    const s = withBearer(input("r"));
    expect(updateMind(s, "r", { stress: 300, bonds: -3 }).bearers["r"]).toMatchObject({ stress: 100, bonds: 0 });
    expect(updateMind(s, "zz", { stress: 5 })).toBe(s);
  });
});
