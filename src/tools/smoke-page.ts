// npm run smoke:page — ouvre la page de démarrage (serveur de dev Vite) dans Chromium, vérifie AC-19
// et enregistre des captures à 100 % et 125 %. Navigateur : CHROMIUM_PATH ou /opt/pw-browsers/chromium.
import { mkdirSync } from "node:fs";
import { chromium } from "playwright-core";
import { createServer } from "vite";

const executablePath = process.env["CHROMIUM_PATH"] ?? "/opt/pw-browsers/chromium";
const outDir = "docs/screenshots";
mkdirSync(outDir, { recursive: true });

const server = await createServer({ server: { port: 5174, strictPort: false }, logLevel: "error" });
await server.listen();
const url = server.resolvedUrls?.local[0] ?? "http://localhost:5174/";
const browser = await chromium.launch({ executablePath });
const failures: string[] = [];

try {
  for (const [label, scale, width, height] of [["100", 1, 1366, 768], ["125", 1.25, 1093, 614]] as const) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: scale });
    const errors: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error" || m.type() === "warning") errors.push(`${m.type()}: ${m.text()}`);
    });
    page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
    await page.goto(url);
    await page.waitForSelector("html[data-ready='true']", { timeout: 15000 });
    await page.evaluate(() => document.fonts.ready);

    const text = await page.locator("main.registre").innerText();
    for (const expected of ["Murs et Sang", "0.0.1", "42", "an 845, jour 1"]) {
      if (!text.includes(expected)) failures.push(`[${label}%] texte attendu absent : ${expected}`);
    }
    const hash = await page.locator('[data-field="hash"]').innerText();
    if (!/^[0-9a-f]{8}$/.test(hash)) failures.push(`[${label}%] empreinte invalide : ${hash}`);
    const fonts = await page.evaluate(() => ["EB Garamond", "IM Fell English", "Special Elite"].map((f) => `${f}=${document.fonts.check(`16px "${f}"`)}`));
    if (fonts.some((f) => f.endsWith("false"))) failures.push(`[${label}%] polices non chargées : ${fonts.join(", ")}`);
    const scroll = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (scroll > 0) failures.push(`[${label}%] défilement horizontal de ${scroll}px`);
    await page.screenshot({ path: `${outDir}/p0-demarrage-${label}.png` });

    await page.keyboard.press("F2");
    if (!(await page.locator(".debug-console").isVisible())) failures.push(`[${label}%] F2 n'ouvre pas la console`);
    await page.keyboard.type("advance 10");
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.querySelector('[data-field="date"]')?.textContent === "an 845, jour 11", undefined, { timeout: 10000 });
    await page.keyboard.type("canon");
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.querySelector(".debug-console__log")?.textContent?.includes("canon:check"), undefined, { timeout: 10000 });
    await page.screenshot({ path: `${outDir}/p0-console-${label}.png` });
    await page.keyboard.press("F2");
    if (await page.locator(".debug-console").isVisible()) failures.push(`[${label}%] F2 ne referme pas la console`);

    if (errors.length > 0) failures.push(`[${label}%] erreurs console : ${errors.join(" | ")}`);
    console.log(`[${label}%] ${width}×${height} : contenu OK, empreinte ${hash}, ${fonts.join(", ")}, ${errors.length} erreur(s) console`);
    await page.close();
  }
} finally {
  await browser.close();
  await server.close();
}

if (failures.length > 0) {
  for (const f of failures) console.error(`ÉCHEC ${f}`);
  process.exit(1);
}
console.log(`smoke:page : OK (captures dans ${outDir}/).`);
