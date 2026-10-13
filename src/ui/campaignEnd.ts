import { t } from "../i18n";
import { campaignDataFromFiles, effectiveMods, findCampaign, parseCampaignScenarioId } from "../campaign/campaign";
import { evaluateOutcome, newTracker, observe, outcomeFor } from "../campaign/outcome";
import type { Outcome } from "../campaign/outcome";
import type { Campaign, DifficultyId } from "../data/campaignSchema";
import type { GameState } from "../sim/core/state";
import type { World } from "../sim/strategic/world";
import { button, el } from "./panels/common";
import { formatNumber } from "./why";

/**
 * Fin de campagne dans l'interface (P9.1, D-155) : chargé à la demande pour un scénario `scn_camp_…` seulement (rien dans le
 * paquet principal) ; mêmes règles que `sim:balance` (`src/campaign/outcome.ts`), évaluées après chaque avance du temps.
 */
const loaders = import.meta.glob<unknown>(["/data/campagnes/*.json", "/data/balance/difficulty.json"], { import: "default" });

export interface CampaignWatch {
  campaign: Campaign;
  difficulty: DifficultyId;
  threshold: number;
  /** Issue au premier appel où une règle s'applique, puis null (la partie peut continuer). */
  check(state: GameState): Outcome | null;
}

export async function watchCampaign(world: World, scenario: string, start: GameState): Promise<CampaignWatch | null> {
  const parsed = parseCampaignScenarioId(scenario);
  if (!parsed) return null;
  const files: Record<string, unknown> = {};
  for (const [path, load] of Object.entries(loaders)) files[path] = await load();
  const data = campaignDataFromFiles(files);
  const campaign = findCampaign(data, parsed.campaign);
  if (!campaign) return null;
  const mods = effectiveMods(data, campaign.id, parsed.difficulty);
  const tracker = newTracker(start);
  let ended = false;
  return {
    campaign,
    difficulty: parsed.difficulty,
    threshold: campaign.end.deadline.threshold + mods.score_threshold_delta,
    check(state) {
      if (ended) return null;
      observe(tracker, state);
      const o = evaluateOutcome(world, campaign, mods, state, tracker);
      if (o) ended = true;
      return o;
    },
  };
}

export interface CampaignEndActions {
  epilogue: (() => void) | null;
  menu: () => void;
}

/** Dossier de fin de campagne : issue vue de la nation jouée, texte, vainqueur, durée, bilan, difficulté. */
export function showCampaignEnd(parent: HTMLElement, world: World, watch: CampaignWatch, o: Outcome, state: GameState, actions: CampaignEndActions): HTMLElement {
  const player = state.nations?.player ?? watch.campaign.nations[0] ?? "fac_paradis";
  const view = outcomeFor(o, player);
  const root = el("section", "fin-campagne");
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.dataset["issue"] = view;
  root.dataset["regle"] = o.rule;
  const paper = el("article", "fin-campagne__papier");
  const head = el("header", "fin-campagne__tete");
  head.append(el("span", "", t(watch.campaign.name_key)), el("span", "", t("fin.difficulte", { d: t(`diff.${watch.difficulty}`) })));
  const faction = o.winner === null ? null : o.winner === "titans" ? t("fac.titans") : t(world.nations?.factions.get(o.winner)?.name_key ?? `fac.${o.winner.replace(/^fac_/, "")}`);
  const facts = el("ul", "fin-campagne__faits");
  facts.append(
    el("li", "", faction ? t("fin.vainqueur", { faction }) : t("fin.aucun")),
    el("li", "", t("fin.jours", { n: formatNumber(o.days), date: t("date.format", { year: state.date.year, day: state.date.day }) })),
  );
  if (o.score !== null) facts.append(el("li", "", t("fin.score", { score: formatNumber(Math.round(100 * o.score)), seuil: formatNumber(Math.round(100 * watch.threshold)) })));
  const close = (): void => root.remove();
  const row = el("div", "fin-campagne__boutons");
  const cont = button(t("fin.continuer"), close, "registre-bouton");
  cont.dataset["action"] = "continuer";
  row.append(cont);
  if (actions.epilogue) {
    const ep = button(t("fin.epilogue"), () => {
      close();
      actions.epilogue?.();
    }, "registre-bouton");
    ep.dataset["action"] = "epilogue";
    row.append(ep);
  }
  const menu = button(t("fin.menu"), actions.menu, "registre-bouton principal");
  menu.dataset["action"] = "menu";
  row.append(menu);
  paper.append(head, el("p", `fin-campagne__tampon fin-campagne__tampon--${view}`, t(`fin.titre.${view}`)), el("p", "fin-campagne__texte", t(o.text_key)), facts, row);
  root.append(paper);
  parent.append(root);
  menu.focus();
  return root;
}
