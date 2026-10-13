# Résumé des trois jours d'autonomie (2026-10-09 → 2026-10-12)

Mandat de l'utilisateur (D-148) : continuer sans intervention d'après les documents et ses décisions, R3 → P9 → P10 → PACK
puis dettes, une tâche = un commit poussé sur `claude/intelligent-feynman-8ekib4`. Page illustrée (privée, à partager depuis
son menu) : https://claude.ai/artifact/81UiqPs9xQk9qHtQFpo9VH (mêmes images, tirées de `docs/screenshots/`).

## En chiffres
- 82 commits du 9 octobre 19:46 (R3.1, `b5d1abe`) au 11 octobre 13:44 (`87014cf`), plus la recherche globale le 13.
- Quatre phases closes (R3, P9, P10, PACK), deux demandes de l'utilisateur traitées (style des soldats, contrôle de la 3D),
  une cinquantaine de dettes et d'écarts d'audit corrigés en tout ou en partie.
- Dernier `npm run verify` (2026-10-13, `recherche-verify.log`) : « Test Files  138 passed (138) », « Tests  819 passed
  (819) », `sim:selftest : OK`, `EXIT=0`.
- **Interruption** : du 11 octobre vers 14:00 UTC au 13 octobre 17:30 UTC, la session a été relancée à répétition sans
  reprendre la tâche (52 rappels horaires en attente). Les 30 dernières heures du mandat n'ont donc rien produit ; la
  session a repris le 13 pour finir la recherche globale et écrire ce résumé.

## Phases terminées
| Phase | Date | Ce qui a été livré | Rapport |
|---|---|---|---|
| R3 | 9 oct. | Titans de 3 à 15 m (5 tailles × 3 proportions, 2 peaux), dents et yeux, démarche irrégulière ; 5 tenues (3 Paradis, 2 Marley) ; poses lues de la simulation ; branchement dans la bataille 3D | `R3.md` |
| P9 | 9–10 oct. | Fins par objectifs (845, 850, 854 des deux camps) ; 4 difficultés ; scénario du Grondement ; 845 jouable et événements E43–E52 ; invasion amphibie de l'IA de Marley ; `sim:balance` et 1 000 parties par scénario | `P9.md` |
| P10 | 10 oct. | Accessibilité (daltoniens, mouvements réduits, aide à la lecture), difficulté personnalisée ; `sim:parcours` (5 ans) ; manuel en jeu (F1) ; lancement local hors réseau ; audit `CONFORMITE.md` ; latences | `P10.md` |
| PACK | 10 oct. | Application de bureau Electron, `npm run package:win`, `smoke:pack`, `docs/LANCER_SUR_WINDOWS.md` (construite depuis Linux, jamais lancée sous Windows) | `PACK.md` |

Équilibrage final (P9, victoires du joueur) : 845 64,3 % ; 850 53,8 % ; 854 Paradis 57,1 % ; 854 Marley joué 0 %
(dette n° 66) ; Grondement 31,5 % ; mortalité des expéditions 26,5 %.

## Après les phases (10–13 oct.)
- **Style des soldats** (`CLAUDE.md`, dette n° 72, `dette-72.md`) : veste courte brune, chemise claire, pantalon blanc,
  bottes, harnais ; emblèmes redessinés (ailes, deux roses, licorne, épées croisées) ; cape verte à capuche rabattue sous
  la pluie ; tenues sombres de 854, lances de foudre, équipement anti-personnel ; cérémonies en 3D (diplômes de la 104ᵉ,
  discours d'Erwin, médailles par la reine Historia).
- **Contrôle de la 3D** (`CONFORMITE-3D.md`) : « non, pas entièrement » ; conforme pour l'architecture, les licences, les
  soldats, les environnements et le droit d'auteur ; partiel pour la latence (GPU réel jamais mesuré), les lieux, les
  Titans et le décor de bataille. Corrections faites ensuite (liste ci-dessous).
- **Bataille 3D** : décor habillé (n° 74), bâtiments translucides devant l'unité choisie (n° 75), mur d'enceinte en fond
  (n° 55), aube, crépuscule et pluie (n° 70), Arbres Géants, chevaux et cavaliers, lames usées lâchées, jets de gaz, fusées
  de signal, foule qui marche (n° 61), recul et rechargement (n° 65), Brigade Militaire, officiers, Alliés, Hizuru (n° 62),
  batailles d'expédition en 3D (n° 46).
- **Lieux** : habitants dans les rues (n° 6), étals et péniches, halle de Quinta à beffroi (n° 12), herbe entre les pavés
  de 850 (n° 9 en partie), ville lisible sous la fumée (n° 10), horizon (n° 5).
- **Carte et interface** : calques entièrement teintés (n° 13, 14), noms des murs (n° 15), menu contextuel au clic droit
  (E-05), surimpressions F2 (E-08), aides des calques (n° 44), garde WebGL 1 du repli 2D (n° 47), anglais complet
  (3 886 textes, E-07), cône d'incertitude des expéditions (F-STR-08), recherche globale (F-UIX-06, touche Q).
- **Textes** : événements passés au passé (n° 31), articles contractés, accords en nombre (n° 21), économie de l'interface
  calculée avec les modificateurs de la simulation (n° 38).

## Comment ça marche
1. **Simulation pure** (`src/sim`) : tout passe par des commandes ; même graine et mêmes commandes donnent la même partie.
   Figée depuis R2 : les empreintes des anciennes batailles ne bougent pas.
2. **3D en deux temps** : three.js n'est chargé qu'à l'ouverture d'une bataille ; « prêt » montre la ville et des repères
   simplifiés, les corps détaillés suivent. La 3D lit l'état de la simulation (la pose d'un soldat suit son état) sans
   jamais l'écrire.
3. **Figures** : corps de base MakeHuman (CC0) déformés par classe de Titan ; uniformes et emblèmes dessinés par le projet
   (aucun fichier de l'œuvre), statut C / A / ? dans `data/art/`.
4. **Foule** : des milliers d'hommes dessinés en un appel (instances) ; le balancement des membres est calculé par la carte
   graphique.
5. **Ambiance** : éclairage d'aube, de jour, de crépuscule ou de nuit et pluie en particules ; sous la pluie, la cape du
   Corps de Reconnaissance devient capuche.
6. **Équilibrage** : `sim:balance` joue des milliers de parties sans interface, conduites par un pilote automatique qui
   envoie des commandes, et produit un rapport JSON et HTML.
7. **Windows** : Electron emballe le jeu construit, qui tourne hors réseau (polices locales, aucun CDN).
8. **Langues** : textes par clés, pluriels `{n|un|plusieurs}` ; un test exige au moins 90 % de clés anglaises.
9. **Recherche globale** : index en mémoire des provinces, personnages (nom connu seulement), décrets et registres, sans
   accents ; mot entier, puis début de mot, puis fragment.

## Captures (ouvertes et relues le 2026-10-13)
1. `r3-titans.png` : 15 Titans de 3 à 15 m alignés à côté d'un soldat de 1,7 m. Défauts : corps encore lisses ; visages
   proches de l'humain ; étiquettes « b » décalées sous les autres.
2. `r3-bataille-paradis-1366.png` : section de la Garnison sur une place pavée, panneau d'ordres à droite. Défauts : fusils
   tenus droits, peu naturels ; façades sans profondeur ; bande d'escouades coupée à droite.
3. `p9-objectifs-850.png` : épilogue de 850, cinq objectifs et leurs pourcentages. Défauts : colonne de droite vide ;
   « 0 objectif(s) » pluriel de secours ; bilan à tirets en début de partie.
4. `p9-grondement-assaut.png` : atlas du monde ravagé à 27 %, choix Empêcher / Retarder / Laisser faire. Défauts : liste
   des Titans coupée en bas ; noms de provinces petits ; « province(s) ».
5. `p10-options-accessibilite.png` : options, daltoniens et aide à la lecture cochés, volumes. Défauts : la fenêtre
   déborde sous le menu ; carte vide derrière ; texte d'aide long.
6. `p10-manuel.png` : manuel F1, section « Les registres » et touches. Défauts : liste des touches coupée ; colonne de
   gauche sans repère de défilement ; notification partiellement cachée.
7. `pack-partie.png` : partie de 850 dans l'application Electron, alerte de la brèche de Trost. Défauts : quelques
   pastilles serrées autour de Trost ; notification tronquée ; aucun cadre de fenêtre Windows (capture sous Linux).
8. `r3-uniformes.png` : quatre corps de face et de dos avec leurs emblèmes, pluie et 854. Défauts : capes raides ;
   visages identiques ; écussons très petits sur la veste.
9. `r3-medailles.png` : salle du trône, la reine Historia entre deux rangs saluant. Défauts : salle nue ; reine sans
   médaille en main ; deux rangs trop symétriques.
10. `r3-bataille-pluie-1366.png` : rue au crépuscule sous la pluie, capuches levées, carnet de combat. Défauts : pluie en
    traits réguliers ; façades sombres peu lisibles ; anneaux de sélection très vifs.
11. `bataille-foret-suivi.png` : Forêt des Arbres Géants, troncs côtelés, escouade en cape. Défauts : sol uni ; houppiers
    ronds simplifiés ; étiquette « 1 » illisible.
12. `pa-cavaliers-profil.png` : colonne de cavaliers de profil, robes variées. Défauts : chevaux anguleux ; cavaliers sans
    rênes ; mur gris coupé à droite.
13. `bataille-jets-de-gaz.png` : vue plongeante, bouffées de gaz derrière une escouade. Défauts : bouffées pâles sur le
    pavé ; Titan peu lisible de dessus ; carnet chargé.
14. `map-1366-calque-politique.png` : calque politique, provinces tenues, aux Titans et perdues. Défauts : brun et rouge
    proches ; étendards serrés à Trost ; légende courte.
15. `en-armees-1366.png` : registre des armées en anglais, murs nommés en anglais. Défauts : « Brigade Reserve » à relire ;
    « Form a detachment: » coupé ; traduction relue par échantillons.
16. `p3-carte-expedition.png` : expédition n° 1 vers Maria-Est, tracé et cône. Défauts : cône encore discret ; bulle qui
    couvre le coin ; étiquette de la forêt coupée.
17. `recherche-globale.png` : fenêtre « Rechercher », « tro », trois résultats, loupe dans le bandeau. Défauts : décret
    trouvé par un fragment ; fenêtre sur la carte ; touche Q rappelée seulement dans l'infobulle.

## Ce qui reste en dette
- n° 60 et 53 : en temps réel, Titans et fantassins traversent les bâtiments ; la correction touche `src/sim`, figé depuis
  R2 : **décision de votre part**. Même cas pour les écarts E-02, E-04, E-10 et C-08 (ordres diversion, évacuer, incendier).
- n° 66 : Marley mené par le joueur ne gagne jamais ; n° 67 : pierre de glace épuisée dans 85 à 98 % des parties.
- n° 1, 49, 64, 71, 73 : rien n'a été mesuré sur GPU réel ; au rendu logiciel, la bataille est « prête » en 4,5 s en
  qualité basse (cible 3 s).
- n° 69 : fonctions P2 encore absentes (F-STR-11 règle des distances, F-STR-19 liste triable des provinces, F-UIX-05,
  F-UIX-22…).
- n° 22 et 23 : musique et sons jamais écoutés ; aucun enregistrement libre (réseau refusé).
- n° 63 (en partie) : visages de Titans encore humains ; n° 9 : CR1e-07.
- LC-B, LC-C, LC-D (murs Rose et Sina, hors-murs) attendent votre feu vert ; la revue de P9 reste due.

## À vérifier sur votre PC
1. `npm run package:win` sous Windows, puis lancer l'application (`docs/LANCER_SUR_WINDOWS.md`) : jamais fait.
2. Sur votre carte graphique : `npm run mesure:r1d` et une bataille 3D en qualité moyenne et haute ; noter si « prêt »
   passe sous 3 s.
3. Revue de P9 et des captures de la 3D ; décision sur la dette n° 60.
4. Écouter musique et sons ; faire relire l'anglais.
5. Jouer 845, 850, 854 et le Grondement : touche Q (recherche), clic droit sur la carte, F2 en bataille.
