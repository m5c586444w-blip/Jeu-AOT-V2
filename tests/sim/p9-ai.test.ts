import { describe, expect, it } from "vitest";
import { loadWorld } from "../../src/data/worldNode";
import { stateHash } from "../../src/sim/core/canonical";
import { createInitialState, tickDay } from "../../src/sim/core/state";
import type { GameState } from "../../src/sim/core/state";
import { invasionPlan } from "../../src/sim/world/ai";
import { accepts, coalitionVote, monthlyDiplomacy } from "../../src/sim/world/diplomacy";
import { nationsWorld } from "../../src/sim/world/nations";
import fr from "../../src/i18n/fr.json";

/**
 * P9.2 (CP9-09 ; 02 §14, 18 §9) : IA des factions. Marley : invasion amphibie (complément de P9 : embarquer, naviguer,
 * débarquer) et projection de Titans ; Hizuru : neutralité qui bascule et revient ; Alliés : coalition fragile (vote à trois
 * voix) ; journal de raisonnement : chaque décision porte ses raisons, toutes traduites.
 */
const w = loadWorld("data", "scn_854");
const days = (s: GameState, n: number): GameState => {
  let x = s;
  for (let d = 0; d < n; d++) x = tickDay(x, w);
  return x;
};

describe("IA des factions (P9.2)", () => {
  const run = days(createInitialState(1, w), 731);
  const marley = (run.nations?.ai ?? []).filter((d) => d.faction === "fac_marley");

  it("Marley prépare une invasion de Paradis : port d'embarquement, route de mer, puis embarque, navigue et débarque", () => {
    const s0 = days(createInitialState(1, w), 60);
    const plan = s0.nations ? invasionPlan({ world: w, date: s0.date, ns: s0.nations, sh: s0.shifters, pol: s0.politics, st: s0.strategic }, "fac_marley") : null;
    expect(plan?.target).toBe("wprov_paradis");
    expect(plan?.seas.length).toBeGreaterThan(0);
    for (const step of ["embarquer:", "naviguer:"]) expect(marley.some((d) => d.action.startsWith(step)), step).toBe(true);
    // Débarquement réel : au moins une formation posée sur l'île.
    expect(marley.some((d) => /^debarquer:wprov_paradis:[1-9]/.test(d.action))).toBe(true);
    expect((run.nations?.fronts ?? []).some((f) => f.province === "wprov_paradis" && f.attacker === "fac_marley")).toBe(true);
  });

  it("Marley projette ses Titans là où l'on se bat", () => {
    expect(marley.some((d) => d.action.startsWith("titan:"))).toBe(true);
    expect((run.nations?.log ?? []).some((l) => l.key === "world.log.titan_projected")).toBe(true);
  });

  it("déterminisme : même graine, même suite de décisions", () => {
    const a = days(createInitialState(5, w), 200);
    const b = days(createInitialState(5, w), 200);
    expect(stateHash(a)).toBe(stateHash(b));
  });

  it("Hizuru : la neutralité bascule vers Paradis au-delà du seuil (alliance), et revient", () => {
    const ns = structuredClone(createInitialState(1, w).nations);
    if (!ns) throw new Error("couche des nations absente");
    const th = nationsWorld(w).balance.diplomacy.hizuru.threshold;
    ns.hizuruLean = th + 5;
    monthlyDiplomacy(w, ns, { year: 854, day: 30 });
    expect(ns.hizuruSide).toBe("fac_paradis");
    expect(ns.treaties.some((t) => t.kind === "alliance" && [t.a, t.b].includes("fac_hizuru") && [t.a, t.b].includes("fac_paradis"))).toBe(true);
    ns.hizuruLean = 0;
    monthlyDiplomacy(w, ns, { year: 854, day: 60 });
    expect(ns.hizuruSide).toBe("neutre");
    expect(ns.treaties.some((t) => t.kind === "alliance" && [t.a, t.b].includes("fac_hizuru"))).toBe(false);
  });

  it("Alliés : coalition fragile — trois voix ; un léger écart fait passer ou tomber la proposition", () => {
    const th = nationsWorld(w).balance.diplomacy.accept_threshold;
    expect(coalitionVote(w, th).passed).toBe(true);
    expect(coalitionVote(w, th).yes).toBe(2);
    expect(coalitionVote(w, th - 10).passed).toBe(false);
    const ns = createInitialState(1, w).nations;
    if (!ns) throw new Error("couche des nations absente");
    expect(accepts(w, ns, "fac_paradis", "fac_allies", "commerce").vote?.total).toBe(3);
  });

  it("journal de raisonnement : chaque décision porte des raisons chiffrées, toutes traduites", () => {
    const all = run.nations?.ai ?? [];
    expect(all.length).toBeGreaterThan(20);
    for (const d of all) {
      expect(d.reasons.length, d.action).toBeGreaterThan(0);
      for (const r of d.reasons) {
        expect(fr[r.key as keyof typeof fr], r.key).toBeTruthy();
        expect(Number.isFinite(r.value)).toBe(true);
      }
    }
  });
}, 180_000);
