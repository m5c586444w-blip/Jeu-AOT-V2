import { describe, expect, it } from "vitest";
import { evaluerVerrou, fenetre, heureParis, VERROU_LIBRE } from "../../src/tools/coordLib";
import type { Verrou } from "../../src/tools/coordLib";

// Heures données en UTC ; Paris = UTC+2 en octobre (heure d'été jusqu'au 25 octobre 2026), UTC+1 en janvier.
const parisOct = (h: number, m: number): Date => new Date(Date.UTC(2026, 9, 13, h - 2, m));

describe("fenêtres horaires de Paris", () => {
  it("00:00 ouvre la fenêtre A, 07:59 est la dernière minute de A, 08:00 ouvre B", () => {
    expect(fenetre(parisOct(0, 0)).session).toBe("A");
    expect(fenetre(parisOct(7, 59)).session).toBe("A");
    expect(fenetre(parisOct(8, 0)).session).toBe("B");
    expect(fenetre(parisOct(15, 59)).session).toBe("B");
    expect(fenetre(parisOct(16, 0)).session).toBeNull();
    expect(fenetre(parisOct(23, 59)).phase).toBe("hors-fenetre");
  });

  it("phases : travail, plus de nouvelle tâche à T−45, clôture à T−20", () => {
    expect(fenetre(parisOct(6, 59)).phase).toBe("travail");
    expect(fenetre(parisOct(7, 15)).phase).toBe("plus-de-nouvelle-tache");
    expect(fenetre(parisOct(7, 39)).phase).toBe("plus-de-nouvelle-tache");
    expect(fenetre(parisOct(7, 40)).phase).toBe("cloture");
    expect(fenetre(parisOct(15, 40)).minutesRestantes).toBe(20);
  });

  it("l'heure d'hiver est prise en compte (janvier : UTC+1)", () => {
    const d = new Date(Date.UTC(2027, 0, 12, 7, 5));
    expect(heureParis(d)).toMatchObject({ heure: 8, minute: 5 });
    expect(fenetre(d).session).toBe("B");
  });
});

describe("verrou", () => {
  const maintenant = parisOct(10, 0);
  const il_y_a = (min: number, proprietaire: Verrou["proprietaire"]): Verrou => ({
    proprietaire,
    tache: "C4",
    depuis: new Date(maintenant.getTime() - 3600000).toISOString(),
    battement: new Date(maintenant.getTime() - min * 60000).toISOString(),
  });

  it("libre : on prend", () => {
    expect(evaluerVerrou(VERROU_LIBRE, "B", maintenant).decision).toBe("prendre");
  });
  it("même lettre avec un battement récent : un relais est une instance neuve, donc occupé", () => {
    expect(evaluerVerrou(il_y_a(5, "B"), "B", maintenant).decision).toBe("occupe");
    expect(evaluerVerrou(il_y_a(76, "B"), "B", maintenant).decision).toBe("prendre");
  });
  it("détenu par l'autre session avec un battement récent : occupé", () => {
    // Fenêtre de B, verrou de A battu il y a 10 min : on laisse A finir sa clôture.
    expect(evaluerVerrou(il_y_a(10, "A"), "B", maintenant).decision).toBe("occupe");
  });
  it("fenêtre du titulaire terminée : repris après 30 min sans battement", () => {
    expect(evaluerVerrou(il_y_a(31, "A"), "B", maintenant).decision).toBe("prendre");
  });
  it("périmé après 75 min sans battement", () => {
    const nuit = parisOct(3, 0);
    const v = (min: number): Verrou => ({ proprietaire: "B", tache: "C1", depuis: nuit.toISOString(), battement: new Date(nuit.getTime() - min * 60000).toISOString() });
    // À 03:00 la fenêtre courante est celle de A : la fenêtre de B est terminée, reprise après 30 min seulement.
    expect(evaluerVerrou(v(31), "A", nuit).decision).toBe("prendre");
    // Deux relais de la même lettre (fenêtre de A, verrou de A) : le seuil est de 75 min.
    const a = (min: number): Verrou => ({ ...v(min), proprietaire: "A" });
    expect(evaluerVerrou(a(74), "A", nuit).decision).toBe("occupe");
    expect(evaluerVerrou(a(76), "A", nuit).decision).toBe("prendre");
  });
  it("verrou de Gabriel respecté 6 h", () => {
    expect(evaluerVerrou(il_y_a(300, "GABRIEL"), "A", maintenant).decision).toBe("occupe");
    expect(evaluerVerrou(il_y_a(400, "GABRIEL"), "A", maintenant).decision).toBe("prendre");
  });
});
