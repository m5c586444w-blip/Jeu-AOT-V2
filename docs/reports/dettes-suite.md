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
