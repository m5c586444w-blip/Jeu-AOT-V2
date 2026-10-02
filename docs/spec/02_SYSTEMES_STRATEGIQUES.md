

# 02 — SYSTÈMES STRATÉGIQUES

> Tous les chiffres ci-dessous sont des **valeurs de départ `[A]`** à placer dans `/data/balance/*.json` et à ajuster via `npm run sim:balance`.
> Chaque valeur affichée au joueur doit être **explicable** (`explain()` → liste de facteurs ± avec leur valeur).

## 1. BOUCLE DE JEU ET TEMPS

- **Temps réel avec pause**, 1 tick = 1 jour. Vitesses : pause, 1 (≈ 3 s/jour), 2, 3, 4, 5.
- Cycles : **hebdomadaire** (logistique, rapports), **mensuel** (économie, budgets, recrutement), **annuel** (promotions, impôts, vieillissement, **horloge des 13 ans**).
- **Saisons** : hiver réduit la production agricole (−35 %), augmente la consommation de gaz (chauffage) et la mortalité des réfugiés.
- **Jour/nuit** tactique indépendant du tick stratégique mais lié à l'heure de lancement des expéditions.
- Le jeu **s'arrête automatiquement** sur : bataille déclenchée, événement majeur, mort d'un personnage clé, rupture de ressource critique, rapport de renseignement urgent.

## 2. ENTITÉS PRINCIPALES

`Province`, `Region`, `Organisation` (armée, culte, cabinet…), `Unite` (escouade, régiment, flotte…), `Expedition`, `Personnage`, `Titan` (porteur/pur), `Traite`, `Evenement`, `Ressource`, `Batiment`, `Technologie`, `Rapport`.

## 3. ÉCONOMIE ET LOGISTIQUE

### 3.1 Ressources
| Ressource | Rôle | Remarque |
|---|---|---|
| **Nourriture** | Survie de la population/armée | Production agricole, stocks, rationnement |
| **Gaz** | ODM | Tiré de la pierre à éclatement de glace ; production limitée, coûteuse, stockée en dépôts |
| **Acier / lames** | Équipement | Acier ultra-dur ; usure par combat, qualité variable |
| **Pierre à éclatement de glace** | **Source du gaz d'ODM** `[C]` | Propre à Paradis ; extraite de cavernes sous la ville-usine ; convoitée par Hizuru et Marley |
| **Poudre / explosifs** | Canons ; **Lances de foudre dès la fin de 850 seulement** | Chaîne de production dédiée |
| **Chevaux** | Mobilité terrestre | Élevage + entretien (fourrage) |
| **Hommes** | Recrutement | Dépend de la population, du moral, des lois |
| **Charbon / Pétrole (Marley)** | Industrie, trains, navires | Dépendance externe |
| **Or / Crédit** | Budget courant | Revenus d'impôts, commerce |

### 3.2 Production et consommation (formules de départ)
- Production provinciale = `base × (1 + bonus_bâtiments + bonus_techs) × (moral_factor) × (stabilité_factor) × (saison)`.
- Consommation de nourriture : `population × 0.01 + armée × 0.02 par jour` (échelle abstraite).
- **Pénurie** : si stock < 0 → famine locale → moral −, mortalité +, désertion +, troubles.
- **Rationnement** : 3 niveaux (normal/réduit/strict) : −15 % / −30 % consommation ; moral −3/−8, productivité −5/−12.
- **Stockage** : greniers, dépôts de gaz ; capacités limitées ; pertes par vol/corruption (%).

### 3.3 Logistique militaire
- Chaque armée/expédition a une **chaîne d'approvisionnement** : dépôts, relais, convois.
- **Rayon de ravitaillement** depuis un dépôt ou un mur ; au-delà : attrition.
- **Convois** : lents, vulnérables, interceptables (Titans, bandits, Marley).
- **Gaz et lames** consommés par combat ; réapprovisionnement possible seulement dans des **dépôts** ou **chariots de soutien**.

### 3.4 Bâtiments (exemples)
Ferme, grenier, mine, forge, atelier d'ODM, fabrique de gaz, poudrière, caserne, école militaire, hôpital militaire, relais postal, tour d'observation, palissade, bunker anti-Titan, chantier naval (Marley), usine, voie ferrée, aérodrome (Marley), chapelle des Murs, imprimerie (propagande).

## 4. POPULATION, SOCIÉTÉ, MORAL

- Chaque province a des **strates** (cf. fichier 01 §4) avec : effectif, **satisfaction**, **radicalisation**, **loyauté** envers chaque organisation.
- **Moral national** (0–100) = f(nourriture, victoires/défaites, propagande, sécurité perçue, légitimité, pertes récentes).
- **Réfugiés** : après une brèche, afflux massif (scénario 845) → surcharge logistique, tension, criminalité, épidémies.
- **Lois et décrets** (≈ 40 au départ) : conscription, rationnement, censure, couvre-feu, expropriation, mobilisation des civils, liberté de la presse, politique de la mémoire, etc.
- **Mouvements** : syndicats/guildes, mouvements religieux, factions politiques, mouvements radicaux. Chacun peut devenir **allié, neutre ou ennemi** en fonction des décisions.

## 5. POLITIQUE ET LÉGITIMITÉ

- **Légitimité** (0–100) : base du régime. Sources : tradition royale, résultats, sécurité, religion, justice perçue.
- **Cabinet** : sièges tenus par des personnages avec **agenda** (ex. réformateur, conservateur, opportuniste). Les votes sont simulés ; le joueur peut négocier, acheter, menacer, révéler des secrets.
- **Culte des Murs** : influence sur moral, loyauté et information ; peut s'opposer à des décisions (ex. exploration extérieure).
- **Coups d'État / crises** : seuils de légitimité, loyauté militaire, soutien populaire, présence d'un prétendant.
- **Secrets** : ressources politiques à découvrir/exploiter ; révélations → effets massifs (ex. « vérité sur les Murs »). Chaque secret a un **niveau de certitude** (rumeur/indice/preuve).

## 6. RENSEIGNEMENT ET ESPIONNAGE

- **Brouillard de guerre** strict : les provinces non observées affichent des **estimations datées** (« vu il y a 12 jours »).
- **Agents** : infiltrés, informateurs, espions de cour. Paramètres : couverture, loyauté, risque, spécialité.
- **Opérations** : surveiller, recruter, saboter, falsifier des rapports, voler des documents, assassinat ciblé, désinformation.
- **Rapports** : bruités par défaut (ex. ±20 % sur effectifs, délais). La qualité dépend de l'agent, de la distance, de la technologie (télégraphe, pigeon, relais).
- **Contre-espionnage** : Brigade Militaire (Paradis), services marleyens, détection de taupes ; fausses pistes possibles.
- **Marley** : réseau d'espions chez les Eldiens ; les Volontaires infiltrent Marley.

## 7. RECHERCHE ET DOCTRINE

- **Arbres** (≈ 60 technologies de départ) : *ODM & équipement*, *Anti-Titan*, *Médecine*, *Logistique*, *Fortification*, *Renseignement*, *Armes modernes* (Marley), *Aviation/Marine* (Marley/Hizuru), *Administration*.
- **Mécanisme** : points de recherche (organisations + personnages-scientifiques ex. **Hange**), **expériences** (captures de Titans) → déblocage, mais aussi **accidents**.
- **Doctrines** : choix mutuellement exclusifs (ex. *Manœuvre agile* vs *Fortification*; *Formation de reconnaissance longue portée* vs *Colonnes lourdes*).
- **Contre-mesures** adaptatives : Marley développe une doctrine contre les Titans durcis, etc.
- **Gating canon** : certaines technologies n'apparaissent qu'après un événement : **Lances de foudre** (après la saisie des technologies de la Police intérieure, fin 850), **bateau volant** (Hizuru, ≈ 854), **fusils anti-Titan** (Marley, 854). ODM anti-personnel : Police intérieure, avant 850. Champ `unlock_event` dans les données (voir fichier 11).

## 8. EXPÉDITIONS (couche stratégique ↔ tactique)

- Une **expédition** = mission planifiée avec : objectif, itinéraire, composition, ravitaillement, signaux, **plan de retrait**.
- **Objectifs types** : reconnaissance, exploration d'une zone, récupération d'un point, escorte, capture d'un Titan, extraction, assaut d'un fort.
- **Phases** : préparation (planning + budget) → exécution (temps réel avec pause) → retour/pertes → rapport.
- **Choix de résolution** : *jouer la bataille* ou *auto-résoudre* (voir fichier 03 §12).
- **Formations** (cf. 03 §6) : le joueur définit la composition et l'ordre de marche ; l'IA exécute les signaux selon règles.
- **Coût politique** : chaque expédition consomme du **capital politique**, sensible aux pertes et à l'opinion.

## 9. PERSONNAGES

### 9.1 Attributs
Combat (ODM, mêlée, tir), Commandement, Tactique, Intellect, Charisme, Endurance, **Sang-froid** (stress), Loyauté, Ambition, Foi, Santé.
Spécialités : ODM d'élite, éclaireur, médecin, ingénieur, stratège, espion, administrateur, chef religieux.

### 9.2 Traits (≈ 40, 2–4 par personnage)
Exemples : *Obstiné*, *Pragmatique*, *Charismatique*, *Terrorisé*, *Fanatique du Mur*, *Idéaliste*, *Opportuniste*, *Vétéran des brèches*, *Traumatisé de Trost*, *Meneur né*, *Froid*, *Solitaire*, *Dévoué*, *Rancunier*, *Curieux*, *Cynique*, *Ackerman* (éveil), *Hanté* (Titan-hôte), *Soupçonneux*.

### 9.3 Stress, traumatisme, relations
- **Stress** cumulatif : combats, pertes d'amis, échecs ; seuils → **panique**, **blessure psychique**, **refus d'ordres**, **désertion**.
- **Relations** : amitié, rivalité, amour, dette, haine ; modifient la coopération, le moral d'escouade, les réactions aux décisions du joueur.
- **Mort** : définitive ; effets sur proches, escouades, politique. **Aucune « mort propre »** : chaque mort affiche un **dossier** (cause, circonstances, conséquences).
- **Promotion et succession** : système de grades ; vacances → candidats avec intérêts propres.

## 10. TITANS : PORTEURS, HÉRITAGE, MÉMOIRE

- **Porteur** : personnage ayant un des Neuf. Attributs : *Taux d'adaptation*, *Contrôle*, *Endurance de transformation*, *Années restantes* (13 ans).
- **Horloge des 13 ans** : décompte visible ; décisions sur **héritage** (qui hérite ? qui est sacrifié ?) = mécanique centrale.
- **Transformation** : coût en endurance, **cooldown**, risque de perdre le contrôle (si stress extrême).
- **Héritage** : l'ingestion exige un **Titan pur** ou un porteur ; le jeu simule la préparation (capture, injection, choix de la victime).
- **Mémoire/Chemins** (scénarios avancés) : événements « visions » donnant des **informations non fiables** au joueur ; coûts mentaux ; possibilité de manipuler des mémoires en Fondation royale.
- **Titans-Murs et Fondateur** : le Fondateur n'est pleinement exploitable que par un porteur de **sang royal** ; Eren, non royal, n'y parvient qu'au contact d'un descendant royal (Zeke) via les Chemins `[C]`. Ne pas confondre **Ymir Fritz** et **Ymir** (stagiaire, Mâchoire). Voir événements scénarisés.

## 11. DIPLOMATIE ET GUERRE

- **Relations** : confiance, intérêt, peur, idéologie. **Traités** : alliance, pacte de non-agression, accords commerciaux, rançons, accords de renseignement.
- **Casus belli**, **propagande**, **ultimatums**, **sanctions**, **embargo** (ex. Marley sur Paradis).
- **Hizuru** : neutre intéressé, vend équipement/ressources contre garanties ; peut changer de camp.
- **Alliés** : coalition fragile, logistique conjointe, désaccords internes.
- **Guerre moderne (Marley)** : front, artillerie, aviation, marine, **projection de Titans** (porteurs comme armes stratégiques, avec usure et coût politique).

## 12. ÉVÉNEMENTS ET DIVERGENCE (moteur)

- **Événement** = `{ id, déclencheur, conditions, texte, choix[], effets[], statut canon }`.
- **Mode Canon Fidèle** : les événements historiques se déclenchent dans une **fenêtre de temps** si les conditions de contexte restent proches de l'histoire ; si le joueur dévie suffisamment, le moteur bascule en **branche divergente** (`divergence_score`).
- **Chaînes d'événements** : conséquences à court/moyen/long terme (ex. une réforme du Culte → soulèvement 6 mois plus tard).
- **Textes** : écrits sobres, sans formules toutes faites, ancrés dans le matériel (rapports, lettres, télégrammes, articles).

## 13. VICTOIRE ET DÉFAITE

Pas de « victoire unique » : **objectifs par faction/scénario** (survie, vérité, réforme, domination, paix, extermination, sacrifice).
**Exemples** :
- *Paradis (850)* : survivre 5 ans ; sécuriser Wall Maria ; découvrir la vérité ; obtenir un accord extérieur.
- *Marley (854)* : récupérer le Fondateur ; neutraliser Paradis ; stabiliser l'empire.
- *Hizuru* : préserver l'indépendance, empêcher l'extermination.
- *Grondement* : empêcher/accomplir/limiter ses effets (plusieurs fins).

Défaites : effondrement de légitimité, famine totale, destruction du gouvernement, perte du Fondateur, génocide, etc. **Fin de partie** = épilogue généré à partir des décisions marquantes.

## 14. IA DES FACTIONS

- **Personnalités** (ex. prudent, agressif, idéologue, pragmatique, opportuniste).
- **Objectifs** hiérarchisés (survie → ressources → influence → idéologie), adaptation selon la situation.
- **Décisions** : modèle d'utilité simple par défaut + règles ; explicabilité (journal de raisonnement debug).
- **Cohérence canon** : chaque faction possède des *attracteurs canon* (ex. Marley veut le Fondateur ; Hizuru cherche des garanties) qui orientent mais ne scénarisent pas.

## 15. ÉQUILIBRAGE DE DÉPART (échelle indicative `[A]`)

| Paramètre | Valeur |
|---|---|
| Population Paradis (845) | ~ 1 000 000 (abstrait) `[A]` |
| Corps de Reconnaissance | 200–500 membres (selon période) `[A]` |
| Garnison | 20 000–40 000 `[A]` |
| Brigade Militaire | 2 000–5 000 `[A]` |
| Taux de mortalité par expédition (début de partie) | 25–40 % `[A]` |
| Consommation de gaz par engagement ODM | 3–8 unités/combat `[A]` |
| Durée de vie moyenne d'un nouveau soldat d'élite | 4–7 ans `[A]` |
| Perte de moral par mort de proche | −5 à −15 `[A]` |

> Prévoir un fichier `balance/difficulty.json` avec 4 niveaux (*Récit*, *Normal*, *Rude*, *Brèche*).



