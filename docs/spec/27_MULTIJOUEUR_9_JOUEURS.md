# 27 — MULTIJOUEUR JUSQU'À 9 JOUEURS (orientation CONFIRMÉE le 2026-10-13 : coopération, camps, trahison)

> **Statut : orientation CONFIRMÉE par Gabriel le 2026-10-13 (soir)** : *coopération dans tous les aspects* — un **conseil mixte** (joueurs + conseillers IA) et, en bataille, des joueurs qui dirigent **leurs propres groupes, formations et escouades**. **Compléments du même soir (2ᵉ message)** : on **choisit son grand camp** (scénario 845 : Paradis ou Marley ; plus de camps pour les scénarios postérieurs à la reprise de Shiganshina et à la guerre de l'alliance), avec des **limites d'équilibre** ; les joueurs de Marley **commandent directement leurs Titans** en bataille jusqu'à une époque charnière (≈ saison 4 de l'œuvre, `[?]`) où dominent les batailles d'infanterie ; et la **trahison** est voulue : « coopération, mais aussi traître ». But du chapitre : un jeu **amusant** à plusieurs. Les réglages non tranchés restent des **défauts `[A]`** listés au §10 (Gabriel : « aucun ne change »). Le chantier C13 (réseau) est débloqué après C3 (prérequis) et C9 (bataille jouable de bout en bout).
> Contexte donné par Gabriel : jusqu'à **9 amis** doivent pouvoir se connecter à la même partie ; le jeu ne sort pas du cercle privé (garantie des amis). Ligne éditoriale : réalisme, fidélité au lore, jouabilité.
> Étiquettes : `[A]` choix de conception ; `[?]` à vérifier. Rédigé sans relire le code : l'architecture est déduite de la description du projet (simulation déterministe, journal de commandes, empreinte d'état, Worker) et doit être **confirmée par l'audit A0**.

---

## 1. Principe d'architecture : lockstep déterministe, un hôte

La simulation du projet est déterministe (aléa injecté, temps injecté, journal de commandes rejouable, empreinte d'état). C'est la propriété qui rend le multijoueur peu coûteux en réseau.

- **Chaque client exécute la même simulation** à partir du même instantané initial ; seuls les **ordres** voyagent sur le réseau.
- **L'hôte** (le PC de Gabriel, ou un ami) joue le rôle de séquenceur : il reçoit les ordres, leur attribue un **pas de simulation** futur (`tick + D`, D = délai d'entrée, quelques pas à 20 Hz), puis les diffuse dans l'ordre à tous.
- **Détection de désynchronisation** : toutes les N secondes, chaque client envoie l'empreinte d'état (déjà disponible) ; l'hôte compare ; en cas d'écart il envoie un **instantané + la fin du journal** au client fautif (resynchronisation).
- **Aucun `Math.random`, aucun `Date.now`** dans `src/sim` : règle déjà en vigueur, maintenant critique. Toute nouvelle mécanique (P1 à P7) doit rester déterministe, sinon la partie se désynchronise.
- **Sauvegarde** : par l'hôte uniquement (instantané + journal). Une reprise de partie ré-invite les mêmes sièges.

**Pourquoi pas un serveur autoritaire qui calcule tout ?** Il serait plus sûr contre la triche, mais il exigerait de découper l'état par joueur et de diffuser des états complets. Entre amis de confiance, le lockstep est plus simple et déjà compatible avec l'existant. Limite assumée : un client qui ouvre les outils de développement peut lire l'état complet, **y compris les secrets des autres** (P5, P6). Pas de protection anti-triche en v1.

## 2. Réseau `[A]`

| Élément | Choix proposé | Raison |
|---|---|---|
| Transport | **WebSocket** (bibliothèque `ws`) | simple, fiable, un seul port |
| Topologie | **étoile** : les 8 autres clients se connectent à l'hôte | pas de maillage, latence prévisible |
| Hébergement | serveur Node **embarqué** dans l'exécutable Windows (hôte) | cohérent avec le chantier PACK ; aucun serveur à louer |
| Connexion des amis | réseau privé virtuel au choix de Gabriel (service de réseau virtuel gratuit) **ou** redirection de port du routeur | évite d'exposer le jeu sur Internet ; `[?]` limites des offres gratuites à vérifier avant de choisir |
| Accès | **code de partie + mot de passe** | amis uniquement |
| Données personnelles | aucune collectée | |

Alternative future `[?]` : WebRTC (DataChannel) avec échange manuel de codes de connexion, sans serveur. Moins simple à mettre au point ; hors v1.

**Coût de bande passante** : négligeable (quelques ordres par seconde par joueur). Le **coût réel est le calcul** : chaque client exécute la bataille entière (jusqu'à 400 unités à 20 Hz). Le lockstep avance à la vitesse du client le plus lent ; il faut une **mesure** sur le PC le plus faible du groupe (cible de conception : RTX 3050 ou équivalent, décision de Gabriel). Repli si un PC ne suit pas : mode « observateur » (il reçoit un flux d'état simplifié) pour ce joueur.

## 3. Sièges, rôles, IA

- **Jusqu'à 9 sièges.** Un siège = un joueur humain lié à un **rôle** ou à une **faction** selon le mode (§4). Les sièges non occupés sont tenus par l'IA existante (IA des factions, 02 §14).
- **Déconnexion** : l'IA reprend le siège après un délai court (paramétrable) ; à la reconnexion, le joueur reprend la main sur un instantané synchronisé.
- **Préparation** : salon d'attente (choix du siège, couleur, état « prêt », latence affichée).
- **Hôte parti** : la partie se met en pause et propose le transfert d'hôte au siège désigné (l'hôte transmet instantané + journal). `[?]` faisabilité du transfert à valider en test.

## 4. Modes de jeu pour 2 à 9 joueurs

### 4.1 Coopération tendue : le conseil de chaque camp (modèle : le Cabinet de Paradis) `[A]`
Le gouvernement de Paradis est déjà modélisé par des conseillers et des institutions (fichier 08). Chaque siège **incarne un pouvoir** et dirige son domaine :
| Siège possible | Domaine |
|---|---|
| Commandement du Bataillon d'exploration | expéditions, corps d'élite, porteurs |
| Garnison | défense des murs, canons, ravitaillement local |
| Police militaire | ordre public, contre-espionnage, extraction de porteurs |
| Intendance et économie | production, gaz, vivres, commerce |
| Renseignement | espions, dossiers, fiabilité de l'information (P6) |
| Politique et Couronne | lois, légitimité, diplomatie |
| Culte des Murs | opinion, morale civile |
| Recherche et ingénierie | arbre technologique, doctrine |
| Porteurs | roster de porteurs, héritage, secret (P5) |
- Les camps autres que Paradis ont des domaines équivalents (Marley : haut commandement, Guerriers et porteurs, industrie et flotte, renseignement, politique…) définis par la session d'après les fichiers 08 et 10 ; ce qui n'est pas établi est une création `A`.
- **Conseil mixte (décision de Gabriel)** : chaque domaine du tableau est tenu **soit par un joueur, soit par un conseiller IA** (fichier 08). Un domaine sans joueur reste à son conseiller, qui propose, vote et exécute selon son profil. Un joueur peut **prendre** un domaine tenu par l'IA ou le **rendre** à tout moment (entrée et sortie en cours de partie) ; à moins de 9 joueurs, la partie est complète.
- **Tension** `[A]` : chaque siège a un **objectif personnel visible** (priorités de son domaine) ; les ressources sont rares (gaz, vivres, effectifs), donc les arbitrages sont réels. La **trahison** est possible (§4.4, réglable par l'hôte).
- **Décisions collectives** : les grandes décisions (désengorgement, déclaration de guerre, loi majeure) passent par un **vote du Conseil** (majorité pondérée par le poids politique du siège) ; le mode peut aussi déléguer l'autorité à un seul siège.

### 4.2 Choix du camp et factions selon le scénario `[A]`
- L'hôte choisit le **scénario** ; chaque joueur choisit ensuite un **grand camp** parmi les factions jouables de ce scénario. **Scénario 845 : Paradis ou Marley.** Les camps non tenus sont joués par l'IA existante.
- **Plus le scénario est tardif, plus il y a de camps.** Après la reprise de Shiganshina et la guerre de l'alliance (Marley contre les forces alliées), le choix s'élargit (Paradis, Marley, forces alliées, Hizuru, et les autres camps que les fichiers 01, 06, 11 et 12 établissent). Les camps que le canon n'établit pas sont des créations `A` (ERRATA_V3 §2), jamais présentées comme canon. La liste est une **donnée de scénario** (`factions jouables`), pas du code.
- Dans un camp, les joueurs forment un **conseil mixte** (§4.1) ; entre camps, c'est la **guerre** (diplomatie, espionnage, bataille). Un camp peut avoir 1 joueur ou 5 ; le nombre de joueurs par camp n'est pas imposé.
- **Limites d'équilibre** `[A]` (« une limite adaptée pour ne pas déséquilibrer le jeu ») : pour chaque scénario, un fichier de données fixe par camp les plafonds d'effectifs et de porteurs déployables, le rythme de ravitaillement et l'avantage d'information. L'asymétrie du fichier 26 §9 est **conservée** (Paradis : ODM, murs, canons ; Marley : industrie, flotte, porteurs) et **compensée** par ces limites, pas gommée.
- **Critère mesurable** `[A]` : `npm run sim:balance` — sur 200 parties IA contre IA par scénario et par paire de camps, aucun camp ne dépasse **60 %** de victoires, et chaque camp conserve une voie de victoire plausible (test). Les seuils sont des paramètres de données.
- Le choix du camp reste libre à l'intérieur de ces limites ; l'hôte peut activer une **aide au camp faible** (réglage).

### 4.3 Bataille à plusieurs (jusqu'à 9 commandants) `[A]`
- Lancée depuis une rencontre de la campagne (pas de mode « Simulation de bataille » dans le menu : décision de Gabriel).
- **Chaque joueur dirige ses propres groupes, formations et escouades** : la propriété (`owner`) est portée par l'unité ; un joueur ne donne d'ordres qu'aux unités qu'il possède. Il peut **prêter** ou **céder** une escouade à un autre joueur, et former des groupes et des formations avec les mêmes commandes qu'en solo (sélection, groupes, formations, artillerie sur zone, pause avec file d'ordres). Un porteur est commandé par ordres généraux par son propriétaire.
- **Contrôle direct des porteurs selon l'époque** `[A]` (demande de Gabriel) : dans les époques où les Titans-porteurs sont l'arme décisive (scénario 845, et au-delà tant que la guerre se joue autour d'eux), le joueur qui possède un porteur — en particulier **les joueurs de Marley, chacun avec ses Titans** — le **commande directement** en bataille (déplacement, saisie, transformation, frappes). À partir d'une **époque charnière** située **autour de la saison 4 de l'œuvre (`[?]`, ≈ 854 dans la chronologie du projet, à confirmer dans les fichiers 11 et 12)**, les batailles sont dominées par l'infanterie, l'artillerie et les moyens modernes : les porteurs deviennent des **atouts spéciaux** commandés par **ordres généraux** (comme dans R2+). Le seuil est un paramètre de données. Règle **symétrique** : tout camp qui déploie des porteurs les commande de la même façon (extension de ma part de la demande de Gabriel, pour ne pas avantager Marley seul ; réversible).
- Les unités sans joueur sont tenues par des **officiers IA** subordonnés (même IA qu'en solo) ; un joueur peut leur donner des ordres généraux s'il en a l'autorité (rang, rôle au Conseil).
- **Brouillard par siège** (P4) : chaque commandant voit ce que **ses** unités voient ; il reçoit le reste par signaux, **y compris des signaux des autres joueurs** : l'échange d'informations devient une vraie mécanique de coopération. Les fusées d'un joueur sont visibles de tous ceux qui les voient.

### 4.4 Trahison : « coopération, mais aussi traître » `[A]`
- **Réglage de l'hôte** : `trahison = aucune | possible | garantie` (défaut : `possible`). Avec `possible`, une graine décide s'il y a un traître ; avec `garantie`, il y en a au moins un ; avec `aucune`, la partie est purement coopérative. Au plus 1 traître pour 5 joueurs d'un camp, 2 au-delà.
- **Allégeance secrète** : un siège, humain **ou conseiller IA**, peut servir secrètement un autre camp ou une cause interne (ambition, conviction). Son **objectif secret** est chiffré ; il gagne en l'accomplissant, pas forcément par la défaite de son camp apparent.
- **Actions de traître**, toutes passées par les piliers du fichier 26 : rapport falsifié à fiabilité maquillée (P6), fuite d'identités de porteurs (P5), détournement de gaz ou de vivres (P3, P1), signal trompeur (P4), vote orienté. Chaque action coûte du **capital de trahison** (limité, lent à reconstituer) et laisse des **indices**.
- **Contre-jeu** : enquête (Police militaire, Renseignement), recoupement de rapports, **arrestation par vote du Conseil**. Une accusation juste démasque ; une accusation fausse coûte moral et légitimité au camp et à l'accusateur — **sans exclure aucun joueur**.
- **Personne n'est éliminé du plaisir de jouer** : un traître démasqué, ou qui se révèle volontairement, bascule en acteur ouvertement hostile (défection avec un détachement ou une province) ou en prisonnier jouable (évasion).
- **Secrets et déterminisme** : les allégeances et objectifs secrets ne sont **pas** dans l'état partagé par tous les clients ; ils sont dans un **coffre de secrets tenu par l'hôte**, qui injecte leurs conséquences (résultat d'enquête, effet d'un sabotage) comme événements communs. Le déterminisme est préservé ; **limite** : l'hôte est un joueur, il peut lire son coffre (option : hôte sans siège). Aucune anti-triche n'est ajoutée (décision inchangée) : la trahison repose sur la confiance entre amis. À valider par l'audit de C13 `[?]`.
- **Équilibre** : le traître ne doit jamais rendre la partie injouable pour les autres ; paramètres de coût et d'indices dans les données, mesurés par `sim:balance`.

## 5. Temps, pause et rythme (rythme hybride choisi par Gabriel)

| Échelle | Règle proposée |
|---|---|
| Campagne | horloge **partagée** ; la vitesse (1 à 5) est celle qui a la **majorité** des sièges humains, ou celle de l'hôte (réglable) |
| Pause | tout joueur peut **demander** une pause ; la pause est acquise si l'hôte l'accepte ou si la majorité vote ; chaque joueur dispose de **pauses d'urgence** limitées par jour de jeu |
| Ordres en pause | permis, **horodatés** et exécutés à la reprise (comme dans la pause active actuelle, 03 §1) |
| Bataille | temps réel ; pause **par vote** ; ralenti collectif par vote ; pas de pause individuelle |
| Un siège absent | l'IA décide ; la partie ne s'arrête pas pour lui |

## 6. Communication entre joueurs `[A]`
- **Messages** : discussion de partie (texte), messages privés entre sièges, journal des messages sauvegardé.
- **Pings cartographiques** : marqueurs visibles de tous ou de l'équipe (attaque ici, ravitaillement, danger).
- **Propositions et votes** : fenêtre de vote pour les décisions collectives (§4.1).
- **Notes partagées** par équipe.
- La voix passe par un outil externe (hors du jeu).

## 7. Adaptations du gameplay (fichier 26)

| Pilier | Adaptation multijoueur |
|---|---|
| P1 Le Mur | le désengorgement et la gestion des portes sont des **décisions collectives** (vote) ; la pression s'affiche selon les domaines (Intendance voit les chiffres exacts, les autres une estimation) |
| P3 Gaz et ancrage | les stocks sont partagés par la faction ; l'Intendance arbitre les livraisons : conflits d'allocation entre Garnison et Bataillon |
| P4 Le Signal | brouillard **par siège** ; les fusées inter-joueurs sont la mécanique de coordination |
| P5 L'Horloge | le siège « Porteurs » connaît les identités de ses porteurs ; la Police enquête ; le secret **peut être caché aux autres sièges** de la même faction (trahison, §4.4) |
| P6 La Vérité | la connaissance est **par faction et par siège** : un rapport peut être partagé ou gardé ; la fiabilité (A–D) devient un enjeu de confiance entre joueurs |
| P7 Le Registre | morts et dossiers communs à la faction ; la mémoire collective influence le moral de tous |
| Armées | chaque siège commande **ses** piles ; une pile peut être **prêtée** à un autre siège |

## 8. Interface (dans le cadre unique du jeu)
Tout élément multijoueur vit dans le **cadre d'interface unique** (ERRATA_V3 §3) : barre des joueurs (sièges, couleurs, latence, état), indicateurs de propriété sur la carte (couleur du siège sur les piles), fenêtre de vote, demande de pause, notification de resynchronisation, écran de reconnexion. Le cadre doit être **le même dans tous les modes** (carte, conseil, bataille).

## 9. Prérequis neutres (autorisés avant confirmation) et plan d'implémentation

**Neutres (pas de réseau, bénéfiques de toute façon)** :
1. Audit du déterminisme : lister les sources possibles de non-déterminisme dans `src/sim` (ordre d'itération, flottants, horloge) et ajouter un **test de rejeu** (même journal → même empreinte, 3 exécutions).
2. Commandes **sérialisables** : toute action du joueur passe par une commande typée, horodatée, rejouable.
3. Propriété des entités : chaque pile, escouade, province et institution porte un `owner` (siège) ; aucune règle ne suppose « un seul joueur ».
4. Connaissance par faction (P6) et brouillard par siège (P4) conçus par entité, pas globaux.

**Après confirmation** :
5. Module `src/net` (hors `src/sim`) : séquenceur, client, protocole de messages typés (Zod), détection de désynchronisation, resynchronisation.
6. Serveur hôte Node embarqué (`ws`) ; salon d'attente (scénario, **choix du camp**, sièges, réglage de trahison) ; IA de remplacement ; reconnexion ; **coffre de secrets de l'hôte** (§4.4).
7. Pause et vitesse par vote ; messages, pings, votes.
8. Tests : simulation headless de 2 à 9 clients, **camps rivaux** et **scénario avec traître** (le secret ne fuit pas dans l'état partagé ; empreintes identiques), avec flux d'ordres aléatoires (graine fixée), délais et pertes simulés, vérification des empreintes ; test de reconnexion ; test d'hôte perdu.
9. Mesure de performance sur le PC le plus faible ; repli « observateur ».
10. Emballage dans l'exécutable Windows (chantier PACK).

**Critères d'acceptation (cibles)** : 9 clients headless, 10 minutes de partie simulée, 0 désynchronisation sur 10 graines ; une déconnexion/reconnexion en cours de bataille ne casse pas l'empreinte ; aucune commande perdue ou dupliquée ; le cadre d'interface est identique dans tous les modes.

## 10. Décisions de Gabriel (2026-10-13, soir) et défauts appliqués

| # | Sujet | Décision de Gabriel / défaut |
|---|---|---|
| 1 | Modes | **Coopération dans chaque camp** : conseil mixte joueurs + conseillers IA ; en bataille, chaque joueur dirige ses groupes, formations et escouades. Camps rivaux (4.2) et trahison (4.4) **retenus** (message du soir). |
| 2 | Agenda caché (traître) | **oui** : « coopération, mais aussi traître » (§4.4) — réglage de l'hôte |
| 2 bis | Choix du camp | **oui** : scénario 845 Paradis ou Marley, davantage de camps pour les scénarios tardifs, limites d'équilibre (§4.2) |
| 2 ter | Titans en bataille | les joueurs de Marley commandent leurs Titans jusqu'à l'époque charnière ≈ saison 4 (`[?]`), puis infanterie ; règle symétrique `[A]` (§4.3) |
| 3 | Règle de pause (§5) | `[A]` défaut : règle proposée au §5 (Gabriel : « aucun ne change ») |
| 4 | Anti-triche | `[A]` défaut : aucune en v1 (non tranché) |
| 5 | Connexion | `[A]` non tranché : les sessions préparent le serveur sans choisir entre réseau privé virtuel et redirection de port |
| 6 | PC le plus faible | inconnu : cible provisoire `[A]` = PC de Gabriel (RTX 3050) ; à mesurer par lui |
| 7 | Jouer à moins de 9 | oui, par construction (conseil mixte : les domaines sans joueur restent à l'IA) |
