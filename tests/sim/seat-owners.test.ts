import { describe, expect, it } from "vitest";
import { loadWorld } from "../../src/data/worldNode";
import { createInitialState } from "../../src/sim/core/state";
import type { GameState } from "../../src/sim/core/state";
import { ownerOf, ownerOfInstitution, ownerOfProvince, SOLO_SEAT } from "../../src/sim/core/seat";
import { stateHash } from "../../src/sim/core/canonical";
import { applyEnveloped, authorize, ARMY_COMMANDS, FACTION_COMMANDS } from "../../src/sim/commands/apply";
import { createSim, createSimEndpoint } from "../../src/sim/sim";
import { playerOf } from "../../src/sim/armies/state";
import { ARMY_COMMANDS as ARMY_COMMAND_LAYER } from "../../src/sim/armies/layer";

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

  it("le siège de la faction jouée passe le contrôle : succès réel pour un budget valide, jamais d'erreur seat.err", () => {
    const s = two();
    const shares = Object.fromEntries(Object.entries(s.politics?.orgs ?? {}).map(([id, o]) => [id, o.budget]));
    const out = applyEnveloped(s, env("seat_1", { type: "SetBudget", shares }), undefined, w850);
    expect(out.commandIndex).toBe(s.commandIndex + 1);
    for (const c of [{ type: "EnactLaw", law: "law_inexistante" }, { type: "ChooseSuccessor", candidate: "char_x" }]) {
      let msg: string | null = null;
      try {
        applyEnveloped(s, env("seat_1", c), undefined, w850);
      } catch (e) {
        msg = (e as Error).message;
      }
      // Le fond refuse ces deux commandes (loi ou candidat inconnus) : l'erreur existe et ne vient pas du siège.
      expect(msg).not.toBeNull();
      expect(msg).not.toMatch(/seat\.err/);
    }
  });

  it("liste blanche : nominations, conseil, recherche, diplomatie refusés au siège d'une autre faction", () => {
    const s = two();
    const before = stateHash(s);
    const cmds = [
      { type: "Nominate", nomination: 0, candidate: "char_x" },
      { type: "AcceptProposal", proposal: 0 },
      { type: "RejectProposal", proposal: 0 },
      { type: "SetResearch", tech: null },
      { type: "DeclareWar", to: "fac_marley" },
      { type: "ProposeTreaty", to: "fac_marley", kind: "alliance" },
      { type: "RaiseArmies" },
    ];
    for (const c of cmds) expect(() => applyEnveloped(s, env("seat_2", c), undefined, w850), c.type).toThrow(/seat\.err\.not_faction/);
    expect(stateHash(s)).toBe(before);
  });

  it("type de commande non classé : refusé hors solo, laissé au fond en solo", () => {
    const s = two();
    const refusal = authorize(s, "seat_1", { type: "TypeInconnu" });
    expect(refusal?.code).toBe("seat.err.unclassified_command");
    expect(authorize(createInitialState(11, w850), SOLO_SEAT, { type: "TypeInconnu" })).toBeNull();
  });

  it("classement exhaustif : aucun type du schéma de commandes n'échappe aux deux ensembles", () => {
    for (const t of ARMY_COMMAND_LAYER) expect(ARMY_COMMANDS.has(t) || FACTION_COMMANDS.has(t), t).toBe(true);
    for (const t of ARMY_COMMANDS) expect(FACTION_COMMANDS.has(t), t).toBe(false);
  });

  it("armée ou flotte inconnue : refusée explicitement (seat.err.unknown_subject), même pour le siège de la faction", () => {
    const s = two();
    expect(authorize(s, "seat_1", { type: "ArmyHalt", army: "army_fantome" })?.code).toBe("seat.err.unknown_subject");
    expect(authorize(s, "seat_1", { type: "ArmyMerge", army: "army_850_est", into: "army_fantome" })?.code).toBe("seat.err.unknown_subject");
    expect(authorize(s, "seat_1", { type: "FleetMove", fleet: "fleet_fantome", to: "prov_mitras" })?.code).toBe("seat.err.unknown_subject");
    expect(authorize(s, "seat_1", { type: "ResolveEncounter", encounter: "enc_fantome", mode: "auto", orders: [] })?.code).toBe("seat.err.unknown_subject");
    const noArmies: GameState = { ...s };
    delete noArmies.armies;
    expect(authorize(noArmies, "seat_1", { type: "ArmyHalt", army: "army_850_est" })?.code).toBe("seat.err.unknown_subject");
    expect(() => applyEnveloped(s, env("seat_1", { type: "ArmyHalt", army: "army_fantome" }), undefined, w850)).toThrow(/seat\.err\.unknown_subject/);
  });

  it("armée connue : propriétaire accepté, autre siège refusé (not_owner)", () => {
    const s = two();
    expect(authorize(s, "seat_1", { type: "ArmyHalt", army: "army_850_est" })).toBeNull();
    expect(authorize(s, "seat_2", { type: "ArmyHalt", army: "army_850_est" })?.code).toBe("seat.err.not_owner");
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
