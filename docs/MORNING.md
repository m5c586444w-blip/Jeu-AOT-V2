# Matin (direction autonome, mis à jour après chaque phase)

**Établi (sorties réelles)**
- **P9 terminée** (arrêt de revue tenu par une revue indépendante, D-106) : fins de partie (objectifs, défaites, terme ; épilogue), difficultés Récit à Brèche, scénario du Grondement, invasion amphibie de l'IA de Marley, événements E43–E52 jouables, 845 jouable ; `sim:balance` sur 1 000 parties par scénario : 845 64,3 % de victoires, 850 53,8 %, 854 57,1 %, Grondement 31,5 %, Marley joué 0 % (dette n° 66) ; mortalité d'expédition 26,5 % ; tous les critères OK (`docs/reports/P9.md`, `P9-balance.html`).
- **P10 en cours** : accessibilité (daltoniens, mouvements réduits, aide à la lecture), difficulté personnalisée, manuel en jeu (F1), `npm run jouer` (jeu en local hors réseau), parcours de 5 ans vérifié par sauvegardes, audit `docs/CONFORMITE.md` (P1 de 09 toutes faites ; reports des P2 dans D-161).
- **R3 terminée** (mandat autonome de trois jours, D-148) : 30 Titans de 3 à 15 m (3 corps × 2 peaux par taille, silhouettes distinctes ≤ 0,80, démarches irrégulières), 5 tenues (exploration, Garnison, Police militaire, infanterie et officiers de Marley), poses marche, course, chute, mort, attaque lues de la simulation à chaque pas ; en bataille 3D, corps détaillés au second temps (≈ 4,7 s au rendu logiciel). Planches : `docs/screenshots/r3-*.png`.
- **N1 et N2 terminés** : MAP, UI, AUD, CHR, PA, MIS, TUT, R2+ fusionnées ; dernier verify code 0, 705/705, 8 empreintes inchangées (`docs/reports/R2-verify-fusion.log`).
- R2+ : bataille de compagnies en temps réel (jusqu'à 400 unités) : sélection, groupes, ordres, formations, tir d'artillerie sur zone, pause avec file d'ordres, caméra du dessus ou de suivi (V), porteurs commandés par ordres généraux ; les rencontres d'armées se jouent puis sont reportées dans la campagne ; repli 2D sans WebGL 2. Les hommes ne traversent plus les maisons ni ne tirent à travers.
- TUT : guide de 14 étapes (menu principal, ou Options > Rejouer), en 850. MIS : arbre de missions (touche Z).

**En dette** : n° 13–15, 21, 22–27, 28–32, 34–40, 41–45 (TUT), 46–60 (R2+ : expéditions encore en 2D, équilibre de l'infanterie, Titans qui traversent encore les maisons, textes anglais).

**À valider par Gabriel** : **mesurer R2+ et R3 sur ton PC (RTX 3050)** (dettes n° 49, 64) ; regarder les planches `r3-*` : rendu logiciel seulement ici (« prêt » 4,5 à 12,8 s contre 3 s visés) ; écouter la musique ; D-114 ; D-122/D-124/D-132 (hash) ; D-130 (deux sessions de code) ; D-147 (CLAUDE.md : `src/sim` hors `map.ts` en R2+).

**Prochaine action** : fin de P10 (latences, audit canon, smokes, rapport), puis PACK (application Windows : `npm run package:win`, préparée) sur `claude/intelligent-feynman-8ekib4`.

**Quota** : non mesuré (aucun % fourni) ; ≈ 1 550 tours depuis le 2026-10-08 matin (tableaux de DECISIONS).
