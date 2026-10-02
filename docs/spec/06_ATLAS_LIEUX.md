

# 06 — ATLAS COMPLET DES LIEUX

> Extension des fichiers 00–05. **Convention de fiabilité inchangée** : `C` canon solide, `A` adaptation/invention de design, `?` incertain (à rendre paramétrable).
> **Règle d'or** : tout toponyme marqué `A` est un **nom fictif de remplissage** ; l'utilisateur pourra le remplacer par un nom canon s'il en connaît un, via `/data/provinces/*.json`, sans toucher au code.
> Le découpage en provinces (segments de mur, anneaux) est une **abstraction de jeu `A`**, même quand les districts qu'il contient sont canon.
> **Audit (fichier 11)** : répartition des districts corrigée d'après des fiches de wiki communautaire ; Dauper, Ragako et Jinae sont des villages de l'intérieur de **Rose** ; « Raiberg » retiré.

## 0. HIÉRARCHIE SPATIALE

`Monde → Théâtre (Paradis / Marley / Hizuru / Alliés / Mers) → Région → Province → Site d'intérêt (POI) → Carte tactique → Intérieur (diorama d'interface)`

- **Province** : unité de la carte stratégique (≈ 134 au total).
- **POI** : lieu précis à l'intérieur d'une province (bâtiment, ruine, passage). Une province en contient 1 à 8.
- **Carte tactique** : instanciée à la demande pour un combat (templates fixes pour lieux canon, procéduraux sinon).
- **Intérieur** : décor des écrans de gestion (QG, salle du cabinet…), pas jouable en combat sauf cas indiqués.

Champs communs d'une province : `terrain`, `population (0–5)`, `richesse clé`, `fortification (0–5)`, `titan_density (0–1)`, `visibilité`, `voisins`, `POI[]`, `actions disponibles`, `événements liés`.

## 1. PARADIS — 74 PROVINCES

### 1.1 Outre-murs / Territoire des Titans (10) — tous `A`
| ID | Nom | Terrain | Densité Titans | Fonction de jeu |
|---|---|---|---|---|
| O01 | Plaines Meurtries | plaine | 0.8 | Zone de manœuvre principale hors Maria sud |
| O02 | Ruines du Premier Cordon | ruines | 0.7 | Ruines d'anciens villages ; dépôts abandonnés à fouiller |
| O03 | Rivière des Cendres | fleuve | 0.5 | Ligne naturelle ; gués ; Titans attirés par les traversées |
| O04 | Falaises de la Côte Sud | côte | 0.4 | Premier contact avec l'océan (scénario 850+) |
| O05 | Marais Brumeux | marais | 0.6 | Visibilité −60 % ; chevaux ralentis |
| O06 | Forêt Morte | forêt | 0.6 | Ancrages ODM abondants, danger de Titans embusqués |
| O07 | Steppe Orientale | plaine | 0.7 | Longues distances ; formation d'éventail optimale |
| O08 | Côte Est | côte | 0.3 | Site de construction d'un éventuel port |
| O09 | Plateau du Nord | plateau | 0.5 | Vue dominante ; poste de guet possible |
| O10 | Vallée Oubliée | vallée | 0.9 | Concentration anormale de Titans ; événements spéciaux |

### 1.2 Mur Maria — 8 segments (`A` pour le découpage ; mur = `C`)
| ID | Segment | Notes |
|---|---|---|
| M01 | Maria-Nord | Garnison réduite |
| M02 | Maria-Nord-Est | Poste de guet |
| M03 | Maria-Est | Route des convois |
| M04 | Maria-Sud-Est | Proche du district sud |
| M05 | **Maria-Sud — Porte de Shiganshina** | **Point de brèche canon (845)** `C` |
| M06 | Maria-Sud-Ouest | Zone minière adjacente |
| M07 | Maria-Ouest | Isolé, ravitaillement difficile |
| M08 | Maria-Nord-Ouest | Poste de signal |

Chaque segment : **épaisseur, hauteur, état structurel (0–100), canons, ancrages, escaliers/ascenseurs, garnison**. Un segment peut être **fissuré, brisé, colmaté**.

### 1.3 Anneau Maria — 20 provinces (entre Maria et Rose)
| ID | Nom | Terrain | Pop | Ressource clé | Particularité | Canon |
|---|---|---|---|---|---|---|
| R01 | **Shiganshina** | urbain | 4 | Nourriture | District sud, porte, **maison des Yeager**, sous-sol | C |
| R02 | Faubourgs de Shiganshina | urbain | 3 | Main-d'œuvre | Marché, entrepôts, quartiers pauvres | A |
| R03 | Plaines intérieures de Maria — Sud | plaine | 3 | Nourriture | Terres agricoles avant 845 | A |
| R04 | Bourg minier de Maria (nom fictif) | urbain | 2 | Acier | Remplace « Raiberg », non confirmé dans les sources | A |
| R05 | Hameaux de l'Ouest de Maria | rural | 1 | Nourriture | Dispersés, vulnérables ; Ragako est dans l'anneau de Rose (S05) | A |
| R06 | **Forêt des Arbres Géants** | forêt | 0 | Bois | Arbres de ~80 m ; terrain de grands combats ; localisation exacte | C/? |
| R07 | Plaines céréalières du Sud | plaine | 3 | Nourriture | Grenier de Paradis | A |
| R08 | Plaines du Nord | plaine | 2 | Nourriture | Élevage, chevaux | A |
| R09 | Collines minières | collines | 2 | Acier | Mines de fer | A |
| R10 | Ville-usine et cavernes de glace | urbain/souterrain | 2 | Pierre à éclatement de glace | Cavernes sous la ville-usine ; source du gaz d'ODM ; localisation exacte | C/? |
| R11 | Haras de Maria | rural | 1 | Chevaux | Élevage militaire | A |
| R12 | Vallée du Moulin | rural | 2 | Nourriture | Meunerie, convois | A |
| R13 | Carrefour du Sud | plaine | 1 | Commerce | Nœud routier | A |
| R14 | Lac des Reflets | lac | 1 | Pêche | Eau douce, pêche | A |
| R15 | Fort Avancé de Maria | fort | 1 | — | Dépôt de gaz avancé | A |
| R16 | Hameaux de l'Est | rural | 2 | Nourriture | Dispersés, vulnérables | A |
| R17 | Monts Brumeux | montagne | 0 | Pierre | Carrière, refuge | A |
| R18 | Gorge du Silence | vallée | 0 | — | Embuscades, terrain tactique | A |
| R19 | Vergers de l'Ouest | rural | 2 | Nourriture | Fruits, cidre | A |
| R20 | Relais de Poste Maria | rural | 1 | Information | Délai des rapports −30 % | A |

> **Note scénario 845+** : après la chute de Maria, l'anneau devient **zone perdue** (population évacuée, Titans entrants, ressources gelées). La reconquête est un objectif majeur du scénario 850. Les Titans de l'extérieur y sont attirés en masse ; après la bataille de Shiganshina (fin 850), le Corps nettoie l'anneau pendant environ neuf mois `[?]`, ce qui permet ensuite la découverte de l'océan et le repeuplement.

### 1.4 Mur Rose — 8 segments
| ID | Segment | Notes |
|---|---|---|
| W01 | Rose-Nord | Tours d'observation |
| W02 | Rose-Nord-Est | Proche de Karanes |
| W03 | Rose-Est | **Porte de Karanes** `C` (district) |
| W04 | Rose-Sud-Est | Réserve de gaz |
| W05 | Rose-Sud | **Porte de Trost** `C` — brèche 850 |
| W06 | Rose-Sud-Ouest | Zone de garnison |
| W07 | Rose-Ouest | Proche d'Ehrmich |
| W08 | Rose-Nord-Ouest | Poste d'artillerie |

### 1.5 Anneau Rose — 14 provinces
| ID | Nom | Terrain | Pop | Ressource clé | Particularité | Canon |
|---|---|---|---|---|---|---|
| S01 | **Trost** | urbain | 5 | Nourriture | District sud du Mur Rose ; **QG Garnison** ; brèche 850 | C |
| S02 | **Karanes** | urbain | 4 | Commerce | District est ; **départ des expéditions** | C |
| S03 | **Utopia** | urbain | 3 | Commerce | District nord du Mur Rose | C |
| S04 | **Krolva** | urbain | 3 | Artisanat | District ouest du Mur Rose | C |
| S05 | **Ragako** (village) | rural | 1 | — | Village du sud de l'intérieur de Rose ; détruit en 850 | C |
| S06 | **Château d'Utgard** | fort | 0 | — | Château abandonné près du périmètre intérieur de Rose ; **détruit en 850** | C |
| S07 | QG Corps de Reconnaissance (château ancien) | fort | 1 | Équipement | QG ; localisation exacte | C/? |
| S08 | Camp d'entraînement | militaire | 2 | Recrues | Corps d'Entraînement ; localisation | C/? |
| S09 | Champs du Centre | plaine | 3 | Nourriture | Grenier de Rose | A |
| S10 | **Dauper** (village) | rural | 1 | Chasse | Petit village du sud de l'intérieur de Rose | C |
| S11 | Forges de Rose | urbain | 2 | Acier | **Atelier d'ODM** principal | A |
| S12 | Poudrière de Rose | urbain | 1 | Poudre | Production explosifs / lances | A |
| S13 | **Jinae** (ville) | urbain | 2 | Nourriture | Ville du sud de l'intérieur de Rose | C |
| S14 | Relais ferroviaire (en projet) | urbain | 1 | Logistique | Un chemin de fer est en construction vers 852–853 (source secondaire `?`) ; débloqué via techno | A |

### 1.6 Mur Sina — 6 segments
| ID | Segment | Notes |
|---|---|---|
| N01 | Sina-Nord | Protection capitale |
| N02 | Sina-Nord-Est | Garnison de prestige |
| N03 | Sina-Est | Porte de commerce |
| N04 | Sina-Sud | Porte principale |
| N05 | Sina-Ouest | Postes d'élite |
| N06 | Sina-Nord-Ouest | Archives murales |

### 1.7 Intérieur de Sina — 8 provinces
| ID | Nom | Terrain | Pop | Particularité | Canon |
|---|---|---|---|---|---|
| I01 | **Mitras** (capitale) | urbain | 5 | **Cour royale**, Cabinet, Cathédrale | C |
| I02 | Palais royal | fort | 1 | **Faux roi**, salles, chapelle privée | C/? |
| I03 | **Stohess** | urbain | 4 | District est de Sina ; **Brigade Militaire** | C |
| I04 | **Orvud** | urbain | 3 | District nord de Sina ; ravagé par le Titan de Rod Reiss (850) | C |
| I05 | **Yarckel** | urbain | 3 | District ouest de Sina | C |
| I06 | **Ville souterraine** | souterrain | 3 | Marché noir, contrebande, Kenny | C |
| I07 | Domaine Reiss / chapelle souterraine | fort | 0 | **Secret majeur** ; localisation | C/? |
| I08 | **Ehrmich** | urbain | 3 | District sud de Sina ; le « quartier des nobles » devient un POI de Mitras | C |

## 2. POI CANON À MODÉLISER (Paradis)

| POI | Province | Fonction jeu |
|---|---|---|
| **Maison des Yeager** + sous-sol | R01 | Objectif de scénario 850–851 ; **archives familiales** (événement) |
| **Porte de Shiganshina** | M05 | Point de brèche ; fort danger |
| **Porte de Trost** | W05 | Idem ; **zone de bouchage** |
| **QG de la Garnison (Trost)** | S01 | Commandement Pixis ; dépôt de gaz |
| **QG du Corps (château)** | S07 | Laboratoires de Hange, cachots, écuries |
| **Camp d'entraînement** | S08 | Recrutement annuel, classements |
| **Cathédrale des Murs** | I01 | Siège du Culte ; influence |
| **Palais royal** | I02 | Cour ; **salle du trône** |
| **Prison souterraine de la Brigade** | I03 | Détention ; interrogatoires (localisation exacte `?`) |
| **Marché noir souterrain** | I06 | Contrebande ; recrutement |
| **Chapelle Reiss** | I07 | Révélation majeure |
| **Château d'Utgard** | S06 | Combat statique nocturne (850) ; **détruit à l'issue** |
| **Ville-usine et cavernes de glace** | R10 | Extraction de la pierre à éclatement de glace (source du gaz d'ODM) |
| **Forêt des Arbres Géants** | R06 | Opération du Titan féminin |
| **Tribunal militaire** | I01 | Procès d'Eren (événement 850) |
| **Ferme / grenier de Maria** | R07 | Pivot de crise alimentaire |
| **Entrepôt de gaz de Trost** | S01 | Cible de sabotage |

## 3. MONDE — 60 PROVINCES (scénario 854)

> Tous les toponymes de cette section sont **`A`** sauf mention. Les structures (Liberio, Fort Slava, Hizuru, clan Azumabito) sont `C`.

### 3.1 Marley continent — 30 provinces
| ID | Nom | Type | Fonction |
|---|---|---|---|
| MA01 | Capitale de Marley (nom fictif) | urbain | Gouvernement, état-major, conseil Tybur |
| MA02 | **Liberio** | urbain | Ville marleyenne ; **C** |
| MA03 | **Zone d'internement de Liberio** | urbain | Ghetto eldien ; **C** |
| MA04 | **Fort Slava** | fort | Bastion côtier ; défaite de la flotte des Forces Alliées du Moyen-Orient ; **C** |
| MA05 | Port militaire de Liberio | port | Flotte, cuirassés |
| MA06 | Académie des Guerriers | militaire | Formation des porteurs ; `C` concept |
| MA07 | Domaine des Tybur | fort | Famille Tybur ; `C` concept |
| MA08 | Bassin houiller | industriel | Charbon |
| MA09 | Aciéries du Nord | industriel | Acier de qualité |
| MA10 | Raffineries du Sud | industriel | Pétrole |
| MA11 | Chantiers navals de l'Est | port | Cuirassés/transports |
| MA12 | Aérodrome central | militaire | Escadrilles, dirigeables |
| MA13 | Nœud ferroviaire Nord | urbain | Rail stratégique |
| MA14 | Nœud ferroviaire Sud | urbain | Rail stratégique |
| MA15 | Plaines agricoles de l'Ouest | rural | Nourriture |
| MA16 | Plaines agricoles de l'Est | rural | Nourriture |
| MA17 | Vignobles du Sud | rural | Commerce |
| MA18 | Province minière du Nord | industriel | Métaux |
| MA19 | Province forestière | forêt | Bois |
| MA20 | Camp d'entraînement de l'armée | militaire | Conscrits |
| MA21 | Camps d'internement secondaires | urbain | Eldiens |
| MA22 | Colonies d'outre-mer (nord) | colonie | Ressources, troupes coloniales |
| MA23 | Colonies d'outre-mer (sud) | colonie | Idem |
| MA24 | Ville universitaire | urbain | Recherche, propagande |
| MA25 | Quartier d'affaires | urbain | Crédit, banque |
| MA26 | Arsenal central | industriel | Armes |
| MA27 | Poudrières de l'Ouest | industriel | Explosifs |
| MA28 | Bases d'artillerie côtière | fort | Défense côtière |
| MA29 | Réseau d'espionnage Marley | spécial | Renseignement |
| MA30 | Ministères | urbain | Administration |

### 3.2 Hizuru — 8 provinces
| ID | Nom | Notes |
|---|---|---|
| HZ01 | Capitale d'Hizuru (nom fictif) | Gouvernement |
| HZ02 | **Domaine Azumabito** | Clan ; `C` |
| HZ03 | Port principal | Commerce, flotte |
| HZ04 | Chantiers navals | Navires |
| HZ05 | Île de l'Est | Pêche, défense |
| HZ06 | Plaines agricoles | Nourriture |
| HZ07 | Montagnes | Mines, refuges |
| HZ08 | Quartier diplomatique | Ambassades |

### 3.3 Forces Alliées — 14 provinces (`A`)
Cité du Désert, Port Oriental, Oasis Centrale, Haut-Plateau, Forteresse du Passage, Ville-Marché, Côte des Voiliers, Province du Nord, Province de l'Est, Dépôt logistique commun, QG de coalition, Camps de réfugiés, Raffinerie alliée, Aérodrome allié.

### 3.4 Zones maritimes — 8 provinces (`A`)
Détroit de Slava, Mer intérieure, Océan Ouest, Océan Est, Passage Sud, Passage Nord, Routes marchandes, Zone de Paradis (côtes).

## 4. CARTES TACTIQUES (40)

| # | Carte | Type | Canon |
|---|---|---|---|
| T01 | Shiganshina — Porte et rues | ville | C |
| T02 | Shiganshina — Maison Yeager | ville | C |
| T03 | Trost — Porte et quartier sud | ville | C |
| T04 | Trost — Toits et tours | ville | C |
| T05 | Karanes — Porte de départ | ville | C |
| T06 | Forêt des Arbres Géants — Corridor | forêt | C |
| T07 | Forêt des Arbres Géants — Clairière | forêt | C |
| T08 | Utgard — Cour et tour (nuit, 850) | fort | C |
| T09 | Stohess — Rues et canaux | ville | C |
| T10 | Stohess — Prison souterraine | souterrain | C/? |
| T11 | Mitras — Grande Avenue | ville | C |
| T12 | Mitras — Palais royal | fort | C/? |
| T13 | Chapelle Reiss | souterrain | C |
| T14 | Sommet du mur (Maria) | mur | C |
| T15 | Face du mur (Rose) | mur | C |
| T16 | Plaine hors-murs — Éventail | plaine | A |
| T17 | Gué de la Rivière des Cendres | fleuve | A |
| T18 | Ruines du Premier Cordon | ruines | A |
| T19 | Cavernes de glace | souterrain | C |
| T20 | Ragako — Village | rural | C |
| T21 | Marais Brumeux | marais | A |
| T22 | Côte Sud — Plage | côte | A |
| T23 | Liberio — Zone d'internement | ville | C |
| T24 | Liberio — Quartier marleyen | ville | C |
| T25 | Liberio — Place du festival | ville | C |
| T26 | Fort Slava — Remparts | fort | C |
| T27 | Fort Slava — Port | port | C |
| T28 | Front Marley — Tranchées | front | A |
| T29 | Gare blindée / train | rail | A |
| T30 | Pont fortifié | pont | A |
| T31 | Port de Hizuru | port | A |
| T32 | Domaine Azumabito | fort | C/? |
| T33 | Cité du Désert alliée | ville | A |
| T34 | Aérodrome de campagne | militaire | A |
| T35 | Ville industrielle Marley | ville | A |
| T36 | Navire de guerre — Pont | mer | A |
| T37 | Dirigeable — Intérieur | aérien | A |
| T38 | Camp de réfugiés | camp | A |
| T39 | Hameau abandonné | rural | A |
| T40 | Grondement — Ligne de front | crise | C/A |

## 5. INTÉRIEURS (DIORAMAS D'INTERFACE) — 30

Chaque intérieur est une **scène illustrée interactive** (objets cliquables = fonctions du jeu).

**Paradis** : Bureau du Commandant (Corps) ; Salle de briefing ; Réfectoire ; Dortoirs ; Laboratoire de Hange ; Forge/atelier d'ODM ; Écuries ; Cachots ; Tour d'observation ; Bureau de Pixis ; Salle des cartes de la Garnison ; Bureau de la Brigade ; Salle du Cabinet ; Salle du trône ; Chapelle des Murs ; Tribunal ; Archives ; Infirmerie ; Salle de presse (Gazette) ; Marché noir.

**Marley** : Salle de guerre ; Bureau du général ; Salle du conseil Tybur ; Académie (dortoir, salle de cours) ; Quartier eldien (intérieur d'une maison) ; Salle des cartes maritimes ; Poste de commandement de dirigeable ; Wagon de commandement.

**Hizuru / Alliés** : Salle d'audience du clan ; Bureau diplomatique.

## 6. RÉSEAUX ET INFRASTRUCTURES

- **Routes** (3 niveaux : sentier, route, route pavée), **chemin de fer** (Marley, partiel Paradis tardif), **voies fluviales**, **ports**, **relais de poste**, **tours de signal**.
- **Dépôts** : gaz, lames, vivres, munitions. Rayon d'approvisionnement.
- **Murs** : état structurel, escaliers, **ascenseurs à poulie**, canons, passerelles.
- **Portes** : **ouverte / fermée / bloquée / brisée**.
- **Zones d'évacuation** : couloirs d'évacuation prédéfinis pour les civils.
- **Lignes de signal** : visibilité des fusées, relais.
- **Réseau télégraphique** (Marley) : lignes coupables/sabotables.

## 7. ACTIONS DISPONIBLES PAR PROVINCE (≈ 45)

**Civil** : Rationner · Évacuer · Accueillir des réfugiés · Lever un impôt · Décréter un couvre-feu · Imprimer de la propagande · Construire/Améliorer un bâtiment · Planter/Récolter en urgence · Ouvrir un marché · Fermer un marché · Réquisitionner · Nommer un gouverneur · Convoquer une assemblée.
**Militaire** : Garnisonner · Fortifier · Miner une brèche · Boucher une brèche · Installer un canon · Installer un dépôt de gaz · Créer un poste de guet · Organiser un exercice · Lever des recrues · Réquisitionner des chevaux · Établir une base d'expédition.
**Renseignement** : Placer un informateur · Lancer une enquête · Poser un piège · Intercepter le courrier · Fouiller une ruine · Infiltrer une organisation.
**Politique** : Inspecter · Révéler un secret · Corrompre · Arrêter · Gracier · Organiser un procès · Proclamer la loi martiale.
**Titans** : Capturer un Titan · Poser un appât · Établir une zone d'observation · Créer un laboratoire de terrain.
**Marley** : Construire une voie ferrée · Installer une batterie côtière · Ouvrir un aérodrome · Imposer un internement · Rafle · Lever des troupes coloniales.

## 8. DONNÉES À PRODUIRE POUR CE FICHIER

- `/data/provinces/paradis.json` (74), `/data/provinces/monde.json` (60), `/data/poi.json` (≥ 120), `/data/tactical_maps.json` (40), `/data/interiors.json` (30), `/data/infrastructure.json`.
- Chaque `Province` inclut un champ `canon` et `notes_canon` ; **tout rattachement `?` est paramétrable**.
- **Polygones** de carte : dessiner à la main (éditeur de carte intégré, voir fichier 09 §DEV) ; style atlas du fichier 04.



