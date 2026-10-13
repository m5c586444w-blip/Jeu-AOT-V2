# 26 — MÉCANIQUES THÉORIQUES (proposition à valider)

> **Statut : VALIDÉ par Gabriel le 2026-10-13**, avec une modification (P2, voir ci-dessous) et deux points encore ouverts (§12).
> Ce fichier prime sur 02 et 03 pour les mécaniques qu'il décrit ; il est subordonné à `ERRATA_V3.md`.
> Étiquettes : `[C]` canon (établi dans 01/11) · `[A]` création ou adaptation du projet, paramétrable dans `/data` · `[?]` incertain.
> Depuis ERRATA_V3, créer un élément précis de l'univers (nom, lieu, enseigne, apparence) est **autorisé** ; on l'étiquette `[A]` et on ne le présente jamais comme canon.
> Limite : ce document a été rédigé **sans relire le code**. Le « statut » de chaque pilier dit seulement ce que les specs 02, 03 et 09 prévoient ; l'état réel d'implémentation est à auditer (tâche A0 de `docs/coord/COORD.md`).
> Ligne éditoriale : **réalisme, fidélité au lore, jouabilité**.

---

## 0. Diagnostic et principe

Les specs 02, 03 et 09 (≈ 330 fonctionnalités) décrivent déjà un jeu complet. Ce qui manque n'est pas une liste de systèmes mais une **signature** : quelques mécaniques qui font que partie après partie, on joue à *L'Attaque des Titans* et non à un jeu de stratégie générique habillé aux couleurs de l'œuvre.

Test de signature à appliquer à chaque mécanique : **« Si on remplace les Titans par des orcs et les murs par des remparts quelconques, la mécanique survit-elle telle quelle ? »** Si oui, elle n'est pas distinctive : on la garde si elle est utile, on ne la compte pas comme signature.

Sept piliers, chacun avec : idée, règles, interactions entre échelles, décisions du joueur, test d'acceptation.

| # | Pilier | Ce qui le rend propre à cette œuvre |
|---|---|---|
| P1 | **Le Mur** | Une humanité enfermée dans trois anneaux ; la pression démographique est le moteur politique |
| P2 | **La Marée** | Les Titans purs sont un phénomène (champ de densité), pas une armée qu'on recrute ou qu'on bat une fois |
| P3 | **Le Gaz et l'Ancrage** | La mobilité est une ressource, le terrain est l'arme, chaque combat a un coût stratégique |
| P4 | **Le Signal** | On commande sous information imparfaite : fusées, relais, délais, erreurs |
| P5 | **L'Horloge** | Les porteurs sont un trésor qui se consume (13 ans), un secret et une arme à commander |
| P6 | **La Vérité** | Le monde est partiellement faux pour le joueur ; découvrir change les règles |
| P7 | **Le Registre** | Chaque mort est un dossier avec des conséquences ; la troupe a une mémoire |

---

## 1. Trois échelles, une seule économie

Le jeu s'articule sur trois échelles qui **échangent les mêmes ressources** (c'est ce qui évite le « mini-jeu de bataille collé sur une carte ») :

| Échelle | Durée simulée | Mode | Ce que le joueur décide |
|---|---|---|---|
| **Stratégique** | mois | tour continu avec pause active | politique, production, recherche, lois, diplomatie, composition des armées |
| **Opérationnelle** | jours / heures | temps réel avec pause sur la carte | itinéraires, formations, règles de signal, ravitaillement, retraits |
| **Tactique** | secondes / minutes | temps réel avec pause, 20 Hz déterministe | ordres d'escouade, ordres généraux aux porteurs, suivi d'escouade |

**Flux entre échelles** `[A]` :
- La tactique **consomme** : gaz, lames, effectifs, moral, capital politique.
- La tactique **produit** : densité de Titans modifiée (P2), ancrages détruits (P3), dossiers de morts (P7), informations (P6).
- L'opérationnel **fixe les conditions** de la bataille : heure, terrain, formation, signaux, état des vivres.
- La stratégie **fixe les moyens** : ce qui est disponible en dépôt, qui est promu, quelle doctrine est recherchée.

**Armées en piles sur la carte** (référence Total War, décision de Gabriel) :
- Une pile = escouades (4–6) groupées en détachements ; vitesse = la plus lente ; **empreinte** (bruit, fumée, taille) qui attire les Titans (P2) et révèle la position aux ennemis humains.
- Rencontre de piles ou de Titans → proposition « jouer la bataille / l'auto-résoudre / se replier » (auto-résolution : même moteur que la bataille jouée, statistiques proches, test automatique — cf. 03 §12).
- **Mode « Simulation de bataille »** depuis le menu principal : choix du lieu, des camps, des effectifs, de l'heure et de la météo, d'un scénario historique ou libre, puis jouer ou auto-résoudre. C'est aussi l'outil de test de l'équilibrage.

---

## 2. P1 — Le Mur

**Idée.** Les trois anneaux (Maria, Rose, Sina) sont des *réservoirs* : population, surface agricole, ancrages défensifs. La perte d'un anneau ne se compte pas en provinces mais en **pression** sur les autres.

**Variables par district** `[A]` : `population`, `capacité_alimentaire`, `rations`, `ordre_public`, `état` (intact / brèche / abandonné / reconquis), `ancrages`, `garnison`.

**Pression** `[A]` : `pression = population / capacité_alimentaire` (par anneau et par district).
- Seuils paramétrables : tendu → rationnement ; critique → émeutes, criminalité, épidémies ; rupture → événement imposé.
- La pression se propage aux districts voisins par les flux de réfugiés.

**Brèche.**
- Une porte ou un tronçon de mur brisé place le district en état *brèche* : le **front intérieur** apparaît (Titans entrés, évacuation civile).
- **Sous-jeu d'évacuation** : les civils suivent des routes vers les portes de l'anneau suivant ; chaque heure de retard coûte des vies ; ouvrir ou fermer les portes de l'anneau d'accueil est une décision à coût politique (cf. E04, E29 dans le fichier 12).
- La reconquête d'un district tombé n'est pas instantanée : le « nettoyage » abaisse progressivement la densité de Titans (P2), puis le repeuplement relance la pression.

**Désengorgement** (systémique, non scripté) `[A]` inspiré de E06 (≈ 250 000 personnes envoyées en 846, chiffre `[?]`).
- Quand `pression` dépasse un seuil pendant N mois, le jeu présente une décision à trois branches : **rationner** (légitimité ↓, ordre ↓), **désengorger** (envoyer des surplus hors des murs : pertes massives, légitimité ↓↓, pression ↓), **ouvrir de nouvelles terres** (coûteux, long, risque).
- Le canon est une des issues possibles, pas la seule ; refuser est une divergence forte (déjà prévu en E06).

**Décisions du joueur** : où concentrer la production, quand fermer une porte, combien de réserves, quelle politique de réfugiés.

**Tests** : (a) scénario 845 sans intervention : Maria tombe, la pression de Rose franchit le seuil critique avant 12 mois simulés, la décision de désengorgement est proposée ; (b) conservation : `population` totale = naissances − décès + flux (aucune création ni disparition) ; (c) aucune fuite d'information : un district non visité n'affiche pas sa pression exacte.

**Statut dans les specs** : partiel (02 §4 population et moral ; fichier 12 E04–E06).

---

## 3. P2 — La Marée

**Idée.** Les Titans purs ne sont pas une faction. Ce sont une **marée** qui répond aux humains : elle se concentre là où il y a du bruit, de la chaleur humaine et des corps, elle s'apaise la nuit et l'hiver `[C]` (cf. 03 §5.2 : activité réduite la nuit et l'hiver).

**Champ de densité** `[A]` :
- Une grille de cellules (résolution paramétrable) couvre l'extérieur des murs et les districts tombés ; chaque cellule porte `densité_titans` (≥ 0) et `activité` (jour/nuit/saison).
- Dynamique à chaque pas : diffusion lente, **attraction vers les concentrations humaines** (bruit, sang, population), accumulation contre les murs là où des humains se tiennent (cf. 03 §5.3).
- Les expéditions, les combats et les tirs de canon modifient localement la densité et créent des **pics d'attention**.
- Les Titans purs ignorent animaux et nourriture sauf stimulus `[C]` ; ils ne mangent pas pour vivre `[C]`.

**Rencontres** : le taux de rencontre d'une pile se calcule `λ = f(densité, empreinte, heure, visibilité)`, tiré avec l'aléa **injecté** de la simulation (jamais `Math.random`).

**Modèle d'attention tactique** (remplace le « Titan qui fonce sur le plus proche ») `[A]` :
- Chaque Titan pur a un `focus` choisi parmi les humains perçus selon distance, nombre (groupe), bruit, mouvement ; le `focus` décroît et se réattribue ; un appât bien placé détourne un Titan, un groupe compact en attire plusieurs.
- Types de comportement : **marcheur** (lent, direct), **anormal** (rapide, erratique, déjoue les pièges), **immobile** (nuit, hiver ; réveil par le bruit), **saturation** (plus de Titans que d'ancrages en un point).
- Classes de taille : 03 §5.2 (petit, moyen, grand, anormal) ; chaque classe a rayon de saisie, vitesse, cadence.

**Le Titan comme terrain** `[A]` :
- Zones de touche : nuque (mort), jambes/tendons (chute du Titan à genoux, ouvre la nuque), bras/yeux (aveuglement, détournement).
- Régénération : membres en N secondes, jamais la nuque détruite ; la régénération libère de la vapeur (visible) et coûte du temps, pas des ressources au Titan pur.
- Tactique d'escouade attendue : **deux** à immobiliser, **un** à tuer, **un** en couverture. C'est la leçon de lisibilité du combat.

**Effets stratégiques** : tuer des Titans abaisse la densité locale (réduit λ pour les convois suivants) ; une zone « nettoyée » se repeuple si le bruit humain persiste ; le Colossal et les porteurs ouvrent des brèches qui **injectent** de la densité dans un anneau.

**Décisions du joueur** : route de moindre densité, moment (jour/nuit), taille et bruit de la colonne, quand frapper pour nettoyer.

**Tests** : (a) déterminisme (même graine → même champ au pas N) ; (b) `densité ≥ 0` et conservation hors sources/puits déclarés ; (c) simulation comparée : une formation en éventail avec relais subit moins de pertes qu'une colonne compacte, à seuil fixé dans `balance/` ; (d) un appât détourne bien un Titan (test unitaire du `focus`).

**Statut dans les specs** : partiel (03 §5). Le champ de densité et le modèle d'attention sont **nouveaux**.

### 3 bis. Correction demandée par Gabriel : le champ de densité n'est pas le seul moteur de rencontres

Décision du 2026-10-13 : *non* au champ de densité comme moteur **unique**, parce que Marley et Paradis peuvent s'affronter **sans aucun Titan**. Le champ de densité reste le moteur des **rencontres avec des Titans** ; les rencontres entre forces humaines ont leur propre moteur.

**Moteur de rencontres général** `[A]` :
- Une rencontre naît de la **proximité de deux piles** (ou d'une pile et d'une place forte) sur la carte opérationnelle, quel que soit le camp. Les Titans ne sont qu'**une source parmi d'autres** : `rencontre = f(piles, empreinte, renseignement, visibilité, heure)`.
- Pour un affrontement humain, les facteurs sont : portée de détection (éclaireurs, signaux, P4), empreinte de la pile (taille, bruit, fumée, artillerie), terrain, ravitaillement, moral.
- Le champ de densité de Titans n'intervient que si le terrain en contient ; un front Marley–Paradis en Europe de l'Est ou sur la côte peut en être totalement exempt.

**Combat humain contre humain** `[A]` (pilier à part entière du jeu, non un cas particulier) :
- Armes : fusils, fusils à répétition (Marley), mitrailleuses `[?]`, mortiers, artillerie de campagne, ODM anti-personnel (Police intérieure, `[C]`), cavalerie, aviation et dirigeables (Marley, `[C]`).
- Mécaniques : couverts et lignes de vue réelles, suppression (le tir qui cloue au sol), moral et fuite, flanquement, ravitaillement en munitions, blessés et évacuation.
- L'ODM garde son avantage de mobilité verticale, mais contre des fusils son **coût** augmente : un soldat en vol est une cible (portée, vitesse, ancrage visible).
- Les **porteurs** restent des armes stratégiques : un porteur contre une ligne de fusils et d'artillerie n'est pas invincible ; l'artillerie lourde et les armes anti-Titan de Marley `[C]` sont les contre-mesures.
- L'économie du gaz (P3) s'applique aussi à l'ODM en bataille humaine ; les munitions s'ajoutent comme ressource stratégique.

**Tests** : (a) un scénario Marley–Paradis sans Titan (champ de densité nul) produit des rencontres, des batailles et des pertes ; (b) le moteur de rencontres est déterministe ; (c) un fantassin à découvert sous le feu perd plus de moral qu'à couvert (test de comportement).

---

## 4. P3 — Le Gaz et l'Ancrage

**Idée.** L'ODM n'est pas un déplacement libre : c'est un **réseau d'ancrages** et une **réserve de gaz**. Le terrain, le gaz, les lames et la fatigue forment le vrai système de combat.

**Triade de ressources** `[A]`, cf. 03 §3.2 et 4 :
- **Gaz** (≈ 100 u par soldat `[?]`, consommation 1–2,5 u/s en poussée) : issu de la pierre à éclatement de glace `[C]` ; production limitée, stockée en dépôts.
- **Lames** : acier ultra-dur `[C]` ; usure à chaque coupe ; casse possible ; remplacement 1,5 s.
- **Endurance et stress** : modulent précision, réaction, obéissance.

**Réseau d'ancrage** :
- Chaque structure expose des points d'ancrage (position, type, solidité) ; sans ancrage, pas d'ODM ; portée du crochet `[?]` 40–60 m.
- Les Titans, les incendies et la destruction **suppriment des ancrages** : une bataille urbaine devient plus dure au fur et à mesure qu'elle avance.
- **Carte d'ancrage** : avant la bataille, le joueur voit (ou estime s'il manque de renseignement, P6) la densité d'ancrage des secteurs. La forêt de grands arbres en regorge ; la plaine en manque.

**Chaîne de létalité** :
1. approche (vitesse, angle) → 2. ancrage → 3. **fenêtre de coupe** (≈ 0,2 s) → 4. résultat (nuque tranchée / blessure / chute / capture).
- Réussite = f(vitesse, angle, compétence, usure de la lame, stress). Un soldat touché par un Titan est presque toujours mort ou hors de combat `[A]` (03 §1) : la maîtrise consiste à **ne pas être touché**.
- Lisibilité : en pause active, un **cône d'ouverture** montre la fenêtre de coupe probable, et le journal de combat explique chaque mort (03 §9).

**Coût stratégique** :
- Chaque bataille ponctionne le **stock stratégique de gaz et de lames**. Une victoire qui vide les dépôts rend la suivante impossible ; la carte oblige à arbitrer.
- **Dépôts de ravitaillement** = objectifs tactiques (défendre ou reprendre le dépôt, scénario type inspiré de Trost `[A]`).
- Après la fin de 850 `[C]` : les **lances de foudre** tuent sans maîtrise de l'ODM, mais coûtent cher, ont un risque de tir fratricide et une portée faible. Elles **redistribuent la valeur** des soldats : l'élite d'ODM perd son monopole, les recrues deviennent utiles, la politique interne (corps d'élite contre masse) change. C'est un effet de doctrine, pas seulement un bonus.

**Décisions du joueur** : où livrer bataille (terrain riche en ancrages), quelle réserve de gaz engager, quand sacrifier un dépôt, quelle doctrine rechercher.

**Tests** : (a) un soldat ne se déplace qu'entre ancrages valides ; (b) sans gaz → chute ; (c) conservation du gaz entre tactique et stratégie ; (d) la suppression d'un ancrage change effectivement les chemins possibles.

**Statut dans les specs** : existe (03 §4, 02 §3) ; **nouveaux** : le coût stratégique par bataille, la carte d'ancrage, le cône d'ouverture, l'effet de doctrine des lances.

---

## 5. P4 — Le Signal

**Idée.** Le commandant n'a pas une carte omnisciente. Il voit ce que ses unités voient, et le reste lui arrive par **fusées, messagers et relais**, avec délai et risque d'erreur.

**Codes de signal** `[C]` (03 §7) : Corps de Reconnaissance (rouge : Titan repéré ; vert : changement de direction ; noir : Titan anormal) ; Garnison (vert : mission commencée ; rouge : échec ; jaune : réussite, annule un rouge précédent). Les autres couleurs ne sont pas retenues.

**Mécanique** `[A]` :
- Un signal est un objet : position, couleur, durée, rayon de visibilité (réduit par fumée, pluie, nuit, relief).
- **Relais** : une unité qui voit un signal peut le répéter selon les règles de sa formation ; chaque relais ajoute un délai ; un maillon manquant coupe la chaîne.
- **Erreurs** : mauvais code, fusée mouillée, fumée trop lourde, incompréhension (taux selon moral et formation).
- Le joueur voit un **fantôme d'information** : la dernière position connue d'une unité, avec l'âge de l'information.

**Niveaux de brouillard de commandement** (réglage de difficulté) :
- *Récit* : vision complète. *Normal* : vision directe + signaux, informations datées. *Rude* : signaux seulement.

**Doctrine programmable** (nouveauté clé) `[A]` :
- Avant une expédition, le joueur compose une **table de règles** : « si fusée rouge du secteur Est → dévier de 30° vers l'ouest » ; « si noire → repli de l'aile concernée » ; « si dépôt à moins de 5 km et gaz < 40 % → ravitailler ».
- L'IA exécute la table pendant l'expédition ; le joueur peut intervenir, mais l'information qu'il a est elle aussi retardée.
- La **formation de reconnaissance longue portée en éventail** `[C]` (03 §6) est l'instrument : l'éventail voit loin, relaie les fusées, dévie l'ensemble.

**Asymétrie** : Marley dispose de communications modernes `[?]` (télégraphe, radio : à confirmer en 11) qui réduisent délais et erreurs ; Paradis y répond par la discipline de formation. Cette asymétrie fait partie du choix de camp.

**Ordres et commandement** : les ordres sont des **intentions avec contraintes** (tenir, avancer, détourner, escorter, évacuer, incendier, couvrir, retraite) ; ils descendent la chaîne (chef d'escouade → unité) avec délai ; une escouade coupée de son chef retombe sur ses règles de formation.

**Tests** : (a) la fonction de visibilité d'un signal est déterministe et monotone (pire météo → portée ≤) ; (b) une formation avec relais détecte un Titan plus tôt qu'une colonne, à marge fixée ; (c) une table de règles produit les ordres attendus sur un scénario scripté ; (d) le mode *Rude* n'affiche aucune unité hors vision (test de fuite d'information).

**Statut dans les specs** : existe (03 §6, 7) ; **nouveaux** : brouillard à trois niveaux, relais et fantômes d'information, doctrine programmable.

---

## 6. P5 — L'Horloge

**Idée.** Un porteur est à la fois une personne, un secret, une arme et une dette de temps. Les neuf Titans forment un patrimoine fini qui se consume.

**Horloge des 13 ans** `[C]` (02 §10) : chaque porteur a des années restantes ; la mort ou la fin de l'horloge déclenche l'**héritage** (choix du successeur, parfois sacrifice). Invariant : chaque Titan des Neuf a exactement un détenteur ou aucun.

**Identité secrète** `[A]` :
- L'identité d'un porteur est une information (P6) connue de certains seulement. La **suspicion** s'accumule (témoins, anomalies, fuites, interrogatoires de la Police) ; un seuil déclenche un événement de démasquage ; les infiltrés (par exemple le groupe de Marley en 845 `[C]`) ont un niveau de couverture.
- Capturer plutôt que tuer : l'**extraction** du porteur (le porteur se trouve dans la nuque `[C]`) est un objectif spécial ; la Police intérieure dispose d'une arme de contention `[C]` (03 §3.2).

**Transformation** :
- Coût en endurance, délai 1–3 s, cooldown (03 §8.1) ; le déclenchement exige une blessure volontaire `[C]` (à recouper en 11), donc des mains entravées ou un porteur surpris peuvent empêcher la transformation `[A]`.
- **Contrôle** `[A]` : fonction de la **volonté** (but clair, ordre aligné avec ses convictions), du **stress** et des **liens**. Un ordre contraire à ses convictions réduit le contrôle ; une blessure grave accompagnée de stress extrême peut provoquer perte de contrôle ou détransformation involontaire.

**Porteurs commandés par l'IA avec ordres généraux** (décision de Gabriel) `[A]` :
- **Ordres généraux** : « ouvre la brèche », « tiens cette ligne », « protège cette escouade », « couvre le repli », « détruis la tour », « neutralise le Titan X ».
- **Autonomie** (0–100) dérivée du contrôle ; entre les ordres, l'IA choisit ses actions par modèles propres à chaque Titan (03 §8.2) : Colossal (onde de chaleur au contact), Cuirassé (charge, durcissement), Féminin (durcissement local, cri d'appel), Bestial (projectiles, contrôle de purs), Mâchoire (vitesse), Assaillant (mêlée, régénération), Marteau (constructions), etc.
- Risque : une autonomie faible est plus prévisible mais moins réactive ; un porteur à faible contrôle peut ignorer un ordre.
- Pour chaque capacité : coût, portée, délai, effet, limite (ex. le durcissement ne couvre pas toute la surface) — fiche de données dans `/data`.

**Arme stratégique** (Marley) : projeter un porteur coûte du capital politique, de l'usure et des années ; le joueur marleyen gère un **roster** qui se consume, avec arbitrage entre « utiliser maintenant » et « garder pour plus tard ».

**Tests** : (a) invariant des Neuf ; (b) l'horloge décrémente et déclenche l'héritage ; (c) un ordre contraire fait baisser le contrôle ; (d) un porteur non démasqué n'apparaît jamais comme tel dans l'interface (test de fuite).

**Statut dans les specs** : partiel (02 §10, 03 §8). **Nouveaux** : suspicion et démasquage, autonomie et volonté, extraction, arbitrage de roster.

---

## 7. P6 — La Vérité

**Idée.** Le monde a une vérité (réelle) et chaque faction n'en connaît qu'une partie, avec des erreurs. Découvrir est un jeu en soi, et certaines découvertes **changent les règles**.

**Modèle d'information** `[A]` :
- Chaque fait a `véracité` (vrai/faux) et, pour chaque faction, `connaissance` + `fiabilité` (A–D).
- Les rapports d'espions, les archives, les visions (Chemins `[C]` : informations **non fiables**, coût mental) alimentent un **dossier** du joueur qui montre la fiabilité, les contradictions, l'âge de l'information.
- Les décisions s'appuient sur ce que le joueur **croit** ; une erreur d'information a des conséquences réelles (mauvais itinéraire, mauvais allié).

**Trois actes** qui changent les règles `[A]`, en cohérence avec les scénarios 845 / 850 / 854 :
- **Acte I — Enfermés** : survie sous les murs (P1, P2, P3 dominent).
- **Acte II — Dehors** : le monde extérieur se révèle ; la mer, les ports, l'extérieur se débloquent par découverte, pas par menu.
- **Acte III — Monde** : géopolitique et guerre moderne ; Marley, Alliés, Hizuru ; artillerie (Paradis et Marley), marine (Marley, Alliés, Hizuru uniquement), aviation.

**Intrigue** (secondaire par rapport au militaire, décision de Gabriel) :
- Événements à choix, arbre de missions nationales, personnages et relations, mystères (02 §12, fichier 12).
- Factions intérieures : Famille royale, Police militaire, Garnison, Légion, Culte des Murs, marchands, bas-fonds. Chaque faction a des **attracteurs canon** qui orientent sans scénariser (02 §14).

**Canon et divergence** (« chronologie vivante ») `[A]` :
- Les événements historiques sont des **attracteurs** : ils se déclenchent dans leur fenêtre tant que les conditions restent proches de l'histoire.
- Le `divergence_score` croît avec les écarts ; au-dessus d'un seuil, l'attraction faiblit et le jeu bascule en branche divergente ; chaque événement canon affiche statut `C`/`A`/`?` en mode auteur uniquement (UX0).

**Tests** : (a) cohérence : le monde ne contient aucun fait que le joueur voit comme « sûr » sans source ; (b) *anti-fuite* : aucune information inconnue dans l'interface (test existant `leaks.ts` à étendre) ; (c) un événement canon se déclenche dans sa fenêtre si les conditions sont conformes, et diverge si elles ne le sont plus.

**Statut dans les specs** : partiel (02 §6, 12 ; fichier 12). **Nouveaux** : fiabilité par fait, dossier de preuves, actes qui changent les règles.

---

## 8. P7 — Le Registre

**Idée.** Il n'y a pas de « mort propre » (02 §9.3). Chaque mort est un dossier (cause, lieu, escouade, circonstances) et se propage dans un graphe de relations.

- **Troupe nommée et troupe générée** `[A]` : pour tenir 100–400 unités, les gradés, les escouades d'élite et les personnages connus sont **nommés** (≈ 50 à 80) ; le reste est généré et tracé par identifiant. Une recrue qui survit assez longtemps est promue au rang de nommée.
- **Relations** (amitié, rivalité, amour, dette, haine) : la mort d'un proche réduit le moral, fait grimper le stress, peut provoquer refus d'ordres ou désertion.
- **Registre des morts** : consultable, avec stèle ; l'opinion publique et la légitimité y réagissent ; le recrutement aussi.
- **Succession** : à la mort d'un chef, candidats avec intérêts propres ; conséquences politiques.

**Tests** : (a) chaque mort produit un dossier complet ; (b) les valeurs de moral/stress changent selon le graphe de relations ; (c) aucune mort sans cause dans le journal.

---

## 9. Asymétrie des camps

| | Paradis | Marley | Alliés / Hizuru |
|---|---|---|---|
| Force | Maîtrise ODM, murs, Titans-Murs | Industrie, armes modernes, porteurs | Marine, commerce, techniques |
| Faiblesse | Gaz et ressources, secret, unité fragile | Usure des porteurs, politique interne | Dépendance, désaccords |
| Équipement | ODM, canons anti-Titan ; lances de foudre dès la fin de 850 `[C]` | Fusils à répétition, artillerie, aviation, dirigeables `[C]`, blindés `[?]` | Marine, « bateau volant » `[C]` (≈ 854) |
| Marine | **non** | oui | oui |
| Artillerie | oui | oui | selon scénario |
| Moteur de jeu | P1, P2, P3, P4 | P5, P4 (information), P6 | P6, diplomatie |

---

## 10. Équilibre visé `[A]` (à mesurer avec `sim:balance`)

Reprend 02 §15 et ajoute des cibles mesurables :
- Mortalité d'expédition en début de partie : 25–40 %.
- Aucune stratégie dominante : une formation en éventail avec relais doit battre la colonne seulement sur terrain découvert et perdre sur terrain étroit.
- Aucun dépôt à gaz vide ne doit rester sans issue : le jeu doit toujours offrir une décision de ravitaillement ou de repli.
- 100 à 400 unités : une bataille de 200 unités dure de l'ordre de 6 à 15 minutes en temps réel à vitesse ×1 (cible de conception, à ajuster).

---

## 11. Plan de mise en œuvre pour les sessions

1. **A0 — Audit** : lire le code, dire pour chaque pilier ce qui existe, ce qui manque, et chiffrer l'effort ; pas de code.
2. **Socle** : cadre d'interface unique et script de parcours de tous les modes (échec si un élément du cadre manque).
3. **P3 + P4** : le cœur du combat (ancrage, gaz, signaux) dans `src/sim`, avec les tests de signature.
4. **P2** : le champ de densité et le modèle d'attention.
5. **P1** : pression, brèche, évacuation, désengorgement.
6. **P5** : suspicion, autonomie des porteurs, extraction.
7. **P6 et P7** : dossiers, actes, registre.
8. **Intégration** : armées en piles, bataille 3D (R2), simulation de bataille.

Chaque étape : critères mesurables, captures relues par un sous-agent distinct, un commit par tâche, `npm run verify` avant chaque commit.

---

## 12. Décisions de Gabriel (2026-10-13)

| # | Sujet | Réponse |
|---|---|---|
| 1 | P2 : champ de densité de Titans | **Non en tant que moteur unique** → adapté (§3 bis) : moteur de rencontres général + moteur de rencontres humaines |
| 2 | P4 : brouillard de commandement à trois niveaux | Oui |
| 3 | P4 : doctrine programmable | Oui |
| 4 | P5 : secret des porteurs | Oui |
| 5 | P5 : extraction du porteur | Oui |
| 6 | P3 : coût stratégique du gaz | Oui |
| 7 | P3 : lances de foudre redistribuent la valeur | Oui |
| 8 | P1 : désengorgement systémique | Oui |
| 9 | P6 : fiabilité A–D et trois actes | Oui |
| 10 | P7 : troupe nommée + générée | Oui |
| 11 | Mode « Simulation de bataille » depuis le menu | **À préciser** (une seule réponse « Non » a été donnée pour les points 11 et 12) |
| 12 | Ordre de mise en œuvre du §11 | **À préciser** (même réponse) |

**En attendant la précision** : les sessions n'implémentent pas le mode « Simulation de bataille » depuis le menu (point 11) et suivent l'ordre de `docs/coord/COORD.md` (point 12), qui reprend le §11 en y ajoutant le chantier du cadre d'interface, le multijoueur (spec 27, à confirmer) et les modèles Blender.

**Conséquence pour le multijoueur** (spec 27) : les piliers P4 (brouillard par siège), P5 et P6 (secrets et connaissance par faction) s'y prêtent directement ; ils doivent être conçus par faction dès maintenant.
