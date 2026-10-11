import { describe, expect, it } from "vitest";
import { loadWorld } from "../../src/data/worldNode";
import { CEREMONIES, ceremonyFor } from "../../src/ui/eventDossier";
import { R3_SHEETS } from "../../src/render/tactical3d/r3Sheets";
import fr from "../../src/i18n/fr.json";

/** Dette n° 72 : cérémonies de l'œuvre en 3D depuis les dossiers d'événements (diplômes, assemblée d'Erwin, médailles). */
describe("cérémonies en 3D (dette n° 72)", () => {
  const world = loadWorld("data", "scn_sandbox_850");
  it("chaque cérémonie vise un événement canon existant et une planche de R3 ; ses titres sont traduits", () => {
    for (const [id, c] of Object.entries(CEREMONIES)) {
      expect(world.chronicle?.events.get(id)?.kind, id).toBe("canon");
      expect(R3_SHEETS as readonly string[], id).toContain(c.sheet);
      if (c.title) expect((fr as Record<string, string>)[c.title], id).toBeTruthy();
    }
  });
  it("la remise des médailles par la reine Historia suit E43 seulement si Historia a été couronnée", () => {
    expect(ceremonyFor("evt_850_104th_graduation", {})?.sheet).toBe("r3-ceremonie");
    expect(ceremonyFor("evt_850_yeager_basement", { historia_queen: true })).toEqual({ sheet: "r3-medailles", title: "evt.ceremony.medals", flag: "historia_queen" });
    expect(ceremonyFor("evt_850_yeager_basement", { historia_queen: false })).toBeNull();
    expect(ceremonyFor("evt_850_yeager_basement", undefined)).toBeNull();
    expect(ceremonyFor("evt_850_ocean", { historia_queen: true })).toBeNull();
    // Le couronnement (E36) lève bien le drapeau qu'attend la cérémonie.
    const coronation = world.chronicle?.events.get("evt_850_historia_coronation");
    expect(coronation?.effects.some((f) => f.op === "flag" && f.key === "historia_queen" && f.value === true)).toBe(true);
  });
});
