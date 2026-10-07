# Rapport MAP — carte stratégique réaliste

Branche `claude/v2-map`, PR brouillon n° 2 (non fusionnée). Phase : `docs/phases/MAP.md`. Nuit du 2026-10-07.
Ce rapport ne décrit que ce qui a été vérifié ; les sorties réelles sont collées ou jointes (`docs/reports/MAP-*.log`).

## Critères
| Id | État | Preuve |
|---|---|---|
| CMAP-01 verify code 0 | **KO hors MAP** : 507/508, seul échec CR1e-05 (déjà rouge sur la branche par défaut) ; le reste de la chaîne code 0 | `MAP-verify.log`, `MAP-verify-suite.log` |
| CMAP-02 `src/sim` inchangé | OK | `git diff origin/claude/attack-on-titan-strategy-game-4ukom6 --stat -- src/sim` : vide |
| CMAP-03 sim:selftest | OK | `MAP-verify-suite.log` |
| CMAP-04 voisinage dessiné = données | OK | `npm run map:terrain -- --check` : « identique » ; `tests/map` |
| CMAP-05 aire minimale | OK | `tests/map` : provinces ≥ 2 500 km², segments de mur ≥ 1 000 km² |
| CMAP-06 terrain reproductible | OK | `--check` : « fichier figé reproduit à l'identique (7c8aab40) » ; test de déterminisme |
| CMAP-07 smoke:map | OK | `MAP-smoke.log` : 26 contrôles OK, « smoke:map : OK » |
| CMAP-08 captures lues | OK | 12 captures ci-dessous, lues une à une |

## Ce qui est fait
- **MAP.1** `npm run map:terrain` (graine `paradis-v1`, version 1, empreinte) écrit `data/map/terrain/paradis.json` (930 Kio) :
  côte [A] avec baies et caps, 5 îlots, relief (dôme central, collines, chaîne au nord-ouest), cuvettes comblées
  sauf les vrais lacs, 79 fleuves (écoulement D8), forêts, Arbres Géants à l'emplacement de l'atlas, marais, falaises au sud.
  Murs posés sur le terrain avec une légère déformation (± 1,8 %).
- **MAP.2** Un polygone par province (74), frontières décalées par du bruit et nulles aux murs ; voisinage recalculé
  (arête commune > 3 km) : **identique** à `data/map/paradis.json`, aucune connexion inventée ni perdue.
- **MAP.3** Image du relief (ombrage nord-ouest, teintes mêlées par milieu, eau, écume) puis couches Pixi : côte,
  fleuves, routes au moindre coût (pente, eau, murs franchis aux portes seulement), 59 ponts, murs en relief avec ombre,
  créneaux et segments abîmés, villes par taille, brouillard en voile sans texte.
- **MAP.4** Trois niveaux (île, région, province) ; routes secondaires dès « région », ponts et créneaux à « province » ;
  noms de murs courbés ; les noms se placent à côté des icônes (5 positions essayées) et se masquent s'ils se chevauchent.
- **MAP.5** Calques en aplat transparent (0,55) ; valeur inconnue en gris de légende (0,45). Infobulle : nom, région,
  état, mur en %, population, garnison et effectif, ressource principale ; clic : dossier (smoke:map).
- **MAP.6** Emplacement de pion par province, choisi dans le polygone loin du nom et de la ville (test : dans la province).
- **MAP.7** Terrain chargé à la demande en une ressource ; première image puis image fine (3072 px) calculée dans un worker.
- Taille des traits, icônes et noms proportionnelle à la hauteur d'écran (×1 à ×2,4) : lisible en 4K.

## Performance (Chromium headless, rendu logiciel, `npm run captures:map`)
```
[1366×768] carte prête en 5.63 s (chargement de la page compris)
  première image de la carte : 1.31 s (terrain, image du relief, couches)
  image fine du relief (worker) prête 6.94 s après le début de la carte
[3840×2160] carte prête en 9.42 s (chargement de la page compris)
  première image de la carte : 1.49 s (terrain, image du relief, couches)
  image fine du relief (worker) prête 10.21 s après le début de la carte
Aucune erreur console.
```
Première image < 3 s : OK. « carte prête » inclut le serveur de développement Vite (modules non groupés).

## Sorties réelles
```
$ npm run map:terrain -- --check
voisinage dessiné / données : identique
fichier figé reproduit à l'identique (7c8aab40)
$ npx vitest run tests/map
      Tests  9 passed (9)
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
AssertionError: expected 0.5014354337066348 to be less than 0.35
 Test Files  1 failed | 79 passed (80)
      Tests  1 failed | 507 passed (508)
$ npm run data:validate && … && npm run sim:selftest && npm run build   (suite de la chaîne)
sim:selftest : OK (direct = worker : sans monde, bac à sable 845, …, 850 avec une bataille jouée).
✓ built in 1.56s
EXIT 0
```

## Captures (lues une à une)
1. `map-1366-ile` — Île entière : mer, côte claire, trois anneaux de murs, Mitras au centre, districts nommés ;
   Maria et l'extérieur voilés. Défauts : pions posés sur les lettres de « Mur Sina » ; halo clair large autour de l'île ;
   panneau « Calques » qui masque le sud-ouest.
2. `map-1366-region` — Sud de l'île : Trost, Shiganshina, lac à l'ouest, fleuves, routes, noms des provinces.
   Défauts : « Hameaux de l'Ouest de Maria » et « Collines minières » très proches ; « Faubourgs de Shiganshina » sur une
   route ; frontières encore assez droites dans l'anneau de Maria.
3. `map-1366-province` — Trost et Shiganshina, portes, ponts, routes sinueuses, forêts. Défauts : noms de segments
   posés sur la bande du mur (Rose-Sud-Est) ; « -Sud-Ouest » coupé au bord ; taches de champs un peu marbrées.
4. `map-1366-calque-politique` — Vert « tenue » dans les murs, rouge « aux Titans » hors Maria, gris « perdue » sur Maria.
   Défauts : rouge et brun du relief proches ; pions par-dessus l'aplat ; légende sur la carte.
5. `map-1366-calque-nourriture` — Aplat ocre plus fort au sud de Rose et à Karanes. Défauts : l'échelle claire se lit
   mal sur la prairie ; le voile hors Maria se confond avec « 0 » ; pas de chiffre au survol sans infobulle.
6. `map-1366-calque-titans` — Intérieur crème (0), Maria verdâtre, extérieur gris « inconnu ». Défauts : « inconnu » et
   brouillard superposés ; une province du nord-est en brun peu lisible ; noms de murs coupés par des pions.
7. `map-4k-ile` — Même vue en 3840×2160 : noms et icônes à l'échelle de l'écran, relief net. Défauts : panneau
   « Calques » minuscule (hors MAP, phase UI) ; quelques blocs carrés au bord des forêts ; « Mur Rose » touche un pion.
8. `map-4k-region` — Sud de l'île en 4K, image fine chargée : forêts, lac, fleuves nets. Défauts : « Forêt des Arbres
   Géants » et « Fort avancé de Maria » serrés ; « Karanes » coupé en haut ; « Plaines céréalières » sur une icône.
9. `map-4k-province` — Trost en 4K : routes, ponts, rivières lisses, murs avec créneaux. Défauts : champs en taches
   régulières ; « Rose-Sud — porte de Trost » mord la bande du mur ; nœuds de routes visibles (petits carrés = ponts).
10. `map-4k-calque-politique` — Aplats lisibles sur le relief en 4K. Défauts : légende minuscule ; frontières fines peu
    visibles sous l'aplat ; pions noirs sur aplat sombre.
11. `map-4k-calque-nourriture` — Dégradé ocre lisible. Défauts : faible contraste entre 0 et 562 ; voile gris hors Maria ;
    l'anneau de Sina paraît uniforme.
12. `map-4k-calque-titans` — Lecture nette des trois zones. Défauts : brun d'une province à 0,75 proche du relief ;
    « inconnu » sous le voile ; Mur Maria peu contrasté sur le gris.

## Hors périmètre et suites
- Noms de fleuves courbés : aucun nom de fleuve dans les données (lore) ; rien n'est inventé.
- Pions d'armées et de flottes : phase PA (les emplacements existent).
- Panneau « Calques » à 4K : phase UI.
- Échec de verify sans lien avec MAP : CR1e-05 (arrêt R1e, rouge sur la branche par défaut, décision de l'utilisateur).
  Lors d'un passage précédent, trois tests 3D avaient dépassé leur délai sous charge ; verts lancés seuls (27/27).
