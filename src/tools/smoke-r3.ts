// npm run smoke:r3 — R3 (CR3-08, CR3-09) dans un vrai navigateur (Chromium, serveur de dev Vite) : planches des figures
// (`?proto3d=figures&planche=titans|soldats|poses`, 1920×1080), bataille de compagnie en 3D avec les figures de R3 (repères
// simplifiés à l'image « prête », corps de base chargés ensuite ; deux instants mesurés) en 1366×768, 1920×1080, 3840×2160,
// bataille P4 en vue 3D (bouton de l'écran P4). Captures hors git par défaut (`docs/screenshots/.smoke/`) ;
// `npm run smoke:r3 -- --captures` les écrit dans `docs/screenshots/r3-*.png` (passage final) ; `R3_CAPTURES=<dossier>`.
// `R3_PARTIES=1,2,3` (planches, compagnie, P4) et `R3_TAILLES=1366,1920,3840` restreignent le passage.
// Mesures au rendu logiciel : à vérifier sur le PC de l'utilisateur.
import { mkdirSync } from "node:fs";
import { chromium } from "playwright-core";
import type { Browser, Page } from "playwright-core";
import { createServer } from "vite";

const executablePath = process.env["CHROMIUM_PATH"] ?? "/opt/pw-browsers/chromium";
const OUT = process.argv.includes("--captures") ? "docs/screenshots" : (process.env["R3_CAPTURES"] ?? "docs/screenshots/.smoke");
mkdirSync(OUT, { recursive: true });
console.log(`Captures : ${OUT}/${OUT === "docs/screenshots" ? " (suivies par git, option --captures)" : " (hors git)"}`);
const parts = (process.env["R3_PARTIES"] ?? "1,2,3").split(",");
const failures: string[] = [];
const expect = (cond: boolean, label: string): void => {
  if (cond) console.log(`  OK  ${label}`);
  else {
    failures.push(label);
    console.error(`  KO  ${label}`);
  }
};
const isDriverNoise = (text: string): boolean => /GL Driver Message|GPU stall due to ReadPixels|Automatic fallback to software WebGL|texParameter/.test(text);

function watch(page: Page, errors: string[], label: string): void {
  page.on("console", (m) => {
    if ((m.type() === "error" || m.type() === "warning") && !isDriverNoise(m.text())) errors.push(`${label}${m.type()}: ${m.text()}`);
  });
  page.on("pageerror", (e) => errors.push(`${label}pageerror: ${e.message}`));
}

const ds = async (page: Page, key: string): Promise<string> => (await page.getAttribute(".bataille", `data-${key}`)) ?? "";

async function company(page: Page): Promise<number> {
  if (!(await page.locator('.registre-panneau[data-panel="expeditions"]:not([hidden])').count())) await page.keyboard.press("KeyE");
  await page.waitForSelector('.registre-panneau[data-panel="expeditions"]:not([hidden])');
  await page.selectOption('select[data-trial="map"]', "tmap_ville");
  await page.selectOption('select[data-trial="type"]', "ttype_moyen_errant");
  await page.fill('input[data-trial="count"]', "5");
  await page.fill('input[data-trial="men"]', "120");
  await page.fill('input[data-trial="enemy"]', "150");
  const t0 = Date.now();
  await page.locator('[data-action="essai-compagnie"]').click();
  await page.waitForSelector(".bataille--rt", { timeout: 60000 });
  await page.waitForFunction(() => Number(document.querySelector<HTMLElement>(".bataille")?.dataset["frames"] ?? "0") >= 2, undefined, { timeout: 240000 });
  return Date.now() - t0;
}

async function runFor(page: Page, ticks: number, speed = "1"): Promise<void> {
  const t0 = Number(await ds(page, "tick"));
  await page.locator(`.bataille-vitesse[data-speed="${speed}"]`).click();
  await page.waitForFunction((k) => Number(document.querySelector<HTMLElement>(".bataille")?.dataset["tick"] ?? "0") >= k || !!document.querySelector(".bilan"), t0 + ticks, { timeout: 300000 });
  if (!(await page.locator(".bilan").count())) await page.locator('.bataille-vitesse[data-speed="0"]').click();
  await page.waitForTimeout(400);
}

/**
 * Gros plan sur le Titan vivant entouré du plus grand nombre de soldats (sonde de l'écran temps réel) : caméra stratégique
 * placée à une quarantaine de mètres, en plongée de 35°, du côté le plus dégagé (hors de la ville d'abord), visée sur lui.
 */
async function closeOnTitan(page: Page): Promise<string> {
  return (await page.evaluate(`(() => {
    const p = window.__batailleRt;
    const st = p.bt.state;
    const alive = st.titans.filter((x) => x.alive && !x.ally);
    let best = alive[0] ?? st.titans[0];
    let bn = -1;
    for (const t of alive) {
      const n = st.soldiers.filter((s) => s.mode !== "mort" && Math.hypot(s.x - t.x, s.y - t.y) < 30).length;
      if (n > bn) { bn = n; best = t; }
    }
    if (!best) return "aucun Titan";
    p.view.target.set(best.x, 0, best.y);
    p.view.dist = Math.max(34, best.height * 3.6);
    p.view.pitch = 0.62;
    // Côté le plus dégagé : des 8 directions, celle où la ligne de vue vers le Titan croise le moins de toits.
    const cp = Math.cos(p.view.pitch) * p.view.dist;
    let yaw = 0;
    let need = Infinity;
    for (let k = 0; k < 8; k++) {
      const a = Math.PI + (k * Math.PI) / 4;
      const h = p.view.sightHeight(best.x, best.y, best.height * 0.5, best.x + Math.sin(a) * cp, best.y + Math.cos(a) * cp);
      if (h < need - 0.5) { need = h; yaw = a; }
    }
    p.view.yaw = yaw;
    p.view.rotateBy(0);
    return "Titan n° " + best.id + " (" + best.height.toFixed(1) + " m), " + Math.max(0, bn) + " soldats à moins de 30 m";
  })()`)) as string;
}

const server = await createServer({ server: { port: 5188, strictPort: false }, logLevel: "error" });
await server.listen();
const url = server.resolvedUrls?.local[0] ?? "http://localhost:5188/";
const browser: Browser = await chromium.launch({ executablePath });
const errors: string[] = [];
const measures: string[] = [];

try {
  if (parts.includes("1")) {
    for (const planche of ["titans", "soldats", "poses"]) {
      console.log(`[planche ${planche}] 1920×1080`);
      const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
      watch(page, errors, `[planche ${planche}] `);
      const t0 = Date.now();
      await page.goto(`${url}?proto3d=figures&planche=${planche}`);
      await page.waitForSelector("html[data-ready='true']", { timeout: 300000 });
      const n = Number(await page.getAttribute("html", "data-figures"));
      expect(n >= (planche === "soldats" ? 15 : planche === "titans" ? 15 : 16), `planche ${planche} : ${n} figures, prête en ${((Date.now() - t0) / 1000).toFixed(1)} s`);
      await page.screenshot({ path: `${OUT}/r3-${planche}.png` });
      await page.close();
    }
  }
  if (parts.includes("2")) {
    const sizes = ([[1366, 768], [1920, 1080], [3840, 2160]] as const).filter(([w]) => (process.env["R3_TAILLES"] ?? "1366,1920,3840").split(",").includes(String(w)));
    for (const [w, h] of sizes) {
      console.log(`[compagnie, ville] ${w}×${h}`);
      const page = await browser.newPage({ viewport: { width: w, height: h } });
      watch(page, errors, `[compagnie ${w}] `);
      await page.goto(`${url}?dossiers=0`);
      await page.waitForSelector("html[data-ready='true']", { timeout: 120000 });
      await page.waitForTimeout(500);
      const ready = await company(page);
      const at = await ds(page, "stats");
      expect((await ds(page, "vue")) === "3d", `vue 3D prête en ${(ready / 1000).toFixed(1)} s (${at})`);
      const t1 = Date.now();
      await page.waitForFunction(() => (document.querySelector<HTMLElement>(".bataille")?.dataset["stats"] ?? "").includes("corps de base"), undefined, { timeout: 300000 });
      const kit = Date.now() - t1;
      await runFor(page, 40);
      const stats = await ds(page, "stats");
      expect(/Titans (\d+)\/\1/.test(stats) || stats.includes("Titans"), `corps de base chargés ${(kit / 1000).toFixed(1)} s après « prêt » ; ${stats}`);
      measures.push(`${w}×${h} : prêt ${(ready / 1000).toFixed(1)} s · corps détaillés +${(kit / 1000).toFixed(1)} s · ${await ds(page, "unites")} unités · JS p95 ${await ds(page, "js-p95")} ms · ${stats}`);
      if (w !== 3840) await page.screenshot({ path: `${OUT}/r3-bataille-${w}.png` });
      await runFor(page, 100, "4");
      const focus = await closeOnTitan(page);
      // En pause, la vue continue de dessiner : les figures complètes se montent (2 par image) avant la capture.
      await page.waitForTimeout(2500);
      const st = await ds(page, "stats");
      expect(/détail [1-9]/.test(st), `gros plan (${focus}) : ${st}`);
      await page.screenshot({ path: `${OUT}/r3-proche-${w}.png` });
      await page.close();
    }
  }
  if (parts.includes("3")) {
    console.log("[bataille P4, vue 3D] 1366×768");
    const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
    watch(page, errors, "[P4 3D] ");
    await page.goto(`${url}?dossiers=0`);
    await page.waitForSelector("html[data-ready='true']", { timeout: 120000 });
    await page.waitForTimeout(500);
    if (!(await page.locator('.registre-panneau[data-panel="expeditions"]:not([hidden])').count())) await page.keyboard.press("KeyE");
    await page.waitForSelector('.registre-panneau[data-panel="expeditions"]:not([hidden])');
    await page.selectOption('select[data-trial="map"]', "tmap_ville");
    await page.selectOption('select[data-trial="type"]', "ttype_grand_errant");
    await page.fill('input[data-trial="count"]', "3");
    await page.locator('[data-action="essai"]').click();
    await page.waitForSelector("body[data-tactique]", { timeout: 60000 });
    await page.locator('[data-action="vue-3d"]').click();
    await page.waitForFunction(() => document.querySelector<HTMLElement>(".bataille")?.dataset["vue3d"] === "on", undefined, { timeout: 120000 });
    await page.locator('.bataille-vitesse[data-speed="1"]').click();
    await page.waitForFunction(() => (document.querySelector<HTMLElement>(".bataille")?.dataset["stats3d"] ?? "").includes("corps de base") && Number(document.querySelector<HTMLElement>(".bataille")?.dataset["tick"] ?? "0") >= 60, undefined, { timeout: 300000 });
    await page.locator('.bataille-vitesse[data-speed="0"]').click();
    await page.waitForTimeout(400);
    const s3 = (await page.getAttribute(".bataille", "data-stats3d")) ?? "";
    expect(s3.includes("Titans 3/3"), `bataille P4 en vue 3D, pas ${await page.getAttribute(".bataille", "data-tick")} : ${s3}`);
    await page.screenshot({ path: `${OUT}/r3-p4-1366.png` });
    await page.close();
  }
} finally {
  await browser.close();
  await server.close();
}
for (const m of measures) console.log(`  ..  ${m}`);
expect(errors.length === 0, `${errors.length} erreur console${errors.length ? ` : ${errors.slice(0, 5).join(" | ")}` : ""}`);
if (failures.length > 0) {
  console.error(`smoke:r3 : ${failures.length} contrôle(s) en échec.`);
  process.exit(1);
}
console.log("smoke:r3 : tout est conforme.");
