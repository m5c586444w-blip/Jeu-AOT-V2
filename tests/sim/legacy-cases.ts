import { loadWorld } from "../../src/data/worldNode";
import { skirmishSetup } from "../../src/sim/tactical/setup";
import type { BattleSetup, TimedOrder } from "../../src/sim/tactical/types";
import type { World } from "../../src/sim/strategic/world";

/**
 * R2+ : batailles de référence d'avant R2 (ordres classiques, nuit, chariot, artillerie, porteurs, lances). Leurs empreintes
 * (`battleHash`) ont été relevées sur `baaef9a`, avant tout changement de `src/sim` : elles ne doivent pas bouger.
 */
export const w850: World = loadWorld("data", "scn_sandbox_850");
export const w854: World = loadWorld("data", "scn_854");

export interface LegacyCase {
  id: string;
  world: World;
  setup: BattleSetup;
  orders: TimedOrder[];
}

export const LEGACY_CASES: LegacyCase[] = [
  { id: "plaine-moyen", world: w850, setup: skirmishSetup(w850, "tmap_plaine", [{ type: "ttype_moyen_errant", count: 2 }], 18, 7), orders: [] },
  { id: "ville-ordres", world: w850, setup: skirmishSetup(w850, "tmap_ville", [{ type: "ttype_grand_errant", count: 2 }, { type: "ttype_petit_errant", count: 3 }], 24, 11), orders: [
    { tick: 40, squad: "esc_01", order: "tenir" }, { tick: 80, squad: "esc_02", order: "couvrir" }, { tick: 300, squad: "esc_03", order: "repli" }, { tick: 400, squad: "esc_01", order: "tuer", target: 1 },
  ] },
  { id: "foret-nuit-chariot", world: w850, setup: skirmishSetup(w850, "tmap_foret", [{ type: "ttype_moyen_errant", count: 3 }], 24, 3, true, true), orders: [] },
  { id: "mur-grand", world: w850, setup: skirmishSetup(w850, "tmap_mur", [{ type: "ttype_grand_errant", count: 4 }], 36, 5), orders: [{ tick: 20, squad: "esc_02", order: "couvrir" }] },
  { id: "artillerie", world: w854, setup: { ...skirmishSetup(w854, "tmap_plaine", [{ type: "ttype_grand_errant", count: 3 }], 18, 9), artillery: [
    { id: "bat_a", piece: "art_canon_rempart", munition: "mun_boulet", side: "allie", count: 3 },
    { id: "bat_e", piece: "art_marley_campagne", munition: "mun_shrapnel", side: "ennemi", count: 4 },
  ] }, orders: [] },
  { id: "porteur-allie", world: w850, setup: { ...skirmishSetup(w850, "tmap_plaine", [{ type: "ttype_grand_errant", count: 3 }], 12, 2), shifters: [{ shifter: "shifter_assaillant", side: "allie", name: "Porteur", character: null, stress: 30 }] }, orders: [] },
  { id: "porteur-ennemi-lances", world: w850, setup: { ...skirmishSetup(w850, "tmap_ville", [], 24, 4), shifters: [{ shifter: "shifter_cuirasse", side: "ennemi", name: "Porteur", character: null, stress: 20 }], thunderSpears: true }, orders: [{ tick: 100, squad: "esc_02", order: "tenir" }] },
];
