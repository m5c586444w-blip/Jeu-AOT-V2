# R1e — Système de lieux et mur Maria (pilote : Shiganshina)

> Consigne verbatim : `docs/phases/R1e-consigne.md` (elle prime sur ce plan). Commit de départ : **`497be52`** (fin de R1d).
> Arrêt obligatoire à la fin de R1e (pilote). Ensuite LC-B, LC-C, LC-D sans arrêt, arrêt après LC-D.

## 1. Tâches (un commit chacune, `npm run verify` avant)

| # | Tâche |
|---|---|
| R1e.0 | `CLAUDE.md` (règles §9), `PROGRESS.md` (feuille de route), ce plan, `docs/reports/dette.md`, `docs/lore/questions-ouvertes.md` |
| R1e.1 | Schéma de lieu (`src/data/placeSchema.ts`), `data/places/_murs.json`, chargeur `loadPlace` (tronçons de 64 m), `npm run places:valider`, générateur SVG (plan, coupe, élévations), `docs/places/` |
| R1e.2 | Correctifs de R1d (consigne §6, points 1 à 8), une capture avant/après chacun |
| R1e.3 | Modèles de mur (coupe, parement sans répétition) et de portes (extérieure, intérieure, de rivière), bancs de test isolés |
| R1e.4 | Shiganshina à la main : plan complet, portes, états 845-avant, 845-breche, 850-reprise, végétation, repères |
| R1e.5 | Trois autres districts du mur Maria (`maria-district-2/3/4`, nom non établi, `?`) |
| R1e.6 | Mémoire des lieux (plans figés, deltas, cache LRU) et un village N2 de démonstration |
| R1e.7 | `npm run places:captures` (script unique), revue des captures, rapport `docs/reports/R1e.md` (≤ 150 lignes hors sorties), `PROGRESS.md`. **Arrêt** |

## 2. Définitions de mesure (fixées avant le code)

- **Population** : celle de la simulation au départ du scénario `scn_sandbox_845` (`state.provinces[<province>].population`), multipliée par la part de la province que représente le lieu (`population.part`, `1` pour un district, `A` pour un village). Pour un lieu sans province dans les données (districts de Maria non établis) : valeur `?` paramétrable, signalée.
- **Surface bâtie** (ha) : somme des aires des îlots + somme des longueurs × largeurs des rues du lieu. Hors places de plus de 0,5 ha, parcs, eau, glacis et emprise du mur.
- **CR1e-03** : |surface bâtie − population ÷ densité| ≤ 25 % de population ÷ densité. Densité bornée par classe : cœur ancien 150–300 hab/ha, faubourg 60–150, village 15–50, ferme < 10.
- **CR1e-04** : arbres dans la surface bâtie ≥ 8 par hectare ; dans chaque parc et dans l'ensemble des îlots de faubourg ≥ 20 par hectare.
- **Parement (CR1e-05)** : sur une élévation de mur rendue de face (banc de mur, 120 m × 50 m), autocorrélation normalisée de la luminance des colonnes, pour des décalages de 2 m à 30 m : maximum < **0,35**. Le parement de R1d, à texture répétée, sert de témoin et doit dépasser ce seuil.
- **Portes (CR1e-06)** : ΔE moyen = moyenne, sur une grille de 64 × 36 points, du ΔE76 entre les deux images. Seuil ≥ 6 pour chaque paire des 7 vues d'une porte, et entre la vue « extérieure-face » de la porte extérieure et celle de la porte intérieure.
- **États (CR1e-07)** : ΔE moyen ≥ 6 entre les vues d'ensemble des trois états, deux à deux.

## 3. Critères

| # | Critère | Commande / preuve |
|---|---|---|
| CR1e-01 | `src/sim` inchangé ; `verify` au code 0 | `git diff --stat 497be52 -- src/sim` vide ; `npm run verify` |
| CR1e-02 | Schéma validé ; `places:valider` passe sur tous les lieux | `npm run places:valider` |
| CR1e-03 | Population ÷ densité = surface bâtie à ±25 % | `tests/places/*.test.ts` |
| CR1e-04 | ≥ 8 arbres/ha bâti ; ≥ 20/ha sur parcs et faubourgs | idem |
| CR1e-05 | Coupe SVG, hauteur 50 m, épaisseur lue de `_murs.json` ; parement non répété | test + `docs/places/<id>/mur-coupe.svg` + banc de mur |
| CR1e-06 | 7 vues par porte, non vides, distinctes ; extérieure ≠ intérieure | `npm run places:captures` + test |
| CR1e-07 | Shiganshina : 3 états rendus et distincts | captures |
| CR1e-08 | 4 districts du mur Maria ; noms non confirmés en `?` et dans `questions-ouvertes.md` | test + fichier |
| CR1e-09 | Plan figé → même empreinte de rendu ; deltas de 100 lieux < 200 Kio | test |
| CR1e-10 | Bundle principal inchangé ; assets hors du JS ; `assets:check` code 0 | `npm run mesure:r1d -- bundle` ; `npm run assets:check` |
| CR1e-11 | Correctifs §6 (1 à 8) : capture avant/après chacun | planche `docs/screenshots/r1e-correctifs-*.png` |
| CR1e-12 | Captures revues une par une (ligne 14) | rapport |

## 4. Hors périmètre

- Titans (phase T1) ; corps de base (état R1d gardé) ; raccord avec la simulation tactique (R2, exception `map.ts`).
- Optimisation du rendu logiciel ; nouvel outil de mesure (seuls `mesure:r1d`, `smoke:r1b`, et les deux scripts demandés : `places:valider`, `places:captures`).
- Les lieux de LC-B, LC-C, LC-D.
