# LICENCES DES ASSETS

> Règle (00 §6.6) : aucun asset extrait de l'œuvre (anime, manga, jeux, fans). Tout est recréé ou sous licence libre.

## Polices (auto-hébergées via npm, aucun CDN)

| Police | Usage | Paquet | Licence | Auteurs |
|---|---|---|---|---|
| EB Garamond | Texte courant | `@fontsource/eb-garamond` 5.3.0 | SIL Open Font License 1.1 | The EB Garamond Project Authors |
| IM Fell English | Titres | `@fontsource/im-fell-english` 5.3.0 | SIL Open Font License 1.1 | Igino Marini (distribution Google Fonts) |
| Special Elite | Console, valeurs « machine à écrire » | `@fontsource/special-elite` 5.3.0 | Apache License 2.0 | Astigmatic |

Texte complet des licences : `node_modules/@fontsource/<police>/LICENSE` (installé par `npm ci`). Le build n'embarque que les fichiers `.woff` / `.woff2` du sous-ensemble latin.

## Images, textures, icônes

| Élément | Origine | Licence |
|---|---|---|
| Grain de papier, fibres, taches, masque de tampon | Générés à l'exécution (SVG `feTurbulence`, `src/ui/paper.ts`) | Création originale du projet |
| Favicon (trois anneaux) | `public/favicon.svg`, dessiné pour le projet | Création originale du projet |
| Icônes des 9 ressources | `src/ui/icons.ts`, tracés SVG dessinés pour le projet (double trait irrégulier) | Création originale du projet |
| Texture de papier de la carte | `src/render/paperTexture.ts`, bruit de valeur généré sur canvas | Création originale du projet |
| Symboles de carte (relief, arbres, roseaux, ruines, champs, pions de garnison, portes, fissures) | `src/render/atlasLayers.ts`, dessinés par code | Création originale du projet ; marques des pions géométriques, sans reprise d'emblèmes de l'œuvre |
| Captures `docs/screenshots/` | Rendus du projet | Création originale du projet |

## Bibliothèques

| Bibliothèque | Licence |
|---|---|
| pixi.js 8 | MIT |
| zod 4 | MIT |

## Audio

Aucun en P0.

## Ajouts de P2

| Élément | Source | Licence |
|---|---|---|
| Portraits des personnages | `src/ui/portrait.ts`, gravure procédurale en SVG (graine + archétype), sans ressemblance recherchée avec les dessins de l'œuvre | Création originale du projet |
| Plan de table du Cabinet, billes de vote, tampons | `src/ui/panels/cabinetPanel.ts`, CSS `screen.css` | Création originale du projet |
| Captures `docs/screenshots/p2-*` | Rendus du projet | Création originale du projet |
