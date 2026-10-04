// npm run smoke:expedition — AC3-11 et AC3-14 dans un vrai navigateur (Chromium, serveur de dev Vite) + captures docs/screenshots/p3-*.
// Parcours : registre (touche E), planificateur (itinéraire cliqué sur la carte puis destination, escouades, table de logistique,
// pré-brief), ordre de départ signé, fanion sur la carte, retour, rapport, liste des morts, lettre, calque « Ravitaillement ».
// Navigateur : CHROMIUM_PATH ou /opt/pw-browsers/chromium.
import { mkdirSync } from "node:fs";
import { chromium } from "playwright-core";
import type { Page } from "playwright-core";
import { createServer } from "vite";
import mapJson from "../../data/map/paradis.json";
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
const isDriverNoise = (text: string): boolean => /GL Driver Message|GPU stall due to ReadPixels/.test(text);
const map = mapJson as unknown as { bounds: [number, number, number, number]; provinces: Record<string, { anchor: [number, number] }> };

/** Valeurs expliquées et aucune clé brute dans le registre ouvert (AC3-11). */
async function audit(page: Page, label: string): Promise<void> {
  const unexplained = await page.$$eval(".registre-panneau .valeur", (els) => els.filter((e) => !(e as HTMLElement).dataset["why"]).length);
  const count = await page.locator(".registre-panneau .valeur").count();
  const visible = await page.evaluate(() => document.body.innerText);
  const raw = Object.keys(fr).filter((k) => k.includes(".") && visible.includes(k));
  const ids = [...new Set(visible.match(/\b(prov|char|sol|esc)_[a-z0-9_]+/g) ?? [])];
  expect(unexplained === 0 && raw.length === 0 && ids.length === 0, `${label} : ${count} valeurs, toutes expliquées ; aucune clé ni identifiant brut${raw.length || ids.length ? ` (${[...raw, ...ids].slice(0, 5).join(", ")})` : ""}`);
}

async function console_(page: Page, line: string, expectText: string): Promise<void> {
  await page.keyboard.press("F2");
  await page.locator(".debug-console input").fill(line);
  await page.keyboard.press("Enter");
  await page.waitForFunction((s) => document.querySelector(".debug-console__log")?.textContent?.includes(s), expectText, { timeout: 60000 });
  await page.keyboard.press("F2");
}

/** Position à l'écran de l'ancre d'une province, la carte étant cadrée sur toute l'île (caméra non déplacée). */
async function screenOf(page: Page, id: string): Promise<[number, number]> {
  const box = await page.locator("canvas.carte__toile").boundingBox();
  const a = map.provinces[id]?.anchor;
  if (!box || !a) throw new Error(`position inconnue : ${id}`);
  const [x0, y0, x1, y1] = map.bounds;
  const zoom = Math.min(box.width / (x1 - x0), box.height / (y1 - y0)) * 0.98;
  return [box.x + box.width / 2 + a[0] * zoom, box.y + box.height / 2 + a[1] * zoom];
}

const server = await createServer({ server: { port: 5178, strictPort: false }, logLevel: "error" });
await server.listen();
const url = server.resolvedUrls?.local[0] ?? "http://localhost:5178/";
const browser = await chromium.launch({ executablePath });

try {
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const errors: string[] = [];
  page.on("console", (m) => {
    if ((m.type() === "error" || m.type() === "warning") && !isDriverNoise(m.text())) errors.push(`${m.type()}: ${m.text()}`);
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  await page.goto(url);
  await page.waitForSelector("html[data-ready='true']", { timeout: 60000 });
  await page.waitForTimeout(400);
  console.log("[scénario 850] 1366×768");

  // Quatre mois passent : capital politique pour une sortie.
  await console_(page, "advance 120", "120");

  // ——— Registre ———
  await page.keyboard.press("KeyE");
  await page.waitForSelector('.registre-panneau[data-panel="expeditions"]:not([hidden])');
  expect((await page.locator(".bandeau__registre-bouton[data-panel='expeditions']").count()) === 1, "bandeau : registre « Expéditions » ; touche E");
  await audit(page, "registre des expéditions");

  // ——— Planificateur : itinéraire cliqué sur la carte ———
  await page.locator("button[data-action='planifier']").click();
  await page.waitForSelector(".registre-panneau--lateral select[data-plan='cible']");
  expect(await page.locator(".registre-panneau--lateral").isVisible(), "planificateur posé sur le côté (carte visible)");
  // Lac des Reflets : à l'est, hors du planificateur posé à gauche ; son chemin franchit le mur Rose à la porte de Karanes.
  const [fx, fy] = await screenOf(page, "prov_lac_des_reflets");
  await page.mouse.click(fx, fy);
  await page.waitForTimeout(250);
  const clicked = await page.locator(".plan-itineraire li").allInnerTexts();
  expect(clicked.length >= 3 && clicked.at(-1) === "Lac des Reflets" && !(await page.locator(".dossier").isVisible()), `clic sur la carte → itinéraire ${clicked.join(" → ")} (sans ouvrir de dossier)`);
  expect(clicked.some((x) => x.startsWith("Rose-Est")), "le mur Rose se franchit à la porte de Karanes (Rose-Est)");

  // Destination choisie, 20 escouades, plan recevable.
  await page.selectOption("select[data-plan='cible']", "prov_maria_est");
  await page.waitForTimeout(150);
  await page.locator("button[data-action='escouades']").click();
  await page.waitForTimeout(250);
  const steps = await page.locator(".plan-itineraire li").count();
  const outside = await page.locator(".plan-itineraire li.hors-rayon").count();
  expect(steps >= 4 && outside >= 2, `itinéraire vers Maria-Est : ${steps} étapes, ${outside} hors du rayon de ravitaillement`);
  expect((await page.locator(".plan-probleme").getAttribute("data-ok")) === "true", `plan recevable : « ${await page.locator(".plan-probleme").innerText()} »`);
  expect((await page.locator(".plan-logistique tr").count()) >= 5 && (await page.locator(".plan-brief .valeur").count()) >= 4, "table de logistique (emporté / besoin estimé) et pré-brief chiffré");
  expect((await page.locator(".plan-avis").count()) >= 1, "pré-brief : avis du stratège avec sa fiabilité");
  await audit(page, "planificateur");
  await page.locator(".plan-brief .valeur >> nth=3").focus();
  await page.waitForTimeout(150);
  expect((await page.locator(".pourquoi tr").count()) >= 2, "pertes estimées : fiche « pourquoi ? » détaillée");
  await page.screenshot({ path: `${OUT}/p3-planificateur.png` });

  // Saisie numérique : « 1 » ne change pas la vitesse.
  const pressed = (): Promise<number> => page.$$eval(".bandeau__vitesse", (els) => els.findIndex((e) => e.getAttribute("aria-pressed") === "true"));
  const speedBefore = await pressed();
  const field = page.locator("input[data-retreat='losses_pct']");
  await field.click();
  await field.press("Control+A");
  await page.keyboard.type("40");
  await field.press("Tab");
  expect((await pressed()) === speedBefore && (await field.inputValue()) === "40", `les chiffres saisis dans le planificateur ne déclenchent pas de raccourci (vitesse ${speedBefore} inchangée)`);

  // ——— Départ ———
  await page.locator("button[data-action='lancer']").click();
  expect(await page.locator(".bordereau").isVisible(), "bordereau de confirmation avant le départ (F-UIX-13)");
  await page.locator("[data-confirm='oui']").click();
  await page.waitForSelector(".exp-carte[data-exp]", { timeout: 10000 });
  ok("expédition en campagne dans le registre");
  await console_(page, "advance 3", "3");
  await page.keyboard.press("KeyE");
  await page.waitForTimeout(150);
  await page.keyboard.press("KeyE");
  await page.waitForSelector(".exp-carte[data-exp]");
  await audit(page, "expédition en campagne");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  await page.locator(".carte").screenshot({ path: `${OUT}/p3-carte-expedition.png` });

  // ——— Retour et rapport ———
  await console_(page, "advance 30", "30");
  await page.keyboard.press("KeyE");
  await page.waitForSelector("button[data-report]", { timeout: 10000 });
  await page.locator("button[data-report] >> nth=0").click();
  await page.waitForSelector(".rapport");
  const dead = await page.locator(".rapport-morts tr").count();
  expect(dead >= 1, `rapport : liste des morts (${dead})`);
  expect((await page.locator(".rapport-signaux li").count()) >= 1 && (await page.locator(".rapport-lecons li").count()) >= 2, "rapport : fusées et leçons");
  expect((await page.locator(".rapport-telegramme").innerText()).includes("STOP"), "rapport : télégramme");
  await audit(page, "rapport");
  await page.screenshot({ path: `${OUT}/p3-rapport.png` });
  await page.locator(".rapport-morts button[data-lettre] >> nth=0").click();
  await page.waitForSelector(".lettre");
  const letter = await page.locator(".lettre").innerText();
  expect(letter.length > 200 && /expédition n° \d+/.test(letter), "lettre à la famille (F-CHR-09)");
  await audit(page, "lettre");
  await page.screenshot({ path: `${OUT}/p3-lettre.png` });
  await page.keyboard.press("Escape");

  // ——— Calque « Ravitaillement » ———
  await page.locator('button[data-overlay="ravitaillement"]').click();
  await page.waitForTimeout(250);
  expect((await page.locator(".calques__case").count()) === 4, "calque Ravitaillement : légende (dans le rayon, 50, 125, 250 km)");
  await page.locator(".carte").screenshot({ path: `${OUT}/p3-calque-ravitaillement.png` });

  expect(errors.length === 0, `aucune erreur console${errors.length ? ` : ${errors.join(" | ")}` : ""}`);
  await page.close();
} finally {
  await browser.close();
  await server.close();
}

if (failures.length > 0) {
  console.error(`smoke:expedition : ${failures.length} échec(s).`);
  process.exit(1);
}
console.log(`smoke:expedition : OK (captures dans ${OUT}/).`);
