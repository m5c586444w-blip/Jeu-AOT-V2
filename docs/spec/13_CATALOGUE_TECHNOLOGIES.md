

# 13 — CATALOGUE DES TECHNOLOGIES ET CONDITIONS DE DÉBLOCAGE

> Convention `C` / `A` / `?` (le fichier 11 prime en cas de contradiction).
> **Canon `C`** : la technologie existe dans l'œuvre, à la date indiquée. **`A`** : technologie ajoutée par le design (progrès plausible sans être confirmé). **`?`** : existence ou date non confirmée.
> Les **coûts, durées et effets chiffrés sont `A`** ; ils vivent dans `/data/techs/*.json` et `/data/balance/`.
> **Colonne « Date min »** : la plus ancienne date de jeu à laquelle la technologie peut exister, utilisée par `npm run canon:check` (fichier 11 §8). Si elle est franchie par une divergence assumée, le jeu **avertit le joueur**.
> Les événements cités (E##) sont définis dans le fichier 12.

## 0. TYPES DE CONDITIONS DE DÉBLOCAGE

| Type | Exemple | Champ de données |
|---|---|---|
| **Départ** | ODM standard (disponible dès 845) | `start: true` |
| **Événement canon** | Lances de foudre après E37 | `unlock_event: "evt_850_police_tech_seized"` |
| **Prérequis technologique** | Canon mobile exige canon de mur | `prereqs: [...]` |
| **Personnage vivant** | Lances de foudre exigent Hange vivante | `requires_character: "char_hange"` |
| **Bâtiment / ressource** | Gaz exige une mine de pierre à éclatement de glace | `requires_building`, `requires_resource` |
| **Capture / expérience** | Protocole de capture exige un Titan vivant | `requires_capture: true` |
| **Renseignement** | Archives de la Police intérieure exigent la saisie | `requires_intel` |
| **Diplomatie** | Raffinage via Hizuru exige un traité | `requires_treaty: "hizuru_trade"` |

**Règle** : une technologie `C` tardive **ne peut pas** être débloquée par simple dépense de points avant son `unlock_event`, sauf **divergence assumée** (avertissement). Une technologie `A` n'a pas cette contrainte.

## 1. ARBRE ODM ET ÉQUIPEMENT (Paradis)

| ID | Technologie | Coût `A` | Prérequis | Déblocage | Effets principaux `A` | Date min | Canon |
|---|---|---|---|---|---|---|---|
| T-ODM-01 | **ODM standard** | — | — | Départ | Mobilité 3D de base (fichier 03) | 845 | C |
| T-ODM-02 | **Lames en acier ultra-dur** | — | — | Départ | Coupe de nuque ; usure rapide | 845 | C |
| T-ODM-03 | **Extraction de pierre à éclatement de glace** | 120 | — | Départ ; exige une mine (R10) | Produit le gaz ; production limitée | 845 | C |
| T-ODM-04 | Entretien d'ODM standardisé | 80 | T-ODM-01 | — | Pannes −20 % | 845 | A |
| T-ODM-05 | Réglage d'élite | 150 | T-ODM-04 | Atelier d'ODM niv. 2 | +15 % vitesse pour soldats d'élite | 845 | A |
| T-ODM-06 | **ODM anti-personnel** | 200 | T-ODM-01 | **E31** (capture/étude) ou saisie à la Brigade | Armes à feu intégrées ; usage contre humains | 850 | C |
| T-ODM-07 | Lames à alliage renforcé | 160 | T-ODM-02 | Acier de qualité (R09/R04) | Durée +20 % ; coût ×2 | 845 | A |
| T-ODM-08 | Bouteilles de gaz compactes | 140 | T-ODM-03 | — | Autonomie +15 % | 845 | A |
| T-ODM-09 | Harnais ergonomique | 90 | T-ODM-01 | — | Stress de vol −10 % | 845 | A |
| T-ODM-10 | Équipement de nuit | 100 | T-ODM-01 | — | Malus de nuit −30 % | 845 | A |

## 2. ARBRE ANTI-TITAN ET ARMES (Paradis)

| ID | Technologie | Coût `A` | Prérequis | Déblocage | Effets principaux `A` | Date min | Canon |
|---|---|---|---|---|---|---|---|
| T-ANT-01 | **Artillerie de mur** | — | — | Départ | Canons fixes sur les murs | 845 | C |
| T-ANT-02 | Canon mobile (chariot) | 180 | T-ANT-01, T-LOG-03 | — | Artillerie déployable ; lent | 845 | ? |
| T-ANT-03 | **Fusées de signalisation (code du Corps)** | — | — | Départ | Rouge/vert/noir ; communication d'expédition | 845 | C |
| T-ANT-04 | **Formation de reconnaissance longue portée** | 200 | T-ANT-03 | Corps d'Erwin ; **E16/E17** | Éventail avec relais de signaux | 850 | C |
| T-ANT-05 | **Arme de contention spéciale** | 220 | T-ANT-01 | **E16** (préparation de l'expédition 57) | Capture de porteurs ; usage unique | 850 | C |
| T-ANT-06 | Protocole de capture de Titans | 160 | — | **E11** ; exige un Titan vivant | Permet les expériences (arbre MED) | 850 | C |
| T-ANT-07 | Pièges (filets, fosses, appâts) | 130 | — | — | Piège à Titans ; réduit pertes | 845 | A |
| T-ANT-08 | **Lance de foudre (prototype)** | 260 | T-ANT-01, T-ODM-01 | **E37** ; **Hange vivante** ; poudrière niv. 2 | Explosion de zone ; perce l'armure durcie | **850 (fin)** | C |
| T-ANT-09 | Lance de foudre (production de masse) | 180 | T-ANT-08 | **E40** | Disponible en nombre ; moins chère | 850 (fin) | A |
| T-ANT-10 | Lance de foudre améliorée | 240 | T-ANT-09 | Après E40 ; après nouvelles expériences | Portée accrue ; risque de fratricide réduit | 851 | A |
| T-ANT-11 | Doctrine anti-durcissement | 190 | T-ANT-08 | **E39** | Bonus contre Cuirassé et Féminin | 850 (fin) | A |
| T-ANT-12 | Doctrine d'appât et d'embuscade | 150 | T-ANT-07 | — | Bonus de capture et de piège | 845 | A |
| T-ANT-13 | Contre-mesures alliées anti-Titan | 280 | T-ANT-10 | **E53** (observation) | Armes anti-Titan plus avancées | 854 | C |

## 3. ARBRE MÉDECINE ET BIOLOGIE

| ID | Technologie | Coût `A` | Prérequis | Déblocage | Effets principaux `A` | Date min | Canon |
|---|---|---|---|---|---|---|---|
| T-MED-01 | Médecine de campagne | 70 | — | Départ | Mortalité des blessés −10 % | 845 | A |
| T-MED-02 | Réseau d'hôpitaux | 130 | T-MED-01 | — | Soins ; épidémies −20 % | 845 | A |
| T-MED-03 | Contrôle des épidémies | 150 | T-MED-02 | — | Quarantaines ; propagation −30 % | 845 | A |
| T-MED-04 | Biologie élémentaire des Titans | 140 | T-ANT-06 | **E11** | Connaissance du comportement des purs | 850 | A |
| T-MED-05 | **Étude du sérum de transformation** | 200 | T-MED-04 | **E31** (sérum obtenu) ou **E47** | Comprendre la transformation ; prérequis à l'héritage | 850 | C |
| T-MED-06 | **Protocole d'héritage de Titan** | 220 | T-MED-05 | **E42** | Prépare transferts de pouvoir | 850 | C |
| T-MED-07 | Suivi des « 13 ans » | 120 | T-MED-06 | Porteur actif | Horloge visible et projections | 850 | A |
| T-MED-08 | Soins psychologiques | 110 | T-MED-01 | — | Stress −15 % ; traumatismes | 845 | A |

## 4. ARBRE LOGISTIQUE ET TRANSPORT

| ID | Technologie | Coût `A` | Prérequis | Déblocage | Effets principaux `A` | Date min | Canon |
|---|---|---|---|---|---|---|---|
| T-LOG-01 | Dépôts de ravitaillement | 80 | — | Départ | Rayon d'approvisionnement | 845 | A |
| T-LOG-02 | Élevage de chevaux militaire | 100 | — | Haras | Chevaux endurants | 845 | A |
| T-LOG-03 | Convois de chariots | 90 | T-LOG-01 | — | Convois ; vulnérables | 845 | A |
| T-LOG-04 | Bases avancées | 140 | T-LOG-01 | — | Attrition réduite hors zone | 845 | A |
| T-LOG-05 | **Chemin de fer de Paradis** | 300 | T-LOG-03 | **E48** (contact Hizuru) ; ressources en acier | Logistique ×2 sur lignes construites | 851 | C `?` |
| T-LOG-06 | Télégraphe de Paradis | 200 | T-LOG-05 | E48 | Rapports plus rapides | 851 | ? |
| T-LOG-07 | **Ports et marine côtière** | 180 | — | **E45** (océan découvert) | Navires côtiers ; accès extérieur | 850 (fin) | C `?` |
| T-LOG-08 | Optimisation des convois (assistée) | 120 | T-LOG-03 | Conseiller logistique | Pertes −15 % | 845 | A |

## 5. ARBRE FORTIFICATION ET MURS

| ID | Technologie | Coût `A` | Prérequis | Déblocage | Effets principaux `A` | Date min | Canon |
|---|---|---|---|---|---|---|---|
| T-FOR-01 | Maçonnerie de réparation | 90 | — | Départ | Répare les murs et portes | 845 | A |
| T-FOR-02 | Renfort de portes | 130 | T-FOR-01 | — | Portes résistent plus longtemps | 845 | A |
| T-FOR-03 | **Scellement par durcissement** | 250 | T-FOR-01 | **E13** ; exige **Eren** porteur | Bouche une brèche (cristal) | 850 | C |
| T-FOR-04 | Bunkers anti-Titan | 150 | T-FOR-01 | — | Abri ; réduit pertes civiles | 845 | A |
| T-FOR-05 | Réseau d'artillerie de mur | 170 | T-ANT-01 | — | Couverture croisée | 845 | A |
| T-FOR-06 | Couloirs d'évacuation | 100 | T-FOR-01 | — | Évacuation plus rapide | 845 | A |
| T-FOR-07 | Chaîne de tours de guet | 110 | — | — | Détection précoce | 845 | A |

## 6. ARBRE RENSEIGNEMENT ET COMMUNICATION

| ID | Technologie | Coût `A` | Prérequis | Déblocage | Effets principaux `A` | Date min | Canon |
|---|---|---|---|---|---|---|---|
| T-INT-01 | Réseau d'informateurs | 80 | — | Départ | Rapports locaux | 845 | A |
| T-INT-02 | Contre-espionnage de base | 120 | T-INT-01 | — | Détecte taupes | 845 | A |
| T-INT-03 | **Archives de la Police intérieure** | 160 | T-INT-01 | **E37** ; exige saisie | Accès aux dossiers de la Brigade | 850 | C |
| T-INT-04 | Cryptographie | 180 | T-INT-02 | — | Messages chiffrés | 845 | A |
| T-INT-05 | Presse et propagande | 100 | — | Imprimerie | Opinion ± | 845 | A |
| T-INT-06 | **Liaison avec les Volontaires** | 120 | T-INT-01 | **E47** | Informations marleyennes | 851 | C |
| T-INT-07 | Infiltration en territoire marleyen | 220 | T-INT-06 | **E49** `?` | Agent à Marley ; risque élevé | 851 | ? |
| T-INT-08 | **Reconnaissance aérienne (Marley)** | 260 | T-MOD-03 | Aéronefs | Cartes datées ; brouillard de guerre réduit | 854 | C |

## 7. ARBRE ADMINISTRATION ET SOCIÉTÉ

| ID | Technologie | Coût `A` | Prérequis | Déblocage | Effets principaux `A` | Date min | Canon |
|---|---|---|---|---|---|---|---|
| T-ADM-01 | Réforme de la conscription | 120 | — | Cabinet | Recrues ± ; légitimité ± | 845 | A |
| T-ADM-02 | Réforme des greniers | 110 | — | Greniers | Pertes de stock −20 % | 845 | A |
| T-ADM-03 | Intégration des réfugiés | 130 | — | **E05** | Stabilité ± ; main-d'œuvre | 845 | A |
| T-ADM-04 | Extension des écoles | 140 | — | — | Alphabétisation ; recherche + | 845 | A |
| T-ADM-05 | Réforme de la justice civile | 150 | — | **E33** | Légitimité juridique | 850 | A |
| T-ADM-06 | Réforme institutionnelle (régence/assemblée) | 220 | T-ADM-05 | **E36** | Cadre politique renouvelé | 850 | A |

## 8. ARBRE ARMES MODERNES (Marley)

| ID | Technologie | Coût `A` | Prérequis | Déblocage | Effets principaux `A` | Date min | Canon |
|---|---|---|---|---|---|---|---|
| T-MOD-01 | **Fusil à répétition** | — | — | Départ (Marley) | Infanterie moderne | 845 | A |
| T-MOD-02 | Artillerie lourde | 200 | T-MOD-01 | Départ (Marley) | Appui, contre-batterie | 845 | A |
| T-MOD-03 | **Dirigeables et aviation** | 260 | — | Départ (Marley) | Reconnaissance, appui | 845 | C |
| T-MOD-04 | **Flotte de cuirassés** | 280 | — | Départ (Marley) | Domination navale | 845 | C `?` |
| T-MOD-05 | **Fusil anti-Titan** | 220 | T-MOD-01 | Marley, après les Guerriers vs Paradis | Dégâts accrus sur Titans (purs, porteurs) | 850 | C |
| T-MOD-06 | Chemin de fer militaire | 180 | — | Départ (Marley) | Mobilité lourde | 845 | A |
| T-MOD-07 | Véhicules blindés | 300 | T-MOD-02 | — | Percée ; existence non confirmée | 850 | ? |
| T-MOD-08 | Armes chimiques | 260 | T-MOD-02 | — | Existence non confirmée ; coût moral | 850 | ? |
| T-MOD-09 | Police d'internement renforcée | 120 | — | Départ (Marley) | Contrôle des quartiers eldiens | 845 | A |
| T-MOD-10 | Doctrine de projection de Titan | 200 | — | Départ (Marley) | Porteur comme arme stratégique | 845 | A |
| T-MOD-11 | Munitions anti-porteur spéciales | 240 | T-MOD-05 | — | Dégâts accrus sur porteurs durcis | 850 | ? |

## 9. HIZURU ET ALLIÉS

| ID | Technologie | Coût `A` | Prérequis | Déblocage | Effets principaux `A` | Date min | Canon |
|---|---|---|---|---|---|---|---|
| T-HIZ-01 | **Bateau volant (hydravion)** | 320 | — | Hizuru ; **pierre à éclatement de glace** obtenue | Transport aérien ; carburant | 852–854 | C |
| T-HIZ-02 | Raffinage de la pierre à éclatement de glace | 260 | T-HIZ-01 | Traité de commerce avec Paradis | Carburant et gaz de haute qualité | 852 | ? |
| T-HIZ-03 | Ingénierie navale d'Hizuru | 200 | — | Départ (Hizuru) | Navires, ports | 845 | A |
| T-ALL-01 | Armes anti-Titan alliées | 280 | T-ANT-13 | Après **E50** | Armes améliorées ; coalition | 851–854 | C |
| T-ALL-02 | Logistique de coalition | 150 | — | Traité d'alliance | Convois mixtes | 851 | A |

## 10. DOCTRINES MUTUELLEMENT EXCLUSIVES `A`

| Doctrine A | Doctrine B | Effet du choix |
|---|---|---|
| **Manœuvre agile** (ODM, escouades légères) | **Fortification** (murs, canons) | Style de défense ; pertes ≠ |
| **Formation de reconnaissance longue portée** | **Colonnes lourdes** | Mobilité vs sécurité |
| **Capture et étude** | **Élimination systématique** | Recherche vs sécurité |
| **Transparence** | **Censure** | Légitimité vs contrôle |
| **Ouverture au monde** | **Isolement** | Accès extérieur vs sécurité |
| **Lances de foudre massives** | **ODM d'élite** | Ressources vs prestige |

## 11. ANACHRONISMES À INTERDIRE (liste pour `canon:check`)

| Technologie | Interdite avant | Raison |
|---|---|---|
| Lance de foudre (T-ANT-08/09/10) | **E37** (fin 850) | Première apparition à Shiganshina |
| Scellement par durcissement (T-FOR-03) | **E13** (850) | Première utilisation par Eren |
| ODM anti-personnel pour le Corps (T-ODM-06) | **E31** | Technologie de la Police intérieure |
| Chemin de fer de Paradis (T-LOG-05) | **E48** (851) | Chantier signalé après le contact avec Hizuru `?` |
| Bateau volant (T-HIZ-01) | 852 | Obtenu avec la pierre à éclatement de glace |
| Fusil anti-Titan (T-MOD-05) | 850 | Marley l'emploie contre les porteurs en 854 ; date de développement `?` |
| Contre-mesures alliées (T-ANT-13) | **E53** (854) | Conséquence de la guerre du Moyen-Orient |

## 12. MÉCANIQUES DE RECHERCHE (rappel et extensions)

- **Points de recherche** : générés par laboratoires, conseillers scientifiques, personnages (ex. **Hange**), écoles. Source `A`.
- **Accidents** : une expérience peut échouer (explosion, perte de matériel, blessure) ; probabilité selon la technologie (`risk`) et le conseiller.
- **Espionnage technologique** : vol de plans (renseignement) ; **un vol réussi ne contourne pas** la règle des anachronismes sans divergence assumée.
- **Adoption** : une fois débloquée, une technologie s'**adopte progressivement** (courbe d'apprentissage) ; les troupes d'élite l'adoptent avant la milice.
- **Obsolescence** : certaines technologies (ex. armes du début) deviennent moins efficaces face aux contre-mesures.

## 13. DONNÉES À PRODUIRE

- `/data/techs/*.json` (≈ 70 entrées) avec : `id`, `tree`, `cost`, `prereqs`, `unlock_event`, `requires_*`, `effects`, `min_year`, `canon`, `risk`, `exclusive_with`.
- Icônes SVG originales pour chaque entrée (fichier 04).
- Textes en i18n : chaque technologie a une **fiche diégétique** (planche technique, note d'atelier) avec un statut de fiabilité `C/A/?` affiché comme tampon dans l'onglet Archives.
- `canon:check` : lit la colonne « Date min » et §11 ; échoue si une technologie n'a pas de `min_year`, ou si une technologie `C` avec `min_year ≥ 850` n'a pas d'`unlock_event` (règles R1/R2 du fichier 14 §3).



