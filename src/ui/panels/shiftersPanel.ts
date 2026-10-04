import type { Shifter, ShifterAbility } from "../../data/schemas";
import { t } from "../../i18n";
import { fnv1a } from "../../sim/core/hash";
import { fromAbsoluteDay } from "../../sim/core/time";
import { secretOf } from "../../sim/intel/intel";
import { founderLock, inheritCosts, inheritProblem, retireProblem, yearsLeft } from "../../sim/shifters/shifters";
import type { ShifterSlot, ShiftersState } from "../../sim/shifters/shifters";
import { skirmishSetup } from "../../sim/tactical/setup";
import { isDomestic } from "../../sim/politics/vocabulary";
import type { GameState } from "../../sim/core/state";
import { button, displayName, el, stamp, valueEl } from "./common";
import type { Panel, PanelContext } from "./common";
import { formatNumber } from "../why";

/**
 * Registre des porteurs (P6 ; 02 §10, 03 §8) : une fiche par Titan — porteur (masqué tant que son secret n'est pas
 * percé), horloge des 13 ans expliquée, capacités, héritage préparé avec ses coûts prévus, retrait du service ;
 * dossiers d'héritage ; bataille d'essai avec un porteur.
 */
export class ShiftersPanel implements Panel {
  readonly id = "porteurs" as const;
  private heir = new Map<string, string>();
  private trials = 0;

  constructor(private readonly ctx: PanelContext) {}

  render(root: HTMLElement): void {
    const s = this.ctx.state();
    const sh = s.shifters;
    const sw = this.ctx.world.shifters;
    if (!sh || !sw) {
      root.append(el("p", "registre-ferme", t("shifters.closed")));
      return;
    }
    const head = el("p", "registre-champ");
    head.append(t("shifters.serum"), " ", valueEl(this.ctx, String(sh.serum), () => ({ title: t("shifters.serum"), sections: [{ text: t("shifters.serum_why") }] })));
    root.append(head);
    const lock = founderLock(this.ctx.world, s.events?.flags ?? {});
    root.append(el("p", lock ? "plan-probleme" : "registre-note", lock ? t(lock) : t("shifters.founder_open")));
    const board = el("div", "planches");
    for (const d of sw.order) {
      const slot = sh.titans[d.id];
      if (slot) board.append(this.sheet(s, sh, d, slot));
    }
    root.append(board);
    root.append(...this.history(sh), ...this.trial());
  }

  /** Le porteur est-il connu de Paradis ? (secret percé, ou porteur sans secret) */
  private known(s: GameState, slot: ShifterSlot): boolean {
    if (!slot.holder) return true;
    const secret = secretOf(this.ctx.world, slot.holder);
    return !secret || (s.intel?.secrets[secret]?.revealed ?? false);
  }

  private sheet(s: GameState, sh: ShiftersState, d: Shifter, slot: ShifterSlot): HTMLElement {
    const known = this.known(s, slot);
    const card = el("article", `planche porteur porteur--${known ? slot.faction : "inconnu"}`);
    card.dataset["shifter"] = d.id;
    const head = el("header", "planche__tete");
    head.append(el("h4", "", t(d.name_key)), stamp(d.canon));
    card.append(head);
    const who = el("p", "registre-champ");
    const holder = slot.holder ? this.ctx.world.politics?.characters.get(slot.holder) : undefined;
    if (slot.faction === "perdu") who.append(t("shifters.lost"));
    else if (!known) who.append(t("shifters.unknown_holder"));
    else if (holder) who.append(t("shifters.holder"), " ", el("strong", "", displayName(holder)), ` · ${t(`shifters.faction.${slot.faction}`)}`);
    else who.append(t(`shifters.held_by.${slot.faction}`));
    card.append(who);
    if (slot.faction !== "perdu" && known) {
      const left = yearsLeft(this.ctx.world, slot, s.date);
      const clock = el("p", "registre-champ porteur__horloge");
      clock.dataset["clock"] = String(left.value);
      clock.append(t("shifters.clock"), " ", valueEl(this.ctx, t("shifters.years", { n: left.value }), () => ({ title: t("shifters.clock"), sections: [{ explained: left }, { text: t("shifters.clock_why") }] })), ` · ${t("shifters.since", { year: slot.since })} `, stamp(slot.sinceCanon));
      card.append(clock);
    }
    const flags: string[] = [];
    if (slot.captured) flags.push(t("shifters.captured"));
    if (slot.retired) flags.push(t("shifters.retired"));
    if (slot.visions > 0) flags.push(t("shifters.visions", { n: slot.visions }));
    if (flags.length) card.append(el("p", "registre-note", flags.join(" · ")));
    const list = el("ul", "porteur__capacites");
    for (const a of d.abilities) list.append(this.ability(a, s));
    card.append(list);
    if (known) card.append(...this.actions(s, sh, d, slot));
    return card;
  }

  private ability(a: ShifterAbility, s: GameState): HTMLElement {
    const li = el("li", "porteur__capacite");
    li.dataset["ability"] = a.id;
    li.append(el("strong", "", t(`shifter.ability.${a.id}`)), " ", stamp(a.canon), " — ", t(`shifter.effect.${a.effect}`), " ");
    const n = formatNumber;
    const parts = a.passive ? [t("shifters.passive")] : [t("shifters.cost", { n: n(a.cost) }), t("shifters.range", { n: n(a.range_m) }), t("shifters.delay", { n: n(a.delay_s) }), t("shifters.cooldown", { n: n(a.cooldown_s) })];
    if (a.radius_m > 0) parts.push(t("shifters.radius", { n: n(a.radius_m) }));
    if (a.duration_s > 0) parts.push(t("shifters.duration", { n: n(a.duration_s) }));
    const meta = valueEl(this.ctx, parts.join(" · "), () => ({ title: t(`shifter.ability.${a.id}`), sections: [{ text: t(`shifter.effect.${a.effect}.limits`, { power: formatNumber(a.power) }) }] }), "porteur__fiche");
    li.append(meta);
    if (a.requires_flag && !(s.events?.flags[a.requires_flag] ?? false)) li.append(" ", el("span", "plan-probleme", t("shifters.locked")));
    return li;
  }

  /** Héritage préparé (coûts prévus, confirmation) et retrait du service. */
  private actions(s: GameState, sh: ShiftersState, d: Shifter, slot: ShifterSlot): HTMLElement[] {
    const out: HTMLElement[] = [];
    const pol = s.politics;
    if (!pol || !slot.holder || slot.faction === "perdu") return out;
    if (!retireProblem(sh, pol, d.id)) {
      const r = button(slot.retired ? t("shifters.recall") : t("shifters.retire"), () => void this.ctx.dispatch({ type: "RetireShifter", shifter: d.id, retired: !slot.retired }), "registre-bouton petit");
      r.dataset["action"] = slot.retired ? "rappeler" : "retirer";
      out.push(r);
    }
    if (slot.faction !== "paradis" && !slot.captured) return out;
    const box = el("div", "porteur__heritage");
    box.append(el("h5", "", t("shifters.inherit")));
    const sel = el("select", "plan-choix");
    sel.dataset["heir"] = d.id;
    const candidates = [...(this.ctx.world.politics?.characters.values() ?? [])].filter((c) => c.id !== slot.holder && pol.characters[c.id]?.alive && c.active_from <= s.date.year && isDomestic(c)).sort((a, b) => displayName(a).localeCompare(displayName(b), "fr"));
    const chosen = this.heir.get(d.id) ?? candidates[0]?.id ?? "";
    for (const c of candidates) {
      const o = el("option", "", displayName(c));
      o.value = c.id;
      o.selected = c.id === chosen;
      sel.append(o);
    }
    sel.addEventListener("change", () => {
      this.heir.set(d.id, sel.value);
      this.ctx.open("porteurs");
    });
    box.append(sel);
    const costs = chosen ? inheritCosts(this.ctx.world, sh, pol, d.id, chosen) : [];
    const ul = el("ul", "porteur__couts");
    for (const c of costs) ul.append(el("li", "", t(c.key, { ...c.params, org: typeof c.params["org"] === "string" ? t(c.params["org"]) : (c.params["org"] ?? "") })));
    box.append(ul);
    const problem = chosen ? inheritProblem(this.ctx.world, sh, pol, d.id, chosen) : "shifter.err.heir_dead";
    if (problem) box.append(el("p", "plan-probleme", t(problem)));
    const go = button(t("shifters.inherit_go"), () => {
      void this.ctx.confirm(t("shifters.inherit_confirm", { heir: displayName(this.ctx.world.politics?.characters.get(chosen)), titan: t(d.name_key) })).then((ok) => {
        if (ok) void this.ctx.dispatch({ type: "InheritTitan", shifter: d.id, heir: chosen });
      });
    }, "registre-bouton petit principal");
    go.dataset["action"] = "heriter";
    go.disabled = problem !== null;
    box.append(go);
    out.push(box);
    return out;
  }

  private history(sh: ShiftersState): HTMLElement[] {
    if (sh.history.length === 0) return [];
    const ul = el("ul", "registre-liste porteur__dossiers");
    for (const r of [...sh.history].reverse().slice(0, 12)) {
      const d = fromAbsoluteDay(r.day);
      const name = (id: string | null): string => (id ? displayName(this.ctx.world.politics?.characters.get(id)) : "—");
      const li = el("li", "");
      li.append(el("span", "journal-date", t("date.format", { year: d.year, day: d.day })), " ", t(`shifters.record.${r.kind}`, { titan: t(this.ctx.world.shifters?.defs.get(r.shifter)?.name_key ?? r.shifter), from: name(r.from), to: name(r.to) }));
      if (r.consequences.length) li.append(" — ", r.consequences.map((c) => t(c.key, { ...c.params, org: typeof c.params["org"] === "string" ? t(c.params["org"]) : (c.params["org"] ?? "") })).join(" ; "));
      ul.append(li);
    }
    return [el("h3", "registre-intertitre", t("shifters.records")), ul];
  }

  /** Bataille d'essai avec un porteur (hors campagne, sans effet sur l'état). */
  private trial(): HTMLElement[] {
    const tw = this.ctx.world.tactical;
    const sw = this.ctx.world.shifters;
    if (!tw || !sw) return [];
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
    const which = select("shifter", sw.order.map((d) => [d.id, t(d.name_key)]));
    const side = select("side", [["allie", t("shifters.side.allie")], ["ennemi", t("shifters.side.ennemi")]]);
    const map = select("map", [...tw.maps.values()].map((m) => [m.id, t(m.name_key)]));
    const pures = select("titans", [["", t("shifters.trial_no_pures")], ...[...tw.titanTypes.values()].map((x): [string, string] => [x.id, t(x.name_key)])]);
    const spears = el("input");
    spears.type = "checkbox";
    spears.dataset["trial"] = "spears";
    const spearsLab = el("label", "plan-case");
    spearsLab.append(spears, ` ${t("shifters.trial_spears")}`);
    const go = button(t("exp.trial_go"), () => {
      const seed = (fnv1a(`essai-porteur:${this.ctx.state().seed}:${this.trials++}`) % 2 ** 30) + 1;
      const base = skirmishSetup(this.ctx.world, map.value, pures.value ? [{ type: pures.value, count: 4 }] : [], 18, seed, false);
      const flags = Object.entries(this.ctx.state().events?.flags ?? {}).filter(([, v]) => v).map(([k]) => k);
      const setup = { ...base, shifters: [{ shifter: which.value, side: side.value === "ennemi" ? ("ennemi" as const) : ("allie" as const), name: t("shifters.trial_holder"), character: null, stress: 20 }], thunderSpears: spears.checked, flags };
      void this.ctx.playBattle(setup, t("shifters.trial_title", { titan: which.selectedOptions[0]?.textContent ?? which.value }), false);
    }, "registre-bouton");
    go.dataset["action"] = "essai-porteur";
    const l = (key: string, input: HTMLElement): HTMLLabelElement => {
      const lab = el("label", "plan-ligne");
      lab.append(`${t(key)} `, input);
      return lab;
    };
    const form = el("div", "exp-essai");
    form.append(el("p", "registre-note", t("shifters.trial_note")), l("shifters.trial_shifter", which), l("shifters.trial_side", side), l("exp.trial_map", map), l("shifters.trial_pures", pures), spearsLab, go);
    return [el("h3", "registre-intertitre", t("shifters.trial")), form];
  }
}
