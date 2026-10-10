// npm run smoke:r3 — R3 (CR3-08, CR3-09) dans un vrai navigateur (Chromium, serveur de développement Vite).
// 1. Planches `?proto3d=humain&planche=r3-titans|r3-visages|r3-soldats|r3-poses|r3-uniformes|r3-ceremonie` (1920×1080) : hauteurs mesurées des Titans.
// 2. Bataille de compagnie en 3D (1366×768) : « prêt » en figures de R1, puis second temps (corps de base : Titans de R3 et
//    figures en tenue) ; chaque figure montre la pose de l'état lu dans la simulation ; vues rapprochées (Paradis, Marley), suivi.
// 3. 3840×2160 : vue rapprochée. 4. three.js hors du bundle principal (dist/). 0 erreur console.
// Captures : docs/screenshots/.smoke/ par défaut (hors git) ; `-- --captures` : docs/screenshots/ (passage final).
import { existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { chromium } from "playwright-core";
import type { Browser, Page } from "playwright-core";
import { createServer } from "vite";
import { SOLDIER_POSE, TITAN_POSE, TROOP_POSE } from "../render/tactical3d/battle/figureState";

const executablePath = process.env["CHROMIUM_PATH"] ?? "/opt/pw-browsers/chromium";
const OUT = process.argv.includes("--captures") ? "docs/screenshots" : "docs/screenshots/.smoke";
mkdirSync(OUT, { recursive: true });
console.log(`Captures : ${OUT}/`);
const failures: string[] = [];
const expect = (cond: boolean, label: string): void => {
  if (cond) console.log(`  OK  ${label}`);
  else {
    failures.push(label);
    console.error(`  KO  ${label}`);
  }
};
const isDriverNoise = (text: string): boolean => /GL Driver Message|GPU stall due to ReadPixels|Automatic fallback to software WebGL/.test(text);
const errors: string[] = [];
const watch = (page: Page, label: string): void => {
  page.on("console", (m) => {
    if ((m.type() === "error" || m.type() === "warning") && !isDriverNoise(m.text())) errors.push(`${label}${m.type()}: ${m.text()}`);
  });
  page.on("pageerror", (e) => errors.push(`${label}pageerror: ${e.message}`));
};
const ds = async (page: Page, key: string): Promise<string> => (await page.getAttribute(".bataille", `data-${key}`)) ?? "";

type Fig = { key: string; state: string; pose: string; r3: boolean };
async function figures(page: Page): Promise<{ corps: string; list: Fig[] }> {
  return (await page.evaluate("window.__batailleRt.view.figures()")) as { corps: string; list: Fig[] };
}

async function company(page: Page): Promise<number> {
  if (!(await page.locator('.registre-panneau[data-panel="expeditions"]:not([hidden])').count())) await page.keyboard.press("KeyE");
  await page.waitForSelector('.registre-panneau[data-panel="expeditions"]:not([hidden])');
  await page.selectOption('select[data-trial="map"]', "tmap_ville");
  await page.selectOption('select[data-trial="type"]', "ttype_grand_errant");
  await page.fill('input[data-trial="count"]', "4");
  await page.fill('input[data-trial="men"]', "120");
  await page.fill('input[data-trial="enemy"]', "150");
  if (await page.locator('input[data-trial="shifter"]').isChecked()) await page.locator('input[data-trial="shifter"]').click();
  const t0 = Date.now();
  await page.locator('[data-action="essai-compagnie"]').click();
  await page.waitForSelector(".bataille--rt", { timeout: 60000 });
  await page.waitForFunction(() => Number(document.querySelector<HTMLElement>(".bataille")?.dataset["frames"] ?? "0") >= 2, undefined, { timeout: 240000 });
  return Date.now() - t0;
}

async function runFor(page: Page, ticks: number): Promise<void> {
  const t0 = Number(await ds(page, "tick"));
  await page.locator('.bataille-vitesse[data-speed="1"]').click();
  await page.waitForFunction((k) => Number(document.querySelector<HTMLElement>(".bataille")?.dataset["tick"] ?? "0") >= k || !!document.querySelector(".bilan"), t0 + ticks, { timeout: 240000 });
  if (!(await page.locator(".bilan").count())) await page.locator('.bataille-vitesse[data-speed="0"]').click();
  await page.waitForTimeout(400);
}

/**
 * Zoom molette sur une unité, visée à sa position courante (sonde de l'écran ; les repères de l'interface ne sont recalculés
 * que tous les 10 pas, donc périmés en pause après un zoom) : une escouade (`esc_03`) ou la première section ennemie (`ennemi`).
 */
async function zoomOn(page: Page, unit: string, steps: number): Promise<boolean> {
  const box = await page.locator(".bataille-scene").boundingBox();
  const m = (await page.evaluate(`(() => {
    const p = window.__batailleRt;
    const st = p.bt.state;
    let g = [];
    if (${JSON.stringify(unit)} === "ennemi" || ${JSON.stringify(unit)} === "allie") {
      const men = (st.troops || []).filter((t) => t.side === ${JSON.stringify(unit)} && t.mode !== "mort" && t.mode !== "fui");
      const sec = men.length ? men[0].section : null;
      g = men.filter((t) => t.section === sec);
    } else g = st.soldiers.filter((s) => s.squad === ${JSON.stringify(unit)} && s.mode !== "mort" && s.mode !== "fui");
    if (!g.length) return null;
    // Cadrage sur l'unité (vue stratégique), puis zoom au centre de l'écran.
    p.view.frame(g.map((u) => ({ x: u.x, y: u.y, z: 0 })));
    return [0, 0];
  })()`)) as [number, number] | null;
  if (!m || !box) return false;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  for (let i = 0; i < steps; i++) await page.mouse.wheel(0, -200);
  await page.waitForTimeout(900);
  if (process.env["R3_DEBUG"]) console.log(`zoom ${unit} : point ${JSON.stringify(m)} ; zoom ${String(await page.evaluate("window.__batailleRt.view.zoomLevel"))}`);
  return true;
}

/** Chaque figure montre la pose de son état (directeur) ; renvoie le nombre de figures de R3 par famille. */
function checkPoses(list: Fig[], label: string): { soldiers: number; troops: number; titans: number; r3Titans: number } {
  let bad = 0;
  const n = { soldiers: 0, troops: 0, titans: 0, r3Titans: 0 };
  for (const f of list) {
    const want = f.key.startsWith("T") ? TITAN_POSE[f.state as keyof typeof TITAN_POSE] : f.key.startsWith("t") ? TROOP_POSE[f.state as keyof typeof TROOP_POSE] : SOLDIER_POSE[f.state as keyof typeof SOLDIER_POSE];
    // Figures de R1 (premier temps) : poses de R1 ; seules les figures de R3 sont comparées pose pour pose.
    if (f.r3 && want !== f.pose) bad++;
    if (f.key.startsWith("T")) {
      n.titans++;
      if (f.r3) n.r3Titans++;
    } else if (f.r3 && f.key.startsWith("t")) n.troops++;
    else if (f.r3) n.soldiers++;
  }
  expect(bad === 0 && list.length > 0, `${label} : ${list.length} figures, pose = état de la simulation pour chacune (${bad} écart)`);
  return n;
}

const server = await createServer({ server: { port: 5189, strictPort: false }, logLevel: "error" });
await server.listen();
const url = server.resolvedUrls?.local[0] ?? "http://localhost:5189/";
const browser: Browser = await chromium.launch({ executablePath });

try {
  // ——— 1. Planches (`R3_PLANCHES=0` : sautées, mise au point de la bataille) ———
  for (const sheet of process.env["R3_PLANCHES"] === "0" ? [] : ["r3-titans", "r3-visages", "r3-soldats", "r3-poses", "r3-uniformes", "r3-ceremonie"]) {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    watch(page, `[${sheet}] `);
    const t0 = Date.now();
    await page.goto(`${url}?proto3d=humain&planche=${sheet}&t=0.6`);
    await page.waitForSelector("html[data-proto3d='pret']", { timeout: 240000 });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${OUT}/${sheet}.png` });
    const probe = (await page.evaluate("window.__humain3d")) as { bodies: { id: string; nominal: number; measured: number }[] };
    const labels = await page.locator(".p3d-etiquette").count();
    if (sheet === "r3-titans") {
      const worst = Math.max(...probe.bodies.map((b) => Math.abs(b.measured / b.nominal - 1)));
      expect(probe.bodies.length === 15 && worst <= 0.05, `r3-titans : 15 corps à l'échelle, hauteurs mesurées à ${(worst * 100).toFixed(2)} % au plus (±5 %)`);
    }
    expect(labels > 0, `${sheet} : planche prête en ${((Date.now() - t0) / 1000).toFixed(1)} s, ${labels} étiquettes`);
    await page.close();
  }

  // `R3_BATAILLE=0` : planches seulement (mise au point d'une planche).
  if (process.env["R3_BATAILLE"] === "0") throw new Error("SANS_BATAILLE");
  // ——— 2. Bataille de compagnie, 1366×768 ———
  console.log("[850, essai de compagnie] 1366×768");
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  watch(page, "[bataille 1366] ");
  await page.goto(`${url}?dossiers=0`);
  await page.waitForSelector("html[data-ready='true']", { timeout: 120000 });
  await page.waitForTimeout(600);
  const ready = await company(page);
  const first = await figures(page);
  expect((await ds(page, "vue")) === "3d", `vue 3D prête en ${(ready / 1000).toFixed(1)} s (premier temps : ${first.corps})`);
  // Second temps : corps de base chargé, Titans de R3 construits (la bataille est en pause, les images continuent).
  await page.waitForFunction(() => document.querySelector<HTMLElement>(".bataille")?.dataset["corpsS"] !== undefined, undefined, { timeout: 300000 });
  const corpsS = await ds(page, "corps-s");
  // Rapproché sur une section de Marley, à l'ouverture (avant l'arrivée des soldats volants, plus près de la caméra).
  expect(await zoomOn(page, "ennemi", 11), "zoom sur une section ennemie");
  await page.waitForFunction(() => Number(document.querySelector<HTMLElement>(".bataille")?.dataset["frames"] ?? "0") >= 0, undefined);
  await page.waitForTimeout(6000);
  const enemy = await figures(page);
  if (process.env["R3_DEBUG"]) console.log(JSON.stringify(enemy.list.slice(0, 12)), await ds(page, "stats"));
  const nE = checkPoses(enemy.list, "vue rapprochée (Marley, à l'ouverture)");
  expect(nE.troops > 0 && enemy.corps === "corps" && nE.r3Titans === nE.titans && nE.titans === 4, `second temps à ${corpsS} s : ${await ds(page, "corps")} ; ${nE.troops} fantassins de Marley en tenue, ${nE.r3Titans}/${nE.titans} Titans de R3`);
  await page.screenshot({ path: `${OUT}/r3-bataille-marley-1366.png` });
  // Rapproché sur une section de Paradis (Garnison) et les escouades voisines, à l'ouverture.
  expect(await zoomOn(page, "allie", 11), "zoom sur une section alliée");
  await page.waitForTimeout(6000);
  const near = await figures(page);
  if (process.env["R3_DEBUG"]) console.log(JSON.stringify(near.list.slice(0, 12)), await ds(page, "stats"));
  const nA = checkPoses(near.list, "vue rapprochée (Paradis)");
  expect(nA.troops > 0, `fantassins de la Garnison en tenue : ${nA.troops} (et ${nA.soldiers} soldats du Corps de Reconnaissance)`);
  await page.screenshot({ path: `${OUT}/r3-bataille-paradis-1366.png` });
  // Suivi d'une escouade (troisième personne), la bataille avance : soldats en vol, en tenue.
  await page.locator(".rt-unite[data-squad='esc_05']").click();
  await page.keyboard.press("KeyV");
  await runFor(page, 40);
  const follow = await figures(page);
  const nF = checkPoses(follow.list, "caméra de suivi");
  expect(nF.soldiers > 0, `soldats du Corps de Reconnaissance en tenue (suivi) : ${nF.soldiers}`);
  await page.screenshot({ path: `${OUT}/r3-bataille-suivi-1366.png` });
  console.log(`  ..  mesures (rendu logiciel) : prêt ${(ready / 1000).toFixed(1)} s · corps ${corpsS} s · ${await ds(page, "stats")} · temps JS p95 ${await ds(page, "js-p95")} ms`);
  await page.close();

  // ——— 3. 3840×2160 ———
  console.log("[850, essai de compagnie] 3840×2160");
  const big = await browser.newPage({ viewport: { width: 3840, height: 2160 } });
  watch(big, "[bataille 3840] ");
  await big.goto(`${url}?dossiers=0`);
  await big.waitForSelector("html[data-ready='true']", { timeout: 120000 });
  await big.waitForTimeout(600);
  await company(big);
  await big.waitForFunction(() => document.querySelector<HTMLElement>(".bataille")?.dataset["corpsS"] !== undefined, undefined, { timeout: 300000 });
  expect(await zoomOn(big, "allie", 11), "3840 : zoom sur une section alliée");
  await big.waitForTimeout(8000);
  checkPoses((await figures(big)).list, "3840×2160");
  await big.screenshot({ path: `${OUT}/r3-bataille-3840.png` });
  await big.close();

  // ——— 4. three.js hors du bundle principal ———
  if (existsSync("dist/index.html")) {
    const html = readFileSync("dist/index.html", "utf8");
    const main = /src="(?:\.\/|\/)?(assets\/index-[^"]+\.js)"/.exec(html)?.[1] ?? "";
    const text = main ? readFileSync(`dist/${main}`, "utf8") : "";
    const view3d = readdirSync("dist/assets").find((f) => /view3d/.test(f));
    expect(!!main && (text.match(/THREE\./g) ?? []).length === 0 && !/figures_r3|marley_officier/.test(text) && !!view3d, `bundle principal ${main} sans three.js ni figures de R3 ; vue 3D en morceau à part (${view3d ?? "introuvable"})`);
  } else expect(false, "dist/ absent : lancer `npm run build` avant smoke:r3");
  expect(errors.length === 0, `0 erreur console${errors.length ? ` (${errors.slice(0, 3).join(" | ")})` : ""}`);
} catch (e) {
  if (!(e instanceof Error && e.message === "SANS_BATAILLE")) throw e;
  console.log("(bataille non jouée : R3_BATAILLE=0)");
} finally {
  await browser.close();
  await server.close();
}
if (failures.length) {
  console.error(`smoke:r3 : ÉCHEC (${failures.length})`);
  process.exit(1);
}
console.log("smoke:r3 : tout est conforme.");
