import type { Tech } from "../../data/schemas";
import { t } from "../../i18n";
import { lockOf, monthlyPoints, monthsLeft } from "../../sim/research/research";
import { button, el, stamp, valueEl } from "./common";
import type { Panel, PanelContext } from "./common";
import { formatNumber } from "../why";
import { authorOnly, isAuthorMode } from "../authorMode";

/** Phases dont la mécanique existe dans le jeu : une étude rattachée à une phase future n'apparaît pas (UX0.3). */
const LIVE_PHASES: ReadonlySet<string> = new Set(["P6", "P7", "P8"]);

/** Une étude est montrée au joueur si sa mécanique existe, ou si elle est déjà acquise ou à l'étude. */
export function isShownTech(x: Pick<Tech, "id" | "mechanic_phase">, done: readonly string[], current: string | null, author = false): boolean {
  return author || !x.mechanic_phase || LIVE_PHASES.has(x.mechanic_phase) || done.includes(x.id) || current === x.id;
}

/** Ordre des arbres du fichier 13 (§1 à §10). */
const TREE_ORDER = ["odm", "anti_titan", "medecine", "logistique", "fortification", "renseignement", "administration", "armes_modernes", "hizuru_allies", "doctrine"];

/**
 * Recherche (04 §5.9, 13 ; ERRATA_UX) : planches par arbre ; chaque technologie montre son état (acquise, à l'étude,
 * disponible, ou grisée avec sa condition en langage de jeu) et sa fiche. Codes, statuts canon, années planchers et
 * phases ne paraissent qu'en mode auteur (F10) ; une étude dont la mécanique n'existe pas encore est absente.
 */
export class ResearchPanel implements Panel {
  readonly id = "recherche" as const;
  private tree: string | null = null;

  constructor(private readonly ctx: PanelContext) {}

  render(root: HTMLElement): void {
    const s = this.ctx.state();
    const rs = s.research;
    const rw = this.ctx.world.research;
    if (!rs || !rw) {
      root.append(el("p", "registre-ferme", t("research.closed")));
      return;
    }
    const pts = monthlyPoints(this.ctx.world, rs, s.politics);
    const head = el("p", "registre-champ");
    head.append(t("research.points"), " ", valueEl(this.ctx, formatNumber(pts.value), () => ({ title: t("research.points"), sections: [{ explained: pts }] })), ` · ${t("research.captured")} `, valueEl(this.ctx, String(rs.captured), () => ({ title: t("research.captured"), sections: [{ text: t("research.captured_why") }] })));
    root.append(head);
    const cur = rs.current ? rw.techs.get(rs.current) : undefined;
    const now = el("p", "registre-champ bureau-courant");
    if (cur && cur.cost !== null) {
      const left = monthsLeft(this.ctx.world, rs, s.politics);
      now.append(t("research.current"), " ", el("strong", "", t(`tech.${cur.id}`)), " · ", valueEl(this.ctx, `${formatNumber(rs.progress)} / ${formatNumber(cur.cost)}`, () => ({ title: t("research.progress"), sections: [{ text: t("research.progress_why", { bank: formatNumber(rs.bank) }) }] })), ` · ${left === null ? t("research.stalled") : t("research.months_left", { n: left })} `);
      const stop = button(t("research.stop"), () => void this.ctx.dispatch({ type: "SetResearch", tech: null }), "registre-bouton petit");
      stop.dataset["action"] = "arreter-recherche";
      now.append(stop);
    } else now.append(t("research.idle"));
    root.append(now);
    for (const l of rs.log.slice(-3).reverse()) root.append(el("p", l.key === "research.accident" ? "plan-probleme" : "registre-note", t(l.key, { ...l.params, tech: t(String(l.params["tech"] ?? "")) })));

    const shown = rw.order.filter((x) => isShownTech(x, rs.done, rs.current, isAuthorMode()));
    const present = new Set(shown.map((x) => x.tree));
    const trees = [...TREE_ORDER.filter((x) => present.has(x)), ...[...present].filter((x) => !TREE_ORDER.includes(x))];
    const tab = this.tree && trees.includes(this.tree) ? this.tree : (trees[0] ?? "");
    const nav = el("nav", "registre-onglets");
    for (const tr of trees) {
      const b = button(t(`tree.${tr}`), () => {
        this.tree = tr;
        this.ctx.open("recherche");
      }, "registre-onglet");
      b.dataset["tree"] = tr;
      b.setAttribute("aria-pressed", String(tr === tab));
      nav.append(b);
    }
    root.append(nav);
    const history = s.events?.history ?? {};
    const fired = (id: string): boolean => history[id]?.status === "survenu" || history[id]?.status === "passe";
    const alive = (id: string): boolean => s.politics?.characters[id]?.alive ?? false;
    const board = el("div", "planches");
    for (const x of shown.filter((y) => y.tree === tab)) board.append(this.sheet(x, rs.done.includes(x.id), rs.current === x.id, lockOf(this.ctx.world, rs, x, s.date, fired, alive)));
    root.append(board);
  }

  private sheet(x: Tech, done: boolean, current: boolean, lock: ReturnType<typeof lockOf>): HTMLElement {
    const card = el("article", `planche ${done ? "planche--acquise" : current ? "planche--etude" : lock ? "planche--verrou" : "planche--libre"}`);
    card.dataset["tech"] = x.id;
    const head = el("header", "planche__tete");
    head.append(authorOnly(el("span", "planche__code", x.code ?? "")), el("h4", "", t(`tech.${x.id}`)), stamp(x.canon));
    card.append(head, el("p", "planche__fiche", t(`tech.${x.id}.sheet`)));
    const meta = el("p", "registre-note");
    if (x.cost !== null) meta.append(`${t("research.cost")} `, valueEl(this.ctx, formatNumber(x.cost), () => ({ title: t("research.cost"), sections: [{ text: t("research.cost_why") }] })), " ");
    meta.append(authorOnly(el("span", "", t("research.min_year", { year: x.min_year }))));
    card.append(meta);
    if (x.mechanic_phase) card.append(authorOnly(el("p", "planche__phase", t("research.phase", { phase: x.mechanic_phase }))));
    if (done) card.append(el("p", "planche__etat", t("research.done")));
    else if (current) card.append(el("p", "planche__etat", t("research.studying")));
    else if (lock && lock.key !== "research.lock.done") {
      const params: Record<string, string | number> = { ...("params" in lock ? lock.params : {}) };
      if (typeof params["tech"] === "string") params["tech"] = t(`tech.${params["tech"]}`);
      if (typeof params["event"] === "string") params["event"] = t(this.ctx.world.chronicle?.events.get(params["event"])?.text_key ?? String(params["event"]));
      if (typeof params["character"] === "string") params["character"] = this.ctx.world.politics?.characters.get(params["character"])?.name ?? params["character"];
      if (typeof params["faction"] === "string") params["faction"] = t(`faction.${params["faction"]}`);
      card.append(el("p", "plan-probleme", t(lock.key, params)));
    } else if (x.cost !== null) {
      const go = button(t("research.start"), () => void this.ctx.dispatch({ type: "SetResearch", tech: x.id }), "registre-bouton petit principal");
      go.dataset["action"] = "etudier";
      card.append(go);
    }
    return card;
  }
}
