// npm run smoke:p7 — AC7-02 et AC7-09 dans un vrai navigateur (Chromium, serveur de dev Vite) + captures docs/screenshots/p7-*.
// Parcours : dossier de choix de la nation ; 854 mené par Marley (registres de Paradis masqués, atlas du monde, province
// choisie, mouvement, projection du Bestial, levée, une semaine de front expliquée) ; chancellerie (relations, réponse prévue,
// garantie à Hizuru) ; 854 côté Paradis (onglet Monde) ; valeurs expliquées, aucune clé brute, 0 erreur console.
import { mkdirSync } from "node:fs";
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

async function audit(page: Page, scope: string, label: string): Promise<void> {
  const unexplained = await page.$$eval(`${scope} .valeur`, (els) => els.filter((e) => !(e as HTMLElement).dataset["why"]).length);
  const count = await page.locator(`${scope} .valeur`).count();
  const visible = await page.locator(scope).innerText();
  const raw = Object.keys(fr).filter((k) => k.includes(".") && visible.includes(k));
  const ids = [...new Set(visible.match(/\b(prov|char|org|str|evt|tech|secret|agent|rap|shifter|ttype|tmap|wprov|fac|form)_[a-z0-9_]+/g) ?? [])];
  expect(unexplained === 0 && raw.length === 0 && ids.length === 0, `${label} : ${count} valeurs, toutes expliquées ; aucune clé ni identifiant brut${raw.length || ids.length ? ` (${[...raw, ...ids].slice(0, 5).join(", ")})` : ""}`);
}

async function console_(page: Page, line: string, expectText: string): Promise<void> {
  await page.keyboard.press("F2");
  await page.locator(".debug-console input").fill(line);
  await page.keyboard.press("Enter");
  await page.waitForFunction((s) => document.querySelector(".debug-console__log")?.textContent?.includes(s), expectText, { timeout: 120000 });
  await page.keyboard.press("F2");
}

/** Clic sur une province de l'atlas (mêmes calculs que atlasView). */
async function pick(page: Page, at: [number, number]): Promise<void> {
  const box = await page.locator(".atlas-monde").boundingBox();
  if (!box) throw new Error("atlas absent");
  const s = Math.min(box.width / 1000, box.height / 960);
  const ox = (box.width - 1000 * s) / 2 + 10 * s;
  const oy = (box.height - 960 * s) / 2 - 20 * s;
  await page.mouse.click(box.x + ox + at[0] * s, box.y + oy + at[1] * s);
  await page.waitForTimeout(250);
}

const server = await createServer({ server: { port: 5184, strictPort: false }, logLevel: "error" });
await server.listen();
const url = server.resolvedUrls?.local[0] ?? "http://localhost:5184/";
const browser = await chromium.launch({ executablePath });

try {
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const errors: string[] = [];
  page.on("console", (m) => {
    if ((m.type() === "error" || m.type() === "warning") && !isDriverNoise(m.text())) errors.push(`${m.type()}: ${m.text()}`);
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));

  // ——— Choix de la nation ———
  console.log("[scénario 854] 1366×768");
  await page.goto(`${url}?scenario=scn_854&dossiers=0`);
  await page.waitForSelector(".choix-nation", { timeout: 90000 });
  const dossiers = await page.locator(".choix-nation__dossier").count();
  expect(dossiers === 2, `dossier de choix de la nation : ${dossiers} nations jouables (Paradis, Marley)`);
  await page.locator(".choix-nation").screenshot({ path: `${OUT}/p7-choix-nation.png` });
  await page.locator('.choix-nation__dossier[data-nation="fac_marley"]').click();
  await page.waitForSelector("html[data-ready='true']", { timeout: 90000 });
  await page.waitForSelector('.registre-panneau[data-panel="monde"]:not([hidden])');
  await page.waitForFunction(() => document.querySelector(".atlas-monde")?.getAttribute("data-drawn") === "61");
  const buttons = await page.locator(".bandeau__registre-bouton:visible").allInnerTexts();
  expect(buttons.length === 8 && !buttons.some((b) => /Cabinet|Décrets/i.test(b)), `Marley : table de guerre ouverte, atlas de 61 provinces ; registres de Paradis masqués (${buttons.join(", ")})`);
  const ledger = await page.locator(".table-guerre__comptes").innerText();
  expect(ledger.includes("Marley") && ledger.includes(fr["world.industry"]), `comptes de la nation jouée : « ${ledger.slice(0, 90)}… »`);

  // ——— Province, mouvement, projection, levée ———
  await pick(page, [470, 640]);
  expect((await page.getAttribute(".table-guerre__dossier h3", "data-province")) === "wprov_fort_slava", "atlas : Fort Slava choisie au clic");
  await page.selectOption('select[data-move="form_infanterie_ligne"]', "wprov_forteresse_passage");
  await page.locator('.force[data-formation="form_infanterie_ligne"] [data-action="deplacer"]').click();
  await page.waitForTimeout(400);
  await page.locator('[data-action="lever"]').click();
  await page.waitForTimeout(300);
  const order = await page.locator(".table-guerre__dossier").innerText();
  expect(order.includes("En levée"), "levée ordonnée à Fort Slava (date de fin affichée)");
  await pick(page, [420, 720]);
  const forteresse = await page.getAttribute(".table-guerre__dossier h3", "data-province");
  const ours = await page.locator('.force--fac_marley[data-formation="form_infanterie_ligne"]').count();
  expect(forteresse === "wprov_forteresse_passage" && ours === 1, "infanterie de Marley entrée dans la Forteresse du Passage (Alliés)");
  await page.locator('.table-guerre__titans li[data-shifter="shifter_bestial"] [data-action="projeter"]').click();
  await page.locator('[data-confirm="oui"]').click();
  await page.waitForTimeout(400);
  expect((await page.locator('.table-guerre__titans li[data-shifter="shifter_bestial"]').innerText()).includes(fr["world.recall"]), "Bestial projeté sur la Forteresse (bordereau signé), rappel possible");
  await page.keyboard.press("Escape");
  await console_(page, "advance 7", "7");
  await page.keyboard.press("KeyW");
  await page.waitForSelector('.registre-panneau[data-panel="monde"]:not([hidden])');
  await page.waitForTimeout(300);
  const fronts = await page.locator(".table-guerre__fronts li").count();
  await page.locator(".table-guerre__fronts li .valeur >> nth=0").focus();
  await page.waitForTimeout(150);
  const why = await page.locator(".pourquoi").innerText();
  expect(fronts >= 1 && why.includes("Titan projeté"), `une semaine de front : ${fronts} rapport(s) ; puissance d'attaque expliquée, Titan compris`);
  await audit(page, ".registre-panneau", "table de guerre (Marley)");
  await page.screenshot({ path: `${OUT}/p7-table-guerre.png` });

  // ——— Chancellerie ———
  await page.keyboard.press("KeyD");
  await page.waitForSelector('.registre-panneau[data-panel="diplomatie"]:not([hidden])');
  const nations = await page.locator(".fiche-nation").count();
  const lean0 = await page.locator(".chancellerie__hizuru .valeur").innerText();
  await page.locator('[data-action="garantie"]').click();
  await page.waitForTimeout(300);
  const lean1 = await page.locator(".chancellerie__hizuru .valeur").innerText();
  expect(nations === 3 && lean1 !== lean0, `chancellerie : 3 nations ; garantie à Hizuru (penchant ${lean0} → ${lean1})`);
  // Phase UI : liste des nations et fiche de la nation choisie (maître-détail) ; on choisit Hizuru, puis sa réponse prévue.
  await page.locator('.fiche-nation[data-nation="fac_hizuru"]').click();
  await page.locator('.chancellerie__detail .plan-ligne .valeur').focus();
  await page.waitForTimeout(150);
  expect((await page.locator(".pourquoi").innerText()).includes(fr["why.dip_trust"].split(" (")[0] ?? ""), "réponse prévue d'Hizuru expliquée (confiance, intérêt…)");
  await audit(page, ".registre-panneau", "chancellerie (Marley)");
  await page.locator(".registre-panneau").screenshot({ path: `${OUT}/p7-chancellerie.png` });

  // ——— Côté Paradis ———
  const p2 = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  p2.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  p2.on("console", (m) => {
    if ((m.type() === "error" || m.type() === "warning") && !isDriverNoise(m.text())) errors.push(`${m.type()}: ${m.text()}`);
  });
  await p2.goto(`${url}?scenario=scn_854&faction=fac_paradis&dossiers=0`);
  await p2.waitForSelector("html[data-ready='true']", { timeout: 90000 });
  const pb = await p2.locator(".bandeau__registre-bouton:visible").count();
  await p2.keyboard.press("KeyW");
  await p2.waitForSelector('.registre-panneau[data-panel="monde"]:not([hidden])');
  await p2.waitForFunction(() => document.querySelector(".atlas-monde")?.getAttribute("data-drawn") === "61");
  const pl = await p2.locator(".table-guerre__comptes").innerText();
  expect(pb === 17 && pl.includes("Paradis"), `Paradis en 854 : ${pb} registres (dont Monde et Chancellerie), comptes de Paradis au monde`);
  await audit(p2, ".registre-panneau", "table de guerre (Paradis)");
  await p2.screenshot({ path: `${OUT}/p7-paradis-monde.png` });

  expect(errors.length === 0, `0 erreur console${errors.length ? ` (${errors.slice(0, 3).join(" | ")})` : ""}`);
} finally {
  await browser.close();
  await server.close();
}

if (failures.length) {
  console.error(`smoke:p7 : ÉCHEC (${failures.length})`);
  process.exit(1);
}
console.log("smoke:p7 : tout est conforme.");
