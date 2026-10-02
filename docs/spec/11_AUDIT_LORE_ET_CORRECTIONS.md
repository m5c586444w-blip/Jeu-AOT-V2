

# 11 — AUDIT DE COHÉRENCE LORE ET CORRECTIONS

> **Statut : ce fichier prime sur les fichiers 01 à 10** pour tout fait de lore, en cas de contradiction.
> Les corrections ci-dessous ont **déjà été appliquées** dans les fichiers concernés ; ce rapport en garde la trace et fixe des règles pour que l'IA ne réintroduise pas ces erreurs.

## 0. MÉTHODE ET LIMITES

- Chaque point douteux a été recoupé par recherche web.
- **Aucune source officielle (manga papier, guides officiels) n'a pu être consultée.** Les sources sont des wikis communautaires (Fandom), Wikipédia et quelques articles de presse spécialisée. Les wikis sont modifiables par n'importe qui : un fait n'y est donc **« recoupé »**, pas **« garanti »**.
- Quand seule une source de mauvaise qualité (pages SEO, agrégateurs, sites contradictoires) soutenait un fait, il a été **marqué `[?]` ou retiré**, pas conservé.
- Les faits que je n'ai pas pu vérifier sont listés au §9 : ils restent marqués `[?]`.

## 1. ANACHRONISMES (CHOSES PRÉSENTES TROP TÔT)

| Fichier(s) | Erreur | Correction | Fiabilité |
|---|---|---|---|
| 01, 03, 05, 10 | **Lances de foudre** présentées comme disponibles dès Trost (850) ou 845 | Elles apparaissent **à la fin de 850, lors du Retour à Shiganshina** ; développées par **Hange** à partir de technologies conservées par la **Police intérieure**. Nouveau champ `unlock_event` dans les données. | Élevée (plusieurs sources concordantes) |
| 03, 10 | **Fusée jaune** « à confirmer » | Le code du Corps (expédition 57) comprend rouge/vert/noir ; le code de la **Garnison** diffère (vert = début, rouge = échec, jaune = succès). Rouge **n'a pas le même sens** selon l'organisation. | Moyenne |
| 03, 10 | **Chariots-canons** donnés comme canon `[C]` | Artillerie de **mur** confirmée ; canons **mobiles** → `[?]` | Moyenne |
| 06, 03 | **Château d'Utgard** utilisé comme lieu récurrent | Il est **détruit en 850** (bataille de nuit). Ne peut plus servir de base après. | Élevée |
| 07 | **Tom Ksaver** jouable dès « 845+ » | Il a transmis le Bestial à Zeke en **842** et est mort ; hors scénarios standard. | Élevée |
| 07, 08 | **Mike, Nanaba, Gelgar, Hannes** actifs en même temps que les personnages de 854 | Tous **morts en 850** (invasion de Wall Rose / Utgard). Voir fenêtres de présence au §3. | Élevée |
| 07, 08 | **Erwin** actif après Shiganshina | Mort en **850** à Shiganshina ; Hange devient **14ᵉ Commandante**. | Élevée |
| 07 | **Pixis, Nile, Zackly** toujours actifs en fin 854 | Zackly **assassiné** par les Yeagerists en 854 ; Pixis (brièvement chef de l'armée) et Nile **meurent lors de la contre-attaque de Marley à Shiganshina** (854). | Élevée |
| 08 | **Frieda Reiss** à la cour en 850 | Elle est **tuée en 845** par Grisha (qui hérite alors du Fondateur) ; de la famille royale, seul **Rod** survit. | Élevée |

## 2. GÉOGRAPHIE : ERREURS CORRIGÉES

| Erreur | Correction (source : fiches de wiki communautaire) |
|---|---|
| Orvud, Ehrmich, Krolva, Yarckel placés dans de mauvais murs | **Wall Maria** : Shiganshina (sud). **Wall Rose** : Utopia (N), Karanes (E), Trost (S), Krolva (O). **Wall Sina** : Orvud (N), Stohess (E), Ehrmich (S), Yarckel (O), Mitras (centre), ville souterraine. |
| **Dauper, Ragako** mis dans l'anneau de Maria ; **Raiberg** utilisé | Dauper, Ragako et **Jinae** sont des villages du **sud de l'intérieur de Rose**. **Raiberg** : **non retrouvé** dans les sources consultées → **retiré**. |
| **Utgard** « rattachement `?` » | Château abandonné **dans Wall Rose**, près du périmètre intérieur ; détruit en 850. |
| **Cavernes de glace** placées sans contexte | La pierre à éclatement de glace vient de **caldeiras volcaniques sous la ville-usine** ; localisation de la ville-usine `[?]`. |
| Murs : **Titans-Murs ~60 m** | Murs ≈ **50 m** ; les Titans-Murs sont à hauteur de mur (**≈ 50 m**), le Colossal fait **60 m**. |
| (Ajout) | Murs **nommés d'après les trois filles d'Ymir Fritz**. Titan de Rod Reiss : **≈ 120 m** (immobile). |

## 3. FENÊTRES DE PRÉSENCE DES PERSONNAGES (À IMPLÉMENTER)

Chaque personnage a `active_from`, `active_until`, `death_event`. Le jeu **avertit** si le joueur provoque une divergence (voir F-LOR-09 du fichier 09).

| Personnage | Sortie (canon) | Fiabilité |
|---|---|---|
| Carla Yeager, Frieda Reiss, Grisha Yeager | **845** | Élevée |
| Marcel Galliard | **845** (dévoré) | Élevée |
| Tom Ksaver | **842** (hérité par Zeke) | Élevée |
| Mike Zacharias | **850** (Wall Rose) | Élevée |
| Nanaba, Gelgar | **850** (Utgard) | Élevée |
| Hannes | **850** (Smiling Titan, arc de l'invasion de Wall Rose) | Élevée |
| Kenny Ackerman, Rod Reiss | **850** (arc du gouvernement royal) | Élevée |
| Eld, Gunther, Oluo, Petra | **850** (expédition 57) | À vérifier `[?]` (non recoupé ici) |
| Erwin Smith | **850** (Shiganshina) | Élevée |
| Bertholdt | **850** (mangé par Armin) | Moyenne |
| Moblit Berner | `[?]` | Non vérifié |
| Pasteur Nick | `[?]` | Non vérifié |
| Ymir (stagiaire, Mâchoire) | mangée par Porco, **entre 850 et 854** `[?]` | Moyenne |
| Willy Tybur | **854** (Liberio) | Élevée |
| Darius Zackly | **854** (assassiné) | Élevée |
| Dot Pixis, Nile Dok | **854** (contre-attaque de Marley à Shiganshina) | Élevée |
| Hange Zoë | **854** (Grondement) | Élevée |
| Theo Magath, Keith Shadis | **fin 854+** `[?]` | Non vérifié |
| Sasha Blouse | **854** `[?]` | Non vérifié |

## 4. CHAÎNES DE TITANS (CORRIGÉES)

| Titan | Chaîne |
|---|---|
| **Assaillant** | Eren Kruger (819–832) → Grisha (832–845) → Eren (845–) |
| **Fondateur** | Frieda Reiss (842–845) → Grisha (845, brièvement) → Eren (845–) |
| **Bestial** | Tom Ksaver (829–842) → Zeke (842–) |
| **Mâchoire** | Marcel (843–845) → un Titan pur (futur **Ymir**) → **Porco** → **Falco** (en 854) |
| **Colossal** | Bertholdt (845) → **Armin** (850) |
| Cuirassé / Féminin / Charrette | Reiner / Annie / Pieck |
| **Marteau de guerre** | Lara Tybur → Eren (854) |

> **Erreur corrigée** : la Mâchoire n'était **pas** à Porco « depuis 845 ». Les dates exactes des transferts restent `[?]` (sources de seconde main).
> **Ne pas confondre** Ymir Fritz (première Titane) et Ymir (stagiaire de la 104ᵉ).

## 5. FACTIONS : AFFILIATIONS CORRIGÉES

| Erreur | Correction |
|---|---|
| **Onyankopon** rangé chez les « Alliés » | **Soldat conscrit de Marley** issu d'un pays conquis, recruté par Zeke dans les **Volontaires anti-Marleyens**. Arrive à Paradis en **851** avec la première flotte de reconnaissance. |
| **Yelena** « restaurationniste » | **Cheffe des Volontaires anti-Marleyens**. |
| **Kiyomi Azumabito** « cheffe du clan / dirigeante d'un petit État » | Membre dirigeante de la **famille Azumabito**, chargée des **affaires étrangères d'Hizuru** ; Hizuru est une nation **en difficulté économique** qui convoite la pierre à éclatement de glace. |
| **Forces Alliées** comme coalition « neutre » | Coalition **ennemie de Marley** dans la **guerre du Moyen-Orient** (≈ 850–854) ; flotte détruite à **Fort Slava** par le Bestial. Une **alliance mondiale anti-Eldia** se forme après Liberio `[?]` (composition). |
| **Police intérieure** absente | Division d'élite de la Brigade Militaire : ODM **anti-personnel**, détient la technologie qui donnera les **Lances de foudre**. |

**Frise 851–853 ajoutée** : première flotte marleyenne de reconnaissance (851) ; contact avec Hizuru (≈ 852) ; refus d'Hizuru d'ouvrir le commerce (853) ; chemin de fer en construction à Paradis (≈ 852–853, source secondaire).

## 6. TECHNOLOGIE ET RESSOURCES

| Erreur | Correction |
|---|---|
| **Pierre à éclatement de glace** = « matériaux de pointe / lames » | C'est la **source du gaz de l'ODM** (propre à Paradis). Les lames sont en **acier ultra-dur**. |
| **Fusils anti-Titan** Marley `[?]` | **Confirmés** (utilisés contre des porteurs/Titans en 854). |
| (Ajout) **ODM anti-personnel** et **arme de contention spéciale** (capture d'Annie) | Existent avant 850 `[C]`. |
| (Ajout) **Bateau volant d'Hizuru** | Fonctionne à la pierre à éclatement de glace (≈ 854). |
| **Blindés, sous-marins, gaz de combat** (Marley) | **Non confirmés** → restent `[?]`. |

## 7. DONNÉES : CHAMPS AJOUTÉS

- `Character.active_from`, `active_until`, `death_event`.
- `Tech.unlock_event`.
- Fonctions **F-TEC-16** (gating par événement), **F-LOR-09** (fenêtres de présence), **F-LOR-10** (rapport de cohérence).

## 8. RÈGLES ANTI-ANACHRONISME POUR L'IA

1. **Aucun objet, lieu ou personnage** ne peut apparaître dans une partie avant sa date canon, sauf **divergence assumée** (affichée au joueur avec avertissement).
2. Implémente `npm run canon:check` : il parcourt les données et signale (a) les technologies sans `unlock_event` alors qu'elles sont tardives (Lances de foudre, bateau volant, fusils anti-Titan), (b) les personnages actifs hors de leur fenêtre, (c) les lieux détruits utilisés après leur destruction (Utgard, Shiganshina bouchée, etc.).
3. En cas de doute sur une date : **champ paramétrable `[?]`**, pas d'invention.
4. Les affiliations (Volontaires, Alliés, Hizuru) suivent le §5 ; ne pas les regrouper « pour simplifier ».

## 9. POINTS NON VÉRIFIÉS (RESTENT `[?]`)

1. Mort d'Eld, Gunther, Oluo, Petra, Moblit, Pasteur Nick, Sasha, Magath, Keith Shadis (dates exactes).
2. Localisation de la **ville-usine**, de la **forêt des Arbres Géants**, du **camp d'entraînement**, du **QG du Corps**, de la **chapelle Reiss**.
3. Année de construction des Murs (**743** donnée par une chronologie de seconde main).
4. Distances entre murs (≈ 100 km Maria→Rose, ≈ 130 km Rose→Sina) et rayon de Sina.
5. Existence de **blindés/chars**, sous-marins, gaz de combat chez Marley.
6. Composition exacte de l'alliance mondiale anti-Eldia.
7. Durée exacte du Grondement (jusqu'en 857 selon une source).
8. Attribution précise du rôle des Tybur dans la Grande Guerre des Titans.

## 10. SOURCES CONSULTÉES (wikis communautaires, non officiels, sauf mention)

- Wikipédia : https://en.wikipedia.org/wiki/Attack_on_Titan ; https://en.wikipedia.org/wiki/Attack_on_Titan_season_4
- Fandom : https://attackontitan.fandom.com/wiki/Walls ; /wiki/Locations ; /wiki/Ragako ; /wiki/Utgard_Castle ; /wiki/Iceburst_stone ; /wiki/Signal_flare ; /wiki/Return_to_Shiganshina_arc ; /wiki/Grisha_Yeager ; /wiki/Zeke_Yeager ; /wiki/Attack_Titan ; /wiki/Galliard_family ; /wiki/Dot_Pixis ; /wiki/Nile_Dok ; /wiki/Onyankopon ; /wiki/Azumabito_family ; /wiki/Mike_Zacharias
- Chronologie : https://www.slashfilm.com/915963/the-entire-attack-on-titan-timeline-explained/
- Presse : https://www.cbr.com/aot-every-arc-ranked-by-deaths/ ; https://screenrant.com/saddest-attack-on-titan-deaths-ranked/
- Fanlore (ressources de Paradis) : https://www.fanlore.org/wiki/Paradis_Island



