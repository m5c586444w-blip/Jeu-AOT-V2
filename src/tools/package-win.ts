// npm run package:win [-- --plateforme linux] [-- --sans-build] — PACK.2 (fichier 23 §6) : application de bureau Electron.
// À lancer sur Windows : construit le jeu (`dist/`), prépare `release/app/` (programme principal `electron/main.mjs`, icône,
// jeu construit) et appelle @electron/packager, téléchargé à la première construction (rien n'est ajouté aux dépendances du
// dépôt). Résultat : `release/Murs et Sang-win32-x64/Murs et Sang.exe` (double-clic). Aucune publication, aucun envoi.
// `--plateforme linux` : même emballage pour Linux (contrôle dans le cloud, `npm run smoke:pack`).
import { execSync } from "node:child_process";
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** Versions fixées (publiées depuis plus de deux semaines au moment du choix, D-161). */
export const ELECTRON_VERSION = "44.4.5";
export const PACKAGER_VERSION = "20.3.0";
export const APP_NAME = "Murs et Sang";

const args = process.argv.slice(2);
const opt = (name: string, def: string): string => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] !== undefined ? (args[i + 1] as string) : def;
};
const platform = opt("plateforme", "win32");
if (!["win32", "linux"].includes(platform)) throw new Error(`plateforme inconnue : ${platform} (win32 ou linux)`);
const run = (cmd: string): void => {
  console.log(`> ${cmd}`);
  execSync(cmd, { stdio: "inherit" });
};

const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { version: string };
if (!args.includes("--sans-build")) run("npm run build");
if (!existsSync(join("dist", "index.html"))) throw new Error("dist/index.html absent : la construction a échoué");

// Application préparée : programme principal, icône, jeu construit, manifeste minimal (aucune dépendance).
const APP = join("release", "app");
rmSync(APP, { recursive: true, force: true });
mkdirSync(APP, { recursive: true });
copyFileSync(join("electron", "main.mjs"), join(APP, "main.mjs"));
copyFileSync(join("electron", "icone.png"), join(APP, "icone.png"));
cpSync("dist", join(APP, "dist"), { recursive: true });
writeFileSync(
  join(APP, "package.json"),
  `${JSON.stringify({ name: "murs-et-sang", productName: APP_NAME, version: pkg.version, description: "Murs et Sang — jeu de stratégie, usage personnel", author: "Murs et Sang (usage personnel)", main: "main.mjs", type: "module", private: true }, null, 2)}\n`,
);

// L'icône de l'exécutable Windows se pose avec rcedit, qui ne tourne que sous Windows (ou Wine) : ailleurs, on s'en passe.
const icon = platform === "win32" && process.platform === "win32" ? ` --icon="${join("electron", "icone.ico")}"` : "";
if (platform === "win32" && process.platform !== "win32") console.log("Note : construction croisée depuis un autre système ; l'icône de l'exécutable n'est posée que sous Windows.");
run(
  `npx --yes @electron/packager@${PACKAGER_VERSION} "${APP}" "${APP_NAME}" --platform=${platform} --arch=x64 --electron-version=${ELECTRON_VERSION}` +
    ` --out=release --overwrite --asar --app-version=${pkg.version} --app-copyright="Usage personnel et non commercial"${icon}`,
);
const out = join("release", `${APP_NAME}-${platform}-x64`);
console.log(`package:win : ${existsSync(out) ? `application prête dans « ${out} »` : "dossier de sortie introuvable"} (${platform === "win32" ? `${APP_NAME}.exe` : "murs-et-sang"}).`);
process.exitCode = existsSync(out) ? 0 : 1;
