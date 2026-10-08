// npm run captures:map — captures de la carte réaliste (MAP, CMAP-08) : 3 zooms et 3 calques, en 1366×768 et 3840×2160.
// Mesure aussi la première image de la carte (MAP.7). Navigateur : CHROMIUM_PATH ou /opt/pw-browsers/chromium.
import { mkdirSync } from "node:fs";
import { chromium } from "playwright-core";
import type { Page } from "playwright-core";
import { createServer } from "vite";

const executablePath = process.env["CHROMIUM_PATH"] ?? "/opt/pw-browsers/chromium";
const OUT = "docs/screenshots";
mkdirSync(OUT, { recursive: true });
const only = process.argv.includes("--rapide");
const isDriverNoise = (text: string): boolean => /GL Driver Message|GPU stall due to ReadPixels/.test(text);

const server = await createServer({ server: { port: 5193, strictPort: false }, logLevel: "error" });
await server.listen();
const url = server.resolvedUrls?.local[0] ?? "http://localhost:5193/";
const browser = await chromium.launch({ executablePath });
const errors: string[] = [];

async function shoot(page: Page, name: string): Promise<void> {
  await page.waitForTimeout(250);
  await page.locator(".carte").screenshot({ path: `${OUT}/${name}.png` });
  console.log(`  capture ${OUT}/${name}.png (lod ${await page.getAttribute(".carte", "data-lod")})`);
}

/** Déplace la vue en glissant la carte (en pixels écran). */
async function drag(page: Page, dx: number, dy: number): Promise<void> {
  const box = await page.locator("canvas.carte__toile").boundingBox();
  if (!box) throw new Error("canvas sans dimensions");
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx / 2, y + dy / 2, { steps: 4 });
  await page.mouse.move(x + dx, y + dy, { steps: 4 });
  await page.mouse.up();
  await page.mouse.move(5, y);
}

try {
  for (const [w, h, tag] of only ? ([[1366, 768, "1366"]] as const) : ([[1366, 768, "1366"], [3840, 2160, "4k"]] as const)) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    page.on("console", (m) => {
      if ((m.type() === "error" || m.type() === "warning") && !isDriverNoise(m.text())) errors.push(`${m.type()}: ${m.text()}`);
    });
    page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
    const t0 = Date.now();
    await page.goto(`${url}?dossiers=0`);
    await page.waitForSelector("canvas.carte__toile", { timeout: 30000 });
    await page.waitForSelector("html[data-ready='true']", { timeout: 30000 });
    console.log(`[${w}×${h}] carte prête en ${((Date.now() - t0) / 1000).toFixed(2)} s (chargement de la page compris)`);
    await page.waitForFunction(() => performance.getEntriesByName("carte:premiere-image").length > 0);
    const first = await page.evaluate(() => performance.getEntriesByName("carte:premiere-image")[0]?.duration ?? -1);
    console.log(`  première image de la carte : ${(first / 1000).toFixed(2)} s (terrain, image du relief, couches)`);
    await page.waitForFunction(() => performance.getEntriesByName("carte:relief-fin").length > 0, undefined, { timeout: 60000 });
    const fine = await page.evaluate(() => performance.getEntriesByName("carte:relief-fin")[0]?.startTime ?? -1);
    const start = await page.evaluate(() => performance.getEntriesByName("carte:debut")[0]?.startTime ?? 0);
    console.log(`  image fine du relief (worker) prête ${((fine - start) / 1000).toFixed(2)} s après le début de la carte`);
    await page.mouse.move(5, h / 2);
    await shoot(page, `map-${tag}-ile`);
    // Région : sud de Rose (Trost), puis province.
    await page.keyboard.press("KeyR");
    await drag(page, 0, -h * 0.5);
    await shoot(page, `map-${tag}-region`);
    await page.keyboard.press("KeyP");
    await shoot(page, `map-${tag}-province`);
    await page.keyboard.press("KeyF");
    for (const overlay of ["politique", "nourriture", "titans"]) {
      await page.locator(`button[data-overlay="${overlay}"]`).click();
      await shoot(page, `map-${tag}-calque-${overlay}`);
      await page.locator(`button[data-overlay="${overlay}"]`).click();
    }
    await page.close();
  }
} finally {
  await browser.close();
  await server.close();
}
console.log(errors.length ? `Erreurs console :\n${errors.join("\n")}` : "Aucune erreur console.");
process.exit(errors.length ? 1 : 0);
