# Rapport PA — armées sur la carte, artillerie des deux camps, marine hors Paradis, succession

Branche `claude/v2-pa` (depuis `5cc4b66`). Plan : `docs/phases/PA.md`. Décisions D-124 à D-128. Dettes n° 33 à 36.

## a. Critères
| Id | Résultat | Preuve |
|---|---|---|
| CPA-01 | OK | `timeout 1500 npm run verify` : code 0 (§ b, `docs/reports/PA-verify-3.log`) |
| CPA-02 | OK | `npm run sim:selftest` : code 0, direct = worker sur 7 scénarios (§ b) |
| CPA-03 | OK | `canon:check` « conforme (R1–R13, 746 entrées) » ; `tests/sim/artillery.test.ts` : lances indisponibles en 850 sans la technique, R13 refuse un navire de Paradis et des lances avant 850 |
| CPA-04 | OK | `smoke:pa` : marche par clic sur la carte (Trost → Maria-Sud-Est, trajet affiché) ; flotte de Marley envoyée en mer du Sud-Est puis débarquement ; `tests/sim/armies.test.ts` (ordres terrestre et maritime, Paradis sans flotte) |
| CPA-05 | OK | `smoke:pa` : interception en marche forcée, contact à Maria-Nord, pause, trois issues ; `armies.test.ts` : rencontre en attente, résolution rapide expliquée (puissance des deux camps), bataille jouée |
| CPA-06 | OK | `artillery.test.ts` : batteries des deux camps tirent (impacts, coups au but, contre-batterie), déterministe ; bataille sans canon inchangée ; captures `pa-artillerie-bataille` (obus de Marley) et `pa-artillerie-rempart` (canons de rempart de Paradis) |
| CPA-07 | OK | `tests/sim/armies-ai.test.ts` : Marley approche, débarque, assiège (`bombarder`), raisons consignées ; Paradis (IA, Marley jouée) intercepte ou tient un mur |
| CPA-08 | OK | `data:validate` code 0 (équilibrage `armies` compris) |
| CPA-09 | OK | `armies.test.ts` : même graine + mêmes commandes = même hash, rejeu du journal ; vieille sauvegarde sans armées : même hash, `RaiseArmies` ; `tests/save` vert dans verify |
| CPA-10 | OK | 9 captures (≤ 12), toutes ouvertes et décrites (§ d) |

## b. Sorties réelles
`timeout 1500 npm run verify` (dernière exécution, après l'interface) :
```
> npm run typecheck && npm run lint && npm run test && npm run data:validate && npm run assets:check && npm run canon:check && npm run sim:selftest &&
Test Files  95 passed (95)
Tests  606 passed (606)
data:validate : « data » valide (74 provinces, 80 personnages, 88 technologies, 185 événements, 9 Titans-porteurs, 0 positionnements, 11 bâtiments, 3 
> murs-et-sang@0.0.1 assets:check
assets:check : 102 entrées, 102 fichiers ; licences, sources et empreintes conformes.
canon:check : « data » conforme (R1–R13, 746 entrées).
sim:selftest : OK (direct = worker : sans monde, bac à sable 845, bac à sable politique 850, 854, 854 mené par Marley, 850 avec une expédition, 850 av
✓ built in 1.76s
EXIT 0
```
Premier verify de PA (base, avant tout changement) : `Test Files 1 failed | 91 passed (92)`, `Tests 582 passed | 6 skipped (588)`, EXIT 1 :
`titans-r1c` dépasse 10 s sous charge (dette n° 26) → délai du `beforeAll` porté à 120 s (D-127). Verify du commit simulation :
`Test Files 95 passed (95)`, `Tests 606 passed (606)`, EXIT 0 (`docs/reports/PA-verify-2.log`).

`npm run sim:selftest` :
```
[sans monde] direct : 3c17ecdc | worker : 3c17ecdc | date an 847, jour 281
[scn_sandbox_845] direct : 59a9b1b2 | worker : 59a9b1b2 | date an 847, jour 281
[scn_sandbox_850] direct : 7d032fb4 | worker : 7d032fb4 | date an 852, jour 281 | …
[scn_854] direct : 1aca7ab8 | worker : 1aca7ab8 | date an 856, jour 281 | …
[scn_854, Marley] direct : c718bf0d | worker : c718bf0d | date an 854, jour 181 | guerres : fac_marley|fac_paradis | …
[scn_sandbox_850 + expédition] direct : 20cdd5ca | worker : 20cdd5ca | date an 850, jour 168 | rapport : 72 morts / 103
[scn_sandbox_850 + bataille jouée] direct : dd7651fd | worker : dd7651fd | date an 850, jour 129 | 7 commandes | bataille reportée
sim:selftest : OK (direct = worker : …)
```
`npm run canon:check` : `canon:check : « data » conforme (R1–R13, 746 entrées).` — `npm run data:validate` : code 0
(« équilibrage : armies, economy, … »).

`npm run smoke:pa` (`docs/reports/PA-smoke.log`) :
```
[854, Paradis] 1366×768
  OK  bandeau : registre « Armées » (touche S)
  OK  registre des armées : 3 armées de Paradis (Sud, Est, Brigade)
  OK  moral expliqué (« pourquoi ? »)
  OK  registre des armées : 7 valeurs, toutes expliquées ; aucune clé ni identifiant brut
  OK  destination choisie au clic sur la carte : « Marcher vers Maria-Sud-Est »
  OK  trajet affiché : « Trajet : Trost → Rose-Sud — porte de Trost → Plaines intérieures de Maria — Sud → Plaines céréalières du Sud → »
  OK  flotte de Marley en vue ; corps débarqué (journal)
  OK  ennemi en vue à intercepter : 1
  OK  contact : alerte, jeu en pause, registre ouvert sur la rencontre
  OK  trois issues proposées : Résolution rapide / Livrer bataille / Se replier
  OK  bilan : ligne « Obus tirés » (artillerie)
  OK  bilan de bataille : 9 valeurs, toutes expliquées ; aucune clé ni identifiant brut
  OK  rencontre résolue après la bataille (ordres rejoués par la simulation)
[854, Marley] 1366×768
  OK  fiche d'artillerie du corps de Marley : 2 pièces (portée, cadence, souffle, munitions)
  OK  registre des armées, fiche d'artillerie (Marley) : 5 valeurs, toutes expliquées ; aucune clé ni identifiant brut
  OK  flotte au mouillage au sud-est : débarquement proposé
  OK  corps de Marley débarqué : « Corps expéditionnaire de Marley Côte Est 1 940 À L'ARRÊT »
  OK  registre des armées (Marley) : 1 valeurs, toutes expliquées ; aucune clé ni identifiant brut
[850, Paradis] 1366×768
  OK  Titans rencontrés hors du mur Rose : alerte et choix
  OK  canons de rempart de Paradis en bataille : ligne « Obus tirés » au bilan
  OK  0 erreur console
smoke:pa : tout est conforme.
EXIT 0
```

## c. Empreintes modifiées (D-124)
Après CHR → après PA : 845 `08bedd60` → `59a9b1b2` ; 850 `86f2d847` → `7d032fb4` ; 854 `49e288fa` → `1aca7ab8` ; 854 Marley
`028d6da4` → `c718bf0d` ; expédition `249d21e4` → `20cdd5ca` ; bataille `5cbf06a3` → `dd7651fd`. « Sans monde » `3c17ecdc` inchangé.
Cause : armées créées au départ des scénarios (marche, ravitaillement puisé dans les stocks, IA de Marley en guerre). Une vieille
sauvegarde garde son hash (champ `armies` facultatif, version de schéma 8 inchangée) ; l'interface n'a changé aucune empreinte.

## d. Captures (ouvertes une à une)
1. `pa-pions-1366.png` — Carte de 854 en 1366×768 : trois étendards vert-de-gris (Brigade 360 à Mitras, Est 720 à Karanes, Sud 1,2 k
   à Trost), drapeau à marque, jauges de moral et de vivres, effectif écrit dessous ; les noms Karanes et Trost s'écartent.
   Défauts : étendards petits à l'échelle de l'île ; le nom « Mitras » reste en partie sous le drapeau ; « 1,2 k » sur la carte et
   « 1 180 » au registre (deux formats).
2. `pa-pions-3840.png` — Même vue en 3840×2160 : étendards et effectifs à l'échelle de l'interface, lisibles.
   Défauts : grand vide marin autour de l'île ; la marque d'insigne est minuscule ; le pion de garnison de Trost touche l'étendard.
3. `pa-registre.png` — Registre « Armées » de Marley : corps expéditionnaire (1 940), régiments, fiche d'artillerie (canon de
   campagne × 12, obusier × 4 : portée, cadence, souffle, munitions). Défauts : « Shrapnel » en majuscule dans une liste ; vide sous la
   liste de gauche ; « Valeur au combat estimée » sans unité.
4. `pa-trajet.png` — Armée du Sud en marche : trajet cerné d'encre avec chevrons de Trost vers Maria-Sud-Est, étendard sélectionné
   (anneau ocre), fiche (effectif, moral, vivres, fatigue en jauges, trajet en clair). Défauts : le segment de mur cliqué reste surligné
   en brique ; le texte du trajet est long ; le bas de la fiche (ordres) demande un défilement.
5. `pa-rencontre.png` — Jour 132 : « Contact à Maria-Nord », Marley 1 921 · Paradis 209, trois boutons ; crise de succession
   (Hange Zoë 100, Levi Ackerman 100, Keith Shadis 93) ; deux étendards au contact et la flotte au nord-est. Défauts : effectifs des
   deux étendards serrés (« 209 1,9 k ») ; titre « Ennemis en vue » coupé en bas ; deux prétendants à égalité (100).
6. `pa-artillerie-bataille.png` — Bataille « Contact à Maria-Nord », 00:24 : zone de danger brique, éclair d'impact, fumée ; carnet :
   quatre soldats « tués par un éclat d'obus ». Défauts : les pièces de Marley (bord nord) sont hors du cadre ; 12 hommes contre
   0 Titan ; un seul cercle de danger lisible.
7. `pa-bilan.png` — Bilan : 6 morts, « Obus tirés 33 », dossiers « éclat d'obus ». Défauts : colonne « Titan » vide (« — — — ») ;
   lignes à 0 sans objet (coupes, gaz) ; libellé « Repli » seul en tête. (Clé brute `tac.cause.eclat` trouvée au 2e passage, corrigée.)
8. `pa-flotte.png` — Marley : flotte en mer du Sud-Est (navire sur la carte), cuirassés × 2, croiseurs × 2, transports × 3,
   « capacité : 11 régiments », débarquement sur « Côte Est ». Défauts : armées de Paradis invisibles (brouillard, voulu) ; boutons
   de mission serrés ; nom du corps répété au-dessus du choix de côte. (« 11 hommes transportables » corrigé au 3e passage.)
9. `pa-artillerie-rempart.png` — 850, « Titans en vue à Plaines intérieures de Maria — Sud » : quatre canons de rempart (affûts de
   bois, roues à rayons) au bord sud, zone de danger ocre et impact sur un Titan au nord. Défauts : canons posés sur l'escouade 4 ;
   combat principal en haut du cadre ; aucune trace de trajectoire.

## e. Changements de `src/sim` (ajouts seulement)
Nouveaux : `src/sim/armies/` (état, ordres, rencontres, ravitaillement, sièges, flottes, IA, succession), `src/sim/tactical/artillery.ts`.
Modifiés par ajout : `core/state.ts` (champ `armies?`, `tickArmies`), `core/commands.ts` (commandes des armées), `core/serialize.ts`,
`strategic/world.ts` (`armies?`), `tactical/types.ts` et `battle.ts` (batteries facultatives). Données : `data/armies/`,
`data/artillery/`, `data/balance/armies.json`. Règle `canon:check` R13. Test AC1-04 : prélèvements des armées ajoutés (D-125).

## f. Reste à faire, dettes
Dettes n° 33 (choc armée contre armée sans Titans en bataille, R2+), 34 (Maria sans garnison en 854 ; pas de levée de régiment),
35 (prélèvements hors « pourquoi ? » ; anglais incomplet), 36 (cadrage des batteries ennemies, effectifs serrés, durée des marches).
Questions ouvertes Q11 (artillerie mobile de Paradis, mitraille, boulets ramés) et Q12 (matériel de Marley).
