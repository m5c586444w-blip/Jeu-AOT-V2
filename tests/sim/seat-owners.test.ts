import { describe, expect, it } from "vitest";
import { loadWorld } from "../../src/data/worldNode";
import { createInitialState } from "../../src/sim/core/state";
import type { GameState } from "../../src/sim/core/state";
import { ownerOf, ownerOfInstitution, ownerOfProvince, SOLO_SEAT } from "../../src/sim/core/seat";
import { stateHash } from "../../src/sim/core/canonical";
import { applyEnveloped } from "../../src/sim/commands/apply";
import { createSim, createSimEndpoint } from "../../src/sim/sim";
import { playerOf } from "../../src/sim/armies/state";

const w850 = loadWorld("data", "scn_sandbox_850");
const SEATS = { seats: { seat_1: { faction: "fac_paradis" }, seat_2: { faction: "fac_marley" } } };
const env = (seat: string, command: { type: string } & Record<string, unknown>) => ({ seat, day: 0, command });

describe("owner facultatif sur provinces et institutions (C3, D-157)", () => {
  it("ne change pas l'empreinte : le champ est absent de l'état initial", () => {
    const s = createInitialState(11, w850);
    for (const p of Object.values(s.strategic?.provinces ?? {})) expect("owner" in p).toBe(false);
    for (const o of Object.values(s.politics?.orgs ?? {})) expect("owner" in o).toBe(false);
  });

  it("ownerOfProvince : champ explicite, sinon siège du contrôleur, sinon personne", () => {
    expect(ownerOfProvince({}, "fac_paradis", undefined, "fac_paradis")).toBe(SOLO_SEAT);
    expect(ownerOfProvince({}, "fac_marley", undefined, "fac_paradis")).toBeNull();
    expect(ownerOfProvince({}, null, undefined, "fac_paradis")).toBeNull();
    expect(ownerOfProvince({}, "fac_marley", SEATS, "fac_paradis")).toBe("seat_2");
    expect(ownerOfProvince({ owner: "seat_2" }, "fac_paradis", SEATS, "fac_paradis")).toBe("seat_2");
  });

  it("ownerOfInstitution : siège de la faction jouée, ou champ explicite", () => {
    expect(ownerOfInstitution({}, undefined, "fac_paradis")).toBe(SOLO_SEAT);
    expect(ownerOfInstitution({}, SEATS, "fac_paradis")).toBe("seat_1");
    expect(ownerOfInstitution({ owner: "seat_2" }, SEATS, "fac_paradis")).toBe("seat_2");
  });

  it("ownerOf (entités à faction) reste inchangé", () => {
    expect(ownerOf({ faction: "fac_marley" }, SEATS, "fac_paradis")).toBe("seat_2");
    expect(ownerOf({ owner: "seat_2", faction: "fac_paradis" }, SEATS, "fac_paradis")).toBe("seat_2");
  });

  it("un owner posé sur une province ou une organisation survit à un tour de simulation", () => {
    const s = createInitialState(11, w850);
    const pid = Object.keys(s.strategic?.provinces ?? {})[0] as string;
    const oid = Object.keys(s.politics?.orgs ?? {})[0] as string;
    const prov = s.strategic?.provinces[pid];
    const org = s.politics?.orgs[oid];
    if (!prov || !org) throw new Error("état incomplet");
    prov.owner = "seat_2";
    org.owner = "seat_2";
    const next = applyEnveloped(s, env(SOLO_SEAT, { type: "AdvanceDays", n: 1 }), undefined, w850);
    expect(next.strategic?.provinces[pid]?.owner).toBe("seat_2");
    expect(next.politics?.orgs[oid]?.owner).toBe("seat_2");
  });
});

describe("Commandes de faction : un siège n'agit que pour sa faction", () => {
  const two = (): GameState => ({ ...createInitialState(11, w850), seats: SEATS });
  const law = (s: GameState): string => {
    const id = [...(s.politics ? w850.politics?.laws.keys() ?? [] : [])][0];
    return id ?? "law_inconnue";
  };

  it("lois, budget et succession : refusés pour le siège d'une autre faction, état intact", () => {
    const s = two();
    expect(playerOf(s.nations)).toBe("fac_paradis");
    const before = stateHash(s);
    const cmds = [
      { type: "EnactLaw", law: law(s) },
      { type: "RepealLaw", law: law(s) },
      { type: "SetBudget", shares: {} },
      { type: "ChooseSuccessor", candidate: "char_x" },
    ];
    for (const c of cmds) expect(() => applyEnveloped(s, env("seat_2", c), undefined, w850)).toThrow(/seat\.err\.not_faction/);
    expect(stateHash(s)).toBe(before);
  });

  it("le siège de la faction jouée passe le contrôle (l'erreur éventuelle vient du fond, pas du siège)", () => {
    const s = two();
    for (const c of [{ type: "EnactLaw", law: "law_inexistante" }, { type: "ChooseSuccessor", candidate: "char_x" }]) {
      try {
        applyEnveloped(s, env("seat_1", c), undefined, w850);
      } catch (e) {
        expect((e as Error).message).not.toMatch(/seat\.err/);
      }
    }
  });

  it("en solo, le siège solo agit pour la faction jouée", () => {
    const s = createInitialState(11, w850);
    const out = applyEnveloped(s, env(SOLO_SEAT, { type: "SetBudget", shares: Object.fromEntries(Object.entries(s.politics?.orgs ?? {}).map(([id, o]) => [id, o.budget])) }), undefined, w850);
    expect(out.commandIndex).toBe(s.commandIndex + 1);
  });
});

describe("Simulation : op « submit » (chemin de l'UI)", () => {
  it("applique l'enveloppe du siège solo et refuse un siège inconnu", () => {
    const sim = createSim(11, w850);
    const out = sim.submit(env(SOLO_SEAT, { type: "ArmyMove", army: "army_850_est", to: "prov_mitras" }));
    expect(out.armies?.armies.find((a) => a.id === "army_850_est")?.route.length).toBeGreaterThan(0);
    expect(sim.journal().length).toBe(1);
    expect(() => sim.submit(env("seat_2", { type: "ArmyHalt", army: "army_850_est" }))).toThrow(/unknown_seat/);
    expect(sim.journal().length).toBe(1);
  });

  it("le protocole de messages porte « submit »", () => {
    const handle = createSimEndpoint(() => { throw new Error("pas de monde"); });
    expect(handle({ id: 1, op: "init", seed: 5, scenario: null }).ok).toBe(true);
    const bad = handle({ id: 2, op: "submit", env: env("seat_9", { type: "Noop" }) });
    expect(bad.ok).toBe(false);
    const ok = handle({ id: 3, op: "submit", env: env(SOLO_SEAT, { type: "Noop" }) });
    expect(ok.ok).toBe(true);
  });
});
