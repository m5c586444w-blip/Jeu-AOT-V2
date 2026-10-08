// npm run smoke:politique — AC2-11 et AC2-14 dans un vrai navigateur (Chromium, serveur de dev Vite) + captures docs/screenshots/p2-*.
// Parcours : registres, fiche personnage, vote au Cabinet, décret confirmé, organisations, mort et nomination, conseil, journal.
// Navigateur : CHROMIUM_PATH ou /opt/pw-browsers/chromium.
import { mkdirSync } from "node:fs";
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
/** Nombre affiché à la française (« −0,2 », « +0,6 », « 1 234 ») → nombre. */
const parseFr = (text: string): number => Number(text.replace(/[\s\u00a0\u202f+]/g, "").replace("−", "-").replace(",", "."));
const isDriverNoise = (text: string): boolean => /GL Driver Message|GPU stall due to ReadPixels/.test(text);

// Décrets du parcours : un décret soumis au vote, un décret direct (moins coûteux que le capital de départ).
const VOTE_LAW = "law_exemptions_conscription";
const DIRECT_LAW = "law_exercices_garnison";
// Personnage de design [A] titulaire d'un rôle : sa mort ouvre une nomination.
const VICTIM = "char_wendel_sauer";

/** Toutes les valeurs affichées ont une fiche « pourquoi ? », aucune clé de traduction brute n'est visible. */
async function audit(page: Page, label: string): Promise<void> {
  const unexplained = await page.$$eval(".registre-panneau .valeur", (els) => els.filter((e) => !(e as HTMLElement).dataset["why"]).length);
  const count = await page.locator(".registre-panneau .valeur").count();
  const visible = await page.evaluate(() => document.body.innerText);
  const raw = Object.keys(fr).filter((k) => k.includes(".") && visible.includes(k));
  expect(unexplained === 0 && raw.length === 0, `${label} : ${count} valeurs, toutes expliquées ; aucune clé brute${raw.length ? ` (${raw.slice(0, 5).join(", ")})` : ""}`);
}

async function console_(page: Page, line: string, expectText: string): Promise<void> {
  await page.keyboard.press("F2");
  await page.locator(".debug-console input").fill(line);
  await page.keyboard.press("Enter");
  await page.waitForFunction((s) => document.querySelector(".debug-console__log")?.textContent?.includes(s), expectText, { timeout: 10000 });
  await page.keyboard.press("F2");
}

async function openPanel(page: Page, id: string): Promise<void> {
  await page.locator(`.bandeau__registre-bouton[data-panel="${id}"]`).click();
  await page.waitForSelector(`.registre-panneau[data-panel="${id}"]:not([hidden])`);
  await page.waitForTimeout(120);
}

const server = await createServer({ server: { port: 5177, strictPort: false }, logLevel: "error" });
await server.listen();
const url = server.resolvedUrls?.local[0] ?? "http://localhost:5177/";
const browser = await chromium.launch({ executablePath });

try {
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const errors: string[] = [];
  page.on("console", (m) => {
    if ((m.type() === "error" || m.type() === "warning") && !isDriverNoise(m.text())) errors.push(`${m.type()}: ${m.text()}`);
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  // Non-régression (P5) : pas d'ouverture automatique des dossiers d'événements, qui couvriraient les registres testés.
  await page.goto(`${url}?dossiers=0`);
  await page.waitForSelector("html[data-ready='true']", { timeout: 30000 });
  await page.waitForTimeout(400);
  console.log("[scénario 850] 1366×768");

  // 6 registres de P2 + « Expéditions » (P3) + « Chronique », « Renseignement », « Bureau d'études » (P5).
  expect((await page.locator(".bandeau__registre-bouton").count()) === 15, "menu de gestion : 15 registres (P2 + Expéditions + P5 + Porteurs + Gazette, Archives, Épilogue + Économie)");
  await page.screenshot({ path: `${OUT}/p2-ecran.png` });

  // Un mois passe : capital, propositions du conseil, entrées de journal.
  await console_(page, "advance 40", "40");

  // ——— Personnages ———
  await page.keyboard.press("KeyC");
  await page.waitForSelector('.registre-panneau[data-panel="personnages"]:not([hidden])');
  const rows = await page.locator(".registre-panneau .lien-dossier").count();
  expect(rows >= 30, `registre des personnages (touche C) : ${rows} personnages vivants`);
  await audit(page, "personnages");
  await page.screenshot({ path: `${OUT}/p2-personnages.png` });
  await page.locator(".registre-panneau .lien-dossier", { hasText: "Erwin Smith" }).first().click();
  await page.waitForSelector(".fiche-nom");
  expect((await page.locator(".fiche-nom").innerText()) === "Erwin Smith" && (await page.locator(".fiche-portrait svg").count()) === 1, "fiche d'Erwin Smith avec portrait procédural");
  expect((await page.locator(".fiche-attributs tr").count()) >= 12, "fiche : 12 attributs");
  await audit(page, "fiche personnage");
  await page.locator(".fiche-attributs .valeur >> nth=0").hover();
  await page.waitForTimeout(150);
  expect(await page.locator(".pourquoi").isVisible(), "attribut : fiche « pourquoi ? » au survol");
  await page.screenshot({ path: `${OUT}/p2-fiche.png` });
  await page.mouse.move(5, 300);

  // ——— Cabinet : motion, prévision, soumission confirmée ———
  await openPanel(page, "cabinet");
  await page.selectOption("select[data-motion]", VOTE_LAW);
  await page.waitForSelector(".cabinet-detail");
  // Une bille par membre votant (rôles siégeant au Cabinet + sièges invités, hors joueur).
  const balls = await page.locator(".cabinet-plan circle[r='8']").count();
  const voters = await page.locator(".cabinet-detail table tr").count();
  expect(balls >= 5 && balls === voters, `salle du Cabinet : ${balls} billes de vote prévues pour ${voters} membres`);
  await audit(page, "Cabinet");
  // AC2-11 (libellé révisé, D-48) : la fiche « pourquoi ? » de chaque membre a ≥ 1 ligne, au moins un membre en a ≥ 2,
  // et la somme des facteurs affichés égale le score affiché (à l'arrondi d'affichage près).
  const scores = page.locator(".cabinet-detail table .valeur");
  const nScores = await scores.count();
  const rowCounts: number[] = [];
  const sumErrors: string[] = [];
  for (let i = 0; i < nScores; i++) {
    const score = scores.nth(i);
    await score.focus();
    await page.waitForTimeout(80);
    const shown = parseFr(await score.innerText());
    const factors = (await page.locator(".pourquoi tr .pourquoi__valeur").allInnerTexts()).map(parseFr);
    rowCounts.push(factors.length);
    const sum = factors.reduce((a, b) => a + b, 0);
    // Chaque valeur affichée est arrondie à 0,005 près : tolérance = demi-unité × (lignes + 1).
    if (Math.abs(sum - shown) > 0.005 * (factors.length + 1) + 1e-9) sumErrors.push(`membre ${i + 1} : somme ${sum.toFixed(3)} ≠ score ${shown}`);
  }
  expect(nScores === voters && rowCounts.every((n) => n >= 1), `fiches « pourquoi ? » des ${nScores} membres : lignes ${rowCounts.join(", ")} (chacune ≥ 1)`);
  expect(rowCounts.some((n) => n >= 2), `au moins un membre a ≥ 2 facteurs (max ${Math.max(0, ...rowCounts)})`);
  expect(sumErrors.length === 0, `somme des facteurs = score affiché pour les ${nScores} membres${sumErrors.length ? ` (${sumErrors.join(" ; ")})` : ""}`);
  await scores.nth(rowCounts.indexOf(Math.max(...rowCounts))).focus();
  await page.waitForTimeout(80);
  await page.screenshot({ path: `${OUT}/p2-cabinet.png` });
  await page.mouse.move(5, 300);
  // « Annuler » ne change rien.
  await page.locator(".cabinet-detail .registre-bouton.principal").click();
  await page.locator("[data-confirm='non']").click();
  expect((await page.locator(".cabinet-dernier").count()) === 0, "bordereau : « Annuler » n'engage rien (F-UIX-12)");
  await page.locator(".cabinet-detail .registre-bouton.principal").click();
  expect(await page.locator(".bordereau").isVisible(), "bordereau de confirmation avant le vote (F-UIX-13)");
  await page.screenshot({ path: `${OUT}/p2-confirmation.png` });
  await page.locator("[data-confirm='oui']").click();
  await page.waitForSelector(".cabinet-dernier", { timeout: 5000 });
  const result = await page.locator(".cabinet-dernier").innerText();
  expect(/pour.*contre/.test(result), `vote tenu : « ${result} »`);

  // ——— Décrets : décret direct confirmé ———
  await openPanel(page, "decrets");
  await page.locator(`.decret[data-law="${DIRECT_LAW}"] .registre-bouton.principal`).click();
  await page.locator("[data-confirm='oui']").click();
  await page.waitForSelector(`.decret[data-law="${DIRECT_LAW}"] .decret-tampon`, { timeout: 5000 });
  ok("décret direct signé : tampon « en vigueur »");
  await audit(page, "décrets");
  await page.screenshot({ path: `${OUT}/p2-decrets.png` });

  // ——— Organisations : budget ———
  await openPanel(page, "organisations");
  expect((await page.locator(".registre-panneau table >> nth=0").locator("tr").count()) === 9, "8 organisations");
  await page.locator(".orgs-budget .registre-bouton >> nth=1").click();
  expect((await page.getByRole("button", { name: "Arrêter le budget" }).count()) === 1, "budget modifié : brouillon à arrêter");
  await page.getByRole("button", { name: "Arrêter le budget" }).click();
  await page.locator("[data-confirm='oui']").click();
  await page.waitForTimeout(200);
  await audit(page, "organisations et strates");
  await page.screenshot({ path: `${OUT}/p2-organisations.png` });

  // ——— Mort, dossier de décès, nomination ———
  await console_(page, `mort ${VICTIM} combat`, VICTIM);
  await openPanel(page, "personnages");
  await page.getByRole("button", { name: "Morts", exact: true }).click();
  await page.locator(".registre-panneau .lien-dossier").first().click();
  await page.waitForSelector(".fiche-deces");
  const consequences = await page.locator(".fiche-deces li").count();
  expect(consequences >= 2, `dossier de décès : ${consequences} conséquences`);
  await page.screenshot({ path: `${OUT}/p2-deces.png` });

  // ——— Conseil : avis biaisés, nomination ———
  await openPanel(page, "conseil");
  const advice = await page.locator(".conseil-avis tr").count();
  expect(advice === 18, `conseil : ${advice} rôles`);
  expect((await page.locator(".conseil-nomination").count()) >= 1, "poste vacant : nomination proposée");
  const candidates = await page.locator(".conseil-nomination tr").count();
  expect(candidates === 3, `nomination : ${candidates} candidats`);
  await audit(page, "conseil");
  await page.screenshot({ path: `${OUT}/p2-conseil.png` });
  await page.locator(".conseil-nomination .registre-bouton >> nth=0").click();
  await page.locator("[data-confirm='oui']").click();
  await page.waitForTimeout(200);
  expect((await page.locator(".conseil-nomination").count()) === 0, "nomination signée");

  // ——— Journal ———
  await page.keyboard.press("KeyJ");
  await page.waitForSelector('.registre-panneau[data-panel="journal"]:not([hidden])');
  const entries = await page.locator(".journal-liste li").count();
  expect(entries >= 3, `journal : ${entries} entrées`);
  await audit(page, "journal");
  await page.screenshot({ path: `${OUT}/p2-journal.png` });
  await page.keyboard.press("Escape");
  expect(await page.locator(".registre-panneau").isHidden(), "Échap ferme le registre");

  expect(errors.length === 0, `aucune erreur console${errors.length ? ` : ${errors.join(" | ")}` : ""}`);
  await page.close();
} finally {
  await browser.close();
  await server.close();
}

if (failures.length > 0) {
  console.error(`smoke:politique : ${failures.length} échec(s).`);
  process.exit(1);
}
console.log(`smoke:politique : OK (captures dans ${OUT}/).`);
