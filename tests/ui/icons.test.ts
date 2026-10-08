import { describe, expect, it } from "vitest";
import { EVENT_ICON, ICONS, RESOURCE_ICON, alertIcon, emblem, icon, registerIcon, resourceIcon } from "../../src/ui/icons";

/**
 * CUI-06 (phase UI, principe U6) : au moins 60 icônes dessinées dans le code, sur une grille de 24 px, trait de 1,6,
 * sans remplissage ; chemins valides, distincts, contenus dans la grille ; aucune icône d'une bibliothèque ni emoji.
 */

type Pt = [number, number];
const ARITY: Record<string, number> = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };

/** Interprète un chemin SVG et renvoie tous les points absolus (extrémités et points de contrôle). */
function pathPoints(d: string): Pt[] {
  const tokens = d.match(/[MLHVCSQTAZmlhvcsqtaz]|-?(?:\d+\.?\d*|\.\d+)/g) ?? [];
  const rest = d.replace(/[MLHVCSQTAZmlhvcsqtaz]|-?(?:\d+\.?\d*|\.\d+)|[\s,]/g, "");
  if (rest !== "") throw new Error(`caractères inattendus : « ${rest} »`);
  const pts: Pt[] = [];
  let x = 0;
  let y = 0;
  let sx = 0;
  let sy = 0;
  let cmd = "";
  let i = 0;
  const num = (): number => {
    const t = tokens[i++];
    if (t === undefined || /[a-zA-Z]/.test(t)) throw new Error(`nombre attendu après ${cmd}`);
    return Number(t);
  };
  while (i < tokens.length) {
    const t = tokens[i] as string;
    if (/[a-zA-Z]/.test(t)) {
      cmd = t;
      i++;
    } else if (cmd === "") throw new Error("le chemin ne commence pas par une commande");
    const up = cmd.toUpperCase();
    const rel = cmd !== up;
    if (up === "Z") {
      x = sx;
      y = sy;
      continue;
    }
    const n = ARITY[up];
    if (n === undefined) throw new Error(`commande inconnue ${cmd}`);
    const v = Array.from({ length: n }, num);
    const at = (k: number): number => v[k] ?? 0;
    const ox = rel ? x : 0;
    const oy = rel ? y : 0;
    if (up === "H") x = at(0) + (rel ? x : 0);
    else if (up === "V") y = at(0) + (rel ? y : 0);
    else if (up === "A") {
      x = at(5) + ox;
      y = at(6) + oy;
    } else {
      for (let k = 0; k < n - 2; k += 2) pts.push([at(k) + ox, at(k + 1) + oy]);
      x = at(n - 2) + ox;
      y = at(n - 1) + oy;
    }
    pts.push([x, y]);
    if (up === "M") {
      sx = x;
      sy = y;
      cmd = rel ? "l" : "L";
    }
  }
  return pts;
}

describe("icônes dessinées (CUI-06)", () => {
  const ids = Object.keys(ICONS);

  it("au moins 60 icônes", () => {
    expect(ids.length).toBeGreaterThanOrEqual(60);
  });

  it("chaque chemin est valide et reste dans la grille 24 px (marge de 1 px)", () => {
    for (const id of ids) {
      const pts = pathPoints(ICONS[id] ?? "");
      expect(pts.length, id).toBeGreaterThan(1);
      for (const [px, py] of pts) {
        expect(px >= 1 && px <= 23 && py >= 1 && py <= 23, `${id} : point (${px}, ${py}) hors grille`).toBe(true);
      }
    }
  });

  it("aucune icône en double", () => {
    expect(new Set(Object.values(ICONS)).size).toBe(ids.length);
  });

  it("rendu : trait 1,6 à bouts ronds, sans remplissage, masqué aux lecteurs d'écran, jamais d'emoji", () => {
    for (const id of ids) {
      const s = icon(id);
      expect(s).toContain('viewBox="0 0 24 24"');
      expect(s).toContain('stroke-width="1.6"');
      expect(s).toContain('fill="none"');
      expect(s).toContain('stroke-linecap="round"');
      expect(s).toContain('aria-hidden="true"');
      expect(/\p{Extended_Pictographic}/u.test(s), id).toBe(false);
    }
    expect(icon("inconnue")).toBe("");
    expect(icon("gaz", "ico ico--l")).toContain('class="ico ico--l"');
  });

  it("ressources, registres, familles d'événements et alertes renvoient vers des icônes existantes", () => {
    for (const r of Object.keys(RESOURCE_ICON) as (keyof typeof RESOURCE_ICON)[]) {
      expect(ICONS[RESOURCE_ICON[r]], r).toBeDefined();
      expect(resourceIcon(r)).toContain("<svg");
    }
    const registres = ["personnages", "cabinet", "decrets", "organisations", "conseil", "journal", "expeditions", "chronique", "renseignement", "recherche", "porteurs", "monde", "diplomatie", "archives", "gazette", "epilogue", "economie", "menu"];
    for (const r of registres) expect(registerIcon(r), r).toContain("icone--registre");
    for (const e of Object.values(EVENT_ICON)) expect(ICONS[e], e).toBeDefined();
    for (const k of ["log.wall_breached", "log.char_died", "log.food_shortage", "log.unknown"]) expect(ICONS[alertIcon(k)], k).toBeDefined();
  });

  it("blasons des quatre nations : chemins valides sur une grille de 48 px", () => {
    for (const f of ["fac_paradis", "fac_marley", "fac_hizuru", "fac_allies"]) {
      const s = emblem(f);
      expect(s).toContain('viewBox="0 0 48 48"');
      const d = /d="([^"]+)"/.exec(s)?.[1] ?? "";
      for (const [px, py] of pathPoints(d)) expect(px >= 0 && px <= 48 && py >= 0 && py <= 48, `${f} (${px}, ${py})`).toBe(true);
    }
    expect(emblem("fac_inconnue")).toBe("");
  });
});
