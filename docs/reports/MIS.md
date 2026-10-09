# Rapport MIS — arbre de missions nationales (branche `claude/v2-mis`)

Base 820e601. Commits : `6ab295f` (MIS.1 + MIS.2), `96e9644` (MIS.3 + MIS.4, MIS.5 et MIS.6 inclus), puis ce rapport.
Écart de procédure : deux commits au lieu de six (les tests de données dépendent du modèle ; la frise réutilise les textes de l'écran).

## Ce qui est livré
- **MIS.1** modèle : `data/missions/*.json`, schéma Zod (`src/data/missionSchemas.ts`), équilibrage `data/balance/missions.json`, couche facultative `GameState.missions`, commandes `StartMission` / `CancelMission`, effet `nation`, `triggerEvent` (refuse le canon), règle R14.
- **MIS.2** Paradis : 44 missions en 845, 53 en 850, 57 en 854 (70 au total), six branches ; reconquête de Maria (consolidation, Titans, mur), réforme de l'armée, cabinet, Église des murs, recherche anti-Titan, artillerie, renseignement, monde extérieur, préparation d'une campagne contre Marley. Aucune ne force un événement canon.
- **MIS.3** écran « Missions » (touche Z) ; **MIS.4** frise (onglet « Missions nationales »), journal, alerte avec pause ; **MIS.5** 12 missions de Marley (854) ; **MIS.6** IA de Marley.

## Critères
| Critère | État | Preuve |
|---|---|---|
| CMIS-01 `verify` code 0 | OK | `docs/reports/MIS-verify-2.log` : `Test Files  99 passed (99)`, `Tests  644 passed (644)`, `EXIT 0` |
| CMIS-02 `sim:selftest` code 0 | OK | `sim:selftest : OK (direct = worker : sans monde, bac à sable 845, bac à sable politique 850, 854, 854 mené par Marley, 850 avec une expédition, 850 avec une bataille jouée, 845 avec des missions).` |
| CMIS-03 `canon:check` code 0 | OK | `canon:check : « data » conforme (R1–R14, 840 entrées).` |
| CMIS-04 ≥ 40 missions par scénario | OK | 845 : 44 ; 850 : 53 ; 854 : 57 Paradis + 12 Marley ; `tests/data/missions.test.ts` |
| CMIS-05 aucune mention interne | OK | `tests/ui/no-leaks.test.ts` (dans verify) ; `smoke:mis` ; `smoke:ux0` : `160 écrans contrôlés ; 0 échec(s).` `EXIT 0` (`MIS-smoke-ux0.log`) |
| CMIS-06 captures lues | OK | six captures ci-dessous, lues une à une |
| CMIS-07 verrous et coût | OK | `tests/sim/missions.test.ts` (11 tests) |
| CMIS-08 IA de Marley cohérente | OK | `tests/sim/missions-ai.test.ts` (4 tests), décisions journalisées avec raisons |

## Sorties réelles
`smoke:mis` (`docs/reports/MIS-smoke-1.log`), extrait : `OK  branche militaire : 24 planches, 26 liens` ; `OK  infobulle d'effet : coût, durée, effets` ; `OK  mission en cours avec temps restant (« Missions en cours 1 / 2 · 0 accomplies sur 57 En cours : Inventaire des garnisons · environ 2 mois Abandonner »)` ; `OK  journal : « Mission accomplie »` ; `OK  frise : 1 repère(s) de mission sur l'axe` ; `OK  0 erreur console` ; `smoke:mis : tout est conforme.` `EXIT 0`.
`sim:selftest` (extrait du verify) :
```
[scn_sandbox_845] direct : 59a9b1b2 | worker : 59a9b1b2
[scn_854] direct : 56dc43aa | worker : 56dc43aa | date an 856, jour 281
[scn_854, Marley] direct : c718bf0d | worker : c718bf0d
[scn_sandbox_845 + missions] direct : bc4e5fd0 | worker : bc4e5fd0 | missions accomplies : mis_eco_recensement_greniers, mis_mil_inventaire_garnisons, mis_mil_reforme_armee
```

## Modifications de `src/sim` (additives) et empreintes
- `src/sim/missions/` (nouveau), `core/state.ts` (couche `missions?`, modificateurs, tick), `core/commands.ts` (deux commandes), `core/serialize.ts` (contrôle facultatif), `events/engine.ts` (`case "nation"`, `triggerEvent`), `strategic/world.ts` (monde des missions). Anciennes sauvegardes : la couche est facultative, elles se chargent.
- **Empreinte modifiée : 854** `1aca7ab8` → `56dc43aa`, parce que l'IA de Marley y lance des missions (D-132). Inchangées : 845 `59a9b1b2`, 850 `7d032fb4`, Marley jouée `c718bf0d`, expédition `20cdd5ca`, bataille `dd7651fd`, sans monde `3c17ecdc`. Nouvelle ligne : 845 + missions `bc4e5fd0`.

## Captures (`docs/screenshots/`) — chacune ouverte avec l'outil de lecture
1. `mis-ecran-1366.png` (1366×768). Je vois l'écran Missions de Paradis : tête « 0 / 2 », six onglets de branche, arbre militaire en colonnes avec liens, fiche de « Inventaire des garnisons » à droite avec « Lancer ». Planches verrouillées avec « Exige : … » en rouge. Défauts : (a) seules deux colonnes et demie sont visibles, il faut faire défiler l'arbre de 24 planches ; (b) « Corps d'instruction renforcé » et les coûts à quatre ressources sont coupés ; (c) le bouton « Lancer » existe deux fois (planche et fiche) ; (d) grand vide sous la première colonne.
2. `mis-infobulle.png`. Infobulle au survol de la première planche : Coût « Or 60 000 / 800 » en vert, Durée « 2 mois », Effets « Moral (tout le territoire) +1 », Bonus durables « Pertes de Gaz −3 % », Suites « Revue des postes ». Défauts : (a) elle recouvre les planches suivantes de la première colonne ; (b) le stock « 60 000 / 800 » n'a pas d'unité écrite à côté du mot « Or » ; (c) « Suites possibles » nomme un événement sans résumé ; (d) elle reste affichée après le départ de la souris tant qu'aucun autre élément n'est survolé.
3. `mis-en-cours.png`. Mission lancée : tête « 1 / 2 », « En cours : Inventaire des garnisons · environ 2 mois », « Abandonner », barre vide, planche marquée « ENVIRON 2 MOIS », notification « Mission lancée » catégorie « Mission ». Défauts : (a) la barre est à 0 % (jour du lancement), on ne voit pas sa progression ici ; (b) la notification répète l'alerte du bandeau ; (c) l'infobulle de la planche reste ouverte devant l'arbre ; (d) « 0 accomplies sur 57 » mêle singulier et pluriel au premier accomplissement (« 1 accomplies »).
4. `mis-ecran-3840.png` (3840×2160). Même écran en 4K : le registre garde sa largeur en rem, il occupe la moitié gauche ; l'arbre montre trois colonnes et onze planches, la carte reste visible à droite. Défauts : (a) moitié droite de l'écran sans usage (dette CHR n° 31, même comportement que les autres registres) ; (b) la ligne de coût de « Batteries mobiles » est coupée (« Chevaux 40… ») ; (c) aucune barre de défilement visible sur l'arbre ; (d) texte de la fiche petit par rapport à l'écran.
5. `mis-frise.png`. Chronologie, onglet « Missions nationales » : une entrée « Inventaire des garnisons », an 854 jour 61, coche, fiche « ACCOMPLIE / MILITAIRE », effet « Moral +1 ». L'axe 845–854 montre un repère en 854. Défauts : (a) onglet « Missions nationales » collé aux filtres de thème, lecture serrée ; (b) l'étiquette « Famille » du filtre n'a aucune mission ; (c) le repère unique est minuscule sur l'axe ; (d) la jauge de divergence « 0 / 2,5 » n'a rien à voir avec les missions.
6. `mis-marley.png`. Marley jouée : cinq branches (pas de religion), « 0 / 1 », coûts « Hommes 10, Industrie 40 », effets « Hommes de Marley +60 », « Stabilité de Marley −2 » ; bandeau Marley (industrie, hommes, soutien, stabilité). Défauts : (a) « Plan de campagne contre… » coupé dans la troisième colonne ; (b) « Hommes de Marley +60 » et « Stabilité de Marley −2 » nomment la nation à la troisième personne alors que le joueur la mène ; (c) une seule planche « Flotte de transport » en deuxième ligne, grand vide en dessous ; (d) groupe « Gouvernement » réduit à un seul bouton.

## Dettes (`docs/reports/dette.md` n° 38 à 40) et décisions (D-131 à D-133)
- 38 : le plan du HUD ignore les modificateurs de décrets et de missions (préexistant). 39 : 845 sans registre, pas d'IA de missions pour Paradis, industrie de Marley rare. 40 : coûts coupés, arbre à faire défiler, pas d'anglais, aucune mission ne change le contrôle d'une province.
- Questions de lore : Q13 (`docs/lore/questions-ouvertes.md`) ; 8 missions `?`, 74 `A`, aucune `C`.
- Aucun critère n'a échoué deux fois. `docs/MORNING.md` non touché.
