import type { Mission, MissionCondition } from "../../data/missionSchemas";
import { MISSION_BRANCHES } from "../../data/missionSchemas";
import { t } from "../../i18n";
import type { GameState } from "../../sim/core/state";
import { monthsLeft, playerNation, progressOf, sideOf, startLock } from "../../sim/missions/missions";
import type { MissionLock, MissionRun, MissionView } from "../../sim/missions/missions";
import { toAbsoluteDay } from "../../sim/core/time";
import { RESOURCE_IDS } from "../../sim/strategic/resources";
import type { ResourceId } from "../../sim/strategic/resources";
import { effectLines } from "../eventText";
import type { EffectLine } from "../eventText";
import { icon } from "../icons";
import { bar, sep, tag } from "../kit";
import { formatNumber, formatSigned } from "../why";
import type { WhyContent, WhyRow } from "../why";
import { button, el, valueEl } from "./common";
import type { Panel, PanelContext } from "./common";
import { NODE_H, NODE_W, treeLayout } from "./researchPanel";

/** Position de lecture de l'arbre (gauche, haut), conservée quand le registre est redessiné. */
let treeScroll: [number, number] = [0, 0];

/** Crochets des missions : texte de jeu et sens (un multiplicateur sous 1 réduit une perte ; au-dessus de 1 il en ajoute). */
const HOOK_GOOD_BELOW: Readonly<Record<string, boolean>> = { exp_gas_odm_mult: true, exp_night_loss_mult: true, exp_wound_death_mult: true, exp_loss_mult: true, log_attrition_mult: true, log_interception_mult: true };

/** Ressources d'une mission : stock de Paradis, ou industrie et hommes de Marley. */
function stockOf(s: GameState, nation: Mission["nation"], r: ResourceId): number {
  if (nation === "paradis") return s.strategic?.stocks[r] ?? 0;
  const n = s.nations?.nations["fac_marley"];
  return r === "gold" ? (n?.industry ?? 0) : r === "manpower" ? (n?.manpower ?? 0) : 0;
}

const resLabel = (nation: Mission["nation"], r: ResourceId): string => (nation === "marley" ? (r === "gold" ? t("mission.res.industry") : r === "manpower" ? t("mission.res.manpower") : t(`res.${r}`)) : t(`res.${r}`));

/**
 * Missions (MIS.3) : objectifs nationaux à long terme, présentés comme l'arbre d'études : une planche par mission, des liens
 * entre prérequis et suites, la mission en cours avec sa barre et le temps restant, la fiche des effets en infobulle. Aucun
 * code interne, aucun statut canon, aucune année plancher : seuls les noms, les coûts et les raisons de verrouillage.
 */
export class MissionsPanel implements Panel {
  readonly id = "missions" as const;
  private branch: string | null = null;
  private selected: string | null = null;

  constructor(private readonly ctx: PanelContext) {}

  private view(s: GameState): MissionView | null {
    if (!s.strategic) return null;
    return { date: s.date, st: s.strategic, pol: s.politics, rs: s.research, intel: s.intel, ev: s.events, ns: s.nations, armies: s.armies, ms: s.missions };
  }

  render(root: HTMLElement): void {
    const s = this.ctx.state();
    const mw = this.ctx.world.missions;
    const v = this.view(s);
    if (!mw || !v) {
      root.append(el("p", "registre-ferme", t("mission.closed")));
      return;
    }
    const nation = playerNation(s.nations);
    const side = sideOf(s.missions, nation);
    const all = mw.order.filter((m) => m.nation === nation);

    // Tête : places occupées, puis chaque mission en cours avec sa barre, son temps restant et « Annuler ».
    const head = el("div", "rech-tete");
    const slots = mw.balance.slots[nation];
    const line = el("p", "registre-champ");
    line.append(t("mission.slots"), " ", valueEl(this.ctx, `${side.current.length} / ${slots}`, () => ({ title: t("mission.slots"), sections: [{ text: t("mission.slots_why") }] })), ` · ${t("mission.done_count", { n: side.done.length, total: all.length })}`);
    head.append(line);
    if (side.current.length === 0) head.append(el("p", "registre-champ bureau-courant", t("mission.idle")));
    for (const run of side.current) this.runningLine(head, run, nation, s);
    root.append(head);
    for (const l of (s.missions?.log ?? []).filter((x) => x.key === "mission.log.done").slice(-2).reverse()) root.append(el("p", "registre-note", t("mission.log.done_line", { mission: t(String(l.params["mission"] ?? "")) })));

    const present = new Set(all.map((m) => m.branch));
    const branches = MISSION_BRANCHES.filter((b) => present.has(b));
    const tab = this.branch && branches.includes(this.branch as (typeof branches)[number]) ? this.branch : (branches[0] ?? "");
    const nav = el("nav", "registre-onglets");
    for (const b of branches) {
      const doneInBranch = all.filter((m) => m.branch === b && side.done.includes(m.id)).length;
      const total = all.filter((m) => m.branch === b).length;
      const btn = button(`${t(`mission.branch.${b}`)} ${doneInBranch}/${total}`, () => {
        this.branch = b;
        this.selected = null;
        this.ctx.open("missions");
      }, "registre-onglet");
      btn.dataset["branche"] = b;
      btn.setAttribute("aria-pressed", String(b === tab));
      nav.append(btn);
    }
    root.append(nav);

    const list = all.filter((m) => m.branch === tab);
    const lockFor = (m: Mission): MissionLock | null => startLock(this.ctx.world, v, m);
    if (!list.some((m) => m.id === this.selected)) this.selected = list.find((m) => side.current.some((r) => r.id === m.id))?.id ?? list.find((m) => !side.done.includes(m.id) && !lockFor(m))?.id ?? list[0]?.id ?? null;

    // Arbre : une colonne par profondeur de prérequis ; les liens vont de chaque prérequis vers la mission qu'il ouvre.
    const view = el("div", "rech-vue");
    const tree = el("div", "arbre");
    const plan = el("div", "arbre__plan");
    const inTab = new Set(list.map((m) => m.id));
    const layout = treeLayout(list.map((m) => ({ id: m.id, prereqs: [...m.prereqs, ...m.any_of].filter((p) => inTab.has(p)) })));
    plan.style.width = `${layout.width}rem`;
    plan.style.height = `${layout.height}rem`;
    const links: string[] = [];
    for (const m of list) {
      const to = layout.pos.get(m.id);
      if (!to) continue;
      for (const p of [...m.prereqs, ...m.any_of]) {
        const from = layout.pos.get(p);
        if (!from) continue;
        const x1 = from.x + NODE_W;
        const y1 = from.y + NODE_H / 2;
        const x2 = to.x;
        const y2 = to.y + NODE_H / 2;
        const mid = (x1 + x2) / 2;
        const cls = side.current.some((r) => r.id === m.id) ? "arbre__lien arbre__lien--actif" : side.done.includes(p) ? "arbre__lien arbre__lien--acquis" : "arbre__lien";
        links.push(`<path class="${cls}" d="M${x1} ${y1} C${mid} ${y1} ${mid} ${y2} ${x2} ${y2}"/>`);
      }
    }
    plan.innerHTML = `<svg class="arbre__liens" viewBox="0 0 ${layout.width} ${layout.height}" preserveAspectRatio="none" aria-hidden="true">${links.join("")}</svg>`;
    for (const m of list) {
      const pos = layout.pos.get(m.id);
      if (!pos) continue;
      const node = this.sheet(m, side.done.includes(m.id), side.current.find((r) => r.id === m.id), lockFor(m), s);
      node.style.left = `${pos.x}rem`;
      node.style.top = `${pos.y}rem`;
      node.style.width = `${NODE_W}rem`;
      node.style.height = `${NODE_H}rem`;
      node.setAttribute("aria-selected", String(m.id === this.selected));
      node.tabIndex = 0;
      const pick = (): void => {
        this.selected = m.id;
        this.ctx.open("missions");
      };
      node.addEventListener("click", pick);
      node.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter" && ev.target === node) {
          ev.preventDefault();
          pick();
        }
      });
      plan.append(node);
    }
    tree.append(plan);
    tree.addEventListener("scroll", () => (treeScroll = [tree.scrollLeft, tree.scrollTop]), { passive: true });
    const detail = el("aside", "rech-detail");
    const sel = this.selected ? mw.byId.get(this.selected) : undefined;
    if (sel) this.detail(detail, sel, side.done.includes(sel.id), side.current.find((r) => r.id === sel.id), lockFor(sel), s);
    view.append(tree, detail);
    root.append(view);
    [tree.scrollLeft, tree.scrollTop] = treeScroll;
  }

  /** Ligne d'une mission en cours : nom, temps restant, barre, « Annuler ». */
  private runningLine(head: HTMLElement, run: MissionRun, nation: Mission["nation"], s: GameState): void {
    const m = this.ctx.world.missions?.byId.get(run.id);
    if (!m) return;
    const left = monthsLeft(run, s.date);
    const days = Math.max(0, run.end - toAbsoluteDay(s.date));
    const now = el("p", "registre-champ bureau-courant");
    now.dataset["mission"] = "en-cours";
    now.append(t("mission.current"), " ", el("strong", "", t(`mission.${m.id}`)), " · ", valueEl(this.ctx, t("mission.months_left", { n: left }), () => ({ title: t("mission.remaining"), value: t("mission.days_left", { n: days }), sections: [{ text: t("mission.remaining_why", { share: Math.round(progressOf(run, s.date) * 100) }) }] })), " ");
    const stop = button(t("mission.cancel"), () => {
      void this.ctx.confirm(t("mission.cancel_confirm", { mission: t(`mission.${m.id}`), share: Math.round((this.ctx.world.missions?.balance.refund_share ?? 0.5) * 100) })).then((ok) => {
        if (ok) void this.ctx.dispatch({ type: "CancelMission", mission: run.id });
      });
    }, "registre-bouton petit");
    stop.dataset["action"] = "annuler-mission";
    now.append(stop);
    head.append(now, bar(progressOf(run, s.date)));
    void nation;
  }

  /** Texte d'une condition en langage de jeu. */
  private conditionText(c: MissionCondition): string {
    const w = this.ctx.world;
    if ("control" in c) return t("mission.cond.control", { where: t(w.provinceById.get(c.control)?.name_key ?? c.control), value: t(`control.${c.eq}`) });
    if ("tech" in c) return t("mission.cond.tech", { tech: t(`tech.${c.tech}`) });
    if ("fired" in c) {
      const key = w.chronicle?.events.get(c.fired)?.text_key;
      return key ? t("mission.cond.fired", { event: t(key) }) : t("mission.cond.story");
    }
    if ("stock_at_least" in c) return t("mission.cond.stock", { res: t(`res.${c.stock_at_least}`), value: formatNumber(c.value) });
    if ("garrison_at_least" in c) return t("mission.cond.garrison", { where: t(w.provinceById.get(c.garrison_at_least)?.name_key ?? c.garrison_at_least), value: formatNumber(c.value) });
    if ("soldiers_at_least" in c) return t("mission.cond.soldiers", { value: formatNumber(c.soldiers_at_least) });
    if ("year_at_least" in c) return t("mission.cond.year");
    if ("law" in c) return t("mission.cond.law", { law: t(w.politics?.laws.get(c.law)?.name_key ?? c.law) });
    if ("armies_at_least" in c) return t("mission.cond.armies", { n: c.armies_at_least });
    if ("army_in" in c) return t("mission.cond.army_in", { where: t(w.provinceById.get(c.army_in)?.name_key ?? c.army_in) });
    if ("at_war" in c) return t(c.eq ? "mission.cond.at_war" : "mission.cond.at_peace", { faction: t(c.at_war.replace(/^fac_/, "fac.")) });
    return t("mission.cond.story");
  }

  /** Raison d'un verrou, en langage de jeu. */
  private lockText(lock: MissionLock): string {
    switch (lock.key) {
      case "mission.lock.done":
      case "mission.lock.running":
      case "mission.lock.nation":
      case "mission.lock.slots":
        return t(lock.key);
      case "mission.lock.year":
        return t("mission.lock.year");
      case "mission.lock.prereq":
      case "mission.lock.exclusive":
        return t(lock.key, { mission: t(`mission.${lock.mission}`) });
      case "mission.lock.any_of":
        return t(lock.key, { missions: lock.missions.map((x) => t(`mission.${x}`)).join(t("mission.or")) });
      case "mission.lock.condition":
        return t(lock.key, { condition: this.conditionText(lock.condition) });
      case "mission.lock.cost":
        return t(lock.key, { res: t(`res.${lock.resource}`) });
    }
  }

  private lockTextFor(lock: MissionLock, m: Mission): string {
    return lock.key === "mission.lock.cost" ? t(lock.key, { res: resLabel(m.nation, lock.resource) }) : this.lockText(lock);
  }

  private costText(m: Mission): string {
    const parts: string[] = [];
    for (const r of RESOURCE_IDS) if ((m.cost[r] ?? 0) > 0) parts.push(`${resLabel(m.nation, r)} ${formatNumber(m.cost[r] ?? 0)}`);
    return parts.join(", ");
  }

  private durationText(m: Mission): string {
    return m.duration_days < 30 ? t("mission.duration_days", { n: m.duration_days }) : t("mission.duration_months", { n: formatNumber(Math.round((m.duration_days / 30) * 10) / 10) });
  }

  /** Lignes des effets ponctuels, des bonus durables et des suites déclenchées d'une mission. */
  private effectRows(m: Mission): { effects: EffectLine[]; lasting: EffectLine[]; follow: string[] } {
    const effects = effectLines(this.ctx.world, m.effects);
    const lasting: EffectLine[] = [];
    for (const x of m.modifiers) {
      const [kind, res] = x.target.split(":");
      const points = x.target === "morale" || x.target === "stability";
      const pct = points ? formatSigned(x.value) : formatSigned(Math.round(x.value * 1000) / 10);
      const key = res ? `mission.mod.${kind}` : `mission.mod.${x.target}`;
      const good = kind === "consumption_mult" || kind === "losses_mult" ? x.value < 0 : x.value > 0;
      lasting.push({ text: t(key, { pct, res: res ? t(`res.${res}`) : "" }), tone: good ? "gain" : "cout" });
    }
    for (const h of m.hooks) {
      const pct = formatSigned(Math.round((h.value - 1) * 1000) / 10);
      lasting.push({ text: t(`mission.hook.${h.hook}`, { pct }), tone: (HOOK_GOOD_BELOW[h.hook] ? h.value < 1 : h.value > 1) ? "gain" : "cout" });
    }
    const follow = m.events.map((e) => t(this.ctx.world.chronicle?.events.get(e)?.text_key ?? this.eventKey(e)));
    return { effects, lasting, follow };
  }

  private eventKey(id: string): string {
    return `evt.mis.${id.replace(/^evt_mis_/, "")}`;
  }

  /** Infobulle d'une mission : coût (stock / besoin), durée, effets, bonus durables. */
  private tooltip(m: Mission, s: GameState): WhyContent {
    const rows: WhyRow[] = RESOURCE_IDS.filter((r) => (m.cost[r] ?? 0) > 0).map((r) => {
      const need = m.cost[r] ?? 0;
      const have = stockOf(s, m.nation, r);
      return { label: resLabel(m.nation, r), value: `${formatNumber(have)} / ${formatNumber(need)}`, sign: have >= need ? "plus" : "moins" };
    });
    const x = this.effectRows(m);
    const toRows = (l: EffectLine[]): WhyRow[] => l.map((e) => ({ label: e.text, value: "", ...(e.tone === "neutre" ? {} : { sign: e.tone === "gain" ? ("plus" as const) : ("moins" as const) }) }));
    const sections: WhyContent["sections"] = [];
    if (rows.length) sections.push({ label: t("mission.cost"), rows });
    sections.push({ label: t("mission.duration"), text: this.durationText(m) });
    if (x.effects.length) sections.push({ label: t("mission.effects"), rows: toRows(x.effects) });
    if (x.lasting.length) sections.push({ label: t("mission.lasting"), rows: toRows(x.lasting) });
    if (x.follow.length) sections.push({ label: t("mission.follow"), text: x.follow.join(", ") });
    return { title: t(`mission.${m.id}`), sections };
  }

  /** Fiche de la mission choisie : texte, coût et durée, prérequis et leur état, effets, action. */
  private detail(root: HTMLElement, m: Mission, done: boolean, run: MissionRun | undefined, lock: MissionLock | null, s: GameState): void {
    const v = this.view(s);
    const side = sideOf(s.missions, m.nation);
    root.append(el("h3", "", t(`mission.${m.id}`)));
    root.append(tag(done ? t("mission.state.done") : run ? t("mission.state.running") : lock && lock.key !== "mission.lock.slots" && lock.key !== "mission.lock.cost" ? t("mission.state.locked") : t("mission.state.available"), done ? "succes" : run ? "accent" : lock && lock.key !== "mission.lock.slots" && lock.key !== "mission.lock.cost" ? "neutre" : "info"));
    root.append(el("p", "rech-detail__fiche", t(`mission.${m.id}.desc`)));
    const kv = el("div", "kv");
    kv.append(el("span", "kv__cle", t("mission.cost")), valueEl(this.ctx, this.costText(m) || t("mission.free"), () => this.tooltip(m, s), "kv__valeur"));
    root.append(kv);
    const kd = el("div", "kv");
    kd.append(el("span", "kv__cle", t("mission.duration")), valueEl(this.ctx, this.durationText(m), () => ({ title: t("mission.duration"), sections: [{ text: t("mission.duration_why") }] }), "kv__valeur"));
    root.append(kd);
    if (m.prereqs.length || m.any_of.length) {
      root.append(sep(t("mission.prereqs")));
      const ul = el("ul", "rech-prereqs");
      for (const p of m.prereqs) {
        const ok = side.done.includes(p);
        const li = el("li", ok ? "rech-prereq--acquis" : "");
        li.innerHTML = icon(ok ? "verifie" : "cadenas", "ico ico--s");
        li.append(t(`mission.${p}`));
        ul.append(li);
      }
      if (m.any_of.length) {
        const ok = m.any_of.some((p) => side.done.includes(p));
        const li = el("li", ok ? "rech-prereq--acquis" : "");
        li.innerHTML = icon(ok ? "verifie" : "cadenas", "ico ico--s");
        li.append(m.any_of.map((p) => t(`mission.${p}`)).join(t("mission.or")));
        ul.append(li);
      }
      root.append(ul);
    }
    if (v && m.requires.length) {
      const ul = el("ul", "rech-prereqs");
      for (const c of m.requires) {
        const li = el("li", "");
        li.innerHTML = icon("cadenas", "ico ico--s");
        li.append(this.conditionText(c));
        ul.append(li);
      }
      root.append(ul);
    }
    const x = this.effectRows(m);
    if (x.effects.length) {
      root.append(sep(t("mission.effects")));
      for (const e of x.effects) root.append(el("p", `registre-note effet--${e.tone}`, e.text));
    }
    if (x.lasting.length) {
      root.append(sep(t("mission.lasting")));
      for (const e of x.lasting) root.append(el("p", `registre-note effet--${e.tone}`, e.text));
    }
    if (x.follow.length) root.append(el("p", "registre-note", `${t("mission.follow")} : ${x.follow.join(", ")}`));
    if (m.exclusive_with.length) root.append(el("p", "registre-note", t("mission.excludes", { missions: m.exclusive_with.map((e) => t(`mission.${e}`)).join(t("mission.or")) })));
    if (done || run) return;
    const go = button(t("mission.start"), () => void this.ctx.dispatch({ type: "StartMission", mission: m.id }), "registre-bouton principal");
    go.dataset["action"] = "lancer-mission-fiche";
    if (lock) {
      go.disabled = true;
      root.append(el("p", "plan-probleme", this.lockTextFor(lock, m)));
    }
    root.append(go);
  }

  /** Nœud de l'arbre : nom, coût et durée ; état ou raison du verrou ; « Lancer » si disponible. Infobulle : les effets. */
  private sheet(m: Mission, done: boolean, run: MissionRun | undefined, lock: MissionLock | null, s: GameState): HTMLElement {
    const blocked = lock !== null && lock.key !== "mission.lock.slots" && lock.key !== "mission.lock.cost";
    const card = el("article", `planche ${done ? "planche--acquise" : run ? "planche--etude" : blocked ? "planche--verrou" : "planche--libre"}`);
    card.dataset["mission"] = m.id;
    card.dataset["etat"] = done ? "accomplie" : run ? "en-cours" : blocked ? "verrouillee" : "disponible";
    const head = el("header", "planche__tete");
    head.insertAdjacentHTML("afterbegin", icon(done ? "verifie" : run ? "horloge" : blocked ? "cadenas" : "journal", "ico ico--s"));
    head.append(el("h4", "", t(`mission.${m.id}`)));
    card.append(head);
    this.ctx.why.bind(card, () => this.tooltip(m, s));
    const meta = el("p", "registre-note", `${this.costText(m) || t("mission.free")} · ${this.durationText(m)}`);
    card.append(meta);
    if (done) card.append(el("p", "planche__etat", t("mission.state.done")));
    else if (run) card.append(el("p", "planche__etat", t("mission.months_left", { n: monthsLeft(run, s.date) })));
    else if (blocked && lock) {
      const text = this.lockTextFor(lock, m);
      const p = el("p", "plan-probleme", text);
      card.append(p);
    } else {
      const go = button(t("mission.start"), () => void this.ctx.dispatch({ type: "StartMission", mission: m.id }), "registre-bouton petit principal");
      go.dataset["action"] = "lancer-mission";
      if (lock) {
        go.disabled = true;
        card.append(el("p", "plan-probleme", this.lockTextFor(lock, m)));
      }
      card.append(go);
    }
    return card;
  }
}
