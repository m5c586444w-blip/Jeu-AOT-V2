import { hasKey, t } from "../i18n";
import type { GameState } from "../sim/core/state";
import { fromAbsoluteDay, toAbsoluteDay } from "../sim/core/time";
import type { World } from "../sim/strategic/world";
import { alertText } from "./hud";
import { alertIcon, icon } from "./icons";

/** Une entrée du fil, quelle que soit sa source (journal de Paradis ou journal du monde). */
export interface FeedEntry {
  day: number;
  seq: number;
  key: string;
  text: string;
  grave: boolean;
  /** Province concernée (clic = aller sur le lieu), si l'entrée en nomme une. */
  place: string | null;
}

/** Entrée regroupée : textes identiques du même jour fusionnés, avec leur nombre. */
export interface FeedItem extends FeedEntry {
  count: number;
}

/** Groupe du fil : un jour, ses entrées graves d'abord puis les plus récentes. */
export interface FeedGroup {
  day: number;
  items: FeedItem[];
}

/**
 * Regroupe et trie (U9) : un groupe par jour, du plus récent au plus ancien ; dans un jour, les alertes graves d'abord,
 * puis les plus récentes ; les textes identiques fusionnés (« ×3 »). Logique pure, testée sans navigateur.
 */
export function groupFeed(entries: readonly FeedEntry[], maxGroups = 6): FeedGroup[] {
  const byDay = new Map<number, Map<string, FeedItem>>();
  for (const e of entries) {
    const day = byDay.get(e.day) ?? new Map<string, FeedItem>();
    byDay.set(e.day, day);
    const same = day.get(e.text);
    if (same) {
      same.count += 1;
      same.seq = Math.max(same.seq, e.seq);
      same.grave ||= e.grave;
    } else day.set(e.text, { ...e, count: 1 });
  }
  return [...byDay.entries()]
    .sort((a, b) => b[0] - a[0])
    .slice(0, maxGroups)
    .map(([day, items]) => ({ day, items: [...items.values()].sort((a, b) => Number(b.grave) - Number(a.grave) || b.seq - a.seq) }));
}

/** Province nommée par les paramètres d'une entrée (province, target…). */
function placeOf(world: World, params: Record<string, string | number>): string | null {
  for (const v of Object.values(params)) if (typeof v === "string" && world.provinceById.has(v)) return v;
  return null;
}

/** Entrées du fil pour la nation jouée : journal de Paradis, ou journal du monde pour une autre nation (P7). */
export function feedEntries(world: World, state: GameState): FeedEntry[] {
  const ns = state.nations;
  if (ns && ns.player !== "fac_paradis") {
    return ns.log.slice(-40).map((w, i) => ({
      day: w.day,
      seq: i,
      key: w.key,
      text: t(w.key, Object.fromEntries(Object.entries(w.params).map(([k, v]) => [k, typeof v === "string" && hasKey(v) ? t(v) : v]))),
      grave: false,
      place: placeOf(world, w.params),
    }));
  }
  return (state.strategic?.log ?? []).slice(-40).map((l) => ({ day: toAbsoluteDay(l.date), seq: l.seq, key: l.key, text: alertText(l, world), grave: l.pause, place: placeOf(world, l.params) }));
}

/** Fil de notifications à droite de la carte (U9) : regroupé, trié, icône et texte, clic = aller sur le lieu. */
export class NotificationFeed {
  readonly el = document.createElement("aside");
  private readonly list = document.createElement("ol");
  private readonly count = document.createElement("span");
  private signature = "";

  constructor(
    parent: HTMLElement,
    private readonly world: World,
    private readonly go: (province: string) => void,
    openHistory: () => void,
  ) {
    this.el.className = "notifications";
    this.el.setAttribute("aria-label", t("notif.title"));
    const head = document.createElement("div");
    head.className = "notifications__tete";
    const title = document.createElement("h2");
    title.className = "notifications__titre";
    title.textContent = t("notif.title");
    this.count.className = "notifications__compte";
    const history = document.createElement("button");
    history.type = "button";
    history.className = "notifications__bouton";
    history.innerHTML = icon("historique");
    history.title = t("notif.history");
    history.setAttribute("aria-label", t("notif.history"));
    history.addEventListener("click", openHistory);
    const fold = document.createElement("button");
    fold.type = "button";
    fold.className = "notifications__bouton";
    fold.innerHTML = icon("moins");
    fold.title = t("notif.fold");
    fold.setAttribute("aria-label", t("notif.fold"));
    fold.setAttribute("aria-expanded", "true");
    fold.addEventListener("click", () => {
      const folded = this.el.dataset["replie"] !== "true";
      this.el.dataset["replie"] = String(folded);
      fold.setAttribute("aria-expanded", String(!folded));
      fold.innerHTML = icon(folded ? "plus" : "moins");
    });
    head.append(title, this.count, history, fold);
    this.list.className = "notifications__liste";
    this.el.append(head, this.list);
    parent.append(this.el);
  }

  update(state: GameState): void {
    const entries = feedEntries(this.world, state);
    const sig = `${state.nations?.player ?? ""}:${entries.length}:${entries.at(-1)?.seq ?? 0}:${entries.at(-1)?.day ?? 0}:${toAbsoluteDay(state.date)}`;
    if (sig === this.signature) return;
    this.signature = sig;
    const today = toAbsoluteDay(state.date);
    const groups = groupFeed(entries);
    this.el.hidden = groups.length === 0;
    this.count.textContent = String(entries.length);
    this.list.replaceChildren();
    for (const g of groups) {
      const head = document.createElement("li");
      head.className = "notifications__groupe";
      const d = fromAbsoluteDay(g.day);
      head.textContent = g.day === today ? t("notif.today") : g.day === today - 1 ? t("notif.yesterday") : t("date.format", { year: d.year, day: d.day });
      this.list.append(head);
      for (const it of g.items) this.list.append(this.item(it));
    }
  }

  private item(it: FeedItem): HTMLLIElement {
    const li = document.createElement("li");
    // Une entrée qui nomme un lieu est un bouton (aller sur le lieu) ; les autres sont du texte simple.
    const b = it.place ? document.createElement("button") : document.createElement("div");
    if (b instanceof HTMLButtonElement) b.type = "button";
    b.className = "notification";
    b.dataset["gravite"] = it.grave ? "grave" : "courante";
    b.innerHTML = icon(alertIcon(it.key));
    const text = document.createElement("span");
    text.className = "notification__texte";
    text.textContent = it.text;
    text.title = it.text;
    b.append(text);
    if (it.count > 1) {
      const n = document.createElement("span");
      n.className = "notification__nombre";
      n.textContent = `×${it.count}`;
      b.append(n);
    }
    if (it.place) {
      const place = it.place;
      const p = document.createElement("span");
      p.className = "notification__lieu";
      p.textContent = t(this.world.provinceById.get(place)?.name_key ?? "notif.place");
      b.append(p);
      b.title = t("notif.go");
      b.addEventListener("click", () => this.go(place));
    }
    li.append(b);
    return li;
  }
}
