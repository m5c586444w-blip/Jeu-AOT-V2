# Dettes corrigées après la dette n° 72 — partie 2 sur 4

Sommaire et méthode : `dettes-suite.md`.

## Dette n° 61 (en partie) : la foule instanciée marche et court
- Au-delà de la distance de détail, soldats et fantassins instanciés balancent jambes et bras (bras opposés aux jambes)
  selon l'état montré par le directeur : marche (0,42 rad, 6,5 rad/s) ou course (0,75 rad, 11 rad/s) ; immobiles à
  l'arrêt, en vol, morts, et en mouvements réduits. Membres marqués à la construction (`aLimb`), pas par instance (`aWalk`),
  pivot dans le shader (`crowdWalk.ts`). Reste : primitives au lieu de corps.
- `npm run verify` (`dette61-verify.log`) : « Test Files  124 passed (124) », « Tests  787 passed (787) », `EXIT=0` ;
  `smoke:r2 -- --captures` (`dette61-smoke-r2.log`) : « 0 erreur console » (shader compilé), « tout est conforme. »,
  `EXIT=0`.
- **`r2-suivi-1366.png`** : l'escouade 02 en cape verte sur une place pavée, un soldat de la foule au loin à gauche.
  - Défauts : le balancement ne se voit pas sur une capture fixe (contrôlé par les tests et l'absence d'erreur de
    shader) ; ombres de la foule figées (matériau d'ombre non modifié) ; numéros d'escouade estompés serrés au fond.

## Dette n° 6 : habitants des lieux
- Figures civiles instanciées (six tenues : chemise ou corsage, pantalon ou jupe longue, fichu ou cheveux ; A), debout le
  long des rues (une tous les 4 m sur une voie principale, 9 m dans une rue, 20 m dans une ruelle) et sur les places (une
  pour 22 m² au marché, 70 m² ailleurs), multipliées par la part présente de l'état ; au plus 2 500 ; aucune dans
  Shiganshina en 850 ; cachées au-dessus de 250 m d'altitude de caméra (vues d'ensemble).
- `npm run verify` (`dette6-verify.log`) : « Test Files  125 passed (125) », « Tests  789 passed (789) », `EXIT=0` ;
  `tests/places/habitants.test.ts` : « habitants de Shiganshina par état : {"845-avant":2500,"845-breche":2500,
  "850-reprise":0} ». `places:captures` (`dette6-captures.log`) : `EXIT=0`, vue de la grand-rue 2 168 k triangles
  (1 723 k sans les habitants).
- **`docs/places/shiganshina/vue-marche.png`** : la grande place pavée du marché, sa halle et ses arbres, des dizaines de
  passants dispersés ; le mur Maria au fond. **`vue-grand-rue.png`** : rue pavée bordée d'arbres et de maisons à
  colombages, cinq à six passants dont une femme en jupe rouge.
  - Défauts : place encore sans étals (dette n° 12) ; passants immobiles, sans ombre portée visible de loin ; répartition
    uniforme (aucun attroupement) ; +445 k triangles dans les vues de rue.

## Dette n° 12 (en partie) : étals de marché et péniches
- Places de marché : étals en rangées décalées (table sur tréteaux, quatre montants, auvent de toile de quatre teintes,
  caisses de denrées), à 5 m des bords, loin des arbres, des fontaines et des bâtiments repères, une place sur cinq
  laissée libre. Canaux à quais : péniches de 8 m amarrées tous les 22 à 34 m, côtés alternés, loin des ponts, une sur
  deux bâchée. Ville habitée seulement ; formes et teintes A.
- `npm run verify` (`dette12-verify.log`) : « Test Files  126 passed (126) », « Tests  791 passed (791) », `EXIT=0` ;
  `tests/places/marche.test.ts` : « étals de Shiganshina : 65 sur place-du-marche », « barques de Shiganshina : 38 ».
- **`vue-marche.png`** : la place du marché garnie de rangées d'étals aux auvents rouges, verts, gris et sable, des
  passants entre eux, la halle et les arbres au fond. **`vue-canal.png`** : le canal entre deux quais pavés, une péniche
  bâchée amarrée sous la roue du moulin, d'autres plus loin.
  - Défauts : auvents plats (sans plis ni rayures) ; une péniche presque sous la roue du moulin ; étals tous orientés
    de la même façon par rangée ; aucun chaland ni marchandise sur les quais.

## Dette n° 10 : vue d'ensemble de 845-brèche sous la fumée
- Sous un ciel enfumé, le voile est divisé par deux pour les vues à plus de 1 200 m (vue d'ensemble) ; les vues de rue
  gardent leur fumée.
- `npm run verify` (`dette10-verify.log`) : « Tests  791 passed (791) », `EXIT=0` ; `places:captures -- shiganshina
  --vues ensemble --sans-portes` (`dette10-captures.log`) : « ΔE 18.0 ≥ 6 : etat-845-avant | etat-845-breche »,
  « ΔE 3.4 < 6 : etat-845-avant | etat-850-reprise » (dette n° 9, inchangée), `EXIT=0`. Rapport des vues fusionné.
- **`etat-845-breche.png`** : Shiganshina de haut sous un ciel brun ; rues rayonnantes, toits, places et mur lisibles,
  la route et les faubourgs à gauche.
  - Défauts : teinte brun-gris uniforme (aucun foyer d'incendie visible de si haut) ; horizon toujours noyé ; la brèche de
    la porte extérieure ne se voit pas à cette distance.

## Dette n° 9 (en partie) : l'abandon de 850 se voit dans la rue
- Au niveau de la rue, Shiganshina en 850 ressemblait à 845 (la friche n'était semée que dans les îlots). Désormais, selon
  `abandon` : couche d'herbe en transparence sur chaussées et places (plaques dans les joints), touffes d'herbe
  instanciées (au plus 15 000), chaussées légèrement verdies (A). Le ΔE de la vue d'ensemble ne bouge pas (brume).
- `npm run verify` (`dette9-verify.log`) : « Test Files  127 passed (127) », « Tests  793 passed (793) », `EXIT=0` ;
  captures (`dette9-captures-etats.log`) : « ΔE 3.3 < 6 : etat-845-avant | etat-850-reprise », « ΔE 18.0 ≥ 6 :
  etat-845-avant | etat-845-breche », `EXIT=0`.
- **`etat-850-reprise-grand-rue.png`** : la grand-rue en 850, pavés envahis de plaques d'herbe verte, quelques touffes,
  aucun habitant, aucun étal.
  - Défauts : maisons et arbres d'alignement intacts (aucune ruine dans cette rue) ; ciel bleu au lieu du ciel brumeux de
    l'état (`--etat` ne règle que le plan) ; plaques d'herbe répétées par la tuile ; herbe plate sans relief de près.

## Dette n° 5 (en partie) : horizon des vues d'ensemble
- Le triangle bleu ne se reproduit pas sur la vue d'ensemble actuelle. Défaut voisin corrigé : la prairie s'arrêtait en
  carré à 9 km, avant le plan lointain des caméras (12 km), et ses coins découpaient l'horizon ; elle va désormais à 16 km.
- `npm run verify` (`dette5-verify.log`) : « Tests  793 passed (793) », `EXIT=0` ; `places:captures` (`dette5-captures.log`) :
  `EXIT=0`, ΔE des états inchangés (17,9 ; 3,3 ; 17,7).
- **`vue-ensemble.png`** : Shiganshina de haut, horizon droit.
  - Défauts : bord net entre la prairie voilée et le ciel blanc ; ciel uniforme sans nuages ni bleu dans cette vue ; la
    route et les faubourgs se perdent dans la brume à gauche.

## Dette n° 36 (en partie) : étendards au contact sur la carte
- Une armée en marche arrêtée au contact d'une autre gardait la case 0 et se dessinait sous l'étendard adverse (« 808 »
  caché sous « 1,9 k ») : les cases sont désormais réparties entre étendards proches (`spreadSlots`), et l'écart entre
  deux cases passe de 26 à 38 px.
- `npm run verify` (`dette36-verify.log`) : « Test Files  128 passed (128) », « Tests  795 passed (795) », `EXIT=0` ;
  `smoke:pa` (`dette36-smoke-pa.log`) : « smoke:pa : tout est conforme. », `EXIT=0`.
- **`pa-rencontre.png`** (recadré au Plateau du Nord) : l'étendard vert de l'Armée du Sud, cerclé (choisi), « 808 », et à
  sa droite l'étendard rouge à étoile de Marley, « 1,9 k ».
  - Défauts : le cercle de contact (rouge) reste sous l'étendard de Paradis seul ; les deux effectifs sont proches du bord
    de l'île ; aucune flèche ne relie les deux armées.

## Dette n° 40 (en partie) : coût des planches de mission
- La ligne « coût · durée » d'une planche passe sur deux lignes au plus au lieu d'être coupée par des points de suspension.
- `npm run verify` (`dette40-verify.log`) : « Tests  795 passed (795) », `EXIT=0` ; `smoke:mis` (`dette40-smoke-mis.log`) :
  « smoke:mis : tout est conforme. », `EXIT=0`.
- **`mis-ecran-1366.png`** : registre des missions, arbre militaire ; « Acier 800, Poudre 600, Or 3 000 · 6 mois » lisible
  en entier sur la planche « Canons des remparts ».
  - Défauts : troisième colonne coupée par la zone de défilement de l'arbre (il faut faire défiler) ; lignes de liaison
    serrées entre colonnes ; fiche de détail qui masque une partie de l'arbre.

## Dette n° 43 (en partie) : bulle du guide à côté d'un registre large
- Quand un registre occupe presque toute la largeur, la bulle se rétrécit pour tenir dans la colonne libre à sa droite
  (au moins 230 px) au lieu de mordre de 50 px sur le registre ; elle est mesurée à sa largeur naturelle avant chaque
  placement (sans cela, elle oscillait entre deux largeurs : premier `smoke:tuto` en échec, bouton « Suivant » instable).
- `npm run verify` (`dette43-verify.log`) : « Tests  796 passed (796) », `EXIT=0` ; `smoke:tuto` (`dette43-smoke-tuto.log`) :
  « « economie », explication : bulle dans la fenêtre, sans recouvrir l'élément montré (côté « bord ») », « smoke:tuto :
  tout est conforme. », `EXIT=0`.
- **`tuto-economie-1366.png`** : registre de l'économie (nourriture, production, consommation, pertes) ; la bulle « Étape 6
  sur 14 — L'économie » à sa droite, sans le recouvrir.
  - Défauts : la bulle couvre la colonne des notifications ; infobulle « Économie — Raccourci V » restée sous le registre ;
    bulle plus haute (texte sur plus de lignes).

## Dette n° 19 (en partie) : fond du menu
- Le canon des remparts (`meshProps.ts`, accessoire « canons ») est redessiné : affût à deux flasques avec gradins, essieux
  et quatre roues pleines, fût conique avec bourrelet de bouche, plate-bande de culasse et bouton, tourillons, coin de mire.
- `public/menu/murs-crepuscule.jpg` est remplacé par un rendu natif 3840×2160 du chemin de ronde de Shiganshina au
  crépuscule (`?proto3d&lieu=shiganshina&lumiere=crepuscule&vue=rempart&qualite=haut&panneau=0`), au lieu d'un
  1920×1080 agrandi. Le journal de raisonnement des IA était déjà réservé au mode auteur (E-UX-1).
- `npm run verify` (`dette19-verify.log`) : « Test Files  128 passed (128) », « Tests  796 passed (796) », `EXIT=0`.
- **`murs-crepuscule.jpg`** : chemin de ronde pavé qui file vers une tour de porte ; ville aux toits rouges et ardoise à
  gauche dans la brume ; à droite, une file de canons sur plates-formes de bois, le premier avec roues, flasques et fût.
  - Défauts : plate-forme de bois unie, d'un orange trop vif ; ciel uniforme sans nuages ; canon d'un brun rouge trop
    saturé ; parapet extérieur flou au loin ; aucun soldat sur le chemin de ronde.

## Dettes n° 70 et 72 (en partie) : aube, crépuscule et pluie en bataille 3D (D-172)
- Options de la bataille : « Heure (vue 3D) » (jour, aube, crépuscule ; absente d'une bataille de nuit) et « Pluie (vue
  3D) ». Rendu seul (`battle/ambiance.ts`) : astre bas, teintes des heures de l'essai 3D, fenêtres allumées au crépuscule ;
  pluie : traits autour de la caméra, ciel gris, brume rapprochée, soleil voilé ; capuches des capes du Corps levées (figures
  détaillées et foule). Jour et nuit gardent exactement leurs réglages d'avant (test).
- Premier essai trop sombre (crépuscule pluvieux pris pour la nuit, pluie presque invisible) : hémisphère doublée à l'aube
  et au crépuscule, lumière diffuse accrue sous la pluie, boîte de pluie resserrée (40 m) et traits plus longs.
- `npm run verify` (`dette70-verify.log`) : « Test Files  129 passed (129) », « Tests  800 passed (800) », `EXIT=0` ;
  `smoke:r3` (`dette70-smoke-r3.log`, bataille seule) : « crépuscule sans pluie : capuches roulées au col », « pluie : traits
  de pluie, 24 capuches levées », « retour au temps sec : ni pluie ni capuche levée », « smoke:r3 : tout est conforme. »,
  `EXIT=0`.
- **`r3-bataille-crepuscule-1366.png`** : rue pavée de la Ville des Murs au couchant ; façades de gauche éclairées en
  orangé, fenêtres allumées ; une section de la Garnison de dos, emblème aux deux roses.
  - Défauts : ciel hors du cadre (l'heure se lit surtout aux façades) ; pavés sombres, peu de contraste au premier plan ;
    étiquette « S1 » seule au milieu de la rue.
- **`r3-bataille-pluie-1366.png`** : caméra de suivi de l'escouade 05, ruelle sous un ciel couvert ; traits de pluie ; quatre
  soldats en cape verte, capuche levée, Ailes de la liberté au dos.
  - Défauts : traits de pluie tous parallèles et réguliers ; sol sec (ni flaques ni reflets) ; bâtiment translucide à droite
    zébré de hachures ; soldats petits dans le cadre.
