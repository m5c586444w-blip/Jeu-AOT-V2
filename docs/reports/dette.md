# Dette (hors périmètre, une ligne par point)

Format : **quoi** — où — gravité (faible / moyenne / forte). Tag `LC-reporté` pour un lieu de LC-B/C/D non fait.

| # | Quoi | Où | Gravité | Ouvert |
|---|---|---|---|---|
| 1 | Mesure de latence et de temps d'image sur GPU réel (« prêt », « corps », qualités moyenne et haute) | `npm run mesure:r1d` ; `/?proto3d` | moyenne | R1d |
| 2 | `smoke:r1b` mesurait juste après « prêt », sans attendre les textures de Poly Haven | `src/tools/smoke-r1b.ts` | faible | R1d (corrigé en R1e.2) |
| 3 | Villes générées de R1b (E02, E05) : tissu toujours en damier malgré les placettes et cours plantées ; les lieux N1 les remplaceront | `src/render/tactical3d/envTown.ts` | moyenne | R1e.2 |
| 4 | Vues d'ensemble des grands lieux : ~0,9 M triangles dessinés pour un budget visé de 250 000 (imposteurs de quartiers à prévoir) | `places/loadPlace.ts` | moyenne | R1e.4 |
| 5 | Ciel physique : triangle bleu à arête droite dans certaines vues hautes (banc, vue d'ensemble), en qualité moyenne de jour ; ni les nuages ni le plan lointain ; lié au post-traitement | `lighting.ts`, `post.ts` | faible | R1e.3 |
| 6 | Habitants (`habitants` des états) non rendus dans les lieux | `places/` | faible | R1e.4 |
| 7 | Cache LRU des lieux pas encore branché sur un monde à plusieurs lieux (R2) | `places/placeCache.ts` | faible | R1e.6 |
| 8 | Parement (CR1e-05) : autocorrélation 0,501 (pic isolé à 20 m, cause non établie) au lieu de < 0,35 ; accepté par l'utilisateur « pour le moment » (D-103) | `src/render/tactical3d/parement.ts`, `tests/places/murs.test.ts` | faible | R1e.3 |
| 9 | États de Shiganshina (CR1e-07) : 845-avant / 850-reprise ΔE 3,4 < 6 après un correctif (essai 1 : 845-brèche / 850-reprise 5,9). Cause mesurée : dans la vue d'ensemble à 2,7 km, la friche, les ruines et les portes bouchées de 850 sont sous le pixel ; seul le ciel diffère. Piste : comparer les états sur une vue plus proche (porte extérieure, Grand-Rue) ou une friche plus marquée. Règle du fichier 24 §4 appliquée (noté, pas d'arrêt) | `places/placeViewer.ts`, `tools/places-captures.ts` | moyenne | R1e.4 |
| 10 | Vue d'ensemble de l'état 845-brèche : la ville presque effacée par le voile de fumée | `places/placeViewer.ts` (`STATE_FOG`) | faible | R1e.4 |
| 11 | Champs, cours et parcs posés 2 à 6 cm au-dessus de la prairie : rayures (scintillement de profondeur) vus de loin (village des Saules à 1,5 km). Piste : décalage de polygone (`polygonOffset`) sur les couches du sol | `places/ground3d.ts` | faible | R1e.7 |
| 12 | Vues de lieux à revoir : Grand Marché et marché aux Draps de Quinta presque identiques (même halle) ; « port » sans bateau ; places vides (pas d'étals) ; figures d'échelle petites hors Titan | `src/tools/places/auteur/`, `places/scaleFigures.ts` | faible | R1e.7 |

