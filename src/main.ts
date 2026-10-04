import "@fontsource/eb-garamond/latin-400.css";
import "@fontsource/eb-garamond/latin-400-italic.css";
import "@fontsource/im-fell-english/latin-400.css";
import "@fontsource/unifrakturmaguntia/latin-400.css";
import "@fontsource/special-elite/latin-400.css";
import "./ui/styles/base.css";
import "./ui/styles/console.css";
import "./ui/styles/screen.css";
import { setLocale } from "./i18n";
import { bootGame, safeStorage } from "./ui/gameScreen";
import { loadSettings } from "./ui/settings";
import { mountMainMenu } from "./ui/mainMenu";

// Menu principal (P8) : `?menu=1`, ou le bouton du bandeau ; sans paramètre, la partie s'ouvre directement (D-74).
const app = document.getElementById("app");
if (new URLSearchParams(window.location.search).get("menu") === "1" && app) {
  const settings = loadSettings(safeStorage());
  setLocale(settings.locale);
  mountMainMenu(app, settings.uiScale);
} else void bootGame();
