// npm run places:captures -- <id>… [--vues a,b] [--sans-portes] [--sans-etats] [--sortie <dossier>] [--qualite moyen]
// Captures des lieux N1 (R1e, consigne §3.2, §5 et §6) dans un vrai navigateur (Chromium, serveur de dev Vite, WebGL logiciel) :
// - points de vue du lieu : docs/places/<id>/vue-<vue>.png, et vue-ensemble.png (point de vue « ensemble ») ;
// - états : etat-<état>.png (vue d'ensemble dans chaque état) ;
// - portes : porte-<porte>-<vue>.png, les 7 vues de §3.2 ;
// - ΔE moyen (ΔE76 moyen sur une grille de 64 × 36) entre les vues de chaque porte, entre portes extérieure et intérieure,
//   entre états → docs/reports/places-<id>.json.
// Navigateur : CHROMIUM_PATH ou /opt/pw-browsers/chromium.
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright-core";
import type { Page } from "playwright-core";
import { createServer } from "vite";
import { deltaE76 } from "../render/tactical3d/styles";
import { GATE_VIEWS, readPlace } from "./places/check";

const executablePath = process.env["CHROMIUM_PATH"] ?? "/opt/pw-browsers/chromium";
const args = process.argv.slice(2);
const opt = (k: string): string | null => {
  const i = args.indexOf(k);
  return i >= 0 ? (args[i + 1] ?? null) : null;
};
const ids = args.filter((a, i) => !a.startsWith("--") && !(i > 0 && (args[i - 1] ?? "").startsWith("--") && ["--vues", "--sortie", "--qualite", "--etat"].includes(args[i - 1] ?? "")));
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

const server = await createServer({ server: { port: 5197, strictPort: false }, logLevel: "error" });
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

try {
  for (const id of ids) {
    const { place, errors: pe } = readPlace(id);
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
      const views = (await page.evaluate(() => window.__place3d?.views ?? [])).filter((v) => !onlyViews || onlyViews.includes(v));
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
