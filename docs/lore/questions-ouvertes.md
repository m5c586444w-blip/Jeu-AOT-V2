# Questions de lore ouvertes (à renseigner par l'utilisateur)

Règle (consigne R1e) : une donnée sans source officielle vérifiable (manga, databooks, guides officiels) est `[?]`, paramétrable, et listée ici.
Aucune source officielle n'a pu être consultée directement dans cette session ; les recherches web ne renvoient que des pages non officielles, citées comme telles.

| # | Question | Valeur provisoire (`?`) | Où la changer | Recherche faite |
|---|---|---|---|---|
| Q1 | **Noms des trois autres districts du mur Maria** (nord, est, ouest), leur rang et leur orientation | `maria-district-2`, `-3`, `-4`, libellé « District du mur Maria (nom non établi) » ; orientations nord, est, ouest | `data/places/maria-district-*.json` (`nom`, `orientation`) | Recherche web (2026-10-07) : aucune source officielle ; pages non officielles muettes ou génériques (« chaque mur a quatre districts aux points cardinaux ») |
| Q2 | **Épaisseur des murs** à la base et au sommet, **fruit**, hauteur du parapet, largeur du chemin de ronde | voir `data/places/_murs.json` (valeur et plage) | `data/places/_murs.json` | Le chiffre « 15 m d'épaisseur » ne figure que sur une page non officielle (expertbeacon.com) : non retenu comme canon |
| Q3 | **Rayon des anneaux** (Maria, Rose, Sina) et distances entre murs | ≈ 100 km Maria→Rose, ≈ 130 km Rose→Sina (seconde main, fichier 11 §9.4) | `data/places/_murs.json` | Fichier 11 §9 : non vérifié |
| Q4 | **Taille et forme des saillies** des districts | demi-cercle ; rayon déduit de la population et de la densité (Shiganshina ≈ 1,2 km) | `data/places/<id>.json` (`enceinte`) | Aucune source officielle chiffrée trouvée |
| Q5 | **Dimensions des portes** (passage, vantaux), mécanisme de levage | voir les fiches de portes (`A`) | `data/places/<id>.json` (`portes[]`) | Aucune source officielle chiffrée trouvée |
| Q6 | **Position** de la maison des Jaeger, de la clinique du Dr Jaeger et de la maison d'Armin dans Shiganshina (existence `C`) | positions `A` dans le plan | `data/places/shiganshina.json` (`batiments[]`) | — |
| Q7 | **Lien Nördlingen ↔ Shiganshina** (inspiration souvent citée) | non utilisé comme fait ; seulement comme inspiration `A` | `docs/places/shiganshina/inspirations.md` | Affirmation répandue, source officielle non vérifiée |
| Q8 | **Population des districts de Maria non nommés** (absents des données de simulation) | valeurs `?` paramétrables : `maria-district-2` 42 000 (+ 6 000 au faubourg), `-3` 36 000 (+ 4 000), `-4` 50 000 (+ 5 000) ; orientations ouest, est, nord | `data/places/maria-district-*.json` (`population`) | Pas de province dans `data/provinces` pour ces districts ; données de simulation non modifiées |
| Q9 | **Voie d'eau de Shiganshina** : rivière ou canal, côté, tracé ; portes de rivière (existence donnée par la consigne R1e §5 et l'annexe R1c, d'après l'épisode 2 de l'anime vu par extraits) | canal `A`, tracé `A` | `data/places/shiganshina.json` (`eau`, `portes[]`) | Annexe R1c (extraits de pages non officielles) |
| Q10 | **État des portes de Shiganshina en 850** (bouchage de la porte extérieure par la pétrification d'Eren ; état de la porte intérieure) | porte extérieure `bouchee`, porte intérieure `bouchee` (`?`) | `data/places/shiganshina.json` (`etats[]`) | — |
