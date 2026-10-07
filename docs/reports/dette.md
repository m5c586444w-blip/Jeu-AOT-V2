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
