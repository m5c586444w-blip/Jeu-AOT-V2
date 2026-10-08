// npm run smoke:pa — CPA-08 et CPA-09 dans un vrai navigateur (Chromium, serveur de dev Vite) + captures docs/screenshots/pa-*.
// Parcours : 854 côté Paradis (étendards d'armées sur la carte en 1366×768 et 3840×2160, registre des armées, fiche
// d'artillerie, ordre de marche par clic sur la carte et trajet tracé) ; guerre contre Marley, flotte en vue et débarquement ;
// interception en marche forcée, contact (pause, choix auto / bataille / repli), bataille livrée avec l'artillerie des deux
// camps, bilan ; 854 côté Marley (ordre maritime : route de la flotte, débarquement). Valeurs expliquées, aucune clé brute.
import { mkdirSync, readFileSync } from "node:fs";
import { chromium } from "playwright-core";
import type { Page } from "playwright-core";
import { createServer } from "vite";
import fr from "../i18n/fr.json";

const executablePath = process.env["CHROMIUM_PATH"] ?? "/opt/pw-browsers/chromium";
const OUT = "docs/screenshots";
mkdirSync(OUT, { recursive: true });
const failures: string[] = [];
const expect = (cond: boolean, label: string): void => {
  if (cond) console.log(`  OK  ${label}`);
  else {
    failures.push(label);
    console.error(`  KO  ${label}`);
  }
};
const isDriverNoise = (text: string): boolean => /GL Driver Message|GPU stall due to ReadPixels/.test(text);
const MAP = JSON.parse(readFileSync("data/map/paradis.json", "utf8")) as { bounds: [number, number, number, number]; provinces: Record<string, { polygon: [number, number][] }> };

async function audit(page: Page, scope: string, label: string): Promise<void> {
  const unexplained = await page.$$eval(`${scope} .valeur`, (els) => els.filter((e) => !(e as HTMLElement).dataset["why"]).length);
  const count = await page.locator(`${scope} .valeur`).count();
  const visible = await page.locator(scope).innerText();
  const raw = [...Object.keys(fr).filter((k) => k.includes(".") && visible.includes(k)), ...(visible.match(/\b(tac|battle|army|armies|narr|art|mun|rgt|ship|sea)\.[a-z_]+(\.[a-z_]+)*/g) ?? [])];
  const ids = [...new Set(visible.match(/\b(prov|char|org|str|evt|tech|secret|agent|rap|shifter|ttype|tmap|wprov|fac|form|army|flt|rgt|art|mun|ship|sea|enc)_[a-z0-9_]+/g) ?? [])];
  expect(unexplained === 0 && raw.length === 0 && ids.length === 0, `${label} : ${count} valeurs, toutes expliquées ; aucune clé ni identifiant brut${raw.length || ids.length ? ` (${[...raw, ...ids].slice(0, 5).join(", ")})` : ""}`);
}

async function consoleLine(page: Page, line: string, expectText: string): Promise<void> {
  await page.keyboard.press("F2");
  await page.locator(".debug-console input").fill(line);
  await page.keyboard.press("Enter");
  await page.waitForFunction((s) => document.querySelector(".debug-console__log")?.textContent?.includes(s), expectText, { timeout: 300000 });
  await page.keyboard.press("F2");
}

/** Clic au centre d'une province de la carte stratégique (cadrage initial : toute l'île, centrée). */
async function clickProvince(page: Page, id: string): Promise<void> {
  const box = await page.locator(".carte__toile").boundingBox();
  const poly = MAP.provinces[id]?.polygon;
  if (!box || !poly) throw new Error(`province ou carte absente : ${id}`);
  const [x0, y0, x1, y1] = MAP.bounds;
  const zoom = Math.min(box.width / (x1 - x0), box.height / (y1 - y0)) * 0.98;
  const cx = poly.reduce((a, p) => a + p[0], 0) / poly.length;
  const cy = poly.reduce((a, p) => a + p[1], 0) / poly.length;
  await page.mouse.click(box.x + box.width / 2 + cx * zoom, box.y + box.height / 2 + cy * zoom);
  await page.waitForTimeout(300);
}

/** Ouvre un registre par sa touche s'il n'est pas déjà ouvert (la touche le refermerait). */
async function panel(page: Page, key: string, id: string): Promise<void> {
  if ((await page.locator(`.registre-panneau[data-panel="${id}"]:not([hidden])`).count()) === 0) await page.keyboard.press(key);
  await page.waitForSelector(`.registre-panneau[data-panel="${id}"]:not([hidden])`);
}

async function open(page: Page, url: string, errors: string[]): Promise<void> {
  page.on("console", (m) => {
    if ((m.type() === "error" || m.type() === "warning") && !isDriverNoise(m.text())) errors.push(`${m.type()}: ${m.text()}`);
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  await page.goto(url);
  await page.waitForSelector("html[data-ready='true']", { timeout: 120000 });
  await page.waitForTimeout(800);
}

const server = await createServer({ server: { port: 5186, strictPort: false }, logLevel: "error" });
await server.listen();
const url = server.resolvedUrls?.local[0] ?? "http://localhost:5186/";
const browser = await chromium.launch({ executablePath });
const errors: string[] = [];

try {
  // ——— 1. Étendards sur la carte, 1366×768 et 3840×2160 ———
  console.log("[854, Paradis] 1366×768");
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  await open(page, `${url}?scenario=scn_854&faction=fac_paradis&dossiers=0`, errors);
  expect((await page.locator(".bandeau__registre-bouton[data-panel='armees']").count()) === 1, "bandeau : registre « Armées » (touche S)");
  await page.screenshot({ path: `${OUT}/pa-pions-1366.png` });
  const big = await browser.newPage({ viewport: { width: 3840, height: 2160 } });
  await open(big, `${url}?scenario=scn_854&faction=fac_paradis&dossiers=0`, errors);
  await big.screenshot({ path: `${OUT}/pa-pions-3840.png` });
  await big.close();

  // ——— 2. Registre des armées, fiche d'artillerie, ordre de marche par clic sur la carte ———
  await panel(page, "KeyS", "armees");
  const rows = await page.locator(".registre-panneau [data-army]").count();
  expect(rows === 3, `registre des armées : ${rows} armées de Paradis (Sud, Est, Brigade)`);
  await page.locator('.registre-panneau [data-army="army_854_sud"]').click();
  await page.waitForTimeout(200);
  await page.locator(".armee__valeurs .valeur >> nth=1").focus();
  await page.waitForTimeout(150);
  expect((await page.locator(".pourquoi").innerText()).length > 20, "moral expliqué (« pourquoi ? »)");
  await audit(page, ".registre-panneau", "registre des armées");
  await page.locator('[data-action="choisir"]').click();
  await clickProvince(page, "prov_maria_sud_est");
  const marchLabel = await page.locator('[data-action="marcher"]').innerText();
  expect(marchLabel.includes(fr["prov.maria_sud_est"] ?? "Maria"), `destination choisie au clic sur la carte : « ${marchLabel} »`);
  await page.locator('[data-action="marcher"]').click();
  await page.waitForTimeout(300);
  await page.locator('.registre-panneau [data-army="army_854_sud"]').click();
  await page.waitForTimeout(200);
  const route = await page.locator(".registre-panneau .plan-ligne >> nth=0").innerText();
  expect(route.includes("→"), `trajet affiché : « ${route.slice(0, 110)} »`);
  await consoleLine(page, "advance 6", "6");
  await panel(page, "KeyS", "armees");
  await page.locator('.registre-panneau [data-army="army_854_sud"]').click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/pa-trajet.png` });
  await page.keyboard.press("Escape");

  // ——— 3. Guerre contre Marley : flotte en vue, débarquement de l'IA ———
  await panel(page, "KeyD", "diplomatie");
  await page.locator('.fiche-nation[data-nation="fac_marley"]').click();
  await page.locator('[data-action="guerre"]').click();
  await page.locator('[data-confirm="oui"]').click();
  await page.waitForTimeout(300);
  await page.keyboard.press("Escape");
  await consoleLine(page, "advance 5", "5");
  const journal = await page.evaluate(() => document.body.innerText);
  expect(journal.includes(fr["alert.fleet_sighted"].split("{")[0]?.trim().slice(0, 12) ?? "flotte") || journal.includes("débarque"), "flotte de Marley en vue ; corps débarqué (journal)");

  // ——— 4. Interception, contact, choix ———
  await panel(page, "KeyS", "armees");
  await page.locator('.registre-panneau [data-army="army_854_sud"]').click();
  await page.waitForTimeout(200);
  const targets = await page.locator('select[data-target="army_854_sud"] option').count();
  expect(targets >= 1, `ennemi en vue à intercepter : ${targets}`);
  await page.locator('[data-action="intercepter"]').click();
  await page.waitForTimeout(200);
  await page.locator('[data-action="forcee"]').click();
  await page.waitForTimeout(200);
  await page.keyboard.press("Escape");
  let contact = false;
  for (let i = 0; i < 16 && !contact; i++) {
    await consoleLine(page, "advance 10", "10");
    contact = (await page.locator(".armee__rencontre").count()) > 0;
  }
  expect(contact, "contact : alerte, jeu en pause, registre ouvert sur la rencontre");
  const choices = await page.locator(".armee__rencontre button").allInnerTexts();
  expect(choices.length === 3, `trois issues proposées : ${choices.join(" / ")}`);
  await page.screenshot({ path: `${OUT}/pa-rencontre.png` });

  // ——— 5. Bataille livrée : artillerie des deux camps ———
  await page.locator('.armee__rencontre [data-action="jouer"]').click();
  await page.waitForSelector("body[data-tactique='1']", { timeout: 60000 });
  await page.locator('[data-speed="2"]').click();
  await page.waitForTimeout(12000);
  await page.screenshot({ path: `${OUT}/pa-artillerie-bataille.png` });
  await page.locator('[data-action="quitter"]').click();
  await page.waitForSelector(".bilan", { timeout: 120000 });
  const bilan = await page.locator(".bilan").innerText();
  expect(bilan.includes(fr["tac.sum.shells"]), "bilan : ligne « Obus tirés » (artillerie)");
  await audit(page, ".bilan", "bilan de bataille");
  await page.locator(".bilan").screenshot({ path: `${OUT}/pa-bilan.png` });
  await page.locator('.bilan [data-action="valider"]').click();
  await page.waitForTimeout(800);
  const after = await page.locator(".armee__rencontre").count();
  expect(after === 0, "rencontre résolue après la bataille (ordres rejoués par la simulation)");
  await page.close();

  // ——— 6. Marley : ordre maritime (route de la flotte, débarquement) ———
  console.log("[854, Marley] 1366×768");
  const m = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  await open(m, `${url}?scenario=scn_854&faction=fac_marley&dossiers=0`, errors);
  await panel(m, "KeyD", "diplomatie");
  await m.locator('.fiche-nation[data-nation="fac_paradis"]').click();
  await m.locator('[data-action="guerre"]').click();
  await m.locator('[data-confirm="oui"]').click();
  await m.waitForTimeout(300);
  await panel(m, "KeyS", "armees");
  await m.locator('.registre-panneau [data-fleet="flt_854_marley"]').click();
  await m.waitForTimeout(200);
  await m.selectOption(".registre-panneau .plan-choix >> nth=0", "sea_sud_est");
  await m.locator('[data-action="naviguer"]').click();
  await m.waitForTimeout(200);
  await m.keyboard.press("Escape");
  await consoleLine(m, "advance 4", "4");
  await panel(m, "KeyS", "armees");
  await m.locator('.registre-panneau [data-fleet="flt_854_marley"]').click();
  await m.waitForTimeout(200);
  await m.locator('.registre-panneau [data-army="army_854_marley"]').click();
  await m.waitForTimeout(200);
  const pieces = await m.locator(".armee__artillerie [data-piece]").count();
  await m.locator(".armee__artillerie").scrollIntoViewIfNeeded();
  expect(pieces >= 2, `fiche d'artillerie du corps de Marley : ${pieces} pièces (portée, cadence, souffle, munitions)`);
  await audit(m, ".registre-panneau", "registre des armées, fiche d'artillerie (Marley)");
  await m.locator(".registre-panneau").screenshot({ path: `${OUT}/pa-registre.png` });
  await m.locator('.registre-panneau [data-fleet="flt_854_marley"]').click();
  await m.waitForTimeout(200);
  const lands = await m.locator('[data-action="debarquer"]').count();
  expect(lands >= 1, "flotte au mouillage au sud-est : débarquement proposé");
  await m.screenshot({ path: `${OUT}/pa-flotte.png` });
  await m.locator('[data-action="debarquer"] >> nth=0').click();
  await m.waitForTimeout(400);
  const landed = await m.locator('.registre-panneau [data-army="army_854_marley"]').innerText();
  expect(!landed.includes(fr["armies.aboard"]), `corps de Marley débarqué : « ${landed.replace(/\s+/g, " ").slice(0, 80)} »`);
  await audit(m, ".registre-panneau", "registre des armées (Marley)");
  await m.close();

  // ——— 7. 850 : rencontre de Titans au pied du mur Rose, canons de rempart de Paradis ———
  console.log("[850, Paradis] 1366×768");
  const p8 = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  await open(p8, `${url}?scenario=scn_sandbox_850&dossiers=0`, errors);
  await panel(p8, "KeyS", "armees");
  await p8.locator('.registre-panneau [data-army="army_850_sud"]').click();
  await p8.locator('[data-action="choisir"]').click();
  await clickProvince(p8, "prov_plaines_interieures_maria_sud");
  await p8.locator('[data-action="marcher"]').click();
  await p8.waitForTimeout(300);
  await p8.keyboard.press("Escape");
  let titans = false;
  for (let i = 0; i < 8 && !titans; i++) {
    await consoleLine(p8, "advance 5", "5");
    titans = (await p8.locator(".armee__rencontre").count()) > 0;
  }
  expect(titans, "Titans rencontrés hors du mur Rose : alerte et choix");
  if (titans) {
    await p8.locator('.armee__rencontre [data-action="jouer"]').click();
    await p8.waitForSelector("body[data-tactique='1']", { timeout: 60000 });
    await p8.locator('[data-speed="2"]').click();
    await p8.waitForTimeout(12000);
    await p8.screenshot({ path: `${OUT}/pa-artillerie-rempart.png` });
    await p8.locator('[data-action="quitter"]').click();
    await p8.waitForSelector(".bilan", { timeout: 120000 });
    const b8 = await p8.locator(".bilan").innerText();
    expect(b8.includes(fr["tac.sum.shells"]), "canons de rempart de Paradis en bataille : ligne « Obus tirés » au bilan");
    await p8.locator('.bilan [data-action="valider"]').click();
  }
  await p8.close();

  expect(errors.length === 0, `0 erreur console${errors.length ? ` (${errors.slice(0, 3).join(" | ")})` : ""}`);
} finally {
  await browser.close();
  await server.close();
}

if (failures.length) {
  console.error(`smoke:pa : ÉCHEC (${failures.length})`);
  process.exit(1);
}
console.log("smoke:pa : tout est conforme.");
