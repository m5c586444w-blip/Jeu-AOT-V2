

# 12 — LES 60 ÉVÉNEMENTS CANON

> Convention `C` / `A` / `?` (voir fichier 11 : **il prime sur ce fichier** en cas de contradiction).
> **Ce qui est canon** : l'existence, l'ordre et le contexte de l'événement. **Ce qui est `A`** : les choix proposés au joueur, les coûts, les effets chiffrés et les règles de divergence.
> **Dates** : l'année est donnée quand elle est recoupée ; les mois sont **toujours `?`** (aucune source consultée ne donne de calendrier fin fiable). Le jeu utilise donc un **ordre relatif** (« N jours après l'événement X »).
> Sources de la chronologie : Wikipédia (saisons 2, 3, 4), chronologies de presse et wikis communautaires (non officiels). À recouper avec le manga.

## 0. FORMAT D'UN ÉVÉNEMENT (rappel du schéma, fichier 05)

```json
{
  "id": "evt_850_trost_breach",
  "canon": "C",
  "window": { "after": "evt_850_104th_graduation", "within_days": [0, 10], "year": 850 },
  "trigger": ["scenario in [850]", "wall_rose.trost.state == 'intact'"],
  "choices": [ { "id": "defend", "cost": {...}, "effects": [...] } ],
  "effects_default": [...],
  "divergence_weight": 0.8,
  "unlocks": ["tech_wall_crystal_sealing"],
  "blocks": [],
  "text_key": "evt.850.trost.breach"
}
```

- `window.after` : l'événement précédent obligatoire (graphe de dépendance, §3).
- `divergence_weight` : de combien cet événement fait monter le `divergence_score` s'il est évité ou modifié.
- `unlocks` : technologies, personnages, lieux ou fonctions débloqués (voir fichier 13).

## 1. TABLE DES 60 ÉVÉNEMENTS

### A. Chute de Maria et conséquences (845–847)

| ID | Événement | Quand / déclencheur | Choix du joueur `A` | Effets et divergence |
|---|---|---|---|---|
| E01 | **Brèche de Shiganshina** (Colossal) | 845, début du scénario 845 | Évacuer en priorité les civils / tenir la porte / alerter Rose | Pertes civiles ×3 si tenir la porte ; ouvre E02. Évité = divergence maximale |
| E02 | **Chute de la porte de Wall Maria** (Cuirassé) | Suite immédiate de E01 | Replier les soldats vers Rose / les sacrifier pour couvrir | Titans entrent dans l'anneau de Maria ; Maria devient « zone perdue » |
| E03 | **Massacre de la famille royale** (hors champ, Grisha) | 845, le même jour | Aucun (événement caché) ; révélé plus tard | Frieda Reiss meurt ; le Fondateur passe à Grisha puis à Eren ; seul Rod survit. Info cachée au joueur |
| E04 | **Repli vers Wall Rose** | 845, après E02 | Ouvrir toutes les portes / limiter les entrées | Afflux de réfugiés (E05) ; tension Rose/Sina |
| E05 | **Crise des réfugiés** | 845–846, après E04 | Rationner / réquisitionner / refouler | Famine locale, criminalité, épidémies ; baisse de légitimité |
| E06 | **Opération de reconquête de 846** | 846, si pénurie de nourriture | Envoyer les surplus de population (chiffre canon ≈ 250 000 `?`) / refuser | Pertes massives ; allège la nourriture mais détruit la légitimité si accepté. Refus = divergence forte |
| E07 | **Disette de 846** | Conséquence de E05/E06 | Rationnement strict / marché noir / aide marchande | Moral −, troubles ; ouvre des options pour les guildes |
| E08 | **Recrutement de la 104ᵉ promotion** | ≈ 847 `?` | Financer l'école / réduire la durée | Fixe la qualité de la 104ᵉ (E09) |

### B. Bataille de Trost (850)

| ID | Événement | Quand / déclencheur | Choix du joueur `A` | Effets et divergence |
|---|---|---|---|---|
| E09 | **Remise des diplômes de la 104ᵉ** | 850 | Orienter les meilleurs vers la Brigade / le Corps / la Garnison | Répartition des élites ; avant E10 |
| E10 | **Brèche de Trost** (Colossal) | 850, peu après E09 | Évacuer / tenir la porte / mobiliser la 104ᵉ | Ouvre E11 ; divergence si la brèche est empêchée (garnison renforcée au sud) |
| E11 | **Défense de Trost** | Suite de E10 | Évacuation prioritaire / défense des toits / sacrifier un secteur | Pertes énormes dans la 104ᵉ ; **déclenche la capture de Titans pour étude** (Hange) |
| E12 | **Première transformation d'Eren** | Pendant E11, si Eren est en danger mortel | Aucun (événement scénarisé) ; le joueur choisit la réaction (tirer / retenir) | Révèle un porteur sur Paradis ; **pilier narratif** ; divergence max si évité |
| E13 | **Bouchage de la brèche** | Après E12 | Utiliser Eren / procéder sans lui / abandonner Trost | Succès → Wall Rose tient ; débloque la techno de scellement par durcissement (fichier 13) |
| E14 | **Procès d'Eren** | Après E13 | Remettre Eren à la Brigade / à la Garnison / au Corps | Choix politique majeur ; Pixis et Erwin plaident ; divergence selon la garde |
| E15 | **Choix des branches** | Après E14 | Aucune contrainte (le joueur gère les nominations) | Détermine le noyau du Corps et de la Garnison |

### C. Expédition 57 et Stohess (850)

| ID | Événement | Quand / déclencheur | Choix du joueur `A` | Effets et divergence |
|---|---|---|---|---|
| E16 | **Préparation de l'expédition 57** | Après E15 | Budget / itinéraire (Karanes → Shiganshina) / formation | Coûts politiques ; débloque l'**arme de contention spéciale** pour la capture |
| E17 | **Expédition 57** | Après E16 | Formation d'éventail / colonnes lourdes / escorte | Un Titan féminin attaque la formation ; pertes élevées ; **la formation de reconnaissance longue portée** est testée |
| E18 | **Forêt des Arbres Géants** | Pendant E17 | Piège / retraite / sacrifier l'arrière-garde | Succès partiel ; décisions sur Eren |
| E19 | **Perte de l'escouade d'élite d'origine** | Fin de E18 `?` | Aucune | Mort de membres de l'escouade spéciale ; moral ; l'unité est recomposée |
| E20 | **Enquête sur les traîtres** | Après E19 | Interroger les recrues / surveiller / laisser faire | Révélations progressives |
| E21 | **Opération de capture à Stohess** | Après E20 | Piège urbain / évacuation préalable / négociation | Dégâts à Stohess ; implique la Brigade |
| E22 | **Cristallisation d'Annie** | Fin de E21 | Aucune (événement scénarisé) ; le joueur choisit comment la garder | Révèle les murs faits de Titans-Murs ; **ouvre E23** |
| E23 | **Découverte d'un Titan-Mur à Sina** | Immédiat après E22 | Rendre public / censurer / étudier en secret | Info stratégique majeure ; légitimité ± ; Culte réagit |

### D. Invasion de Wall Rose (850)

| ID | Événement | Quand / déclencheur | Choix du joueur `A` | Effets et divergence |
|---|---|---|---|---|
| E24 | **Titans dans Wall Rose** (Bestial) | Après E23 | Recherche de la brèche / évacuation / redéploiement | Les murs restent intacts : le mystère domine |
| E25 | **Ragako** | Pendant E24 | Enquêter / évacuer les villages voisins / détruire | Découverte d'un village transformé en Titans ; moral |
| E26 | **Bataille d'Utgard** (nuit) | Après E25 | Tenir la tour / sortir / diversion | Titans actifs la nuit ; **pertes de l'escouade de Mike et d'autres** ; le château est détruit |
| E27 | **Révélations : Ymir et Historia** | Pendant E26 | Aucune | Identité d'Historia ; Ymir porte la Mâchoire ; **les infiltrés sont démasqués** |
| E28 | **Combat contre le Cuirassé et le Colossal** | Après E27 | Protéger Eren / poursuivre / replier | Eren et Ymir enlevés ; **Armin et d'autres** sont touchés |
| E29 | **Fermeture des portes de Sina** | Pendant le procès d'Erwin (E32), à l'annonce de la brèche de Rose | Ouvrir / garder fermé | Le conseil refuse d'abriter les réfugiés de Rose ; la rupture avec Sina est consommée |

### E. Gouvernement royal et coup d'État (850)

| ID | Événement | Quand / déclencheur | Choix du joueur `A` | Effets et divergence |
|---|---|---|---|---|
| E30 | **Traque du Corps par la Brigade** | Après E29 | Se cacher / se rendre / riposter | Le Corps est piégé par une accusation de meurtre |
| E31 | **Combat de rue Levi / Kenny (Stohess)** | Pendant E30 | ODM anti-personnel / fuite / négociation | **Le Corps découvre l'ODM anti-personnel** ; Kenny transmet un sérum à Levi avant de mourir `?` |
| E32 | **Procès d'Erwin** | Après E31 | Défense publique / négociation / évasion | Divergence forte si Erwin est exécuté |
| E33 | **Coup d'État** | Après E32 | Sans violence (Pixis, Nile) / avec violence | Renversement du faux roi ; choix de Nile = point de bascule |
| E34 | **Chapelle Reiss** | Après E33 | Fuir / affronter | **Secret majeur** (Fondateur, mémoires) ; rôle d'Historia |
| E35 | **Titan de Rod Reiss** | Fin de E34 | Combattre / évacuer Orvud | **Titan de ≈ 120 m** ; Orvud ravagé ; mort de Rod |
| E36 | **Couronnement d'Historia** | Après E35 | Qui conseille la reine / quelle politique | Reine nominale ; légitimité à reconstruire |
| E37 | **Saisie des technologies de la Police intérieure** | Après E36 | Étudier / détruire / partager | **`unlock_event` des Lances de foudre** (Hange) ; accès aux archives de la Police intérieure |

### F. Retour à Shiganshina (850) et ouverture

| ID | Événement | Quand / déclencheur | Choix du joueur `A` | Effets et divergence |
|---|---|---|---|---|
| E38 | **Préparatifs de Shiganshina** | Après E37 | Effectifs / chevaux / Lances de foudre | Plan d'Erwin ; budget ; risque de fuite |
| E39 | **Bataille de Shiganshina** (Bestial) | Après E38 | Plan standard / alternatif / retrait | Le Bestial bloque la porte ; combat sur le mur |
| E40 | **Premier emploi des Lances de foudre** | Pendant E39 | Cible : Cuirassé / Colossal / Bestial | Perce l'armure durcie ; **première utilisation canon** |
| E41 | **Charge d'Erwin** | Pendant E39 | Charge sacrificielle / replier | Divergence forte si évitée ; mort d'Erwin en canon |
| E42 | **Choix du sérum** | Fin de E41 | Erwin / Armin | Armin reçoit le Colossal en canon ; **le choix change tout** |
| E43 | **Sous-sol des Yeager** | Après E42 | Lire tout / copier / détruire | Révélation du monde extérieur |
| E44 | **Nettoyage de Wall Maria** | Après E43 | Priorité villes / routes / ports | ≈ 9 mois ; repeuplement ; Titans éliminés `?` |
| E45 | **Découverte de l'océan** | Après E44 | Fonder un port / explorer | Ouvre les relations extérieures |

### G. Années de transition (851–853)

| ID | Événement | Quand / déclencheur | Choix du joueur `A` | Effets et divergence |
|---|---|---|---|---|
| E46 | **Première flotte de reconnaissance de Marley** | 851 | Accueillir / refuser / saisir | Contact avec le monde ; **Volontaires anti-Marleyens** à bord |
| E47 | **Volontaires anti-Marleyens** | 851–852, après E46 | Accepter l'alliance / interner / expulser | Accès à des sérums et à des informations ; **Yelena, Onyankopon** |
| E48 | **Visite d'Hizuru et chemin de fer** | 851–852 `?` | Commerce / monopole / refus | Début des relations avec Hizuru ; chantier ferroviaire |
| E49 | **Départ d'Eren (infiltration à Marley)** | 851–854 `?` | Laisser partir / retenir | Eren s'infiltre dans l'armée marleyenne ; divergence si retenu |
| E50 | **Guerre du Moyen-Orient** | 851–854 | Rester neutre / soutenir / profiter | Marley contre les Forces Alliées ; **tension Marley/Hizuru** |
| E51 | **Refus d'Hizuru d'un commerce ouvert** | 853 | Négocier / passer outre | Monopole sur les ressources de Paradis ; isolement |
| E52 | **Perte des navires de reconnaissance marleyens** | ≈ 851–854 | Capturer / couler / ignorer | Marley comprend que Paradis détient au moins deux Titans |

### H. Guerre et Grondement (854)

| ID | Événement | Quand / déclencheur | Choix du joueur `A` | Effets et divergence |
|---|---|---|---|---|
| E53 | **Bataille de Fort Slava** | 854, fin de E50 | Côté Marley / côté Alliés | Flotte alliée détruite par le Bestial ; victoire de Marley |
| E54 | **Décision de l'Opération Paradis** | 854, après E53 | Soutenir / refuser (Marley) | Zeke propose de reprendre le Fondateur ; la famille Tybur choisit de soutenir |
| E55 | **Raid sur Liberio** | 854, après E54 | Empêcher / laisser faire / se préparer | **Willy Tybur est tué** ; Eren hérite du Marteau de guerre |
| E56 | **Évasion de Liberio** | Après E55 | Fuite par mer / négociation | Zeke assigné à résidence côté Paradis ; traversée du monde extérieur |
| E57 | **Coup Yeagerist et assassinat de Zackly** | 854, après E56 | Réprimer / négocier / laisser | Pixis hérite brièvement du commandement ; tensions autour des Volontaires anti-Marleyens `?` |
| E58 | **Contre-attaque de Marley à Shiganshina** | Quelques jours après E57 | Défendre / évacuer | Pixis et Nile deviennent des Titans purs et meurent |
| E59 | **Déclenchement du Grondement** | 854, après E58 | Empêcher / retarder / laisser | Les Titans-Murs sont libérés ; l'humanité du monde est menacée |
| E60 | **Bataille du Ciel et de la Terre** | Fin de E59 | Alliance / sacrifice / négociation | Dénouement ; mort de Hange `C` ; fins multiples |

## 2. POINTS DE BIFURCATION MAJEURS (`A`)

Chaque point de bifurcation est une **décision à fort impact** qui peut faire basculer la partie en « histoire divergente ».

| Point | Événement | Choix | Conséquence en cascade |
|---|---|---|---|
| B1 | E06 | Envoyer / refuser l'opération de 846 | Famine, légitimité, population |
| B2 | E12 | Retenir Eren / laisser faire | Trost tombe ou tient |
| B3 | E14 | Garde d'Eren | Brigade, Garnison ou Corps contrôle le porteur |
| B4 | E33 | Coup d'État violent ou non | Légitimité, loyauté militaire |
| B5 | E41–E42 | Charge d'Erwin ; **sérum Erwin / Armin** | Qui hérite du Colossal ; destin du Corps |
| B6 | E47 | Accepter ou non les Volontaires | Accès aux sérums, aux informations, à l'allié marleyen |
| B7 | E49 | Laisser Eren partir | Liberio, Marley |
| B8 | E55 | Liberio | Guerre totale ou paix armée |
| B9 | E59 | Grondement | Fins du jeu |

## 3. GRAPHE DE DÉPENDANCES (ordre obligatoire)

```
E01 → E02 → E04 → E05 → E06 → E07
E08 → E09 → E10 → E11 → E12 → E13 → E14 → E15
E15 → E16 → E17 → E18 → E19 → E20 → E21 → E22 → E23
E23 → E24 → E25 → E26 → E27 → E28
E28 → E30 → E31 → E32 → E33 → E34 → E35 → E36 → E37
E29 se déclenche pendant E32 (annonce de la brèche de Rose)
E37 → E38 → E39 → E40 → E41 → E42 → E43 → E44 → E45
E45 → E46 → E47 ; E48 ; E50 (en parallèle) ; E49 ; E51 ; E52
E50 → E53 → E54 → E55 → E56 → E57 → E58 → E59 → E60
```
> `E03` est un événement caché, indépendant (845), qui ne se révèle qu'à E34.

**Règle `canon:check`** : si un événement est déclenché avant l'un de ses prédécesseurs, le jeu **avertit le joueur** (« divergence assumée ») et recalcule les fenêtres de présence des personnages (fichier 11 §3).

## 4. ÉVÉNEMENTS QUI DÉBLOQUENT DE LA TECHNOLOGIE (lien avec le fichier 13)

| Événement | Technologie / fonction débloquée |
|---|---|
| E11 | Capture de Titans pour étude |
| E13 | Scellement par durcissement (Eren requis) |
| E16 | Arme de contention spéciale |
| E31 | ODM anti-personnel (accès pour le Corps), sérum (Kenny) |
| E37 | **Lances de foudre** (Hange vivante requise), archives de la Police intérieure |
| E40 | Lances de foudre en production de masse |
| E42 | Protocole d'héritage de Titan |
| E45 | Ports et marine |
| E47 | Liaison avec les Volontaires, sérums |
| E48 | Chemin de fer de Paradis |
| E53 | Contre-mesures alliées anti-Titan (côté Marley) |

## 5. ÉVÉNEMENTS GÉNÉRIQUES ASSOCIÉS (150, à produire)

En plus des 60 événements canon, produire **150 événements génériques** répartis ainsi (voir fichier 05 §3) :
- 40 événements **civils** (famine locale, rumeur, grève, épidémie, mariage, fête).
- 30 événements **militaires** (désertion, mutinerie, accident d'ODM, vol de gaz, duel).
- 25 événements **politiques** (scandale, pétition, procès local, lettre anonyme).
- 20 événements **de personnage** (deuil, promotion, trahison, confession).
- 15 événements **Titans** (anormal, migration, attaque nocturne, découverte de ruines).
- 10 événements **monde** (marchands étrangers, tempêtes, signaux lointains).
- 10 événements **Marley/Hizuru/Alliés** (espionnage, embargo, mission diplomatique).

Chaque événement générique doit : respecter les **fenêtres de présence** (fichier 11 §3), ne **jamais** utiliser un objet ou un lieu avant sa date (ex. Lances de foudre), et faire apparaître **un coût concret** pour chaque choix.

## 6. DONNÉES À PRODUIRE

- `/data/events/canon.json` (60 entrées), `/data/events/generic.json` (150), `/data/events/graph.json` (dépendances §3), `/data/events/bifurcations.json` (§2).
- Textes dans `/i18n/fr.json` : ton sobre, pas de formules toutes faites, chaque événement avec **un dossier diégétique** (rapport, lettre, télégramme).
- `npm run canon:check` doit lire `graph.json` et refuser toute dépendance cyclique.



