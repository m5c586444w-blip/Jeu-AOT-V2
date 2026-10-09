import { describe, expect, it } from "vitest";
import { fnv1a } from "../../src/sim/core/hash";
import { battleHash, runBattle } from "../../src/sim/tactical/battle";
import { LEGACY_CASES } from "./legacy-cases";

/**
 * R2+ (CR2-03) : les batailles d'avant R2 (sans ordre temps réel, sans troupe) gardent EXACTEMENT leur déroulement.
 * Empreintes relevées sur `baaef9a` (avant toute modification de `src/sim`) : `battleHash` et empreinte de l'état complet.
 */
const BEFORE: Record<string, [string, string, string]> = {
  "plaine-moyen": ["5cd227b9", "371f4de6", "victoire"],
  "ville-ordres": ["6f9f37da", "11dfc673", "temps"],
  "foret-nuit-chariot": ["668d4df7", "84754f27", "victoire"],
  "mur-grand": ["b14dc542", "e55573b7", "victoire"],
  artillerie: ["62ff6385", "cfd817f0", "repli"],
  "porteur-allie": ["ef7731cc", "df238f02", "victoire"],
  "porteur-ennemi-lances": ["9b292f9e", "16273e8d", "victoire"],
};

describe("Batailles d'avant R2 inchangées (CR2-03)", () => {
  for (const c of LEGACY_CASES) {
    it(c.id, () => {
      const r = runBattle(c.world, c.setup, c.orders);
      expect([battleHash(r.state).toString(16), fnv1a(JSON.stringify(r.state)).toString(16), r.state.ended?.reason ?? ""]).toEqual(BEFORE[c.id]);
    });
  }
});
