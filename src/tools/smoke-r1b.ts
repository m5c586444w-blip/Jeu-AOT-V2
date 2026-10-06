// npm run smoke:r1b [lot1|lot2|tout] — R1b dans un vrai navigateur (Chromium, serveur de dev Vite, WebGL logiciel) :
// - planches de contrôle (vue principale et vue seconde, jour et crépuscule) de chaque environnement disponible du lot,
//   et des variantes : docs/screenshots/r1b-<id>.png, r1b-<id>-<variante>.png ;
// - cycle (aube, jour, crépuscule, nuit), météo (brume, pluie, neige d'hiver), ruines et incendies, banc d'échelle, galerie ;
// - rendus hors écran (256 × 144) : couleur moyenne et grille 4 × 4 en CIELAB, distances ΔE entre toutes les paires d'un même
//   lot (seuils du plan § 4) → docs/reports/R1b-distances-rendus.log ; mesures et comptes → docs/reports/R1b-smoke.json.
// Navigateur : CHROMIUM_PATH ou /opt/pw-browsers/chromium.
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright-core";
import type { Browser, Page } from "playwright-core";
import { createServer } from "vite";
import { supportedGenerators } from "../render/tactical3d/environment";
import { LOTS, deltaE76, profile } from "../render/tactical3d/styles";
import type { MeanColor } from "../render/tactical3d/envViewer";

const executablePath = process.env["CHROMIUM_PATH"] ?? "/opt/pw-browsers/chromium";
const OUT = "docs/screenshots";
mkdirSync(OUT, { recursive: true });
const which = process.argv[2] ?? "tout";
/** `--planches` : seulement les planches et les distances (mise au point). */
const sheetsOnly = process.argv.includes("--planches");
const lots: (1 | 2)[] = which === "lot1" ? [1] : which === "lot2" ? [2] : [1, 2];
const failures: string[] = [];
const expect = (cond: boolean, label: string): void => {
  if (cond) console.log(`  OK  ${label}`);
  else {
    failures.push(label);
    console.error(`  KO  ${label}`);
  }
};
const isDriverNoise = (text: string): boolean => /GL Driver Message|GPU stall due to ReadPixels|Automatic fallback to software WebGL/.test(text);

async function newPage(browser: Browser, w: number, h: number, errors: string[]): Promise<Page> {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.addInitScript(() => {
    (window as unknown as { __name: (f: unknown) => unknown }).__name = (f) => f;
  });
  page.on("console", (m) => {
    if ((m.type() === "error" || m.type() === "warning") && !isDriverNoise(m.text())) errors.push(`${m.type()}: ${m.text()}`);
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  return page;
}

const ready = (page: Page): Promise<unknown> => page.waitForFunction(() => document.documentElement.dataset["proto3d"] === "pret", undefined, { timeout: 900000 });

const server = await createServer({ server: { port: 5193, strictPort: false }, logLevel: "error" });
await server.listen();
const url = server.resolvedUrls?.local[0] ?? "http://localhost:5193/";
const browser = await chromium.launch({ executablePath });
const available = new Set(supportedGenerators());
const results: Record<string, unknown> = {};
const colors: Record<string, { jour: MeanColor; crepuscule: MeanColor }> = {};

/** Charge une page de la visionneuse, attend qu'elle soit prête, fige l'image et la capture. */
async function shot(query: string, file: string, w: number, h: number, measure: boolean): Promise<Record<string, unknown>> {
  const errors: string[] = [];
  const page = await newPage(browser, w, h, errors);
  const t0 = Date.now();
  await page.goto(`${url}?proto3d&${query}`);
  await ready(page);
  const loadMs = Date.now() - t0;
  await page.evaluate(() => window.__env3d?.hold(true));
  await page.evaluate(() => window.__env3d?.frame());
  await page.screenshot({ path: `${OUT}/${file}`, timeout: 900000 });
  const info = await page.evaluate(() => ({ timings: window.__env3d?.timings, counts: window.__env3d?.counts, stats: window.__env3d?.stats() }));
  let mean: { jour: MeanColor; crepuscule: MeanColor } | null = null;
  if (measure) {
    mean = await page.evaluate(() => {
      const p = window.__env3d as NonNullable<Window["__env3d"]>;
      return { jour: p.meanColor("principale", "jour", 256, 144, 4), crepuscule: p.meanColor("principale", "crepuscule", 256, 144, 4) };
    });
  }
  await page.close();
  expect(errors.length === 0, `${file} : aucune erreur de page${errors.length ? ` (${errors.slice(0, 3).join(" | ")})` : ""}`);
  return { file, loadMs, ...info, mean };
}

try {
  // ——— Planches par environnement ———
  for (const lot of lots) {
    console.log(`[lot ${lot}] planches de contrôle (1920 × 1080, qualité moyenne, image figée à t = 1 s)`);
    for (const id of LOTS[lot]) {
      const p = profile(id);
      if (!available.has(p.generateur)) {
        console.log(`  --  ${id} ${p.nom} : générateur « ${p.generateur} » pas encore disponible`);
        results[id] = { absent: true };
        continue;
      }
      const r = await shot(`env=${id}&planche&pause&t=1&qualite=moyen`, `r1b-${id}.png`, 1920, 1080, true);
      results[id] = r;
      if (r["mean"]) colors[id] = r["mean"] as { jour: MeanColor; crepuscule: MeanColor };
      expect(typeof r["loadMs"] === "number", `${id} ${p.nom} : planche en ${((r["loadMs"] as number) / 1000).toFixed(1)} s`);
    }
  }

  // ——— Variantes, cycle, météo, ruines et incendies ———
  const variants: [string, string, 1 | 2][] = [
    ["E01", "845", 1],
    ["E01", "850", 1],
    ["E01", "851", 1],
    ["E14", "clairiere", 1],
    ["E14", "lisiere", 1],
    ["E11", "ragako_850", 1],
    ["E22", "endommage", 1],
    ["E19", "titans", 1],
    ["E07", "orvud_850", 2],
    ["E20", "ruines_850", 2],
    ["E21", "cavernes", 2],
    ["E04", "krolva", 2],
    ["E26", "845", 2],
  ];
  if (!sheetsOnly) console.log("[variantes]");
  for (const [id, v, lot] of variants) {
    if (sheetsOnly || !lots.includes(lot) || !available.has(profile(id).generateur)) continue;
    results[`${id}-${v}`] = await shot(`env=${id}&variante=${v}&planche&pause&t=1&qualite=moyen`, `r1b-${id}-${v}.png`, 1920, 1080, false);
  }
  if (lots.includes(1) && !sheetsOnly) {
    console.log("[cycle et météo]");
    results["cycle"] = await shot("env=E01&planche=cycle&pause&t=1&qualite=moyen", "r1b-cycle-E01.png", 1920, 1080, false);
    results["brume"] = await shot("env=E05&meteo=brume&pause&t=2&panneau=0&vue=seconde", "r1b-meteo-brume-E05.png", 1366, 768, false);
    results["pluie"] = await shot("env=E11&meteo=pluie&pause&t=2&panneau=0&vue=seconde", "r1b-meteo-pluie-E11.png", 1366, 768, false);
    results["neige"] = await shot("env=E13&variante=hiver&meteo=neige&pause&t=2&panneau=0", "r1b-meteo-neige-E13.png", 1366, 768, false);
    results["ruines"] = await shot("env=E01&variante=ruines&lumiere=crepuscule&pause&t=2&panneau=0", "r1b-ruines-incendies-E01.png", 1366, 768, false);
    results["nuit"] = await shot("env=E02&lumiere=nuit&pause&t=2&panneau=0&vue=seconde", "r1b-nuit-E02.png", 1366, 768, false);

    // ——— Banc d'échelle ———
    console.log("[banc d'échelle]");
    const errors: string[] = [];
    const page = await newPage(browser, 1920, 1080, errors);
    await page.goto(`${url}?proto3d&env=banc`);
    await ready(page);
    await page.evaluate(() => window.__banc3d?.hold(true));
    await page.evaluate(() => window.__banc3d?.frame());
    await page.screenshot({ path: `${OUT}/r1b-banc-echelle.png`, timeout: 900000 });
    const figures = await page.evaluate(() => window.__banc3d?.figures ?? []);
    results["banc"] = figures;
    for (const f of figures) expect(Math.abs(f.measured - f.nominal) <= 0.05 * f.nominal, `banc : ${f.id} mesuré ${f.measured.toFixed(2)} m pour ${f.nominal} m (±5 %)`);
    await page.close();
    expect(errors.length === 0, "banc : aucune erreur de page");
  }

  // ——— Galerie ———
  if (!sheetsOnly && (which === "tout" || process.argv.includes("--galerie"))) {
    console.log("[galerie] /proto3d/galerie");
    const errors: string[] = [];
    const page = await newPage(browser, 1600, 900, errors);
    const t0 = Date.now();
    await page.goto(`${url}proto3d/galerie`);
    await page.waitForFunction(() => window.__galerie3d?.ready === true, undefined, { timeout: 3600000, polling: 2000 });
    const g = await page.evaluate(() => window.__galerie3d);
    results["galerie"] = { ...g, totalMs: Date.now() - t0, url: page.url() };
    expect(page.url().includes("proto3d=galerie"), `galerie : /proto3d/galerie redirige vers ${page.url()}`);
    expect((g?.done ?? 0) === (g?.total ?? -1), `galerie : ${g?.done} environnements rendus sur ${g?.total} en ${g?.seconds.toFixed(0)} s`);
    await page.screenshot({ path: `${OUT}/r1b-galerie.png`, fullPage: true, timeout: 900000 });
    await page.close();
    expect(errors.length === 0, "galerie : aucune erreur de page");
  }

  // ——— Distances entre rendus hors écran (plan § 4) ———
  const lines: string[] = ["Rendus hors écran 256 × 144, vue principale. ΔE76 en CIELAB. Seuils : couleur moyenne ≥ 2,3 ; grille 4 × 4 ≥ 5.", ""];
  for (const lot of lots) {
    const ids = LOTS[lot].filter((id) => colors[id]);
    lines.push(`Lot ${lot} — couleurs moyennes (jour) :`);
    for (const id of ids) {
      const c = colors[id] as { jour: MeanColor; crepuscule: MeanColor };
      lines.push(`  ${id} : sRGB (${c.jour.rgb.map((v) => v.toFixed(0)).join(", ")}) ; L*a*b* (${c.jour.lab.map((v) => v.toFixed(1)).join(", ")}) ; crépuscule L*a*b* (${c.crepuscule.lab.map((v) => v.toFixed(1)).join(", ")})`);
    }
    lines.push("", `Lot ${lot} — paires : ΔE moyen jour | ΔE grille jour | ΔE moyen crépuscule`);
    const pairs: { a: string; b: string; m: number; g: number; c: number }[] = [];
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const A = colors[ids[i] as string] as { jour: MeanColor; crepuscule: MeanColor };
        const B = colors[ids[j] as string] as { jour: MeanColor; crepuscule: MeanColor };
        const m = deltaE76(A.jour.lab, B.jour.lab);
        const g = A.jour.grid.reduce((s, cell, k) => s + deltaE76(cell, B.jour.grid[k] as [number, number, number]), 0) / A.jour.grid.length;
        const c = deltaE76(A.crepuscule.lab, B.crepuscule.lab);
        pairs.push({ a: ids[i] as string, b: ids[j] as string, m, g, c });
      }
    }
    pairs.sort((x, y) => x.m - y.m);
    for (const p of pairs) lines.push(`  ${p.a}–${p.b} | ${p.m.toFixed(1)} | ${p.g.toFixed(1)} | ${p.c.toFixed(1)}`);
    const minM = Math.min(...pairs.map((p) => p.m));
    const minG = Math.min(...pairs.map((p) => p.g));
    lines.push(`  minimum : ΔE moyen ${minM.toFixed(1)}, ΔE grille ${minG.toFixed(1)} (${pairs.length} paires)`, "");
    for (const p of pairs) {
      expect(p.m >= 2.3, `lot ${lot} ${p.a}–${p.b} : ΔE couleur moyenne ${p.m.toFixed(1)} ≥ 2,3`);
      expect(p.g >= 5, `lot ${lot} ${p.a}–${p.b} : ΔE grille ${p.g.toFixed(1)} ≥ 5`);
    }
  }
  writeFileSync(`docs/reports/R1b-distances-rendus${which === "tout" ? "" : `-${which}`}.log`, `${lines.join("\n")}\n`);
  writeFileSync(`docs/reports/R1b-smoke${which === "tout" ? "" : `-${which}`}.json`, `${JSON.stringify(results, null, 1)}\n`);
} finally {
  await browser.close();
  await server.close();
}
if (failures.length > 0) {
  console.error(`smoke:r1b : ${failures.length} contrôle(s) en échec.`);
  process.exit(1);
}
console.log("smoke:r1b : tous les contrôles passent.");
