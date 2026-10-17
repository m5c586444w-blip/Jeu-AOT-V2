# U15 — Registre des sources et des incertitudes

> Dossier d'univers V4 — fichier de clôture (série `U00`–`U15`, sans `U13`). Étiquettes `[C]` `[I]` `[?]` : voir `U00_LISEZ_MOI.md`.
> Ce fichier ne raconte rien. Il répond à quatre questions : **d'où vient chaque affirmation** (§1), **qu'est-ce qui n'a pas pu être lu** (§2), **quelles sources se contredisent** (§3) et **que reste-t-il d'inconnu** (§5). Le §4 donne les trois listes maîtresses : affirmations sourcées, affirmations interprétatives, éléments non confirmés.

---

## 0. Trois degrés de distance entre le dossier et l'œuvre

| Degré | Ce que c'est | Conséquence |
|---|---|---|
| 1. L'œuvre | Le manga de Hajime Isayama (*Bessatsu Shōnen Magazine*, Kodansha, septembre 2009 → avril 2021, 34 volumes, selon WP:AoT), l'anime, les livres officiels. | **Aucun d'eux n'a été lu par la direction.** Le dossier ne rapporte l'œuvre qu'à travers les pages (degré 2). |
| 2. La page | Une page de wiki communautaire (Fandom) ou de Wikipédia, écrite par des contributeurs, qui renvoie souvent à des chapitres (« Ch. n »). | Statut **non officiel**. Une page peut se tromper, se contredire ou refléter l'anime plutôt que le manga ; plusieurs pages signalent elles-mêmes leurs doutes (« Flag », « citation requise »). |
| 3. L'extrait | L'outil de lecture du web renvoie, pour chaque page, **un extrait condensé et reformulé par un modèle selon une consigne de lecture**, non le texte brut. | Une page peut avoir été résumée avec des omissions. Les mentions « Ch. n » sont celles que l'extrait rapporte ; **elles n'ont pas été relues dans le manga**. |

**Règle de lecture.** `[C]` veut dire « rapporté par la page, telle que l'extrait la restitue » ; ce n'est ni « vérifié dans l'œuvre » ni « canon du projet » (règle R-1 de `U14`). Avant d'écrire une valeur dans `data/` comme fait ferme, la vérifier dans l'œuvre : le §6 liste les points qui comptent le plus.

**Version manga ou anime.** Quand deux versions divergent, l'étiquette « version anime » est portée à l'endroit concerné (pages `_(Anime)` du wiki et résumés d'épisodes de WP:S1, WP:S3). Sans mention, la page principale est supposée refléter le manga `[I]` (les versions anime ont leurs propres pages dans le wiki).

**Résultats de recherche non retenus.** Des recherches web ont renvoyé aussi des sites de résumés d'épisodes (dont *daddyjim.ai*), IMDb, des boutiques et des fiches de librairie. Aucune n'a été utilisée comme source : provenance invérifiable ou page non ouverte. Les livres officiels *Attack on Titan Guidebook: INSIDE & OUTSIDE* (https://www.randomhousebooks.com/books/239477) et *Attack on Titan Character Encyclopedia* (https://www.randomhousebooks.com/books/595044) apparaissent dans ces résultats ; **les pages n'ont pas été ouvertes et les livres n'ont pas été lus**. Ils sont cités ici seulement comme pistes de vérification (aucun achat n'est fait ni demandé par ce dossier).

---

## 1. Registre des sources

### 1.1 Règle de construction des codes

- `FW:<Page>` = page du wiki communautaire *Attack on Titan Wiki* (Fandom), **non officiel**, à l'adresse `https://attackontitan.fandom.com/wiki/<Page>`. Les pages dont le nom finit par `_(Anime)` décrivent la **version anime**.
- `WP:AoT`, `WP:S1`, `WP:S3`, `WP:Chars` = pages de Wikipédia en anglais (encyclopédie collaborative, **non officielle**).
- `D01`/`01`, `D11`, `D12`, `26`, `27` = documents du dépôt (§1.3).
- Colonne « Fichiers » : les fichiers du dossier qui emploient le code. Chaque code ci-dessous correspond à une page dont un extrait a été lu ; le contrôleur du dossier le vérifie (§7).

### 1.2 Pages web (105 codes)

| Code | Nature | Statut | URL | Fichiers |
|---|---|---|---|---|
| `FW:Ackerman_clan` | famille / clan | wiki communautaire, **non officiel** | https://attackontitan.fandom.com/wiki/Ackerman_clan | U01, U04 |
| `FW:Airship` | Titan / technologie | wiki communautaire, **non officiel** | https://attackontitan.fandom.com/wiki/Airship | U06, U08, U10 |
| `FW:Annie_Leonhart` | personnage | wiki communautaire, **non officiel** | https://attackontitan.fandom.com/wiki/Annie_Leonhart | U12, U14 |
| `FW:Anti-Marleyan_Volunteers` | organisation | wiki communautaire, **non officiel** | https://attackontitan.fandom.com/wiki/Anti-Marleyan_Volunteers | U04, U06, U07, U10 |
| `FW:Armin_Arlert` | personnage | wiki communautaire, **non officiel** | https://attackontitan.fandom.com/wiki/Armin_Arlert | U05, U11, U12, U14 |
| `FW:Azumabito_family` | famille / clan | wiki communautaire, **non officiel** | https://attackontitan.fandom.com/wiki/Azumabito_family | U04, U07, U08, U11 |
| `FW:Battle_of_Heaven_and_Earth` | arc / bataille / événement | wiki communautaire, **non officiel** | https://attackontitan.fandom.com/wiki/Battle_of_Heaven_and_Earth | U04, U10, U11, U12, U14 |
| `FW:Battle_of_Shiganshina_District` | arc / bataille / événement | wiki communautaire, **non officiel** | https://attackontitan.fandom.com/wiki/Battle_of_Shiganshina_District | U05, U06, U08, U09, U11, U12, U14 |
| `FW:Battle_of_Trost_District` | arc / bataille / événement | wiki communautaire, **non officiel** | https://attackontitan.fandom.com/wiki/Battle_of_Trost_District | U04, U05, U08, U09, U11, U12 |
| `FW:Calvi` | personnage | wiki communautaire, **non officiel** | https://attackontitan.fandom.com/wiki/Calvi | U12 |
| `FW:Clash_of_the_Titans_arc` | arc / bataille / événement | wiki communautaire, **non officiel** | https://attackontitan.fandom.com/wiki/Clash_of_the_Titans_arc | U03, U09, U11, U14 |
| `FW:Colt_Grice` | personnage | wiki communautaire, **non officiel** | https://attackontitan.fandom.com/wiki/Colt_Grice | U12, U14 |
| `FW:Connie_Springer` | personnage | wiki communautaire, **non officiel** | https://attackontitan.fandom.com/wiki/Connie_Springer | U04, U05, U10, U11, U12 |
| `FW:Darius_Zackly` | personnage | wiki communautaire, **non officiel** | https://attackontitan.fandom.com/wiki/Darius_Zackly | U04, U05, U09, U10, U11 |
| `FW:Dina_Fritz` | personnage | wiki communautaire, **non officiel** | https://attackontitan.fandom.com/wiki/Dina_Fritz | U11, U12, U14 |
| `FW:Dot_Pixis` | personnage | wiki communautaire, **non officiel** | https://attackontitan.fandom.com/wiki/Dot_Pixis | U04, U05, U09, U10, U11 |
| `FW:Eldia` | lieu / État | wiki communautaire, **non officiel** | https://attackontitan.fandom.com/wiki/Eldia | U01, U02, U04 |
| `FW:Eldian_Restorationists` | organisation | wiki communautaire, **non officiel** | https://attackontitan.fandom.com/wiki/Eldian_Restorationists | U02, U07 |
| `FW:Eren_Kruger` | personnage | wiki communautaire, **non officiel** | https://attackontitan.fandom.com/wiki/Eren_Kruger | U12 |
| `FW:Erwin_Smith` | personnage | wiki communautaire, **non officiel** | https://attackontitan.fandom.com/wiki/Erwin_Smith | U05, U11 |
| `FW:Executioner_from_Hell` | Titan / technologie | wiki communautaire, **non officiel** | https://attackontitan.fandom.com/wiki/Executioner_from_Hell | U03, U06, U08, U10 |
| `FW:Falco_Grice` | personnage | wiki communautaire, **non officiel** | https://attackontitan.fandom.com/wiki/Falco_Grice | U12 |
| `FW:Fall_of_Wall_Maria` | arc / bataille / événement | wiki communautaire, **non officiel** | https://attackontitan.fandom.com/wiki/Fall_of_Wall_Maria | U04, U08, U09, U11, U12 |
| `FW:Floch_Forster` | personnage | wiki communautaire, **non officiel** | https://attackontitan.fandom.com/wiki/Floch_Forster | U10, U11 |
| `FW:Flying_boat` | Titan / technologie | wiki communautaire, **non officiel** | https://attackontitan.fandom.com/wiki/Flying_boat | U06, U08, U10 |
| `FW:Fort_Slava` | arc / bataille / événement | wiki communautaire, **non officiel** | https://attackontitan.fandom.com/wiki/Fort_Slava | U06, U07, U08, U10, U12, U14 |
| `FW:Founding_Titan` | Titan / technologie | wiki communautaire, **non officiel** | https://attackontitan.fandom.com/wiki/Founding_Titan | U01, U02 |
| `FW:Frieda_Reiss` | personnage | wiki communautaire, **non officiel** | https://attackontitan.fandom.com/wiki/Frieda_Reiss | U04, U11 |
| `FW:Gabi_Braun` | personnage | wiki communautaire, **non officiel** | https://attackontitan.fandom.com/wiki/Gabi_Braun | U12 |
| `FW:Galliard_family` | famille / clan | wiki communautaire, **non officiel** | https://attackontitan.fandom.com/wiki/Galliard_family | U07, U12 |
| `FW:Garrison` | organisation | wiki communautaire, **non officiel** | https://attackontitan.fandom.com/wiki/Garrison | U03, U04, U05, U06, U09, U11 |
| `FW:Great_Titan_War_(Anime)` | **version anime** | wiki communautaire, **non officiel** | https://attackontitan.fandom.com/wiki/Great_Titan_War_(Anime) | U02, U07, U08 |
| `FW:Grisha_Yeager` | personnage | wiki communautaire, **non officiel** | https://attackontitan.fandom.com/wiki/Grisha_Yeager | U11 |
| `FW:Hange_Zoë` | personnage | wiki communautaire, **non officiel** | https://attackontitan.fandom.com/wiki/Hange_Zo%C3%AB | U05, U09, U11, U14 |
| `FW:Helos_(Anime)` | **version anime** | wiki communautaire, **non officiel** | https://attackontitan.fandom.com/wiki/Helos_(Anime) | U02, U07, U08 |
| `FW:Historia_Reiss` | personnage | wiki communautaire, **non officiel** | https://attackontitan.fandom.com/wiki/Historia_Reiss | U11 |
| `FW:Hizuru` | lieu / État | wiki communautaire, **non officiel** | https://attackontitan.fandom.com/wiki/Hizuru | U04, U06, U07, U08, U10, U11 |
| `FW:Iceburst_stone` | Titan / technologie | wiki communautaire, **non officiel** | https://attackontitan.fandom.com/wiki/Iceburst_stone | U03, U04, U06 |
| `FW:Jean_Kirstein` | personnage | wiki communautaire, **non officiel** | https://attackontitan.fandom.com/wiki/Jean_Kirstein | U04, U05, U11 |
| `FW:Karl_Fritz` | personnage | wiki communautaire, **non officiel** | https://attackontitan.fandom.com/wiki/Karl_Fritz | U01, U02, U03, U04 |
| `FW:Keith_Shadis` | personnage | wiki communautaire, **non officiel** | https://attackontitan.fandom.com/wiki/Keith_Shadis | U04, U05, U09, U11 |
| `FW:Kenny_Ackerman` | personnage | wiki communautaire, **non officiel** | https://attackontitan.fandom.com/wiki/Kenny_Ackerman | U04, U09, U11, U14 |
| `FW:Kiyomi_Azumabito` | personnage | wiki communautaire, **non officiel** | https://attackontitan.fandom.com/wiki/Kiyomi_Azumabito | U07, U08, U10, U12, U14 |
| `FW:Lara_Tybur` | personnage | wiki communautaire, **non officiel** | https://attackontitan.fandom.com/wiki/Lara_Tybur | U12, U14 |
| `FW:Levi_Ackerman` | personnage | wiki communautaire, **non officiel** | https://attackontitan.fandom.com/wiki/Levi_Ackerman | U05, U11 |
| `FW:Liberio` | lieu / État | wiki communautaire, **non officiel** | https://attackontitan.fandom.com/wiki/Liberio | U03, U07 |
| `FW:Marley` | lieu / État | wiki communautaire, **non officiel** | https://attackontitan.fandom.com/wiki/Marley | U02, U06, U07 |
| `FW:Marley_arc` | arc / bataille / événement | wiki communautaire, **non officiel** | https://attackontitan.fandom.com/wiki/Marley_arc | U06, U07, U08, U10, U12, U14 |
| `FW:Marley_Mid-East_War` | arc / bataille / événement | wiki communautaire, **non officiel** | https://attackontitan.fandom.com/wiki/Marley_Mid-East_War | U06, U07, U08, U10, U12, U14 |
| `FW:Mid-East_Allied_Forces` | organisation | wiki communautaire, **non officiel** | https://attackontitan.fandom.com/wiki/Mid-East_Allied_Forces | U06, U07, U10 |
| `FW:Mike_Zacharias` | personnage | wiki communautaire, **non officiel** | https://attackontitan.fandom.com/wiki/Mike_Zacharias | U11 |
| `FW:Military_Police_Brigade` | organisation | wiki communautaire, **non officiel** | https://attackontitan.fandom.com/wiki/Military_Police_Brigade | U04, U05, U06, U09, U11 |
| `FW:Mitras` | lieu / État | wiki communautaire, **non officiel** | https://attackontitan.fandom.com/wiki/Mitras | U03, U04 |
| `FW:Moblit_Berner` | personnage | wiki communautaire, **non officiel** | https://attackontitan.fandom.com/wiki/Moblit_Berner | U11, U12, U14 |
| `FW:Nile_Dok` | personnage | wiki communautaire, **non officiel** | https://attackontitan.fandom.com/wiki/Nile_Dok | U04, U05, U09, U11 |
| `FW:Nine_Titans` | Titan / technologie | wiki communautaire, **non officiel** | https://attackontitan.fandom.com/wiki/Nine_Titans | U01, U02 |
| `FW:Onyankopon` | personnage | wiki communautaire, **non officiel** | https://attackontitan.fandom.com/wiki/Onyankopon | U07, U08, U10, U12, U14 |
| `FW:Paradis_Island` | lieu / État | wiki communautaire, **non officiel** | https://attackontitan.fandom.com/wiki/Paradis_Island | U02, U03, U04, U05 |
| `FW:Paradis_Island_Operation` | arc / bataille / événement | wiki communautaire, **non officiel** | https://attackontitan.fandom.com/wiki/Paradis_Island_Operation | U02, U03, U04, U06, U07, U08, U09, U10, U12 |
| `FW:Pieck_Finger` | personnage | wiki communautaire, **non officiel** | https://attackontitan.fandom.com/wiki/Pieck_Finger | U12 |
| `FW:Porco_Galliard` | personnage | wiki communautaire, **non officiel** | https://attackontitan.fandom.com/wiki/Porco_Galliard | U12, U14 |
| `FW:Prologue_arc` | arc / bataille / événement | wiki communautaire, **non officiel** | https://attackontitan.fandom.com/wiki/Prologue_arc | U09, U11 |
| `FW:Ragako` | lieu / État | wiki communautaire, **non officiel** | https://attackontitan.fandom.com/wiki/Ragako | U03 |
| `FW:Raid_on_Liberio` | arc / bataille / événement | wiki communautaire, **non officiel** | https://attackontitan.fandom.com/wiki/Raid_on_Liberio | U06, U07, U08, U10, U11, U12, U14 |
| `FW:Reiner_Braun` | personnage | wiki communautaire, **non officiel** | https://attackontitan.fandom.com/wiki/Reiner_Braun | U12, U14 |
| `FW:Return_to_Shiganshina_arc` | arc / bataille / événement | wiki communautaire, **non officiel** | https://attackontitan.fandom.com/wiki/Return_to_Shiganshina_arc | U03, U05, U06, U08, U09, U10 |
| `FW:Rod_Reiss` | personnage | wiki communautaire, **non officiel** | https://attackontitan.fandom.com/wiki/Rod_Reiss | U04, U09, U11, U14 |
| `FW:Royal_Government` | organisation | wiki communautaire, **non officiel** | https://attackontitan.fandom.com/wiki/Royal_Government | U04, U05, U10 |
| `FW:Royal_Government_arc` | arc / bataille / événement | wiki communautaire, **non officiel** | https://attackontitan.fandom.com/wiki/Royal_Government_arc | U03, U04, U06, U08, U09, U11, U14 |
| `FW:Rumbling` | arc / bataille / événement | wiki communautaire, **non officiel** | https://attackontitan.fandom.com/wiki/Rumbling | U06, U07, U08, U10, U11, U14 |
| `FW:Sasha_Blouse` | personnage | wiki communautaire, **non officiel** | https://attackontitan.fandom.com/wiki/Sasha_Blouse | U05, U10, U11, U14 |
| `FW:Shiganshina_District` | lieu / État | wiki communautaire, **non officiel** | https://attackontitan.fandom.com/wiki/Shiganshina_District | U03 |
| `FW:Signal_flare` | Titan / technologie | wiki communautaire, **non officiel** | https://attackontitan.fandom.com/wiki/Signal_flare | U05, U06, U09 |
| `FW:Stohess_District` | lieu / État | wiki communautaire, **non officiel** | https://attackontitan.fandom.com/wiki/Stohess_District | U03, U04 |
| `FW:Story_Arcs` | liste des arcs | wiki communautaire, **non officiel** | https://attackontitan.fandom.com/wiki/Story_Arcs | U15 |
| `FW:Survey_Corps` | organisation | wiki communautaire, **non officiel** | https://attackontitan.fandom.com/wiki/Survey_Corps | U03, U04, U05, U06, U09, U10, U11 |
| `FW:The_Female_Titan_arc` | arc / bataille / événement | wiki communautaire, **non officiel** | https://attackontitan.fandom.com/wiki/The_Female_Titan_arc | U03, U09, U11, U14 |
| `FW:Theo_Magath` | personnage | wiki communautaire, **non officiel** | https://attackontitan.fandom.com/wiki/Theo_Magath | U07, U10, U12 |
| `FW:Thunder_Spear` | Titan / technologie | wiki communautaire, **non officiel** | https://attackontitan.fandom.com/wiki/Thunder_Spear | U06, U11, U14 |
| `FW:Timeline` | chronologie | wiki communautaire, **non officiel** | https://attackontitan.fandom.com/wiki/Timeline | U01, U02, U03, U04, U05, U06, U08, U09, U10, U11, U12, U14 |
| `FW:Titan` | Titan / technologie | wiki communautaire, **non officiel** | https://attackontitan.fandom.com/wiki/Titan | U01 |
| `FW:Titan_Biology_Research_Society` | organisation | wiki communautaire, **non officiel** | https://attackontitan.fandom.com/wiki/Titan_Biology_Research_Society | U02, U03, U06, U07 |
| `FW:Tom_Ksaver` | personnage | wiki communautaire, **non officiel** | https://attackontitan.fandom.com/wiki/Tom_Ksaver | U12 |
| `FW:Training_Corps` | organisation | wiki communautaire, **non officiel** | https://attackontitan.fandom.com/wiki/Training_Corps | U03, U05, U08, U09, U11 |
| `FW:Trost_District` | lieu / État | wiki communautaire, **non officiel** | https://attackontitan.fandom.com/wiki/Trost_District | U03, U04 |
| `FW:Tybur_family` | famille / clan | wiki communautaire, **non officiel** | https://attackontitan.fandom.com/wiki/Tybur_family | U01, U02, U07, U08, U12 |
| `FW:Underground_(Anime)` | **version anime** | wiki communautaire, **non officiel** | https://attackontitan.fandom.com/wiki/Underground_(Anime) | U03, U04 |
| `FW:Underground_City_arc` | arc / bataille / événement | wiki communautaire, **non officiel** | https://attackontitan.fandom.com/wiki/Underground_City_arc | U03, U04 |
| `FW:Uri_Reiss` | personnage | wiki communautaire, **non officiel** | https://attackontitan.fandom.com/wiki/Uri_Reiss | U04, U11 |
| `FW:Utgard_Castle` | lieu / État | wiki communautaire, **non officiel** | https://attackontitan.fandom.com/wiki/Utgard_Castle | U03, U14 |
| `FW:Vertical_maneuvering_equipment` | Titan / technologie | wiki communautaire, **non officiel** | https://attackontitan.fandom.com/wiki/Vertical_maneuvering_equipment | U05, U06, U09 |
| `FW:Wall_Rose_invasion` | arc / bataille / événement | wiki communautaire, **non officiel** | https://attackontitan.fandom.com/wiki/Wall_Rose_invasion | U04, U06, U08, U09, U11, U14 |
| `FW:Walls` | lieu / État | wiki communautaire, **non officiel** | https://attackontitan.fandom.com/wiki/Walls | U02, U03, U04, U06, U09, U11 |
| `FW:War_for_Paradis_arc` | arc / bataille / événement | wiki communautaire, **non officiel** | https://attackontitan.fandom.com/wiki/War_for_Paradis_arc | U07, U08, U10, U11, U12, U14 |
| `FW:Warrior_Unit` | organisation | wiki communautaire, **non officiel** | https://attackontitan.fandom.com/wiki/Warrior_Unit | U02, U07, U08, U12, U14 |
| `FW:Willy_Tybur` | personnage | wiki communautaire, **non officiel** | https://attackontitan.fandom.com/wiki/Willy_Tybur | U07, U08, U12 |
| `FW:Yeagerists` | organisation | wiki communautaire, **non officiel** | https://attackontitan.fandom.com/wiki/Yeagerists | U04, U05, U07, U08, U10, U11 |
| `FW:Yelena` | personnage | wiki communautaire, **non officiel** | https://attackontitan.fandom.com/wiki/Yelena | U07, U08, U10, U12, U14 |
| `FW:Ymir` | personnage | wiki communautaire, **non officiel** | https://attackontitan.fandom.com/wiki/Ymir | U11, U12 |
| `FW:Ymir_Fritz_(Anime)` | **version anime** | wiki communautaire, **non officiel** | https://attackontitan.fandom.com/wiki/Ymir_Fritz_(Anime) | U02, U08, U12 |
| `FW:Zeke_Yeager` | personnage | wiki communautaire, **non officiel** | https://attackontitan.fandom.com/wiki/Zeke_Yeager | U10, U12, U14 |
| `WP:AoT` | Attack on Titan (Wikipédia) | encyclopédie collaborative, **non officielle** | https://en.wikipedia.org/wiki/Attack_on_Titan | U01, U04, U08, U09, U10 |
| `WP:Chars` | Liste des personnages (Wikipédia) | encyclopédie collaborative, **non officielle** | https://en.wikipedia.org/wiki/List_of_Attack_on_Titan_characters | U11, U12, U14 |
| `WP:S1` | Attack on Titan, saison 1 (Wikipédia, version anime) | encyclopédie collaborative, **non officielle** | https://en.wikipedia.org/wiki/Attack_on_Titan_season_1 | U03, U04, U08, U09, U11, U14 |
| `WP:S3` | Attack on Titan, saison 3 (Wikipédia, version anime) | encyclopédie collaborative, **non officielle** | https://en.wikipedia.org/wiki/Attack_on_Titan_season_3 | U04, U08, U09, U10, U11 |

### 1.3 Documents du dépôt (non web)

| Code | Document | Rôle dans le dossier |
|---|---|---|
| `01`, `D01` | `docs/spec/01_LORE_MONDE_CANON.md` | lore du projet ; **11 prime sur 01** (`CLAUDE.md`) |
| `11`, `D11` | `docs/spec/11_AUDIT_LORE_ET_CORRECTIONS.md` | audit de lore ; faits canon `C` du projet ; point de comparaison des écarts |
| `12`, `D12` | `docs/spec/12_EVENEMENTS_CANON.md` | les 60 événements `E01`–`E60` du projet |
| `D06` | `docs/spec/06_ATLAS_LIEUX.md` | atlas des lieux du projet |
| `26` | `docs/spec/26_MECANIQUES_THEORIQUES.md` | sept piliers de mécaniques (cités dans `U14` §4 et §6) |
| `27` | `docs/spec/27_MULTIJOUEUR_9_JOUEURS.md` | multijoueur coopératif, « époque charnière » (`U14` T-7) |
| `V4-Dnn` | `docs/v4/04_REGISTRE_DES_DECISIONS.md` | décisions de la refonte V4 |
| `docs/lore/creations.md` | créations du projet (`canon: "A"`) | ne se mélangent jamais aux `[C]` du dossier |

Ces documents sont **ceux du projet**, pas des sources de l'œuvre : un accord entre le dossier et `11` renforce la cohérence interne mais ne prouve rien sur l'œuvre.

---

## 2. Pages qui n'ont pas pu être lues

Chaque page ci-dessous a été demandée à l'outil de lecture et n'a pas été renvoyée (erreur du service ou refus), sans qu'aucun contournement soit tenté. Les deux pages de Bertolt et de Marcel ont chacune été demandées deux fois (avec deux orthographes pour Bertolt).

| Page | Ce qui manque | Où le dossier le signale | Ce qui en tient lieu |
|---|---|---|---|
| `Paths` (Chemins), et sa version anime | mécanisme, règles et fonction des Chemins | U01 §12 ; U08 §11 ; U10 §10 | pages d'arcs et de personnages (U10 §6) |
| `Cult_of_the_Walls`, et sa version anime | hiérarchie du clergé, rites, dogmes, rôle politique exact | U03 (en-tête, sources) ; U04 (en-tête, sources) et §5 | `FW:Walls`, `FW:Underground_City_arc` |
| `Underground_City` (manga) | plan, population, entrées, gouvernance de la ville souterraine | U03 §8 pt 6 | page de la version anime (`FW:Underground_(Anime)`) |
| `Great_Titan_War` (manga) | dates, durée, belligérants, nombre de batailles | U02 §4 | reconstitution à partir de cinq pages + version anime (U02 §4.5) |
| `Ymir_Fritz` (manga) | vie et rôle exact d'Ymir dans la version manga | U01 §12 pt 2 ; U12 §6 | version anime + Timeline (écart signalé U12 §6) |
| `Public_Security_Authority` | organisation de la police de sécurité de Marley | U06 §11 pt 8 ; U07 §13 pt 10 | mentions dans les pages de personnages |
| `Locations` | liste de lieux de l'univers | U07 §13 pt 10 ; U08 §11 pt 9 | pages de lieux individuelles (U03) |
| `Anti-Titan_rifle` | caractéristiques des fusils anti-Titan de Marley | U06 §11 pt 8 | D11 §6 seulement |
| `Panzer_Unit` | corps blindé de Marley | U06 §11 pt 8 ; U07 §13 pt 10 | mentions de la guerre du Moyen-Orient |
| `Eldian_armband` | règles et couleurs des brassards éldiens | U06 §11 pt 8 ; U07 §13 pt 10 | mentions dans les pages de Marley |
| `Eren_Yeager`, `Mikasa_Ackerman` | fiches personnelles | U11 §1 | pages d'arcs, de familles et de bataille |
| `Bertolt_Hoover` / `Bertholdt_Hoover`, `Marcel_Galliard` | fiches personnelles | U12 §1 | `FW:Reiner_Braun`, `FW:Galliard_family`, pages d'événements |
| `Wall_Sealing_arc` ; `Category:Arcs` | résumé de l'arc ; liste des arcs | (non employées par un fichier thématique) | `FW:Story_Arcs` et pages d'arcs individuelles |

**Aucune de ces absences n'est comblée par une invention.** Chaque fois qu'un fait dépendrait d'une page manquante, le fichier concerné écrit `[?]` ou « non couvert ».

---

## 3. Registre consolidé des contradictions

Lecture : « Versions » donne ce que chaque source dit ; « Où » renvoie à la section du dossier qui détaille ; « Traitement » dit ce que le dossier a fait. Le dossier **ne tranche pas** une contradiction entre deux sources quand rien ne permet de trancher : il l'écrit `[?]`. Les calculs de la direction (`[I]`) sont signalés comme tels. `K-nn` renvoie à `U14` §2.

### 3.1 Dates et durées

| ID | Sujet | Versions en présence | Où | Traitement |
|---|---|---|---|---|
| X-01 | Âge de la lignée d'Ymir | « ≈ 2 000 ans » (`FW:Eldia`, titre de l'ép. 1 dans `WP:S1`) ; 1003 av. l'an 1 (`FW:Timeline`) ; « plus de 1 820 ans » (`FW:Ymir_Fritz_(Anime)`) | U02 §9 #1 ; U08 §1 | `[?]` paramétrable ; 1003 + 854 = 1 857 `[I]`, compatible avec les trois |
| X-02 | Début de l'ère des Murs (c. 743) | `FW:Timeline` ; trois pages concordent ; D11 §9 pt 3 le garde en `[?]` | U02 §9 #4 ; U08 §1 ; K-14 | `[C]` pour la date rapportée ; 743 + 107 = 850 `[I]` |
| X-03 | Éloignement de la Grande Guerre des Titans | 80 ans (père de Grisha, anime), 100 ans, 107 ans, 1 700 ans (`FW:Eldia`) | U02 §4, §9 #3 ; U08 §11 #5 | `[I]` : périodes différentes (U02 §4.3) ; 80 ou 107 : `[?]` non réconcilié |
| X-04 | Sélection des cinq Guerriers, héritage des Titans, conquête de la nation du sud | 843 (`FW:Timeline` ; D11 §4 pour la Mâchoire ; « c. 843 » `FW:Reiner_Braun`, `FW:Porco_Galliard`) ; 844 (`FW:Warrior_Unit`) ; 833-845 pour la conquête | U02 §9 #7 ; U07 §13 #5-6 ; U08 §11 #1 ; U12 §7 #1 ; K-10 | `[?]` : deux années gardées, paramètre de données |
| X-05 | Six ou sept Titans / Guerriers | « seulement six Guerriers » (`FW:Warrior_Unit`) ; « sept Titans » (`FW:Paradis_Island_Operation`, `FW:Nine_Titans`) ; « six de plus » (`FW:Timeline`) | U02 §9 #2, #8 ; U07 §13 #4 ; U12 §7 #2 ; K-15 | `[I]` 6 Titans en service + Marteau de guerre (Tybur) = 7 |
| X-06 | Bilan de l'opération de 846 | environ 20 % de la population (manga / `FW:Timeline`) ; environ 250 000 réfugiés (anime, `WP:S1`) | U04 §8 #3 ; U08 §11 #2 ; U09 §10 #1 ; K-04 | `[?]` non réconciliables ; D12 E06 écrit « ≈ 250 000 `?` » |
| X-07 | Début de la guerre du Moyen-Orient | 850 (`FW:Timeline`) ; 851 (D12 E50) ; « ≈ 850-854 » (D11) ; le nom de la guerre est donné par les fans | U07 §13 #3 ; U08 §11 #3 ; K-01 | `[C]` 850-854 pour le Timeline ; correction proposée dans `U14` |
| X-08 | Date de la bataille de Fort Slava | « c. 849 » (inféré à partir de la page de Magath) ; 854 (`FW:Fort_Slava`) | U07 §13 #3 ; U08 §11 #3 ; U12 §7 #6 | `[?]` ; 854 retenu comme date de la page de la bataille |
| X-09 | Visite d'Hizuru à Paradis | 852 (`FW:Timeline`) ; « 851-852 ? » (D12 E48) | U08 §11 #4 ; K-02 | `[C]` 852 ; écart D12 noté |
| X-10 | Chemin de fer de Paradis | 853 (`FW:Timeline`) ; 851-852 (D12) ; ≈ 852-853, « source secondaire » (D11) | U08 §11 #4 ; K-02 | `[?]` |
| X-11 | Bateau volant (pierre à éclatement) | 852-853 (`FW:Flying_boat`) ; ≈ 854 (D11) | U06 §11 #5 | `[?]` |
| X-12 | Date du raid sur Liberio | aucune date explicite ; Ch. 91 « quatre ans » après Shiganshina ; Ch. 104 « 9 ans avant » | U10 §6 et §10 #1 ; U08 §11 #7 | `[I]` 854 par calcul (850 + 4 ; 845 + 9) |
| X-13 | Durée du Grondement | « jours 1 à 4 » (`FW:Timeline`) ; estimation de Hange « quatre jours au plus » (estimation d'un personnage) ; durée totale non indiquée | U08 §7 et §11 #8 ; K-13 | `[?]` |
| X-14 | Mois et jours | aucun calendrier dans les pages (hors naissances du Timeline) ; D12 : mois toujours `?` | U08 §11 #6 ; U09 §10 #10 | ordre relatif seulement |
| X-15 | Transformation de Pixis en Titan | page contradictoire selon l'endroit (`FW:Dot_Pixis`) ; D11 §3 | U04 §8 #5 ; U11 §5 #5 | `[?]` |
| X-16 | Disparition des 32 navires d'éclaireurs | « trois ans » selon Magath ; fourchette 851-854 | U08 T-078 | `[I]` fourchette déduite |

### 3.2 Monde, société, pouvoir

| ID | Sujet | Versions en présence | Où | Traitement |
|---|---|---|---|---|
| X-17 | Fausse alerte de 850 | par Pixis (test) ou par Anka ; l'anime la place à Karanes | U04 §8 #2 ; U03 §3.4 | `[?]` |
| X-18 | Titre de Zackly | « commandant en chef » (fiche) ; « Premier ministre » / « Premier Zachary » (page Eldia) | U04 §8 #1 | `[?]` : « commandant en chef des trois corps » préféré |
| X-19 | Nom de la dynastie après les Murs | « Fritz » (façade) / « Reiss » (réel) ; la page Karl Fritz ne précise pas | U02 §9 #5 ; U04 §8 #4 | `[C]` pour la distinction (Ch. 89) ; `[?]` pour le détail |
| X-20 | Règne de 13 ans et vœu de ≈ 100 ans | `FW:Karl_Fritz` ne réconcilie pas | U02 §9 #6 | `[I]` vœu transmis de roi en roi (la page le dit) |
| X-21 | Rôle des Tybur avant la guerre | alliés secrets du roi (version retenue) ou rivaux | U02 §9 #10 | `[C]` version « alliés », `[?]` avant la guerre |
| X-22 | « Clan asiatique » et branche Azumabito | même groupe ou non | U02 §9 #9 ; U07 §13 #9 | `[?]` |
| X-23 | Origine du clan Ackerman | accident d'expériences éldiennes (récit de Zeke, `FW:Ackerman_clan`) ; sans rapport avec les Sujets d'Ymir (grand-père de Kenny) | U01 §8 ; U02 §3.4 | `[?]` contradiction rapportée par le wiki |
| X-24 | Père d'Eren Kruger | la page ne confirme pas que c'est l'organisateur de l'armée royaliste ; « Grice » / « Gross » : coquilles possibles | U02 §6 ; U07 §7 ; U12 §4 | `[?]` |
| X-25 | Yeagerists : « chef » et orthographe | aucune hiérarchie ; Yeagerists / Jaegerists | U04 §8 #6-7 | `[?]` ; **Yeagerists** (choix du projet) |
| X-26 | Murs : épaisseur, espacement, portes, ordre, nombre de Titans | rien dans les pages ; l'estimation 246 000 / 585 000 vient d'un livre de vulgarisation cité par `FW:Walls` (non canon) ; Fritz : « dizaines de millions » | U03 §2.2 et §8 #1-2 | `[?]` ; estimation signalée non canon |
| X-27 | Origine de la pierre à éclatement | caldeiras sous la ville-usine (page) ; dépôt par le Roi des Titans (Zeke) | U03 §8 #4 ; U06 §11 #1 | `[?]` deux récits |
| X-28 | Ville souterraine : plan, population, entrées | non donnés par la page anime ; page manga non lue | U03 §8 #6 | `[?]` |
| X-29 | Effondrement d'Utgard | qui abat la structure : Ymir ou Krista ; la « nuit » n'est pas affirmée ; état ultérieur de la tour non donné | U09 §10 #4 ; U03 §4 et §6 ; K-06 | `[?]` ; règle de jeu en `A` |
| X-30 | Lieu du camp d'entraînement, du QG du Corps, de la ville-usine | non donnés | U03 §8 #5 ; U09 §10 #2 | `[?]` |
| X-31 | Gouvernement de Marley et de Hizuru | aucun conseil, chef d'État, capitale ni système électoral dans les pages lues ; état final de Hizuru incertain | U07 §13 #1, #8 ; U10 §10 #10 | `[?]` |
| X-32 | « Alliance mondiale » | nom et composition non confirmés ; le Timeline écrit « Global Alliance » | U07 §13 #7 ; K-12 | terme de commodité, `[I]` |
| X-33 | Effectifs | aucun total pour Trost, Rose, Orvud ; population de l'île, de Marley : non donnée | U03 §8 #3 ; U09 §10 #9 | `[?]` |

### 3.3 Armée et technologie

| ID | Sujet | Versions en présence | Où | Traitement |
|---|---|---|---|---|
| X-34 | Nom de la Garnison | « Garde stationnaire » dans d'anciens fichiers du dépôt ; la page `FW:Garrison` ne l'emploie jamais | U05 §1 et §8 #1 | `[?]` ; « Garnison » (choix du projet) |
| X-35 | Chefs d'équipe | 8 chefs pour 10 équipes | U05 §8 #2 | `[?]` |
| X-36 | « 199 » | morts à Trost ou à Shiganshina | U05 §8 #3 ; U08 T-062 | `[?]` ; 199 morts sur 208 à Shiganshina est cohérent (208 − 199 = 9) |
| X-37 | Quotas de la Brigade militaire, grades, budget, quartiers généraux | « citation requise » ou absents | U05 §8 #4-7 | `[?]` |
| X-38 | Chevaux : nombre | 600 « réserves comprises » | U05 §8 #9 | `[?]` |
| X-39 | Tête de Reiner à Shiganshina | « moitié de la tête » / « de la mâchoire vers le haut » | U06 §11 #2 | `[?]` |
| X-40 | Dirigeables de Salta | « cinq » puis « deux restants » ; total inconnu | U06 §11 #3 | `[?]` |
| X-41 | Titan Cuirassé à Slava | « détruit » (page du fort) / « gravement endommagé » (page de la guerre) | U06 §11 #4 ; U10 §10 #5 | `[?]` |
| X-42 | Flotte de l'Alliance au Grondement | « détruite » (`FW:Timeline`) / « contournée » (`FW:Rumbling`) | U10 §10 #4 ; U08 §7 | `[?]` |
| X-43 | Capacité de la Lance de foudre | 8 comme norme ou maximum | U06 §11 #6 | `[?]` |
| X-44 | Chariots-canons | non confirmés (D11) | U06 §11 #7 | `[?]` |
| X-45 | Gaz, grappin, portée des Lances, production | aucune valeur dans les pages | U06 §11 #9 | toute valeur de jeu est `A` (`U14`) |
| X-46 | Trains blindés, chars, sous-marins, gaz | écart avec les données du projet | K-11 ; U14 §7 | proposition `A` |

### 3.4 Personnages et événements

| ID | Sujet | Versions en présence | Où | Traitement |
|---|---|---|---|---|
| X-47 | Genre de Hange | volontairement ouvert par l'auteur (`FW:Hange_Zoë`) | U11 §5 #4 ; `U14` Q-2 | non fixé ; décision demandée |
| X-48 | Âge de Levi | trois valeurs | U11 §5 #2 | `[?]` |
| X-49 | Parents d'Armin | exécutés pour tentative d'évasion ; morts en mission de récupération ; exécutés par la Première Brigade en 846 | U11 §5 #3 | `[?]` trois versions |
| X-50 | Moblit | survit ou meurt à l'explosion du Colossal selon l'endroit de la fiche | U11 §5 #6 ; K-08 | `[?]` |
| X-51 | Mike Zacharias | cinq Titans tués ou neuf combattus | U11 §5 #7 ; U08 T-055 | `[?]` |
| X-52 | Cause de la mort de Hannes | non tranchée | U11 §5 #8 ; K-07 | `[?]` |
| X-53 | Sort de Shadis et de Magath | « impliqué » (fiche) / « confirmé au port » (page de bataille) ; Magath : « non enregistrée » / « mort au port » | U11 §5 #9 ; U12 §7 #6 ; K-08 | `[?]` |
| X-54 | Floch | « recrue de l'escouade Klaus, survivante de Shiganshina » ; « ancien cadet de la 104ᵉ » (`WP:Chars`) ; mort à Odiha ou listé à Fort Salta | U10 §10 #6 ; U11 §5 #11 | `[?]` |
| X-55 | Eren « transféré à la Police militaire » (Ch. 30) | douteux | U09 §10 #3 | `[?]` |
| X-56 | Reiner battu par le Titan Bestial | lieu et circonstances absents ; résumé d'épisode anime | U09 §10 #5 ; U08 T-065 | `[?]` |
| X-57 | Hange à Shiganshina | « manque de mourir » / « escouade anéantie » | U09 §10 #7 | `[?]` |
| X-58 | Taille du Titan de Rod Reiss | 120 m (`FW:Timeline`) ; 40 m au garrot | U09 §10 #6 ; K-05 | `[?]` |
| X-59 | Noms des Titans capturés | Sonny et Bean (manga) / Sawney et Beane (anime) | U09 §10 #8 | `[C]` les deux, selon la version |
| X-60 | Marco | « tué » par Reiner ; équipement pris par Annie puis dévoré ; « laissé à moitié dévoré » (`WP:Chars`) | U12 §7 #3 | `[?]` trois formulations |
| X-61 | Marcel et Porco | Porco « mort au Chemin avec Marcel » alors que Marcel est dévoré en 845 ; Marcel a « trompé Reiner » ou « nui à la réputation de Porco » | U12 §7 #4 ; §1 | `[?]` |
| X-62 | Succession de la Mâchoire | Marcel → Ymir → Porco → Falco : dates absentes | U12 §7 #5 ; K-09 | `[?]` |
| X-63 | Zeke : naissance et puissance | naissance inférée ; « le plus puissant » (Ch. 70) / 7/10 (guide) | U12 §7 #7 | `[?]` |
| X-64 | Karina Braun, père de Reiner | seule la page de Reiner les mentionne | U12 §7 #9 | `[?]` |
| X-65 | « Reiner is killed » (850) | `FW:Timeline` contredit la fiche de Reiner | U12 §7 #10 | `[?]` Timeline écarté |
| X-66 | Zeke « secouru par Ymir » (854) | `FW:Timeline` ; la page de l'arc ne confirme pas ; identité du Titan sauveur non donnée | U12 §7 #10 ; U10 §10 #3 | `[?]` |
| X-67 | Zeke et le début de la guerre | « quatre ans passent ; la guerre commence (Ch. 91) » vs guerre 850-854 | U12 §7 #11 | lecture `[I]` : « quatre ans après Shiganshina » |
| X-68 | Gabi et Eren | « tire mortellement » (fiche) ; « lui tire la tête » (Timeline) ; Eren continue le récit | U12 §7 #12 | aucune formulation reprise comme fait |
| X-69 | Zeke après Liberio | mort ou non ; soigné par un Titan non identifié | U10 §10 #3 | `[?]` |
| X-70 | Pertes du Corps lors de l'opération de Liberio | « six pertes » seulement ; Sasha « dernière victime » de l'opération | U10 §4 et §10 #2 | `[?]` chiffres non réconciliés par la page |
| X-71 | Mikasa et le Marteau de guerre | détail de l'héritage de Lara par Eren non confirmé | U10 §10 #8 | `[?]` |
| X-72 | Survivants du Grondement | aucune liste | U10 §10 #9 | `[?]` |
| X-73 | Naissances | seules celles du Timeline sont données (U08 §3) ; aucune pour Levi, Erwin, Hange, Kenny, Pieck, Porco, Jean, Connie, Sasha, Bertolt | U11 §5 #10 ; U08 §3 | `[?]` |
| X-74 | Eren et la Mâchoire à Liberio | la page de Lara écrit qu'Eren « utilise le Titan Mâchoire » alors que Porco, son porteur, est vivant et sera arraché de la mêlée par Reiner ; le mécanisme n'est pas expliqué | U12 §3 (Lara) et §1 (Porco) ; U10 §6 | `[?]` |

**Compte.** 74 contradictions ou absences consignées. Aucune n'est résolue par invention : celles qui coûtent le plus au jeu sont reprises dans `U14` (K-01 à K-18) et priorisées au §6.

---

## 4. Les trois listes maîtresses

Ces listes résument tout le dossier. Les références `T-nnn` sont celles de `U08` ; les autres renvois, aux fichiers du dossier.

### 4.1 Affirmations sourcées (`[C]`)

*Rapportées par une page de wiki ou de Wikipédia, telle que l'extrait la restitue ; non relues dans l'œuvre.*

1. Les trois Murs (Maria, Rose, Sina) sont faits de Titans colossaux dormants (`FW:Walls` ; U03 §2.2).
2. La « Malédiction d'Ymir » limite à 13 ans la vie de chaque héritier d'un des Neuf Titans (`FW:Timeline`, T-004).
3. Ymir, esclave éldienne, obtient le Titan Fondateur et meurt en 990 av. l'an 1 ; ses trois filles sont nommées Maria, Rose et Sheena (`FW:Timeline`, T-001 à T-003).
4. Karl Fritz déplace la famille royale à Paradis et menace d'« aplatir la Terre » avec les Titans colossaux ; Marley garde l'essentiel du monde (`FW:Timeline`, T-008, T-009).
5. Les Ackerman et un clan « asiatique » conservent la mémoire que le Fondateur efface chez les autres (`FW:Timeline`, `FW:Ackerman_clan`, T-010).
6. Eren Kruger hérite de l'Assaillant en 819 ; Grisha le dévore en 832 ; Eren, enfant, le reçoit en 845 (`FW:Timeline`, T-024, T-030, T-042).
7. En 845, quatre Guerriers lancent l'Opération sur l'île de Paradis : la porte sud de Shiganshina est brisée, puis la porte nord ; Wall Maria tombe ; Marcel est dévoré ; Carla Yeager est dévorée (T-040, T-041).
8. En 850, une brèche de 8 m s'ouvre dans la porte sud de Trost ; première transformation d'Eren (T-051).
9. La bataille de Shiganshina de 850 : 208 départs, 100 entrent, 199 morts, 9 survivants ; Erwin meurt ; Armin hérite du Colossal (T-062).
10. Les Lances de foudre et le Bourreau de l'enfer sont mis au point en 850, en « moins de deux mois » selon le Timeline (T-061).
11. Rod Reiss est tué par Historia, couronnée reine des Murs (T-060).
12. Fort Slava (854) : 800 Éldiens sous Magath ; train blindé déraillé ; fort annexé après un traité (T-080).
13. Le festival de Liberio : Willy Tybur est tué par Eren ; Lara (Marteau de guerre) est vaincue (T-082).
14. Le Grondement commence en 854 ; la bataille du Ciel et de la Terre y met fin ; le pouvoir des Titans disparaît (T-085 à T-087).
15. Le manga de Hajime Isayama est publié de septembre 2009 à avril 2021, en 34 volumes (`WP:AoT` ; U08 §10).
16. Paradis a trois corps militaires (Corps d'exploration, Garnison, Brigade militaire) sous un commandant en chef ; le Corps d'entraînement forme les recrues (U05 §1).
17. Marley est une puissance qui interne les Éldiens ; les Guerriers sont formés dès les années 830 pour prendre Paradis (T-029, U07).
18. Une alliance entre Eldia et Hizuru est datée (c.) du VIIIᵉ siècle ; en 853, Hizuru refuse d'aider Paradis à commercer avec d'autres nations (T-007, T-077).
19. Après Liberio, une alliance militaire mondiale se forme (« dans six mois », selon la page) (T-083).
20. Paradis est contrôlée en 857 par les Yeagerists ; l'Alliance envoie des ambassadeurs (T-090).
21. Des dates de naissance précises sont données par le Timeline pour 15 personnages (U08 §3).
22. Morts de personnages principaux rapportées par les pages d'événements : Sasha à Liberio (T-082), Zackly dans l'explosion des Yeagerists (T-084), Hange à Odiha pendant le Grondement (T-086), Erwin à Shiganshina (T-062).

### 4.2 Affirmations interprétatives (`[I]`)

*Calculs, rapprochements ou lectures de la direction, avec leur justification.*

1. **Chaîne des 13 ans** : 816 → 829 → 842 (lignée royale) ; 819 → 832 → 845 (Assaillant) ; 829 → 842 (Bestial) ; 1003 → 990 av. l'an 1 (Ymir) : toutes cohérentes (U08 §9).
2. **743 + 107 = 850** : les 107 ans de la version anime entre la fin de la guerre et la découverte du sous-sol concordent avec la date de 743 (U02 §4, U08 §1).
3. **Âge d'Ymir** : 1003 + 854 = 1 857 ans, compatible avec « plus de 1 820 ans » et « ≈ 2 000 ans » (U08 §1).
4. **Épidémie et Lago/Monte/Valle** : 854 − 240 ≈ 614 ≈ « 600 ans » ; 854 + 370 ≈ 1 224 ≈ « 1 200 ans » (U08 §9).
5. **Règnes éldiens** : 1 733 ans ÷ 145 rois ≈ 12 ans par règne (U08 §9).
6. **Six Titans en service + Marteau de guerre = sept** (U02 §9 #2, U12 §7 #2).
7. **« Il y a un siècle » et « 1 700 ans »** désignent des périodes différentes (U02 §4.3).
8. **Liberio en 854** : Ch. 91 (« quatre ans » après Shiganshina) et Ch. 104 (845 + 9) concordent (U10 §6).
9. **La guerre « quatre ans plus tard »** de la fiche de Zeke se lit comme « quatre ans après Shiganshina » (U12 §7 #11).
10. **Le vœu de renonciation** est transmis de roi en roi, ce qui réconcilie un règne de 13 ans et un vœu de ≈ 100 ans (U02 §9 #6).
11. **Les dates de publication** des chapitres entre parenthèses dans `FW:War_for_Paradis_arc` ne sont pas des dates de l'univers (U10 en-tête ; U08 §10).
12. **Le terme « alliance mondiale »** est une commodité du dossier, non un nom confirmé (U07 §13 #7).
13. **Yeagerists** plutôt que Jaegerists : choix d'orthographe du projet, non du wiki (U04 §8 #7).
14. **Fourchette 851-854** pour la disparition des 32 navires d'éclaireurs : déduite de la première interception et de la guerre (T-078).
15. **Corps d'exploration ≈ 300** : somme calculée par la direction à partir des effectifs listés (U08 §9).

### 4.3 Éléments non confirmés (`[?]`)

*Contradictoires, absents ou douteux ; le dossier ne tranche pas.* Détail au §3.

1. L'année du choix des Guerriers et des héritages : 843 ou 844 (X-04).
2. Six ou sept Titans (X-05).
3. Le bilan de 846 : 20 % ou 250 000 (X-06).
4. Le début de la guerre du Moyen-Orient : 850 ou 851 (X-07) et la date de Slava : 849 ou 854 (X-08).
5. Les dates de la visite d'Hizuru, du chemin de fer et du bateau volant (X-09 à X-11).
6. La date de la transformation de Pixis et la fausse alerte de 850 (X-15, X-17).
7. L'origine du clan Ackerman et le groupe « asiatique » (X-22, X-23).
8. L'origine de la pierre à éclatement de glace (X-27).
9. L'épaisseur, l'espacement, l'ordre et le nombre de Titans des Murs (X-26).
10. L'effondrement d'Utgard (X-29).
11. La taille du Titan de Rod Reiss (X-58).
12. Le sort de Shadis, de Magath, de Floch, de Moblit, de Hannes (X-50 à X-54).
13. Les parents d'Armin et l'âge de Levi (X-48, X-49).
14. Les Chemins (page non lue) et tout ce qui dépend d'eux (§2).
15. La fin de Zeke après Liberio et le Titan qui le sauve (X-66, X-69).
16. Le sort de la flotte de l'Alliance et du Cuirassé à Slava (X-41, X-42).
17. Les survivants du Grondement et l'état final de Hizuru (X-31, X-72).
18. Le gouvernement, l'armée et l'organisation de Marley (X-31).
19. Les mois, jours et durées (X-13, X-14).
20. Le genre de Hange, laissé ouvert par l'auteur (X-47).

---

## 5. Lacunes : ce qu'aucune source lue n'indique

Le dossier **ne donne aucune valeur** pour ces sujets ; `U14` §9 les range en `A` (choix de conception) pour le jeu.

| Domaine | Ce qui manque |
|---|---|
| Démographie | population de l'île de Paradis, des districts, de Marley, des autres nations ; superficie de l'île |
| Géographie | distances entre lieux, épaisseur et espacement des Murs, nombre et emplacement des portes, trois districts de Maria non nommés |
| Économie | production, commerce, budget militaire, monnaie, prix |
| Institutions | hiérarchie de l'Église des Murs, grades des trois corps, quotas de la Brigade, gouvernement de Marley et de Hizuru |
| Armée de Marley | organisation, effectifs, aviation, blindés, chemin de fer (hors mentions de bataille) |
| Technologie | consommation de gaz, portée du grappin, portée et capacité des Lances, cadence de production |
| Titans | déclencheur de transformation, taille des anormaux, porteurs antérieurs de six Titans sur neuf, mécanisme exact du retour à l'humain, statut du « Doomsday Titan » |
| Temps | calendrier interne, mois, durée du Grondement |
| Personnages | dates de naissance hors Timeline, grades, familles étendues |

---

## 6. Points à vérifier en priorité dans l'œuvre

Si Gabriel veut verrouiller des `C` avant de les écrire dans `data/`, voici les douze points qui coûtent le plus cher en cas d'erreur, par ordre d'impact sur le jeu (références : §3).

| Rang | Point | Pourquoi |
|---|---|---|
| 1 | Année des héritages des Guerriers (X-04) | conditionne l'ancienneté des porteurs et les fenêtres de présence (K-10) |
| 2 | Début de la guerre du Moyen-Orient et date de Slava (X-07, X-08) | fixe le scénario 854 et l'événement `evt_854_fort_slava` (K-01) |
| 3 | Bilan de 846 (X-06) | change la démographie de départ des scénarios (K-04) |
| 4 | Six ou sept Titans (X-05) | change le nombre de porteurs jouables (K-15) |
| 5 | Dates d'Hizuru, du chemin de fer, du bateau volant (X-09 à X-11) | fixe les déblocages techniques (K-02, TE-1 à TE-5) |
| 6 | Origine du clan Ackerman (X-23) | détermine comment le jeu traite le clan (lien avec les Sujets d'Ymir) |
| 7 | Fins de Shadis, de Magath, de Hannes, de Moblit (X-50 à X-53) | fenêtres de présence (`U14` §3) |
| 8 | Taille du Titan de Rod (X-58) | taille de l'entité en bataille (K-05) |
| 9 | Pierre à éclatement (X-27) | déblocage de la technologie qui en dépend (U06) |
| 10 | Utgard (X-29) | règle de scénario (K-06) |
| 11 | Les Chemins | règles T-1 à T-7 de `U14` §4 (Titans et héritage) |
| 12 | Survivants du Grondement et fin de Hizuru (X-72, X-31) | scénario 857 (défaut « non », `U14` Q-4) |

**Questions à Gabriel** : voir `U14` §8 (Q-1 à Q-7). Aucune n'est reprise ici.

---

## 7. Contrôles exécutés sur le dossier

Deux contrôles automatiques ont été exécutés le 2026-10-17 sur les quinze fichiers `U00`–`U15`, après la dernière modification. Les scripts sont locaux à la session et **non versionnés** (ils lisent des extraits de pages qui ne sont pas conservés dans le dépôt) : leur sortie ci-dessous n'est donc pas reproductible par un tiers sans refaire la lecture des pages.

Ce que le premier contrôle vérifie :
- chaque code `FW:` / `WP:` employé correspond à une page dont un extrait a été lu ;
- chaque tableau de sources donne, pour un code, l'adresse attendue, sans doublon ;
- chaque fichier `U..` et chaque chemin `docs/…` / `data/…` cité existe dans le dépôt ;
- chaque renvoi « `U08 §7` » vise une section existante ; chaque identifiant `T-nnn` existe dans `U08` ;
- les étiquettes `[C]` `[I]` `[?]` `A` sont les seules employées ; aucun marqueur d'attente (de type mot-clé de tâche restante, repère de texte vide ou série de points d'interrogation) ;
- aucun caractère japonais qui ne figure pas dans un extrait lu.

Sortie réelle (premier contrôle) :

```
PROBLEMES: {}
codes utilisés: 105 | pages récupérées: 105
```

Sortie réelle (second contrôle : chaque tableau garde le même nombre de colonnes que son en-tête) :

```
tableaux: 167 | lignes à colonnes incohérentes: 0
```

Limites : ces contrôles prouvent la **cohérence interne** et le **rattachement à une page lue** ; ils ne prouvent ni que la page est exacte, ni que l'extrait l'a restituée sans perte, ni que le dossier l'a comprise sans erreur. Un contrôle croisé de la direction (lecture des extraits contre le texte des fichiers) a corrigé, pendant la rédaction, des erreurs d'attribution, de date et de sens (l'année de naissance d'Uri Reiss inventée, la direction Kruger → Grisha inversée, le lieu du tir de Gabi sur Eren, la date de Liberio « après 854 »). Ce contrôle n'a pas pu porter sur les pages non lues (§2) ni sur l'œuvre.
