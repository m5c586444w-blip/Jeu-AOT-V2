# Rapport MAP — carte stratégique réaliste

Branche `claude/v2-map`, PR brouillon n° 2 (non fusionnée). Phase : `docs/phases/MAP.md`. Nuit du 2026-10-07.
Ce rapport ne décrit que ce qui a été vérifié ; les sorties réelles sont collées ou jointes (`docs/reports/MAP-*.log`).

## Critères
| Id | État | Preuve |
|---|---|---|
| CMAP-01 verify code 0 | **KO hors MAP** : seul échec CR1e-05 (R1e, déjà rouge sur la branche par défaut) ; 509/510 tests ; reste de la chaîne code 0 | `MAP-verify.log`, `MAP-verify-suite.log` |
| CMAP-02 `src/sim` inchangé | OK | `git diff origin/claude/attack-on-titan-strategy-game-4ukom6 --stat -- src/sim` : vide |
| CMAP-03 sim:selftest | OK | `MAP-verify-suite.log` |
| CMAP-04 voisinage dessiné = données | OK | `npm run map:terrain -- --check` : « identique » ; `tests/map` |
| CMAP-05 aire minimale | OK | `tests/map` : provinces ≥ 2 500 km², segments de mur ≥ 1 000 km² |
| CMAP-06 terrain reproductible | OK | `--check` : « fichier figé reproduit à l'identique (52d42f01) » ; test de déterminisme |
| CMAP-07 smoke:map | OK | `MAP-smoke.log` : 26 contrôles OK, « smoke:map : OK » |
| CMAP-08 captures lues | OK | 12 captures ci-dessous, lues une à une |

## Ce qui est fait
- **MAP.1** `npm run map:terrain` (graine `paradis-v1`, version 1, empreinte) écrit `data/map/terrain/paradis.json` (932 Kio) :
  côte [A] avec baies et caps, 5 îlots, relief (dôme central, collines, chaîne au nord-ouest), cuvettes comblées
  sauf les vrais lacs, 82 fleuves (écoulement D8), forêts, Arbres Géants à l'emplacement de l'atlas, marais, falaises au sud.
  Murs posés sur le terrain avec une légère déformation (± 1,8 %).
- **MAP.2** Un polygone par province (74), frontières sinueuses (± 15 km en travers, ± 10 km sur les cercles), droites aux murs ; voisinage recalculé
  (arête commune > 3 km) : **identique** à `data/map/paradis.json`, aucune connexion inventée ni perdue.
- **MAP.3** Image du relief (ombrage nord-ouest, teintes mêlées par milieu, eau, écume) puis couches Pixi : côte,
  fleuves, routes au moindre coût (pente, eau, murs franchis aux portes seulement), 59 ponts, murs en relief avec ombre,
  créneaux et segments abîmés, villes par taille, brouillard en voile sans texte.
- **MAP.4** Trois niveaux (île, région, province) ; routes secondaires dès « région », ponts et créneaux à « province » ;
  noms de murs courbés, glissés le long de l'anneau à l'écart des pions et des portes ; les noms de lieux essaient
  9 positions, évitent icônes et bandes de murs (sauf villes posées sur un mur) et se masquent sinon ; les noms de
  segments s'écrivent dans la bande de leur mur, le long de l'anneau, à l'écart des portes et des pions.
- **MAP.5** Calques en aplat transparent (0,55) ; valeur inconnue en gris de légende (0,45). Infobulle : nom, région,
  état, mur en %, population, garnison et effectif, ressource principale ; clic : dossier (smoke:map).
- **MAP.6** Emplacement de pion par province, choisi dans le polygone loin du nom et de la ville (test : dans la province).
- **MAP.7** Terrain chargé à la demande en une ressource ; première image puis image fine (3072 px) calculée dans un worker.
- Taille des traits, icônes et noms proportionnelle à la hauteur d'écran (×1 à ×2,4) : lisible en 4K.

## Performance (Chromium headless, rendu logiciel, `npm run captures:map`)
```
[1366×768] carte prête en 5.54 s (chargement de la page compris)
  première image de la carte : 1.41 s (terrain, image du relief, couches)
  image fine du relief (worker) prête 6.89 s après le début de la carte
[3840×2160] carte prête en 8.38 s (chargement de la page compris)
  première image de la carte : 1.52 s (terrain, image du relief, couches)
  image fine du relief (worker) prête 8.21 s après le début de la carte
Aucune erreur console.
```
Première image < 3 s : OK. « carte prête » inclut le serveur de développement Vite (modules non groupés).

## Sorties réelles
```
$ npm run map:terrain -- --check
voisinage dessiné / données : identique
fichier figé reproduit à l'identique (52d42f01)
$ npx vitest run tests/map
      Tests  11 passed (11)   (terrain 9, noms 2 : segments sur la ligne médiane de leur mur)
$ npm run smoke:map   (extrait)
  OK  survol → bulle « Trost » (AC1-10)
  OK  clic → dossier de Trost (AC1-10)
  OK  double-clic → centrage et rapprochement (monde → region) (AC1-10)
  OK  molette → niveau « province » (F-STR-01)
smoke:map : OK (captures dans docs/screenshots/).
```
```
$ npm run verify   (typecheck et lint passent, puis)
 FAIL  tests/places/murs.test.ts > R1e.3 — parement sans motif répété (CR1e-05) > autocorrélation …
 Test Files  1 failed | 80 passed (81)
      Tests  1 failed | 509 passed (510)
EXIT 1
$ npm run data:validate && … && npm run sim:selftest && npm run build   (suite de la chaîne)
sim:selftest : OK (direct = worker : sans monde, bac à sable 845, …, 850 avec une bataille jouée).
✓ built in 1.51s
EXIT 0
```

## Captures (lues une à une)
1. `map-1366-ile` — Île entière : mer, côte claire, trois anneaux, Mitras au centre, districts nommés ; Maria et
   l'extérieur voilés ; noms de murs courbés hors des pions. Défauts : « Mur Sina » glissé à l'ouest, lettres espacées ;
   halo clair large autour de l'île ; panneau « Calques » qui masque le sud-ouest.
2. `map-1366-region` — Sud de l'île : Trost, Shiganshina, lac, fleuves, routes, noms des provinces. Défauts : « Fort avancé
   de Maria » et « Forêt des Arbres Géants » serrés ; « Faubourgs de Shiganshina » sur une route ; frontières de Maria assez droites.
3. `map-1366-province` — Trost et Shiganshina, portes, ponts, routes ; noms de segments écrits dans les bandes de murs.
   Défauts : « Maria-Sud-Ouest » coupé au bord gauche ; « Rose-Sud-Est » presque vertical ; champs encore en plaques.
4. `map-1366-calque-politique` — Vert « tenue » dans les murs, rouge « aux Titans » hors Maria, gris « perdue » sur Maria.
   Défauts : rouge et brun du relief proches ; pions par-dessus l'aplat ; légende sur la carte.
5. `map-1366-calque-nourriture` — Ocre plus fort au sud de Rose et près de Karanes. Défauts : l'échelle claire se lit mal
   sur la prairie ; le voile hors Maria se confond avec « 0 » ; pas de chiffre sans infobulle.
6. `map-1366-calque-titans` — Intérieur crème (0), Maria verdâtre, extérieur gris « inconnu ». Défauts : « inconnu » et
   brouillard superposés ; une province du nord-est en brun peu lisible ; « Trost » proche d'un pion.
7. `map-4k-ile` — Même vue en 3840×2160, noms et icônes à l'échelle, relief net ; Karanes nommé à droite de sa porte.
   Défauts : panneau « Calques » minuscule (phase UI) ; blocs carrés au bord des forêts ; « Mur Rose » proche d'un lac.
8. `map-4k-region` — Sud en 4K, image fine : forêts, lac, fleuves nets. Défauts : « Forêt des Arbres Géants » et « Fort
   avancé » serrés ; « Karanes » coupé en haut ; « Faubourgs de Shiganshina » collé à « Shiganshina ».
9. `map-4k-province` — Trost en 4K : routes, ponts, rivières, murs ; « Sina-Sud », « Rose-Sud — porte de Trost »,
   « Maria-Sud — porte de Shiganshina » lisibles dans les bandes. Défauts : « Plaines intérieures de Maria » coupé au bord
   droit ; champs en plaques douces ; nœuds de routes visibles.
10. `map-4k-calque-politique` — Aplats lisibles sur le relief. Défauts : légende minuscule ; frontières fines peu visibles
    sous l'aplat ; pions noirs sur aplat sombre.
11. `map-4k-calque-nourriture` — Dégradé ocre lisible. Défauts : faible contraste entre 0 et 562 ; voile gris hors Maria ;
    l'anneau de Sina paraît uniforme.
12. `map-4k-calque-titans` — Trois zones nettes. Défauts : brun d'une province à 0,75 proche du relief ; « inconnu » sous
    le voile ; Mur Maria peu contrasté sur le gris.

## Hors périmètre et suites
- Noms de fleuves courbés : aucun nom de fleuve dans les données (lore) ; rien n'est inventé.
- Pions d'armées et de flottes : phase PA (les emplacements existent).
- Panneau « Calques » à 4K : phase UI.
- Échec de verify sans lien avec MAP : CR1e-05 (arrêt R1e, rouge sur la branche par défaut, décision de l'utilisateur).
  Lors d'un passage précédent, trois tests 3D avaient dépassé leur délai sous charge (verts seuls, `MAP-verify-3d.log`).
