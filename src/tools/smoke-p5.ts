// npm run smoke:p5 — AC5-03, AC5-10, AC5-13 dans un vrai navigateur (Chromium, serveur de dev Vite) + captures docs/screenshots/p5-*.
// Parcours : dossier d'événement ouvert de lui-même (coûts, tampons), différé puis rouvert depuis la chronique, choix non
// historique signé (divergence) ; salle de renseignement (recrutement, mission, rapports datés et annotés, mur des secrets) ;
// bureau d'études (étude lancée, verrous expliqués) ; calques Renseignement, Religion, Légitimité ; objectif « capture » grisé.
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
const isDriverNoise = (text: string): boolean => /GL Driver Message|GPU stall due to ReadPixels/.test(text);

/** Valeurs expliquées, aucune clé ni identifiant brut dans un conteneur. */
async function audit(page: Page, scope: string, label: string): Promise<void> {
  const unexplained = await page.$$eval(`${scope} .valeur`, (els) => els.filter((e) => !(e as HTMLElement).dataset["why"]).length);
  const count = await page.locator(`${scope} .valeur`).count();
  const visible = await page.locator(scope).innerText();
  const raw = Object.keys(fr).filter((k) => k.includes(".") && visible.includes(k));
  const ids = [...new Set(visible.match(/\b(prov|char|org|str|evt|tech|secret|agent|rap)_[a-z0-9_]+/g) ?? [])];
  expect(unexplained === 0 && raw.length === 0 && ids.length === 0, `${label} : ${count} valeurs, toutes expliquées ; aucune clé ni identifiant brut${raw.length || ids.length ? ` (${[...raw, ...ids].slice(0, 5).join(", ")})` : ""}`);
}

async function console_(page: Page, line: string, expectText: string): Promise<void> {
  await page.keyboard.press("F2");
  await page.locator(".debug-console input").fill(line);
  await page.keyboard.press("Enter");
  await page.waitForFunction((s) => document.querySelector(".debug-console__log")?.textContent?.includes(s), expectText, { timeout: 60000 });
  await page.keyboard.press("F2");
}

/** Signe le premier choix (historique pour un événement canon) de chaque dossier qui s'ouvre. */
async function settleDossiers(page: Page): Promise<number> {
  let n = 0;
  for (let i = 0; i < 20 && (await page.locator(".dossier-evenement:not([hidden])").count()) > 0; i++) {
    await page.locator('.dossier-evenement [data-action="signer"]').first().click();
    await page.waitForTimeout(250);
    n++;
  }
  return n;
}

async function panel(page: Page, key: string, id: string): Promise<void> {
  await settleDossiers(page);
  if (!(await page.locator(`.registre-panneau[data-panel="${id}"]:not([hidden])`).count())) await page.keyboard.press(key);
  await page.waitForSelector(`.registre-panneau[data-panel="${id}"]:not([hidden])`);
  await page.waitForTimeout(200);
}

const server = await createServer({ server: { port: 5182, strictPort: false }, logLevel: "error" });
await server.listen();
const url = server.resolvedUrls?.local[0] ?? "http://localhost:5182/";
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
  console.log("[scénario 850, Canon fidèle] 1366×768");
  expect((await page.locator(".bandeau__registre-bouton[data-panel='chronique']").count()) === 1 && (await page.locator(".bandeau__registre-bouton[data-panel='renseignement']").count()) === 1 && (await page.locator(".bandeau__registre-bouton[data-panel='recherche']").count()) === 1, "bandeau : registres Chronique (H), Renseignement (I), Bureau d'études (B)");

  // ——— Dossier d'événement (AC5-03) ———
  await console_(page, "advance 5", "5");
  // Un événement générique peut précéder E09 : on règle les autres dossiers jusqu'à celui de la remise des diplômes.
  for (let i = 0; i < 10; i++) {
    await page.waitForSelector(".dossier-evenement:not([hidden])", { timeout: 15000 });
    if ((await page.getAttribute(".dossier-evenement", "data-event")) === "evt_850_104th_graduation") break;
    await page.locator('.dossier-evenement [data-action="signer"]').first().click();
    await page.waitForTimeout(300);
    if (!(await page.locator(".dossier-evenement:not([hidden])").count())) await console_(page, "advance 1", "1");
  }
  const dossierEvt = await page.getAttribute(".dossier-evenement", "data-event");
  const historical = await page.locator(".dossier-evenement .choix__tampon--histoire").count();
  const diverges = await page.locator(".dossier-evenement .choix__tampon:not(.choix__tampon--histoire)").count();
  const costs = await page.locator(".dossier-evenement .choix .effet").count();
  expect(dossierEvt === "evt_850_104th_graduation" && historical === 1 && diverges === 2 && costs >= 4, `dossier E09 ouvert de lui-même : 3 choix, coûts affichés (${costs} lignes), un tampon « conforme à la chronique », deux écarts chiffrés`);
  const paused = await page.$$eval(".bandeau__vitesse", (els) => els.findIndex((e) => e.getAttribute("aria-pressed") === "true"));
  expect(paused === 0, "une décision due met le temps en pause");
  await audit(page, ".dossier-evenement", "dossier d'événement");
  await page.locator(".dossier-evenement__papier").screenshot({ path: `${OUT}/p5-dossier.png` });
  await page.locator('.dossier-evenement [data-action="differer"]').click();
  await page.waitForTimeout(200);
  expect(await page.locator(".dossier-evenement").isHidden(), "« Différer » referme le dossier sans décider");
  await panel(page, "KeyH", "chronique");
  expect((await page.locator(".chronique-attente[data-pending='evt_850_104th_graduation']").count()) === 1, "chronique : le dossier différé reste en attente, avec son échéance");
  await page.locator(".chronique-attente[data-pending='evt_850_104th_graduation'] [data-action='ouvrir-dossier']").click();
  await page.waitForSelector(".dossier-evenement:not([hidden])");
  await page.locator('.dossier-evenement .choix[data-choice="brigade"] [data-action="signer"]').click();
  await page.waitForTimeout(300);
  await panel(page, "KeyH", "chronique");
  await page.keyboard.press("KeyH");
  await panel(page, "KeyH", "chronique");
  const divergence = await page.locator(".chronique-jauge .valeur").first().innerText();
  expect(!divergence.startsWith("0 ") && (await page.locator(".chronique-liste .chronique-ecart").count()) >= 1, `choix non historique signé : divergence ${divergence}, écart inscrit à la chronique`);
  await audit(page, ".registre-panneau", "chronique");
  await page.locator(".registre-panneau").screenshot({ path: `${OUT}/p5-chronique.png` });

  // ——— Renseignement (AC5-07, AC5-10) ———
  await page.keyboard.press("Escape");
  await console_(page, "advance 40", "40");
  await panel(page, "KeyI", "renseignement");
  const agents = await page.locator(".fiche-agent").count();
  await page.locator("[data-action='recruter']").click();
  await page.waitForTimeout(300);
  await panel(page, "KeyI", "renseignement");
  expect((await page.locator(".fiche-agent").count()) === agents + 1, `recrutement : ${agents} → ${agents + 1} agents (capital dépensé)`);
  const first = page.locator(".fiche-agent").first();
  await first.locator("select[data-agent-op]").selectOption("surveiller");
  await page.waitForTimeout(200);
  await page.locator(".fiche-agent").first().locator("select[data-agent-target]").selectOption("prov_shiganshina");
  await page.locator(".fiche-agent").first().locator("[data-action='envoyer-agent']").click();
  await page.waitForTimeout(300);
  await panel(page, "KeyI", "renseignement");
  expect((await page.locator(".fiche-agent").first().innerText()).includes("En mission"), "agent envoyé surveiller Shiganshina");
  await page.keyboard.press("Escape");
  await console_(page, "advance 25", "25");
  await panel(page, "KeyI", "renseignement");
  const reports = await page.locator(".rapports li").count();
  const stamped = await page.locator(".rapports li .tampon-certitude").count();
  const checked = await page.locator(".rapports li .tampon-recoupement").count();
  expect(reports >= 1 && stamped === reports && checked === reports, `rapports reçus : ${reports}, chacun daté, avec certitude et état de recoupement`);
  expect((await page.locator(".fiche-secret").count()) >= 1, "mur des secrets : au moins un secret épinglé (Eren, révélé par E12)");
  await audit(page, ".registre-panneau", "salle de renseignement");
  await page.locator(".registre-panneau").screenshot({ path: `${OUT}/p5-renseignement.png` });

  // ——— Bureau d'études (AC5-05, AC5-10) ———
  await panel(page, "KeyB", "recherche");
  await page.locator(".registre-onglet[data-tree='odm']").click();
  await page.waitForTimeout(200);
  // Depuis UX0, une étude dont la mécanique n'existe pas encore (l'entretien d'ODM, P9) n'est plus montrée : on lance les
  // bouteilles de gaz compactes, disponibles au départ.
  await page.locator(".planche[data-tech='tech_compact_gas'] [data-action='etudier']").click();
  await page.waitForTimeout(300);
  await panel(page, "KeyB", "recherche");
  expect((await page.locator(".bureau-courant").innerText()).includes(fr["tech.tech_compact_gas"]), `étude lancée : ${fr["tech.tech_compact_gas"]} à l'étude`);
  await page.locator(".registre-onglet[data-tree='anti_titan']").click();
  await page.waitForTimeout(200);
  const spear = await page.locator(".planche[data-tech='tech_thunder_spear_prototype'] .plan-probleme").innerText().catch(() => "");
  // Condition écrite en langage de jeu (UX0 : plus de « N'existe pas encore »).
  expect(spear.startsWith("Exige") && !spear.includes("N'existe pas encore"), `verrou expliqué : lance de foudre — « ${spear.replace(/\s+/g, " ")} »`);
  await audit(page, ".registre-panneau", "bureau d'études");
  await page.locator(".registre-panneau").screenshot({ path: `${OUT}/p5-bureau.png` });
  await page.keyboard.press("Escape");

  // ——— Calques (AC5-06, AC5-10) ———
  for (const id of ["renseignement", "religion", "legitimite"]) {
    await settleDossiers(page);
    await page.locator(`button[data-overlay="${id}"]`).click();
    await page.waitForTimeout(400);
    const cases = await page.locator(".calques__case").count();
    expect(cases >= 4, `calque ${id} : légende (${cases} échelons)`);
    await page.locator(".carte").screenshot({ path: `${OUT}/p5-calque-${id}.png` });
  }
  await page.locator(`button[data-overlay="titans"]`).click();
  await page.waitForTimeout(300);
  expect((await page.locator(".calques__legende").innerText()).includes("inconnu"), "calque Titans : brouillard, « inconnu » pour les provinces jamais observées");

  // ——— Objectif « capture » (T-ANT-06) ———
  await panel(page, "KeyE", "expeditions");
  await page.locator("button[data-action='planifier']").click();
  await page.waitForSelector("select[data-plan='objectif']");
  const capture = await page.$eval("select[data-plan='objectif'] option[value='capture']", (o) => ({ disabled: (o as HTMLOptionElement).disabled, text: o.textContent ?? "" }));
  expect(capture.disabled && capture.text.includes("protocole"), `planificateur : objectif « capture » grisé, avec sa raison (« ${capture.text} »)`);

  expect(errors.length === 0, `0 erreur console${errors.length ? ` (${errors.slice(0, 3).join(" | ")})` : ""}`);
} finally {
  await browser.close();
  await server.close();
}
if (failures.length) {
  console.error(`smoke:p5 : ÉCHEC (${failures.length})`);
  process.exit(1);
}
console.log("smoke:p5 : tout est conforme.");
