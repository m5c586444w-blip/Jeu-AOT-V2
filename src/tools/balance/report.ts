// Rapport HTML autonome de sim:balance (P9.4, CP9-09) : aucune ressource externe (ni police, ni script, ni image).
export interface CampaignSummary {
  id: string;
  scenario: string;
  nameKey: string;
  requested: number;
  played: number;
  msPerGame: number;
  meanDays: number;
  wins: Record<string, number>;
  rules: Record<string, number>;
  causes: Record<string, number>;
  charCauses: Record<string, number>;
  shortage: Record<string, number>;
  limiting: Record<string, number>;
  ai: Record<string, number>;
  byProfile: Record<string, { n: number; win: number }>;
  expeditions: number;
  expPooled: number;
  expMean: number;
  expPerGame: number[];
  famine: number;
  spiral: number;
  famineRules: Record<string, number>;
  spiralRules: Record<string, number>;
  faminProfiles: Record<string, number>;
  spiralProfiles: Record<string, number>;
  hizuru: number;
  divergent: number;
  meanScore: number;
  /** Scores des parties allées à l'échéance : p10, p25, médiane, p75, p90 (null si aucune). */
  deadlineQ: number[] | null;
  deadlineCount: number;
  /** Moyenne des composantes du score à la fin de partie. */
  parts: Record<string, number>;
  threshold: number;
  determinism: { ok: boolean; lines: string[] };
}

export interface RunInfo {
  n: number;
  budgetMin: number;
  threads: number;
  difficulty: string;
  mortMean: number;
  mortCount: number;
  minutes: number;
}

const NAMES: Record<string, string> = {
  c845: "845 — La chute de Maria",
  c850: "850 — De Trost à la mer",
  c854: "854 — La guerre avec Marley",
  cgrondement: "854 — Le Grondement",
  fac_paradis: "Paradis",
  fac_marley: "Marley",
  fac_allies: "Alliés (Alliance)",
  titans: "Les Titans",
  aucune: "Aucune (paix, chute du régime)",
};
/** Couleur par camp (identité fixe, jamais par rang) ; palette catégorielle validée du guide de visualisation. */
const SERIES: Record<string, number> = { fac_paradis: 1, titans: 2, fac_marley: 2, fac_allies: 3, aucune: 0 };

const esc = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const pct = (x: number): string => (Number.isFinite(x) ? `${(100 * x).toFixed(1)} %` : "—");
const sorted = (r: Record<string, number>): [string, number][] => Object.entries(r).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

function bars(rows: [string, number][], total: number, series = (k: string): number => SERIES[k] ?? 1): string {
  return `<div class="bars">${rows
    .map(([k, v]) => {
      const share = total > 0 ? v / total : 0;
      return `<div class="bar-row" title="${esc(NAMES[k] ?? k)} : ${v} sur ${total} (${pct(share)})"><span class="bar-label">${esc(NAMES[k] ?? k)}</span><span class="bar-track"><span class="bar s${series(k)}" style="width:${(100 * share).toFixed(2)}%"></span></span><span class="bar-value">${pct(share)}</span></div>`;
    })
    .join("")}</div>`;
}

function table(head: string[], rows: (string | number)[][]): string {
  return `<table><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${esc(String(c))}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
}

function histogram(values: number[]): string {
  const bins = Array.from({ length: 10 }, () => 0);
  for (const v of values) {
    const i = Math.min(9, Math.max(0, Math.floor(v * 10)));
    bins[i] = (bins[i] ?? 0) + 1;
  }
  const max = Math.max(1, ...bins);
  return `<div class="histo" role="img" aria-label="Histogramme de la mortalité par expédition">${bins.map((b, i) => `<span class="col" title="${i * 10}–${i * 10 + 10} % : ${b} expéditions"><span class="colbar s1" style="height:${((100 * b) / max).toFixed(1)}%"></span><span class="collab">${i * 10}</span></span>`).join("")}</div>`;
}

function section(s: CampaignSummary): string {
  const total = s.played;
  const top = sorted(s.wins).filter(([f]) => f !== "aucune")[0] ?? ["—", 0];
  const explainDegenerate = (count: number, rules: Record<string, number>, profiles: Record<string, number>): string =>
    count === 0 ? "aucune partie" : `${count} parties (${pct(count / total)}) ; issues : ${sorted(rules).map(([k, v]) => `${k} ${v}`).join(", ")} ; joueur type : ${sorted(profiles).map(([k, v]) => `${k} ${v}`).join(", ")}`;
  return `<section>
<h2>${esc(NAMES[s.id] ?? s.id)} <small>${esc(s.scenario)}</small></h2>
<div class="tiles">
<div class="tile"><span class="big">${total}</span><span>parties jouées${s.played < s.requested ? ` sur ${s.requested} demandées (budget)` : ""}</span></div>
<div class="tile"><span class="big">${s.meanDays.toFixed(0)}</span><span>jours de jeu en moyenne</span></div>
<div class="tile"><span class="big">${pct(top[1] / Math.max(1, total))}</span><span>faction la plus victorieuse : ${esc(NAMES[top[0]] ?? top[0])} (seuil 70 %)</span></div>
<div class="tile"><span class="big">${pct(s.expMean)}</span><span>mortalité moyenne par expédition (${s.expeditions} expéditions)</span></div>
</div>
<h3>Victoires par faction</h3>${bars(sorted(s.wins), total)}
<h3>Fins de partie</h3>${table(["Règle de fin", "Parties", "Part"], sorted(s.rules).map(([k, v]) => [k, v, pct(v / total)]))}
<p>Score à l'échéance (${s.deadlineCount} parties, seuil ${s.threshold.toFixed(2)}) : ${s.deadlineQ ? ["p10", "p25", "médiane", "p75", "p90"].map((l, i) => `${l} ${(s.deadlineQ?.[i] ?? NaN).toFixed(3)}`).join(" · ") : "aucune partie"}. Composantes moyennes : ${esc(Object.entries(s.parts).map(([k, v]) => `${k} ${v.toFixed(2)}`).join(", "))}.</p>
<h3>Joueur type</h3>${table(["Profil", "Parties", "Victoires de la nation jouée", "Taux"], sorted(Object.fromEntries(Object.entries(s.byProfile).map(([k, v]) => [k, v.n]))).map(([k]) => [k, s.byProfile[k]?.n ?? 0, s.byProfile[k]?.win ?? 0, pct((s.byProfile[k]?.win ?? 0) / Math.max(1, s.byProfile[k]?.n ?? 0))]))}
<h3>Causes de mort</h3>${table(["Cause", "Soldats d'expédition", ""], sorted(s.causes).map(([k, v]) => [k, v, ""]))}${table(["Cause", "Personnages nommés", ""], sorted(s.charCauses).map(([k, v]) => [k, v, ""]))}
<h3>Ressources limitantes</h3>${table(["Ressource", "Parties où elle limite le plus", "Jours sous 5 % du stock de départ (total)"], sorted(s.limiting).map(([k, v]) => [k, v, s.shortage[k] ?? 0]))}
<h3>Cas dégénérés</h3><ul><li>Famine (≥ 30 jours sans vivres) : ${esc(explainDegenerate(s.famine, s.famineRules, s.faminProfiles))}</li><li>Spirale de mort (population &lt; 70 % du départ et légitimité &lt; 25) : ${esc(explainDegenerate(s.spiral, s.spiralRules, s.spiralProfiles))}</li></ul>
<h3>IA des factions</h3>${table(["Décision (couche : faction : action)", "Par partie"], sorted(s.ai).slice(0, 14).map(([k, v]) => [k, (v / total).toFixed(2)]))}<p>Bascules d'Hizuru : ${s.hizuru} parties · branche divergente : ${s.divergent} parties.</p>
<h3>Déterminisme</h3><ul>${s.determinism.lines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>
</section>`;
}

export function renderHtml(summaries: readonly CampaignSummary[], info: RunInfo): string {
  const all = summaries.flatMap((s) => s.expPerGame);
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Équilibrage P9</title>
<style>
:root{--surface:#fcfcfb;--panel:#f3f2ee;--text:#1d1d1b;--text2:#55544e;--line:#d9d7cf;--s0:#8b8a83;--s1:#2a78d6;--s2:#eb6834;--s3:#1baf7a}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--surface:#1a1a19;--panel:#252523;--text:#f0efec;--text2:#c3c2b7;--line:#3b3a36;--s0:#8b8a83;--s1:#3987e5;--s2:#d95926;--s3:#199e70}}
:root[data-theme="dark"]{--surface:#1a1a19;--panel:#252523;--text:#f0efec;--text2:#c3c2b7;--line:#3b3a36;--s0:#8b8a83;--s1:#3987e5;--s2:#d95926;--s3:#199e70}
body{margin:0;padding:24px 16px;background:var(--surface);color:var(--text);font:15px/1.5 system-ui,sans-serif}
main{max-width:1000px;margin:0 auto}h1{font-size:24px;margin:0 0 4px}h2{font-size:20px;margin:32px 0 8px;border-top:1px solid var(--line);padding-top:16px}h2 small{font-size:12px;color:var(--text2);font-weight:400}
h3{font-size:15px;margin:18px 0 6px}p,li{color:var(--text2)}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:8px}.tile{background:var(--panel);border-radius:6px;padding:10px 12px;display:flex;flex-direction:column}.tile .big{font-size:24px;font-weight:600;color:var(--text)}.tile span{color:var(--text2);font-size:13px}
.bars{display:flex;flex-direction:column;gap:6px}.bar-row{display:grid;grid-template-columns:minmax(120px,220px) 1fr 70px;gap:8px;align-items:center}.bar-label,.bar-value{font-size:13px;color:var(--text)}.bar-value{text-align:right}
.bar-track{height:14px;background:var(--panel);border-radius:4px;overflow:hidden}.bar{display:block;height:100%;border-radius:0 4px 4px 0}
.s0{background:var(--s0)}.s1{background:var(--s1)}.s2{background:var(--s2)}.s3{background:var(--s3)}
table{border-collapse:collapse;margin:6px 0;font-size:13px;width:100%}th,td{border-bottom:1px solid var(--line);padding:4px 8px;text-align:left}th{color:var(--text2);font-weight:500}td{color:var(--text)}
.histo{display:flex;gap:2px;height:140px;align-items:flex-end;margin:8px 0 20px}.col{flex:1;display:flex;flex-direction:column;justify-content:flex-end;height:100%;position:relative}.colbar{display:block;border-radius:4px 4px 0 0}.collab{font-size:11px;color:var(--text2);text-align:center}
@media (max-width:600px){.bar-row{grid-template-columns:110px 1fr 56px}}
</style></head><body><main>
<h1>Équilibrage des campagnes (P9)</h1>
<p>Parties headless jouées par un joueur type tiré par graine (profils historique, prudent, audacieux, hasardeux), difficulté ${esc(info.difficulty)}, ${info.threads} fils ; ${info.n} parties demandées par campagne, budget ${info.budgetMin} min par campagne ; durée totale ${info.minutes.toFixed(1)} min. Les fins de partie sont évaluées par les règles des campagnes (données), hors de la simulation.</p>
<h2>Mortalité d'expédition (toutes campagnes)</h2>
<p>Moyenne ${pct(info.mortMean)} sur ${info.mortCount} expéditions (cible 25–40 %). Répartition par tranche de 10 points :</p>${histogram(all)}
${summaries.map(section).join("\n")}
</main></body></html>
`;
}
