import { t } from "./i18n";

// Point d'entrée navigateur (page de démarrage complétée en T0.12).
const app = document.getElementById("app");
if (app) app.textContent = t("app.title");
