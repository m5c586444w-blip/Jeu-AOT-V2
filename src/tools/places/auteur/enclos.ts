import type { Block, Gabarit, Place, Street } from "../../../data/placeSchema";
import { area, centroid } from "../../../render/tactical3d/places/geom";
import { pt, r1 as r, roundPoly } from "./kit";
import type { Claim, Quarter } from "./saillie";

/**
 * Lieu sans enceinte (C15, tranche 2) — outil des plans d'auteur du camp d'entraînement et du quartier général : un damier
 * rectangulaire d'auteur (lignes données une à une), des cellules réclamées (places, parcs, vides), des îlots par quartier.
 * Le lieu est un `Place` N1 à `enceinte: null` et sans porte ni mur : le schéma ne modélise pas l'enceinte propre d'un camp ou
 * d'un complexe (dette consignée dans `docs/reports/C15.md`). Tout ce que l'outil produit est [A].
 * Repère du plan : mètres, x vers l'est, y vers le sud.
 */
export interface EnclosCtx {
  /** Point du damier (s, t) = (x, y). */
  at(s: number, t: number): [number, number];
  /** Centre de la cellule (i, j). */
  cell(i: number, j: number): [number, number];
}

export interface EnclosSpec {
  id: string;
  nom: string;
  libelle: string;
  canon: Place["canon"];
  sources: Place["sources"];
  province: string | null;
  style: string;
  population: Place["population"];
  densite: Place["densite"];
  orientation: Place["orientation"];
  s: readonly (readonly [number, number])[];
  t: readonly (readonly [number, number])[];
  names: { s: readonly string[]; t: readonly string[]; lanes: readonly string[] };
  gabarits: Record<string, Gabarit>;
  quarters: Record<string, Quarter>;
  quarterAt(c: [number, number], i: number, j: number): string;
  claims: Record<string, Claim>;
  /** Marge ajoutée autour du damier pour le périmètre et l'emprise rendue (m). */
  marge_m: number;
  etendue_m: number;
  batiments(ctx: EnclosCtx): Place["batiments"];
  vegetation(ctx: EnclosCtx, parcs: Place["vegetation"]["parcs"]): Place["vegetation"];
  eau(ctx: EnclosCtx): Place["eau"];
  /** Vues propres (les quatre vues de base sont ajoutées). */
  points_de_vue(ctx: EnclosCtx): Place["points_de_vue"];
  etats(ctx: EnclosCtx): Place["etats"];
  extraStreets?(ctx: EnclosCtx): Street[];
}

export function buildEnclos(spec: EnclosSpec): Place {
  const sl = spec.s;
  const tl = spec.t;
  const ctx: EnclosCtx = {
    at: (s, t) => pt(s, t),
    cell: (i, j) => pt(((sl[i] as readonly [number, number])[0] + (sl[i + 1] as readonly [number, number])[0]) / 2, ((tl[j] as readonly [number, number])[0] + (tl[j + 1] as readonly [number, number])[0]) / 2),
  };
  const claimOf = (i: number, j: number): Claim | undefined => spec.claims[`${i},${j}`];
  const mergedId = (i: number, j: number): string | null => {
    const c = claimOf(i, j);
    return c && (c.kind === "place" || c.kind === "parc") ? c.id : null;
  };

  // ——— Rues : segment par segment (rien entre deux cellules d'une même place ou d'un même parc) ———
  const rues: Street[] = [];
  let lane = 0;
  const lineStreets = (axis: "s" | "t"): void => {
    const lines = axis === "s" ? sl : tl;
    const cross = axis === "s" ? tl : sl;
    const names = axis === "s" ? spec.names.s : spec.names.t;
    let named = 0;
    lines.forEach(([v, w], k) => {
      const polys: [number, number][][] = [];
      for (let j = 0; j + 1 < cross.length; j++) {
        const m0 = axis === "s" ? mergedId(k - 1, j) : mergedId(j, k - 1);
        const m1 = axis === "s" ? mergedId(k, j) : mergedId(j, k);
        if (m0 !== null && m0 === m1) continue;
        const c0 = (cross[j] as readonly [number, number])[0];
        const c1 = (cross[j + 1] as readonly [number, number])[0];
        const a = axis === "s" ? pt(v, c0) : pt(c0, v);
        const b = axis === "s" ? pt(v, c1) : pt(c1, v);
        const last = polys[polys.length - 1];
        const end = last?.[last.length - 1];
        if (last && end && Math.hypot(end[0] - a[0], end[1] - a[1]) < 0.5) last.push(b);
        else polys.push([a, b]);
      }
      const narrow = w <= 5;
      const nom = narrow ? (spec.names.lanes[lane++ % spec.names.lanes.length] as string) : (names[named++ % names.length] as string);
      polys.forEach((p, n) => {
        const trace = p.length > 2 ? [p[0] as [number, number], p[p.length - 1] as [number, number]] : p;
        rues.push({ id: `${axis}-${k}${polys.length > 1 ? `-${n}` : ""}`, nom, canon: "A", type: narrow ? "ruelle" : "rue", trace, largeur_m: w, revetement: narrow ? "terre" : "paves" });
      });
    });
  };
  lineStreets("s");
  lineStreets("t");
  if (spec.extraStreets) rues.push(...spec.extraStreets(ctx));

  // ——— Cellules : îlots, places, parcs ———
  const ilots: Block[] = [];
  const places: Place["places_publiques"] = [];
  const parcs: Place["vegetation"]["parcs"] = [];
  const merged = new Map<string, { claim: Claim; i0: number; i1: number; j0: number; j1: number }>();
  const hw = (lines: typeof sl, k: number): number => (lines[k] as readonly [number, number])[1] / 2 + 1.2;
  const rectOf = (i0: number, i1: number, j0: number, j1: number): [number, number][] => {
    const s0 = (sl[i0] as readonly [number, number])[0] + hw(sl, i0);
    const s1 = (sl[i1] as readonly [number, number])[0] - hw(sl, i1);
    const t0 = (tl[j0] as readonly [number, number])[0] + hw(tl, j0);
    const t1 = (tl[j1] as readonly [number, number])[0] - hw(tl, j1);
    if (s1 - s0 < 4 || t1 - t0 < 4) return [];
    return [pt(s0, t0), pt(s1, t0), pt(s1, t1), pt(s0, t1)];
  };
  for (let i = 0; i + 1 < sl.length; i++) {
    for (let j = 0; j + 1 < tl.length; j++) {
      const c = claimOf(i, j);
      if (c?.kind === "vide") continue;
      if (c && (c.kind === "place" || c.kind === "parc")) {
        const m = merged.get(c.id);
        if (m) {
          m.i0 = Math.min(m.i0, i);
          m.i1 = Math.max(m.i1, i + 1);
          m.j0 = Math.min(m.j0, j);
          m.j1 = Math.max(m.j1, j + 1);
        } else merged.set(c.id, { claim: c, i0: i, i1: i + 1, j0: j, j1: j + 1 });
        continue;
      }
      const pc = rectOf(i, i + 1, j, j + 1);
      if (pc.length < 3 || area(pc) < 300) continue;
      const key = spec.quarterAt(centroid(pc), i, j);
      const q = Object.values(spec.quarters).find((x) => x.id === key);
      if (!q) continue;
      const ov = c?.kind === "ilot" ? c : null;
      ilots.push({ id: `i-${i}-${j}`, quartier: ov?.quartier ?? q.id, fonction: ov?.fonction ?? q.fonction, polygone: roundPoly(pc), densite_bati: ov?.densite ?? q.densite, gabarit: ov?.gabarit ?? q.gabarit });
    }
  }
  for (const { claim, i0, i1, j0, j1 } of merged.values()) {
    const pc = rectOf(i0, i1, j0, j1);
    if (pc.length < 3 || area(pc) < 300) continue;
    if (claim.kind === "place") {
      const c = centroid(pc);
      places.push({ id: claim.id, nom: claim.nom, canon: "A", polygone: roundPoly(pc), revetement: claim.revetement, fontaine: claim.fontaine ? pt(c[0], c[1]) : null, marche: claim.marche });
    } else if (claim.kind === "parc") parcs.push({ id: claim.id, nom: claim.nom, canon: "A", polygone: roundPoly(pc), essences: claim.essences, arbres_par_ha: claim.arbres_par_ha });
  }

  const sMin = (sl[0] as readonly [number, number])[0];
  const sMax = (sl[sl.length - 1] as readonly [number, number])[0];
  const tMin = (tl[0] as readonly [number, number])[0];
  const tMax = (tl[tl.length - 1] as readonly [number, number])[0];
  const m = spec.marge_m;
  const perimetre: [number, number][] = [pt(sMin - m, tMin - m), pt(sMax + m, tMin - m), pt(sMax + m, tMax + m), pt(sMin - m, tMax + m)];
  const vegetation = spec.vegetation(ctx, parcs);
  const streetIds = new Set(rues.map((r) => r.id));
  vegetation.alignements = vegetation.alignements.filter((a) => streetIds.has(a.rue));
  const etats = spec.etats(ctx);
  const quartiers = Object.values(spec.quarters).map((q) => ({ id: q.id, nom: q.nom, canon: "A" as const }));
  // Vues de base d'un lieu sans mur : ensemble, axe, allée, rue de l'est ; les propres s'insèrent après les deux premières.
  const cx = (sMin + sMax) / 2;
  const cy = (tMin + tMax) / 2;
  const L = Math.max(sMax - sMin, tMax - tMin);
  const vues: Place["points_de_vue"] = [
    { id: "ensemble", nom: "Vue d'ensemble", oeil: [r(cx - 0.9 * L), r(cy + 1.1 * L), r(0.55 * L)], cible: [r(cx), r(cy), 0], fov: 50 },
    { id: "axe-principal", nom: "Rue principale", oeil: [r(cx), r(tMax - 40), 1.8], cible: [r(cx), r(tMin + 0.3 * (tMax - tMin)), 9], fov: 58 },
    ...spec.points_de_vue(ctx),
  ];
  return {
    id: spec.id,
    nom: spec.nom,
    libelle: spec.libelle,
    canon: spec.canon,
    niveau: "N1",
    sources: spec.sources,
    province: spec.province,
    style: spec.style,
    population: spec.population,
    densite: spec.densite,
    perimetre,
    zones: [],
    orientation: spec.orientation,
    etendue_m: spec.etendue_m,
    enceinte: null,
    portes: [],
    rues,
    places_publiques: places,
    gabarits: spec.gabarits,
    quartiers: [...new Map(quartiers.map((q) => [q.id, q])).values()],
    ilots,
    batiments: spec.batiments(ctx),
    vegetation,
    eau: spec.eau(ctx),
    points_de_vue: vues,
    etats,
    etat_defaut: etats[0]?.id ?? "ordinaire",
  };
}
