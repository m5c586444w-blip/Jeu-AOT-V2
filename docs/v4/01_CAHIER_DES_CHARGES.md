# 01 — Cahier des charges V4 (Godot)

> Statut : **PROPOSÉ**, relu en R-D1 (voir `04`, section 0). Dépend de : `04_REGISTRE_DES_DECISIONS.md`.
> Étiquettes : `[C]` canon · `[A]` choix de la direction · `[?]` à lever par un spike. Les règles de jeu détaillées restent dans `docs/spec/26` et `27` (V4-D13).

## 1. Vision

*Murs et Sang* est un jeu de grande stratégie, privé et non commercial (Gabriel et au plus 8 amis), fidèle au lore de *L'Attaque des Titans* (ligne éditoriale : **réalisme, fidélité au lore, jouabilité**). La V4 reconstruit tout dans **Godot** avec des modèles 3D détaillés, un rendu **réaliste sombre début XXᵉ siècle**, et une expérience de bataille où le joueur est **commandant et combattant à la fois**.

## 2. Les trois niveaux de jeu

| Niveau | Ce que fait le joueur | Règles de référence | Vue |
|---|---|---|---|
| **Stratégique** (campagne) | Gère provinces, institutions, conseil, recherche, expéditions, politique, Mur, porteurs, dossiers, registre des morts | `02`, `26` §2–8, `08` | Carte du monde, écrans de gestion dans le cadre d'interface unique |
| **Commandant** (bataille) | Place les escouades, choisit formations et objectifs, donne des ordres, lit signaux et brouillard | `03`, `26` §4–5, `27` §4.3 | Caméra libre au-dessus du champ de bataille |
| **Combattant** (bataille) | Incarne un soldat de sa section (ODM, lames, lance de foudre), mène sa section au combat | `26` §4 (gaz, ancrage), `03` | 3ᵉ personne |

**Passage entre les niveaux commandant et combattant** `[A]` : le joueur choisit de « prendre le contrôle » d'un soldat de ses propres escouades (touche dédiée) et revient à la vue commandant à tout moment. Quand il combat, la vue commandant est remplacée par une carte réduite et la radio (signaux) ; ses ordres à la voix restent disponibles. Il ne contrôle **que** des unités qui lui appartiennent (`owner`, D-168) ; les autres joueurs voient son soldat comme une unité ordinaire.

**Commande vocale** (V4-D10, V4-D21, détail `06`) : les escouades IA se commandent à la voix, en français, avec une grammaire fermée. Le résultat de la reconnaissance est une **commande typée** identique à celle du clavier : c'est ce texte-là, et non l'audio, qui est envoyé aux autres joueurs.

## 3. Mode multijoueur (résumé de `27`)

- 1 à 9 joueurs, lockstep déterministe, hôte séquenceur, étoile (27 §1–2, V4-D07).
- Conseil mixte joueurs + conseillers IA dans chaque camp ; choix du camp selon le scénario (845 : Paradis ou Marley) avec limites d'équilibre ; trahison possible (coffre de secrets de l'hôte) ; Titans commandés par leurs joueurs jusqu'à l'époque charnière ≈ saison 4 `[?]`.
- À plusieurs sièges dans une même faction, `owner` est obligatoire sur toute entité commandable et vérifié au démarrage (D-168).
- Un joueur qui incarne un combattant reste soumis au même pas de simulation que les autres (voir spike S5 pour le ressenti).

## 4. Exigences non fonctionnelles

| Exigence | Valeur | Statut |
|---|---|---|
| Plateforme | Windows 64 bits uniquement (un seul exécutable identique pour tous les joueurs d'une partie) | `[A]` |
| Machine minimale | RTX 3050, qualité réglable (Bas, Moyen, Haut, Ultra) ; gros modèles seulement en Haut/Ultra et en plan rapproché | FIGÉ (V4-D08) |
| Fluidité | **aucun objectif chiffré avant la mesure S2** ; le critère sera fixé alors | `[?]` |
| Chargement | à froid < 8 s, scène de bataille < 3 s, mesurés sur la RTX 3050 | `[A]` repris de l'ancien `CLAUDE.md` |
| Langue | interface et voix en français ; textes dans des fichiers de traduction (clés), jamais dans le code | `[A]` |
| Accessibilité | tout ce qui se fait à la voix se fait au clavier/menu radial ; sous-titres des retours vocaux | `[A]` |
| Vie privée | aucune donnée collectée ; audio traité localement, jamais envoyé ni conservé par défaut | `[A]` |
| Réseau | jeu privé, aucune exposition publique ; connexion par réseau privé virtuel ou redirection de port, au choix de l'hôte | `[A]`, `27` §10 point 5 non tranché |
| Provenance | règle héritée : aucune ressource de l'œuvre ou de fans dans le dépôt (V4-D11) | **EN ATTENTE** de la décision de Gabriel (`organisation/04_POLITIQUE_DE_PROVENANCE.md`) |

## 5. Hors périmètre de la V1 jouable

Diffusion publique, matchmaking en ligne, anti-triche, Mac/Linux/console/mobile/VR, éditeur de scénarios et mods, chat vocal entre joueurs, ressources tirées de l'œuvre. Chacun peut être réétudié par demande de changement (`04`, section 4).

## 6. Possibilités nouvelles (classement MoSCoW proposé — à corriger en R-D1)

Taille : S = quelques jours de travail, M = une à deux semaines, L = plusieurs semaines, XL = plus d'un mois, à calibrer après M1. Ce sont des **estimations non mesurées**.

| ID | Possibilité | Intérêt | Taille | MoSCoW proposé | Dépend de |
|---|---|---|---|---|---|
| N01 | Mode combattant ODM à la 3ᵉ personne | cœur de la promesse « commandant et combattant » | XL | **Must** | S5, S2, M5, M7 |
| N02 | Commande vocale des escouades IA | demandé par Gabriel | L | **Must** | S3 |
| N03 | Cartes de bataille générées depuis les lieux (`data/places`, ~2,1 Mo de JSON) | rend jouables tous les lieux créés | L | **Must** | M5, M10 |
| N04 | Titans à mouvement procédural (cinématique inverse, contact avec les bâtiments) | Titans « dérangeants » (dette n° 69 de l'ancien dépôt) | L | Should | S6 |
| N05 | Dégâts visibles : brèches dans le Mur, bâtiments endommagés | lisibilité du pilier P1 | L | Should | M4, M7 |
| N06 | Météo et cycle jour/nuit dynamiques (signaux P4, visibilité) | réalisme, portée des fusées | M | Should | S2 |
| N07 | Foules civiles et évacuation visibles | pilier P1 | L | Could | S2 |
| N08 | Replay de bataille avec caméra cinématique | partage entre amis | M | Could | V4-D20, M7 |
| N09 | Mode photo | confort | S | Could | M7 |
| N10 | Manette | confort | M | Could | M7 |
| N13 | Décors issus d'une carte voxel fournie par Gabriel (voie B, V4-D23) | atteindre le niveau de détail des lieux visé par Gabriel sans tout modéliser | L | Should (selon S7) | S7, V4-D11, M8 |
| N11 | Chat vocal entre joueurs | hors périmètre | M | Won't (V1) | — |
| N12 | Éditeur de scénarios / mods | hors périmètre | XL | Won't (V1) | — |

## 7. Critères de réussite de la V1 jouable

Chaque critère est une **commande** ou une **mesure** (détail dans `03`) :
1. Scénario 845 jouable de bout en bout en solo, de la campagne à la bataille et retour.
2. Session de 9 clients sans désynchronisation pendant 10 minutes sur 10 graines (27 §9).
3. Rejeu : même graine et même journal → même empreinte, trois exécutions de suite (V4-D20).
4. Bataille de 400 unités simulées jouable sur RTX 3050 au préréglage Bas (seuil de jouabilité fixé en S2, mesuré par Gabriel).
5. Commande vocale : au moins 90 % de commandes correctes sur un jeu de 60 commandes françaises, 100 énoncés dits par Gabriel (S3) `[A]`.
6. `canon:check` équivalent vert : aucune donnée ne contredit un fait `C` ; toute création est étiquetée `A`.
7. Aucune ressource de provenance non admise : contrôle d'assets équivalent à `assets:check` et registre d'assets complet (`organisation/04_POLITIQUE_DE_PROVENANCE.md` §5), selon la politique choisie par Gabriel.

## 8. Ce que ce document ne contient pas

L'architecture technique est dans `02`, le plan et les critères de jalon dans `03`, les risques dans `05`, la voix dans `06`, les références visuelles dans `07`.
