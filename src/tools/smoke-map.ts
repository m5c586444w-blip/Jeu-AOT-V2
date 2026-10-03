// npm run smoke:map — AC1-10 à AC1-14 dans un vrai navigateur (Chromium, serveur de dev Vite) + captures docs/screenshots/p1-*.
// Navigateur : CHROMIUM_PATH ou /opt/pw-browsers/chromium.
import { mkdirSync, statSync } from "node:fs";
import { chromium } from "playwright-core";
import type { Page } from "playwright-core";
import { createServer } from "vite";
import fr from "../i18n/fr.json";

const executablePath = process.env["CHROMIUM_PATH"] ?? "/opt/pw-browsers/chromium";
const OUT = "docs/screenshots";
mkdirSync(OUT, { recursive: true });
const failures: string[] = [];
const ok = (label: string): void => console.log(`  OK  ${label}`);
const expect = (cond: boolean, label: string): void => {
  if (cond) ok(label);
  else {
    failures.push(label);
    console.error(`  KO  ${label}`);
  }
};
// Messages de performance émis par le pilote WebGL logiciel de Chromium headless : ce ne sont pas des erreurs du jeu.
const isDriverNoise = (text: string): boolean => /GL Driver Message|GPU stall due to ReadPixels/.test(text);

async function open(page: Page, url: string, errors: string[]): Promise<void> {
  page.on("console", (m) => {
    if ((m.type() === "error" || m.type() === "warning") && !isDriverNoise(m.text())) errors.push(`${m.type()}: ${m.text()}`);
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  await page.goto(url);
  await page.waitForSelector("html[data-ready='true']", { timeout: 30000 });
  await page.waitForTimeout(500);
}

const server = await createServer({ server: { port: 5176, strictPort: false }, logLevel: "error" });
await server.listen();
const url = server.resolvedUrls?.local[0] ?? "http://localhost:5176/";
const browser = await chromium.launch({ executablePath });

try {
  // ——— 100 % — parcours complet ———
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const errors: string[] = [];
  await open(page, url, errors);
  console.log("[100 %] 1366×768");

  const canvas = page.locator("canvas.carte__toile");
  expect((await canvas.count()) === 1, "carte rendue dans un canvas (AC1-10)");
  await page.locator(".carte").screenshot({ path: `${OUT}/p1-carte-100.png` });
  expect(statSync(`${OUT}/p1-carte-100.png`).size > 150_000, "capture de la carte non vide (> 150 Ko)");
  await page.screenshot({ path: `${OUT}/p1-ecran-100.png` });

  const lod0 = await page.getAttribute(".carte", "data-lod");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("canvas sans dimensions");
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  // Trost : sud de Rose (relèvement 180°) ; on survole puis on clique.
  const trostY = cy + box.height * 0.235;
  await page.mouse.move(cx, trostY);
  await page.waitForTimeout(150);
  expect((await page.locator(".bulle").isVisible()) && (await page.locator(".bulle__nom").innerText()) === "Trost", "survol → bulle « Trost » (AC1-10)");
  await page.mouse.click(cx, trostY);
  await page.waitForTimeout(200);
  expect((await page.locator(".dossier").isVisible()) && (await page.locator(".dossier__titre").innerText()) === "Trost", "clic → dossier de Trost (AC1-10)");
  await page.screenshot({ path: `${OUT}/p1-dossier.png` });
  for (const tab of ["Économie", "Garnison", "Bâtiments", "Renseignement"]) {
    await page.getByRole("tab", { name: tab }).click();
    await page.waitForTimeout(60);
  }
  expect((await page.locator(".dossier__ferme").count()) === 1, "onglet Renseignement « non encore ouvert » (diégétique)");
  await page.getByRole("tab", { name: "Économie" }).click();
  await page.keyboard.press("Escape");
  expect(!(await page.locator(".dossier").isVisible()), "Échap ferme le dossier");

  await page.mouse.dblclick(cx, trostY);
  await page.waitForTimeout(200);
  const lod1 = await page.getAttribute(".carte", "data-lod");
  expect(lod0 === "monde" && lod1 !== "monde", `double-clic → centrage et rapprochement (${lod0} → ${lod1}) (AC1-10)`);
  await page.locator(".carte").screenshot({ path: `${OUT}/p1-carte-region.png` });
  for (let i = 0; i < 4; i++) await page.mouse.wheel(0, -300);
  await page.waitForTimeout(200);
  expect((await page.getAttribute(".carte", "data-lod")) === "province", "molette → niveau « province » (F-STR-01)");
  await page.locator(".carte").screenshot({ path: `${OUT}/p1-carte-province.png` });
  await page.keyboard.press("KeyF");
  await page.waitForTimeout(150);
  expect((await page.getAttribute(".carte", "data-lod")) === "monde", "touche F → retour à la vue d'ensemble");

  // « Pourquoi ? » partout, sans clé brute.
  const unexplained = await page.$$eval(".valeur", (els) => els.filter((e) => !(e as HTMLElement).dataset["why"]).length);
  const valueCount = await page.locator(".valeur").count();
  expect(valueCount >= 20 && unexplained === 0, `${valueCount} valeurs affichées, toutes avec « pourquoi ? » (AC1-11)`);
  await page.hover(".bandeau__delta >> nth=0");
  await page.waitForTimeout(150);
  const rows = await page.locator(".pourquoi tr").count();
  expect((await page.locator(".pourquoi").isVisible()) && rows >= 5, `fiche « pourquoi ? » de la nourriture : ${rows} facteurs (AC1-11)`);
  await page.screenshot({ path: `${OUT}/p1-pourquoi.png` });
  const visible = await page.evaluate(() => document.body.innerText);
  const rawKeys = Object.keys(fr).filter((k) => k.includes(".") && visible.includes(k));
  expect(rawKeys.length === 0, `aucune clé de traduction brute visible${rawKeys.length ? ` (${rawKeys.slice(0, 5).join(", ")})` : ""} (AC1-11)`);

  // Temps.
  const date0 = await page.locator(".bandeau__jour").innerText();
  await page.mouse.move(5, 300);
  await page.keyboard.press("Digit5");
  await page.waitForTimeout(1600);
  const date1 = await page.locator(".bandeau__jour").innerText();
  expect(date0 !== date1, `vitesse 5 : la date avance (${date0.split(" —")[0]} → ${date1.split(" —")[0]}) (AC1-12)`);
  await page.keyboard.press("Space");
  await page.waitForTimeout(400);
  const paused = (await page.locator(".bandeau__vitesse >> nth=0").getAttribute("aria-pressed")) === "true";
  const date2 = await page.locator(".bandeau__jour").innerText();
  await page.waitForTimeout(800);
  expect(paused && date2 === (await page.locator(".bandeau__jour").innerText()), "Espace : pause, la date ne bouge plus (AC1-12)");

  // Calques et filtres.
  const overlays = await page.locator("button[data-overlay]").count();
  const closed = await page.locator("button[data-overlay]:disabled").count();
  expect(overlays === 10 && closed === 4, `10 calques déclarés, ${10 - closed} ouverts, ${closed} non ouverts (AC1-13)`);
  await page.locator('button[data-overlay="nourriture"]').click();
  await page.waitForTimeout(200);
  expect((await page.locator(".calques__case").count()) === 5, "calque Nourriture : légende à 5 échelons (AC1-13)");
  await page.locator(".carte").screenshot({ path: `${OUT}/p1-calque-nourriture.png` });
  await page.locator('input[data-filter="pawns"]').uncheck();
  expect((await page.locator("input[data-filter]").count()) === 4 && !(await page.locator('input[data-filter="pawns"]').isChecked()), "filtres (pions, toponymes, murs, brouillard) (F-STR-16)");
  await page.locator('input[data-filter="pawns"]').check();

  // Options : échelle, raccourci.
  await page.keyboard.press("F9");
  expect(await page.locator(".options").isVisible(), "F9 ouvre les options (AC1-14)");
  await page.selectOption('select[data-setting="uiScale"]', "125");
  const fontSize = await page.evaluate(() => document.documentElement.style.fontSize);
  expect(fontSize === "125%", "échelle d'interface 125 % appliquée (AC1-14)");
  await page.screenshot({ path: `${OUT}/p1-options.png` });
  await page.locator('button[data-action="pause"]').click();
  await page.keyboard.press("KeyB");
  expect((await page.locator('button[data-action="pause"]').innerText()) === "B", "raccourci « pause » réassigné à B (AC1-14)");
  await page.locator(".options__remise").click();
  await page.selectOption('select[data-setting="uiScale"]', "100");
  await page.keyboard.press("F9");

  // Console de service (F2) toujours là.
  await page.keyboard.press("F2");
  expect(await page.locator(".debug-console").isVisible(), "F2 ouvre la console de service");
  await page.keyboard.type("canon");
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => document.querySelector(".debug-console__log")?.textContent?.includes("canon:check"), undefined, { timeout: 10000 });
  ok("console : « canon » répond");
  await page.keyboard.press("F2");

  expect(errors.length === 0, `aucune erreur console${errors.length ? ` : ${errors.join(" | ")}` : ""} (AC1-10)`);
  await page.close();

  // ——— 125 % ———
  const p125 = await browser.newPage({ viewport: { width: 1093, height: 614 }, deviceScaleFactor: 1.25 });
  const errors125: string[] = [];
  await open(p125, url, errors125);
  console.log("[125 %] 1093×614 (×1,25)");
  const overflow = await p125.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow <= 0, "pas de défilement horizontal à 125 %");
  await p125.screenshot({ path: `${OUT}/p1-ecran-125.png` });
  expect(errors125.length === 0, `aucune erreur console à 125 %${errors125.length ? ` : ${errors125.join(" | ")}` : ""}`);
  await p125.close();

  // ——— Langue anglaise (repli sur le français pour les textes non encore traduits) ———
  const pen = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  await pen.addInitScript(() => localStorage.setItem("murs-et-sang:preferences", JSON.stringify({ locale: "en", uiScale: 100 })));
  await open(pen, url, []);
  expect((await pen.locator(".bandeau__titre").innerText()) === "Walls and Blood", "langue EN : titre traduit (F-UIX-18)");
  await pen.close();
} finally {
  await browser.close();
  await server.close();
}

if (failures.length > 0) {
  console.error(`smoke:map : ${failures.length} échec(s).`);
  process.exit(1);
}
console.log(`smoke:map : OK (captures dans ${OUT}/).`);
