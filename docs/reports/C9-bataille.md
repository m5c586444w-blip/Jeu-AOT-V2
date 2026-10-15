# C9 — `smoke:bataille` : carte → rencontre → bataille → retour

## Réalisé
- `src/tools/smoke-bataille.ts` + script `npm run smoke:bataille` : 854 côté Paradis, guerre à Marley, interception en marche forcée, contact (registre des armées), bataille en temps réel (×2, 8 s), bilan, validation, retour à la carte. Le cadre unique (C1) est contrôlé à six étapes (carte, rencontre, bataille, bilan, retour) ; la bataille doit être bornée entre barre supérieure et menu de gestion.
- Défaut trouvé par la capture et corrigé : le registre des armées restait ouvert sur la moitié gauche de la bataille. `playBattle` (`src/ui/gameScreen.ts`) le ferme à l'entrée en bataille ; il se rouvre par le menu de gestion.
- Défaut du smoke corrigé : le registre fermé garde son DOM périmé ; on le rouvre avant de contrôler que la rencontre est résolue.

## Sortie réelle (dernière exécution)
`OK  retour carte : cadre présent …` · `OK  0 erreur console` · `smoke:bataille : tout est conforme.` · `EXIT=0`.

## Revue de `docs/screenshots/c9-bataille.png`
Description : titre « Contact à Maria-Est », temps 00:20, vitesses ; scène 3D vue de dessus (mur gris, maisons rouges, six escouades ennemies « E », une section amie « S1 ») ; panneau d'ordres à droite, cartes de sections en bas, menu de gestion visible.
Défauts : (1) le fil de notifications recouvre encore l'en-tête « Sélection » (dette n° 100) ; (2) sol uni olive/brun et mur sans texture : scène peu lisible (rendu logiciel, assets C10/C12) ; (3) échelle incohérente : le carnet annonce « 33 hommes de Paradis contre 146 fantassins » alors que le registre affiche 363 contre 1 801 (bataille de compagnie, à expliquer à l'écran) ; (4) vaste zone vide au centre de la scène.
## Limites
Parcours en rendu logiciel ; débit GPU « à vérifier sur le PC de Gabriel ». Piles sur la carte : déjà présentes (étendards `drawArmyBanner`, chiffres d'effectifs) ; aucune modification.

`npm run verify` : Test Files  154 passed (154), Tests  1300 passed (1300), `EXIT=0`.

## C9.7 — La Marée régionale (D-177)
Sortie réelle : `npm run verify` : `Test Files 155 passed (155)`, `Tests 1317 passed (1317)`, `✓ built in 1.89s`, `EXIT=0`. Tests : `tests/sim/tide/region.test.ts` (17). Empreinte 120 jours sans activation : `e0a0b63c` inchangée (test). Conception : `docs/phases/C9-maree.md`.
