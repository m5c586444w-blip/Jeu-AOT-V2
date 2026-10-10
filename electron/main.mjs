// Application de bureau (PACK, fichier 23 §6) : une fenêtre Electron qui sert le jeu construit (`dist/`) par un protocole
// local `jeu://`, sans serveur ni réseau. Les sauvegardes (IndexedDB) restent dans le profil de l'utilisateur
// (Windows : %APPDATA%\Murs et Sang). Plein écran : F11, ou l'option `--plein-ecran` au lancement.
import { app, BrowserWindow, Menu, net, protocol, session } from "electron";
import { existsSync } from "node:fs";
import { dirname, join, normalize, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const DIST = join(HERE, "dist");
const SCHEME = "jeu";

// Schéma « standard » et « sûr » : chemins absolus (/assets/…), modules, Worker, fetch et IndexedDB fonctionnent comme en http.
protocol.registerSchemesAsPrivileged([{ scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }]);

/** Fichier de `dist/` pour une adresse `jeu://local/…` ; refuse toute sortie du dossier. */
function fileFor(url) {
  let path = decodeURIComponent(new URL(url).pathname);
  if (path === "/" || path === "") path = "/index.html";
  const file = normalize(join(DIST, path));
  return file === DIST || file.startsWith(DIST + sep) ? file : null;
}

function createWindow() {
  const icon = join(HERE, "icone.png");
  const win = new BrowserWindow({
    width: 1366,
    height: 768,
    minWidth: 1024,
    minHeight: 640,
    title: "Murs et Sang",
    backgroundColor: "#14110d",
    autoHideMenuBar: true,
    fullscreen: process.argv.includes("--plein-ecran"),
    ...(existsSync(icon) ? { icon } : {}),
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  // F11 : plein écran ; le reste du clavier appartient au jeu (F1 manuel, F2 console, F9 options…).
  win.webContents.on("before-input-event", (event, input) => {
    if (input.type === "keyDown" && input.key === "F11") {
      win.setFullScreen(!win.isFullScreen());
      event.preventDefault();
    }
  });
  // Aucune nouvelle fenêtre, aucune navigation hors du jeu.
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(`${SCHEME}://`)) event.preventDefault();
  });
  void win.loadURL(`${SCHEME}://local/?menu=1`);
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  protocol.handle(SCHEME, (request) => {
    const file = fileFor(request.url);
    if (!file || !existsSync(file)) return new Response("introuvable", { status: 404 });
    return net.fetch(pathToFileURL(file).toString());
  });
  // Hors réseau (PACK.3) : seules les ressources du jeu sont chargées ; toute autre requête est refusée.
  // Les fichiers lus par le protocole (`file:` dans `dist/`) passent ; un `file:` ailleurs est refusé.
  const distUrl = pathToFileURL(DIST + sep).toString();
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    const ok = /^(jeu|data|blob|devtools):/.test(details.url) || details.url.startsWith(distUrl);
    callback({ cancel: !ok });
  });
  session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
  createWindow();
});

app.on("window-all-closed", () => app.quit());
