// npm run smoke:p6 — AC6-09 dans un vrai navigateur (Chromium, serveur de dev Vite) + captures docs/screenshots/p6-*.
// Parcours : registre « Porteurs » au 1er jour (porteurs cachés tant que leur secret n'est pas percé, horloges expliquées,
// capacités en fiches) ; une année en Canon fidèle (E42 : Armin hérite du Colossal) ; héritage préparé avec ses coûts
// prévus et sa raison de refus ; retrait du service ; bataille d'essai contre le Cuirassé, lances de foudre ; 0 erreur console.
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

/** Valeurs expliquées, aucune clé ni identifiant brut dans un conteneur. */
async function audit(page: Page, scope: string, label: string): Promise<void> {
  const unexplained = await page.$$eval(`${scope} .valeur`, (els) => els.filter((e) => !(e as HTMLElement).dataset["why"]).length);
  const count = await page.locator(`${scope} .valeur`).count();
  const visible = await page.locator(scope).innerText();
  const raw = Object.keys(fr).filter((k) => k.includes(".") && visible.includes(k));
  const ids = [...new Set(visible.match(/\b(prov|char|org|str|evt|tech|secret|agent|rap|shifter|ttype|tmap)_[a-z0-9_]+/g) ?? [])];
  expect(unexplained === 0 && raw.length === 0 && ids.length === 0, `${label} : ${count} valeurs, toutes expliquées ; aucune clé ni identifiant brut${raw.length || ids.length ? ` (${[...raw, ...ids].slice(0, 5).join(", ")})` : ""}`);
}

async function console_(page: Page, line: string, expectText: string): Promise<void> {
  await page.keyboard.press("F2");
  await page.locator(".debug-console input").fill(line);
  await page.keyboard.press("Enter");
  await page.waitForFunction((s) => document.querySelector(".debug-console__log")?.textContent?.includes(s), expectText, { timeout: 120000 });
  await page.keyboard.press("F2");
}

async function openShifters(page: Page): Promise<void> {
  if (!(await page.locator('.registre-panneau[data-panel="porteurs"]:not([hidden])').count())) await page.keyboard.press("KeyT");
  await page.waitForSelector('.registre-panneau[data-panel="porteurs"]:not([hidden])');
  await page.waitForTimeout(200);
}

const card = (id: string): string => `.porteur[data-shifter="${id}"]`;

const server = await createServer({ server: { port: 5183, strictPort: false }, logLevel: "error" });
await server.listen();
const url = server.resolvedUrls?.local[0] ?? "http://localhost:5183/";
const browser = await chromium.launch({ executablePath });

try {
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const errors: string[] = [];
  page.on("console", (m) => {
    if ((m.type() === "error" || m.type() === "warning") && !isDriverNoise(m.text())) errors.push(`${m.type()}: ${m.text()}`);
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  // Dossiers d'événement non ouverts d'eux-mêmes : les choix historiques s'appliquent à l'échéance.
  await page.goto(`${url}?dossiers=0`);
  await page.waitForSelector("html[data-ready='true']", { timeout: 60000 });
  await page.waitForTimeout(400);
  console.log("[scénario 850, Canon fidèle] 1366×768");
  expect((await page.locator(".bandeau__registre-bouton[data-panel='porteurs']").count()) === 1, "bandeau : registre Porteurs (T)");

  // ——— Registre au 1er jour ———
  await openShifters(page);
  const cards = await page.locator(".porteur").count();
  const abilities = await page.locator(".porteur__capacite").count();
  expect(cards === 9 && abilities === 16, `9 fiches de Titans, ${abilities} capacités en fiches (coût, portée, délai, recharge)`);
  const unknown = await page.locator(`${card("shifter_cuirasse")}:has-text("${fr["shifters.unknown_holder"]}")`).count();
  const erenHidden = await page.locator(`${card("shifter_assaillant")}:has-text("Eren")`).count();
  expect(unknown === 1 && erenHidden === 0, "porteurs cachés tant que leur secret n'est pas percé (Cuirassé, Assaillant)");
  const marley = await page.locator(`${card("shifter_bestial")}:has-text("${fr["shifters.held_by.marley"]}")`).count();
  expect(marley === 1, "Bestial : tenu par Marley, porteur non identifié (aucun nom inventé)");
  await page.locator(`${card("shifter_bestial")} .porteur__horloge .valeur`).focus();
  await page.waitForTimeout(150);
  const why = await page.locator(".pourquoi").innerText();
  expect((await page.locator(".pourquoi").isVisible()) && why.includes("13") && why.includes("842"), "horloge des 13 ans expliquée (Bestial : 13 − années depuis 842)");
  await audit(page, ".registre-panneau", "registre Porteurs, 1er jour");
  await page.locator(".registre-panneau").screenshot({ path: `${OUT}/p6-porteurs-850.png` });

  // ——— Une année : E12 révèle Eren, E27 les guerriers, E42 transmet le Colossal ———
  await page.keyboard.press("Escape");
  await console_(page, "advance 360", "360");
  await openShifters(page);
  const armin = await page.locator(`${card("shifter_colossal")}:has-text("Armin Arlert")`).count();
  const clock = await page.getAttribute(`${card("shifter_colossal")} .porteur__horloge`, "data-clock");
  // Hérité en 850 ; après 360 jours on est au 1er jour de 851 : 13 − (851 − 850) = 12 ans.
  expect(armin === 1 && clock === "12", `E42 : Armin Arlert porte le Colossal (hérité en 850), horloge au 1er jour de 851 : ${clock ?? "—"} ans`);
  const record = await page.locator(`.porteur__dossiers li:has-text("Armin Arlert")`).count();
  expect(record >= 1, "dossier d'héritage : Armin hérite en dévorant Bertholdt, coûts consignés");
  const eren = await page.locator(`${card("shifter_assaillant")}:has-text("Eren")`).count();
  expect(eren === 1, "Eren révélé (E12) : porteur de l'Assaillant au service de Paradis");

  // ——— Héritage préparé : coûts prévus, refus expliqué (plus de sérum après E42) ———
  const box = `${card("shifter_assaillant")} .porteur__heritage`;
  const costLines = await page.locator(`${box} .porteur__couts li`).count();
  const refusal = await page.locator(`${box} .plan-probleme`).innerText().catch(() => "");
  const disabled = await page.locator(`${box} [data-action="heriter"]`).isDisabled();
  expect(costLines >= 5 && refusal.includes(fr["shifter.err.no_serum"]) && disabled, `héritage préparé : ${costLines} coûts prévus (dévoré, sérum, horloge, stress, loyauté, légitimité), refus expliqué : « ${refusal} »`);
  await page.locator(box).screenshot({ path: `${OUT}/p6-heritage.png` });

  // ——— Retrait du service ———
  await page.locator(`${card("shifter_assaillant")} [data-action="retirer"]`).click();
  await page.waitForSelector(`${card("shifter_assaillant")}:has-text("${fr["shifters.retired"]}")`);
  expect((await page.locator(`${card("shifter_assaillant")} [data-action="rappeler"]`).count()) === 1, "Eren retiré du service (le bouton propose de le rappeler)");
  await audit(page, ".registre-panneau", "registre Porteurs, fin 850");
  await page.locator(".registre-panneau").screenshot({ path: `${OUT}/p6-porteurs-851.png` });

  // ——— Bataille d'essai : le Cuirassé contre 18 soldats armés de lances de foudre ———
  await page.selectOption('select[data-trial="shifter"]', "shifter_cuirasse");
  await page.selectOption('select[data-trial="side"]', "ennemi");
  await page.selectOption('select[data-trial="map"]', "tmap_foret");
  await page.check('input[data-trial="spears"]');
  await page.locator('[data-action="essai-porteur"]').click();
  await page.waitForSelector(".bataille canvas", { timeout: 30000 });
  await page.locator('.bataille-vitesse[data-speed="2"]').click();
  await page.waitForFunction((s) => document.querySelector(".bataille")?.textContent?.includes(s), fr["battle.shifter.transformed"].split("{")[0] ?? "", { timeout: 60000 }).catch(() => undefined);
  await page.waitForTimeout(6000);
  const text = await page.locator(".bataille").innerText();
  expect(text.includes("se transforme") && text.includes(fr["shifter.cuirasse"]), "bataille d'essai : le porteur se transforme (journal), Titan Cuirassé nommé");
  await audit(page, ".bataille", "écran de bataille avec porteur");
  await page.screenshot({ path: `${OUT}/p6-bataille-porteur.png` });
  await page.waitForSelector(".bilan", { timeout: 240000 });
  const bilan = await page.locator(".bilan").innerText();
  expect(bilan.length > 0, "bataille d'essai menée jusqu'au bilan");
  await audit(page, ".bilan", "bilan de la bataille avec porteur");
  await page.locator('.bilan [data-action="valider"]').click();
  await page.waitForFunction(() => !document.querySelector(".bataille"));

  expect(errors.length === 0, `0 erreur console${errors.length ? ` (${errors.slice(0, 3).join(" | ")})` : ""}`);
} finally {
  await browser.close();
  await server.close();
}

if (failures.length) {
  console.error(`smoke:p6 : ÉCHEC (${failures.length})`);
  process.exit(1);
}
console.log("smoke:p6 : tout est conforme.");
