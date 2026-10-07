# 24 — DOSSIER FINAL : SITUATION, ATTENTES ET PLAN POUR TERMINER EN 1 MOIS

> **Document maître.** Il regroupe l'état du projet, toutes les attentes de l'utilisateur et le plan de 4 semaines (abonnement Max 5x, 1 mois). Les phases détaillées sont dans les fichiers 18 à 23 ; **ce fichier dit dans quel ordre, avec quelles règles, et comment décider quand le budget manque**.
> Il se place dans `docs/spec/` du dépôt avec les fichiers 20 à 23 et `ERRATA_UX.md`.
> En cas de conflit entre fichiers : **24 > 23 > 22 > 21 > 20 > 18**, puis `ERRATA.md` de lore, le fichier 11, etc. (les règles de lore du fichier 11 ne sont jamais écrasées).

---

## 1. LA SITUATION (honnête)

**Projet** : *Murs et Sang* (titre de travail), jeu de grande stratégie fidèle à l'univers de *L'Attaque des Titans*, **usage strictement personnel, jamais publié**. Dépôt : `m5c586444w-blip/Jeu-AOT-V2`, branche `claude/attack-on-titan-strategy-game-4ukom6`, état de référence : commit `497be52` (fin de R1d).

**Ce qui est fait et solide** (rapports du dépôt) :
- Simulation déterministe `src/sim` (451 tests, `sim:selftest`, `canon:check`, `data:validate`, sauvegardes IndexedDB, rejeu).
- Jeu 2D complet jusqu'à P8 : menu, carte, cabinet et conseillers, recherche, renseignement, expéditions, chancellerie, gazette, bataille tactique 2D, épilogue.
- Prototype 3D (three.js, hors du bundle principal) : environnements E01 à E29, corps humains MakeHuman sans détail anatomique, arbres, 12 textures Poly Haven, murs, portes (simples).

**Ce qui déçoit l'utilisateur** (constat après 20 minutes de jeu et revue des captures) :
1. **Carte** : anneaux concentriques sépia, presque tout « inexploré », ni relief ni côtes ni provinces lisibles.
2. **Interface** : « fait très IA », « on dirait un fichier Excel » ; tampons canon/adaptation/incertain visibles ; codes internes (`T-ODM-04`) ; « Mécanique en P9 », « pas avant 845 », « n'existe pas encore » à l'écran ; menu à trois quarts vide.
3. **Musique** oppressante.
4. **Chronologie** incomplète ; presque rien dans la chronique au départ.
5. **Villes 3D** générées au hasard (rues et toits répétitifs, murs en motif répété) ; seuls Shiganshina et la ville « de R1 » existent ; **trois districts du mur Maria manquent**.
6. **Titans** : mannequins lisses ; **bataille 2D** : rectangles et pastilles numérotées.
7. **Rythme** : trop de sous-phases (R1b, R1c, R1d) ; R2 jamais atteinte.

**Points positifs** : le jeu est très complet ; les conseillers sont un bon point.

**Causes** (mes responsabilités) : mes spécifications ont prescrit les tampons de statut, le « bureau d'études » en papier, des écrans « objets » de papier partout, et un plan trop fragmenté. Corrigé par les errata (§3) et le plan (§6).

---

## 2. LES ATTENTES DE L'UTILISATEUR (cahier des charges, à relire à chaque phase)

### 2.1 Nature du jeu
| Sujet | Attente |
|---|---|
| Genre | Grande stratégie nationale et militaire (Hearts of Iron IV pour la structure), **campagne façon Total War** (armées en piles avec général sur la carte, bataille au contact) |
| Priorité | **Stratégie militaire et nationale d'abord** ; **intrigue lore présente mais secondaire** |
| Rythme | **Hybride** : temps réel avec vitesses et pause ; **pause automatique** sur les événements importants |
| Nation jouée | **Paradis d'abord** (toute la qualité) ; Marley jouable en version plus simple ; autres nations plus tard |
| Durée de campagne | **≈ 10 heures** |
| Canon | **Suivre le canon, avec divergences possibles** (fichier 12 §3) |
| Économie | **Moyenne** (production, logistique, population, lois ; pas de marchés complexes) |
| Mort d'un dirigeant ou d'un général clé | **Succession et conséquences politiques** |
| Tutoriel | **Guidé** dans la première partie (premier mois de 845) |
| Marine | **Aucune pour Paradis** ; flottes, ports, blocus et débarquements pour Marley, Alliés, Hizuru |
| Artillerie | **Paradis ET Marley** (pas anachronique : lances foudroyantes à la fin de 850, fichier 11) |

### 2.2 Bataille
- **Temps réel fin** : sélection, groupes, ordres par unité ; pause active avec file d'ordres.
- **Compagnies : 100 à 400 unités** (soldats, canons, Titans) à l'écran.
- **Caméra** : vue stratégique libre du dessus **+ suivi d'une escouade ou d'un Titan** à la troisième personne.
- **Porteurs de Titans** : commandés par l'IA avec **ordres généraux** (objectif, zone, retenue).
- **Violence** : réaliste (sang, blessés, Titans qui dévorent), sans surenchère ; réglable.
- **Déterminisme** : même graine et mêmes commandes = même résultat.

### 2.3 Carte, lieux et rendu
- **Carte stratégique** : **île réaliste** (relief, forêts, fleuves, côtes), provinces lisibles et cliquables, murs en relief ; brouillard en voile léger, **pas** de zones « inexploré » plaquées.
- **Lieux principaux faits à la main** (plans d'auteur) ; lieux courants **générés une fois puis figés** (mémoire compacte) ; campagne procédurale.
- **Villes de taille réaliste** (population ÷ densité) **et plantées** (arbres d'alignement, cours, parcs, vergers).
- **Murs et portes** : hauteur ≈ 50 m [C], épaisseur et profil [?] ; **porte extérieure et porte intérieure** détaillées (7 vues rendues), **châteaux** (plans, élévations, intérieurs principaux).
- **Titans** variés (3 à 15 m + variantes, murs 50 m, Colossal 60 m, Rod Reiss ≈ 120 m, voir fichier 11), silhouette dérangeante, non lisse.
- **Portraits** : peinture stylisée.
- **Droit d'auteur** : reconstruire les lieux d'après les descriptions canon ; **aucun fichier tiré de l'œuvre ou de fans, aucun décalque** (règle de CLAUDE.md maintenue).

### 2.4 Interface et audio
- **Interface** : jeu de stratégie **moderne**, sombre, sobre ; panneaux, infobulles de calcul, notifications triées ; ≥ 60 icônes dessinées ; menu plein écran avec les murs en rendu 3D ; **aucune** mention interne visible (E-UX-1).
- **Musique** : **mélange de marches militaires et de classique libre de droit, avec du peps** ; calme et jamais oppressante ; volume par défaut ≤ 35 % ; sources **uniquement à licence vérifiée** (domaine public, CC0, CC-BY).
- **Recherche** : conservée, en arbre. **Archives** : encyclopédie discrète sans tampons, qui ne montre que ce qui est découvert.
- **Chronologie** : frise 845 à 854+, les 60 événements du fichier 12 au minimum, 3 événements de fond par mois.

### 2.5 Technique et livraison
- PC de l'utilisateur : **carte dédiée récente (type RTX 3050 ou mieux)**. Les mesures de fluidité se font **chez lui**.
- Lancement : **application Windows (exe) en double-clic**, construite sur son PC (script `package:win`). Pas de publication en ligne.
- Interface en **français** (anglais en second).

---

## 3. DONNÉES DE LORE À INTÉGRER (nouveautés de ce jour)

**Mur Maria : quatre districts** (réponse de l'utilisateur, 7 oct. 2026, **source non précisée et non vérifiée par moi** ; recherche en ligne de ma part : résultats inexploitables, un seul résultat sur un wiki de fans que je n'utilise pas) :

| District | Position (selon l'utilisateur) | Statut |
|---|---|---|
| **Shiganshina** | sud | `[C]` (déjà dans le fichier 11) |
| **Quinta** | nord | `[?]` : nom et position **à vérifier** dans une source officielle (manga, guide officiel, romans officiels) |
| sans nom | est | `[?]` |
| sans nom | ouest | `[?]` |

**Règle** : Claude Code cherche dans des sources **officielles** seulement. S'il n'en trouve pas : il garde Quinta comme `[?]` paramétrable (affiché « Quinta » dans le jeu **sans** mention de statut, voir E-UX-1) et crée les deux autres comme « District est du mur Maria » et « District ouest du mur Maria » (`[?]`), construits avec chacun une identité propre, notés dans `docs/lore/questions-ouvertes.md`. Aucun nom ni chiffre inventé présenté comme canon.

---

## 4. RÈGLES DE TRAVAIL (à coller dans CLAUDE.md ; ce bloc remplace les anciennes règles de dérive)

```
## Règles de projet (V2, plan d'un mois)
- Document maître : docs/spec/24_DOSSIER_FINAL_1_MOIS.md. Priorité : 24 > 23 > 22 > 21 > 20 > 18. Le fichier 11 (lore) n'est jamais écrasé.
- Une phase = une session. Au début de chaque session : lis docs/PROGRESS.md ; la phase suivante est dans docs/ROADMAP.md.
- Plafond de tours par phase (voir ROADMAP). Au plafond : écris l'état dans PROGRESS.md, liste le manquant dans docs/reports/dette.md, commite, ARRÊTE-TOI.
- Un critère échoue deux fois : ne t'arrête pas ; note-le en dette avec la cause mesurée et passe à la suite. Arrêt SEULEMENT pour un critère bloquant : verify, sim:selftest, sauvegardes, canon:check.
- Interdit : sous-phase inventée (R1f…), nouvel outil de mesure, optimisation pour le rendu logiciel, refonte « au passage », relance de verify sans changement de code.
- Captures : au plus 12 par phase ; chacune ouverte avec l'outil d'image (3 lignes + 3 défauts possibles) ; une capture vide ou qui ne montre pas l'élément testé = critère KO.
- Rapports : 150 lignes maximum ; sorties collées seulement pour les commandes de critère ; N'écris jamais qu'un test passe sans coller sa sortie réelle.
- L'utilisateur ne voit JAMAIS : tampons canon/adaptation/incertain, codes internes, « mécanique en Pn », « pas avant AAAA », « n'existe pas encore ». Mode auteur F10 seulement.
- Lore : jamais de nom ou de chiffre inventé présenté comme canon ; sources officielles seulement (pas de wiki ni fandom) ; incertain = [?] paramétrable + docs/lore/questions-ouvertes.md.
- Droit d'auteur : formes des lieux reconstruites d'après les descriptions ; AUCUN fichier de l'œuvre ou de fans, aucun décalque ; musique et textures : licences vérifiées, entrées dans docs/ASSETS_LICENSES.md.
- Arrêts de revue (l'utilisateur joue ou regarde, puis répond) : fin de MAP, fin de UI, fin de PA, fin de R2+, fin de R1e, fin de P9. Les arrêts « lore ambigu », « décision majeure », « commande impossible » restent valables.
- src/sim : modifié seulement dans les phases qui l'annoncent (CHR données, PA, MIS, R2+), de façon additive, déterministe, avec tests et sim:selftest code 0.
```

**ERRATA UX** : copier le bloc du fichier 22 §1 dans `docs/spec/ERRATA_UX.md`.

---

## 5. PLAN DE 4 SEMAINES (Max 5x, 1 mois)

### 5.1 Principe
Le plan est découpé en **trois niveaux**. Un niveau terminé donne un jeu **jouable et présentable** ; les niveaux suivants l'enrichissent. Si le quota manque, on **coupe par la fin**, jamais au milieu d'un niveau.

| Niveau | Contenu | Résultat |
|---|---|---|
| **N1 (indispensable)** | UX0, MAP, UI, AUD, CHR, PA | Campagne stratégique belle et complète sur Paradis, armées sur la carte, artillerie, chronologie, musique |
| **N2 (important)** | MIS, TUT, R2+ | Missions nationales, tutoriel, bataille 3D temps réel fin (100–400 unités) |
| **N3 (finition)** | R1e (lieux faits main), R3 (Titans, soldats), P9 (scénarios, IA, équilibrage), P10, PACK (exe) | Beauté des lieux et des Titans, équilibrage, application Windows |

### 5.2 Calendrier cible (à ajuster aux points de contrôle)

| Semaine | Phases | Modèle et effort | Arrêt de revue |
|---|---|---|---|
| **S1** | UX0, MAP, (début de UI) | Opus 5.5 xhigh pour MAP et UI ; Sonnet 5.5 high pour UX0 | MAP |
| **S2** | UI (fin), AUD, CHR, PA | Opus xhigh (UI, PA) ; Sonnet high (AUD, CHR) | UI, PA |
| **S3** | MIS, TUT, R2+ | Opus xhigh (R2+) ; Sonnet high (MIS, TUT) | R2+ |
| **S4** | R1e (réduit), R3, P9, P10, PACK | Opus xhigh (R1e, R3, P9) ; Sonnet high (P10, PACK) | R1e, P9 |

**Marge** : 3 jours de réserve pour les débordements ; ne consommez pas la dernière semaine pour rattraper la première.

### 5.3 Points de contrôle du budget (vous, 2 minutes)
Notez dans Réglages > Utilisation le **% du quota hebdomadaire** avant et après chaque phase.

| Moment | Décision |
|---|---|
| Après UX0 et MAP | Calculez la consommation moyenne par grosse phase. **Si MAP > 40 % d'un quota hebdomadaire**, passez à **MAP réduite** (terrain et provinces d'abord, calques ensuite, dette) |
| Fin de S1 | Si le quota hebdomadaire a été atteint, **décalez tout d'une semaine** et appliquez la règle de coupe ci-dessous |
| Fin de S2 (N1 terminé) | Vous avez un jeu présentable. Décidez : continuer N2 ou stabiliser |
| Fin de S3 | Si N2 n'est pas terminé, **sautez R3** |
| Quota atteint en cours de phase | Ne relancez pas en boucle. Activez les crédits (plafond 30 à 50 €) **seulement pour finir la phase en cours** |

**Règle de coupe (du premier sacrifié au dernier)** : lieux faits main au-delà de Shiganshina et des districts de Maria → R3 (Titans) → TUT → MIS → P10 → R2+ (rester sur la bataille actuelle) → **jamais** N1.

### 5.4 Ce que « fini » veut dire à 1 mois
- **Minimum garanti si tout va bien (N1)** : une campagne sur Paradis jouable de bout en bout avec carte, interface, musique, chronologie, armées et artillerie.
- **Cible réaliste (N1 + N2)** : + missions, tutoriel, bataille 3D temps réel fin.
- **Cible haute (N1 + N2 + N3)** : + lieux principaux faits main, Titans réalistes, équilibrage, exe. **Je ne garantis pas cette cible.**

---

## 6. INDEX DES PHASES (où trouver chaque prompt)

| Phase | Prompt | `/goal` (plafond de tours) |
|---|---|---|
| UX0 | fichier 22 §3 | `/goal UX0 terminée : plus aucune mention interne visible (test no-leaks), mode auteur F10, verify code 0. Plafond 60 tours.` |
| MAP | fichier 22 §4 | `/goal MAP terminée : carte réaliste jouable avec calques, docs/reports/MAP.md, verify code 0, sim:selftest code 0. Plafond 220 tours.` |
| UI | fichier 22 §5 | `/goal UI terminée : tous les écrans refaits selon ERRATA_UX, docs/reports/UI.md, verify code 0, smoke:* OK. Plafond 280 tours.` |
| AUD | fichier 22 §6 + fichier 23 §3.1 | `/goal AUD terminée : musique (marches + classique libre de droit), sons, licences à jour, volume par défaut ≤ 35 %, verify code 0. Plafond 120 tours.` |
| CHR | fichier 22 §7 | `/goal CHR terminée : frise, 60 événements couverts, 3 événements de fond par mois, verify code 0, canon:check code 0. Plafond 120 tours.` |
| PA | fichier 21 §7 + fichier 23 §3.2 | `/goal PA terminée : armées sur la carte, artillerie des deux camps, marine hors Paradis, succession, docs/reports/PA.md, verify code 0, sim:selftest code 0. Plafond 200 tours.` |
| MIS | fichier 23 §5 | `/goal MIS terminée : 40 missions par scénario, écran Missions, verify code 0. Plafond 150 tours.` |
| TUT | fichier 23 §5 | `/goal TUT terminée : tutoriel guidé du premier mois, smoke:tuto OK, verify code 0. Plafond 100 tours.` |
| R2+ | fichier 18 §1 + fichier 23 §4 | `/goal R2+ terminée : bataille 3D temps réel fin jouable (100 à 400 unités), docs/reports/R2.md, verify code 0, sim:selftest code 0. Plafond 300 tours.` |
| R1e | fichier 20 (§6 correctifs, §8 tâches) avec le périmètre du fichier 21 §3 et les districts du §3 ci-dessus | `/goal R1e terminée : lieux faits main du périmètre, 7 vues par porte, docs/reports/R1e.md, verify code 0. Plafond 200 tours.` |
| R3 | fichier 18 §2, version courte fichier 21 §8 | `/goal R3 terminée : Titans de 3 à 15 m avec variantes, soldats Paradis et Marley, verify code 0. Plafond 150 tours.` |
| P9 | fichier 18 §9 | plafond 200 |
| P10 | fichier 18 §10 | plafond 120 |
| PACK | fichier 23 §6 | `/goal PACK terminée : npm run package:win, docs/LANCER_SUR_WINDOWS.md. Plafond 100 tours.` |

`docs/ROADMAP.md` (à créer par Claude Code au démarrage) reprend ce tableau avec une colonne « statut ».

---

## 7. MODE D'EMPLOI (ce que l'utilisateur fait)

### 7.1 Une seule fois, avant la première session
1. **Prendre Max 5x** (Réglages) ; activer les crédits avec un plafond de 30 à 50 €.
2. Accès réseau du cloud en **Personnalisé** : `polyhaven.com`, `api.polyhaven.com`, `dl.polyhaven.org` + liste par défaut ; **ajouter pour AUD seulement** : `upload.wikimedia.org`, `commons.wikimedia.org`, `archive.org`, `musopen.org`, `freepd.com`, `marineband.marines.mil` ; les **retirer** après AUD.
3. Déposer dans le dépôt, dossier `docs/spec/` : les fichiers **18, 20, 21, 22, 23, 24** et `ERRATA_UX.md` (bloc du fichier 22 §1). Si ce n'est pas faisable à la main, collez-les à Claude Code dans la première session et demandez-lui de les enregistrer.
4. Noter le **% de quota** de départ.

### 7.2 Première session (installation, courte, effort high)
Collez ceci :
```
SESSION 0 : INSTALLATION DU PLAN V2.
1) Lis docs/spec/24_DOSSIER_FINAL_1_MOIS.md en entier, puis 20, 21, 22, 23 et docs/PROGRESS.md.
2) Remplace les anciennes règles de dérive de CLAUDE.md par le bloc du §4 du fichier 24 (en gardant le reste de CLAUDE.md : stack, scripts, règles sim, assets, latence). Ajoute les arrêts de revue indiqués.
3) Crée docs/spec/ERRATA_UX.md (bloc du fichier 22 §1), docs/ROADMAP.md (tableau du fichier 24 §6 avec statut « à faire »), docs/reports/dette.md, docs/lore/questions-ouvertes.md (avec le tableau des districts du mur Maria du fichier 24 §3).
4) Commit. Mets docs/PROGRESS.md à jour : « Plan V2 installé, prochaine phase : UX0 ». Rapport de cette session : 20 lignes maximum.
Interdit : lancer une phase dans cette session. ARRÊT à la fin.
```

### 7.3 Chaque session suivante (même message à chaque fois, effort selon le tableau du §5.2)
Collez ceci en changeant le nom de la phase :
```
SESSION DE PHASE : <NOM DE LA PHASE>.
Lis docs/PROGRESS.md et docs/ROADMAP.md, puis le prompt de cette phase (index : fichier 24 §6) et les fichiers qu'il cite. Applique CLAUDE.md et les règles du fichier 24 §4. Écris docs/phases/<NOM>.md (une page : tâches et critères), puis exécute la phase. Rapport selon le fichier 18 §11 (150 lignes maximum). Mets docs/PROGRESS.md, docs/ROADMAP.md et docs/reports/dette.md à jour. Arrête-toi au plafond de tours, à un arrêt bloquant ou à la fin de la phase.
```
Puis la ligne `/goal` du §6.

### 7.4 Aux arrêts de revue
Jouez ou regardez **15 minutes**, notez **trois points positifs et trois négatifs**, envoyez-les-moi avec le rapport. Je produis **une seule passe de correctifs ciblés**, jamais une nouvelle phase.

### 7.5 Aux points de contrôle du budget
Voir §5.3.

---

## 8. RISQUES ET PARADES

| Risque | Parade |
|---|---|
| Une phase déborde et mange la semaine | Plafond de tours ; dette ; règle de coupe |
| Quota hebdomadaire atteint | Attendre la remise à zéro ou crédits **pour finir la phase en cours seulement** |
| Dérive visuelle (polir à l'infini) | Captures limitées à 12, un correctif par défaut visé, revue de l'utilisateur à des points fixes |
| Dépôt public lisible par tous | Le dépôt est public ; si vous le passez en privé, je ne pourrai plus lire les captures (envoi manuel) |
| Réseau refuse un domaine de musique | L'IA ne contourne pas ; elle note les domaines refusés et vous les ajoutez, ou vous déposez des pistes dans `assets_user/musique/` |
| Performances 3D | Mesure sur votre PC (rendu logiciel du cloud non probant) ; budgets en qualités basse, moyenne, haute |
| Lore incertain (districts, épaisseurs de mur) | `[?]` paramétrable, jamais présenté comme canon |
| Exe non construit dans le cloud | Construit sur votre PC avec `npm run package:win` |

---

## 9. STATUT DES AFFIRMATIONS DE CE FICHIER (liste séparée)

**Sourcées** :
- État du dépôt à `497be52` et défauts de l'interface : rapport `docs/reports/R1d.md`, `PROGRESS.md`, captures `p8-*`, `p5-chronique` du dépôt.
- Max 5x à 100 $/mois, limites de session et hebdomadaires, crédits au tarif API : [Max plan](https://support.claude.com/en/articles/11049741-what-is-the-max-plan), [crédits d'utilisation](https://support.claude.com/en/articles/12429409-manage-usage-credits-for-paid-claude-plans).
- Toutes les décisions du §2 : réponses de l'utilisateur dans la conversation.
- Hauteur des murs ≈ 50 m, Colossal 60 m, Rod Reiss ≈ 120 m, lances foudroyantes à la fin de 850 : fichier 11 du projet.

**Interprétatives** :
- Le découpage en trois niveaux, les durées par phase, les plafonds de tours, les seuils de quota (40 %), les modèles par phase.
- « Hybride » compris comme temps réel avec pause automatique ; « façon Total War » compris comme piles d'armées et bataille au contact ; « pas de marine sur Paradis » compris comme aucune flotte jouable.
- La nomenclature des deux districts sans nom (« est » et « ouest ») est une convention provisoire.
- Le choix d'Electron par défaut pour l'exe.

**Non confirmées** :
- Les noms et positions des districts du mur Maria hors Shiganshina (fournis par l'utilisateur sans source ; Quinta non retrouvé dans une source officielle lors de ma recherche).
- L'épaisseur, le fruit et le chemin de ronde des murs.
- Que N2 ou N3 tiennent dans le mois ; la consommation réelle par phase ; la taille du quota hebdomadaire de Max 5x.
- Que le réseau autorise les domaines de musique ; que les enregistrements trouvés aient une licence compatible.
- Que 400 unités en 3D temps réel tiennent sur la carte graphique de l'utilisateur sans mesure.
- Que l'exe se construise sans erreur sous Windows.
