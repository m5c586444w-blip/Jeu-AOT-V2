import { describe, expect, it } from "vitest";
import { mapContextItems } from "../../src/ui/mapContextMenu";

/** Menu contextuel de la carte (04 §3 : clic droit, menu sobre ; écart E-05 de l'audit P10). */
describe("menu contextuel de la carte", () => {
  it("dossier et centrage toujours ; armées du joueur (trois au plus) et expédition selon les registres présents", () => {
    const calls: string[] = [];
    const deps = {
      openDossier: (p: string) => calls.push(`dossier:${p}`),
      center: (p: string) => calls.push(`centrer:${p}`),
      playerArmies: () => [1, 2, 3, 4].map((n) => ({ id: `a${n}`, name: `Armée ${n}` })),
      openArmy: (a: string) => calls.push(`armee:${a}`),
      openExpeditions: () => calls.push("expedition"),
    };
    const items = mapContextItems("prov_trost", deps);
    expect(items.map((i) => i.action)).toEqual(["dossier", "centrer", "armee", "armee", "armee", "expedition"]);
    expect(items[0]?.label).toBe("Ouvrir le dossier");
    expect(items[2]?.label).toBe("Armée 1 : ouvrir la fiche");
    for (const it of items) it.run();
    expect(calls).toEqual(["dossier:prov_trost", "centrer:prov_trost", "armee:a1", "armee:a2", "armee:a3", "expedition"]);
    // Bac à sable économique : ni registre des armées ni des expéditions.
    expect(mapContextItems("prov_trost", { openDossier: deps.openDossier, center: deps.center, playerArmies: deps.playerArmies }).map((i) => i.action)).toEqual(["dossier", "centrer"]);
  });
});
