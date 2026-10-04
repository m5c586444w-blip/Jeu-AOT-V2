import { emblem } from "../icons";
import { t } from "../../i18n";
import { acceptance, hizuruDrift, TREATY_KINDS } from "../../sim/world/diplomacy";
import type { TreatyKind } from "../../sim/world/diplomacy";
import { atWar, hasTreaty } from "../../sim/world/nations";
import { button, el, valueEl } from "./common";
import type { Panel, PanelContext } from "./common";
import { formatNumber } from "../why";

/**
 * Chancellerie (P7 ; 02 §11, 09 DIP) : relations à quatre axes avec chaque nation, traités, guerre et paix, embargo ;
 * chaque proposition montre l'utilité prévue de l'autre partie ; neutralité d'Hizuru ; journal de raisonnement des IA.
 */
export class DiplomacyPanel implements Panel {
  readonly id = "diplomatie" as const;
  private kind = new Map<string, TreatyKind>();

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
    // Hizuru : neutralité crédible (07 H01).
    const hz = el("p", "registre-champ chancellerie__hizuru");
    const drift = hizuruDrift(this.ctx.world, ns);
    hz.dataset["side"] = ns.hizuruSide;
    hz.append(
      t("dip.hizuru"),
      " ",
      valueEl(this.ctx, formatNumber(Math.round(ns.hizuruLean)), () => ({ title: t("dip.hizuru_lean"), sections: [{ text: t("dip.hizuru_lean_why", { th: nw.balance.diplomacy.hizuru.threshold }) }, { explained: drift }] })),
      ` · ${t(`world.side.${ns.hizuruSide}`)} `,
    );
    if (me === "fac_paradis" || me === "fac_marley") {
      const g = button(t("dip.guarantee"), () => void this.ctx.dispatch({ type: "GuaranteeHizuru" }), "registre-bouton petit");
      g.dataset["action"] = "garantie";
      hz.append(g);
    }
    root.append(hz);
    const grid = el("div", "chancellerie");
    for (const f of [...nw.factions.values()].filter((x) => x.id !== me)) {
      const card = el("article", `fiche-nation fiche-nation--${f.id}`);
      card.dataset["nation"] = f.id;
      const head = el("header", "planche__tete");
      const blason = el("span", "fiche-nation__blason");
      blason.innerHTML = emblem(f.id);
      blason.setAttribute("aria-hidden", "true");
      head.append(blason, el("h4", "", t(f.name_key)), el("span", "registre-note", t(`dip.personality.${f.personality}`)));
      card.append(head);
      const r = ns.relations[f.id]?.[me];
      if (r) {
        const p = el("p", "registre-note");
        for (const axis of ["trust", "interest", "fear", "ideology"] as const) p.append(`${t(`dip.axis.${axis}`)} `, valueEl(this.ctx, formatNumber(Math.round(r[axis])), () => ({ title: t(`dip.axis.${axis}`), sections: [{ text: t(`dip.axis.${axis}_why`) }] })), " ");
        card.append(p);
      }
      const ties = TREATY_KINDS.filter((k) => hasTreaty(ns, k, me, f.id)).map((k) => t(`world.treaty.${k}`));
      const war = atWar(ns, me, f.id);
      card.append(el("p", war ? "plan-probleme" : "registre-note", war ? t("dip.at_war") : ties.length ? t("dip.treaties", { list: ties.join(", ") }) : t("dip.no_treaty")));
      if (!war) {
        const sel = el("select", "plan-choix");
        sel.dataset["treaty"] = f.id;
        const chosen = this.kind.get(f.id) ?? "commerce";
        for (const k of TREATY_KINDS) {
          const o = el("option", "", t(`world.treaty.${k}`));
          o.value = k;
          o.selected = k === chosen;
          sel.append(o);
        }
        sel.addEventListener("change", () => {
          this.kind.set(f.id, sel.value as TreatyKind);
          this.ctx.open("diplomatie");
        });
        const u = acceptance(this.ctx.world, ns, me, f.id, chosen);
        const line = el("p", "plan-ligne");
        line.append(sel, " ", t("dip.expected"), " ", valueEl(this.ctx, formatNumber(Math.round(u.value)), () => ({ title: t("dip.acceptance"), sections: [{ explained: u }, { text: t("dip.acceptance_why", { th: nw.balance.diplomacy.accept_threshold }) }] })), " ");
        const go = button(t("dip.propose"), () => void this.ctx.dispatch({ type: "ProposeTreaty", to: f.id, kind: chosen }), "registre-bouton petit principal");
        go.dataset["action"] = "proposer";
        line.append(go);
        card.append(line);
        const w = button(t("dip.declare_war"), () => {
          void this.ctx.confirm(t("dip.declare_war_confirm", { nation: t(f.name_key) })).then((ok) => {
            if (ok) void this.ctx.dispatch({ type: "DeclareWar", to: f.id });
          });
        }, "registre-bouton petit");
        w.dataset["action"] = "guerre";
        card.append(w);
      } else {
        const u = acceptance(this.ctx.world, ns, me, f.id, "paix");
        const line = el("p", "plan-ligne");
        line.append(t("dip.expected"), " ", valueEl(this.ctx, formatNumber(Math.round(u.value)), () => ({ title: t("dip.acceptance"), sections: [{ explained: u }] })), " ");
        const go = button(t("dip.peace"), () => void this.ctx.dispatch({ type: "MakePeace", to: f.id }), "registre-bouton petit");
        go.dataset["action"] = "paix";
        line.append(go);
        card.append(line);
      }
      const on = ns.embargoes.includes(`${me}>${f.id}`);
      const e = button(on ? t("dip.embargo_off") : t("dip.embargo_on"), () => void this.ctx.dispatch({ type: "Embargo", to: f.id, on: !on }), "registre-bouton petit");
      e.dataset["action"] = "embargo";
      card.append(" ", e);
      grid.append(card);
    }
    root.append(grid);
    // Journal de raisonnement des IA (02 §14), replié.
    const det = el("details", "chancellerie__ia");
    det.append(el("summary", "", t("dip.ai_log")));
    const ul = el("ul", "registre-liste");
    for (const d of [...ns.ai].reverse().slice(0, 12)) {
      const reasons = d.reasons.map((r) => `${t(r.key)} ${formatNumber(Math.round(r.value * 100) / 100)}`).join(" ; ");
      ul.append(el("li", "", `${t(nw.factions.get(d.faction)?.name_key ?? d.faction)} — ${t(`dip.ai_action.${d.action.split(":")[0] ?? ""}`)} (${formatNumber(Math.round(d.utility * 10) / 10)}) : ${reasons}`));
    }
    det.append(ul);
    root.append(det);
  }
}
