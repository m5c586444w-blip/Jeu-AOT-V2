import { describe, expect, it } from "vitest";
import { createBattle, stepBattle } from "../../../src/sim/tactical/battle";
import type { Battle } from "../../../src/sim/tactical/battle";
import { companySetup, skirmishSetup } from "../../../src/sim/tactical/setup";
import { STATES, gearOf, outfitOfSoldier, outfitOfTroop } from "../../../src/render/tactical3d/figures/catalog";
import { soldierShow, titanShow, troopShow } from "../../../src/render/tactical3d/figures/states";
import type { ShowMemory, SoldierShow, TitanShow } from "../../../src/render/tactical3d/figures/states";
import { crowdPoseOf } from "../../../src/render/tactical3d/figures/crowd";
import { LOD } from "../../../src/render/tactical3d/battle/units";
import { w850, w854 } from "../../sim/legacy-cases";

/**
 * Machine d'états de R3 (CR3-06, CR3-07) : à chaque pas de 3 batailles (deux de P4, une de compagnies de R2+), l'état montré de
 * chaque Titan, soldat et fantassin correspond à l'état de la simulation ; chaque état principal apparaît au moins une fois ;
 * les lots de la foule restent bornés (tenue × équipement × pose) quel que soit le nombre d'unités.
 */
const BATTLES: { label: string; make: () => Battle; ticks: number }[] = [
  { label: "P4, ville, 4 Titans dont un anormal", make: () => createBattle(w850, skirmishSetup(w850, "tmap_ville", [{ type: "ttype_moyen_errant", count: 3 }, { type: "ttype_anormal_coureur", count: 1 }], 18, 5)), ticks: 2400 },
  { label: "P4, forêt, grands Titans", make: () => createBattle(w850, skirmishSetup(w850, "tmap_foret", [{ type: "ttype_grand_errant", count: 3 }, { type: "ttype_petit_errant", count: 2 }], 24, 8)), ticks: 2400 },
  { label: "R2+, compagnies (≈ 400 unités)", make: () => createBattle(w854, companySetup(w854, { map: "tmap_plaine", seed: 3, soldiers: 120, allied: [{ kind: "fusilier", count: 60 }, { kind: "assaut", count: 30 }], enemy: [{ kind: "fusilier", count: 150 }, { kind: "mitrailleur", count: 30 }], titans: [{ type: "ttype_moyen_errant", count: 4 }] })), ticks: 1600 },
];

describe("états montrés = états de la simulation, à chaque pas", () => {
  const seenT = new Set<TitanShow>();
  const seenS = new Set<SoldierShow>();
  const seenTr = new Set<string>();
  for (const b of BATTLES) {
    it(b.label, () => {
      const bt = b.make();
      const hz = bt.world.balance.tick_hz;
      const tm = new Map<number, ShowMemory<TitanShow>>();
      const sm = new Map<number, ShowMemory<SoldierShow>>();
      const moved = new Map<number, number>();
      const bad: string[] = [];
      let maxKeys = 0;
      let units = 0;
      // Lecture initiale (avant le premier pas) : la vue lit l'état dès l'ouverture de la bataille.
      for (const t of bt.state.titans) tm.set(t.id, titanShow(null, t, 0, 0));
      bt.state.soldiers.forEach((s, i) => sm.set(i, soldierShow(null, s, 0, 0)));
      for (let k = 0; k < b.ticks && !bt.state.ended; k++) {
        const before = bt.state.titans.map((t) => ({ x: t.x, y: t.y }));
        stepBattle(bt);
        const time = bt.state.tick / hz;
        bt.state.titans.forEach((t, i) => {
          const m = titanShow(tm.get(t.id) ?? null, t, time, 1 / hz);
          tm.set(t.id, m);
          seenT.add(m.state);
          const p = before[i];
          const mv = !!p && Math.hypot(t.x - p.x, t.y - p.y) > 0.01;
          moved.set(t.id, mv ? 0 : (moved.get(t.id) ?? 2) + 1);
          const s = m.state;
          let ok: boolean;
          if (!t.alive) ok = s === "chute" || s === "abattu";
          else if (t.grabbing !== null) ok = s === (t.grabTimer <= STATES.devore_dernieres_s ? "devore" : "saisie");
          else if (t.legs > 0) ok = s === "rampant";
          else if (mv) ok = s === "marche" || s === "course";
          else if ((moved.get(t.id) ?? 0) >= 2) ok = s === "repos";
          else ok = s === "marche" || s === "course" || s === "repos";
          if (!ok) bad.push(`pas ${bt.state.tick}, Titan ${t.id} : simulation (vivant ${t.alive}, saisie ${t.grabbing}, jambes ${t.legs}, bouge ${mv}) → montré ${s}`);
        });
        const keys = new Set<string>();
        bt.state.soldiers.forEach((s, i) => {
          const m = soldierShow(sm.get(i) ?? null, s, time, 1 / hz);
          sm.set(i, m);
          seenS.add(m.state);
          const st = m.state;
          const ok =
            s.mode === "mort" || s.mode === "fui" ? st === "mort"
            : s.mode === "saisi" ? st === "saisi"
            : s.mode === "crochet" || s.mode === "rail" ? st === "accroche" || st === "vol"
            : s.mode === "vol" ? st === "vol" || st === "chute"
            : st === "garde" || st === "marche" || st === "course" || st === "coupe";
          if (!ok) bad.push(`pas ${bt.state.tick}, soldat ${i} : mode ${s.mode} → montré ${st}`);
          keys.add(`${outfitOfSoldier()}|odm|${crowdPoseOf(st, time)}`);
        });
        const first = new Set<string>();
        for (const t of bt.state.troops ?? []) {
          const sh = troopShow(t, bt.state.tick, hz);
          seenTr.add(sh);
          const ok = t.mode === "mort" || t.mode === "fui" ? sh === "mort" : t.mode === "marche" ? sh === "marche" : sh === "tir" || sh === "attente";
          if (!ok) bad.push(`pas ${bt.state.tick}, fantassin ${t.id} : mode ${t.mode} → montré ${sh}`);
          const lead = !first.has(t.section);
          first.add(t.section);
          const o = outfitOfTroop(t, lead);
          keys.add(`${o}|${gearOf(o, true)}|${crowdPoseOf(sh, time)}`);
        }
        units = Math.max(units, bt.state.soldiers.length + (bt.state.troops?.length ?? 0));
        maxKeys = Math.max(maxKeys, keys.size);
      }
      expect(bad.slice(0, 8), bad.slice(0, 8).join("\n")).toEqual([]);
      console.log(`${b.label} : ${bt.state.tick} pas, ${units} unités, lots de foule au plus ${maxKeys} (figures complètes au plus ${LOD.haut.detailMax})`);
      expect(maxKeys).toBeLessThanOrEqual(5 * 7);
    }, 120_000);
  }

  it("chaque état principal apparaît dans l'échantillon", () => {
    console.log(`Titans : ${[...seenT].join(", ")} ; soldats : ${[...seenS].join(", ")} ; fantassins : ${[...seenTr].join(", ")}`);
    for (const s of ["marche", "saisie", "devore", "chute", "abattu"] as const) expect(seenT.has(s), `Titan ${s}`).toBe(true);
    for (const s of ["vol", "mort", "garde"] as const) expect(seenS.has(s), `soldat ${s}`).toBe(true);
    for (const s of ["tir", "mort"]) expect(seenTr.has(s), `fantassin ${s}`).toBe(true);
  });
});
