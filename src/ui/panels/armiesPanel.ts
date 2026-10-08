import { t } from "../../i18n";
import { armyStrength } from "../../sim/armies/ai";
import { canPlay, encounterSetup, fleetCapacity, orderProblem, visibleProvinces } from "../../sim/armies/armies";
import type { ArmyCtx, ArmyOrder } from "../../sim/armies/armies";
import { armiesWorld, armyMen, armyPieces, playerOf } from "../../sim/armies/state";
import type { ArmiesState, ArmyState, Encounter, FleetState } from "../../sim/armies/state";
import type { GameState } from "../../sim/core/state";
import { shortestRoute } from "../../sim/military/routes";
import { authorOnly } from "../authorMode";
import { nationName } from "../hud";
import { gauge, sep, tag } from "../kit";
import { formatNumber } from "../why";
import { button, displayName, el, masterDetail, paramLabel, provinceName, valueEl } from "./common";
import type { Panel, PanelContext } from "./common";

/** Contexte de lecture des armées pour l'interface (aucune mutation : seules les commandes changent l'état). */
export function armyCtxOf(world: PanelContext["world"], s: GameState): ArmyCtx | null {
  if (!world.armies || !s.armies || !s.strategic) return null;
  return { world, aw: armiesWorld(world), seed: s.seed, date: s.date, s: s.armies, st: s.strategic, pol: s.politics, ns: s.nations, research: s.research, events: s.events };
}

/** Rencontre en attente qui concerne le joueur (alerte de contact, PA.8). */
export function pendingEncounter(s: GameState): Encounter | null {
  const a = s.armies;
  if (!a) return null;
  const me = playerOf(s.nations);
  return a.encounters.find((e) => e.status === "attente" && e.sides.some((x) => x.faction === me)) ?? null;
}

const pct = (v: number): string => `${formatNumber(Math.round(v))} %`;

/**
 * Registre des armées (PA.8) : piles du joueur et flottes, ordres (marche par clic sur la carte, marche forcée, halte,
 * retraite, interception, fusion, division, garnison, général), fiche d'artillerie, rencontres en attente (résolution
 * rapide, bataille, repli), crise de succession ; journal de raisonnement des IA en mode auteur.
 */
export class ArmiesPanel implements Panel {
  readonly id = "armees" as const;
  private selected: string | null = null;
  private picking = false;
  private dest: string | null = null;
  private splitRegiment: string | null = null;

  constructor(
    private readonly ctx: PanelContext,
    private readonly redraw: () => void,
  ) {}

  lateral(): boolean {
    return true;
  }

  draftRoute(): readonly string[] | null {
    const s = this.ctx.state();
    const a = s.armies?.armies.find((x) => x.id === this.selected);
    if (!a?.province || !this.dest || !this.ctx.world.military) return null;
    return shortestRoute(this.ctx.world.military.geo, a.province, this.dest);
  }

  mapClick(province: string): boolean {
    if (!this.picking) return false;
    this.dest = province;
    this.redraw();
    return true;
  }

  /** Clic sur un étendard de la carte : la fiche de cette armée s'ouvre. */
  selectArmy(id: string): void {
    this.selected = id;
    this.picking = false;
    this.dest = null;
  }

  get selectedArmy(): string | null {
    return this.selected;
  }

  private order(o: ArmyOrder): void {
    void this.ctx.dispatch(o);
  }

  render(root: HTMLElement, arg?: string): void {
    const s = this.ctx.state();
    const c = armyCtxOf(this.ctx.world, s);
    if (!c) {
      root.append(el("p", "registre-ferme", t("army.err.no_layer")));
      return;
    }
    if (arg && c.s.armies.some((a) => a.id === arg)) this.selected = arg;
    const me = playerOf(c.ns);
    this.encounters(root, c, me);
    this.succession(root, c);
    const mine = c.s.armies.filter((a) => a.faction === me);
    const fleets = c.s.fleets.filter((f) => f.faction === me);
    if (!mine.some((a) => a.id === this.selected) && !fleets.some((f) => f.id === this.selected)) this.selected = mine[0]?.id ?? fleets[0]?.id ?? null;
    const md = masterDetail(root, "armees", "armees");
    const list = el("ul", "liste");
    list.setAttribute("role", "listbox");
    list.setAttribute("aria-label", t("panel.armees"));
    for (const a of mine) list.append(this.row(c, a));
    for (const f of fleets) list.append(this.fleetRow(c, f));
    if (mine.length === 0 && fleets.length === 0) list.append(el("li", "registre-note", t("armies.none")));
    md.master.append(list);
    // Ennemis en vue (brouillard : seules les provinces vues).
    const seen = visibleProvinces(c, me);
    const foes = c.s.armies.filter((a) => a.faction !== me && a.province && seen.has(a.province));
    if (foes.length) {
      md.master.append(sep(t("armies.in_sight")));
      const ul = el("ul", "liste");
      for (const a of foes) ul.append(el("li", "liste__item liste__item--eteint", `${t(a.name_key)} — ${provinceName(this.ctx.world, a.province as string)} · ${formatNumber(Math.round(armyMen(c.aw, a)))}`));
      md.master.append(ul);
    }
    const army = mine.find((a) => a.id === this.selected);
    const fleet = fleets.find((f) => f.id === this.selected);
    if (army) this.armyDetail(md.detail, c, army, me);
    else if (fleet) this.fleetDetail(md.detail, c, fleet, me);
    md.done();
    this.sieges(root, c);
    this.journal(root, c);
  }

  private row(c: ArmyCtx, a: ArmyState): HTMLLIElement {
    const li = el("li", "liste__item");
    li.dataset["army"] = a.id;
    li.setAttribute("role", "option");
    li.setAttribute("aria-selected", String(a.id === this.selected));
    li.tabIndex = 0;
    const where = a.fleet ? t("armies.aboard") : a.province ? provinceName(this.ctx.world, a.province) : "—";
    const mid = el("span", "liste__milieu");
    mid.append(el("span", "liste__titre", t(a.name_key)), el("span", "liste__meta", ` ${where}`));
    const stance = a.engaged ? tag(t("armies.engaged"), "danger") : tag(t(`armies.stance.${a.stance}`), a.stance === "retraite" ? "alerte" : a.stance === "marche" ? "info" : "neutre");
    const trail = el("span", "liste__queue");
    trail.append(valueEl(this.ctx, formatNumber(Math.round(armyMen(c.aw, a))), () => ({ title: t("armies.men"), sections: [{ text: t("armies.men_why") }] })), " ", stance);
    li.append(mid, trail);
    const pick = (): void => {
      this.selectArmy(a.id);
      this.redraw();
    };
    li.addEventListener("click", pick);
    li.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        pick();
      }
    });
    return li;
  }

  private fleetRow(c: ArmyCtx, f: FleetState): HTMLLIElement {
    const li = el("li", "liste__item");
    li.dataset["fleet"] = f.id;
    li.setAttribute("aria-selected", String(f.id === this.selected));
    li.tabIndex = 0;
    const mid = el("span", "liste__milieu");
    mid.append(el("span", "liste__titre", t(f.name_key)), el("span", "liste__meta", ` ${t(c.aw.seas.get(f.sea)?.name_key ?? f.sea)}`));
    li.append(mid, el("span", "liste__queue", formatNumber(f.ships.reduce((n, x) => n + x.count, 0))));
    li.addEventListener("click", () => {
      this.selectArmy(f.id);
      this.redraw();
    });
    return li;
  }

  private armyDetail(d: HTMLElement, c: ArmyCtx, a: ArmyState, me: string): void {
    const general = a.general ? displayName(this.ctx.world.politics?.characters.get(a.general)) : t(a.general_key);
    const head = el("header", "armee__tete");
    head.append(el("h3", "", t(a.name_key)), el("p", "registre-note", `${t("armies.general")} : ${general}${a.interim && a.general ? ` (${t("army.general.interim")})` : ""}`));
    d.append(head);
    const men = armyMen(c.aw, a);
    const kv = el("div", "armee__valeurs");
    kv.append(
      gauge(t("armies.men"), valueEl(this.ctx, formatNumber(Math.round(men)), () => ({ title: t("armies.men"), sections: [{ rows: a.regiments.map((r) => ({ label: `${t(c.aw.regiments.get(r.regiment)?.name_key ?? r.regiment)} × ${r.count}`, value: formatNumber(Math.round((c.aw.regiments.get(r.regiment)?.men ?? 0) * r.count * r.strength)) })) }, { text: t("armies.men_why") }] })), 1),
      gauge(t("armies.morale"), valueEl(this.ctx, pct(a.morale), () => ({ title: t("armies.morale"), sections: [{ text: t("armies.morale_why", { base: c.aw.balance.morale.base, rout: c.aw.balance.morale.rout_below }) }] })), a.morale / 100, { tone: a.morale < c.aw.balance.morale.rout_below + 10 ? "danger" : "accent", mark: c.aw.balance.morale.rout_below / 100 }),
      gauge(t("armies.supply"), valueEl(this.ctx, t("armies.days", { n: formatNumber(Math.round(a.supply)) }), () => ({ title: t("armies.supply"), sections: [{ text: t("armies.supply_why", { max: c.aw.balance.supply.max_days }) }] })), a.supply / c.aw.balance.supply.max_days, { tone: a.supply < 5 ? "alerte" : "accent" }),
      gauge(t("armies.fatigue"), valueEl(this.ctx, pct(a.fatigue), () => ({ title: t("armies.fatigue"), sections: [{ text: t("armies.fatigue_why", { cap: c.aw.balance.move.march_fatigue_cap }) }] })), a.fatigue / 100, { tone: a.fatigue > 60 ? "alerte" : "neutre" }),
    );
    d.append(kv);
    const strength = armyStrength(c, a);
    d.append(el("p", "registre-note", `${t("armies.strength")} : ${formatNumber(Math.round(strength))}`));
    // Trajet.
    if (a.route.length) d.append(el("p", "plan-ligne", `${t("armies.route")} : ${[a.province ?? "", ...a.route].map((p) => provinceName(this.ctx.world, p)).join(" → ")}${a.forced ? ` · ${t("armies.forced")}` : ""}`));
    // Régiments et fiche d'artillerie.
    d.append(sep(t("armies.regiments")));
    const ul = el("ul", "registre-liste armee__regiments");
    for (const r of a.regiments) {
      const def = c.aw.regiments.get(r.regiment);
      const li = el("li", "", `${t(def?.name_key ?? r.regiment)} × ${r.count} — ${formatNumber(Math.round((def?.men ?? 0) * r.count * r.strength))} ${t("armies.men_short")} (${pct(r.strength * 100)})`);
      li.dataset["regiment"] = r.regiment;
      ul.append(li);
    }
    d.append(ul);
    const pieces = armyPieces(c.aw, a);
    if (pieces.length) {
      d.append(sep(t("armies.artillery")));
      // Fiche d'artillerie : une ligne par pièce (portée, cadence, souffle, munitions), lisible dans une colonne étroite.
      const ul2 = el("ul", "registre-liste armee__artillerie");
      for (const p of pieces) {
        const def = c.aw.pieces.get(p.piece);
        if (!def) continue;
        const li = el("li");
        li.dataset["piece"] = p.piece;
        const ammo = def.ammo.map((m) => t(c.aw.munitions.get(m)?.name_key ?? m)).join(", ");
        li.append(el("strong", "", `${t(def.name_key)} × ${formatNumber(p.count)}`), el("br"), t("armies.art.line", { range: formatNumber(def.range_m), rate: formatNumber(def.rate_per_min), blast: formatNumber(def.blast_m), ammo }));
        ul2.append(li);
      }
      d.append(ul2);
    }
    // Ordres.
    d.append(sep(t("armies.orders")));
    if (a.engaged) {
      d.append(el("p", "plan-probleme", t("army.err.engaged")));
      return;
    }
    const problem = (o: ArmyOrder): string | null => orderProblem(c, me, o);
    const go = (label: string, o: ArmyOrder, action: string, cls = "registre-bouton petit"): HTMLButtonElement => {
      const p = problem(o);
      const b = button(label, () => this.order(o), cls);
      b.dataset["action"] = action;
      if (p) {
        b.disabled = true;
        b.title = t(p);
      }
      return b;
    };
    const line = el("p", "plan-ligne");
    const pick = button(this.picking ? t("armies.pick_cancel") : t("armies.pick"), () => {
      this.picking = !this.picking;
      if (!this.picking) this.dest = null;
      this.redraw();
    }, `registre-bouton petit${this.picking ? " principal" : ""}`);
    pick.dataset["action"] = "choisir";
    line.append(pick);
    if (this.dest) {
      const o: ArmyOrder = { type: "ArmyMove", army: a.id, to: this.dest };
      const b = button(t("armies.march_to", { place: provinceName(this.ctx.world, this.dest) }), () => {
        this.picking = false;
        this.dest = null;
        this.order(o);
      }, "registre-bouton petit principal");
      b.dataset["action"] = "marcher";
      const p = problem(o);
      if (p) {
        b.disabled = true;
        line.append(" ", el("span", "plan-probleme", t(p)));
      }
      line.append(" ", b);
    }
    d.append(line);
    const row = el("p", "plan-ligne");
    row.append(
      go(a.forced ? t("armies.forced_off") : t("armies.forced_on"), { type: "ArmyForcedMarch", army: a.id, on: !a.forced }, "forcee"),
      " ",
      go(t("armies.halt"), { type: "ArmyHalt", army: a.id }, "halte"),
      " ",
      go(t("armies.retreat"), { type: "ArmyRetreat", army: a.id }, "retraite"),
    );
    d.append(row);
    // Interception d'une armée ennemie en vue.
    const seen = visibleProvinces(c, me);
    const foes = c.s.armies.filter((x) => x.faction !== me && x.province && seen.has(x.province) && !problem({ type: "ArmyIntercept", army: a.id, target: x.id }));
    if (foes.length) {
      const sel = el("select", "plan-choix");
      sel.dataset["target"] = a.id;
      for (const f of foes) {
        const o = el("option", "", `${t(f.name_key)} (${provinceName(this.ctx.world, f.province as string)})`);
        o.value = f.id;
        sel.append(o);
      }
      const b = button(t("armies.intercept"), () => this.order({ type: "ArmyIntercept", army: a.id, target: sel.value }), "registre-bouton petit");
      b.dataset["action"] = "intercepter";
      const p = el("p", "plan-ligne");
      p.append(sel, " ", b);
      d.append(p);
    }
    // Fusion avec une armée de la même province.
    const mates = c.s.armies.filter((x) => x.id !== a.id && x.faction === me && x.province === a.province && !x.fleet);
    if (mates.length) {
      const sel = el("select", "plan-choix");
      for (const m of mates) {
        const o = el("option", "", t(m.name_key));
        o.value = m.id;
        sel.append(o);
      }
      const b = button(t("armies.merge"), () => this.order({ type: "ArmyMerge", army: a.id, into: sel.value }), "registre-bouton petit");
      b.dataset["action"] = "fusionner";
      const p = el("p", "plan-ligne");
      p.append(t("armies.merge_into"), " ", sel, " ", b);
      d.append(p);
    }
    // Division : un régiment (un exemplaire) part en détachement, sous un général libre ou un intérimaire.
    if (a.regiments.reduce((n, r) => n + r.count, 0) > 1) {
      const sel = el("select", "plan-choix");
      sel.dataset["split"] = a.id;
      for (const r of a.regiments) {
        const o = el("option", "", t(c.aw.regiments.get(r.regiment)?.name_key ?? r.regiment));
        o.value = r.regiment;
        o.selected = r.regiment === this.splitRegiment;
        sel.append(o);
      }
      sel.addEventListener("change", () => {
        this.splitRegiment = sel.value;
      });
      const b = button(t("armies.split"), () => this.order({ type: "ArmySplit", army: a.id, regiments: [{ regiment: sel.value, count: 1 }], general: null }), "registre-bouton petit");
      b.dataset["action"] = "diviser";
      const p = el("p", "plan-ligne");
      p.append(t("armies.split_label"), " ", sel, " ", b);
      d.append(p);
    }
    // Garnison de la province tenue : déposer ou prélever 100 hommes.
    const gl = el("p", "plan-ligne");
    gl.append(go(t("armies.garrison_in"), { type: "ArmyGarrison", army: a.id, mode: "deposer", soldiers: 100 }, "deposer"), " ", go(t("armies.garrison_out"), { type: "ArmyGarrison", army: a.id, mode: "prelever", soldiers: 100 }, "prelever"));
    d.append(gl);
    // Général : personnages qui peuvent prendre ce commandement.
    const chars = [...(this.ctx.world.politics?.characters.values() ?? [])].filter((ch) => ch.id !== a.general && !problem({ type: "ArmySetGeneral", army: a.id, general: ch.id }));
    if (chars.length) {
      const sel = el("select", "plan-choix");
      sel.dataset["general"] = a.id;
      for (const ch of chars.slice(0, 40)) {
        const o = el("option", "", displayName(ch));
        o.value = ch.id;
        sel.append(o);
      }
      const b = button(t("armies.set_general"), () => this.order({ type: "ArmySetGeneral", army: a.id, general: sel.value }), "registre-bouton petit");
      b.dataset["action"] = "general";
      const p = el("p", "plan-ligne");
      p.append(sel, " ", b);
      d.append(p);
    }
  }

  private fleetDetail(d: HTMLElement, c: ArmyCtx, f: FleetState, me: string): void {
    d.append(el("h3", "", t(f.name_key)));
    const cap = fleetCapacity(c.aw, f);
    d.append(el("p", "registre-note", `${t(c.aw.seas.get(f.sea)?.name_key ?? f.sea)} · ${t(`armies.mission.${f.mission}`)} · ${t("armies.capacity", { n: formatNumber(cap) })}`));
    const ul = el("ul", "registre-liste");
    for (const sh of f.ships) ul.append(el("li", "", `${t(c.aw.ships.get(sh.ship)?.name_key ?? sh.ship)} × ${sh.count}`));
    d.append(ul);
    if (f.embarked.length) d.append(el("p", "plan-ligne", `${t("armies.embarked")} : ${f.embarked.map((id) => t(c.s.armies.find((a) => a.id === id)?.name_key ?? id)).join(", ")}`));
    d.append(sep(t("armies.orders")));
    const seaSel = el("select", "plan-choix");
    for (const sea of c.aw.seas.values()) {
      if (sea.id === f.sea) continue;
      const o = el("option", "", t(sea.name_key));
      o.value = sea.id;
      seaSel.append(o);
    }
    const mv = button(t("armies.sail"), () => this.order({ type: "FleetMove", fleet: f.id, to: seaSel.value }), "registre-bouton petit");
    mv.dataset["action"] = "naviguer";
    const p1 = el("p", "plan-ligne");
    p1.append(seaSel, " ", mv);
    d.append(p1);
    const coasts = c.aw.seas.get(f.sea)?.coasts ?? [];
    for (const id of f.embarked) {
      if (!coasts.length) break;
      const sel = el("select", "plan-choix");
      for (const p of coasts) {
        const o = el("option", "", provinceName(this.ctx.world, p));
        o.value = p;
        sel.append(o);
      }
      const b = button(t("armies.land"), () => this.order({ type: "FleetLand", fleet: f.id, army: id, province: sel.value }), "registre-bouton petit principal");
      b.dataset["action"] = "debarquer";
      const p = el("p", "plan-ligne");
      p.append(t(c.s.armies.find((a) => a.id === id)?.name_key ?? id), " ", sel, " ", b);
      d.append(p);
    }
    const ashore = c.s.armies.filter((a) => a.faction === me && a.province && coasts.includes(a.province) && !orderProblem(c, me, { type: "FleetEmbark", fleet: f.id, army: a.id }));
    for (const a of ashore) {
      const b = button(t("armies.embark", { army: t(a.name_key) }), () => this.order({ type: "FleetEmbark", fleet: f.id, army: a.id }), "registre-bouton petit");
      b.dataset["action"] = "embarquer";
      d.append(b, " ");
    }
    const ml = el("p", "plan-ligne");
    for (const m of ["patrouille", "blocus", "escorte"] as const) {
      const b = button(t(`armies.mission.${m}`), () => this.order({ type: "FleetMission", fleet: f.id, mission: m }), `registre-bouton petit${f.mission === m ? " principal" : ""}`);
      ml.append(b, " ");
    }
    d.append(ml);
  }

  /** Rencontres en attente : alerte de contact, rapport de force, trois issues. */
  private encounters(root: HTMLElement, c: ArmyCtx, me: string): void {
    for (const e of c.s.encounters.filter((x) => x.status === "attente" && x.sides.some((s) => s.faction === me))) {
      const box = el("section", "armee__rencontre");
      box.dataset["encounter"] = e.id;
      box.setAttribute("role", "alert");
      box.append(el("h3", "", t(`armies.encounter.${e.kind}`, { place: provinceName(this.ctx.world, e.province) })));
      const sides = e.sides.map((s) => {
        const men = s.armies.reduce((n, id) => {
          const a = c.s.armies.find((x) => x.id === id);
          return n + (a ? armyMen(c.aw, a) : 0);
        }, 0);
        return `${nationName(s.faction)} : ${formatNumber(Math.round(men))}`;
      });
      if (e.titans > 0) sides.push(t("armies.titans", { n: formatNumber(e.titans) }));
      box.append(el("p", "registre-note", sides.join(" · ")));
      const row = el("p", "plan-ligne");
      const auto = button(t("armies.resolve_auto"), () => void this.ctx.dispatch({ type: "ResolveEncounter", encounter: e.id, mode: "auto", orders: [] }), "registre-bouton petit principal");
      auto.dataset["action"] = "auto";
      row.append(auto, " ");
      if (canPlay(c, e)) {
        const play = button(t("armies.resolve_play"), () => void this.play(e.id), "registre-bouton petit");
        play.dataset["action"] = "jouer";
        row.append(play, " ");
      }
      const flee = button(t("armies.resolve_retreat"), () => void this.ctx.dispatch({ type: "ResolveEncounter", encounter: e.id, mode: "retraite", orders: [] }), "registre-bouton petit btn--danger");
      flee.dataset["action"] = "repli";
      row.append(flee);
      box.append(row);
      root.append(box);
    }
  }

  private async play(id: string): Promise<void> {
    const s = this.ctx.state();
    const c = armyCtxOf(this.ctx.world, s);
    const setup = c ? encounterSetup(c, id) : null;
    const e = c?.s.encounters.find((x) => x.id === id);
    if (!setup || !e) return;
    const orders = await this.ctx.playBattle(setup, t(`armies.encounter.${e.kind}`, { place: provinceName(this.ctx.world, e.province) }), true);
    if (orders) await this.ctx.dispatch({ type: "ResolveEncounter", encounter: id, mode: "jouer", orders });
  }

  private succession(root: HTMLElement, c: ArmyCtx): void {
    const cr = c.s.succession;
    if (!cr) return;
    const box = el("section", "armee__succession");
    box.setAttribute("role", "alert");
    const dead = displayName(this.ctx.world.politics?.characters.get(cr.deceased));
    box.append(el("h3", "", t("armies.succession_title", { name: dead })), el("p", "registre-note", t("armies.succession_text")));
    for (const cl of cr.claimants) {
      const ch = this.ctx.world.politics?.characters.get(cl.id);
      const line = el("p", "plan-ligne");
      line.append(
        el("strong", "", displayName(ch)),
        " ",
        valueEl(this.ctx, formatNumber(Math.round(cl.claim)), () => ({ title: t("armies.claim"), sections: [{ rows: cl.reasons.map((r) => ({ label: t(r.key), value: formatNumber(Math.round(r.value)) })) }] })),
        " ",
      );
      const b = button(t("armies.choose_successor"), () => {
        void this.ctx.confirm(t("armies.choose_confirm", { name: displayName(ch) })).then((ok) => {
          if (ok) void this.ctx.dispatch({ type: "ChooseSuccessor", candidate: cl.id });
        });
      }, "registre-bouton petit principal");
      b.dataset["candidate"] = cl.id;
      line.append(b);
      box.append(line);
    }
    root.append(box);
  }

  private sieges(root: HTMLElement, c: ArmyCtx): void {
    const list = c.s.sieges;
    if (!list.length) return;
    root.append(sep(t("armies.sieges")));
    const ul = el("ul", "registre-liste");
    for (const sg of list) {
      const wall = c.st.provinces[sg.segment]?.wall_structure ?? 0;
      ul.append(el("li", sg.breached ? "plan-probleme" : "", `${provinceName(this.ctx.world, sg.segment)} — ${t("armies.wall")} ${pct(wall)}${sg.breached ? ` · ${t("armies.breached")}` : ""}`));
    }
    root.append(ul);
  }

  private journal(root: HTMLElement, c: ArmyCtx): void {
    const s: ArmiesState = c.s;
    if (s.log.length) {
      const det = el("details", "armee__journal");
      det.append(el("summary", "", t("armies.log")));
      const ul = el("ul", "registre-liste");
      for (const l of [...s.log].reverse().slice(0, 12)) {
        const params: Record<string, string | number> = {};
        for (const [k, v] of Object.entries(l.params)) params[k] = paramLabel(this.ctx.world, v);
        ul.append(el("li", "", t(l.key, params)));
      }
      det.append(ul);
      root.append(det);
    }
    // Journal de raisonnement des IA (mode auteur seulement).
    const ai = authorOnly(el("details", "armee__ia"));
    ai.append(el("summary", "", t("armies.ai_log")));
    const ul = el("ul", "registre-liste");
    for (const d of [...s.ai].reverse().slice(0, 15)) ul.append(el("li", "", `${d.faction} · ${d.army} — ${d.action} : ${d.reasons.map((r) => `${t(r.key)} ${formatNumber(r.value)}`).join(" ; ")}`));
    ai.append(ul);
    root.append(ai);
  }
}
