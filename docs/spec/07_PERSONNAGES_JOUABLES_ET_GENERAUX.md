

# 07 — PERSONNAGES JOUABLES, GÉNÉRAUX, COMMANDANTS

> Convention `C` / `A` / `?` inchangée. **Rôles et existence = `C` quand le personnage est canon ; toutes les statistiques, capacités, mécaniques et noms de remplissage = `A`.**
> Les noms marqués `A` sont des **officiers fictifs** pour combler les effectifs ; l'utilisateur peut les renommer dans `/data/characters/*.json`.
> Orthographes : **Darius Zackly** (écrit « Dhalis » dans certaines versions `?`), **Hange Zoë** (« Hanji » selon les éditions `?`).
> **Chaque personnage a une fenêtre de présence** (arrivée et sortie canon, fichier 11 §3) : un personnage mort avant le scénario choisi n'est ni jouable ni conseiller.

## 1. MODES D'INCARNATION

Le joueur choisit **comment** il joue un scénario :

| Mode | Description | Ce que le joueur contrôle |
|---|---|---|
| **Dirigeant** | Chef d'État/organisation | Économie, politique, diplomatie, expéditions, nominations |
| **Commandant** | Chef militaire d'une organisation | Opérations, escouades, stratégie, relation avec le pouvoir politique (limité) |
| **Chroniqueur** | Bascule entre plusieurs personnages clés selon la chronologie | Un personnage à la fois, selon le moment |
| **Cercle** | Joue un groupe (ex. escouade d'élite) | Missions, relations, survie |
| **Éminence** | Conseiller de l'ombre | Influence indirecte (conseils, manipulations, renseignement) |

Chaque personnage jouable possède : un **mode(s) disponible(s)**, un **scénario(s)**, des **atouts**, des **handicaps**, une **mécanique signature**, des **objectifs**, des **événements exclusifs**.

## 2. FICHE-TYPE D'UN PERSONNAGE JOUABLE

```
id, nom, canon, âge au départ, faction, poste, actif_de, actif_jusqu_a, événement_de_sortie
modes: [Dirigeant|Commandant|Chroniqueur|Cercle|Éminence]
ressources de départ: {budget, effectifs, gaz, lames, nourriture, capital politique}
atouts[], handicaps[], traits[]
mécanique_signature: {nom, effet, coût, cooldown}
arbre_de_compétences_préféré
conseillers_de_départ[], généraux_de_départ[]
objectifs[]: principal, secondaires, cachés
événements_exclusifs[]
fins possibles[]
difficulté: 1..5
```

## 3. ROSTER JOUABLE (28)

### 3.1 Paradis
| ID | Personnage | Scénarios | Poste | Modes | Mécanique signature `A` | Diff. |
|---|---|---|---|---|---|---|
| P01 | **Erwin Smith** | 850 (jusqu'à Shiganshina, où il meurt) | Commandant du Corps | Dir/Cmd | *Pari calculé* : mise de ressources avec résultat asymétrique | 5 |
| P02 | **Dot Pixis** | 845, 850, 854 (meurt en 854) | Commandant de la Garnison (Sud) | Dir/Cmd | *Le Verre à la main* : décisions risquées avec forte probabilité de réussite si bien préparées | 3 |
| P03 | **Darius (Dhalis) Zackly** | 850–854 (assassiné en 854) | Commandant en chef | Dir | *Arbitrage de la poigne* : arbitre entre Corps, Garnison, Brigade | 4 |
| P04 | **Historia Reiss** | 850→854 | Reine | Dir | *Couronne contestée* : légitimité volatile, secrets de famille | 4 |
| P05 | **Hange Zoë** | 850, 854 | Scientifique puis Commandante | Dir/Cmd | *Expérience en direct* : recherche accélérée au prix du risque | 4 |
| P06 | **Levi Ackerman** | 850 | Capitaine d'élite | Cmd/Cercle | *Escouade Levi* : unité d'élite, mission-spécifique | 3 |
| P07 | **Keith Shadis** | 845 | Instructeur en chef | Cmd | *Promotion annuelle* : forge les recrues | 2 |
| P08 | **Nile Dok** | 850 | Commandant de la Brigade | Cmd | *Réseau d'influence* : informateurs, arrestations | 3 |
| P09 | **Eren Yeager** | 850→854 | Porteur de Titans | Chronique/Éminence | *Horloge des 13 ans* : décisions de destin | 5 |
| P10 | **Armin Arlert** | 850→854 | Stratège / diplomate | Éminence/Cmd | *Plan improbable* : stratégie à faible probabilité, haute récompense | 4 |
| P11 | **Mikasa Ackerman** | 850→854 | Soldat d'élite | Cercle | *Éveil d'Ackerman* : pics de puissance limités | 3 |
| P12 | **Jean Kirstein** | 850→854 | Officier de terrain | Cmd | *Commandement de proximité* | 3 |
| P13 | **Kenny Ackerman** | 845–850 (meurt en 850) | Chef de l'ombre | Éminence | *Réseau souterrain* : contrebande, assassinats | 4 |
| P14 | **Hannes** | 845–850 (meurt en 850, invasion de Wall Rose) | Officier de Garnison | Cmd | *Ultime décision* : sauver un seul | 2 |
| P15 | **Floch Forster** | 854 | Yeagerist | Dir (faction) | *Radicalisation* : exploite la peur | 4 |

### 3.2 Marley
| ID | Personnage | Scénarios | Poste | Modes | Mécanique signature `A` | Diff. |
|---|---|---|---|---|---|---|
| M01 | **Theo Magath** | 854 | Général | Cmd | *Doctrine moderne* : combine artillerie/aviation/Titans | 3 |
| M02 | **Willy Tybur** | 854 | Chef de la famille Tybur | Dir | *Spectacle politique* : propagande et diplomatie | 4 |
| M03 | **Zeke Yeager** | 854 | Porteur du Bestial | Chronique/Éminence | *Plan de l'ombre* : double jeu | 5 |
| M04 | **Pieck Finger** | 854 | Porteuse de la Charrette | Cercle | *Logistique mobile* | 3 |
| M05 | **Reiner Braun** | 850, 854 | Porteur du Cuirassé | Cercle | *Fardeau* : stress/moral | 4 |
| M06 | **Porco Galliard** | 854 | Porteur de la Mâchoire | Cercle | *Course de vitesse* | 3 |
| M07 | **Falco Grice** | 854 | Candidat guerrier | Cercle | *Héritier* : choix de transfert | 3 |
| M08 | **Tom Ksaver** | Hors scénarios standard (829–842, mort en 842) | Porteur du Bestial puis mentor de Zeke | Éminence | *Doctrine des Titans* | 3 |

### 3.3 Hizuru / Alliés / Autres
| ID | Personnage | Scénarios | Poste | Modes | Mécanique signature `A` | Diff. |
|---|---|---|---|---|---|---|
| H01 | **Kiyomi Azumabito** | 852–854 | Affaires étrangères d'Hizuru (famille Azumabito) | Dir | *Équilibre de survie* : neutralité tendue | 4 |
| H02 | **Yelena** | 851–854 | Cheffe des Volontaires anti-Marleyens | Éminence | *Fanatisme* : opérations extrêmes | 4 |
| H03 | **Onyankopon** | 851–854 | Volontaire anti-Marleyen (ex-conscrit marleyen, pilote) | Cercle | *Courtier* : mise en relation | 2 |
| A01 | Commandant des Alliés (`A`) | 854 | Coalition | Dir | *Fragilité d'alliance* : consensus | 4 |
| A02 | Amiral allié (`A`) | 854 | Flotte | Cmd | *Contrôle des mers* | 3 |
| X01 | **Karl Fritz** | Ère impériale | Roi | Dir | *Exil et serment* : décision originelle | 5 |

## 4. DÉTAIL DES PERSONNAGES MAJEURS (situation, atouts, handicaps, objectifs)

### P01 — Erwin Smith (850)
- **Situation** : Corps de ~200 membres, budget contesté, doutes sur l'utilité du Corps ; relations tendues avec le Cabinet.
- **Atouts** : charisme `5`, tactique `5`, formation de reconnaissance longue portée ; réseau de soutiens politiques minoritaires.
- **Handicaps** : pertes élevées → pression politique ; un **objectif privé caché** (cf. événement « Le sous-sol ») qui peut entrer en conflit avec le bien-être de ses soldats.
- **Mécanique** : *Pari calculé* — 1 fois par an, le joueur peut **doubler la mise** d'une expédition (ressources ×2, risque ×1.5, gains ×3). Réussite augmente la confiance politique ; échec peut provoquer un procès.
- **Objectifs** : reconquérir Wall Maria ; obtenir la vérité ; survivre à la Brigade.
- **Fins** : *Vérité* · *Sacrifice* · *Chute politique* · *Corps dissous*.

### P02 — Dot Pixis
- **Situation** : commande la Garnison du Sud ; **entraînement irrégulier** ; vision pragmatique.
- **Atouts** : expérience, légitimité, sens stratégique ; capacité à **décider vite**.
- **Handicaps** : bureaucratie, moral instable, corruption mineure ; **vulnérable aux critiques du Cabinet**.
- **Mécanique** : *Le Verre à la main* — événements de décision où l'alcool/le calme influence les tests de sang-froid ; 3 niveaux de « calme » au début d'une crise.
- **Objectifs** : tenir Trost ; moderniser la Garnison ; coopérer avec le Corps ou lui imposer la ligne.

### P03 — Zackly
- **Situation** : commande en chef ; contrôle les budgets ; intérêts marchands.
- **Atouts** : **arbitrage**, accès aux fonds, réseau.
- **Handicaps** : légitimité fragile devant la cour ; haine de la Brigade.
- **Mécanique** : *Arbitrage de la poigne* — peut **imposer** des résolutions entre organisations 3 fois par an.

### P04 — Historia Reiss
- **Situation** : couronne contestée, secrets familiaux ; Culte hostile ou allié ; demande de réformes.
- **Atouts** : **légitimité** symbolique, pouvoir de nomination.
- **Handicaps** : manque d'expérience initiale ; manipulations ; capital politique faible.
- **Mécanique** : *Couronne contestée* — un indicateur **Légitimité** très volatile (± 20 par événement) ; décisions « de cœur » vs « de raison ».
- **Objectifs** : stabiliser le trône ; réformer ; assurer l'avenir de ses sujets ; décider de la politique d'ouverture.

### P05 — Hange Zoë
- **Situation** : chef de section et scientifique du Corps (850), **14ᵉ Commandante** après la mort d'Erwin ; **expériences** sur Titans ; fait développer les Lances de foudre à partir de technologies de la Police intérieure.
- **Atouts** : recherche accélérée, innovations, charisme excentrique ; **compréhension du Titan**.
- **Handicaps** : risque d'accidents ; image publique ambivalente.
- **Mécanique** : *Expérience en direct* — un projet de recherche peut être **accéléré ×2** avec 20 % de risque d'accident majeur.
- **Objectifs** : percer les secrets des Titans ; équiper le Corps ; choisir une ligne face à Marley.

### P06 — Levi Ackerman (Commandant/Cercle)
- **Situation** : capitaine, tueur d'élite ; escouade d'élite.
- **Atouts** : ODM exceptionnel (`5/5`) ; capacité unique de **kill-chain** ; moral d'escouade élevé.
- **Handicaps** : **pas de capital politique** ; dépend de ses supérieurs ; stress cumulatif.
- **Mécanique** : *Escouade Levi* — 4–6 individus ; chaque perte réduit la capacité globale de façon marquée ; **remplacement difficile**.
- **Objectifs** : missions de choc ; protéger un porteur ; survivre.

### P09 — Eren Yeager (Chronique/Éminence)
- **Situation** : porteur de l'Assaillant puis du Fondateur ; **horloge des 13 ans**.
- **Atouts** : transformation, visions, influence idéologique.
- **Handicaps** : **déterminisme perçu**, perte de libre arbitre ; la confiance des alliés est volatile.
- **Mécanique** : *Mémoire des futurs* — le joueur reçoit des **visions partielles** (probabilités déformées) ; chaque usage coûte du **contrôle**.
- **Fins** : voir §6 du fichier 02 (fins multiples, **aucune fin « propre »**).

### M01 — Theo Magath
- **Situation** : général de Marley ; Titans-guerriers sous son autorité ; opinions ambivalentes.
- **Atouts** : stratège, bonne réputation, équilibre.
- **Handicaps** : loyauté sous pression ; limites politiques.
- **Mécanique** : *Doctrine moderne* — coordonne **3 armes** (artillerie, aviation, Titans) avec bonus de synergie ; mal coordonné = pénalités.

### M02 — Willy Tybur
- **Situation** : tête de la famille Tybur ; manipule l'opinion ; incarne la mémoire officielle de Marley.
- **Atouts** : propagande, finances, réseau diplomatique.
- **Handicaps** : sous-estimation de Paradis ; **vulnérable à une attaque directe**.
- **Mécanique** : *Spectacle politique* — un événement public annuel (festival) : si réussi, +15 légitimité ; s'il est perturbé, −25.

### M03 — Zeke Yeager
- **Situation** : Guerrier Bestial ; double jeu, vision de l'« euthanasie » ; lien avec Paradis.
- **Atouts** : contrôle des Titans purs, planification.
- **Handicaps** : **secrets** : toute révélation peut le détruire.
- **Mécanique** : *Plan de l'ombre* — le joueur gère **deux agendas** (visible et caché) ; la divulgation du second change radicalement la partie.

### H01 — Kiyomi Azumabito
- **Situation** : membre dirigeante de la famille Azumabito, chargée des affaires étrangères d'Hizuru, nation fragile économiquement ; **menaces à la fois marleyenne et alliée**.
- **Atouts** : diplomatie, ressources spécifiques, savoir-faire technologique.
- **Handicaps** : **faible armée**, dépendance extérieure.
- **Mécanique** : *Équilibre de survie* — un compteur de **neutralité crédible** ; bascule en cas d'excès d'un côté.

## 5. GÉNÉRAUX ET COMMANDANTS — ROSTERS

> Chaque général = personnage complet + `doctrine` + `capacités de commandement` (voir §7). Noms `A` = fictifs.

### 5.1 Paradis
| ID | Nom | Rang / poste | Canon | Doctrine | Spécialité |
|---|---|---|---|---|---|
| GP01 | Erwin Smith | Commandant du Corps | C | Reconnaissance, charge | Pari, formation († 850, Shiganshina) |
| GP02 | Dot Pixis | Responsable de la Garnison du Sud | C | Défense mobile | Sang-froid, sièges († 854) |
| GP03 | Zackly | Commandant en chef | C | Arbitrage | Logistique, politique (assassiné en 854) |
| GP04 | Nile Dok | Commandant de la Brigade | C | Ordre | Contre-espionnage († 854) |
| GP05 | Keith Shadis | Commandant Corps d'Entraînement | C | Formation | Recrues |
| GP06 | Hange Zoë | Chef de section → 14ᵉ Commandante (dès fin 850) | C | Recherche | Anti-Titan († 854, Grondement) |
| GP07 | Levi Ackerman | Capitaine d'élite | C | Choc | ODM |
| GP08 | Mike Zacharias | Chef d'escouade | C | Éclaireur | Flair, détection († 850, invasion de Wall Rose) |
| GP09 | Nanaba | Soldat d'élite | C | Éclaireur | Soutien Mike († 850, Utgard) |
| GP10 | Gelgar | Soldat d'élite | C | Soutien | ODM († 850, Utgard) |
| GP11 | Hannes | Officier de Garnison | C | Défense | Évacuation († 850) |
| GP12 | Kitz Weilman | Officier de Garnison (rôle exact `?`) | C/? | Défense | Mur |
| GP13 | Ian Dietrich | Officier de Garnison | C | Défense | Mur |
| GP14 | Rico Brzenska | Officier de Garnison | C | Défense | Artillerie |
| GP15 | Marlowe Freudenberg | Officier de la Brigade | C | Ordre | Enquête |
| GP16 | Floch Forster | Soldat → Yeagerist | C | Radical | Mobilisation |
| GP17 | Jean Kirstein | Officier | C | Terrain | Commandement |
| GP18 | Colonel Aldric Vane | Chef de secteur Sina | A | Prestige | Garde royale |
| GP19 | Major Elise Brandt | Intendance | A | Logistique | Gaz/vivres |
| GP20 | Capitaine Ruben Tauber | Artillerie Garnison | A | Canons | Anti-Titan |
| GP21 | Major Ilse Kruger-Moll | Médicale | A | Soins | Hôpital |
| GP22 | Capitaine Joris Haller | Éclaireur senior | A | Reconnaissance | Cartographie |
| GP23 | Colonel Maren Voss | Cavalerie | A | Mobilité | Chevaux |
| GP24 | Lieutenant Anselm Koch | Instructeur ODM | A | Formation | Vol |
| GP25 | Commandant Brune Aldous | Réserve (Rose) | A | Réserve | Manœuvres |

### 5.2 Marley
| ID | Nom | Rang / poste | Canon | Doctrine | Spécialité |
|---|---|---|---|---|---|
| GM01 | Theo Magath | Général | C | Moderne | Titans+armes |
| GM02 | Willy Tybur | Chef Tybur | C | Politique | Propagande |
| GM03 | Zeke Yeager | Guerrier Bestial | C | Ruse | Contrôle |
| GM04 | Pieck Finger | Guerrière Charrette | C | Mobilité | Logistique |
| GM05 | Reiner Braun | Guerrier Cuirassé | C | Choc | Défense |
| GM06 | Porco Galliard | Guerrier Mâchoire | C | Vitesse | Raids |
| GM07 | Colt Grice | Candidat | C | Terrain | Reconnaissance |
| GM08 | Karina Braun | Civile (réseau) | C | Influence | Familles |
| GM09 | Amiral Berhard Kolb | Marine | A | Naval | Cuirassés |
| GM10 | Général Hugo Stahl | Armée de terre | A | Artillerie | Siège |
| GM11 | Colonel Mathis Renk | Aviation | A | Aérien | Dirigeables/avions |
| GM12 | Major Lisbeth Aronn | Renseignement | A | Espionnage | Infiltration |
| GM13 | Général Casimir Rodt | Front Est | A | Défense | Tranchées |
| GM14 | Colonel Dagna Holm | Logistique | A | Rail | Approvisionnement |
| GM15 | Commandant Otto Weiss | Police d'internement | A | Ordre | Ghettos |
| GM16 | Capitaine Yves Marchet | Artillerie côtière | A | Côtier | Forts |

### 5.3 Hizuru
| ID | Nom | Rôle | Canon |
|---|---|---|---|
| GH01 | Kiyomi Azumabito | Cheffe de clan | C |
| GH02 | Capitaine Takeda Iori | Défense côtière | A |
| GH03 | Amirale Mizuki Sora | Flotte | A |
| GH04 | Maître Hakuro | Ingénieur naval | A |

### 5.4 Alliés
| ID | Nom | Rôle | Canon |
|---|---|---|---|
| GA01 | Relais avec les Volontaires anti-Marleyens (Onyankopon, Yelena : voir H02/H03) | Liaison | C |
| GA02 | Commandant Idris Qadim | Coalition | A |
| GA03 | Général Tarek Vahdat | Terre | A |
| GA04 | Amiral Nabil Sorani | Mer | A |
| GA05 | Colonel Rania Haddad | Logistique | A |
| GA06 | Chef du renseignement Salim Aref | Espionnage | A |

## 6. ESCOUADES D'ÉLITE ET UNITÉS NOMMÉES

| Unité | Faction | Composition | Spécificité |
|---|---|---|---|
| Escouade Levi (spéciale) | Paradis | 4–6 d'élite | Mobilité, élimination rapide ; ses membres d'origine sont tués en 850 (expédition 57 `?`), l'unité est ensuite recomposée |
| Escouade Mike | Paradis | 4–5 éclaireurs | Détection ; décimée en 850 (Wall Rose, Utgard) |
| Escouade Hange | Paradis | 4–6 | Capture/étude de Titans |
| Escouade de Garnison (Pixis) | Paradis | 10–20 | Défense de porte |
| Brigade royale (Sina) | Paradis | 8–12 | Garde royale |
| **Guerriers** | Marley | 4–9 porteurs | Puissance stratégique |
| **Candidats** | Marley | 6–10 | Relève |
| Bataillon d'internement | Marley | 100+ | Ordre |
| Escadrille aérienne | Marley | 6–12 appareils | Appui |
| Garde du clan | Hizuru | 12–24 | Défense du domaine |

## 7. CAPACITÉS DE COMMANDEMENT (≈ 48, `A`)

Chaque général possède 2–4 capacités. Coût : **Points de commandement (PC)** ou ressources. Cooldown en jours stratégiques ou secondes tactiques.

**Stratégiques** : *Pari calculé* (Erwin) · *Le Verre à la main* (Pixis) · *Arbitrage* (Zackly) · *Mobilisation d'urgence* · *Marche forcée* · *Conseil de guerre* · *Plan de retraite* · *Ravitaillement express* · *Diversion politique* · *Opération fantôme* · *Rafle ciblée* · *Pacte secret*.

**Tactiques (Paradis)** : *Charge finale* (+30 % moral, −20 % défense) · *Formation d'éventail* · *Signal coordonné* · *Appât vivant* · *Tir de barrage* · *Réserve en profondeur* · *Pont d'ancrages* (création rapide d'ancrages) · *Réorientation éclair* · *Évacuation sous couvert*.

**Tactiques (Marley)** : *Barrage d'artillerie* · *Frappe aérienne* · *Percée blindée* `?` · *Projection de Titan* · *Cordon de sécurité* · *Débarquement* · *Contre-batterie*.

**Individuelles** : *Lame humaine* (Levi) · *Éveil d'Ackerman* · *Flair* (Mike) · *Course de vitesse* (Porco) · *Armure totale* (Reiner) · *Ordre de la Bête* (Zeke, contrôle de purs) · *Mobilité totale* (Pieck) · *Cri d'appel* (Féminin).

## 8. PROGRESSION DE COMMANDANT (6 ARBRES × 8 PERKS = 48 PERKS)

| Arbre | Exemples de perks `A` |
|---|---|
| **Tactique** | Lecture du terrain · Coordination d'escouades · Signal précis · Formation optimale · Réaction rapide · Pièges · Chaîne d'ordres · Adaptation |
| **Logistique** | Convois efficaces · Rationnement fin · Dépôts avancés · Réparation de terrain · Chevaux endurants · Gaz économe · Récupération · Stock caché |
| **Commandement** | Charisme militaire · Discipline · Moral de fer · Promotion rapide · Discours · Mentorat · Cohésion · Succession |
| **Politique** | Réseau · Diplomatie · Gestion du scandale · Persuasion · Négociation · Capital politique · Propagande · Légitimité |
| **Renseignement** | Rapports fiables · Agents doubles · Contre-espionnage · Interception · Faux rapport · Cryptographie · Réseau d'informateurs · Ombre |
| **Anti-Titan / Technologie** | Étude des Titans · ODM avancé · Lances de foudre (dès fin 850) · Artillerie ciblée · Armes combinées · Fortifications · Hygiène · Médecine |

Points : 1 par an de service + 1 par victoire significative + 1 par événement de maturité. Perks **mutuellement exclusifs** dans certains cas (ex. *Pari calculé* vs *Prudence*).

## 9. GÉNÉRATION D'OFFICIERS ET DE PERSONNAGES

- **Générateur** : nom, passé, origine sociale, traits, aptitudes, **défaut secret** (peur, dette, loyauté ambiguë).
- **Banque de noms** (≥ 800 prénoms/noms) pour Paradis (consonances germanisées), Marley, Hizuru, Alliés.
- **Portrait procédural** par archétype (visage de base + coiffure + insignes + signes distinctifs).
- **Biographie courte générée** (3–5 phrases) ; **événements de vie** tirés (famille, perte, promotion).
- **Création de personnage joueur** (mode Chronique/Éminence) : choix de passé, spécialité, 2 traits, 1 défaut.

## 10. RELATIONS ENTRE GÉNÉRAUX (graphe)

Relations canon `C` (exemples) : **Erwin–Levi** (loyauté profonde), **Erwin–Hange** (confiance), **Pixis–Erwin** (respect mutuel), **Zackly–Erwin** (tension/compromis), **Nile–Erwin** (amis d'enfance `C`), **Magath–Zeke** (méfiance), **Willy Tybur–Magath** (hiérarchie), **Kiyomi–Mikasa** (lien de lignée Azumabito `C`).
- **Types** : respect, rivalité, dette, haine, amour, dépendance idéologique.
- **Effets** : bonus de coordination, malus de refus d'ordres, trahison, sacrifice volontaire.
- Le **graphe** est affiché comme **tableau d'enquête** (fils, épingles) dans l'interface.



