# src/sim/tide

Pilier P2 « La Marée » et moteur de rencontres (spec 26 §3 et §3 bis). Paramètres : `data/balance/tide.json` `[A]` (schéma `TideBalanceSchema`).

- `grid.ts` : grille de densité de Titans (cellules bloquées = murs), attention (piles, humains sur les murs, pics de combat/canon/explosion/fusée), diffusion + attraction conservatrices, plafond, repeuplement piloté par l'attention (seule source), `removeTitans` (puits), `injectBreach` (anneau).
- `activity.ts` : jour/nuit × saison ; sous `immobile_below` les Titans ne bougent pas, sauf attention locale ≥ `wake_attention`.
- `encounter.ts` : `λ = base × densité × empreinte × activité × visibilité` et tirage `Rng` fourni (fork par pile et par tick) ; détection humaine asymétrique (éclaireurs, renseignement, météo, nuit, empreinte, couvert), contact, embuscade ; vues par faction/siège (position et effectif arrondi, jamais la composition).
- `combat.ts` : échange de feu humain contre humain (armes en données, couvert, suppression, moral/déroute, flanquement, munitions, gaz de l'ODM, blessés/évacuation). Conservation : effectif + blessés + morts + évacués constant.
- `focus.ts` : attention tactique des Titans (distance, groupe, bruit, mouvement, appât, anormal, immobile, saturation, saisie).

Pur : aucun DOM, aucun `Math.random`, temps et aléa injectés. **Branché depuis C9.7 (D-177) seulement par `region.ts`** : régions de grille à la demande autour des armées exposées, `pillars.tide`, commande `EnableTide`, lentille `ctx.tideDensity` lue par `armies.ts` ; `routes.ts` (`titanDensity` reste la base statique) et `battle.ts` ne sont pas touchés. Désactivé par défaut : aucune empreinte de référence modifiée. Les identifiants de faction viennent des piles ; l'hostilité est un prédicat injecté (`Hostility`). Choix `[A]` : plan 2D, effectifs réels (flottants) en équivalents hommes, armes identifiées par clé de `weapons`.

Revue C5 (corrections) :
- `Geometry.visibility` et `Geometry.night` réduisent la précision de tir des deux camps (`combat.fire_vis_floor`, `combat.fire_night_mult`, `[A]`). Le flanquement est symétrique : `flankA` (a sur b) et `flankB` (b sur a), chacun donnant un bonus de feu à l'attaquant et une pénalité de moral à la victime.
- `projectEncounterForFaction(encounter, faction, piles)` : projection d'une `HumanEncounter` pour une faction. Elle ne reçoit jamais `seen` ni `ambusher` de l'adversaire ; l'identité et la distance de l'adversaire ne sont fournies que si SA pile l'a repéré (sinon `null`). À utiliser pour tout affichage ou message par siège ; `HumanEncounter` brute est réservée au moteur.
- Alliances : `viewForFaction`/`viewForSeat` ne distinguent PAS les alliés par défaut (toute autre faction est soumise à la détection). Un prédicat `Hostility` optionnel (dernier paramètre) fait voir en permanence les piles des factions non hostiles (coalition), avec l'effectif arrondi seulement. Décision `[A]` : le prédicat est fourni par l'appelant (diplomatie), jamais déduit ici.
