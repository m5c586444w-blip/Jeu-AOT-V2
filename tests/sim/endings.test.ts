import { describe, expect, it } from "vitest";
import { loadWorld } from "../../src/data/worldNode";
import { stateHash } from "../../src/sim/core/canonical";
import { createInitialState, tickDay } from "../../src/sim/core/state";
import type { GameState } from "../../src/sim/core/state";
import { advance } from "../../src/sim/core/time";
import { applyCommand } from "../../src/sim/core/commands";
import { evaluateEnding } from "../../src/sim/ending/ending";

/**
 * P9.1 (CP9-03, CP9-07) : fins de partie par objectifs (02 §13), lues sur l'état sans l'écrire. États construits pour chaque
 * issue (victoire au terme, défaite, victoire anticipée de Marley) ; un 845 joué jusqu'au terme ; même état, même verdict.
 * 845 jouable : `scn_845` (après la chute de Maria) ; le bac à sable `scn_sandbox_845` des tests n'a pas de fin (partie libre).
 */
const w845 = loadWorld("data", "scn_845");
const w850 = loadWorld("data", "scn_sandbox_850");
const w854 = loadWorld("data", "scn_854");
const at = (s: GameState, days: number): GameState => ({ ...s, date: advance(s.date, days) });

describe("fins de partie (P9.1)", () => {
  it("chaque scénario a ses objectifs ; au départ la partie est en cours et l'évaluation n'écrit rien", () => {
    for (const w of [w845, w850, w854]) {
      const s = createInitialState(3, w);
      const h = stateHash(s);
      const e = evaluateEnding(w, s);
      expect(e, w.scenario.id).not.toBeNull();
      expect(e?.state).toBe("en_cours");
      expect(e?.objectives.length).toBeGreaterThanOrEqual(4);
      expect(stateHash(s)).toBe(h);
    }
    expect(w854.endings?.map((r) => r.camp).sort()).toEqual(["fac_marley", "fac_paradis"]);
  });

  it("850 : victoire au terme avec les cinq objectifs (tenir, Maria, vérité, monde extérieur, ordre) ; « au terme » sinon", () => {
    const s0 = createInitialState(3, w850);
    const s = at(s0, 1825);
    const events = structuredClone(s.events);
    const pol = structuredClone(s.politics);
    const st = structuredClone(s.strategic);
    if (!events || !pol || !st) throw new Error("couches attendues");
    for (const p of w850.provinces) if (p.region === "anneau_maria" || p.region === "mur_maria") (st.provinces[p.id] as { control: string }).control = "paradis";
    events.history["evt_850_yeager_basement"] = { status: "survenu", day: 0, choice: null } as unknown as (typeof events.history)[string];
    events.history["evt_850_ocean"] = { status: "survenu", day: 0, choice: null } as unknown as (typeof events.history)[string];
    for (const p of Object.values(st.provinces)) p.stability = 60;
    // La chronique a tout apporté, mais le royaume n'est pas en ordre : issue mitigée.
    const mixed = evaluateEnding(w850, { ...s, events, politics: pol, strategic: st });
    expect(mixed?.state).toBe("terme");
    expect(mixed?.objectives.filter((o) => !o.met).map((o) => o.id)).toEqual(["ordre"]);
    for (const p of Object.values(st.provinces)) p.stability = 72;
    const e = evaluateEnding(w850, { ...s, events, politics: pol, strategic: st });
    expect(e?.state).toBe("victoire");
    expect(e?.objectives.filter((o) => o.met).map((o) => o.id).sort()).toEqual(["dehors", "maria", "ordre", "tenir", "verite"]);
    // Avant le terme : en cours, même avec ces objectifs.
    expect(evaluateEnding(w850, { ...s0, events, politics: pol, strategic: st })?.state).toBe("en_cours");
  });

  it("défaites : légitimité effondrée (850), Rose perdue, famine (845)", () => {
    const s = createInitialState(3, w850);
    const pol = structuredClone(s.politics);
    if (!pol) throw new Error("couche politique absente");
    pol.legitimacy = 2;
    const e = evaluateEnding(w850, { ...s, politics: pol });
    expect(e?.state).toBe("defaite");
    expect(e?.defeat?.id).toBe("effondrement");
    const st = structuredClone(s.strategic);
    if (!st) throw new Error("couche stratégique absente");
    for (const p of w850.provinces) if (p.region === "anneau_rose" || p.region === "mur_rose") (st.provinces[p.id] as { control: string }).control = "titans";
    expect(evaluateEnding(w850, { ...s, strategic: st })?.defeat?.id).toBe("rose_perdue");
    const s5 = createInitialState(3, w845);
    const st5 = structuredClone(s5.strategic);
    if (!st5) throw new Error("couche stratégique absente");
    st5.stocks.food = 0;
    for (const p of Object.values(st5.provinces)) p.morale = 10;
    expect(evaluateEnding(w845, { ...s5, strategic: st5 })?.defeat?.id).toBe("famine");
  });

  it("854 : victoire anticipée de Marley (Fondateur repris, Paradis neutralisé, empire stable) ; défaite de Paradis", () => {
    const s = createInitialState(3, w854);
    const ns = structuredClone(s.nations);
    const sh = structuredClone(s.shifters);
    if (!ns || !sh) throw new Error("couches des nations et des porteurs attendues");
    ns.player = "fac_marley";
    ns.control["wprov_paradis"] = "fac_marley";
    (ns.nations["fac_marley"] as { stability: number }).stability = 60;
    (sh.titans["shifter_fondateur"] as { faction: string }).faction = "marley";
    const asMarley = evaluateEnding(w854, { ...s, nations: ns, shifters: sh });
    expect(asMarley?.camp).toBe("fac_marley");
    expect(asMarley?.state).toBe("victoire");
    ns.player = "fac_paradis";
    const asParadis = evaluateEnding(w854, { ...s, nations: ns, shifters: sh });
    expect(asParadis?.state).toBe("defaite");
    expect(["fondateur_perdu", "ile_perdue"]).toContain(asParadis?.defeat?.id);
  });

  it("845 joué jusqu'au terme : rations normales → disette et dépeuplement ; rations strictes → l'île tient ; déterministe", () => {
    expect(evaluateEnding(loadWorld("data", "scn_sandbox_845"), createInitialState(7, loadWorld("data", "scn_sandbox_845")))).toBeNull();
    const run = (level: "normal" | "strict"): { state: string; hash: string; day: number; defeat: string | null } => {
      let s = createInitialState(7, w845);
      if (level !== "normal") s = applyCommand(s, { type: "SetRationing", level }, undefined, w845);
      let e = evaluateEnding(w845, s);
      while (e && e.state === "en_cours") {
        s = tickDay(s, w845);
        e = evaluateEnding(w845, s);
      }
      return { state: e?.state ?? "", hash: stateHash(s), day: e?.day ?? 0, defeat: e?.defeat?.id ?? null };
    };
    const normal = run("normal");
    expect(normal.state).toBe("defaite");
    expect(normal.defeat).toBe("depeuplement");
    const strict = run("strict");
    expect(strict.state).toBe("victoire");
    expect(strict.day).toBe(1621);
    expect(run("strict")).toEqual(strict);
    console.log(`845 : rations normales → ${normal.state} (${normal.defeat}) au jour ${normal.day} ; strictes → ${strict.state} au jour ${strict.day}`);
  }, 180_000);
});
