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
