import { t } from "../../i18n";
import { fnv1a } from "../../sim/core/hash";
import { returnEffects } from "../../sim/military/expedition";
import { convoyProblem } from "../../sim/military/logistics";
import type { MilCtx } from "../../sim/military/expedition";
import { defaultSupplies, estimatePlan, planCapitalCost, planHeadcount, planProblem, preBrief } from "../../sim/military/plan";
import { routeKm, routeProblem, shortestRoute, supplyAt } from "../../sim/military/routes";
import type { DeadRecord, Expedition, ExpeditionPlan, ExpeditionReport, MilitaryState } from "../../sim/military/state";
import { readyMembers, soldierName } from "../../sim/military/state";
import { skirmishSetup } from "../../sim/tactical/setup";
import { FORMATIONS, OBJECTIVES, RETREAT_CONDITIONS } from "../../sim/military/vocabulary";
import { techMods } from "../../sim/research/research";
import type { Formation, Objective } from "../../sim/military/vocabulary";
import { formatNumber, formatSigned } from "../why";
import { button, displayName, el, paramLabel, provinceName, valueEl } from "./common";
import type { Panel, PanelContext } from "./common";

type Draft = Omit<ExpeditionPlan, "supplies" | "wagons"> & { supplies: ExpeditionPlan["supplies"]; wagons: number; manual: boolean };

const dateText = (d: { year: number; day: number }): string => t("date.format", { year: d.year, day: d.day });

/**
 * Registre des expéditions (P3) : expéditions en campagne, dépôts et convois, rapports, planificateur (04 §5.7),
 * rapport post-mission avec liste des morts et lettres aux familles (04 §5.12, F-CHR-09).
 */
export class ExpeditionsPanel implements Panel {
  readonly id = "expeditions" as const;
  private view: "registre" | "plan" | "rapport" | "lettre" = "registre";
  private draft: Draft | null = null;
  private trials = 0;

  constructor(
    private readonly ctx: PanelContext,
    private readonly redraw: () => void,
  ) {}

  private get mil(): MilitaryState | null {
    return this.ctx.state().military;
  }

  lateral(): boolean {
    return this.view === "plan";
  }

  draftRoute(): readonly string[] | null {
    return this.view === "plan" ? (this.draft?.route ?? null) : null;
  }

  /** Planificateur : un clic sur la carte prolonge l'itinéraire (plus court chemin depuis la dernière étape). */
  mapClick(province: string): boolean {
    if (this.view !== "plan" || !this.draft) return false;
    const geo = this.ctx.world.military?.geo;
    if (!geo) return false;
    const route = this.draft.route;
    const last = route[route.length - 1] as string;
    if (province === last) return true;
    const i = route.indexOf(province);
    if (i >= 0) this.draft.route = route.slice(0, i + 1);
    else {
      const leg = shortestRoute(geo, last, province);
      if (!leg) return true;
      const candidate = [...route, ...leg.slice(1)];
      if (!routeProblem(geo, candidate)) this.draft.route = candidate;
    }
    this.autoSupplies();
    this.redraw();
    return true;
  }

  render(root: HTMLElement, arg?: string): void {
    const mil = this.mil;
    if (!mil || !this.ctx.world.military) {
      root.append(el("p", "registre-ferme", t("panel.no_politics")));
      return;
    }
    const [view, a, b] = (arg ?? "registre").split(":");
    if (view === "plan") {
      this.view = "plan";
      if (!this.draft) this.newDraft();
      return this.planner(root);
    }
    if (view === "rapport" && a) {
      this.view = "rapport";
      const r = mil.reports.find((x) => x.id === a);
      if (r) return this.report(root, r);
    }
    if (view === "lettre" && a && b) {
      this.view = "lettre";
      const r = mil.reports.find((x) => x.id === a);
      const d = r?.dead.find((x) => x.id === b);
      if (r && d) return this.letter(root, r, d);
    }
    this.view = "registre";
    this.registry(root, mil);
  }

  // ——— Registre ———

  private registry(root: HTMLElement, mil: MilitaryState): void {
    const plan = button(t("exp.plan_new"), () => this.ctx.open("expeditions", "plan"), "registre-bouton principal");
    plan.dataset["action"] = "planifier";
    const ready = Object.values(mil.soldiers).filter((s) => s.status === "pret").length;
    const head = el("p", "registre-champ");
    head.append(t("exp.corps"), " ", valueEl(this.ctx, String(ready), () => ({ title: t("exp.corps"), sections: [{ text: t("exp.corps_why", { total: Object.keys(mil.soldiers).length, dead: Object.values(mil.soldiers).filter((s) => s.status === "mort").length, wounded: Object.values(mil.soldiers).filter((s) => s.status === "blesse").length }) }] })));
    root.append(head, plan);

    root.append(el("h3", "registre-intertitre", t("exp.active")));
    if (mil.expeditions.length === 0) root.append(el("p", "registre-note", t("exp.none_active")));
    for (const e of mil.expeditions) root.append(this.activeCard(e));

    root.append(el("h3", "registre-intertitre", t("exp.depots")));
    if (mil.depots.length === 0) root.append(el("p", "registre-note", t("exp.no_depot")));
    for (const d of mil.depots) root.append(this.depotCard(d.id));
    for (const c of mil.convoys) {
      const p = el("p", "registre-note");
      p.dataset["convoy"] = c.id;
      p.append(t("exp.convoy_line", { n: c.number, province: provinceName(this.ctx.world, c.path[c.path.length - 1] ?? ""), at: provinceName(this.ctx.world, c.path[0] ?? ""), escort: c.escort }));
      root.append(p);
    }

    root.append(el("h3", "registre-intertitre", t("exp.reports")));
    if (mil.reports.length === 0) root.append(el("p", "registre-note", t("exp.no_report")));
    const table = el("table", "registre-table");
    for (const r of [...mil.reports].reverse()) {
      const tr = el("tr");
      const td = el("td");
      const open = button(t("exp.report_title", { n: r.number }), () => this.ctx.open("expeditions", `rapport:${r.id}`), "lien-dossier");
      open.dataset["report"] = r.id;
      td.append(open);
      tr.append(td, el("td", "", dateText(r.returned)), el("td", `issue-${r.outcome}`, t(`outcome.${r.outcome}`)));
      const tdD = el("td");
      tdD.append(valueEl(this.ctx, `${r.dead.length} / ${r.stats.departed}`, () => ({ title: t("exp.dead"), sections: [{ text: t("exp.dead_why") }] })));
      tr.append(tdD);
      table.append(tr);
    }
    root.append(table);
    if (this.ctx.world.tactical) root.append(...this.trialBattle());
  }

  /** Bataille en attente (F-EXP-18) : la jouer sur l'écran tactique, ou l'auto-résoudre comme en P3. */
  private pendingBattle(e: Expedition): HTMLElement {
    const p = e.pending;
    const box = el("div", "exp-bataille");
    if (!p) return box;
    box.dataset["pending"] = e.id;
    const cls = this.ctx.world.military?.titans.find((x) => x.id === p.titan);
    box.append(el("p", "registre-alerte", t("exp.battle_pending", { province: provinceName(this.ctx.world, p.province), titan: cls ? t(cls.name_key) : p.titan, n: p.setup.soldiers.length, group: p.group })));
    const title = t("exp.battle_title", { n: e.number, province: provinceName(this.ctx.world, p.province) });
    const play = button(t("exp.battle_play"), () => {
      void this.ctx.playBattle(p.setup, title, true).then((orders) => {
        if (orders) void this.ctx.dispatch({ type: "ResolveBattle", expedition: e.id, mode: "jouer", orders }).then(() => this.redraw());
      });
    }, "registre-bouton principal petit");
    play.dataset["action"] = "jouer";
    const auto = button(t("exp.battle_auto"), () => {
      void this.ctx.dispatch({ type: "ResolveBattle", expedition: e.id, mode: "auto", orders: [] }).then(() => this.redraw());
    }, "registre-bouton petit");
    auto.dataset["action"] = "auto";
    box.append(play, " ", auto);
    return box;
  }

  /** Bataille d'essai (hors campagne, sans effet sur l'état) : carte, type de Titan, nombre, effectif. */
  private trialBattle(): HTMLElement[] {
    const tw = this.ctx.world.tactical;
    if (!tw) return [];
    const head = el("h3", "registre-intertitre", t("exp.trial"));
    const form = el("div", "exp-essai");
    const select = (name: string, opts: [string, string][]): HTMLSelectElement => {
      const sel = el("select", "plan-choix");
      sel.dataset["trial"] = name;
      for (const [v, label] of opts) {
        const o = el("option", "", label);
        o.value = v;
        sel.append(o);
      }
      return sel;
    };
    const num = (name: string, v: number, min: number, max: number): HTMLInputElement => {
      const i = el("input", "plan-nombre");
      i.type = "number";
      i.min = String(min);
      i.max = String(max);
      i.value = String(v);
      i.dataset["trial"] = name;
      return i;
    };
    const map = select("map", [...tw.maps.values()].map((m) => [m.id, t(m.name_key)]));
    const type = select("type", [...tw.titanTypes.values()].map((x) => [x.id, t(x.name_key)]));
    const count = num("count", 1, 1, 30);
    const men = num("men", 12, 1, 300);
    const night = el("input");
    night.type = "checkbox";
    night.dataset["trial"] = "night";
    const nightLab = el("label", "plan-case");
    nightLab.append(night, ` ${t("exp.trial_night")}`);
    const go = button(t("exp.trial_go"), () => {
      const n = Math.max(1, Math.min(300, Math.round(Number(men.value) || 12)));
      const c = Math.max(1, Math.min(30, Math.round(Number(count.value) || 1)));
      const seed = (fnv1a(`essai:${this.ctx.state().seed}:${this.trials++}`) % 2 ** 30) + 1;
      const setup = skirmishSetup(this.ctx.world, map.value, [{ type: type.value, count: c }], n, seed, night.checked);
      void this.ctx.playBattle(setup, t("exp.trial_title", { map: map.selectedOptions[0]?.textContent ?? map.value }), false);
    }, "registre-bouton");
    go.dataset["action"] = "essai";
    const l = (key: string, input: HTMLElement): HTMLLabelElement => {
      const lab = el("label", "plan-ligne");
      lab.append(`${t(key)} `, input);
      return lab;
    };
    form.append(el("p", "registre-note", t("exp.trial_note")), l("exp.trial_map", map), l("exp.trial_type", type), l("exp.trial_count", count), l("exp.trial_men", men), nightLab, go);
    return [head, form];
  }

  private activeCard(e: Expedition): HTMLElement {
    const box = el("article", "exp-carte");
    box.dataset["exp"] = e.id;
    const mil = this.mil;
    const alive = e.soldiers.filter((id) => mil?.soldiers[id]?.status !== "mort").length + e.officers.length;
    const head = el("header", "exp-carte-tete");
    head.append(el("h4", "", t("exp.title", { n: e.number })), el("span", "exp-phase", t(`exp.phase.${e.phase}`)));
    box.append(head);
    const line = el("p", "registre-champ");
    const gasPct = (100 * e.gasOdm) / Math.max(1, e.gasOdmStart);
    line.append(
      t("exp.where", { province: provinceName(this.ctx.world, e.path[0] ?? ""), day: e.day }),
      " · ",
      valueEl(this.ctx, `${alive} / ${e.stats.departed}`, () => ({ title: t("exp.headcount"), sections: [{ text: t("exp.headcount_why", { dead: e.dead.length + e.namedDead.length }) }] })),
      ` ${t("exp.men")} · ${t("exp.gas")} `,
      valueEl(this.ctx, `${formatNumber(gasPct)} %`, () => ({ title: t("exp.gas"), sections: [{ text: t("exp.gas_why", { odm: Math.round(e.gasOdm), start: Math.round(e.gasOdmStart) }) }] })),
      ` · ${t("exp.morale")} `,
      valueEl(this.ctx, formatNumber(e.morale), () => ({ title: t("exp.morale"), sections: [{ text: t("exp.morale_why") }] })),
    );
    box.append(line);
    const log = el("ul", "exp-journal");
    for (const l of e.log.slice(-4)) log.append(el("li", "", `${t("exp.day", { n: l.day })} — ${t(l.key, this.params(l.params))}`));
    box.append(log);
    if (e.pending) box.append(this.pendingBattle(e));
    if (e.phase !== "retour" && !e.pending) {
      const recall = button(t("exp.recall"), () => {
        void this.ctx.confirm(t("exp.confirm_recall", { n: e.number })).then((ok) => {
          if (ok) void this.ctx.dispatch({ type: "RecallExpedition", expedition: e.id }).then(() => this.redraw());
        });
      }, "registre-bouton petit");
      recall.dataset["action"] = "rappeler";
      box.append(recall);
    }
    return box;
  }

  private depotCard(id: string): HTMLElement {
    const mil = this.mil;
    const d = mil?.depots.find((x) => x.id === id);
    const box = el("article", "exp-depot");
    if (!d || !mil) return box;
    box.dataset["depot"] = d.id;
    const p = el("p", "registre-champ");
    p.append(t("exp.depot_line", { province: provinceName(this.ctx.world, d.province) }), " ");
    for (const r of ["food", "gas", "steel"] as const) p.append(`${t(`res.${r}`)} `, valueEl(this.ctx, formatNumber(d.stocks[r]), () => ({ title: t(`res.${r}`), sections: [{ text: t("exp.depot_why", { cap: this.ctx.world.military?.log.depot.capacity[r] ?? 0 }) }] })), " ");
    box.append(p);
    // Convoi type [A] : 4 chariots, 40 hommes d'escorte ; un convoi impossible affiche sa raison au lieu de partir.
    const order = { depot: d.id, cargo: { food: 80, gas: 40, steel: 10 }, wagons: 4, escort: 40 };
    const prob = this.convoyCheck(order);
    const send = button(t("exp.send_convoy"), () => {
      void this.ctx.confirm(t("exp.confirm_convoy", { province: provinceName(this.ctx.world, d.province) })).then((ok) => {
        if (ok) void this.ctx.dispatch({ type: "SendConvoy", order }).then(() => this.redraw());
      });
    }, "registre-bouton petit");
    send.dataset["action"] = "convoi";
    send.disabled = !!prob;
    box.append(send);
    if (prob) box.append(el("p", "plan-probleme", prob));
    return box;
  }

  private convoyCheck(order: { depot: string; cargo: { food: number; gas: number; steel: number }; wagons: number; escort: number }): string | null {
    const s = this.ctx.state();
    if (!s.strategic || !s.military || !this.ctx.world.military) return null;
    const mctx: MilCtx = { world: this.ctx.world, m: this.ctx.world.military, seed: s.seed, date: s.date, st: s.strategic, pol: s.politics, mil: s.military };
    const p = convoyProblem(mctx, order);
    return p ? t(p.key, this.params(p.params)) : null;
  }

  private params(p: Record<string, string | number>): Record<string, string | number> {
    const out: Record<string, string | number> = {};
    for (const [k, v] of Object.entries(p)) out[k] = paramLabel(this.ctx.world, v);
    return out;
  }

  // ——— Planificateur ———

  private newDraft(): void {
    const w = this.ctx.world;
    const m = w.military;
    const base = w.scenario.expedition_base;
    if (!m || !base) return;
    this.draft = {
      objective: "reconnaissance",
      route: [base],
      formation: "eventail",
      squads: [],
      officers: [],
      horses: 0,
      depotCargo: { food: 0, gas: 0, steel: 0 },
      retreat: { ...m.exp.retreat_defaults },
      supplies: { food: 0, gas: 0, steel: 0 },
      wagons: 0,
      manual: false,
    };
  }

  private plan(): ExpeditionPlan | null {
    const d = this.draft;
    if (!d) return null;
    const { manual: _manual, ...plan } = d;
    void _manual;
    return plan;
  }

  /** Provisions et chariots recalculés (sauf si le joueur les a saisis) ; un cheval par homme. */
  private autoSupplies(): void {
    const d = this.draft;
    const mil = this.mil;
    if (!d || !mil) return;
    d.horses = planHeadcount(mil, { ...d });
    if (d.manual) return;
    const s = defaultSupplies(this.ctx.world, mil, { ...d });
    d.supplies = s.supplies;
    d.wagons = s.wagons;
  }

  private planner(root: HTMLElement): void {
    const d = this.draft;
    const mil = this.mil;
    const s = this.ctx.state();
    const m = this.ctx.world.military;
    if (!d || !mil || !m || !s.strategic) return;
    const back = button(t("exp.back"), () => this.ctx.open("expeditions"), "registre-retour");
    root.append(back, el("p", "registre-note", t("exp.plan_help")));

    // Objectif et itinéraire.
    const goal = el("div", "plan-ligne");
    const objective = el("select", "registre-choix");
    objective.dataset["plan"] = "objectif";
    // « Capture » exige le protocole de capture (T-ANT-06, P5) : l'option est grisée et dit pourquoi.
    const canCapture = techMods(this.ctx.world, this.ctx.state().research).capture;
    for (const o of OBJECTIVES) {
      const opt = new Option(t(o === "capture" && !canCapture ? "objective.capture_locked" : `objective.${o}`), o, false, o === d.objective);
      opt.disabled = o === "capture" && !canCapture;
      objective.append(opt);
    }
    objective.addEventListener("change", () => {
      d.objective = objective.value as Objective;
      d.depotCargo = d.objective === "depot" ? { food: 60, gas: 60, steel: 10 } : { food: 0, gas: 0, steel: 0 };
      this.autoSupplies();
      this.redraw();
    });
    const target = el("select", "registre-choix");
    target.dataset["plan"] = "cible";
    target.append(new Option(t("exp.choose_target"), ""));
    const candidates = [...m.geo.nodes.keys()].filter((id) => s.strategic?.provinces[id]?.control !== "paradis").sort((x, y) => provinceName(this.ctx.world, x).localeCompare(provinceName(this.ctx.world, y)));
    const last = d.route[d.route.length - 1] as string;
    for (const id of candidates) target.append(new Option(provinceName(this.ctx.world, id), id, false, id === last));
    target.addEventListener("change", () => {
      const base = this.ctx.world.scenario.expedition_base ?? "";
      d.route = target.value ? (shortestRoute(m.geo, base, target.value) ?? [base]) : [base];
      this.autoSupplies();
      this.redraw();
    });
    const lab1 = el("label", "", t("exp.objective"));
    lab1.append(objective);
    const lab2 = el("label", "", t("exp.target"));
    lab2.append(target);
    goal.append(lab1, lab2);
    root.append(el("h3", "registre-intertitre", t("exp.section_route")), goal);
    const routeLine = el("ol", "plan-itineraire");
    for (const p of d.route) {
      const sup = supplyAt(this.ctx.world, s.strategic, mil, p);
      routeLine.append(el("li", sup.inSupply ? "ravitaille" : "hors-rayon", provinceName(this.ctx.world, p)));
    }
    root.append(routeLine);
    const km = routeKm(m.geo, d.route);
    const clear = button(t("exp.clear_route"), () => {
      d.route = [d.route[0] as string];
      this.autoSupplies();
      this.redraw();
    }, "registre-bouton petit");
    const kmP = el("p", "registre-note");
    kmP.append(t("exp.route_km"), " ", valueEl(this.ctx, formatNumber(km), () => ({ title: t("exp.route_km"), sections: [{ text: t("exp.route_km_why") }] })), " km ", clear);
    root.append(kmP);

    // Formation.
    root.append(el("h3", "registre-intertitre", t("exp.section_formation")));
    const forms = el("div", "plan-ligne");
    for (const f of FORMATIONS) {
      const lab = el("label", "plan-radio");
      const r = el("input");
      r.type = "radio";
      r.name = "formation";
      r.value = f;
      r.checked = d.formation === f;
      r.addEventListener("change", () => {
        d.formation = f as Formation;
        this.autoSupplies();
        this.redraw();
      });
      const fb = m.exp.formations[f];
      lab.append(r, ` ${t(`formation.${f}`)} `, valueEl(this.ctx, `${m.exp.pace_km_per_day[f]} km/j`, () => ({ title: t(`formation.${f}`), sections: [{ text: t("exp.formation_why", { detection: Math.round(fb.detection * 100), evasion: Math.round(fb.evasion * 100), engaged: Math.round(fb.engaged_share * 100), exposure: formatNumber(fb.exposure) }) }] })));
      forms.append(lab);
    }
    root.append(forms);

    // Composition.
    root.append(el("h3", "registre-intertitre", t("exp.section_squads")));
    const busy = new Set(mil.expeditions.flatMap((e) => e.plan.squads));
    const free = mil.squads.filter((sq) => !busy.has(sq.id) && readyMembers(mil, sq.id).length > 0);
    const quick = button(t("exp.first_squads", { n: 20 }), () => {
      d.squads = free.slice(0, 20).map((sq) => sq.id);
      this.autoSupplies();
      this.redraw();
    }, "registre-bouton petit");
    quick.dataset["action"] = "escouades";
    root.append(quick);
    const sqTable = el("table", "registre-table plan-escouades");
    for (const sq of free) {
      const tr = el("tr");
      const cb = el("input");
      cb.type = "checkbox";
      cb.dataset["squad"] = sq.id;
      cb.checked = d.squads.includes(sq.id);
      cb.addEventListener("change", () => {
        d.squads = cb.checked ? [...d.squads, sq.id] : d.squads.filter((x) => x !== sq.id);
        this.autoSupplies();
        this.redraw();
      });
      const leader = mil.soldiers[sq.members.find((id) => mil.soldiers[id]?.leader) ?? ""];
      const tdC = el("td");
      tdC.append(cb);
      const unit = this.ctx.world.military?.units.get(sq.unit);
      tr.append(tdC, el("td", "", sq.id.replace("esc_", "n° ")), el("td", "", unit ? t(unit.name_key) : sq.unit), el("td", "", leader ? soldierName(leader) : "—"));
      const tdN = el("td");
      tdN.append(valueEl(this.ctx, `${readyMembers(mil, sq.id).length} / ${sq.members.length}`, () => ({ title: t("exp.squad_ready"), sections: [{ text: t("exp.squad_ready_why") }] })));
      tr.append(tdN);
      sqTable.append(tr);
    }
    root.append(sqTable);
    const pw = this.ctx.world.politics;
    if (pw && s.politics) {
      const officers = [...pw.characters.values()].filter((c) => c.org === "org_survey_corps" && s.politics?.characters[c.id]?.alive && c.active_from <= s.date.year && !mil.expeditions.some((e) => e.officers.includes(c.id)));
      const offP = el("p", "plan-officiers");
      offP.append(t("exp.officers"), " ");
      for (const c of officers) {
        const lab = el("label", "plan-radio");
        const cb = el("input");
        cb.type = "checkbox";
        cb.dataset["officer"] = c.id;
        cb.checked = d.officers.includes(c.id);
        cb.addEventListener("change", () => {
          d.officers = cb.checked ? [...d.officers, c.id] : d.officers.filter((x) => x !== c.id);
          this.autoSupplies();
          this.redraw();
        });
        lab.append(cb, ` ${displayName(c)}`);
        offP.append(lab, " ");
      }
      root.append(offP);
    }

    // Table de logistique : provisions emportées et besoins estimés, avec incertitude.
    const plan = this.plan();
    if (!plan) return;
    const est = d.route.length > 1 && d.squads.length > 0 ? estimatePlan(this.ctx.world, s.strategic, mil, s.date, plan) : null;
    root.append(el("h3", "registre-intertitre", t("exp.section_logistics")));
    const logi = el("table", "registre-table plan-logistique");
    const head = el("tr");
    for (const h of ["exp.col.item", "exp.col.carried", "exp.col.need"]) head.append(el("th", "", t(h)));
    logi.append(head);
    const n = planHeadcount(mil, plan);
    const input = (key: string, value: number, set: (v: number) => void): HTMLInputElement => {
      const i = el("input");
      i.type = "number";
      i.min = "0";
      i.step = "1";
      i.value = String(Math.round(value));
      i.dataset["supply"] = key;
      i.className = "plan-nombre";
      i.addEventListener("change", () => {
        set(Math.max(0, Math.round(Number(i.value) || 0)));
        d.manual = true;
        this.redraw();
      });
      return i;
    };
    const gasNeed = est ? est.gasOdm.value / m.exp.odm_units_per_stock_unit : 0;
    const rows: [string, HTMLElement, HTMLElement | string][] = [
      [t("res.food"), input("food", d.supplies.food, (v) => (d.supplies.food = v)), est ? this.range(est.food.value, 0.8, 1.4, () => ({ title: t("res.food"), sections: [{ explained: est.food }, { text: t("exp.uncertainty") }] })) : "—"],
      [t("exp.gas_spare"), input("gas", d.supplies.gas, (v) => (d.supplies.gas = v)), est ? this.range(gasNeed, 0.5, 2.2, () => ({ title: t("exp.gas_spare"), sections: [{ explained: est.gasOdm }, { text: t("exp.gas_need_why", { tank: m.exp.odm_tank, k: m.exp.odm_units_per_stock_unit, n }) }] })) : "—"],
      [t("res.steel"), input("steel", d.supplies.steel, (v) => (d.supplies.steel = v)), "—"],
      [t("exp.wagons"), input("wagons", d.wagons, (v) => (d.wagons = v)), valueEl(this.ctx, formatNumber(Math.ceil((d.supplies.food + d.supplies.gas + d.supplies.steel + d.depotCargo.food + d.depotCargo.gas + d.depotCargo.steel) / m.log.convoy.wagon_capacity)), () => ({ title: t("exp.wagons"), sections: [{ text: t("exp.wagons_why", { cap: m.log.convoy.wagon_capacity }) }] }))],
      [t("res.horses"), valueEl(this.ctx, formatNumber(d.horses + d.wagons * m.log.convoy.horses_per_wagon), () => ({ title: t("res.horses"), sections: [{ text: t("exp.horses_why", { per: m.log.convoy.horses_per_wagon }) }] })), "—"],
    ];
    for (const [label, carried, need] of rows) {
      const tr = el("tr");
      const a = el("td");
      a.append(carried);
      const b = el("td");
      b.append(need);
      tr.append(el("td", "", label), a, b);
      logi.append(tr);
    }
    root.append(logi);

    // Plan de retrait.
    root.append(el("h3", "registre-intertitre", t("exp.section_retreat")));
    const ret = el("div", "plan-ligne");
    for (const c of RETREAT_CONDITIONS) {
      const lab = el("label", "", t(`exp.retreat.${c}`));
      const i = el("input");
      i.type = "number";
      i.min = "0";
      i.className = "plan-nombre";
      i.value = String(d.retreat[c]);
      i.dataset["retreat"] = c;
      i.addEventListener("change", () => {
        d.retreat = { ...d.retreat, [c]: Math.max(0, Number(i.value) || 0) };
        this.redraw();
      });
      lab.append(i);
      ret.append(lab);
    }
    root.append(ret);

    // Pré-brief (F-EXP-15).
    if (est) root.append(this.brief(est));
    // Choix de résolution (F-EXP-18) : auto-résolution, ou chaque engagement joué sur l'écran tactique (P4).
    const res = el("p", "registre-note");
    const cb = el("input");
    cb.type = "checkbox";
    cb.checked = !!d.play;
    cb.disabled = !this.ctx.world.tactical;
    cb.dataset["plan"] = "jouer";
    cb.addEventListener("change", () => {
      d.play = cb.checked;
      this.redraw();
    });
    const lab = el("label", "plan-case");
    lab.append(cb, ` ${t("exp.play")}`);
    lab.dataset["why"] = t("exp.play_why");
    res.append(t("exp.resolution"), " ", el("strong", "", t(d.play ? "exp.played" : "exp.auto")), " · ", lab);
    root.append(res);

    // Coût et départ.
    const cost = planCapitalCost(this.ctx.world, mil, plan);
    const costP = el("p", "registre-champ");
    costP.append(t("exp.cost"), " ", valueEl(this.ctx, formatNumber(cost.value), () => ({ title: t("exp.cost"), sections: [{ explained: cost }] })), ` ${t("hud.capital")}`);
    if (d.objective === "depot") costP.append(` · ${t("exp.depot_gold", { gold: m.log.depot.gold_cost })}`);
    root.append(costP);
    const prob = planProblem(this.ctx.world, s.strategic, s.politics, mil, s.date, plan);
    const probP = el("p", "plan-probleme", prob ? t(prob.key, this.params(prob.params)) : t("exp.plan_ok"));
    probP.dataset["ok"] = String(!prob);
    root.append(probP);
    const launch = button(t("exp.launch"), () => {
      void this.ctx.confirm(t("exp.confirm_launch", { n: planHeadcount(mil, plan), target: provinceName(this.ctx.world, plan.route[plan.route.length - 1] ?? "") })).then((ok) => {
        if (!ok) return;
        void this.ctx.dispatch({ type: "LaunchExpedition", plan }).then(() => {
          this.draft = null;
          this.ctx.open("expeditions");
        });
      });
    }, "registre-bouton principal");
    launch.dataset["action"] = "lancer";
    launch.disabled = !!prob;
    root.append(launch);
  }

  private range(v: number, lo: number, hi: number, why: Parameters<typeof valueEl>[2]): HTMLElement {
    return valueEl(this.ctx, `${formatNumber(v * lo)} – ${formatNumber(v * hi)}`, why);
  }

  private brief(est: ReturnType<typeof estimatePlan>): HTMLElement {
    const s = this.ctx.state();
    const box = el("section", "plan-brief");
    box.append(el("h3", "registre-intertitre", t("exp.section_brief")));
    const table = el("table", "registre-table");
    const row = (label: string, v: HTMLElement): void => {
      const tr = el("tr");
      const td = el("td");
      td.append(v);
      tr.append(el("td", "", label), td);
      table.append(tr);
    };
    row(t("exp.est_days"), valueEl(this.ctx, formatNumber(est.days.value), () => ({ title: t("exp.est_days"), sections: [{ explained: est.days }] })));
    row(t("exp.est_contacts"), valueEl(this.ctx, formatNumber(est.contacts.value), () => ({ title: t("exp.est_contacts"), sections: [{ explained: est.contacts }] })));
    row(t("exp.est_engagements"), valueEl(this.ctx, formatNumber(est.engagements.value), () => ({ title: t("exp.est_engagements"), sections: [{ explained: est.engagements }] })));
    row(t("exp.est_deaths"), valueEl(this.ctx, `${est.deathsLow} – ${est.deathsHigh}`, () => ({ title: t("exp.est_deaths"), sections: [{ label: t("exp.est_central"), explained: est.deaths }, { text: t("exp.uncertainty") }] })));
    box.append(table);
    const brief = preBrief(this.ctx.world, s.politics, s.date, est);
    const pw = this.ctx.world.politics;
    if (brief.strategist && brief.losses !== null) {
      const p = el("p", "plan-avis");
      p.append(t("exp.brief_strategist", { name: displayName(pw?.characters.get(brief.strategist)) }), " ", valueEl(this.ctx, formatNumber(brief.losses), () => ({ title: t("council.why_says"), sections: [{ text: t("council.estimated_reliability", { n: brief.reliability }) }, { text: brief.bias ? t("council.known_bias", { bias: t(`bias.${brief.bias}`) }) : t("council.no_bias") }, { text: t("council.caveat") }] })), ` ${t("exp.brief_dead")}`);
      box.append(p);
    }
    if (brief.intendant && brief.gas !== null) {
      const p = el("p", "plan-avis");
      p.append(t("exp.brief_intendant", { name: displayName(pw?.characters.get(brief.intendant)) }), " ", valueEl(this.ctx, formatNumber(brief.gas), () => ({ title: t("council.why_says"), sections: [{ text: t("council.estimated_reliability", { n: brief.gasReliability }) }, { text: brief.gasBias ? t("council.known_bias", { bias: t(`bias.${brief.gasBias}`) }) : t("council.no_bias") }, { text: t("council.caveat") }] })), ` ${t("exp.brief_gas")}`);
      box.append(p);
    }
    if (est.outside.length > 0) box.append(el("p", "registre-note", t("exp.outside", { list: est.outside.map((p) => provinceName(this.ctx.world, p)).join(", ") })));
    if (est.relays.length > 0) box.append(el("p", "registre-note", t("exp.relays", { list: est.relays.map((p) => provinceName(this.ctx.world, p)).join(", ") })));
    return box;
  }

  // ——— Rapport et lettres ———

  private report(root: HTMLElement, r: ExpeditionReport): void {
    root.append(button(t("exp.back"), () => this.ctx.open("expeditions"), "registre-retour"));
    const box = el("article", "rapport");
    box.dataset["report"] = r.id;
    const dead = r.dead.length;
    box.append(el("p", "rapport-telegramme", t("exp.telegram", { n: r.number, date: dateText(r.returned), outcome: t(`outcome.${r.outcome}`).toUpperCase(), dead, departed: r.stats.departed })));
    box.append(el("p", "registre-note", t("exp.report_line", { objective: t(`objective.${r.objective}`), target: provinceName(this.ctx.world, r.target), formation: t(`formation.${r.formation}`), days: r.days, launched: dateText(r.launched) })));
    if (r.retreat) box.append(el("p", "registre-note", t(`lesson.retreat_${r.retreat}`)));

    const stats = el("table", "registre-table rapport-stats");
    const st = r.stats;
    const statRows: [string, number][] = [
      ["encounters", st.encounters],
      ["detected", st.detected],
      ["evaded", st.evaded],
      ["engagements", st.engagements],
      ["abnormal", st.abnormal],
      ["titansKilled", st.titansKilled],
      ["wounded", st.wounded],
      ["horsesLost", st.horsesLost],
      ["gasUsedOdm", Math.round(st.gasUsedOdm)],
      ["daysOutside", st.daysOutside],
    ];
    for (const [k, v] of statRows) {
      const tr = el("tr");
      const td = el("td");
      td.append(valueEl(this.ctx, formatNumber(v), () => ({ title: t(`report.${k}`), sections: [{ text: t(`report.${k}_why`) }] })));
      tr.append(el("td", "", t(`report.${k}`)), td);
      stats.append(tr);
    }
    box.append(el("h3", "registre-intertitre", t("exp.section_stats")), stats);

    // Effets politiques (F-EXP-07) : modificateurs décroissants visibles dans le « pourquoi ? » des cibles.
    const fx = returnEffects(this.ctx.world, r.outcome !== "echec", (100 * dead) / Math.max(1, r.stats.departed));
    const pol = el("p", "registre-champ");
    pol.append(
      t("exp.politics_capital"),
      " ",
      valueEl(this.ctx, formatNumber(r.politics.capital), () => ({ title: t("exp.politics_capital"), sections: [{ text: t("exp.politics_capital_why") }] })),
      ` · ${t("hud.legitimacy")} `,
      valueEl(this.ctx, formatSigned(r.politics.legitimacy), () => ({ title: t("hud.legitimacy"), sections: [{ text: t("exp.politics_why", { days: this.ctx.world.military?.exp.politics.mourning_days ?? 0, v: formatSigned(fx.legitimacy) }) }] })),
      ` · ${t("exp.politics_corps")} `,
      valueEl(this.ctx, formatSigned(r.politics.corpsLoyalty), () => ({ title: t("exp.politics_corps"), sections: [{ text: t("exp.politics_why", { days: this.ctx.world.military?.exp.politics.mourning_days ?? 0, v: formatSigned(fx.corpsLoyalty) }) }] })),
    );
    box.append(pol);

    box.append(el("h3", "registre-intertitre", t("exp.section_signals")));
    const sig = el("ol", "rapport-signaux");
    for (const sgl of r.signals.slice(0, 40)) {
      const li = el("li", `fusee fusee-${sgl.color}`, t("exp.signal_line", { day: sgl.day, color: t(`signal.${sgl.color}`), province: provinceName(this.ctx.world, sgl.province) }));
      if (sgl.misread) li.append(" ", el("em", "", t("exp.misread")));
      sig.append(li);
    }
    box.append(sig);

    box.append(el("h3", "registre-intertitre", t("exp.section_log")));
    const log = el("ol", "rapport-journal");
    for (const l of r.log) log.append(el("li", "", `${t("exp.day", { n: l.day })} — ${t(l.key, this.params(l.params))}`));
    box.append(log);

    box.append(el("h3", "registre-intertitre", t("exp.section_lessons")));
    const lessons = el("ul", "rapport-lecons");
    for (const l of r.lessons) lessons.append(el("li", "", t(l.key, this.params(l.params))));
    box.append(lessons);

    box.append(el("h3", "registre-intertitre", t("exp.section_dead", { n: dead })));
    const list = el("table", "registre-table rapport-morts");
    for (const d of r.dead) {
      const tr = el("tr");
      const tdN = el("td");
      tdN.append(d.name, d.named ? ` (${t("exp.officer")})` : d.leader ? ` (${t("exp.squad_leader")})` : "");
      tr.append(tdN, el("td", "", d.squad ? d.squad.replace("esc_", "n° ") : "—"), el("td", "", t(`fieldcause.${d.cause}`)), el("td", "", provinceName(this.ctx.world, d.province)), el("td", "", dateText(d.date)));
      const tdL = el("td");
      const letter = button(t("exp.letter"), () => this.ctx.open("expeditions", `lettre:${r.id}:${d.id}`), "registre-bouton petit");
      letter.dataset["lettre"] = d.id;
      tdL.append(letter);
      tr.append(tdL);
      list.append(tr);
    }
    box.append(list);
    root.append(box);
  }

  /** Lettre à la famille (F-CHR-09) : modèle choisi par le défunt (stable), ton sobre (04 §5.12). */
  private letter(root: HTMLElement, r: ExpeditionReport, d: DeadRecord): void {
    root.append(button(t("exp.back_report"), () => this.ctx.open("expeditions", `rapport:${r.id}`), "registre-retour"));
    const s = this.ctx.state();
    const pw = this.ctx.world.politics;
    const leader = s.politics?.orgs["org_survey_corps"]?.leader;
    const signer = leader && pw ? displayName(pw.characters.get(leader)) : t("letter.signer_default");
    const variant = (fnv1a(d.id) % 3) + 1;
    const box = el("article", "lettre");
    box.dataset["letter"] = d.id;
    box.append(el("p", "lettre-date", dateText(r.returned)));
    box.append(el("p", "lettre-corps", t(`letter.v${variant}`, { name: d.name, date: dateText(d.date), place: provinceName(this.ctx.world, d.province), cause: t(`letter.cause.${d.cause}`), n: r.number })));
    box.append(el("p", "lettre-signature", signer));
    root.append(box);
  }
}
