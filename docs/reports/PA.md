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
| CPA-06 | OK | `artillery.test.ts` : batteries des deux camps tirent (impacts, coups au but, contre-batterie), déterministe ; bataille sans canon inchangée ; capture `pa-artillerie-bataille` (obus de Marley) ; canons de rempart seulement sur un segment de mur (`armies.test.ts`, D-129) |
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
   à Trost), drapeau à marque, jauges de moral et de vivres, effectif écrit dessous ; seul « Karanes » s'écarte nettement.
   Défauts : le nom « Trost » est rogné par l'étendard ; le nom « Mitras » est recouvert par le drapeau ; étendards petits ; « 1,2 k » sur la carte et
   « 1 180 » au registre (deux formats).
2. `pa-pions-3840.png` — Même vue en 3840×2160 : étendards et effectifs à l'échelle de l'interface, lisibles.
   Défauts : grand vide marin autour de l'île ; la marque d'insigne est minuscule ; le pion de garnison de Trost touche l'étendard.
3. `pa-registre.png` — Registre « Armées » de Marley : corps expéditionnaire (1 940), régiments, fiche d'artillerie (canon de
   campagne × 12, obusier × 4 : portée, cadence, souffle, munitions). Défauts : « Shrapnel » en majuscule dans une liste ; vide sous la
   liste de gauche ; « Valeur au combat estimée » sans unité.
4. `pa-trajet.png` — Armée du Sud en marche : trajet cerné d'encre avec chevrons de Trost vers Maria-Sud-Est, étendard sélectionné
   (anneau ocre), fiche (effectif, moral, vivres, fatigue en jauges, trajet en clair). Défauts : le segment de mur cliqué reste surligné
   en brique ; le texte du trajet est long ; le bas de la fiche (ordres) demande un défilement.
5. `pa-rencontre.png` — (recapturée) Jour 92 : « Contact à Plateau du Nord », Marley 1 940 · Paradis 808, trois boutons ; crise
   de succession (Dot Pixis 100, Nile Dok 83, Hange Zoë 74) ; fiche de l'Armée du Sud (808, moral 50 %, vivres 28 jours). Avant la
   revue, le rapport omettait la chute de 1 180 à 209 (§ g). Défauts : la ligne « Pertes en marche » est sous la ligne de flottaison
   de la fiche (lue par le smoke, non visible) ; « Ennemis en vue » coupé en bas ; nom de l'étendard de Marley recouvert (« 1,9 k »).
6. `pa-artillerie-bataille.png` — (recapturée) « Contact à Plateau du Nord », 00:24 : escouades 1 à 6 au bas du cadre, deux zones
   de danger brique, mire, fumée ; carnet : quatre soldats « tués par un éclat d'obus », « 32 hommes contre 0 Titan ». Défauts : les
   pièces de Marley (bord nord) sont hors du cadre ; grand vide au centre ; aucun soldat de Marley sur le terrain (dette n° 33).
7. `pa-bilan.png` — (recapturé) « Repli » : 17 morts, « Obus tirés 107 », dossiers « éclat d'obus ». Défauts : colonne « Titan » vide
   (« — — — ») ; sept lignes à 0 sans objet (coupes, gaz…) ; liste des dossiers coupée en bas.
8. `pa-flotte.png` — Marley : flotte en mer du Sud-Est (navire sur la carte), cuirassés × 2, croiseurs × 2, transports × 3,
   « capacité : 11 régiments », débarquement sur « Côte Est ». Défauts : armées de Paradis invisibles (brouillard, voulu) ; boutons
   de mission serrés ; nom du corps répété au-dessus du choix de côte. (« 11 hommes transportables » corrigé au 3e passage.)
9. `pa-artillerie-rempart.png` — (passe de revue, recapturée) 850, « Titans en vue à Plaines intérieures de Maria — Sud », 00:25 :
   plaine sableuse, arbres, quatre maisons, combat au bord nord (Titans n° 3, 6, 7), carnet (nuques tranchées, morts). Avant la revue :
   quatre canons de rempart en plaine et « impact sur un Titan au nord » écrit à tort (aucun Titan visible). Défauts : combat
   rogné en haut du cadre ; grande zone vide au centre ; aucun canon (voulu, D-129) mais rien ne dit au joueur pourquoi.

## e. Changements de `src/sim` (ajouts seulement)
Nouveaux : `src/sim/armies/` (état, ordres, rencontres, ravitaillement, sièges, flottes, IA, succession), `src/sim/tactical/artillery.ts`.
Modifiés par ajout : `core/state.ts` (champ `armies?`, `tickArmies`), `core/commands.ts` (commandes des armées), `core/serialize.ts`,
`strategic/world.ts` (`armies?`), `tactical/types.ts` et `battle.ts` (batteries facultatives). Données : `data/armies/`,
`data/artillery/`, `data/balance/armies.json`. Règle `canon:check` R13. AC1-04 : voir § g (plus de compensation à part).

## f. Reste à faire, dettes
Dettes n° 33 (choc armée contre armée sans Titans en bataille, R2+), 34 (Maria sans garnison en 854 ; pas de levée de régiment),
35 (prélèvements hors « pourquoi ? » ; anglais incomplet), 36 (cadrage des batteries ennemies, effectifs serrés, durée des marches).
Questions ouvertes Q11 (artillerie mobile de Paradis, mitraille, boulets ramés) et Q12 (matériel de Marley).

## g. Passe de revue (D-129)
Correctifs (commit `7dcde9c`, `src/sim` par ajouts et gardes) :
1. « Pourquoi ? » : `withArmyDraws` ajoute « Ravitaillement des armées » (vivres, gaz, poudre) et « Entretien des armées » (or) à la
   consommation et à la variation nette ; bandeau et écran Économie l'affichent. AC1-04 compare désormais la variation réelle à la
   variation expliquée, sans compensation à part (`tests/sim/explain.test.ts`).
2. Solde mensuelle des armées plafonnée au trésor ; armée impayée : moral −3 et ligne au registre. Test `armies.test.ts`.
3. Chute 1 180 → 209 : cause mesurée (script de rejeu) — marche forcée jamais relâchée (≈ 85 jours, 0,8 %/jour à fatigue 100,
   et à 0,75 × de la vitesse normale : 1 174 → 621), puis bombardement côtier de la flotte de Marley (621 → 405, voulu). Défaut corrigé :
   une armée épuisée cesse d'elle-même la marche forcée. Pertes hors bataille par cause sur la fiche (« Pertes en marche ») et chiffrées
   au registre. Smoke : « Pertes en marche 372 (bombardement côtier 318, marche forcée 54) », contact à 808 hommes. Tests : marche
   normale Trost → Maria-Sud-Est sans attrition (≥ 98 %) ; marche forcée ≤ 8 %, toute perte expliquée.
4. Canons de rempart : en bataille seulement sur un segment de mur ; en plaine, ils restent en garnison. Test et smoke.
5. Rapport : § d.1, d.5, d.9 corrigés ; captures 4 à 7 et 9 refaites et relues.

`timeout 1500 npm run verify` (`docs/reports/PA-verify-4.log`) : `Test Files  95 passed (95)`, `Tests  611 passed (611)`, `EXIT 0`.
`npm run smoke:pa` (`docs/reports/PA-smoke-2.log`) : 22 lignes OK dont « fiche de l'armée : « Pertes en marche 372 (bombardement côtier
318, marche forcée 54) » » et « canons de rempart restés en garnison : aucun « Obus tirés » en plaine » ; `smoke:pa : tout est
conforme.` `EXIT 0`. Empreintes `sim:selftest` inchangées (§ c).
Reste en dette : n° 35 (anglais), n° 36, n° 37 (bombardement côtier lourd ; prévision du ravitaillement = prélèvement de la veille ;
pas de canons dans un district au pied du mur).

