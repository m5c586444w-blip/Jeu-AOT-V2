# U00 — Lisez-moi : mode d'emploi du dossier d'univers

> Dossier d'univers V4 de *Murs et Sang*. Ce fichier explique **comment lire** les quatorze autres : méthode, étiquettes, statut des sources, plan, glossaire des variantes de noms. Rien de ce qui suit n'est de la conception de jeu : les choix de conception sont dans `U14_IMPLICATIONS_POUR_LE_JEU.md` seulement, et portent l'étiquette `A`.

---

## 1. À quoi sert ce dossier

**Objet.** Rassembler en un seul endroit ce que des sources publiques disent de l'univers de *L'Attaque des Titans* (histoire, monde, institutions, technologies, chronologie, récit des événements, personnages), **avec la source de chaque affirmation** et la marque de ce qui est établi, interprété ou incertain.

**Pour qui.** Pour les sessions de développement de la refonte V4 : elles ont besoin de savoir *ce qu'on sait*, *d'où on le sait* et *ce qu'on ne sait pas*, avant d'écrire des données ou des scénarios (`data/characters`, `data/scenarios`, événements, technologies).

**Ce que ce dossier n'est pas.**
- Ce n'est **pas une bible officielle** : aucune source lue n'est un document de l'auteur ou de l'éditeur. Ce sont des pages de wiki communautaire et de Wikipédia (non officielles), lues à travers un outil qui en renvoie un extrait condensé (`U15` §0).
- Ce n'est **pas le canon du projet** : le canon du projet est celui de `docs/spec/11_AUDIT_LORE_ET_CORRECTIONS.md` (`11` prime sur `01`). Un fait `[C]` du dossier n'entre dans les données qu'avec `canon: "?"` et un champ `source_ref`, puis il est promu par décision (`U14` §1, règles R-1 et R-2).
- Ce n'est **pas une substitution à l'œuvre** : les chapitres cités (« Ch. n ») sont ceux que les pages indiquent, non relus.
- Ce n'est **pas une recopie** : les passages sont reformulés ; les citations sont courtes et rares ; aucun fichier, image, modèle ou texture n'est repris de l'œuvre ou d'un fan (règle de provenance de `CLAUDE.md`).

---

## 2. Méthode

1. **Une affirmation, une source.** Chaque ligne factuelle porte un code de source (`FW:<Page>`, `WP:<Page>`, document du dépôt). Le registre complet, avec l'adresse exacte de chaque page, est en `U15` §1.
2. **Trois niveaux de certitude** (étiquettes ci-dessous) : établi, interprété, incertain. Aucun mélange dans une même phrase.
3. **Les contradictions sont gardées, pas lissées.** Quand deux sources divergent, le dossier écrit les deux et ne tranche que si un calcul vérifiable le permet (étiqueté `[I]`). Les 74 contradictions consignées sont dans `U15` §3.
4. **Les trous sont écrits.** Une page non lue, une valeur absente, un chiffre sans source : `[?]` ou « non couvert », jamais une valeur plausible.
5. **Version manga ou anime.** Les pages `_(Anime)` du wiki et les résumés d'épisodes de Wikipédia (`WP:S1`, `WP:S3`) décrivent la **version anime** ; ils sont signalés « version anime » à l'endroit concerné.
6. **Œuvres dérivées.** Les œuvres dérivées (par exemple le roman *Before the Fall*) ne sont jamais `[C]`.
7. **Contrôle.** Un script de contrôle local vérifie les codes de source, les adresses, les renvois de fichier et de section, les identifiants, les étiquettes et les caractères japonais non sourcés (`U15` §7).

---

## 3. Légende des étiquettes

| Étiquette | Sens | Ne veut pas dire |
|---|---|---|
| `[C]` | **Rapporté** par la source citée sur la même ligne, telle que l'extrait la restitue. | ni « vérifié dans le manga », ni « canon du projet » |
| `[I]` | **Interprétation ou calcul de la direction** (rapprochement, somme, lecture d'une formulation). La justification est écrite à côté. | ni un fait de l'œuvre |
| `[?]` | **Non confirmé** : sources contradictoires, valeur absente, page non lue, formulation douteuse. | ni « faux » |
| `A` | **Choix de conception du projet** (uniquement dans `U14`). | jamais du lore |
| `T-nnn` | repère de ligne de `U08_CHRONOLOGIE_DETAILLEE.md` ; **pas** un identifiant de données | n'est pas `E01`–`E60` (événements de `12`) |
| `K-nn`, `Q-n`, `R-n`, `TE-n` | repères de `U14` (corrections proposées, questions, règles, écarts techniques) | |
| `X-nn` | repère du registre des contradictions de `U15` §3 | |
| « Ch. n » | numéro de chapitre **cité par la page de wiki** | non relu dans le manga |
| « B1 » | *before Year 1* : date avant l'an 1, selon `FW:Timeline` | |
| « (c.) » | date approximative selon la source | |

---

## 4. Statut des sources

| Famille | Codes | Statut | Remarque |
|---|---|---|---|
| Wiki communautaire (Fandom) | `FW:<Page>` | **non officiel** | pages de contributeurs ; peuvent refléter l'anime ; plusieurs signalent leurs propres doutes |
| Wikipédia en anglais | `WP:AoT`, `WP:S1`, `WP:S3`, `WP:Chars` | **non officiel** (encyclopédie collaborative) | `S1` et `S3` : résumés d'épisodes, donc **version anime** |
| Documents du projet | `01`, `11`, `12`, `D06`, `26`, `27`, `V4-Dnn` | documents du dépôt | servent de point de comparaison ; ne prouvent rien sur l'œuvre |
| Livres officiels, chapitres, épisodes | — | **non lus** | pistes de vérification : `U15` §0 et §6 |

L'adresse exacte de chaque page est dans `U15` §1 ; la règle est `FW:<Page>` = `https://attackontitan.fandom.com/wiki/<Page>`.

---

## 5. Plan du dossier

Les fichiers sont numérotés `U00` à `U15`. **`U13` n'existe pas** (numéro volontairement sauté, jamais attribué).

| Fichier | Contenu |
|---|---|
| `U00_LISEZ_MOI.md` | ce fichier |
| `U01_COSMOLOGIE_ET_TITANS.md` | Ymir Fritz, les Chemins, les Neuf Titans, la limite de 13 ans, le Titan Fondateur, Titans purs et anormaux, les Ackerman, les Sujets d'Ymir, la fin du pouvoir |
| `U02_HISTOIRE_ELDIA_ET_MARLEY.md` | l'empire éldien, la Grande Guerre des Titans (versions wiki et anime), l'hégémonie de Marley, les Restaurationnistes, le programme des Guerriers |
| `U03_PARADIS_GEOGRAPHIE.md` | l'île de Paradis, les trois Murs, districts et villes, l'intérieur et l'extérieur des Murs, passerelle vers `data/places/` |
| `U04_PARADIS_SOCIETE_ET_POUVOIR.md` | structure du pouvoir, politique de l'ignorance, crises, classes, religion, économie, les régimes de 850 à 857 |
| `U05_ARMEES_DE_PARADIS.md` | Corps d'exploration, Garnison, Brigade militaire, Corps d'entraînement, doctrine à l'épreuve de trois batailles, réforme après 850 |
| `U06_TECHNOLOGIE_ET_ARMEMENT.md` | équipement de manœuvre, pierre à éclatement, Lances de foudre, Bourreau de l'enfer, armes, Marley, forces alliées, Hizuru, déblocages |
| `U07_MARLEY_HIZURU_MONDE.md` | Marley, Helos, Unité des Guerriers, famille Tybur, Liberio, Société de recherche, Restaurationnistes, Volontaires, guerre du Moyen-Orient, « Alliance mondiale », Hizuru |
| `U08_CHRONOLOGIE_DETAILLEE.md` | chronologie de ligne en ligne (`T-nnn`), des origines à l'après-Grondement, naissances, contrôles arithmétiques |
| `U09_RECIT_845_850.md` | récit : chute de Maria, cinq ans d'attente, Trost, 57ᵉ expédition, invasion de Rose, coup d'État, retour à Shiganshina |
| `U10_RECIT_851_854_ET_APRES.md` | récit : années de transition, guerre du Moyen-Orient, Liberio, guerre pour Paradis, Grondement, bataille du Ciel et de la Terre, épilogue |
| `U11_PERSONNAGES_PARADIS.md` | personnages de Paradis avec fenêtres de présence |
| `U12_PERSONNAGES_MARLEY_ET_AUTRES.md` | Guerriers, hiérarchie de Marley, Tybur, Restaurationnistes et Volontaires, Hizuru, Ymir Fritz |
| `U14_IMPLICATIONS_POUR_LE_JEU.md` | **seul fichier de conception** : règles de passage, corrections proposées à `01`/`11`/`12`, fenêtres de présence, règles Titans, scénarios, mécaniques, technologie, questions à Gabriel |
| `U15_REGISTRE_SOURCES_ET_INCERTITUDES.md` | registre des sources, pages non lues, 74 contradictions, trois listes maîtresses, lacunes, points à vérifier en priorité |

---

## 6. Par où commencer

| Si vous voulez… | Lisez… |
|---|---|
| comprendre l'univers en dix minutes | `U01` §1, puis `U08` §1 à §8 (tableaux) |
| écrire des **données** (personnages, événements, scénarios) | `U14` en entier, puis `U08`, `U11`, `U12`, et `U15` §3 pour les points disputés |
| écrire un **scénario** ou une **campagne** | `U09` et `U10` (récit), `U04` (pouvoir), `U05` (armées), `U14` §5 |
| créer un **lieu** | `U03`, puis `U14` §3 et `data/places/` |
| créer un **personnage** ou un portrait | `U11`, `U12` (fenêtres de présence, sorties, morts) |
| régler une **mécanique** (Titans, héritage, technologie) | `U01` §4 à §6, `U06`, `U14` §4 et §6 |
| savoir **si une affirmation est sûre** | la ligne elle-même (étiquette + source), puis `U15` §3 |
| décider quoi **vérifier dans l'œuvre** | `U15` §6 |

---

## 7. Glossaire des variantes de noms

Les sources n'orthographient pas les noms de la même façon. Le dossier garde **une forme** (colonne 1) et signale les variantes rencontrées (colonne 2). Une variante figure dans un extrait lu, sauf mention contraire dans la colonne « Où ».

| Forme du dossier | Variantes rencontrées | Où | Note |
|---|---|---|---|
| Yeager | Jaeger | `WP:S1` | forme du wiki : Yeager |
| Yeagerists | Jaegerists | (orthographe alternative envisagée par le dossier ; **non trouvée** dans la page lue) | la page n'emploie que « Yeagerists » ; choix du projet : **Yeagerists** |
| Dot Pixis | Dot Pyxis | `WP:S1` | |
| Nile Dok | Nile Dawk | `WP:S1` | |
| Kitz Weilman | Kitts Weilman | `FW:Battle_of_Trost_District` ; `WP:S1` | |
| Keith Shadis | Keith Sadies | `WP:S1` | |
| Darius Zackly | Dhalis Zachary ; « Premier Zachary » | `WP:S1` ; `FW:Eldia` | le titre varie aussi (U04 §8 #1) |
| Sasha Blouse | Sasha Braus | `FW:Clash_of_the_Titans_arc` ; `FW:Marley_arc` | |
| Mike Zacharias | Mike Zacharius | `WP:Chars` | |
| Bertolt Hoover | Bertholdt Hoover | `WP:S1` ; `WP:S3` | pages personnelles non lues (`U15` §2) |
| Titan Colossal | Colossus ; « Titans colossaux » (les Titans des Murs) | `FW:Timeline` ; `FW:Walls` | ne pas confondre le Titan de Bertolt et les Titans des Murs |
| Sina | Sheena | `FW:Timeline` ; `FW:Walls` | « Sheena » est le nom du wiki ; « Sina » celui du projet |
| Furlan Church | Farlan Church | `FW:Underground_(Anime)` ; `FW:Levi_Ackerman` | |
| Sonny et Bean | Sawney et Beane | `FW:Timeline` ; `WP:S1` | « Sonny » : wiki (manga) ; « Sawney » : résumés d'épisodes (anime) (U09 §10 #8) |
| Hange Zoë | « Hans Zoe » | `FW:Hange_Zoë` | rendu anglais courant dans des produits dérivés japonais, selon la page |
| Liberio | « Rebellio » | `FW:Liberio` | nom alternatif donné par la page |
| famille Azumabito | « clan asiatique » ; « clan oriental » | `FW:Azumabito_family` ; `FW:Ackerman_clan` | même groupe ou non : non confirmé (`U15` X-22) |
| Ymir Fritz | Ymir (104ᵉ promotion) ; « Ymir » du culte (c. 780) | `FW:Ymir_Fritz_(Anime)` ; `FW:Ymir` ; `FW:Timeline` | **trois personnages distincts** |
| « Alliance mondiale » | Global Alliance ; Mid-East Allied Forces | `FW:Timeline` ; `FW:Mid-East_Allied_Forces` | « Alliance mondiale » est un terme de commodité du dossier ; les Forces alliées du Moyen-Orient sont un autre ensemble (U07 §9, §10) |
| guerre du Moyen-Orient | *Marley Mid-East War* | `FW:Marley_Mid-East_War` | titre donné par les fans |
| invasion de Wall Rose | *Wall Rose invasion* | `FW:Wall_Rose_invasion` | titre donné par les fans |
| Garnison | « Garde stationnaire » (*Stationary Guard*) | anciens fichiers du dépôt ; **absent** de `FW:Garrison` | la page ne l'emploie jamais ; choix du projet : Garnison (U05 §1) |

**Noms français employés par le dossier** (alignés sur le dépôt) : Titan Assaillant, Fondateur, Bestial, Mâchoire, Colossal, Cuirassé, Féminin, Charrette, Marteau de guerre ; Volontaires anti-Marleyens ; Brigade militaire ; Police intérieure ; Lances de foudre ; Bourreau de l'enfer ; Corps d'exploration. Ce sont des noms d'usage du projet, pas des citations d'une édition française.

---

## 8. Avertissement de contenu

Le dossier documente une œuvre de fiction qui montre des guerres, des massacres et un génocide planifié (le Grondement), l'oppression d'un peuple, l'enfermement et l'embrigadement d'enfants, des exécutions et des tortures. Il en rapporte les faits **pour documenter l'univers d'un jeu**, sans modèle de conduite et sans détail opérationnel. Les passages de `U14` sur les mécaniques de persécution sont proposés « sérieux, sans mode d'emploi » (`U14` Q-6).

---

## 9. Entretenir le dossier

- Toute nouvelle affirmation porte **une source** et une étiquette ; toute nouvelle page lue entre dans le registre `U15` §1 avec son adresse exacte.
- Une page non lue reste dans `U15` §2 tant qu'elle n'a pas été lue ; on ne la remplace pas par une supposition.
- Une contradiction nouvelle s'ajoute à `U15` §3 avec un identifiant `X-nn` ; elle ne s'efface pas d'un fichier thématique sans trace.
- Une valeur de jeu inventée reste dans `U14` avec l'étiquette `A` ; elle ne passe jamais dans les fichiers `U01`–`U12`.
- Les décisions qui engagent le projet vont dans `docs/DECISIONS.md` (`D-nnn`), pas dans le dossier.
