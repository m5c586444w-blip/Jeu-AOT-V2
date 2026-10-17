# Matin (direction autonome, mis à jour après chaque phase)

## 2026-10-17 (après-midi) — Organisation du travail V4 (D-194) — à lire en premier
- Fait sur ta demande : `docs/v4/organisation/` (point d'entrée `00_LISEZ_MOI.md`) : protocole de session, **tableau de 195 tâches** (contrôlé par script), pipeline des assets 3D, politique de provenance, définition de « fini » et revues, prompts de session, modèles, liste de tes actions. Le dossier d'univers ne sert pas à s'organiser : c'est une référence de lore.
- **À décider par toi (par ordre d'importance)** : (1) **provenance** A / B / C (`organisation/04` §4 ; je recommande B ; défaut provisoire A pour ce qui entre dans le dépôt) ; (2) **dérogation** pour démarrer le lot P et les spikes S0, S1, S4 avant la revue R-D1 ; (3) R-D1 elle-même (`docs/v4/01`, `04`). Détail et défauts : `organisation/08`.
- **À me donner pour la carte Minecraft** : le fichier du monde, son format (Java ou Bedrock, version), son origine et l'accord de son auteur, le pack de ressources éventuel. **Jamais à partir de la photo.** Essai fait sur une scène synthétique seulement ; rien sur ta carte.
- **Correction de mon fait précédent** : V4-D11 (provenance) était écrite FIGÉ par erreur ; elle est maintenant EN ATTENTE. Le prompt `docs/spec/20_…` §0 la présente comme une décision de l'utilisateur ; je ne retrouve pas ton message. Ta réponse prime.
- `npm run typecheck` échoue dans `src/net/wsTransport.ts` (module `ws` absent des dépendances installées) : constaté, sans rapport avec ces documents, non corrigé.

## 2026-10-17 — Dossier d'univers V4 (D-193) — à lire en premier
- Fait sur ta demande : un dossier de **15 fichiers** sur l'univers dans `docs/v4/univers/` (point d'entrée `U00_LISEZ_MOI.md`). Chaque affirmation porte sa source et une étiquette (`[C]` rapporté, `[I]` interprété, `[?]` non confirmé).
- **Limite principale** : toutes les sources sont des pages de wiki communautaire et de Wikipédia (**non officielles**), lues via des extraits condensés ; le manga et les livres officiels n'ont pas été lus. `[C]` ne veut donc pas dire « canon du projet » (`U00` §1, `U14` R-1).
- **À décider par toi** : `U14` §8 (7 questions, chacune avec un défaut) : genre de Hange laissé ouvert par l'auteur, seuil de l'« époque charnière » (défaut 854), scénario 857 (défaut non), application en une passe des corrections K-01 à K-18.
- **À vérifier dans l'œuvre si tu veux verrouiller des faits** : les 12 points de `U15` §6 (années des héritages 843/844, début de la guerre du Moyen-Orient 850/851, bilan de 846…). 74 contradictions entre sources sont consignées en `U15` §3.
- Rien dans `src/`, `data/` ni `docs/spec/` n'a été modifié.

## 2026-10-16 (soir) — Refonte V4 sous Godot (D-192) — à lire en premier
- Gabriel a décidé de **reconstruire le jeu de zéro sous Godot** (C#, RTX 3050 minimale, réaliste sombre début XXᵉ, bataille commandant + combattant avec ordres à la voix). La **tâche automatique A est en pause** ; l'ancien dépôt reste la référence.
- Documentation complète : `docs/v4/00_INDEX.md` (9 fichiers). **À faire par Gabriel** : relire `docs/v4/01_CAHIER_DES_CHARGES.md` et `docs/v4/04_REGISTRE_DES_DECISIONS.md` (revue R-D1, 5 questions avec défauts), puis dire si le nouveau dépôt privé `Murs-et-Sang-V4` est créé.
- Aucun code modifié ; `verify` non relancé (documents seulement, dernier verify : 1678 tests, EXIT=0).

## 2026-10-16 — Nuit de la session A (à lire en premier)
- B n'a jamais travaillé le 15 (aucun journal B) : A a pris sa voie. Fait, commité, poussé : **C10** (outillage Blender `bpy`, `npm run assets:blender` et `assets:blender:check`, 24 modèles .glb : 5 accessoires, 7 tenues LOD0/LOD1, 5 décalques d'emblème, planche `?proto3d=tenues`) ; **C15** (mur Rose : Trost, Karanes, Utopia, Krolva, camp d'entraînement, QG de la Garnison) ; **C16** (mur Sina : Stohess, Orvud, Ehrmich, Yarckel, Mitras, ville souterraine, chapelle Reiss) ; **C17** (Jinae, Ragako, Dauper, château d'Utgard, forêt des Arbres Géants, ferme, fort du front, couverture du mur Maria) ; **C18 tranche 1** (`npm run places:couverture` : 45 provinces couvertes sur 126, Liberio fait). Revues indépendantes par tranche : ACCEPTÉ AVEC RÉSERVES, correctifs appliqués.
- Dernier verify : 173 fichiers, **1678 tests**, EXIT=0. Décisions D-182 à D-191.
- **À valider par toi** : tenues sans skinning (pièces rigides, têtes chauves, écussons de 9 cm) ; populations `A`/`?` pour Ragako, Dauper, Utgard, forêt, Liberio (la simulation n'a pas de population pour les provinces du monde) ; Ehrmich « bourgeois » ; tous les noms de rues/lieux créés sont `A` (`docs/lore/creations.md`, Q14–Q35).
- **Dette principale** : `npm run places:valider` complet est KO (≈ 170 PNG de captures absents pour les lieux C16/C17/C18 ; `npm run places:captures -- <ids>` ≈ 2 h par lieu en rendu logiciel ; `verify` n'en dépend pas). Rien n'a été vu sur ton PC (aucune mesure GPU, à vérifier sur la RTX 3050) ; les captures montrent sol plat, ciel blanc, caméras lointaines.
- **Suite** : A : C18 (81 provinces sans lieu, voir `docs/reports/C18-couverture.md`), captures, C13 (reste), C14.

## 2026-10-15 — Nuit de la session A (à lire en premier)
- Fait, commité, poussé : C2 (emblèmes en données, règle R15), `smoke:bataille` (C9), Marée régionale (C9.7, D-177), **C13 réseau** : lockstep à 9 sièges, bataille à 20 Hz, camps rivaux (Marley, etc.), salon d'attente et votes (logique pure). Revue indépendante : acceptée avec réserves, corrigées en partie (dette 104–107).
- Dernier verify : 161 fichiers, **1347 tests**, EXIT=0 (clôture, après les votes). Décisions D-175 à D-181.
- **À valider par toi** : D-179 (un camp rival n'a pas encore ses propres conseils/lois : la politique reste celle de Paradis) ; D-180 (salon : `owner` réparti à tour de rôle entre les sièges d'une même faction) ; D-181 (majorité stricte pour pause/vitesse) ; dette 103 (Marée pas encore activée par défaut ni visible).
- Rien n'a été vu à l'écran pour le réseau (aucune interface encore) ; aucune mesure GPU.
- **Suite** : A : fin de C13 (messages du salon et des votes, interface, barre des joueurs) puis C14 ; B : C10 (Blender).

## 2026-10-14 — Nuit de la session A (à lire en premier)
- Fait, commité, poussé : C0 audit (`docs/reports/C0-audit.md`, bug cadre confirmé : `.bataille` fixed recouvre le HUD → C1 pour B) ; C3 socle multijoueur (sièges, enveloppes de commandes, rejeu) ; les **7 piliers de la spec 26 en modules purs testés** (`src/sim/gas, signal, wall, clock, tide, truth, registry`, données `data/balance/*.json`) ; mur (P1) et registre (P7) **branchés au tick, désactivés par défaut** (`EnableWall`, `EnableRegistry`). Chaque lot a eu une revue indépendante.
- Dernier verify : 149 fichiers, **1259 tests**, EXIT=0 ; les 8 empreintes `sim:selftest` sont **inchangées**.
- Dette 71 à 95 dans `docs/reports/dette.md`. Décisions D-157 à D-166.
- **À valider par toi** : ~~D-157 (owner facultatif)~~ **validé sous condition par Gabriel** (D-168 : `owner` obligatoire en multijoueur à plusieurs sièges par faction, prérequis de C13) ; ~~prénoms « Ilse » et « Frieda »~~ **autorisés par Gabriel** (D-167, dette 94 soldée sur ce point) ; rien n'est visible en jeu tant que les piliers ne sont pas activés/branchés (C9 suite) ; `npm run verify` dure ≈ 20-30 min sur cette machine (pas 11).
- Aucune capture ni mesure GPU cette nuit (code de simulation pur).
- **Suite** : A : C9.3 (clock) puis truth, gas, signal, tide, puis morts → registre ; B : C1 (cadre d'interface).

## 2026-10-13 — Refonte V3 (décisions de Gabriel) — à lire en premier
- Installés : `docs/spec/ERRATA_V3.md`, `26` (mécaniques, validé), `27` (multijoueur, à confirmer), `docs/coord/` (protocole, tableau C0–C14, budget, prompts A et B), outil `npm run coord`.
- **Décidé par Gabriel (soir)** : plan validé avec **tous les lieux jouables** (C15 à C18) ; pas de « Simulation de bataille » ; multijoueur **coopératif** ; deux comptes (A : reset le mardi ; B : jusqu'au vendredi 16).
- **À faire par Gabriel** : créer la tâche planifiée de B sur le compte B (`docs/coord/PROMPT_SESSION_B.md`) ; ajouter les domaines de Perchance au réseau de l'environnement ; surveiller l'usage de B (plafond levé : 100 %).
- **Décidé (2ᵉ message du soir)** : plafond de B à **100 %** ; multijoueur avec **choix du camp**, Titans commandés par leurs joueurs jusqu'à ≈ saison 4, **trahison** possible (27 §4.2 à 4.4). Pause, anti-triche, connexion, PC le plus faible : inchangés (défauts `[A]`).
- **À vérifier** : date de l'époque charnière (« saison 4 », `[?]`) ; limite assumée : à 100 %, une session peut être coupée avant sa clôture.
- **Rappel** : les mesures GPU de R2+ et R3 restent à faire sur ton PC (dettes n° 49 et 61).

**Établi (sorties réelles)**
- **N1 et N2 terminés, R3 fusionnée** (N3) : dernier verify code 0, 719/719, 8 empreintes inchangées (`docs/reports/R3-verify-fusion.log`).
- R3 : Titans de 3 à 15 m à trois variantes (peau, proportions), états lisibles (marche, saisie, dévoration, nuque tranchée, vapeur), soldats du Bataillon, de la Garnison, des Brigades spéciales et de Marley ; branchés sur les deux batailles. Réserve : Titans pas encore dérangeants (dette n° 69, R4).
- R2+ : bataille de compagnies en temps réel (jusqu'à 400 unités) : sélection, groupes, ordres, formations, tir d'artillerie sur zone, pause avec file d'ordres, caméra du dessus ou de suivi (V), porteurs commandés par ordres généraux ; les rencontres d'armées se jouent puis sont reportées dans la campagne ; repli 2D sans WebGL 2. Les hommes ne traversent plus les maisons ni ne tirent à travers.
- TUT : guide de 14 étapes (menu principal, ou Options > Rejouer), en 850. MIS : arbre de missions (touche Z).

**En dette** : n° 13–15, 21, 22–27, 28–32, 34–40, 41–45 (TUT), 46–60 (R2+), 61–70 (R3).

**À valider par Gabriel** : **mesurer R2+ et R3 sur ton PC (RTX 3050)** : rendu logiciel seulement ici (« prêt » 4,5 à 18 s contre 3 s visés) ; écouter la musique ; D-114 ; D-122/D-124/D-132 (hash) ; D-130 (deux sessions de code) ; D-147 (CLAUDE.md : `src/sim` hors `map.ts` en R2+).

**Prochaine action** : N3, phase P9 (scénarios, IA, équilibrage) sur `claude/v2-p9`, puis P10, PACK.

**Quota** : non mesuré (aucun % fourni) ; ≈ 1 750 tours depuis le 2026-10-08 matin (tableaux de DECISIONS).
