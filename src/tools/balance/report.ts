import type { ScenarioStats } from "./stats";

/** Critères de P9 lus sur les agrégats (CP9-03 à CP9-06). */
export interface Criterion {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
}

export interface BalanceReport {
  generated: string;
  parties: number;
  seedBase: number;
  difficulty: string;
  scenarios: ScenarioStats[];
  criteria: Criterion[];
}

const pct = (x: number | null): string => (x === null ? "—" : `${(x * 100).toFixed(1)} %`);
const esc = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const OUTCOME_LABEL: Record<string, string> = { victoire: "victoire", defaite: "défaite", terme: "au terme", en_cours: "inachevée" };

function bar(stats: ScenarioStats["camps"][number]): string {
  const parts = ["victoire", "terme", "defaite", "en_cours"].map((k) => {
    const v = stats.outcomes[k]?.share ?? 0;
    return v > 0 ? `<span class="seg seg--${k}" style="width:${(v * 100).toFixed(2)}%" title="${OUTCOME_LABEL[k]} ${pct(v)}"></span>` : "";
  });
  return `<div class="barre">${parts.join("")}</div>`;
}

function table(head: string[], rows: string[][]): string {
  return `<table><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
}

function section(s: ScenarioStats): string {
  const camps = s.camps.map((c) => {
    const prof = Object.entries(c.byProfile).filter(([, v]) => v.games > 0).map(([p, v]) => `${esc(p)} : ${v.victoire}/${v.games} victoires, ${v.defaite} défaites`).join(" · ");
    const def = Object.entries(c.defeats).sort(([, a], [, b]) => b - a).map(([k, v]) => `${esc(k)} ${v}`).join(", ") || "—";
    return [esc(c.camp), bar(c), pct(c.outcomes["victoire"]?.share ?? 0), pct(c.outcomes["terme"]?.share ?? 0), pct(c.outcomes["defaite"]?.share ?? 0), def, prof];
  });
  const deaths = Object.entries(s.deaths).slice(0, 12).map(([k, v]) => [esc(k), Math.round(v.total).toLocaleString("fr-FR"), v.perGame.toFixed(1)]);
  const lim = Object.entries(s.limiting).map(([k, v]) => [esc(k), String(v.n), pct(v.share)]);
  const obj = Object.entries(s.objectives).map(([k, v]) => [esc(k), pct(v.share)]);
  const e = s.expeditions;
  return `<section>
<h2>${esc(s.scenario)} — joué par ${esc(s.camp)} (${s.games} parties)</h2>
<p>Durée (jours) : moyenne ${s.duration.mean.toFixed(0)} · p10 ${s.duration.p10} · médiane ${s.duration.p50} · p90 ${s.duration.p90}. Ordres refusés par la simulation : ${s.ordersRefused}.${s.errors.length ? ` <strong>Erreurs :</strong> ${s.errors.map(esc).join(" ; ")}` : ""}</p>
<h3>Issues par camp</h3>
${table(["Camp", "Répartition", "Victoire", "Au terme", "Défaite", "Causes de défaite", "Par profil du pilote"], camps)}
<h3>Objectifs atteints (camp joué)</h3>
${table(["Objectif", "Parties"], obj)}
<h3>Causes de mort (toutes parties)</h3>
${table(["Cause", "Total", "Par partie"], deaths)}
<p>Expéditions : ${e.launched} lancées, ${e.departed.toLocaleString("fr-FR")} partis, ${e.dead.toLocaleString("fr-FR")} morts — mortalité ${pct(e.mortality)} (moyenne par partie ${pct(e.perGameMean)}).</p>
<h3>Ressources limitantes</h3>
${table(["Ressource", "Parties", "Part"], lim)}
<h3>Cas dégénérés</h3>
<p>Famine systématique (vivres épuisés plus de la moitié de la partie) : ${s.degenerate.famine.n} (${pct(s.degenerate.famine.share)}) · spirale de mort (île dépeuplée d'un cinquième, moral sous 25) : ${s.degenerate.spiral.n} (${pct(s.degenerate.spiral.share)}).</p>
${s.degenerate.explained.length ? `<ul>${s.degenerate.explained.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
</section>`;
}

/** Page HTML autonome (aucune ressource externe). */
export function renderHtml(r: BalanceReport): string {
  const crit = table(["Critère", "Statut", "Détail"], r.criteria.map((c) => [esc(`${c.id} ${c.label}`), c.ok ? '<span class="ok">OK</span>' : '<span class="ko">KO</span>', esc(c.detail)]));
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Équilibrage P9</title>
<style>
:root { --fond: #f4efe4; --texte: #1f1a14; --filet: #b9ab8f; --victoire: #3f6b3a; --terme: #b08a2e; --defaite: #8e2f25; --encours: #777; }
@media (prefers-color-scheme: dark) { :root { --fond: #1b1814; --texte: #ece4d4; --filet: #5a5040; } }
body { background: var(--fond); color: var(--texte); font: 15px/1.45 Georgia, serif; margin: 0 auto; max-width: 72rem; padding: 1rem; }
table { border-collapse: collapse; width: 100%; margin: 0.4rem 0 1rem; font-size: 0.9rem; }
th, td { border-bottom: 1px solid var(--filet); padding: 0.25rem 0.4rem; text-align: left; vertical-align: top; }
.barre { display: flex; width: 12rem; height: 0.9rem; border: 1px solid var(--filet); }
.seg--victoire { background: var(--victoire); } .seg--terme { background: var(--terme); } .seg--defaite { background: var(--defaite); } .seg--en_cours { background: var(--encours); }
.ok { color: var(--victoire); font-weight: bold; } .ko { color: var(--defaite); font-weight: bold; }
section { border-top: 2px solid var(--filet); margin-top: 1.5rem; }
</style></head><body>
<h1>Murs et Sang — équilibrage (P9, sim:balance)</h1>
<p>${r.parties} parties par scénario, graines ${r.seedBase} à ${r.seedBase + r.parties - 1}, difficulté ${esc(r.difficulty)}, pilote automatique par commandes (profils passif, gestionnaire, militaire, aléatoire tirés de la graine). Généré le ${esc(r.generated)}.</p>
<h2>Critères</h2>
${crit}
${r.scenarios.map(section).join("\n")}
</body></html>
`;
}
