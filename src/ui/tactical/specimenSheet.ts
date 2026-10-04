import { t } from "../../i18n";
import { drawSpecimenSheet, SOLDIER_LOOKS, SPECIMEN_CELL, TITAN_SILHOUETTES } from "../../render/tactical/specimens";
import { el } from "../panels/common";

const STATES = ["tac.sheet.crawl", "tac.sheet.cut", "tac.sheet.dead", "tac.sheet.selected", "tac.sheet.flare_red", "tac.sheet.flare_black", "tac.sheet.flare_green"];

/** Ouvre la planche de revue des figures tactiques (AC4-13) ; renvoie la fonction de fermeture. */
export async function openSpecimenSheet(): Promise<() => void> {
  const root = el("section", "planche");
  root.append(el("h2", "bataille-titre", t("tac.sheet.title")));
  const band = (title: string, labels: string[], offset: number): HTMLElement => {
    root.append(el("h3", "registre-intertitre", title));
    const host = el("div", "planche-toile");
    const r = el("div", "planche-legendes");
    r.style.gridTemplateColumns = `repeat(10, ${SPECIMEN_CELL}px)`;
    for (let i = 0; i < offset; i++) r.append(el("span"));
    for (const l of labels) r.append(el("span", "", l));
    root.append(host, r);
    return host;
  };
  const hosts: [HTMLElement, HTMLElement, HTMLElement] = [
    band(t("tac.sheet.titans"), Array.from({ length: TITAN_SILHOUETTES }, (_, i) => t("tac.sheet.silhouette", { n: i + 1 })), 0),
    band(t("tac.sheet.soldiers"), SOLDIER_LOOKS.map((l) => t(`tac.look.${l}`)), 1),
    band(t("tac.sheet.states"), STATES.map((k) => t(k)), 1),
  ];
  document.body.append(root);
  const destroy = await drawSpecimenSheet(hosts);
  root.dataset["ready"] = "true";
  return () => {
    destroy();
    root.remove();
  };
}
