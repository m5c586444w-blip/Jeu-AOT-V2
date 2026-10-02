

# 10 — CATALOGUES : UNITÉS, ÉQUIPEMENTS, BÂTIMENTS, TITANS, PROJETS, DOCUMENTS

> Convention `C` / `A` / `?`. Les **valeurs chiffrées sont `A`** (point de départ d'équilibrage). Toute capacité ou technologie marquée `?` doit être paramétrable.
> Format de données : un fichier JSON par catalogue dans `/data/catalogs/`.

## 1. TYPES D'UNITÉS (ESCOUADES / FORMATIONS)

### 1.1 Paradis
| ID | Unité | Effectif | Rôle | Particularité | Canon |
|---|---|---|---|---|---|
| U-P01 | Escouade ODM de reconnaissance | 4–6 | Éclaireur | Rapide, fragile | C |
| U-P02 | Escouade ODM de combat | 4–6 | Tueur de Titans | Attaque ciblée | C |
| U-P03 | Escouade de soutien | 4–8 | Gaz/lames/médic | Soutien mobile | A |
| U-P04 | Section de cavalerie | 10–20 | Mobilité | Longues distances | A |
| U-P05 | Section de Garnison | 10–30 | Défense de mur/porte | Canons | C |
| U-P06 | Équipe d'artillerie | 4–8 | Canons anti-Titans | Lent, puissant | C |
| U-P07 | Équipe de lances de foudre (dès fin 850) | 4–6 | Dégâts de zone | Risque fratricide | C |
| U-P08 | Section de Brigade | 8–16 | Police/ordre | Contrôle de foule | C |
| U-P09 | Garde royale | 8–12 | Protection | Prestige | A |
| U-P10 | Unité de capture | 6–12 | Capture de Titans | Filets, câbles | A |
| U-P11 | Équipe du génie | 6–12 | Fortification/bouchage | Réparation de murs | A |
| U-P12 | Convoi de ravitaillement | 6–20 | Logistique | Vulnérable | A |
| U-P13 | Équipe médicale | 4–8 | Soins | Réduit mortalité | A |
| U-P14 | Cellule de renseignement | 3–8 | Espionnage | Discrète | A |
| U-P15 | Milice civile | 20–100 | Défense locale | Peu entraînée | A |
| U-P16 | Recrues de la 104ᵉ (type) | 20–100 | Formation | Évolution annuelle | C/A |

### 1.2 Marley
| ID | Unité | Effectif | Rôle | Particularité | Canon |
|---|---|---|---|---|---|
| U-M01 | Infanterie de ligne | 100–1000 | Front | Fusils modernes | A |
| U-M02 | Infanterie d'assaut | 50–200 | Percée | Équipement lourd | A |
| U-M03 | Batterie d'artillerie | 6–20 | Appui | Portée longue | A |
| U-M04 | Mitrailleurs | 10–30 | Défense | Feu soutenu | A |
| U-M05 | Cavalerie légère | 30–100 | Reconnaissance | Mobile | A |
| U-M06 | Blindés `?` | 4–12 | Percée | Existence à confirmer | ? |
| U-M07 | Train blindé | 1–3 | Mobilité lourde | Rail | A |
| U-M08 | Escadrille de chasse | 6–12 | Supériorité aérienne | Biplans | A |
| U-M09 | Escadrille de bombardement | 4–8 | Frappe | Vulnérable | A |
| U-M10 | Dirigeable | 1–3 | Reconnaissance/bombe | Lent | A |
| U-M11 | Flotte de cuirassés | 2–6 | Domination navale | Coûteuse | A |
| U-M12 | Croiseurs/destroyers | 4–12 | Escorte | Polyvalents | A |
| U-M13 | Transports de troupes | 4–12 | Débarquement | Vulnérables | A |
| U-M14 | Police d'internement | 50–300 | Ordre | Répression | C/A |
| U-M15 | Section de Guerriers | 4–9 | Porteurs | Stratégique | C |
| U-M16 | Services secrets | 5–20 | Espionnage | Discrets | A |
| U-M17 | Troupes coloniales | 100–500 | Appui | Loyauté variable | A |
| U-M18 | Défense antiaérienne | 6–20 | Anti-aérien | Canons/mitrailleuses | A |

### 1.3 Hizuru / Alliés
| ID | Unité | Rôle | Canon |
|---|---|---|---|
| U-H01 | Garde du clan | Défense du domaine | A |
| U-H02 | Marine d'Hizuru | Défense côtière | A |
| U-H03 | Ingénieurs navals | Construction | A |
| U-H04 | Infanterie alliée | Front | A |
| U-H05 | Cavalerie alliée | Mobilité | A |
| U-H06 | Navires de coalition | Mer | A |
| U-H07 | Aviation alliée (légère) | Appui | A |
| U-H08 | Réseau de renseignement conjoint | Espionnage | A |

## 2. ÉQUIPEMENTS INDIVIDUELS ET COLLECTIFS

### 2.1 Équipement de Paradis
| ID | Objet | Effet principal | Usure / coût | Canon |
|---|---|---|---|---|
| E-P01 | **ODM standard** | Mobilité 3D | Gaz (consommable), entretien | C |
| E-P02 | **ODM d'élite (réglé)** | +15 % vitesse | Maintenance accrue | A |
| E-P03 | **Paire de lames** (acier ultra-dur) | Coupe de nuque | Usure rapide | C |
| E-P04 | Lames renforcées (acier de qualité) | +20 % durée | Coût ×2 | A |
| E-P05 | Bouteilles de gaz | Autonomie ODM (gaz issu de la pierre à éclatement de glace) | Consommable | C |
| E-P06 | **Lance de foudre** (dès fin 850) | Explosion de zone ; perce l'armure durcie | Munition unique | C |
| E-P07 | Fusils à poudre | Distraction/humains | Précision faible | C |
| E-P08 | Canons anti-Titans | Tir lourd | Lent, fixe | C |
| E-P09 | **Fusées de signalisation** | Communication | Consommables | C |
| E-P10 | Longues-vues | Détection | Fragile | A |
| E-P11 | Uniformes d'expédition (cape verte) | Camouflage/identité | Usure | C/A |
| E-P12 | Trousse de soins | Réduit mortalité | Consommable | A |
| E-P13 | Harnais de capture | Capture de Titans | Réutilisable | A |
| E-P14 | Filets/cordages | Immobilisation | Usure | A |
| E-P15 | Torches et lanternes | Nuit | Consommable | A |
| E-P16 | Carte et boussole | Navigation | — | A |
| E-P17 | Tente et rations | Autonomie | Consommable | A |
| E-P18 | Chevaux de campagne | Mobilité | Fatigue | C |
| E-P19 | Chariots de ravitaillement | Logistique | Lent | C/A |
| E-P20 | Canons de mur / canons mobiles | Artillerie anti-Titan | Lent ; canons de mur = confirmés, version mobile = `?` | C/? |
| E-P21 | **ODM anti-personnel** (Police intérieure) | Armes à feu intégrées contre humains | Maintenance élevée | C |
| E-P22 | **Arme de contention spéciale** | Capture de porteurs (utilisée contre Annie) | Munition unique | C |

### 2.2 Équipement de Marley
| ID | Objet | Effet | Canon |
|---|---|---|---|
| E-M01 | Fusil à répétition | Infanterie moderne | A |
| E-M02 | Mitrailleuse | Défense | A |
| E-M03 | Mortier/obusier | Appui | A |
| E-M04 | Artillerie lourde de siège | Détruire forts | A |
| E-M05 | **Fusil anti-Titan** (et munitions spéciales) | Dégâts accrus sur Titans, purs et porteurs | C |
| E-M06 | Grenades | Mêlée | A |
| E-M07 | Lance-flammes | Anti-fortifications | ? |
| E-M08 | Radio/Télégraphe | Communication | A |
| E-M09 | Chars/automitrailleuses | Mobilité | ? |
| E-M10 | Avions/dirigeables | Air | A |
| E-M11 | Cuirassés | Mer | A |
| E-M12 | Sous-marins | Mer | ? |
| E-M13 | Camouflage/uniformes | Identité | A |
| E-M14 | Brassards (Eldiens) | Contrôle social | C |
| E-M15 | Seringues de moelle spinale | Création de purs | C |
| E-M16 | Armes de Titans (harpons, dispositifs) | Contrôle | ? |

## 3. BÂTIMENTS (ÉTENDUS, 60)

| Catégorie | Bâtiments |
|---|---|
| **Agricole** | Ferme, Grenier, Moulin, Verger, Haras, Serre (tardif) |
| **Extraction** | Mine de fer, Carrière, Mine de glace, Scierie, Puits de charbon (Marley), Raffinerie (Marley) |
| **Industrie** | Forge, Atelier d'ODM, Fabrique de gaz, Poudrière, Fonderie de canons, Usine d'armement (Marley), Tannerie |
| **Militaire** | Caserne, École d'ODM, Dépôt de gaz, Arsenal, Tour de guet, Poste de signal, Bunker anti-Titan, Palissade, Canon de mur, Fort, Aérodrome, Port militaire, Chantier naval |
| **Civil** | Marché, Hôpital, École, Imprimerie, Bibliothèque, Chapelle, Orphelinat, Auberge, Relais de poste, Hospice, Prison |
| **Spécial** | Laboratoire de Titans, Salle des archives, Tribunal, Cathédrale, Salle du conseil, Bureau d'espionnage, Dépôt secret, Mémorial |
| **Transport** | Route pavée, Pont, Ascenseur de mur, Gare, Voie ferrée, Port fluvial, Phare |
| **Marley+** | Station radio, Centrale électrique, Centre de projection de Titans, Camp d'internement, Hôpital militaire d'élite |

Chaque bâtiment : `coût`, `durée de construction`, `entretien`, `capacité`, `effets`, `vulnérabilités`, `niveau (1–3)`, `prérequis tech`.

## 4. TITANS PURS : BESTIAIRE DÉTAILLÉ

| ID | Type | Taille | Vitesse | Comportement | Menace | Canon |
|---|---|---|---|---|---|---|
| T-01 | **Standard** | 3–15 m | Lente/moyenne | Approche et capture | 2 | C |
| T-02 | **Petit (3–5 m)** | 3–5 m | Lente | Facile à abattre | 1 | C |
| T-03 | **Grand (10–15 m)** | 10–15 m | Moyenne | Menace de zone | 3 | C |
| T-04 | **Anormal** | 5–15 m | Rapide/erratique | Comportement imprévisible | 4 | C |
| T-05 | **Sentinelle** | variable | Nulle → rapide | Immobile jusqu'à stimulus | 3 | A |
| T-06 | **Chasseur** | 5–10 m | Rapide | Cible individuelle | 4 | A |
| T-07 | **Meute** | variable | Moyenne | Agglutination par bruit | 4 | A |
| T-08 | **Nocturne** | variable | Faible la nuit | Actif surtout de jour | 2 | A |
| T-09 | **Titan-Mur** (Wall Titans) | ~50 m | Immobile jusqu'au Grondement | Enchâssé dans les murs | 5 | C |
| T-10 | **Titan blessé** | variable | Réduite | Régénération en cours | 2 | A |
| T-11 | **Titan de Rod Reiss** | ~120 m | Immobile (incapable de se tenir debout) | Titan pur géant, corps exposé ; événement unique (850) | 5 | C |

Règles communes : nuque = point faible `C` ; régénération `C` ; attirance pour les humains `C` ; activité nocturne réduite `C`.

## 5. TITANS DES NEUF : FICHES DE CAPACITÉS DÉTAILLÉES (`A` sauf mentions)

Pour chaque Titan : `taille`, `vitesse`, `force`, `régénération`, `endurance`, `capacités`, `limites`, `contre-mesures`, `coûts`, `cooldowns`.

| Titan | Taille | Capacités spéciales | Limites |
|---|---|---|---|
| **Fondateur** | variable | Contrôle des Titans, mémoire (royal) | Dépend du sang royal |
| **Assaillant** | ~15 m | Combat rapproché, régénération, mémoire des futurs | Endurance, perte de contrôle |
| **Cuirassé** | ~15 m | Armure durcie, charge | Zones articulaires, endurance |
| **Colossal** | ~60 m | Vapeur brûlante, onde de choc | Durée limitée, nuque exposée |
| **Féminin** | ~14 m | Durcissement, cri d'appel | Coût en endurance |
| **Bestial** | ~17 m | Projectiles, contrôle de purs (par cri) | Portée limitée, peu mobile |
| **Mâchoire** | ~4 m | Rapidité, morsure, griffes | Faible résistance |
| **Charrette** | ~4 m | Endurance, transport | Faible attaque |
| **Marteau de guerre** | variable | Cristal, créations solides | Coût élevé en endurance |

## 6. VÉHICULES ET MACHINES

| ID | Machine | Faction | Rôle | Canon |
|---|---|---|---|---|
| V-01 | Chariot de ravitaillement | Paradis | Logistique | C/A |
| V-02 | Chariot-canon | Paradis | Artillerie mobile | C |
| V-03 | Ascenseur de mur | Paradis | Transport | C |
| V-04 | Train civil | Marley | Transport | A |
| V-05 | Train blindé | Marley | Combat | A |
| V-06 | Camion/auto | Marley | Transport | A |
| V-07 | Dirigeable | Marley | Air | A |
| V-08 | Biplan de chasse | Marley | Air | A |
| V-09 | Bombardier | Marley | Air | A |
| V-10 | Cuirassé | Marley | Mer | A |
| V-11 | Croiseur | Marley | Mer | A |
| V-12 | Navire de transport | Tous | Logistique | A |
| V-13 | Navire à voiles/vapeur (Hizuru) | Hizuru | Mer | A |

## 7. SIGNAUX ET CODES

| Signal | Sens | Canon |
|---|---|---|
| Fusée rouge | Titan repéré (code du Corps) ; mission échouée (code de la Garnison) | C |
| Fusée verte | Changement de direction (code du Corps) ; mission commencée (code de la Garnison) | C |
| Fusée noire | Titan anormal | C |
| Fusée jaune | Mission réussie / terminée (code de la Garnison ; annule un rouge précédent) | C |
| Cloches de murs | Alerte d'invasion | A |
| Drapeaux | Communication à distance | A |
| Feux de signal | Relais de nuit | A |
| Télégramme | Information rapide (Marley) | A |
| Pigeons voyageurs | Information lente | A |
| Courriers | Messages officiels | A |

## 8. DOCUMENTS ET OBJETS D'ARCHIVE (diégétiques)

| Type | Usage |
|---|---|
| Rapport d'expédition | Pertes, objectifs, leçons |
| Télégramme | Information urgente (Marley) |
| Lettre officielle | Ordres, notifications |
| Lettre personnelle | Événements de personnage |
| Carte annotée | Itinéraire, secrets |
| Dossier de personnel | Biographie, notes |
| Journal intime | Découvertes narratives |
| Article de presse | Opinion publique |
| Affiche de propagande | Moral, loyauté |
| Procès-verbal | Procès, séances |
| Registre | Stocks, effectifs |
| Plans techniques | Recherche |
| Photographie gravée | Illustration |
| Sceau/cachet | Authentification |

## 9. MÉDAILLES, DISTINCTIONS ET INSIGNES

- **Distinctions** (Paradis) : Mention de courage, Croix de reconnaissance, Cordon du Mur, Étoile des Brèches `A`.
- **Marley** : Ordre de la Bête, Croix du Mérite militaire, Médaille de la Zone `A`.
- **Insignes** : des ailes de la Liberté stylisées `C` concept (**redessinées**), emblèmes de Garnison/Brigade `C`, insignes de grade `A`.
- **Effets** : moral, réputation, accès politique.

## 10. GRANDS PROJETS (MÉGA-PROJETS)

| ID | Projet | Faction | Durée | Effet |
|---|---|---|---|---|
| G-01 | **Bouchage de brèche** | Paradis | 30–120 j | Restaure un mur |
| G-02 | **Reconquête de Wall Maria** | Paradis | Opération fin 850 (porte de Shiganshina), puis ~9 mois de nettoyage `?` | Récupère l'anneau |
| G-03 | **Réseau de signaux de Rose** | Paradis | 6 mois | −50 % délais |
| G-04 | **Chemin de fer de Paradis** | Paradis | 2–4 ans (un chantier existe vers 852–853, source secondaire `?`) | Logistique ×2 |
| G-05 | **Poste de commandement souterrain** | Paradis | 1 an | Résistance aux sièges |
| G-06 | **Programme de capture de Titans** | Paradis | 2 ans | Débloque recherche |
| G-07 | **Académie de commandement** | Paradis | 3 ans | Officiers +1 niveau |
| G-08 | **Hôpital central de Mitras** | Paradis | 2 ans | Mortalité −20 % |
| G-09 | **Flotte de Paradis** | Paradis | 5 ans | Mer ouverte |
| G-10 | **Programme des Guerriers (relève)** | Marley | 5 ans | Nouveaux porteurs |
| G-11 | **Blocus de Paradis** | Marley | 1 an | Asphyxie économique |
| G-12 | **Projection d'une armée outre-mer** | Marley | 1–2 ans | Invasion |
| G-13 | **Cuirassés de nouvelle génération** | Marley | 3 ans | Maîtrise des mers |
| G-14 | **Muraille côtière** | Marley | 2 ans | Défense côtière |
| G-15 | **Pont diplomatique d'Hizuru** | Hizuru | 1 an | Accès aux Alliés |
| G-16 | **Alliance anti-Marley** | Alliés | 2 ans | Coalition armée |
| G-17 | **Mémorial national** | Tous | 1 an | Moral/légitimité |
| G-18 | **Réforme de la Garnison** | Paradis | 2 ans | Qualité des troupes |
| G-19 | **Grand Archives** | Paradis | 3 ans | Accès aux secrets |
| G-20 | **Programme anti-Grondement** `?` | Alliés | — | Contre-mesures (scénario) |

## 11. DONNÉES À PRODUIRE

- `/data/catalogs/units.json` (≥ 45), `equipment.json` (≥ 40), `buildings.json` (≥ 60), `titans_pure.json` (10), `titans_nine.json` (9), `vehicles.json` (13), `signals.json` (10), `documents.json` (14), `medals.json` (≥ 20), `megaprojects.json` (≥ 20).
- Icônes SVG originales pour chaque entrée (voir fichier 04).
- Textes de description en i18n (clés).



