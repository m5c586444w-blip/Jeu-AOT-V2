# Rapport UX0 — Nettoyer les fuites (E-UX-1)

Branche `claude/v2-ux0-nettoyage`, partie de `ce78390`. Phase menée en parallèle de R1e (autre session) : aucun fichier de `src/sim`, `src/render/tactical3d`, `data/places` ni `docs/PROGRESS.md` touché ; PROGRESS sera mis à jour au merge.

## a. Critères
| Id | Résultat | Preuve |
|---|---|---|
| CUX0-01 verify code 0 | **KO au premier passage** : 2 tests 3D (R1b, hors UX0) dépassent 30 s dans la suite complète ; verts seuls ; le reste de la chaîne code 0 | `docs/reports/UX0-verify.log`, `UX0-verify-suite.log` |
| CUX0-02 aucune mention interne | OK | `tests/ui/no-leaks.test.ts` (6 tests) ; `npm run smoke:ux0` : 117 écrans, 0 échec (`docs/reports/UX0-smoke.log`) |
| CUX0-03 F10 | OK | smoke : mentions auteur visibles 0 → n avec F10, 0 de nouveau ; préférence enregistrée |
| CUX0-04 canon:check code 0 | OK (dans verify) | `docs/reports/UX0-verify.log` |
| CUX0-05 6 captures lues | OK, défauts listés § d | `docs/screenshots/ux0-*.png` |

## b. Sorties
Collées au § « Sorties réelles » en fin de rapport. Les deux tests en échec (`environnements.test.ts` lot 1 : 33 s ; `murs.test.ts` visibilité : 34 s, limite 30 s) ne touchent aucun fichier de UX0 ; lancés seuls : 21 sur 21. Pas de relance de verify sans changement de code (fichier 24 §4).

## c. Inventaire UX0.1 (avant → après)
| Écran | Fuite | Traitement |
|---|---|---|
| Fiches (personnages, porteurs, archives, recherche) | tampons ÉTABLI / INTERPRÉTÉ / NON CONFIRMÉ (`stamp`) | mode auteur seulement |
| Dossier de province | cote d'atlas, tampon canon, statuts de position et de contrôle, `notes_canon` (« (06 §1.5, 11 §2) »), points d'intérêt « établi » | mode auteur seulement |
| Dossier de province, bulles | « [C] », « [?] », « (11 §2) » dans les notes des murs ; « data/buildings (établi) » | notes nettoyées (`playerText`), statut en mode auteur |
| Bulle de province (survol) | statut canon | mode auteur seulement |
| Recherche | codes `T-ODM-04`, « pas avant 845 », « Mécanique en P9 », « N'existe pas encore : il faut d'abord … », « Pas avant l'an … », « (fichier 03) », « (fichier 13, valeurs A) » | codes, années et phases en mode auteur ; « Exige : … » ; « Hors de portée de nos ateliers pour l'instant » ; études P9 absentes |
| Calques | « NON OUVERT · P5 », « arrive en phase » | mode auteur ; bulle « Aucune donnée pour ce calque » |
| Dossier d'événement | « Chronique E12 » | mode auteur seulement |
| Archives | note sur les statuts ; tout le contenu, découvert ou non | note réécrite ; filtre du découvert (UX0.4) |
| Dossier, renseignement | « arrive en phase P5 » | « Aucun rapport de renseignement sur cette province. » |
| Bulles diverses (expéditions, porteurs, rapports, personnages) | « (D-53) », « (F-EXP-07) », « (02 §15) », « (07 GM09, A) », « [A] », « (E35) » | renvois retirés |
| Alertes de mort, épilogue | « hors de la chronologie canon », « (P9) » | « chronique connue », « Bilan provisoire : la partie continue. » |
| Personnages, traits | `notes_canon` des traits | mode auteur seulement |

44 textes du dictionnaire réécrits par script (renvois et marques retirés), puis 16 à la main.

## d. Captures (1366 × 768) — 3 lignes, 3 défauts possibles
- `ux0-menu.png` : menu, carton titre « Confidentiel » à gauche, trois chemises de scénario à droite ; aucune mention interne. Défauts : trois quarts de l'écran vides (phase UI) ; « Bac à sable – 845, avant la brèche » contredit « Shiganshina vient de tomber » ; tampon « Confidentiel » encore du style papier (UI).
- `ux0-hud.png` : bandeau, carte, calques. Défauts : « inexploré » plaqué sur la carte (phase MAP) ; quatorze icônes de même format (UI) ; bandeau de neuf colonnes de chiffres (UI).
- `ux0-dossier-province.png` : Trost, sous-titre, description, onglets et strates ; plus de cote ni de tampon. Défauts : « brèche de 850 » annoncée le jour 1 de 850 (texte de lore à revoir) ; titre et croix de fermeture serrés ; carte « inexploré » derrière.
- `ux0-recherche.png` : planches de l'arbre ODM, acquises, libres, grisée « Exige : « Combat de rue Levi / Kenny » ». Défauts : la condition d'événement nomme un événement futur ; 6 planches seulement (études P9 retirées), arbre encore en grille (UI, E-UX-5) ; « Coût » absent des études acquises sans coût.
- `ux0-recherche-mode-auteur.png` (F10) : codes `T-ODM-0n`, tampons, « pas avant 845 », « Mécanique en P9 » en pastilles pointillées ; études P9 réapparues. Défauts : pastilles qui chevauchent les titres longs ; tampons tournés peu lisibles ; carte trop chargée en mode auteur (sans gravité : outil de vérification).
- `ux0-archives.png` : Archives, note réécrite, onglets, fiches de personnages sans tampon. Défauts : en 850, Annie, Bertholdt, Eren « à quelques semaines de la remise des diplômes » (biographie de 845 ; à revoir en CHR) ; cartes « papier » (UI) ; pas de portrait (UI).
- `ux0-chronique.png` : chronique vide au jour 1 (« Rien encore. »). Défauts : chronique vide au départ (CHR, E-UX-6) ; pas de frise (CHR) ; grand vide sous le registre.

## e. Dette (reportée, `docs/reports/dette.md` au merge)
- Carte « inexploré » → MAP. Interface papier, menu vide, icônes → UI. Chronique vide, frise → CHR.
- Biographies datées de 845 affichées en 850 ; description de Trost qui annonce sa brèche ; titre du bac à sable 845 → CHR (textes de lore).
- `placeViewer` (visionneuse des lieux, R1e) affiche « canon : … » : outil de développement, hors périmètre, à la charge de R1e.
- Le parcours `smoke:ux0` lit les bulles portées par `data-why` ; les bulles calculées à l'ouverture (`why.bind`) sont couvertes par le contrôle du dictionnaire, pas par le navigateur.

## Sorties réelles
```
$ npm run verify   (docs/reports/UX0-verify.log)
 FAIL  tests/render/tactical3d/environnements.test.ts > même graine = même environnement (R1b) > lot 1 (9 environnements) …  33135ms
 FAIL  tests/render/tactical3d/murs.test.ts > règle de visibilité du mur (R1b.4) > aucun mur dans les scènes dont le profil l'exclut …
 Test Files  2 failed | 72 passed (74)
      Tests  2 failed | 469 passed (471)
code:1

$ npx vitest run tests/render/tactical3d/environnements.test.ts tests/render/tactical3d/murs.test.ts
      Tests  21 passed (21)

$ data:validate, assets:check, canon:check, sim:selftest, build   (docs/reports/UX0-verify-suite.log)
canon:check : « data » conforme (R1–R12, 592 entrées).
sim:selftest : OK (direct = worker : sans monde, bac à sable 845, bac à sable politique 850, 854, 854 mené par Marley, 850 avec une expédition, 850 avec une bataille jouée).
[data:validate] code:0  [assets:check] code:0  [canon:check] code:0  [sim:selftest] code:0  [build] code:0

$ npx vitest run tests/ui/no-leaks.test.ts
      Tests  6 passed (6)

$ npm run smoke:ux0   (docs/reports/UX0-smoke.log)
  OK  F10 : mentions auteur visibles 0 → 35 (statuts, codes, années) ; planches 6 → 10
  OK  F10 de nouveau : mentions masquées ; préférence enregistrée
  OK  aucune erreur de page
117 écrans contrôlés ; 0 échec(s).
code:0
```
