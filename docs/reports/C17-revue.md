# Revue indépendante C17, tranche 1 (hors-murs)

Relecteur : sous-agent distinct de l'auteur. Périmètre : Jinae, Ragako, Dauper, château d'Utgard, forêt des Arbres Géants (fichiers non commités). Commandes lancées : `npx vitest run tests/places` (11 fichiers, 194 tests passés) ; `npm run places:valider -- --sans-docs` (« 22 lieu(x) N1 et 1 plan(s) figé(s) valides »). Ni `verify` ni `places:captures` lancés. `git diff --stat -- src/sim src/data` : vide.

## Verdict : ACCEPTÉ AVEC RÉSERVES

Aucun défaut bloquant. Les réserves portent sur la forêt (périmètre) et sur des détails de test et de documentation.

## Contrôles

1. **Canon.** Atlas S05, S06, S10, S13 et 11 §2 : Ragako, Dauper et Jinae au sud de l'intérieur de Rose (`orientation` sud, `C`, régions `anneau_rose` dans les provinces) ; Ragako et Utgard détruits en 850 (états `C`, `ruines` ≥ 0,9, six incendies, habitants 0). Forêt : orientation `aucune` `?`, localisation exacte `?` (Q32), `anneau_maria` repris de `data/geo` en `A`. Utgard : position `?` (Q31). Conforme.
2. **Étiquetage.** Tous les bâtiments, rues, places, quartiers, parcs et voies d'eau sont `A` (testé). Seul le fait « détruit en 850 » est `C`, avec une source `A` séparée pour l'étendue. Réserve : l'état entier est étiqueté `C` alors que son contenu (ruines 92 %/95 %, abandon 0,35/0,55) est `A` (défaut 4). Parts 12 % (1 044 hab.) et 8 % (696 hab.) : raisonnables (un village de 8 696 habitants serait irréaliste), déclarées `A` dans `population.note`, `creations.md` et Q29/Q30. Limite non signalée : les 88 % et 92 % restants n'existent dans aucun lieu (dette 3 du rapport, qui n'en précise pas l'effet).
3. **Populations.** `simPopulations()` : Jinae 17 391, Ragako et Dauper 8 696 chacune, Utgard et forêt 0 ; le test relit la simulation et vérifie `z.population`. Utgard (24) et forêt (27) en `province: null`, `canon: "?"`, comme `chapelle-reiss`. Conforme.
4. **CR1e-03/04.** Réellement exécutés par `checkPlace` pour les cinq lieux (écart ≤ 25 %, arbres/ha bâti ≥ 8, parcs ≥ 20/ha). Forêt : voir plus bas.
5. **Géométrie.** Le test vérifie centre et quatre coins de chaque bâtiment sur un îlot, une place ou un parc, le centre dans le périmètre et l'absence de chevauchement. Je l'ai relu : il est correct pour des rectangles tournés. Il traite un parc comme une parcelle valable, ce qui est admis par C15/C16. Les rues ne sont pas contrôlées contre le périmètre (défaut 2).
6. **Noms interdits.** Appliqués à `nom`, `libelle`, rues, bâtiments, places, parcs, quartiers, voies d'eau, arbres nommés, états et vues, avec preuve de la liste. Deux entrées ne peuvent jamais correspondre (défaut 5). Aucun nom de l'œuvre trouvé à la relecture des JSON.
7. **Rapport.** Honnête : revue « à faire », captures partielles, dette `places:valider` avec docs, et 12 défauts visuels listés. J'ai ouvert quatre captures et elles correspondent à la description (voir plus bas). Écarts : défauts 3 et 6.
8. **`src/sim` et schéma.** Intacts (diff vide ; seul `src/tools/places/auteur/index.ts` est modifié).

## Forêt : le périmètre resserré est-il de la triche ?

Contournement assumé, pas une falsification. Le périmètre est un carré de 200 m (4 ha) pour une forêt de 2 000 m. L'effectif de 27 personnes, `?`, a été calé sur la surface du poste forestier. La mesure CR1e-03 ne prouve donc rien sur la forêt : 2,6 ha bâtis pour 27 hab. ÷ 9,5 est une identité construite. Les 10 285 arbres, les futaies et les layons sont hors périmètre et échappent à CR1e-04 : seuls les ≥ 20 arbres/ha du poste (parcs) et les futaies à 26/ha sont contrôlés.

Le choix est déclaré (rapport « Décisions », `creations.md`, Q32, commentaire de `foret-arbres-geants.ts`) et défendable : une forêt n'est pas une zone habitée. Le rapport écrit pourtant que le premier essai était à +52,8 % et que le périmètre a été resserré « pour passer ». À reconnaître franchement dans le rapport (défaut 1).

## Captures ouvertes (Read)

- Jinae : damier de toits rouges et ocre vu de loin, deux places claires, bandes de vergers à gauche, potager brun isolé. Défauts : repères illisibles, sol plat, ciel blanc.
- Ragako : bourg autour d'une place de terre dans une ceinture de prés, liseré orange du périmètre. Défauts : moulin et ruisseau invisibles, arbres alignés, état 850 non montré.
- Utgard : cour dallée blanche, donjon et logis en pierre grise, arbres au premier plan qui masquent le sud. Défauts : aucun signe d'abandon, douves invisibles, aspect de manoir.
- Forêt : carré de canopée uniforme, minuscule poste au centre. Défauts : aucune échelle, géants indiscernables d'arbres ordinaires, layons invisibles.
Les défauts sont ceux du rapport ; la dette « captures complètes » est correctement déclarée.

## Défauts numérotés

1. `src/tools/places/auteur/foret-arbres-geants.ts` (dernière ligne, `perimetre` ±100) : périmètre resserré, CR1e-03/04 non démonstratifs pour la forêt. Gravité moyenne. Déclarer l'effet dans le rapport (« mesure non démonstrative ») et vérifier qu'aucun consommateur (rendu, `places:captures`, tactique) ne suppose les rues et parcs dans le périmètre.
2. `tests/places/horsmurs.test.ts:81-98` : seuls les bâtiments sont testés contre le périmètre ; les rues (par exemple `layon-du-corridor`, `laie-de-l-est`, hors des ±100 de la forêt) ne le sont pas. Gravité faible.
3. `tests/places/horsmurs.test.ts:253` : le titre annonce « d'au moins 150 ha » alors que l'assertion exige ≥ 300 ha ; incohérence trompeuse. Gravité faible.
4. `data/places/ragako.json`, `chateau-utgard.json` (états `850-detruit`, `845-abandonne`) : état entier étiqueté `canon: "C"` avec contenu majoritairement `A` ; le test impose ce `C` (lignes ~155 et ~189). Gravité faible à moyenne (esprit de l'erratum « C pour le fait seulement »). Le fait étant déjà porté par la source `C`, l'état pourrait être `A`.
5. `tests/places/horsmurs.test.ts:20` : `\b` après une lettre accentuée (« zoë », « cuirassé ») ne correspond jamais ; deux noms de la liste sont inopérants. Gravité faible. Liste non exhaustive (pas de Ness, Ilse hors liste mais présente, etc.).
6. `docs/reports/C17.md:16-21` : mentions d'écarts « -4,1 % ; +14,4 % » collées correctement, mais le rapport ne signale pas que 88 % et 92 % des provinces Ragako et Dauper restent sans lieu : population simulée non représentée. Gravité faible.
7. Hors périmètre du diff déclaré : `docs/places/krolva/vue-ensemble.png` et `docs/places/utopia/vue-place-de-la-foire.png` modifiés, plus une vingtaine de PNG `docs/places/utopia/*` non suivis (régénérés par les captures) et `docs/reports/places-utopia.json`. Le rapport n'en parle pas. Gravité faible : à commiter à part ou à écarter.

## Conclusion

Chiffres et tests reproductibles ; étiquetage, noms, géométrie et populations conformes aux défauts de C15 et C16. Acceptation sous réserve de corriger 1 (honnêteté du rapport), 3, 4 et 5 avant le commit de clôture, et de lancer le `verify` complet.
