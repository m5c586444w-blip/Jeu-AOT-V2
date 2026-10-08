import { t } from "../i18n";
import { emblem } from "./icons";
import { applyPaperTextures } from "./paper";
import { applyUiScale } from "./settings";

/**
 * Menu principal (04 §5.1–5.2) : table d'archives sous la lampe, dossier tamponné « CONFIDENTIEL », tiroir des scénarios ;
 * chaque scénario est une chemise à couverture dessinée ; 854 ouvre le choix de la nation (blasons).
 * Aucun bouton rectangulaire générique : des dossiers qu'on tire du tiroir.
 */
interface ScenarioCover {
  id: string;
  year: number;
  emblem: string;
  nations: readonly string[];
}

const SCENARIOS: readonly ScenarioCover[] = [
  { id: "scn_sandbox_845", year: 845, emblem: "fac_paradis", nations: [] },
  { id: "scn_sandbox_850", year: 850, emblem: "fac_paradis", nations: [] },
  { id: "scn_854", year: 854, emblem: "fac_marley", nations: ["fac_paradis", "fac_marley"] },
];

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = "", text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function go(params: Record<string, string>): void {
  const q = new URLSearchParams(params);
  window.location.search = `?${q.toString()}`;
}

export function mountMainMenu(app: HTMLElement, uiScale = 100): void {
  applyPaperTextures(document.documentElement);
  applyUiScale(uiScale);
  const table = el("main", "table-archives");
  table.setAttribute("aria-label", t("menu.table"));
  const lamp = el("div", "table-archives__lampe");
  lamp.setAttribute("aria-hidden", "true");
  const dossier = el("section", "dossier-maitre");
  const stamp = el("p", "tampon dossier-maitre__tampon", t("menu.confidential"));
  const title = el("h1", "dossier-maitre__titre", t("app.title"));
  const note = el("p", "registre-note", t("menu.note"));
  dossier.append(stamp, title, note);
  const drawer = el("section", "tiroir-scenarios");
  drawer.append(el("h2", "tiroir-scenarios__etiquette", t("menu.scenarios")));
  const shelf = el("div", "tiroir-scenarios__chemises");
  const nations = el("section", "choix-nation-menu");
  nations.hidden = true;
  for (const sc of SCENARIOS) {
    const b = el("button", "chemise");
    b.type = "button";
    b.dataset["scenario"] = sc.id;
    const cover = el("span", "chemise__couverture");
    cover.innerHTML = emblem(sc.emblem);
    b.append(cover, el("span", "chemise__annee", t("menu.year", { year: sc.year })), el("strong", "chemise__titre", t(`scn.${sc.id.replace(/^scn_/, "")}`)), el("span", "chemise__resume", t(`menu.summary.${sc.id}`)));
    b.addEventListener("click", () => {
      if (sc.nations.length === 0) {
        go({ scenario: sc.id });
        return;
      }
      nations.replaceChildren(el("h2", "tiroir-scenarios__etiquette", t("world.choose_nation")));
      for (const f of sc.nations) {
        const n = el("button", `chemise chemise--nation chemise--${f}`);
        n.type = "button";
        n.dataset["nation"] = f;
        const c = el("span", "chemise__couverture");
        c.innerHTML = emblem(f);
        n.append(c, el("strong", "chemise__titre", t(`fac.${f.replace(/^fac_/, "")}`)), el("span", "chemise__resume", t(`menu.nation.${f}`)));
        n.addEventListener("click", () => go({ scenario: sc.id, faction: f }));
        nations.append(n);
      }
      nations.hidden = false;
    });
    shelf.append(b);
  }
  drawer.append(shelf);
  table.append(lamp, dossier, drawer, nations);
  app.append(table);
  document.title = t("app.title");
  document.documentElement.dataset["ready"] = "true";
}
