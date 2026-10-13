// npm run smoke:p9 — P9 : menu des campagnes et des difficultés, divergence avertie (E59 du Grondement), fin de campagne.
// Captures hors git par défaut (`docs/screenshots/.smoke/`, D-146) ; `-- --captures` les écrit dans `docs/screenshots/p9-*.png`.
import { mkdirSync } from "node:fs";
import { chromium } from "playwright-core";
import type { Browser, Page } from "playwright-core";
import { createServer } from "vite";

const executablePath = process.env["CHROMIUM_PATH"] ?? "/opt/pw-browsers/chromium";
const OUT = process.argv.includes("--captures") ? "docs/screenshots" : "docs/screenshots/.smoke";
mkdirSync(OUT, { recursive: true });
console.log(`Captures : ${OUT}/${OUT === "docs/screenshots" ? " (suivies par git, option --captures)" : " (hors git)"}`);
const failures: string[] = [];
const expect = (cond: boolean, label: string): void => {
  if (cond) console.log(`  OK  ${label}`);
  else {
    failures.push(label);
    console.error(`  KO  ${label}`);
  }
};
const isDriverNoise = (text: string): boolean => /GL Driver Message|GPU stall due to ReadPixels/.test(text);

async function newPage(browser: Browser, errors: string[]): Promise<Page> {
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  await page.addInitScript("window.__name = (f) => f;");
  await page.addInitScript(() => {
    try {
      localStorage.setItem("murs-et-sang:preferences", JSON.stringify({ locale: "fr", uiScale: 100, volMaster: 0, volMusic: 0, volSfx: 0, subtitles: true, tutorial: { done: true, disabled: true, hints: false, seen: [] } }));
    } catch {
      // Stockage indisponible : préférences par défaut.
    }
  });
  page.on("console", (m) => {
    if ((m.type() === "error" || m.type() === "warning") && !isDriverNoise(m.text())) errors.push(`${m.type()}: ${m.text()}`);
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  return page;
}

const server = await createServer({ server: { port: 5189, strictPort: false }, logLevel: "error" });
await server.listen();
const url = server.resolvedUrls?.local[0] ?? "http://localhost:5189/";
const browser = await chromium.launch({ executablePath, args: ["--autoplay-policy=no-user-gesture-required"] });
try {
  const errors: string[] = [];
  // 1. Menu : quatre campagnes, puis la difficulté (Normal par défaut), puis la nation pour 854.
  const menu = await newPage(browser, errors);
  await menu.goto(`${url}?menu=1`);
  await menu.waitForSelector(".menu-principal", { timeout: 60000 });
  await menu.evaluate(() => document.fonts.ready);
  const camps = await menu.locator(".chemise[data-campagne]").count();
  expect(camps === 4, `menu : ${camps} campagnes (845, 850, 854, Grondement)`);
  await menu.locator('.chemise[data-campagne="cgrondement"]').click();
  await menu.waitForSelector(".choix-difficulte:not([hidden])");
  const levels = await menu.locator(".choix-difficulte .difficulte").allInnerTexts();
  const pressed = await menu.locator('.difficulte[aria-pressed="true"]').getAttribute("data-difficulte");
  expect(levels.length === 4 && pressed === "normal", `difficultés : ${levels.length} (${levels.map((l) => l.split("\n")[0]).join(", ")}), défaut ${pressed}`);
  await menu.waitForTimeout(300);
  await menu.screenshot({ path: `${OUT}/p9-menu-difficultes.png` });
  await menu.locator('.chemise[data-campagne="c854"]').click();
  await menu.locator('.difficulte[data-difficulte="rude"]').click();
  await menu.waitForSelector(".choix-nation-menu:not([hidden])");
  const nations = await menu.locator(".choix-nation-menu .chemise--nation").count();
  expect(nations === 2, `854 : choix de la nation après la difficulté (${nations} nations)`);
  await menu.locator('.chemise--nation[data-nation="fac_marley"]').click();
  await menu.waitForSelector("html[data-ready='true'] .bandeau", { timeout: 120000 });
  const q = new URL(menu.url()).searchParams;
  expect(q.get("scenario") === "scn_camp_854__rude" && q.get("faction") === "fac_marley", `854 Rude côté Marley : ${q.toString()}`);
  await menu.close();

  // 2. Grondement : E59 s'ouvre ; « empêcher » (non historique) demande une confirmation, puis la campagne finit (paix).
  const page = await newPage(browser, errors);
  await page.goto(`${url}?scenario=scn_camp_grondement__normal`);
  await page.waitForSelector("html[data-ready='true']", { timeout: 120000 });
  await page.evaluate(() => document.fonts.ready);
  await page.mouse.click(683, 460);
  await page.keyboard.press("Escape");
  // Le temps avance (vitesse 3) ; une alerte peut le suspendre : on relance jusqu'au dossier d'E59 (fenêtre de 0 à 2 jours).
  const e59 = page.locator('.dossier-evenement:not([hidden])[data-event="evt_854_rumbling"]');
  for (let i = 0; i < 40 && (await e59.count()) === 0; i++) {
    if ((await page.locator(".dossier-evenement:not([hidden])").count()) > 0) await page.locator('.dossier-evenement:not([hidden]) [data-action="differer"]').click();
    await page.keyboard.press("Digit3");
    await page.waitForTimeout(1500);
  }
  expect((await e59.count()) === 1, "Grondement : le dossier d'E59 s'ouvre de lui-même");
  await page.screenshot({ path: `${OUT}/p9-grondement-e59.png` });
  const divergent = page.locator('.choix[data-choice="empecher"]');
  await divergent.locator('[data-action="signer"]').click();
  await page.waitForSelector(".choix__divergence");
  const warn = await page.locator(".choix__divergence").innerText();
  expect(/écart \+/.test(warn) && /Hange/.test(warn) && /Bataille du Ciel/.test(warn), `divergence avertie : « ${warn.replace(/\s+/g, " ").slice(0, 160)}… »`);
  await divergent.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${OUT}/p9-divergence.png` });
  await page.locator('[data-action="revenir"]').click();
  expect((await page.locator(".choix__divergence").count()) === 0, "« Revenir au dossier » referme l'avertissement");
  await divergent.locator('[data-action="signer"]').click();
  await page.locator('[data-action="signer-divergence"]').click();
  await page.waitForSelector(".fin-campagne", { timeout: 30000 });
  const end = await page.locator(".fin-campagne").innerText();
  const issue = await page.locator(".fin-campagne").getAttribute("data-issue");
  expect(issue === "paix" && /Grondement n'a pas eu lieu/.test(end), `fin de campagne : ${issue} (« ${end.replace(/\s+/g, " ").slice(0, 120)}… »)`);
  await page.screenshot({ path: `${OUT}/p9-fin-campagne.png` });
  await page.locator('.fin-campagne [data-action="continuer"]').click();
  expect((await page.locator(".fin-campagne").count()) === 0, "« Continuer la partie » referme le dossier de fin");
  await page.close();
  expect(errors.length === 0, `aucune erreur de console (${errors.slice(0, 3).join(" | ")})`);
} finally {
  await browser.close();
  await server.close();
}
if (failures.length > 0) {
  console.error(`smoke:p9 : ${failures.length} échec(s).`);
  process.exit(1);
}
console.log("smoke:p9 : OK");
