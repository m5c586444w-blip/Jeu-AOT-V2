# src/audio

Musique du jeu (AUD, D-114) : **synthétisée**, déterministe, sans enregistrement. Modules purs (aucun DOM, aucune horloge, aucun `Math.random`) sauf
`instruments.ts` (recettes WebAudio) et `userTracks.ts` (seul module qui crée un lecteur de fichier audio).

| Fichier | Rôle |
|---|---|
| `types.ts` | états (`calme`, `tension`, `combat`), timbres, événements, arrangements |
| `notation.ts` | mélodie `Hauteur:durée` (armure, `$motif`), accords (`D.A` = deux accords dans la mesure) |
| `pieces.ts` | répertoire (domaine public transcrit, pièces originales) et pièces de chaque état |
| `render.ts` | pièce + état → événements (mélodie, basse, accords, percussions) ; sections dérivées par transposition |
| `playlist.ts` | ordre des pièces (graine fixe, pas de reprise en moins de `n - 1` pièces), silences, filtre et niveau de chaque état |
| `instruments.ts` | un petit patch soustractif par timbre ; toute note grave est brève |
| `userTracks.ts` | pistes de `assets_user/musique/` (index, préfixes d'état, lecteur de flux) |

Le moteur (`src/ui/audio.ts`) planifie les événements dans une fenêtre de 1,5 s, croise les états (un fondu par état, filtre passe-bas
propre à chaque état) et gère quatre bus : musique, ambiances, effets, interface. Tests : `tests/audio/`, `tests/ui/audio.test.ts`.
Règles mesurées : aucune note grave tenue plus de 8 s, aucune seconde mineure, triton ou septième majeure tenus plus d'une seconde, tour
de liste ≥ 240 s, volume par défaut ≤ 0,35. L'écoute reste à faire par l'utilisateur.
