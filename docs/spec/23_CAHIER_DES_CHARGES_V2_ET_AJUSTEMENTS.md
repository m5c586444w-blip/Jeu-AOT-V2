# 23 — CAHIER DES CHARGES V2 (RÉPONSES DE L'UTILISATEUR) ET AJUSTEMENTS DU PLAN

> **Complète et, en cas de conflit, prime sur** les fichiers 22 (plan V2), 21 (anti-dérive), 20 (lieux faits main) et 18 (R2 à P10).
> Source : les réponses de l'utilisateur du 7 oct. 2026, 19:28 à 19:45 (questions à choix) et ses messages précédents.

---

## 1. DÉCISIONS (tableau de référence)

| Sujet | Décision | Effet principal |
|---|---|---|
| Rythme | **Hybride** : temps réel avec vitesses et pause ; **pause automatique** sur les événements importants | HUD d'horloge à vitesses ; règle de pause auto réglable |
| Nations | **Paradis d'abord**, les autres plus tard (Marley jouable en version plus simple) | Toute la qualité sur Paradis ; Marley = IA solide + campagne simplifiée |
| Référence | **Total War (campagne)** pour la sensation et la carte ; structure d'interface HOI4 conservée pour les panneaux (fichier 22) | Armées en piles avec généraux sur la carte, bataille déclenchée au contact |
| Bataille | **Temps réel fin** (vous dirigez les unités) ; **compagnies : 100 à 400 unités** ; caméra **stratégique + suivi d'une escouade** | Contrôle par unité et par groupe ; budget de rendu fort |
| Porteurs de Titans | **Commandés par l'IA avec ordres généraux** | Un ordre par porteur (objectif, zone, retenue), pas de pilotage direct |
| Violence | **Réaliste** | Sang, blessés, Titans qui dévorent, sans surenchère |
| Économie | **Moyenne** (type HOI4) | Production, logistique, population, lois ; pas de marchés complexes |
| Intrigue lore | **Présente mais secondaire** à la stratégie militaire et nationale ; 4 formes : événements à choix, arbre de missions nationales, personnages et relations, mystères | Nouvelle phase MIS ; intrigue pondérée en dessous de la stratégie |
| Canon | **Suivre le canon, avec divergences possibles** | Fichier 12 §3 (divergence avertie) conservé |
| Manques | **Armées qui se déplacent sur la carte** ; **marine et ports, mais pas sur Paradis** | PA : marine pour Marley, Alliés, Hizuru ; aucune flotte pour Paradis |
| Musique | **Marches militaires (esprit HOI4) + classique libre de droit, avec du peps** ; réseau **autorisé** pour les sites de musique libre | Phase AUD revue (§3) |
| Durée d'une campagne | **≈ 10 heures** | Scénarios ramassés, rythme resserré |
| Mort d'un dirigeant ou d'un général clé | **Succession et conséquences politiques** | Vérifier ce que fait déjà le jeu (audit) |
| Portraits | **Peinture stylisée** | Filtre ou procédé local de peinture, pas de photoréalisme |
| PC | **Carte dédiée récente (type RTX 3050 ou mieux)** | Budget de rendu moyen-haut, mesure sur place |
| Lancement | **Application Windows (exe) en double-clic**, en fin de projet | Phase PACK (§6) |
| Tutoriel | **Guidé dans la première partie** | Phase TUT (§5) |
| Interface | Moderne, sombre, sobre ; carte **réaliste de l'île** (fichier 22) | UX0, MAP, UI |

---

## 2. CE QUE ÇA CHANGE (HONNÊTEMENT)

La somme de ces choix (campagne façon Total War, 100 à 400 unités en temps réel fin, 3D, lieux faits main, intrigue riche, marche ET classique, exe) est un projet de **plusieurs semaines** au rythme observé, pas de 10 jours. Je ne vais pas faire semblant du contraire.

**Ce que 10 jours peuvent raisonnablement donner** (si les phases ne débordent pas) : une **campagne stratégique belle et complète** sur Paradis :
- carte réaliste, interface moderne, musique, chronologie complète (UX0, MAP, UI, AUD, CHR) ;
- armées en piles sur la carte avec généraux, déplacements, interceptions, artillerie des deux camps, marine hors Paradis (PA) ;
- bataille jouable avec le système actuel, **sans** encore la refonte 3D temps réel fin (R2 vient après).

**Ce qui vient ensuite** (deuxième lot, sans date) : mission tree (MIS), tutoriel (TUT), bataille 3D temps réel fin à 100–400 unités (R2 étendue, §4), lieux faits main (fichier 20), Titans réalistes, exe (PACK).

Les points de contrôle du fichier 21 §5 s'appliquent. Si, à J6, UI n'est pas terminée, supprimer AUD et CHR du lot de 10 jours (ils restent dans le plan).

---

## 3. ORDRE DES PHASES MIS À JOUR

| Lot | Phase | Contenu | Effort | Plafond |
|---|---|---|---|---|
| **A (10 jours)** | UX0 | Nettoyage des mentions internes | high | 60 |
| | MAP | Carte réaliste de l'île | xhigh | 220 |
| | UI | Interface moderne | xhigh | 280 |
| | AUD | Musique : marches + classique libre de droit (§3.1) | high | 120 |
| | CHR | Chronologie complète | high | 120 |
| | PA | Armées sur la carte, artillerie des deux camps, marine hors Paradis (§3.2) | xhigh | 200 |
| **B (suite)** | MIS | Arbre de missions nationales (§5) | high | 150 |
| | TUT | Tutoriel guidé | high | 100 |
| | R2+ | Bataille 3D branchée, temps réel fin, 100 à 400 unités (§4) | xhigh | 300 |
| | R1e | Lieux faits main (fichier 20, périmètre du fichier 21 §3) | xhigh | 200 |
| | R3 | Titans et soldats réalistes | xhigh | 150 |
| | PACK | Application Windows (§6) | high | 100 |
| | P9, P10 | Scénarios, IA, équilibrage, finitions | xhigh/high | 200/120 |

### 3.1 Amendement à AUD (musique)

À ajouter au prompt AUD du fichier 22 §6 (qui reste valable pour le diagnostic et les sons) :

```
AMENDEMENT AUD (décision de l'utilisateur) : la musique est un MIX de marches militaires dans l'esprit des jeux de grande stratégie ET de musique classique libre de droit « avec du peps » (rythmée, claire, pas sombre). Pas de bourdon, pas de dissonance tenue (E-UX-4).
SOURCES AUTORISÉES : uniquement des enregistrements dont la LICENCE EST VÉRIFIÉE sur la page du fichier : domaine public, CC0 ou CC-BY (avec attribution). Domaines à autoriser dans l'accès réseau du cloud : upload.wikimedia.org, commons.wikimedia.org, archive.org et *.archive.org, musopen.org, freepd.com, marineband.marines.mil (à vérifier au premier essai). 
RÈGLES : (1) la COMPOSITION peut être dans le domaine public alors que l'ENREGISTREMENT ne l'est pas : ne retiens que les enregistrements dont la licence est écrite sur la page ; (2) ne télécharge aucune musique de jeu vidéo ni de l'œuvre originale ; (3) chaque piste : entrée dans docs/ASSETS_LICENSES.md (titre, compositeur, interprète, URL exacte de la page, licence, date) ; (4) assets:check échoue si une piste n'a pas d'entrée ; (5) maximum 24 pistes (≈ 90 minutes), conversion en OGG ; (6) mixage : trois états (calme, tension, combat) par choix de pistes ET par filtre/volume ; marches pour la guerre, classique rythmé pour la carte et le menu ; (7) volume par défaut ≤ 35 % ; (8) dossier assets_user/musique/ pris en charge.
Si un domaine est refusé par le réseau : ne contourne pas ; note-le, passe aux pistes déjà téléchargées, et liste les domaines à autoriser.
```

### 3.2 Amendement à PA (armées, artillerie, marine)

À ajouter au prompt PA du fichier 21 §7 :

```
AMENDEMENT PA (décision de l'utilisateur) :
- ARMÉES SUR LA CARTE (façon Total War) : une armée est une PILE d'unités avec UN général, affichée sur la carte avec insigne, effectif, moral et ravitaillement ; fusion et division ; ordres de mouvement avec trajet affiché ; marche forcée (fatigue) ; interception et contact qui déclenchent la bataille (tactique ou résolution rapide au choix) ; retraite.
- MARINE ET PORTS : la marine N'EXISTE PAS pour Paradis (aucune flotte, aucun chantier naval jouable pour Paradis). Elle existe pour Marley, les Alliés et Hizuru : flottes, ports, blocus, débarquement, escorte. Un débarquement sur l'île est une menace jouable pour le joueur (côtes de Paradis).
- ARTILLERIE : Paradis ET Marley (fichier 21 §7 PA.3 et PA.4).
- SUCCESSION : vérifie ce que le jeu fait quand un dirigeant ou un général clé meurt ; si la succession et les conséquences politiques n'existent pas, ajoute-les en tâche PA.10 (crise de succession, légitimité, prétendants).
```

---

## 4. AMENDEMENT À R2 (LOT B) : BATAILLE TEMPS RÉEL FIN, 100 À 400 UNITÉS

À coller en tête du prompt R2 (fichier 18 §1) quand on y arrive :

```
AMENDEMENT R2+ (décision de l'utilisateur) :
- Échelle : COMPAGNIES, 100 à 400 unités à l'écran (soldats, canons, Titans). Au-delà d'un seuil de distance, les unités se regroupent en instances rendues en lots ; détail complet seulement près de la caméra.
- Contrôle : TEMPS RÉEL FIN. Sélection (clic, rectangle, groupes numérotés), ordres par unité et par groupe (déplacer, attaquer, couvrir, replier, tenir, suivre), formations, tir de l'artillerie sur zone, pause active avec file d'ordres. Les porteurs de Titans sont commandés par l'IA avec ORDRES GÉNÉRAUX (objectif, zone, retenue) : pas de pilotage direct.
- Caméra : vue stratégique libre du dessus (zoom jusqu'aux soldats) ET suivi d'une escouade ou d'un Titan à la troisième personne, bascule à une touche.
- Violence : réaliste (sang, blessés, Titans qui dévorent), sans surenchère ; réglable dans les options (sobre / réaliste).
- La simulation tactique reste DÉTERMINISTE (même graine et mêmes commandes = même hash) ; l'exception du fichier 18 pour map.ts est conservée ; les ordres temps réel passent par des COMMANDES journalisées.
- Budget : cible 400 unités avec 4 à 6 Titans sur une carte graphique de type RTX 3050 (mesure sur le PC de l'utilisateur ; le rendu logiciel du cloud ne prouve rien).
```

---

## 5. NOUVEAUX PROMPTS : MIS ET TUT (LOT B)

### MIS : arbre de missions nationales

```
PHASE MIS : ARBRE DE MISSIONS NATIONALES (style « focus » de Hearts of Iron IV). Règles : CLAUDE.md (dont règles de budget), un commit par tâche, verify avant chaque commit. src/sim peut recevoir règles et données ADDITIVES, avec tests et sim:selftest code 0. Interface selon docs/spec/ERRATA_UX.md.
Lis docs/spec/02, 05, 08, 11, 12, data/events, data/laws, data/techs, docs/reports/P5.md à P8.md.
INTENTION : l'intrigue lore est présente mais SECONDAIRE à la stratégie militaire et nationale. Les missions donnent des objectifs à long terme (mois de jeu), des bonus et des événements, jamais un scénario forcé.
TÂCHES
 MIS.1 Modèle de données (data/missions/*.json, Zod) : mission (nom, description de jeu, durée, coût, prérequis, exclusions, effets, événements déclenchés, canon C/A/?), branches par domaine (militaire, politique, économique, religion, renseignement, monde extérieur).
 MIS.2 Arbre de PARADIS pour 845, 850, 854 : au moins 40 missions par scénario, dont : reconquête de Maria, réforme de l'armée, cabinet, église des murs, recherche anti-Titan, artillerie, renseignement sur le monde extérieur, préparation de l'invasion de Marley. Aucune mission ne force un événement canon : les divergences passent par le mécanisme du fichier 12 §3.
 MIS.3 Écran Missions : arbre lisible (nœuds, liens, mission en cours, temps restant), infobulle d'effet, aucun code interne.
 MIS.4 Intégration : missions sur le calendrier (frise CHR), pause automatique à la fin d'une mission, journal.
 MIS.5 Marley : une branche simplifiée.
 MIS.6 IA : l'IA de Marley choisit des missions cohérentes.
CRITÈRES : CMIS-01 verify code 0 ; CMIS-02 sim:selftest code 0 ; CMIS-03 canon:check code 0 ; CMIS-04 40 missions par scénario ; CMIS-05 aucune mention interne à l'écran (no-leaks) ; CMIS-06 capture lue.
```

### TUT : tutoriel guidé

```
PHASE TUT : TUTORIEL GUIDÉ DANS LA PREMIÈRE PARTIE. src/sim INCHANGÉ. Règles : CLAUDE.md, un commit par tâche.
Lis docs/reports/UI.md, docs/reports/MAP.md.
TÂCHES
 TUT.1 Mode « premier mois de 845 » accompagné : 10 à 14 étapes (carte, province, ressources, armées, cabinet, recherche, missions, événements, bataille), chaque étape avec bulle ancrée à l'élément, mise en évidence, condition de passage.
 TUT.2 Désactivable à tout moment, rejouable depuis les options ; aides contextuelles ensuite (une seule fois par élément).
 TUT.3 Texte sobre, sans jargon interne, sans mention de phases ni de canon.
CRITÈRES : CTUT-01 verify code 0 ; CTUT-02 le tutoriel se termine sans erreur (smoke:tuto) ; CTUT-03 aucune mention interne (no-leaks) ; CTUT-04 captures lues.
```

---

## 6. PACK : APPLICATION WINDOWS (FIN DE PROJET)

```
PHASE PACK : EMBALLAGE EN APPLICATION WINDOWS (double-clic). Règles : CLAUDE.md, un commit par tâche.
CONTEXTE : le jeu est une application web locale ; l'utilisateur veut une application Windows qu'il lance par double-clic. Le cloud est sous Linux : la construction de l'exe se fera sur le PC Windows de l'utilisateur (script fourni), pas dans le cloud.
TÂCHES
 PACK.1 Choisis entre Electron et Tauri en documentant le choix dans docs/DECISIONS.md (critères : simplicité de la construction sous Windows, taille, WebGL, IndexedDB, Worker). Par défaut, Electron (outil unique à installer, pas de chaîne Rust).
 PACK.2 Script npm run package:win à lancer sur Windows : produit un dossier ou installateur avec icône, titre, plein écran optionnel, sauvegardes locales, sans accès réseau nécessaire.
 PACK.3 Pas de publication en ligne. Aucun envoi de données.
 PACK.4 docs/LANCER_SUR_WINDOWS.md : trois étapes (installer Node, cloner, lancer la commande).
CRITÈRES : CPACK-01 verify code 0 ; CPACK-02 le package se construit (tu le DIS vérifié seulement si tu l'as réellement exécuté ; sinon écris « non vérifié, à lancer sur Windows ») ; CPACK-03 le jeu lancé hors navigateur charge le menu (smoke ou note non vérifiée).
```

---

## 7. CE QUE VOUS FAITES MAINTENANT

1. **Accès réseau du cloud** : pour la musique, ajoutez à la liste autorisée (Personnalisé) : `upload.wikimedia.org`, `commons.wikimedia.org`, `archive.org`, `musopen.org`, `freepd.com`, `marineband.marines.mil`. Quand AUD est finie, **retirez-les**.
2. **Enregistrez** les fichiers 20 à 23 dans `docs/spec/` du dépôt, et `ERRATA_UX.md` (bloc du fichier 22 §1).
3. **Envoyez-moi** (si possible avant d'acheter) : les **noms des 3 districts de Maria** que vous avez en tête, et **trois événements ou périodes** qui manquent dans la chronologie. Sans source, je les marque `[?]`.
4. **Lancez le lot A dans l'ordre** : UX0, MAP, UI, AUD, CHR, PA (prompts : fichier 22 §3 à §7, fichier 21 §7 + amendements du §3 ci-dessus). Une session par phase.

---

## 8. STATUT DES AFFIRMATIONS DE CE FICHIER (liste séparée)

**Sourcées (réponses de l'utilisateur dans cette conversation)** : toutes les décisions du §1.

**Interprétatives** : « Hybride » compris comme temps réel avec pause automatique sur les événements ; « façon Total War » compris comme armées en piles sur la carte et bataille au contact ; « marine pas sur Paradis » compris comme « aucune flotte jouable pour Paradis » ; la liste des domaines de musique (non vérifiée) ; le choix par défaut d'Electron ; les estimations de durée et de plafonds de tours ; le fait que le tout représente plusieurs semaines.

**Non confirmées** : que le réseau autorise tous les domaines de musique cités ; que les enregistrements trouvés portent une licence compatible ; qu'un exe puisse être construit dans le cloud (non : prévu sur Windows) ; ce que fait déjà le jeu pour la succession ; que 400 unités en 3D tiennent sur une RTX 3050 sans mesure.
