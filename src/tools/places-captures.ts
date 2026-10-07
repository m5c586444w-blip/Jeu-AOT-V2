// npm run places:captures -- <id>… [--vues a,b] [--sans-portes] [--sans-etats] [--sortie <dossier>] [--qualite moyen]
// Captures des lieux N1 (R1e, consigne §3.2, §5 et §6) dans un vrai navigateur (Chromium, serveur de dev Vite, WebGL logiciel) :
// - points de vue du lieu : docs/places/<id>/vue-<vue>.png, et vue-ensemble.png (point de vue « ensemble ») ;
// - états : etat-<état>.png (vue d'ensemble dans chaque état) ;
// - portes : porte-<porte>-<vue>.png, les 7 vues de §3.2 ;
// - ΔE moyen (ΔE76 moyen sur une grille de 64 × 36) entre les vues de chaque porte, entre portes extérieure et intérieure,
//   entre états → docs/reports/places-<id>.json.
// - `--correctifs avant|apres` : vues des correctifs de R1d (consigne R1e §6) → docs/screenshots/r1e/correctif-<n>-<vue>-<temps>.png ;
//   `--correctifs planches` : une planche avant | après par correctif → docs/screenshots/r1e-correctifs-<n>.png.
// Navigateur : CHROMIUM_PATH ou /opt/pw-browsers/chromium.
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright-core";
import type { Page } from "playwright-core";
import { createServer } from "vite";
import { deltaE76 } from "../render/tactical3d/styles";
import { GATE_VIEWS, readFrozen, readPlace } from "./places/check";
import { frozenPlace } from "../render/tactical3d/places/frozen";
import { benchPlace } from "../render/tactical3d/places/bench";

const executablePath = process.env["CHROMIUM_PATH"] ?? "/opt/pw-browsers/chromium";
const args = process.argv.slice(2);
const opt = (k: string): string | null => {
  const i = args.indexOf(k);
  return i >= 0 ? (args[i + 1] ?? null) : null;
};
const ids = args.filter((a, i) => !a.startsWith("--") && !(i > 0 && ["--vues", "--sortie", "--qualite", "--etat", "--racine", "--correctifs", "--seulement"].includes(args[i - 1] ?? "")));
const onlyViews = opt("--vues")?.split(",") ?? null;
const outRoot = opt("--sortie");
const quality = opt("--qualite") ?? "moyen";
const forcedState = opt("--etat");
const W = 1280;
const H = 720;
const isDriverNoise = (text: string): boolean => /GL Driver Message|GPU stall due to ReadPixels|Automatic fallback to software WebGL/.test(text);

type Grid = [number, number, number][];
/** ΔE moyen entre deux grilles CIELAB de même taille. */
export const meanDeltaE = (a: Grid, b: Grid): number => a.reduce((s, c, i) => s + deltaE76(c, b[i] as [number, number, number]), 0) / a.length;

// `--racine <dossier>` : servir une autre copie du dépôt (captures « avant » d'un commit antérieur, `git worktree`).
const root = opt("--racine");
const server = await createServer({ ...(root ? { root, configFile: `${root}/vite.config.ts` } : {}), server: { port: 5197, strictPort: false }, logLevel: "error" });
await server.listen();
const url = server.resolvedUrls?.local[0] ?? "http://localhost:5197/";
const browser = await chromium.launch({ executablePath, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const failures: string[] = [];
const report: Record<string, unknown> = {};

async function open(query: string, errors: string[]): Promise<Page> {
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  await page.addInitScript(() => {
    (window as unknown as { __name: (f: unknown) => unknown }).__name = (f) => f;
  });
  page.on("console", (m) => {
    if ((m.type() === "error" || m.type() === "warning") && !isDriverNoise(m.text())) errors.push(`${m.type()}: ${m.text()}`);
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  await page.goto(`${url}?proto3d&${query}&panneau=0&qualite=${quality}`);
  await page.waitForFunction(() => document.documentElement.dataset["proto3d"] === "pret", undefined, { timeout: 900000 });
  await page.waitForFunction(() => ["pret", "repli", "procedurales"].includes(document.documentElement.dataset["photo3d"] ?? ""), undefined, { timeout: 900000 });
  return page;
}

/** Vues des correctifs de R1d (§6) : numéro, nom, adresse de la visionneuse. */
export const FIX_VIEWS: { n: number; vue: string; query: string; label: string }[] = [
  { n: 1, vue: "E21", query: "proto3d&env=E21&qualite=moyen", label: "ville-usine (E21) : ciel de fumée, brume, suie" },
  { n: 1, vue: "E07", query: "proto3d&env=E07&qualite=moyen", label: "Orvud (E07) : ciel clair gardé" },
  { n: 2, vue: "E02", query: "proto3d&env=E02&qualite=moyen", label: "Trost (E02) : îlots, toits, teintes, ruelles" },
  { n: 2, vue: "E05", query: "proto3d&env=E05&qualite=moyen&vue=seconde", label: "ville (E05), vue rapprochée" },
  { n: 3, vue: "E22", query: "proto3d&env=E22&qualite=moyen", label: "mur (E22) : parement" },
  { n: 4, vue: "suivi1", query: "proto3d&qualite=moyen&cam=suivi1", label: "caméra de suivi : aucun feuillage devant" },
  { n: 5, vue: "suivi2", query: "proto3d&qualite=moyen&cam=suivi2", label: "traînées de gaz" },
  { n: 6, vue: "E14", query: "proto3d&env=E14&qualite=moyen", label: "forêt (E14)" },
  { n: 6, vue: "E14-seconde", query: "proto3d&env=E14&qualite=moyen&vue=seconde", label: "forêt (E14), sous-bois" },
  { n: 7, vue: "suivi3", query: "proto3d&qualite=moyen&cam=suivi3", label: "suivi de l'escouade 3 : soldats entiers" },
  { n: 7, vue: "suivi4", query: "proto3d&qualite=moyen&cam=suivi4", label: "suivi de l'escouade 4 : soldats entiers" },
];

async function fixShots(when: "avant" | "apres"): Promise<void> {
  mkdirSync("docs/screenshots/r1e", { recursive: true });
  const only = opt("--seulement")?.split(",") ?? null;
  for (const v of FIX_VIEWS.filter((x) => !only || only.includes(x.vue))) {
    const errors: string[] = [];
    const page = await browser.newPage({ viewport: { width: W, height: H } });
    page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
    await page.goto(`${url}?${v.query}&panneau=0`);
    await page.waitForFunction(() => document.documentElement.dataset["proto3d"] === "pret", undefined, { timeout: 900000 });
    await page.waitForFunction(() => ["pret", "repli", "procedurales"].includes(document.documentElement.dataset["photo3d"] ?? ""), undefined, { timeout: 900000 }).catch(() => undefined);
    await page.waitForTimeout(1500);
    const file = `docs/screenshots/r1e/correctif-${v.n}-${v.vue}-${when}.png`;
    await page.screenshot({ path: file, timeout: 900000 });
    await page.close();
    console.log(`  ${file}${errors.length ? ` (erreurs : ${errors.slice(0, 2).join(" | ")})` : ""}`);
    if (errors.length) failures.push(`${file} : ${errors[0]}`);
  }
}

/** Planches avant | après de chaque correctif (images côte à côte, légendées). */
async function fixBoards(): Promise<void> {
  const nums = [...new Set(FIX_VIEWS.map((v) => v.n)), 8];
  for (const n of nums) {
    const rows = n === 8 ? [{ vue: "transformation", label: "R0, critère f : tête du porteur sous la barre de titre" }] : FIX_VIEWS.filter((v) => v.n === n);
    const img = (f: string): string => (existsSync(f) ? `data:image/png;base64,${readFileSync(f).toString("base64")}` : "");
    const html = rows
      .map((r) => {
        const a = img(`docs/screenshots/r1e/correctif-${n}-${r.vue}-avant.png`);
        const b = img(`docs/screenshots/r1e/correctif-${n}-${r.vue}-apres.png`);
        return `<div class="r"><div><p>avant — ${r.label}</p><img src="${a}"></div><div><p>après — ${r.label}</p><img src="${b}"></div></div>`;
      })
      .join("");
    const page = await browser.newPage({ viewport: { width: 1600, height: 470 * rows.length + 40 } });
    await page.setContent(`<style>body{margin:0;background:#1e1c1a;font:15px Georgia,serif;color:#eee}.r{display:flex;gap:8px;padding:6px}.r div{flex:1}.r p{margin:2px 0 4px}img{width:100%;display:block}</style><h3 style="margin:8px">Correctif ${n} (consigne R1e §6)</h3>${html}`);
    await page.waitForTimeout(300);
    const file = `docs/screenshots/r1e-correctifs-${n}.png`;
    await page.screenshot({ path: file, fullPage: true });
    await page.close();
    console.log(`  ${file}`);
  }
}

try {
  const fixMode = opt("--correctifs");
  if (fixMode === "avant" || fixMode === "apres") await fixShots(fixMode);
  else if (fixMode === "planches") await fixBoards();
  for (const id of fixMode ? [] : ids) {
    // Banc d'essai (R1e.3) : lieu fabriqué en code.
    // Lieu N2 figé (R1e.6) : dossier court, vue d'ensemble seulement (consigne §5).
    const frozen = id !== "_banc" && !existsSync(`data/places/${id}.json`) && existsSync(`data/places/generated/${id}.json`) ? readFrozen(id).plan : null;
    const { place, errors: pe } = id === "_banc" ? { place: benchPlace(), errors: [] as string[] } : frozen ? { place: frozenPlace(frozen), errors: [] as string[] } : readPlace(id);
    const viewFilter = onlyViews ?? (frozen ? ["ensemble"] : null);
    if (!place) {
      console.error(`lieu ${id} illisible : ${pe.join(" ; ")}`);
      failures.push(id);
      continue;
    }
    const dir = outRoot ?? `docs/places/${id}`;
    mkdirSync(dir, { recursive: true });
    const grids: Record<string, Grid> = {};
    const shots: Record<string, unknown> = {};
    const states = forcedState ? [forcedState] : [place.etat_defaut];
    // Une page par état : points de vue, portes ; la couleur moyenne de chaque vue est rendue hors écran (640 × 360).
    for (const st of states) {
      const errors: string[] = [];
      const t0 = Date.now();
      const page = await open(`lieu=${id}&etat=${st}`, errors);
      const loadMs = Date.now() - t0;
      const views = (await page.evaluate(() => window.__place3d?.views ?? [])).filter((v) => !viewFilter || viewFilter.includes(v));
      const wanted = views.filter((v) => args.includes("--sans-portes") ? !v.startsWith("porte-") : true);
      for (const v of wanted) {
        await page.evaluate((vv) => window.__place3d?.setView(vv), v);
        await page.evaluate(() => window.__place3d?.frame());
        await page.evaluate(() => window.__place3d?.frame());
        const file = `${dir}/${v.startsWith("porte-") ? v : `vue-${v}`}.png`;
        await page.screenshot({ path: file, timeout: 900000 });
        const stats = await page.evaluate(() => window.__place3d?.stats());
        const mean = await page.evaluate((vv) => window.__place3d?.meanColor(vv, 640, 360, 64, 36), v);
        if (mean) grids[v] = mean.grid;
        shots[v] = { file, stats, rgb: mean?.rgb };
        console.log(`  ${file} : ${stats?.calls} appels, ${Math.round((stats?.triangles ?? 0) / 1000)} k triangles, tronçons ${stats?.chunks.visible}/${stats?.chunks.total}`);
        if (v === "ensemble") copyFileSync(file, `${dir}/vue-ensemble.png`);
      }
      const info = await page.evaluate(() => ({ hash: window.__place3d?.hash, counts: window.__place3d?.counts, timings: window.__place3d?.timings, photos: window.__place3d?.photos }));
      await page.close();
      if (errors.length) failures.push(`${id}/${st} : ${errors.slice(0, 3).join(" | ")}`);
      report[`${id}/${st}`] = { loadMs, ...info, errors };
    }
    // Banc : témoin de mesure du parement (R1d, texture répétée), même vue de face.
    if (id === "_banc" && (!onlyViews || onlyViews.includes("mur-face"))) {
      const errors: string[] = [];
      const page = await open("lieu=_banc&parement=r1d&vue=mur-face", errors);
      await page.evaluate(() => window.__place3d?.frame());
      await page.screenshot({ path: `${dir}/mur-face-r1d.png`, timeout: 900000 });
      await page.close();
      console.log(`  ${dir}/mur-face-r1d.png (témoin R1d)`);
    }
    // États : vue d'ensemble dans chaque état.
    const stateGrids: Record<string, Grid> = {};
    if (!args.includes("--sans-etats") && !forcedState && place.etats.length > 1) {
      for (const s of place.etats) {
        const errors: string[] = [];
        const page = await open(`lieu=${id}&etat=${s.id}&vue=ensemble`, errors);
        await page.evaluate(() => window.__place3d?.frame());
        const file = `${dir}/etat-${s.id}.png`;
        await page.screenshot({ path: file, timeout: 900000 });
        const mean = await page.evaluate(() => window.__place3d?.meanColor("ensemble", 640, 360, 64, 36));
        if (mean) stateGrids[s.id] = mean.grid;
        await page.close();
        console.log(`  ${file}`);
        if (errors.length) failures.push(`${id}/${s.id} : ${errors.slice(0, 3).join(" | ")}`);
      }
    }
    // ΔE : vues de chaque porte deux à deux, extérieure ≠ intérieure, états deux à deux.
    const dE: Record<string, number> = {};
    for (const g of place.portes) {
      const vs = GATE_VIEWS.map((v) => `porte-${g.id}-${v}`).filter((v) => grids[v]);
      for (let i = 0; i < vs.length; i++) for (let j = i + 1; j < vs.length; j++) dE[`${vs[i]} | ${vs[j]}`] = meanDeltaE(grids[vs[i] as string] as Grid, grids[vs[j] as string] as Grid);
    }
    const ext = place.portes.find((g) => g.role === "exterieure");
    const int = place.portes.find((g) => g.role === "interieure");
    if (ext && int && grids[`porte-${ext.id}-exterieure-face`] && grids[`porte-${int.id}-exterieure-face`]) dE[`porte-${ext.id}-exterieure-face | porte-${int.id}-exterieure-face`] = meanDeltaE(grids[`porte-${ext.id}-exterieure-face`] as Grid, grids[`porte-${int.id}-exterieure-face`] as Grid);
    const sk = Object.keys(stateGrids);
    for (let i = 0; i < sk.length; i++) for (let j = i + 1; j < sk.length; j++) dE[`etat-${sk[i]} | etat-${sk[j]}`] = meanDeltaE(stateGrids[sk[i] as string] as Grid, stateGrids[sk[j] as string] as Grid);
    for (const [k, v] of Object.entries(dE)) console.log(`  ΔE ${v.toFixed(1)} ${v >= 6 ? "≥" : "<"} 6 : ${k}`);
    report[id] = { shots, dE };
    writeFileSync(`docs/reports/places-${id}.json`, `${JSON.stringify(report[id], null, 1)}\n`);
  }
} finally {
  await browser.close();
  await server.close();
}
if (failures.length) {
  console.error(`places:captures : ${failures.length} échec(s) :\n${failures.join("\n")}`);
  process.exit(1);
}
console.log(`places:captures : ${ids.join(", ")} capturés.`);
