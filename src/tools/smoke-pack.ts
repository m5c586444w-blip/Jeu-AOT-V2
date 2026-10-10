// npm run smoke:pack — PACK.5 (CPACK-03) : l'application de bureau, lancée hors navigateur, charge le menu et se joue.
// Prérequis : `npm run package:win -- --plateforme linux` (même emballage que pour Windows, construit pour Linux). L'application
// est lancée par Playwright (mode Electron) dans un écran virtuel (Xvfb) ; contrôles : fenêtre titrée, menu principal et
// scénarios, partie de 850 démarrée, sauvegarde et rechargement (IndexedDB du profil), manuel (F1), aucune requête hors du
// protocole local `jeu://`. Captures : docs/screenshots/pack-*.png. Sous Windows, ce contrôle reste à faire à la main.
import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { _electron } from "playwright-core";

const APP_DIR = join("release", "Murs et Sang-linux-x64");
const EXE = join(APP_DIR, "Murs et Sang");
const OUT = "docs/screenshots";
const failures: string[] = [];
const expect = (cond: boolean, label: string): void => {
  if (cond) console.log(`  OK  ${label}`);
  else {
    failures.push(label);
    console.error(`  KO  ${label}`);
  }
};

if (!existsSync(EXE)) {
  console.error(`smoke:pack : ${EXE} absent — lancer d'abord \`npm run package:win -- --plateforme linux\`.`);
  process.exit(1);
}
mkdirSync(OUT, { recursive: true });

// Écran virtuel si aucun affichage n'est disponible (cloud).
let xvfb: ChildProcess | null = null;
const env: Record<string, string> = Object.fromEntries(Object.entries(process.env).filter((e): e is [string, string] => e[1] !== undefined));
if (!env["DISPLAY"]) {
  xvfb = spawn("Xvfb", [":97", "-screen", "0", "1366x768x24", "-nolisten", "tcp"], { stdio: "ignore" });
  env["DISPLAY"] = ":97";
  await new Promise((r) => setTimeout(r, 1500));
}

// Profil neuf (sauvegardes) pour que le contrôle ne dépende d'aucune partie précédente.
const profile = mkdtempSync(join(tmpdir(), "murs-et-sang-pack-"));
// Exécuté en root dans le cloud : le bac à sable de Chromium l'interdit, d'où --no-sandbox (pour ce contrôle seulement).
const app = await _electron.launch({ executablePath: EXE, args: ["--no-sandbox", `--user-data-dir=${profile}`], env });
const requests: string[] = [];
const errors: string[] = [];
try {
  const win = await app.firstWindow();
  win.on("request", (r) => requests.push(r.url()));
  win.on("pageerror", (e) => errors.push(e.message));
  win.on("console", (m) => {
    if (m.type() === "error" && !/GL Driver Message|GPU stall/.test(m.text())) errors.push(m.text());
  });
  await win.waitForSelector(".menu-principal", { timeout: 60000 });
  await win.evaluate(() => document.fonts.ready);
  const title = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.getTitle() ?? "");
  expect(/Murs et Sang/.test(title), `fenêtre : « ${title} »`);
  expect(win.url().startsWith("jeu://local/"), `jeu servi par le protocole local (${win.url()})`);
  await win.locator('.menu-entree[data-entree="nouvelle"]').click();
  const cards = await win.locator(".menu-scenarios .chemise").count();
  expect(cards >= 4, `menu principal : ${cards} scénarios`);
  await win.screenshot({ path: `${OUT}/pack-menu.png` });

  // Partie de 850 : chargement, temps, sauvegarde et rechargement.
  await win.locator(".menu-scenarios .chemise").nth(1).click();
  await win.waitForSelector("html[data-ready='true']", { timeout: 120000 });
  await win.evaluate(() => document.fonts.ready);
  expect(win.url().startsWith("jeu://local/"), `partie ouverte dans l'application (${win.url().replace(/^jeu:\/\/local/, "")})`);
  const line = async (cmd: string, wanted: string): Promise<boolean> => {
    await win.keyboard.press("F2");
    await win.locator(".debug-console input").fill(cmd);
    await win.keyboard.press("Enter");
    const ok = await win
      .waitForFunction((s) => document.querySelector(".debug-console__log")?.textContent?.includes(s), wanted, { timeout: 120000 })
      .then(() => true)
      .catch(() => false);
    await win.keyboard.press("F2");
    return ok;
  };
  await win.keyboard.press("Escape");
  expect(await line("advance 10", "+10 jours"), "partie : le temps avance");
  expect(await line("save pack", "sauvegardé dans « pack »"), "sauvegarde dans le profil (IndexedDB)");
  expect(await line("load pack", "« pack » rechargé"), "rechargement de la sauvegarde");
  await win.keyboard.press("F1");
  expect(await win.locator(".manuel:not([hidden])").isVisible(), "manuel (F1)");
  await win.keyboard.press("Escape");
  // Dossiers d'événement ouverts (brèche de Trost…) : différés, pour que la capture montre la carte.
  for (let i = 0; i < 5 && (await win.locator(".dossier-evenement:not([hidden])").count()) > 0; i++) {
    await win.locator('.dossier-evenement [data-action="differer"]').click();
    await win.waitForTimeout(300);
  }
  await win.waitForTimeout(800);
  await win.screenshot({ path: `${OUT}/pack-partie.png` });
} finally {
  await app.close();
  xvfb?.kill();
}

const outside = requests.filter((u) => !/^(jeu|data|blob):/.test(u));
expect(outside.length === 0, `aucune requête hors du protocole local (${requests.length} requêtes${outside.length ? ` ; ${outside.slice(0, 3).join(", ")}` : ""})`);
expect(errors.length === 0, `aucune erreur de page (${errors.length}${errors.length ? ` : ${errors.slice(0, 3).join(" | ")}` : ""})`);
console.log(failures.length === 0 ? "smoke:pack : OK" : `smoke:pack : ${failures.length} échec(s)`);
process.exitCode = failures.length === 0 ? 0 : 1;
