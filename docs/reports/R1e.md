# Rapport R1e — système de lieux, mur Maria (pilote : Shiganshina), mémoire des lieux

> Plan : `docs/phases/R1e.md` ; consigne : `docs/phases/R1e-consigne.md` (= `docs/spec/20`). Départ : `497be52` (fin de R1d).
> Commits : R1e.0–R1e.1 `fb12c21`, R1e.2 `da304a9`, R1e.3–R1e.6 `43d0aac`, R1e.7 (ce rapport).
> **Arrêt de revue : fin de R1e** (pilote). LC-B, LC-C, LC-D ne sont pas lancées.
> Arrêt n° 1 pendant la phase (CR1e-05 en échec deux fois), levé par l'utilisateur : « Accepter 0,5 pour le moment » et
> « garder tout » (D-103). CR1e-07 en échec deux fois ensuite : noté en dette (règle du fichier 24 §4, document maître).

## a. Critères

| # | Critère | Statut | Preuve |
|---|---|---|---|
| CR1e-01 | `src/sim` inchangé ; `verify` au code 0 | **OK** | 0 ligne de diff depuis `497be52` ; `verify` § b1 |
| CR1e-02 | Schéma validé ; `places:valider` sur tous les lieux | **OK** | 5 lieux, § b2 |
| CR1e-03 | Population ÷ densité = surface bâtie à ±25 % | **OK** | écarts de −8,5 % à +7,9 %, § b2 et `tests/places/maria.test.ts` |
| CR1e-04 | ≥ 8 arbres/ha bâti ; ≥ 20/ha parcs et faubourgs | **OK** | 22,8 à 55,6 /ha bâti ; parcs 55 à 90 /ha ; § b2 |
| CR1e-05 | Coupe SVG ; parement non répété (< 0,35, témoin > 0,35) | **ACCEPTÉ à 0,50** | 0,689 puis 0,501 (pic isolé à 20 m) ; témoin 1,001 ; décision D-103 ; dette n° 8 |
| CR1e-06 | 7 vues par porte, distinctes ; extérieure ≠ intérieure | **OK** | toutes les paires ≥ 6 : banc 64, Shiganshina 85 (min. 14,0 ; ext./int. 33,6), districts 43 chacun ; chaque vue montre sa porte (§ d, § e) |
| CR1e-07 | Shiganshina : 3 états distincts (ΔE ≥ 6) | **KO (deux fois), en dette** | essai 1 : 20,8 / 15,0 / 5,9 ; essai 2 : 20,1 / 3,4 / 18,4 ; cause : § d ; dette n° 9 |
| CR1e-08 | 4 districts du mur Maria ; noms non confirmés `?` et listés | **OK** | test « quatre districts » ; Quinta, est, ouest `?` (Q1, fichier 24 §3) |
| CR1e-09 | Plan figé → même empreinte ; deltas de 100 lieux < 200 Kio | **OK** | `d36c84b7` = gel ; 104,6 Kio ; § b4 |
| CR1e-10 | Bundle principal inchangé ; assets hors JS ; `assets:check` | **ACCEPTÉ** | +210 octets dus au correctif 8 (rendu 2D), gardé (D-103) ; autres contrôles OK, § b5 |
| CR1e-11 | Correctifs §6 : avant/après chacun | **OK** | `docs/screenshots/r1e-correctifs-1.png` à `-8.png` |
| CR1e-12 | Captures revues une par une | **OK** | `docs/reports/R1e-revue-captures.md` (3 lignes et 3 défauts par capture) |

## b. Sorties réelles

### b1. `npm run verify` (`docs/reports/R1e-verify.log`, extraits)
```
> npm run typecheck && npm run lint && npm run test && npm run data:validate && npm run assets:check && npm run canon:check && npm run sim:selftest && npm run build
 Test Files  78 passed (78)
      Tests  493 passed (493)
assets:check : 102 entrées, 102 fichiers ; licences, sources et empreintes conformes.
canon:check : « data » conforme (R1–R12, 592 entrées).
sim:selftest : OK (direct = worker : sans monde, bac à sable 845, bac à sable politique 850, 854, 854 mené par Marley, 850 avec une expédition, 850 avec une bataille jouée).
dist/assets/index-bIB_aUlw.js                                     902.79 kB │ gzip: 275.46 kB
✓ built in 1.16s
exit 0
```
`git diff 497be52 -- src/sim` : 0 ligne. `smoke:r1b -- tout` (`docs/reports/R1e-smoke-r1b.log`) : 513 contrôles OK, 0 KO,
« smoke:r1b : tous les contrôles passent. », exit 0 ; planches `r1b-*` restaurées ensuite (règle de R1e).

### b2. `npm run places:valider` (`docs/reports/R1e-places-valider.log` ; les 12 lignes de parcs, 55,5 à 89,8 arbres/ha, y sont)
```
_murs.json : valide (Maria, Rose, Sina ; hauteur 50 m [C], base 15 m [?])
OK maria-district-2 : 7 262 maisons, 9 repères, 23 413 arbres
   zone principal (coeur) : 42 000 hab. ÷ 165 = 254,5 ha ; bâti 249,8 ha (îlots 199,0, rues 50,8) ; écart -1,9 % ; 46,7 arbres/ha bâti ; 51,7 arbres/ha d'îlot
   zone faubourg (faubourg) : 6 000 hab. ÷ 70 = 85,7 ha ; bâti 92,5 ha (îlots 84,0, rues 8,6) ; écart +7,9 % ; 55,6 arbres/ha bâti ; 60,4 arbres/ha d'îlot
OK maria-district-3 : 5 751 maisons, 11 repères, 9 608 arbres
   zone principal (coeur) : 36 000 hab. ÷ 190 = 189,5 ha ; bâti 186,1 ha (îlots 133,0, rues 53,1) ; écart -1,8 % ; 27,7 arbres/ha bâti ; 29,8 arbres/ha d'îlot
   zone faubourg (faubourg) : 4 000 hab. ÷ 80 = 50,0 ha ; bâti 52,2 ha (îlots 47,2, rues 5,0) ; écart +4,4 % ; 47,5 arbres/ha bâti ; 51,5 arbres/ha d'îlot
OK maria-district-4 : 7 629 maisons, 10 repères, 9 593 arbres
   zone principal (coeur) : 50 000 hab. ÷ 240 = 208,3 ha ; bâti 210,4 ha (îlots 158,5, rues 51,9) ; écart +1,0 % ; 29,4 arbres/ha bâti ; 33,9 arbres/ha d'îlot
   zone faubourg (faubourg) : 5 000 hab. ÷ 90 = 55,6 ha ; bâti 50,8 ha (îlots 45,2, rues 5,6) ; écart -8,5 % ; 22,8 arbres/ha bâti ; 25,0 arbres/ha d'îlot
OK shiganshina : 10 111 maisons, 9 repères, 14 493 arbres
   zone principal (coeur) : 60 870 hab. ÷ 230 = 264,7 ha ; bâti 254,4 ha (îlots 191,1, rues 63,4) ; écart -3,9 % ; 30,2 arbres/ha bâti ; 34,3 arbres/ha d'îlot
   zone faubourg (faubourg) : 4 174 hab. ÷ 100 = 41,7 ha ; bâti 40,0 ha (îlots 37,0, rues 3,0) ; écart -4,2 % ; 38,5 arbres/ha bâti ; 39,8 arbres/ha d'îlot
OK village-des-saules (N2, figé) : 114 bâtiments, 392 arbres, population 522, capacité 678, générateur village v1, graine 4101
places:valider : 4 lieu(x) N1 et 1 plan(s) figé(s) valides.
exit 0
```

### b3. Portes et états (`docs/reports/R1e-captures-*.log`, ΔE76 moyen sur 64 × 36 ; seuil 6)
Extraits des journaux (`grep`) ; toutes les lignes « ≥ 6 » sont dans les journaux.
```
_banc       : 64 lignes « ≥ 6 » ; min. dans une porte  ΔE 11.1 ≥ 6 : porte-interieure-exterieure-face | porte-interieure-echelle
              ΔE 7.7 ≥ 6 : porte-exterieure-exterieure-face | porte-interieure-exterieure-face
shiganshina : 87 lignes « ≥ 6 » ; min. ΔE 14.0 ≥ 6 : porte-exterieure-exterieure-face | porte-exterieure-echelle
              ΔE 33.6 ≥ 6 : porte-exterieure-exterieure-face | porte-interieure-exterieure-face
              ΔE 20.1 ≥ 6 : etat-845-avant | etat-845-breche
              ΔE 3.4 < 6 : etat-845-avant | etat-850-reprise
              ΔE 18.4 ≥ 6 : etat-845-breche | etat-850-reprise
maria-district-2 : 43 « ≥ 6 », min. 14.0 ; ext./int. 33.6 ; ΔE 3.4 < 6 : etat-845-avant | etat-846-abandon
maria-district-3 : 43 « ≥ 6 », min. 14.3 ; ext./int. 33.3 ; ΔE 3.4 < 6 : etat-845-avant | etat-846-abandon
maria-district-4 : 43 « ≥ 6 », min. 14.2 ; ext./int. 34.2 ; ΔE 3.3 < 6 : etat-845-avant | etat-846-abandon
village-des-saules : vue d'ensemble seule (lieu N2) ; exit 0
```
Les états des districts ne relèvent d'aucun critère (CR1e-07 porte sur Shiganshina) ; le banc montre ses trois états de
porte en vue d'ensemble, où les portes sont sous le pixel (ΔE ≤ 0,1, sans critère).

### b4. Mémoire (`npx vitest run tests/places/memoire.test.ts --reporter=verbose`)
```
village-des-saules : empreinte d36c84b7 (gel : d36c84b7), 114 bâtiments, 392 arbres
 ✓ … plans figés (CR1e-09) > village-des-saules : même empreinte de rendu qu'au gel 55ms
 ✓ … plans figés (CR1e-09) > le générateur de village est déterministe (même graine → même plan) 100ms
deltas : 100 lieux × 400 bâtiments → 106257 octets de données, 107147 octets avec les clés (104.6 Kio)
 ✓ … deltas des lieux (CR1e-09) > 100 lieux modifiés (400 bâtiments chacun) : < 200 Kio dans IndexedDB 45ms
 ✓ … cache LRU des lieux > garde 8 lieux ; libère le moins récemment utilisé 1ms
 Test Files  1 passed (1)
      Tests  6 passed (6)
```

### b5. Bundle (`npm run mesure:r1d -- bundle`, `docs/reports/R1e-bundle.log`)
```
bundle principal avant : assets/index-Bv_Xd8Ly.js  902588 octets (266.8 Kio gzip)
bundle principal après : assets/index-FvaFE5qM.js  902798 octets (266.9 Kio gzip)
  KO  bundle principal : même taille (902588 → 902798 octets)
  KO  bundle principal : même contenu une fois les noms de morceaux hachés normalisés
  OK  worker de simulation identique à l'octet
  OK  ni three.js ni GLTFLoader dans le bundle principal
  OK  aucun modèle ni texture d'asset inclus dans le JS (aucun)
  OK  assets 3D servis = fichiers « execution » du manifeste (14)
  OK  aucune image de référence dans dist (0)
```

## c. Ce qui a été fait
- **R1e.1** : schéma des lieux (N1 d'auteur, N2 figés, murailles), chargeur par tronçons de 64 m et pièces instanciées,
  visionneuse `?proto3d&lieu=<id>`, outils `places:valider`, `places:captures`, `places:regenerer`, plans SVG.
- **R1e.2** : correctifs 1 à 8 de R1d (fumée de la ville-usine, tissu urbain, parement, caméra de suivi, traînées, forêt,
  suivi d'escouade, éclairs) ; planches avant/après. **R1e.3** : coupe du mur lue de `_murs.json` ; parement à trois appareils ;
  portes paramétriques (extérieure, intérieure, de rivière ; intacte, brisée, bouchée) ; repères d'échelle ; banc `lieu=_banc`.
- **R1e.4 — Shiganshina** : plan rayonnant de 1,35 km, 92 rues nommées, 444 îlots, 8 quartiers, canal, faubourg ; 10 111
  maisons, 14 493 arbres ; église, halle, caserne, maisons des Jaeger, du Dr Jaeger, d'Armin ; quatre portes, 129 canons,
  11 escaliers ; trois états (rocher sur la maison des Jaeger [C], incendies, friche) ; `?proto3d&env=E01` charge le lieu.
- **R1e.5** : Quinta (nord), districts est (garnison) et ouest (greniers), tous `?` ; aucune porte de rivière hors Shiganshina.
  **R1e.6** : plans N2 figés avec empreinte ; village `village-des-saules` (522 hab., 114 bâtiments) ; deltas ; LRU de 8 lieux.
- **R1e.7** : brouillard à l'échelle de la vue, sol jusqu'à l'horizon recoupé en grille de 64 m, arbres lointains allégés
  (0,9 M triangles au lieu de 2,97 M), places dégagées devant les portes, 154 captures revues (D-105).

## d. Échecs et causes mesurées
- **CR1e-05** (parement) : essai 1, 0,689 à 2,1 m (grandes plaques) ; correctif : coulures étroites tirées une à une, teinte
  des panneaux réduite ; essai 2, 0,501 (pic isolé à 20 m, cause non établie, ≤ 0,31 ailleurs). Accepté (D-103), dette n° 8.
- **CR1e-07** (états) : essai 1, brèche / reprise 5,9 (même brouillard gris) ; correctif : brouillard modéré, voile brun pour
  845 ; essai 2, avant / reprise 3,4 (inchangé aux recaptures). Cause : à 2,7 km, friche, ruines et portes bouchées de 850
  sont sous le pixel. Dette n° 9.
- **CR1e-06 à la revue** (CLAUDE.md l. 14) : cinq vues de porte ne montraient pas la porte (figure d'échelle derrière le
  faubourg, maison du quai devant la porte de rivière, caméra dans un pont posé dans le mur). Correctif : places dégagées
  devant les portes, pont retiré ; tout recapturé, chaque vue montre sa porte.
- **Revue des rues** : axes des districts en herbe (prairie de deux triangles de 5 km devant les chaussées, rendu logiciel) ;
  correctif : sol recoupé en grille de 64 m. **Village** : jamais affiché (page HTML prise pour un plan) ; `fetchPlace` corrigé.
- **CR1e-10** (bundle) : +210 octets venus du correctif 8 ; gardé (D-103). Incidents : une capture interrompue par un
  rechargement à chaud, un redémarrage du conteneur ; captures relancées en entier.

## e. Revue des captures
Annexe `docs/reports/R1e-revue-captures.md` : chaque capture ouverte avec l'outil d'image, décrite, au moins trois défauts.
- Correctifs de R1d (8 planches), banc (31 vues), Shiganshina (10 vues, 28 vues de portes, 3 états), districts ouest, est et
  Quinta (8 ou 9 vues, 14 vues de portes, 2 états chacun), village (1 vue). Aucune capture vide ; chaque vue montre son sujet.
- Défauts récurrents : ciel laiteux et repères illisibles en vue d'ensemble ; places et rues vides (dette n° 6) ; troncs
  noirs au premier plan ; places de terre brune devant les portes intérieures ; soldat, cheval et charrette trop petits
  dans les vues « échelle » ; Grand Marché et marché aux Draps presque identiques ; rayures des champs du village (n° 11).

## f. Dette et suite
- Dette (`docs/reports/dette.md`) : n° 3 (villes de R1b en damier), 4 (triangles en vue d'ensemble), 5 (triangle bleu du
  ciel), 6 (habitants), 7 (LRU non branché), 8 (parement 0,50), 9 (états de 850), 10 (brèche enfumée), 11 (rayures des
  champs vus de loin), 12 (vues à revoir : marchés jumeaux, port sans bateau, figures d'échelle).
- Lore : Q1 (Quinta, districts est et ouest), Q8 (populations), Q9 (canal), Q10 (portes en 850).
- Plan V2 (fichiers 18 à 24) : pas installé (session 0 à lancer par l'utilisateur) ; repris : noms des districts (§3) et
  règle « deux échecs : dette » (§4). Suite prévue : LC-B, LC-C, LC-D sans arrêt ; le fichier 24 place les lieux en
  semaine 4 (niveau N3) : à trancher à cette revue.
