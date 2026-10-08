// npm run smoke:chr — CHR.3 / CHR.4 dans un vrai navigateur (Chromium, serveur de dev Vite) : frise « Chronologie » (850 après
// 120 jours, 854 en 1366×768 et 3840×2160), filtre par thème, fiche d'un repère, faits du quotidien, dossier d'événement avec son
// illustration et l'infobulle de ses effets. Aucune mention interne (src/ui/leaks.ts). Captures : docs/screenshots/chr-*.png.
import { mkdirSync } from "node:fs";
import { chromium } from "playwright-core";
import type { Page } from "playwright-core";
import { createServer } from "vite";
import { findLeaks } from "../ui/leaks";

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

async function leaks(page: Page, name: string): Promise<void> {
  const text = await page.evaluate(() => {
    const why = [...document.querySelectorAll<HTMLElement>("[data-why]")].filter((e) => e.offsetParent !== null && !e.closest(".auteur-seul")).map((e) => e.dataset["why"] ?? "");
    return `${document.body.innerText}\n${why.join("\n")}`;
  });
  const found = findLeaks(text);
  expect(found.length === 0, `${name} : aucune mention interne${found.length ? ` — ${found.slice(0, 4).map((l) => `${l.pattern} « ${l.excerpt} »`).join(" ; ")}` : ""}`);
}

async function console_(page: Page, line: string): Promise<void> {
  await page.keyboard.press("F2");
  await page.locator(".debug-console input").fill(line);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(400);
  await page.keyboard.press("F2");
}

async function start(page: Page, url: string, query: string): Promise<void> {
  await page.goto(`${url}?${query}`);
  await page.waitForSelector("html[data-ready='true'] .bandeau", { timeout: 120000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
}

async function openChronology(page: Page): Promise<void> {
  await page.keyboard.press("KeyH");
  await page.waitForSelector('.registre-panneau[data-panel="chronique"]:not([hidden]) .frise', { timeout: 20000 });
  await page.waitForTimeout(250);
}

const server = await createServer({ server: { port: 5192, strictPort: false }, logLevel: "error" });
await server.listen();
const url = server.resolvedUrls?.local[0] ?? "http://localhost:5192/";
const browser = await chromium.launch({ executablePath, args: ["--autoplay-policy=no-user-gesture-required"] });
const errors: string[] = [];
try {
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  await page.addInitScript("window.__name = (f) => f;");
  page.on("pageerror", (e) => errors.push(e.message));

  // 845 : bac à sable économique, sans couche d'événements.
  await start(page, url, "scenario=scn_sandbox_845");
  expect((await page.locator(".bandeau__registre-bouton[data-panel='chronique']").count()) === 0, "845 (bac à sable économique) : pas de chronologie, comme il n'a pas d'événements");

  // 850 : après 120 jours.
  await start(page, url, "scenario=scn_sandbox_850&dossiers=0");
  await console_(page, "advance 120");
  await openChronology(page);
  const panel = page.locator('.registre-panneau[data-panel="chronique"]');
  const markers = await page.locator(".frise__repere:not(.frise__repere--legende)").count();
  const years = await page.locator(".frise__annee").count();
  expect(years === 10, `850 : l'axe compte ${years} années (845 à 854)`);
  expect(markers >= 15, `850 : ${markers} repères sur la frise`);
  expect((await page.locator(".chronique-liste li[data-event]").count()) >= 15, "850 : la liste montre les événements survenus");
  expect((await page.locator(".frise__legende").innerText()).includes("Écart au récit connu"), "850 : légende avec l'écart au récit connu");
  expect((await page.locator(".frise-fiche__titre").count()) === 1, "850 : une fiche est ouverte");
  await leaks(page, "850 · chronologie");
  await panel.screenshot({ path: `${OUT}/chr-frise-850.png` });
  const before = await page.locator(".frise-fiche__titre").innerText();
  const second = page.locator(".chronique-liste li[data-event]").nth(2);
  await second.click();
  await page.waitForTimeout(200);
  const after = await page.locator(".frise-fiche__titre").innerText();
  expect(after !== before, `850 : choisir une ligne change la fiche (« ${before} » → « ${after} »)`);
  const rowsAll = await page.locator(".chronique-liste li[data-event]").count();
  await page.locator('.frise__themes [data-theme="titans"]').click();
  await page.waitForTimeout(200);
  const rowsTitans = await page.locator(".chronique-liste li[data-event]").count();
  const nonTitans = await page.locator('.chronique-liste li[data-event]:not([data-theme="titans"])').count();
  expect(rowsTitans > 0 && rowsTitans < rowsAll && nonTitans === 0, `850 : filtre Titans, ${rowsTitans} lignes sur ${rowsAll}, aucune d'un autre thème`);
  await page.locator('.frise__themes [data-theme="titans"]').click();
  await page.locator(".registre-panneau .onglet").nth(1).click();
  await page.waitForTimeout(250);
  const daily = await page.locator(".chronique-liste li[data-event]").count();
  expect(daily >= 14, `850 : ${daily} faits de la vie du royaume en 4 mois`);
  await leaks(page, "850 · vie du royaume");
  await panel.screenshot({ path: `${OUT}/chr-quotidien-850.png` });

  // Dossier d'événement (CHR.4).
  await start(page, url, "scenario=scn_sandbox_850");
  await console_(page, "advance 5");
  await page.waitForSelector(".dossier-evenement:not([hidden]) .dossier-evenement__illustration svg", { timeout: 20000 });
  const choices = await page.locator(".dossier-evenement .choix").count();
  expect(choices >= 2, `dossier : ${choices} choix, une illustration d'archétype`);
  await leaks(page, "850 · dossier d'événement");
  await page.locator(".dossier-evenement .choix").nth(1).hover();
  await page.waitForSelector(".pourquoi:not([hidden])", { timeout: 5000 });
  const tip = await page.locator(".pourquoi").innerText();
  expect(/tous les effets/i.test(tip) && (await page.locator(".pourquoi table tr").count()) >= 1, "dossier : l'infobulle d'un choix liste tous ses effets");
  await page.screenshot({ path: `${OUT}/chr-dossier.png` });

  // 854 : tout le récit.
  await start(page, url, "scenario=scn_854&faction=fac_paradis&dossiers=0");
  await openChronology(page);
  const first = await page.locator(".frise__repere:not(.frise__repere--legende)").count();
  expect(first >= 54 && first < 60, `854 au départ : ${first} repères (52 passés, E53 daté et les suivants annoncés)`);
  await page.keyboard.press("Escape");
  await console_(page, "advance 300");
  await openChronology(page);
  const all = await page.locator(".frise__repere:not(.frise__repere--legende)").count();
  expect(all === 60, `854 après 300 jours : les ${all} événements du récit sont sur la frise (60 attendus)`);
  expect((await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)) === true, "854 · 1366×768 : aucun défilement horizontal de la page");
  await leaks(page, "854 · chronologie 1366");
  await page.locator('.registre-panneau[data-panel="chronique"]').screenshot({ path: `${OUT}/chr-frise-854-1366.png` });
  await page.setViewportSize({ width: 3840, height: 2160 });
  await page.waitForTimeout(500);
  expect((await page.locator(".frise__repere:not(.frise__repere--legende)").count()) === 60, "854 · 3840×2160 : 60 repères");
  await page.screenshot({ path: `${OUT}/chr-frise-854-4k.png` });
} finally {
  await browser.close();
  await server.close();
}
const real = errors.filter((e) => !/GL Driver Message|GPU stall/.test(e));
expect(real.length === 0, `0 erreur de page${real.length ? ` : ${real.slice(0, 3).join(" | ")}` : ""}`);
if (failures.length > 0) {
  console.error(`smoke:chr : ${failures.length} échec(s).`);
  process.exit(1);
}
console.log("smoke:chr : OK.");
