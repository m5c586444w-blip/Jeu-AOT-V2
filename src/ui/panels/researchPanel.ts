import type { Tech } from "../../data/schemas";
import { t } from "../../i18n";
import { lockOf, monthlyPoints, monthsLeft } from "../../sim/research/research";
import { button, el, stamp, valueEl } from "./common";
import type { Panel, PanelContext } from "./common";
import { formatNumber } from "../why";
import { icon } from "../icons";
import { bar, sep, tag } from "../kit";
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
  private selected: string | null = null;

  constructor(private readonly ctx: PanelContext) {}

  render(root: HTMLElement): void {
    const s = this.ctx.state();
    const rs = s.research;
    const rw = this.ctx.world.research;
    if (!rs || !rw) {
      root.append(el("p", "registre-ferme", t("research.closed")));
      return;
    }
    // Tête : points du mois, Titans capturés, étude en cours avec sa barre et le temps restant.
    const pts = monthlyPoints(this.ctx.world, rs, s.politics);
    const head = el("div", "rech-tete");
    const line = el("p", "registre-champ");
    line.append(t("research.points"), " ", valueEl(this.ctx, formatNumber(pts.value), () => ({ title: t("research.points"), sections: [{ explained: pts }] })), ` · ${t("research.captured")} `, valueEl(this.ctx, String(rs.captured), () => ({ title: t("research.captured"), sections: [{ text: t("research.captured_why") }] })));
    head.append(line);
    const cur = rs.current ? rw.techs.get(rs.current) : undefined;
    const now = el("p", "registre-champ bureau-courant");
    if (cur && cur.cost !== null) {
      const left = monthsLeft(this.ctx.world, rs, s.politics);
      now.append(t("research.current"), " ", el("strong", "", t(`tech.${cur.id}`)), " · ", valueEl(this.ctx, `${formatNumber(rs.progress)} / ${formatNumber(cur.cost)}`, () => ({ title: t("research.progress"), sections: [{ text: t("research.progress_why", { bank: formatNumber(rs.bank) }) }] })), ` · ${left === null ? t("research.stalled") : t("research.months_left", { n: left })} `);
      const stop = button(t("research.stop"), () => void this.ctx.dispatch({ type: "SetResearch", tech: null }), "registre-bouton petit");
      stop.dataset["action"] = "arreter-recherche";
      now.append(stop);
      head.append(now, bar(cur.cost > 0 ? rs.progress / cur.cost : 0));
    } else {
      now.append(t("research.idle"));
      head.append(now);
    }
    root.append(head);
    for (const l of rs.log.slice(-3).reverse()) root.append(el("p", l.key === "research.accident" ? "plan-probleme" : "registre-note", t(l.key, { ...l.params, tech: t(String(l.params["tech"] ?? "")) })));

    const shown = rw.order.filter((x) => isShownTech(x, rs.done, rs.current, isAuthorMode()));
    const present = new Set(shown.map((x) => x.tree));
    const trees = [...TREE_ORDER.filter((x) => present.has(x)), ...[...present].filter((x) => !TREE_ORDER.includes(x))];
    const tab = this.tree && trees.includes(this.tree) ? this.tree : (trees[0] ?? "");
    const nav = el("nav", "registre-onglets");
    for (const tr of trees) {
      const b = button(t(`tree.${tr}`), () => {
        this.tree = tr;
        this.selected = null;
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
    const techs = shown.filter((y) => y.tree === tab);
    const lockFor = (x: Tech): ReturnType<typeof lockOf> => lockOf(this.ctx.world, rs, x, s.date, fired, alive);
    if (!techs.some((x) => x.id === this.selected)) this.selected = techs.find((x) => x.id === rs.current)?.id ?? techs.find((x) => !rs.done.includes(x.id) && !lockFor(x))?.id ?? techs[0]?.id ?? null;

    // Arbre (U5) : une colonne par profondeur de prérequis, liens tracés de chaque prérequis vers l'étude qu'il ouvre.
    const view = el("div", "rech-vue");
    const tree = el("div", "arbre");
    const plan = el("div", "arbre__plan");
    const layout = treeLayout(techs);
    plan.style.width = `${layout.width}rem`;
    plan.style.height = `${layout.height}rem`;
    const links: string[] = [];
    for (const x of techs) {
      const to = layout.pos.get(x.id);
      if (!to) continue;
      for (const p of x.prereqs) {
        const from = layout.pos.get(p);
        if (!from) continue;
        const x1 = from.x + NODE_W;
        const y1 = from.y + NODE_H / 2;
        const x2 = to.x;
        const y2 = to.y + NODE_H / 2;
        const mid = (x1 + x2) / 2;
        const cls = rs.current === x.id ? "arbre__lien arbre__lien--actif" : rs.done.includes(p) ? "arbre__lien arbre__lien--acquis" : "arbre__lien";
        links.push(`<path class="${cls}" d="M${x1} ${y1} C${mid} ${y1} ${mid} ${y2} ${x2} ${y2}"/>`);
      }
    }
    plan.innerHTML = `<svg class="arbre__liens" viewBox="0 0 ${layout.width} ${layout.height}" preserveAspectRatio="none" aria-hidden="true">${links.join("")}</svg>`;
    for (const x of techs) {
      const pos = layout.pos.get(x.id);
      if (!pos) continue;
      const node = this.sheet(x, rs.done.includes(x.id), rs.current === x.id, lockFor(x));
      node.style.left = `${pos.x}rem`;
      node.style.top = `${pos.y}rem`;
      node.style.width = `${NODE_W}rem`;
      node.style.height = `${NODE_H}rem`;
      node.setAttribute("aria-selected", String(x.id === this.selected));
      node.tabIndex = 0;
      node.addEventListener("click", () => {
        this.selected = x.id;
        this.ctx.open("recherche");
      });
      node.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter" && ev.target === node) {
          ev.preventDefault();
          this.selected = x.id;
          this.ctx.open("recherche");
        }
      });
      plan.append(node);
    }
    tree.append(plan);
    tree.addEventListener("scroll", () => (treeScroll = [tree.scrollLeft, tree.scrollTop]), { passive: true });
    const detail = el("aside", "rech-detail");
    const sel = this.selected ? rw.techs.get(this.selected) : undefined;
    if (sel) this.detail(detail, sel, rs.done.includes(sel.id), rs.current === sel.id, lockFor(sel));
    view.append(tree, detail);
    root.append(view);
    [tree.scrollLeft, tree.scrollTop] = treeScroll;
  }

  /** Fiche complète de l'étude choisie : texte, coût, prérequis et leur état, condition, action. */
  private detail(root: HTMLElement, x: Tech, done: boolean, current: boolean, lock: ReturnType<typeof lockOf>): void {
    const rw = this.ctx.world.research;
    const rs = this.ctx.state().research;
    root.append(el("h3", "", t(`tech.${x.id}`)));
    root.append(tag(done ? t("research.done") : current ? t("research.studying") : lock ? t("research.locked") : t("research.available"), done ? "succes" : current ? "accent" : lock ? "neutre" : "info"));
    root.append(el("p", "rech-detail__fiche", t(`tech.${x.id}.sheet`)));
    if (x.cost !== null) {
      const kv = el("div", "kv");
      kv.append(el("span", "kv__cle", t("research.cost")), valueEl(this.ctx, formatNumber(x.cost), () => ({ title: t("research.cost"), sections: [{ text: t("research.cost_why") }] }), "kv__valeur"));
      root.append(kv);
    }
    if (x.prereqs.length) {
      root.append(sep(t("research.prereqs")));
      const ul = el("ul", "rech-prereqs");
      for (const p of x.prereqs) {
        const ok = rs?.done.includes(p) ?? false;
        const li = el("li", ok ? "rech-prereq--acquis" : "");
        li.innerHTML = icon(ok ? "verifie" : "cadenas", "ico ico--s");
        li.append(t(`tech.${p}`));
        ul.append(li);
      }
      root.append(ul);
    }
    if (!done && !current && lock && lock.key !== "research.lock.done") root.append(el("p", "plan-probleme", this.lockText(lock)));
    else if (!done && !current && x.cost !== null && rw) {
      const go = button(t("research.start"), () => void this.ctx.dispatch({ type: "SetResearch", tech: x.id }), "registre-bouton principal");
      go.dataset["action"] = "etudier-fiche";
      root.append(go);
    }
  }

  private lockText(lock: NonNullable<ReturnType<typeof lockOf>>): string {
    const params: Record<string, string | number> = { ...("params" in lock ? lock.params : {}) };
    if (typeof params["tech"] === "string") params["tech"] = t(`tech.${params["tech"]}`);
    if (typeof params["event"] === "string") params["event"] = t(this.ctx.world.chronicle?.events.get(params["event"])?.text_key ?? String(params["event"]));
    if (typeof params["character"] === "string") params["character"] = this.ctx.world.politics?.characters.get(params["character"])?.name ?? params["character"];
    if (typeof params["faction"] === "string") params["faction"] = t(`faction.${params["faction"]}`);
    return t(lock.key, params);
  }

  /** Nœud de l'arbre : nom, état ; condition en une ligne si verrouillée ; « Étudier » si disponible. */
  private sheet(x: Tech, done: boolean, current: boolean, lock: ReturnType<typeof lockOf>): HTMLElement {
    const card = el("article", `planche ${done ? "planche--acquise" : current ? "planche--etude" : lock ? "planche--verrou" : "planche--libre"}`);
    card.dataset["tech"] = x.id;
    const head = el("header", "planche__tete");
    head.insertAdjacentHTML("afterbegin", icon(done ? "verifie" : current ? "horloge" : lock ? "cadenas" : "recherche", "ico ico--s"));
    head.append(authorOnly(el("span", "planche__code", x.code ?? "")), el("h4", "", t(`tech.${x.id}`)), stamp(x.canon));
    card.append(head);
    const meta = el("p", "registre-note");
    if (x.cost !== null) meta.append(`${t("research.cost")} `, valueEl(this.ctx, formatNumber(x.cost), () => ({ title: t("research.cost"), sections: [{ text: t("research.cost_why") }] })), " ");
    meta.append(authorOnly(el("span", "", t("research.min_year", { year: x.min_year }))));
    if (x.mechanic_phase) meta.append(authorOnly(el("span", "planche__phase", ` ${t("research.phase", { phase: x.mechanic_phase })}`)));
    card.append(meta);
    if (done) card.append(el("p", "planche__etat", t("research.done")));
    else if (current) card.append(el("p", "planche__etat", t("research.studying")));
    else if (lock && lock.key !== "research.lock.done") {
      const text = this.lockText(lock);
      const p = el("p", "plan-probleme", text);
      p.title = text;
      card.append(p);
    } else if (x.cost !== null) {
      const go = button(t("research.start"), () => void this.ctx.dispatch({ type: "SetResearch", tech: x.id }), "registre-bouton petit principal");
      go.dataset["action"] = "etudier";
      card.append(go);
    }
    return card;
  }
}

/** Taille des nœuds et écarts de l'arbre, en rem. */
const NODE_W = 13.5;
const NODE_H = 4.6;
const GAP_X = 3;
const GAP_Y = 0.7;
/** Position de lecture de l'arbre (gauche, haut), conservée quand le registre est redessiné. */
let treeScroll: [number, number] = [0, 0];

/**
 * Disposition de l'arbre : profondeur = 1 + profondeur du prérequis le plus profond (dans l'arbre affiché) ; dans une
 * colonne, ordre par position moyenne des prérequis (moins de croisements), puis ordre des données.
 */
export function treeLayout(techs: readonly Pick<Tech, "id" | "prereqs">[]): { pos: Map<string, { x: number; y: number }>; width: number; height: number } {
  const ids = new Set(techs.map((x) => x.id));
  const byId = new Map(techs.map((x) => [x.id, x]));
  const depth = new Map<string, number>();
  const depthOf = (id: string, seen: Set<string>): number => {
    const known = depth.get(id);
    if (known !== undefined) return known;
    if (seen.has(id)) return 0;
    seen.add(id);
    const pre = (byId.get(id)?.prereqs ?? []).filter((p) => ids.has(p));
    const d = pre.length ? 1 + Math.max(...pre.map((p) => depthOf(p, seen))) : 0;
    depth.set(id, d);
    return d;
  };
  for (const x of techs) depthOf(x.id, new Set());
  const columns: string[][] = [];
  for (const x of techs) (columns[depth.get(x.id) ?? 0] ??= []).push(x.id);
  const row = new Map<string, number>();
  const pos = new Map<string, { x: number; y: number }>();
  let rows = 0;
  columns.forEach((col, c) => {
    const order = col.map((id, i) => {
      const pre = (byId.get(id)?.prereqs ?? []).map((p) => row.get(p)).filter((r): r is number => r !== undefined);
      return { id, key: pre.length ? pre.reduce((a, b) => a + b, 0) / pre.length : i, i };
    });
    order.sort((a, b) => a.key - b.key || a.i - b.i);
    order.forEach((o, r) => {
      row.set(o.id, r);
      pos.set(o.id, { x: c * (NODE_W + GAP_X), y: r * (NODE_H + GAP_Y) });
    });
    rows = Math.max(rows, order.length);
  });
  return { pos, width: Math.max(1, columns.length) * (NODE_W + GAP_X) - GAP_X, height: Math.max(1, rows) * (NODE_H + GAP_Y) - GAP_Y };
}
