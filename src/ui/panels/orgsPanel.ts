import { t } from "../../i18n";
import { activeLawMods, foodDays, legitimacyTarget, nationalMoraleOf, orgInfluenceTarget, orgLoyaltyTarget } from "../../sim/politics/politics";
import { radicalisationTarget, satisfactionTarget, strataPopulation } from "../../sim/politics/society";
import { capitalGain } from "../../sim/politics/tick";
import { formatNumber } from "../why";
import { button, displayName, el, noPolitics, valueEl } from "./common";
import type { Panel, PanelContext } from "./common";

/** Organisations (loyauté, influence, budget — F-ECO-15), strates (F-POP-01), légitimité et capital (F-POL-01, F-POL-20). */
export class OrgsPanel implements Panel {
  readonly id = "organisations" as const;
  private draft: Record<string, number> | null = null;

  constructor(private readonly ctx: PanelContext) {}

  render(root: HTMLElement): void {
    const pw = this.ctx.world.politics;
    const state = this.ctx.state();
    const pol = state.politics;
    const st = state.strategic;
    if (!pw || !pol || !st) return noPolitics(root);
    const world = this.ctx.world;

    const top = el("div", "orgs-etat");
    const leg = el("p", "registre-champ");
    leg.append(t("hud.legitimacy"), " ", valueEl(this.ctx, formatNumber(pol.legitimacy), () => ({
      title: t("hud.legitimacy"),
      sections: [{ text: t("orgs.approach", { rate: formatNumber(pw.balance.legitimacy.approach_per_day * 100) }) }, { label: t("dossier.target"), explained: legitimacyTarget(world, pol, st, state.date, nationalMoraleOf(st), foodDays(st, world)) }],
    })));
    const cap = el("p", "registre-champ");
    cap.append(t("hud.capital"), " ", valueEl(this.ctx, formatNumber(pol.capital), () => ({
      title: t("hud.capital"),
      sections: [{ text: t("orgs.capital_why", { gain: formatNumber(capitalGain(pol.legitimacy, pw.balance.capital)), cap: pw.balance.capital.cap }) }],
    })));
    top.append(leg, cap);
    root.append(top);

    root.append(el("h3", "registre-intertitre", t("orgs.title")));
    const table = el("table", "registre-table");
    const head = el("tr");
    for (const h of ["orgs.col.name", "orgs.col.leader", "orgs.col.loyalty", "orgs.col.influence", "orgs.col.budget"]) head.append(el("th", "", t(h)));
    table.append(head);
    const draft = this.draft ?? Object.fromEntries(Object.entries(pol.orgs).map(([id, o]) => [id, o.budget]));
    for (const [id, org] of Object.entries(pol.orgs)) {
      const def = pw.organisations.get(id);
      const tr = el("tr");
      tr.append(el("td", "", t(def?.name_key ?? id)));
      tr.append(el("td", "", org.leader ? displayName(pw.characters.get(org.leader)) : t("orgs.vacant")));
      const tdL = el("td");
      tdL.append(valueEl(this.ctx, formatNumber(org.loyalty), () => ({ title: t("orgs.col.loyalty"), sections: [{ text: t("orgs.approach", { rate: formatNumber(pw.balance.orgs.approach_per_day * 100) }) }, { label: t("dossier.target"), explained: orgLoyaltyTarget(world, pol, id, state.date) }] })));
      const tdI = el("td");
      tdI.append(valueEl(this.ctx, formatNumber(org.influence), () => ({ title: t("orgs.col.influence"), sections: [{ label: t("dossier.target"), explained: orgInfluenceTarget(world, pol, id) }] })));
      const tdB = el("td", "orgs-budget");
      if (def?.budgeted) {
        const minus = button("−", () => this.step(root, draft, id, -5), "registre-bouton petit");
        const plus = button("+", () => this.step(root, draft, id, 5), "registre-bouton petit");
        minus.setAttribute("aria-label", t("orgs.budget_less", { org: t(def.name_key) }));
        plus.setAttribute("aria-label", t("orgs.budget_more", { org: t(def.name_key) }));
        tdB.append(minus, valueEl(this.ctx, `${formatNumber(draft[id] ?? 0)} %`, () => ({ title: t("orgs.col.budget"), sections: [{ text: t("orgs.budget_why", { ref: world.scenario.politics?.budget[id] ?? 0 }) }] })), plus);
      }
      tr.append(tdL, tdI, tdB);
      table.append(tr);
    }
    root.append(table);
    if (this.draft) {
      root.append(button(t("orgs.budget_apply"), () => {
        void this.ctx.confirm(t("orgs.budget_confirm")).then((ok) => {
          if (!ok || !this.draft) return;
          void this.ctx.dispatch({ type: "SetBudget", shares: this.draft }).then(() => {
            this.draft = null;
            root.replaceChildren();
            this.render(root);
          });
        });
      }, "registre-bouton principal"), button(t("orgs.budget_cancel"), () => {
        this.draft = null;
        root.replaceChildren();
        this.render(root);
      }));
    }

    root.append(el("h3", "registre-intertitre", t("orgs.strata")));
    const strata = el("table", "registre-table");
    const sh = el("tr");
    for (const h of ["orgs.col.stratum", "orgs.col.people", "orgs.col.satisfaction", "orgs.col.radicalisation"]) sh.append(el("th", "", t(h)));
    strata.append(sh);
    const pop = strataPopulation(world, pw, st);
    const active = activeLawMods(pw, pol);
    for (const s of pw.strata) {
      const cur = pol.strata[s.id];
      if (!cur) continue;
      const tr = el("tr");
      tr.append(el("td", "", t(s.name_key)));
      const tdP = el("td");
      tdP.append(valueEl(this.ctx, formatNumber(pop[s.id] ?? 0), () => ({ title: t(s.name_key), sections: [{ text: t("orgs.people_why") }] })));
      const tdS = el("td");
      tdS.append(valueEl(this.ctx, formatNumber(cur.satisfaction), () => ({ title: t("orgs.col.satisfaction"), sections: [{ label: t("dossier.target"), explained: satisfactionTarget(pw, pol, st, active, s.id) }] })));
      const tdR = el("td");
      tdR.append(valueEl(this.ctx, formatNumber(cur.radicalisation), () => ({ title: t("orgs.col.radicalisation"), sections: [{ label: t("dossier.target"), explained: radicalisationTarget(pw, pol, active, s.id) }] })));
      tr.append(tdP, tdS, tdR);
      strata.append(tr);
    }
    root.append(strata);
  }

  private step(root: HTMLElement, draft: Record<string, number>, id: string, delta: number): void {
    this.draft = { ...draft, [id]: Math.max(0, Math.min(100, (draft[id] ?? 0) + delta)) };
    root.replaceChildren();
    this.render(root);
  }
}
