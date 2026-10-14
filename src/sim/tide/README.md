# src/sim/tide

Pilier P2 « La Marée » et moteur de rencontres (spec 26 §3 et §3 bis). Paramètres : `data/balance/tide.json` `[A]` (schéma `TideBalanceSchema`).

- `grid.ts` : grille de densité de Titans (cellules bloquées = murs), attention (piles, humains sur les murs, pics de combat/canon/explosion/fusée), diffusion + attraction conservatrices, plafond, repeuplement piloté par l'attention (seule source), `removeTitans` (puits), `injectBreach` (anneau).
- `activity.ts` : jour/nuit × saison ; sous `immobile_below` les Titans ne bougent pas, sauf attention locale ≥ `wake_attention`.
- `encounter.ts` : `λ = base × densité × empreinte × activité × visibilité` et tirage `Rng` fourni (fork par pile et par tick) ; détection humaine asymétrique (éclaireurs, renseignement, météo, nuit, empreinte, couvert), contact, embuscade ; vues par faction/siège (position et effectif arrondi, jamais la composition).
- `combat.ts` : échange de feu humain contre humain (armes en données, couvert, suppression, moral/déroute, flanquement, munitions, gaz de l'ODM, blessés/évacuation). Conservation : effectif + blessés + morts + évacués constant.
- `focus.ts` : attention tactique des Titans (distance, groupe, bruit, mouvement, appât, anormal, immobile, saturation, saisie).

Pur : aucun DOM, aucun `Math.random`, temps et aléa injectés. **Non branché** au tick, à `routes.ts` (`titanDensity` reste statique) ni à `battle.ts` : aucune empreinte de référence modifiée. Les identifiants de faction viennent des piles ; l'hostilité est un prédicat injecté (`Hostility`). Choix `[A]` : plan 2D, effectifs réels (flottants) en équivalents hommes, armes identifiées par clé de `weapons`.
