import { t } from "../../i18n";
import { atlasHit, drawWorldAtlas } from "../../render/worldAtlas";
import type { AtlasProvince, AtlasView } from "../../render/worldAtlas";
import type { GameState } from "../../sim/core/state";
import { fromAbsoluteDay } from "../../sim/core/time";
import { nationIncome, nationUpkeep, ownerOf } from "../../sim/world/nations";
import type { NationsState } from "../../sim/world/nations";
import { projectProblem, SIDE_TO_FACTION } from "../../sim/world/war";
import { button, el, valueEl } from "./common";
import type { Panel, PanelContext } from "./common";
import { formatNumber } from "../why";
import { tokenColor } from "../theme";

/** Couleur d'une nation sur l'atlas : jeton `--nation-*` de tokens.css (aucune couleur en dur hors des jetons, U1). */
export function nationColor(faction: string | undefined): string {
  const name = faction ? `--nation-${faction.replace(/^fac_/, "")}` : "--nation-sans";
  return tokenColor(name) || tokenColor("--nation-neutre");
}

/**
 * Table de guerre (P7) : atlas du monde, comptes de la nation jouée, province choisie (forces, levées, mouvements),
 * Titans à projeter, rapports de front expliqués, journal du monde.
 */
export class WorldPanel implements Panel {
  readonly id = "monde" as const;
  private selected: string | null = null;
  private view: AtlasView | null = null;
  private atlas: AtlasProvince[] = [];

  constructor(private readonly ctx: PanelContext) {}

  render(root: HTMLElement): void {
    const s = this.ctx.state();
    const ns = s.nations;
    const nw = this.ctx.world.nations;
    if (!ns || !nw) {
      root.append(el("p", "registre-ferme", t("world.closed")));
      return;
    }
    const me = ns.player;
    root.append(this.ledger(s, ns, me));
    const table = el("div", "table-guerre");
    const canvas = el("canvas", "atlas-monde");
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", t("world.atlas"));
    canvas.addEventListener("click", (ev) => {
      if (!this.view) return;
      const r = canvas.getBoundingClientRect();
      const id = atlasHit(this.view, this.atlas, ev.clientX - r.left, ev.clientY - r.top);
      if (id) {
        this.selected = id;
        this.ctx.open("monde");
      }
    });
    canvas.addEventListener("mousemove", (ev) => {
      if (!this.view) return;
      const r = canvas.getBoundingClientRect();
      const id = atlasHit(this.view, this.atlas, ev.clientX - r.left, ev.clientY - r.top);
      canvas.title = id ? (this.atlas.find((p) => p.id === id)?.label ?? "") : "";
    });
    const side = el("div", "table-guerre__dossier");
    table.append(canvas, side);
    root.append(table);
    this.atlas = this.model(s, ns);
    // Le canvas doit être dans le document pour avoir sa taille : dessin à l'image suivante.
    requestAnimationFrame(() => {
      this.view = drawWorldAtlas(canvas, this.atlas, this.selected);
      canvas.dataset["drawn"] = String(this.atlas.length);
    });
    // Colonne de droite (R0.2d) : la province choisie, puis les Titans, les fronts et le journal, à côté de l'atlas.
    if (this.selected) side.append(...this.province(s, ns, me, this.selected));
    else side.append(el("p", "registre-note", t("world.pick_province")));
    side.append(...this.titans(s, ns, me), ...this.fronts(ns), ...this.log(ns));
  }

  private model(s: GameState, ns: NationsState): AtlasProvince[] {
    const nw = this.ctx.world.nations;
    if (!nw) return [];
    const day = Math.max(0, ...ns.fronts.map((f) => f.day));
    return nw.order.map((p) => {
      const by = new Map<string, number>();
      for (const [id, st] of Object.entries(ns.forces[p.id] ?? {})) {
        const o = ownerOf(this.ctx.world, id);
        if (o && st.count > 0) by.set(o, (by.get(o) ?? 0) + st.count);
      }
      const owner = ns.control[p.id];
      return {
        id: p.id,
        at: p.at,
        sea: p.faction === "mer",
        fill: p.faction === "mer" ? tokenColor("--nation-mer") : owner ? nationColor(owner) : tokenColor("--nation-sans"),
        label: t(p.name_key),
        adjacent: p.adjacent,
        tokens: [...by].sort(([a], [b]) => a.localeCompare(b)).map(([f, count]) => ({ color: nationColor(f), count })),
        front: ns.fronts.some((f) => f.province === p.id && f.day >= day - 7),
        titan: ns.projections.some((x) => x.province === p.id && x.restUntil === null),
        major: p.faction === "mer" || p.canon === "C" || p.code.endsWith("01") || p.id === "wprov_fort_slava",
      };
    });
  }

  private ledger(s: GameState, ns: NationsState, me: string): HTMLElement {
    const nw = this.ctx.world.nations;
    const n = ns.nations[me];
    const box = el("p", "registre-champ table-guerre__comptes");
    if (!n || !nw) return box;
    const inc = nationIncome(this.ctx.world, ns, me, s.strategic);
    const up = nationUpkeep(this.ctx.world, ns, me);
    box.dataset["faction"] = me;
    box.append(
      el("strong", "", t(nw.factions.get(me)?.name_key ?? me)),
      ` · ${t("world.industry")} `,
      valueEl(this.ctx, formatNumber(Math.round(n.industry)), () => ({ title: t("world.industry_income"), sections: [{ explained: inc.industry }, { explained: up }] })),
      ` · ${t("world.manpower")} `,
      valueEl(this.ctx, formatNumber(Math.round(n.manpower)), () => ({ title: t("world.manpower_income"), sections: [{ explained: inc.manpower }] })),
      ` · ${t("world.war_support")} `,
      valueEl(this.ctx, formatNumber(Math.round(n.warSupport)), () => ({ title: t("world.war_support"), sections: [{ text: t("world.war_support_why") }] })),
      ` · ${t("world.stability")} `,
      valueEl(this.ctx, formatNumber(Math.round(n.stability)), () => ({ title: t("world.stability"), sections: [{ text: t("world.stability_why") }] })),
    );
    const wars = ns.wars.filter((w) => w.split("|").includes(me)).map((w) => t(nw.factions.get(w.split("|").find((x) => x !== me) ?? "")?.name_key ?? ""));
    box.append(` · ${wars.length ? t("world.at_war_with", { list: wars.join(", ") }) : t("world.at_peace")}`);
    return box;
  }

  private province(s: GameState, ns: NationsState, me: string, id: string): HTMLElement[] {
    const nw = this.ctx.world.nations;
    const p = nw?.provinces.get(id);
    if (!nw || !p) return [];
    const out: HTMLElement[] = [];
    const head = el("h3", "registre-intertitre", t(p.name_key));
    head.dataset["province"] = id;
    out.push(head);
    const owner = ns.control[id];
    out.push(el("p", "registre-note", owner ? t("world.held_by", { nation: t(nw.factions.get(owner)?.name_key ?? owner) }) : t("world.sea_zone")));
    if (p.faction !== "mer") out.push(el("p", "registre-note", t("world.production", { i: formatNumber(p.industry), f: formatNumber(p.food), m: formatNumber(p.manpower) })));
    // Forces présentes ; les nôtres peuvent se mouvoir.
    const list = el("ul", "registre-liste table-guerre__forces");
    for (const [fid, st] of Object.entries(ns.forces[id] ?? {}).sort(([a], [b]) => a.localeCompare(b))) {
      const f = nw.formations.get(fid);
      if (!f || st.count <= 0) continue;
      const li = el("li", `force force--${f.faction}`);
      li.dataset["formation"] = fid;
      li.append(`${st.count} × ${t(f.name_key)} (${t(nw.factions.get(f.faction)?.name_key ?? f.faction)}) · `, valueEl(this.ctx, `${Math.round(st.strength * 100)} %`, () => ({ title: t("world.strength"), sections: [{ text: t("world.strength_why") }] })));
      if (f.faction === me && st.moves > 0) {
        const dest = el("select", "plan-choix");
        dest.dataset["move"] = fid;
        for (const a of p.adjacent) {
          const o = el("option", "", t(nw.provinces.get(a)?.name_key ?? a));
          o.value = a;
          dest.append(o);
        }
        const go = button(t("world.move"), () => void this.ctx.dispatch({ type: "MoveFormation", formation: fid, from: id, to: dest.value, count: st.count }), "registre-bouton petit");
        go.dataset["action"] = "deplacer";
        li.append(" ", dest, " ", go);
      }
      list.append(li);
    }
    out.push(list);
    // Levée.
    if (owner === me) {
      const sel = el("select", "plan-choix");
      sel.dataset["build"] = id;
      for (const f of [...nw.formations.values()].filter((x) => x.faction === me && x.enabled && (x.domain !== "mer" || p.coastal))) {
        const o = el("option", "", t("world.build_option", { name: t(f.name_key), i: f.cost.industry, m: f.cost.manpower, d: f.build_days }));
        o.value = f.id;
        sel.append(o);
      }
      const go = button(t("world.build"), () => void this.ctx.dispatch({ type: "BuildFormation", formation: sel.value, province: id, count: 1 }), "registre-bouton petit");
      go.dataset["action"] = "lever";
      const lab = el("p", "plan-ligne");
      lab.append(`${t("world.build_label")} `, sel, " ", go);
      out.push(lab);
    }
    const pending = ns.orders.filter((o) => o.province === id && o.faction === me);
    for (const o of pending) {
      const d = fromAbsoluteDay(o.done);
      out.push(el("p", "registre-note", t("world.order", { n: o.count, name: t(nw.formations.get(o.formation)?.name_key ?? o.formation), year: d.year, day: d.day })));
    }
    // Ultimatum, depuis la province d'un autre (diplomatie).
    if (owner && owner !== me) {
      const go = button(t("world.ultimatum", { nation: t(nw.factions.get(owner)?.name_key ?? owner) }), () => {
        void this.ctx.confirm(t("world.ultimatum_confirm", { province: t(p.name_key) })).then((ok) => {
          if (ok) void this.ctx.dispatch({ type: "Ultimatum", to: owner, province: id });
        });
      }, "registre-bouton petit");
      go.dataset["action"] = "ultimatum";
      out.push(go);
    }
    return out;
  }

  /** Titans à projeter : porteurs au service de la nation jouée (F-WAR-08). */
  private titans(s: GameState, ns: NationsState, me: string): HTMLElement[] {
    const sh = s.shifters;
    const sw = this.ctx.world.shifters;
    if (!sh || !sw) return [];
    const ul = el("ul", "registre-liste table-guerre__titans");
    for (const d of sw.order) {
      const slot = sh.titans[d.id];
      if (!slot || SIDE_TO_FACTION[slot.faction] !== me || !slot.holder) continue;
      const li = el("li", "");
      li.dataset["shifter"] = d.id;
      const holder = this.ctx.world.politics?.characters.get(slot.holder)?.name ?? "—";
      li.append(el("strong", "", t(d.name_key)), ` (${holder}) · `);
      const cur = ns.projections.find((x) => x.shifter === d.id);
      if (cur && cur.restUntil === null) {
        li.append(t("world.titan_at", { province: t(this.ctx.world.nations?.provinces.get(cur.province)?.name_key ?? cur.province) }), " ");
        const r = button(t("world.recall"), () => void this.ctx.dispatch({ type: "RecallTitan", shifter: d.id }), "registre-bouton petit");
        r.dataset["action"] = "rappeler-titan";
        li.append(r);
      } else if (this.selected) {
        const problem = projectProblem(this.ctx.world, ns, sh, s.politics, me, d.id, this.selected, s.date);
        const go = button(t("world.project", { province: t(this.ctx.world.nations?.provinces.get(this.selected)?.name_key ?? this.selected) }), () => {
          void this.ctx.confirm(t("world.project_confirm", { titan: t(d.name_key) })).then((ok) => {
            if (ok) void this.ctx.dispatch({ type: "ProjectTitan", shifter: d.id, province: this.selected ?? "" });
          });
        }, "registre-bouton petit principal");
        go.dataset["action"] = "projeter";
        go.disabled = problem !== null;
        li.append(go);
        if (problem) li.append(" ", el("span", "plan-probleme", t(problem)));
      } else li.append(t("world.titan_idle"));
      ul.append(li);
    }
    return ul.childElementCount ? [el("h3", "registre-intertitre", t("world.titans")), ul] : [];
  }

  private fronts(ns: NationsState): HTMLElement[] {
    const nw = this.ctx.world.nations;
    if (!nw) return [];
    // Section toujours présente (R0.2d) : un front encore calme se dit, il ne laisse pas un vide.
    if (ns.fronts.length === 0) return [el("h3", "registre-intertitre", t("world.fronts")), el("p", "registre-note", t("world.fronts_none"))];
    const ul = el("ul", "registre-liste table-guerre__fronts");
    for (const f of [...ns.fronts].reverse().slice(0, 8)) {
      const d = fromAbsoluteDay(f.day);
      const li = el("li", f.captured ? "front front--pris" : "front");
      li.append(
        el("span", "journal-date", t("date.format", { year: d.year, day: d.day })),
        " ",
        t("world.front_line", { province: t(nw.provinces.get(f.province)?.name_key ?? f.province), a: t(nw.factions.get(f.attacker)?.name_key ?? f.attacker), d: t(nw.factions.get(f.defender)?.name_key ?? f.defender) }),
        " ",
        valueEl(this.ctx, formatNumber(Math.round(f.attackPower.value)), () => ({ title: t("world.attack_power"), sections: [{ explained: f.attackPower }] })),
        " / ",
        valueEl(this.ctx, formatNumber(Math.round(f.defensePower.value)), () => ({ title: t("world.defense_power"), sections: [{ explained: f.defensePower }] })),
        ` · ${t("world.losses", { a: formatNumber(f.attackerLoss), d: formatNumber(f.defenderLoss) })}${f.captured ? ` · ${t("world.captured")}` : ""}`,
      );
      ul.append(li);
    }
    return [el("h3", "registre-intertitre", t("world.fronts")), ul];
  }

  private log(ns: NationsState): HTMLElement[] {
    if (ns.log.length === 0) return [el("h3", "registre-intertitre", t("world.log")), el("p", "registre-note", t("world.log_none"))];
    const ul = el("ul", "registre-liste");
    for (const l of [...ns.log].reverse().slice(0, 10)) {
      const d = fromAbsoluteDay(l.day);
      const params = Object.fromEntries(Object.entries(l.params).map(([k, v]) => [k, typeof v === "string" && v.includes(".") ? t(v) : v]));
      ul.append(el("li", "", `${t("date.format", { year: d.year, day: d.day })} — ${t(l.key, params)}`));
    }
    return [el("h3", "registre-intertitre", t("world.log")), ul];
  }
}
