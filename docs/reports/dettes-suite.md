# Dettes corrigées après la dette n° 72 (mandat autonome, 2026-10-11)

Rapport court des corrections de dettes qui touchent une capture ; sorties réelles dans les journaux cités.
Les corrections de la 3D (n° 74, 75, 55) sont décrites dans `CONFORMITE-3D.md`, la dette n° 72 dans `dette-72.md`.

## Dette n° 13 : calques Nourriture, Gaz et Titans
- Toute province a une teinte de la légende : « hors du territoire tenu » (pierre) pour Nourriture et Gaz, « inconnu »
  pour Titans ; seuils ronds (1, 2, 2,5 ou 5 × 10ⁿ) ; la formule de calcul reste, comme « pourquoi » du calque.
- `npm run verify` (`dette13-verify.log`) : « Test Files  121 passed (121) », « Tests  774 passed (774) », `EXIT=0`.
- `smoke:map` (`dette13-smoke-map.log`) : « OK  calque Nourriture : légende à 5 échelons et « hors du territoire tenu »
  (AC1-13) », « smoke:map : OK », `EXIT=0`.
- **`p1-calque-nourriture.png`** (1366×623) : carte de 850, dossier de Trost à gauche, calque Nourriture actif. Rose et
  Sina en ocre clair, Trost et Karanes plus soutenus ; l'anneau de Maria en gris pierre. Légende 0 / 625 / 1 250 / 1 875 /
  2 500 puis « hors du territoire tenu ».
  - Défauts : intérieur de Sina presque de la teinte « 0 » (faible production, peu lisible) ; gris « hors du territoire »
    proche du voile de brouillard ; seconde notification coupée en haut à droite ; « Mitras » chevauché par les pions.

## Dette n° 14 : calque politique sous le brouillard
- Le voile du brouillard passait au-dessus de l'aplat du calque : la brique « aux Titans » de Maria pâlissait en rose,
  plus proche du gris « perdue » (ΔE 10) que de sa propre case (ΔE 23). Sous un calque, le voile est réduit à 35 % ;
  l'aplat passe de 64 à 58 % (relief plus lisible) ; le gris « inconnu » couvre à 72 % (le vert des champs ne se lit plus
  comme une valeur).
- `npm run verify` (`dette14-verify.log`) : « Tests  775 passed (775) », `EXIT=0` ; `captures:map -- --rapide` : « Aucune erreur
  console. », `EXIT=0` (`dette14-captures-map.log`).
- `tests/ui/overlays.test.ts` (ΔE en Lab) : voile entier, la brique voilée tire vers « perdue » (état d'avant, vérifié) ;
  voile réduit, elle reste à moins de 10 de sa case et à plus du double de « perdue ».
- **`map-1366-calque-politique.png`** : île entière ; Sina et Rose en vert « tenue », l'anneau de Maria et l'outre-murs
  en brique « aux Titans », le relief (forêts, champs) visible sous l'aplat. Légende tenue / aux Titans / perdue.
  - Défauts : Maria et l'outre-murs ont désormais la même teinte (le brouillard ne se lit presque plus sous un calque) ;
    brique de la carte plus orangée que la case de la légende (mélange avec le papier) ; « Mitras » et « Trost » chevauchés
    par les pions ; bouton « Religion » en surbrillance (survol de la souris laissé par la capture).
- **`map-1366-calque-titans.png`** : Rose et Sina en papier (0 Titan observé), Maria et l'outre-murs en gris « inconnu ».
  - Défauts : gris encore teinté de vert sur les forêts ; aucune province entre 0,25 et 1 en 850 (échelle peu utile à cette
    date) ; texte d'aide long (cinq lignes) au-dessus de la légende.

## Dette n° 62 : officiers de Paradis, Brigade Militaire, Alliés et Hizuru en bataille (D-171)
- Officier en tête de chaque section de Paradis : uniforme et emblème de ses hommes, sans fusil, pistolet au tir ; Brigade
  Militaire pour les rencontres dans Sina (région de la province transmise à la vue) ; Alliés et Hizuru recolorés (sable,
  bleu nuit, `?`), sans brassard. Le cache des matériaux de tenue est indexé par la tenue entière (les variantes gardent
  l'identifiant de leur tenue de base : sans cela, Hizuru sortait aux couleurs de Marley sur la première planche).
- `npm run verify` (`dette62-verify.log`) : « Test Files  121 passed (121) », « Tests  777 passed (777) », `EXIT=0`.
- `R3_PLANCHES=r3-fantassins R3_BATAILLE=0 npm run smoke:r3 -- --captures` (`dette62-planche.log`) : « OK  r3-fantassins :
  planche prête en 31.7 s, 8 étiquettes », `EXIT=0`. `R3_PLANCHES=0 npm run smoke:r3 -- --captures`
  (`dette62-smoke-r3.log`) : « OK  fantassins de la Garnison en tenue : 21 », « 0 écart », « smoke:r3 : tout est
  conforme. », `EXIT=0`.
- **`r3-fantassins.png`** : huit fantassins de face : officier de la Garnison au tir (bras tendu), officier et fantassin de
  la Brigade Militaire (licorne, fusil au pied), infanterie de Marley (olive, brassard), fantassin et officier alliés
  (sable, sans bandeau), garde et officier d'Hizuru (bleu nuit).
  - Défauts : pistolet à peine visible à cette distance ; mains de l'officier de la Brigade aux hanches plutôt que dans le
    dos ; manteau des officiers alliés et d'Hizuru à pan ouvert identique à Marley ; licorne minuscule sur la poitrine.
- **`r3-bataille-paradis-1366.png`** : ligne de la Garnison vue de dos sur une place pavée, roses au dos, fusils au pied.
  - Défauts : l'officier ne se distingue pas de dos (même uniforme, voulu) ; bras repliés devant la poitrine au repos ;
    bandeau « Pause » sur les façades ; repère « S1 » flottant au-dessus de la place.

## Dette n° 65 : recul, rechargement, commandement
- Recul : la pose « tir » compte depuis le départ du coup (`shot` de la simulation, lu seulement) ; pendant 0,15 s,
  l'épaule recule et le canon se relève. État montré « recharge » (A) : fantassin à l'arrêt en ligne, qui a tiré, dont le
  coup suivant est à plus de 0,6 s ; arme en travers du corps, main droite à la culasse. L'officier de section joue
  « commandement » (bras droit levé, main gauche dans le dos) quand ses hommes rechargent. Cheval : hors périmètre.
- `npm run verify` (`dette65-verify.log`) : « Tests  778 passed (778) », `EXIT=0`. Sorties des tests (verbose) :
  « compagnie : 1200 pas, 220800 états vérifiés ; … fantassin:recharge 1042, fantassin:tir 926 … » ; « soldats, écart
  maximal au sol (m) : … tir 0.0065, recharge 0.0044, commandement 0.0023, salut 0.0016 ».
- `smoke:r3` (bataille, `dette65-smoke-r3.log`) : « pose = état de la simulation pour chacune (0 écart) » à chaque vue,
  « 0 erreur console », « tout est conforme. », `EXIT=0` ; planche (`dette65-planche.log`) : « OK  r3-poses ».
- **`r3-poses.png`** : huit soldats devant cinq Titans ramenés à 2,4 m ; « recharge » : soldat de la Garnison de trois
  quarts, fusil en travers, tête baissée vers la culasse ; « commandement » : officier de Marley, bras droit tendu vers
  l'avant, main ouverte.
  - Défauts : rangée de soldats qui chevauche les Titans du fond ; fusil de « recharge » presque vertical ; vapeur blanche
    du Titan abattu derrière l'officier ; Titan « chute » caché par les figures.
- **`r3-bataille-3840.png`** : ligne de la Garnison de dos sur la place, à 00:00 en pause.
  - Défauts : capture prise en pause à l'ouverture, aucune recharge ni recul visible (contrôlés par les tests et la
    planche) ; repère « S1 » flottant ; bras repliés à hauteur des épaules au repos, vus de dos.

## Dette n° 72 (suite) : semelles, talons et bouts des bottes
- Semelle débordante de 12 mm (l'avant suit l'os de la plante, l'arrière celui du pied), talon et bout de botte arrondi
  qui couvre les orteils du corps de base ; cuir foncé (forme A). Pour tous les soldats.
- `npm run verify` (`dette72s-verify.log`) : « Tests  779 passed (779) », `EXIT=0` ; test « semelles et talons sous les
  bottes, posés au sol au repos, qui suivent le pied en marche » (4 semelles, 2 talons par soldat, sept tenues).
- Planches (`dette72s-planches.log`) : « OK  r3-soldats », « OK  r3-poses », « OK  r3-uniformes », « OK  r3-fantassins »,
  `EXIT=0`.
- **`r3-uniformes.png`** (recadré sur les pieds) : hautes bottes brunes à semelle sombre débordante, talon visible de dos,
  bout arrondi de face ; plus d'orteils lisibles.
  - Défauts : bout de botte un peu gonflé (forme de sabot) ; semelle plate sans cambrure ; jointure nette entre la
    semelle avant et la semelle arrière quand le pied plie ; quelques points de peau qui percent encore sur un pied.

## Dette n° 72 (suite) : équipement anti-personnel de 854
- Tenue de 854 : deux canons courts accolés sur chaque poignée de l'équipement de manœuvre, toujours portés (présence C,
  forme `?`, Q18) ; les lames restent pour la coupe que joue la simulation (A). Planche `r3-uniformes` : la dernière
  colonne montre la tenue de 854 avec lances de foudre et canons.
- `npm run verify` (`dette72ap-verify.log`) : « Tests  780 passed (780) », `canon:check` conforme, `EXIT=0` ; planche
  (`dette72ap-planche.log`) : « OK  r3-uniformes », `EXIT=0`.
- **`r3-uniformes.png`** (colonne 854, recadrée) : deux soldats en tenue sombre, Ailes de la liberté aux manches et à la
  poitrine, lances le long des avant-bras, petits canons noirs aux poignées.
  - Défauts : canons très petits à cette distance ; pointes des lances qui pendent sous les mains ; lames peu lisibles
    sur le fond clair ; bouteilles de gaz qui dépassent des hanches.

## Dette n° 72 (suite) : remise des médailles par la reine Historia
- Planche `r3-medailles` : salle d'audience du palais (sol de pierre, tapis, colonnes, trône sur une estrade, bannières
  sans armoiries, chandeliers), survivants du Corps au salut de part et d'autre du tapis, médaille à ruban sur la poitrine,
  la reine (blonde, petite : C ; taille, robe, cape : `?`) devant l'un d'eux, deux gardes de la Brigade Militaire. Dans le
  jeu : bouton « Voir la cérémonie (3D) » dans le dossier de E43, seulement si Historia a été couronnée (drapeau de E36).
- `npm run verify` (`dette72m-verify.log`) : « Test Files  122 passed (122) », « Tests  782 passed (782) », `EXIT=0` ;
  planche (`dette72m-planche.log`) : « OK  r3-medailles : planche prête en 59.7 s » (premier essai), `EXIT=0`.
- **`r3-medailles.png`** : vue dans l'axe du tapis rouge vers le trône doré ; cinq soldats à gauche, quatre à droite, de
  profil, poing sur le cœur ; la reine en robe ivoire et cape bleue au milieu ; deux grandes bannières rouges.
  - Défauts : cheveux de la reine en calotte courte (lecture presque chauve) ; garde de gauche caché par les soldats ;
    médailles invisibles à cette distance ; murs unis sans fenêtres ni moulures ; trône en blocs.

## Dette n° 63 (en partie) : visages des Titans
- Tous les Titans de R3 : bouche étirée en large sourire, lèvres retroussées sur les dents, quelle que soit l'expression
  (cibles de bouche poussées au-delà du visage humain ; intensités `visage_titans`, A). Coque de cheveux deux fois plus
  mince. Reste : visage sculpté propre aux Titans (T1, V2), lisière des cheveux, pli du cou du 15 m « massif ».
- `npm run verify` (`dette63-verify.log`) : « Tests  782 passed (782) », `EXIT=0` ; planches (`dette63-planches.log`) :
  « OK  r3-titans : 15 corps à l'échelle, hauteurs mesurées à 0.32 % au plus (±5 %) », « OK  r3-visages », `EXIT=0`.
- **`r3-visages.png`** : six Titans de près ; tous sourient d'une oreille à l'autre, rangée de dents visible chez le 5 m
  et le 12 m, bouche béante rouge chez le 3 m.
  - Défauts : plis étirés aux coins de la bouche ; cheveux encore en calotte avec une lisière claire ; étiquettes sur
    les torses ; corps lisses, presque humains (T1 reporté).

## Dette n° 50 (en partie) : étiquettes d'escouade derrière les bâtiments
- Une escouade cachée par un bâtiment, vue de la caméra (même test de rayon que la trame translucide de la dette n° 75),
  a son étiquette estompée, bord en tirets : l'information tactique reste, la profondeur se lit. Reste de la dette :
  collision réelle de la caméra de suivi.
- `npm run verify` (`dette50-verify.log`) : « Tests  782 passed (782) », `EXIT=0` ; `smoke:r2 -- --captures`
  (`dette50-smoke-r2.log`) : « smoke:r2 : tout est conforme. », « 0 erreur console », `EXIT=0`.
- **`r2-strategique-1920.png`** : la ville de haut ; numéros 2, 3, 4, 5, 7, 11, 13, 15, 17, 19, 20 estompés (escouades
  derrière une maison), 6, 8, 9, 10, 12, 14, 16, 18 pleins ; deux « E » estompés au nord.
  - Défauts : numéros encore serrés en rang ; étiquettes « T » des Titans toujours pleines (voulu : lisibles même cachés) ;
    près d'un tiers de l'image en sol vide ; mur d'enceinte coupé en haut.

## Dette n° 70 (en partie) : fusées de signal en 3D
- La simulation lançait déjà les fusées du code du Corps (03 §7, C : rouge = Titan repéré, noire = anormal, verte =
  changement de direction ou repli) et la 2D les dessinait ; la 3D ne les montrait pas. Désormais : traînée de fumée
  colorée qui monte à environ 42 m en 1,6 s, dérive et s'efface en 10 s (hauteurs, durées, teintes : A) ; traînée
  entière et immobile en mouvements réduits. Reste : code de la Garnison (missions).
- `npm run verify` (`fusees3d-verify.log`) : « Test Files  123 passed (123) », « Tests  785 passed (785) », `EXIT=0` ;
  `smoke:r2 -- --captures` (`fusees3d-smoke-r2.log`) : « smoke:r2 : tout est conforme. », `EXIT=0`.
- **`r2-strategique-1920.png`** (00:06) : deux colonnes de fumée rouge au sud-ouest, tirées par une escouade qui a repéré
  un Titan ; la plus ancienne plus large et plus haute.
  - Défauts : vue d'en haut, la colonne verticale se lit en oblique ; bouffées à bord net (sphères, pas de texture de
    fumée) ; pas d'ombre au sol ; la fusée vient de l'escouade, loin de l'étiquette « S1 » des fantassins.

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
