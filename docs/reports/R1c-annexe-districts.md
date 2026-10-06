# R1c — Annexe : formation des districts d'après l'animé

Ordre des sources : ERRATA > 11 > 01 > 06 > partie B (`docs/art/STYLES.md`). Un fait est marqué `C` seulement s'il est montré ou dit
à l'écran ; un choix de tracé ou de dimension est `A` ; une dimension inconnue est `?` et paramétrable dans `data/art/`.

**Limite de la recherche.** Le wiki communautaire (`attackontitan.fandom.com`) est bloqué par la politique réseau de la session :
les pages n'ont pas pu être lues directement. Les faits ci-dessous viennent des extraits renvoyés par la recherche web (titres
et résumés des pages), recoupés avec les spécifications du projet. Aucun fait n'a été retenu sur la seule foi d'un agrégateur.

## Faits retenus

| # | Fait | Statut | Source | Rendu (R1c.5) |
|---|---|---|---|---|
| 1 | Trois murs concentriques ; chaque mur a quatre districts aux points cardinaux, qui **avancent hors du mur** | `C` (01 §3.1, 06) ; disposition en saillie `C` (partie B, E01) | 01, 06, STYLES E01 ; recherche « districts protrude outward » | Saillie en demi-cercle de rayon `saillie_rayon_m` (`?`) devant la ligne du mur |
| 2 | Rôle des districts : **appâts** qui attirent les Titans vers une porte gardée | `A` (fiches communautaires) | Recherche « districts function as the lure » | Aucun effet de rendu (justifie la saillie) |
| 3 | **Porte extérieure** dans le mur du district et **porte intérieure** dans le mur principal | `C` (épisode 1–2 : le Colossal brise la porte extérieure de Shiganshina, le Cuirassé la porte intérieure) | 01 §1 (845) ; épisode 2, « That Day : The Fall of Shiganshina, Part 2 » | Porte extérieure à la pointe de la saillie, porte intérieure face à la rue principale |
| 4 | **Larges rues principales qui mènent à la porte** (Trost) | `C` ; tracé droit de porte à porte `A` | Résumé de l'arc de Trost (otakumode) | Rue principale droite et pavée de la porte intérieure à la porte extérieure, sans maison sur la chaussée |
| 5 | Shiganshina : **barques d'évacuation** côté porte intérieure ; **portes de rivière** sur la carte du district | `C` (épisode 2 ; carte) ; tracé de la voie d'eau `A` | Résumé de l'épisode 2 ; page « Shiganshina District » (extrait : « military barracks and the river gates ») | Voie d'eau entrée par une porte d'eau de la saillie, sortie par une porte d'eau près de la porte intérieure ; barques et pontons sur le dernier tronçon ; ponts aux croisements |
| 6 | Shiganshina : **casernes** de la Garnison | `C` (carte) ; position `A` | Même extrait | Poste de la Garnison près de la porte extérieure |
| 7 | **Canons** sur le chemin de ronde et près des portes ; rails autour du mur | `C` ; rails tout autour : développement postérieur (`?` selon l'année) | Page « Wall-mounted artillery » (extrait) | Canons sur rails le long du chemin de ronde (R1b), à l'écart des portes |
| 8 | Trost, 850 : la brèche de la porte extérieure est **bouchée par un rocher** porté par Eren | `C` ; forme du rocher générique `A` | Résumé de l'arc de Trost | Variante `850_rocher` de E02 : rocher dans la porte extérieure |
| 9 | Ascenseurs ou monte-charges sur les murs | **Non confirmé** | Recherche sans résultat | Non rendu |

## Paramètres incertains (`data/art/murs.json`)

| Paramètre | Valeur | Statut |
|---|---|---|
| `saillie_rayon_m` | 380 m | `?` |
| `porte_largeur_m`, `porte_hauteur_m` | 12 m, 18 m | `?` |
| `porte_eau_largeur_m`, `porte_eau_hauteur_m` | 14 m, 11 m | `?` |
| Position de la voie d'eau (`WATER_ROUTE` dans `envTown.ts`) | entrée à 54° sur la saillie, sortie à 0,36 R à l'est de la porte intérieure | `A` |

## Ce qui reste à vérifier par l'utilisateur

- La forme exacte des saillies (demi-cercle ou fer à cheval) et leur taille relative à la ville.
- Le tracé réel de la voie d'eau de Shiganshina (rivière ou canal, côté est ou ouest de la rue principale).
- La présence de portes de rivière dans les autres districts (non rendues : aucune source consultée).

## Sources consultées (recherche web, 2026-10-06)

- [That Day: The Fall of Shiganshina, Part 2](https://attackontitan.fandom.com/wiki/That_Day:_The_Fall_of_Shiganshina,_Part_2) — extrait seulement (page bloquée).
- [Shiganshina District](https://attackontitan.fandom.com/wiki/Shiganshina_District) — extrait seulement (page bloquée).
- [Wall-mounted artillery](https://attackontitan.fandom.com/wiki/Wall-mounted_artillery) — extrait seulement (page bloquée).
- [Trost District arc (otakumode)](https://otakumode.com/otapedia/anime/attack_on_titan/trost_district_arc) — extrait.
- [Fall of Shiganshina arc (otakumode)](https://www.otakumode.com/otapedia/anime/attack_on_titan/fall_of_shiganshina_arc) — extrait.
- Agrégateur « attack on titan district map » (rôle d'appât des districts) — faible fiabilité, fait marqué `A`.
