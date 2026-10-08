# 15 — CORRECTIONS : ÉCARTS ENTRE L'EXISTANT ET LES SPÉCIFICATIONS

> **Statut : première version, incomplète.** Elle repose uniquement sur : le rapport P0 (collé dans la conversation), le message d'arrêt de P2, le rapport P4 (`P4.md`) et trois captures d'écran de la bataille. **La session n'a pas pu être lue** (le lien renvoie une page vide). Les écarts marqués **`À VÉRIFIER`** n'ont ni preuve ni démenti dans ces documents : ils doivent être confirmés par l'audit de conformité du §5.
> Références : fichiers 00 à 14 (le 11 prime pour le lore). Les corrections ne doivent **jamais** casser un critère déjà validé : non-régression obligatoire (`verify`, `smoke:*`, `sim:*`).

## 1. ÉCARTS CONFIRMÉS (rapport P4 et captures)

| ID | Spécification | Attendu | Constaté | Correction demandée | Priorité |
|---|---|---|---|---|---|
| C-01 | 04 §6, §2 (lisible à 1366×768) | Interface entièrement visible | La 4ᵉ carte d'escouade est coupée au bord de l'écran (capture) | Défilement horizontal visible ou compression des cartes | **P1** (avant P5) |
| C-02 | 03 §1 pt 6 « lisibilité avant spectacle » ; 04 §4 | Bataille compréhensible d'un coup d'œil | Avec 300 unités : points minuscules, types illisibles sans zoom (capture et rapport P4 (g)) | Repères simplifiés sous un seuil de zoom (pastilles d'escouade, silhouette de Titan agrandie) ; cadrage automatique à l'ouverture | **P1** |
| C-03 | 00 §2 pilier 7 ; 04 §2 | Interface « artisanale », sans chiffre technique | « 5,4 ms/image · 300 unités » affiché au joueur (capture) | Réserver cet affichage au mode debug (F2) | **P1** |
| C-04 | 04 §6 (tooltips) | Info sans masquer l'objet expliqué | L'infobulle « pourquoi ? » recouvre la carte d'escouade qu'elle explique (capture 3) | Positionner l'infobulle hors de l'élément source | P2 |
| C-05 | 04 §2 règle 7 ; 00 §7 « aucune interface ne ressemble à un template » | Composition unique, asymétrie contrôlée | Décor de ville : grille régulière de blocs identiques, colonnes équidistantes (captures) | Plan de ville irrégulier (rues de largeurs variables, îlots tournés, tons de toits variés, ruelles) | P3 (P8) |
| C-06 | 04 §4 « volumes dessinés », « vues obliques » | 2.5D illustré, bâtiments en volumes | Bâtiments « en caisses », arbres « en colonnes », pas d'occlusion (rapport P4 (c), (g)) | Volumes obliques, occlusion décor/unités | P3 (P8) |
| C-07 | 04 §4 effets (vapeur des Titans) | Vapeur, fumée, poussière | Un Titan abattu est une ellipse sans vapeur animée (rapport P4 (g)) | Vapeur animée et dissipation à la mort d'un Titan | P3 (P8) |
| C-08 | 03 §6 | 9 types d'ordres : avancer, tenir, repli, diversion, tuer cible, escorter, évacuer, couvrir, incendier | 4 ordres par escouade (rapport P4 (c)) | Ajouter les ordres manquants, ou consigner dans `DECISIONS.md` ceux reportés avec leur phase | P2 |
| C-09 | 03 §13 | Ciblage fin, point de ralliement | Ordres par escouade seulement, pas de ciblage cliqué (rapport P4 (c)) | Ordre « tuer cible » et point de ralliement au clic | P2 |
| C-10 | 03 §13 ; F-CMB-32 | Ralenti sur coupe réussie ; plan rapproché | Ni ralenti automatique, ni plan rapproché (rapport P4 (c)) | Ralenti court déclenché par une coupe de nuque réussie (désactivable) | P3 (P8) |
| C-11 | 03 §13, 04 §7 | Sons (gaz, lames, pas) | Reporté (rapport P4) | Prévu en P8 : garder au plan | P3 (P8) |

## 2. RÉALISME ET ÉQUILIBRAGE (décisions à te soumettre)

| ID | Point | Pourquoi |
|---|---|---|
| C-12 | **Victoires à 91–100 %** dans les 6 engagements types (rapport P4) | 03 §1 pt 4 : « un soldat touché par un Titan est presque toujours mort ». À toi de juger si 0,5 à 2,2 morts pour 12 hommes est assez dur |
| C-13 | **Cohérence ±15 % avec l'auto-résolution** (+3,8 % max) | Si l'auto-résolution a été calibrée sur les batailles jouées, la preuve est partiellement circulaire. L'IA doit déclarer si c'est le cas (`DECISIONS.md`) et ajouter un contrôle de réalisme indépendant (par exemple la mortalité d'expédition 25–40 % de 02 §15, déjà tenue à 30,3 %) |
| C-14 | Anormaux exclus du contrôle de cohérence | Assumé par AC4-08 ; à rattraper quand l'auto-résolution les gérera |

## 3. QUOTAS DE CONTENU : SPÉCIFIÉ OU ATTENDU / ACTUEL (d'après `data:validate` du rapport P4)

| Contenu | Attendu (05 §3, 06, 13…) | Actuel | Commentaire |
|---|---|---|---|
| Provinces de Paradis | 74 | 74 | OK |
| Provinces du monde (Marley, Hizuru, Alliés) | 60 | 0 | Prévu en P7 |
| Personnages nommés | ≥ 80 | 52 | Écart à combler (P5/P7) |
| Technologies | ≈ 70 (13) ; ≥ 60 en P5 (05) | 5 | Prévu en P5 |
| Événements canon | 60 (12) | 35 | À compléter selon les phases |
| Événements génériques | 150 | non listés | `À VÉRIFIER` |
| Bâtiments | ≥ 25 (05) ; 60 (10) | 11 | **Incohérence des spécifications** : 05 et 10 donnent deux cibles ; retenir 25 au minimum, 60 comme objectif |
| Cartes tactiques | ≥ 12 (05) ; 40 (06) | 4 | Prévu : 4 en P4 ; la suite en P6/P7 |
| Titans purs | 8 (05) ; 10 + Titans-Murs/Reiss (10) | 8 | OK pour P4 ; scénarios spéciaux plus tard |
| Traits, lois, portraits, icônes | 40 / 40 / 80 / 150 | non listés | `À VÉRIFIER` |
| Langue anglaise | FR + EN | amorce | Assumé (14, P0) |

## 4. NON VÉRIFIÉ (À CONFIRMER PAR L'AUDIT DU §5)

| ID | Point | Référence |
|---|---|---|
| C-15 | Carte stratégique : rendu « atlas gravé » conforme (hachures, aquarelle, murs en coupe) | 04 §3 |
| C-16 | Interfaces « objets » (dossiers, carnets, tableaux) plutôt que panneaux (le rapport parle de « registres ») | 04 §5, §2 |
| C-17 | Icônes au-dessus des têtes (gaz, lames, stress) en pictogrammes | 04 §4 |
| C-18 | Éclairage aube / jour / crépuscule / nuit à l'écran | 04 §4 |
| C-19 | Titans animés par déformation de sprites ; anatomie « dérangeante » | 04 §4 |
| C-20 | Civils à évacuer, incendies, effondrements ; pièges ; canons de mur | 03 §2, F-CMB-11, 12, 17, 10 |
| C-21 | Portraits « gravure/encre » : originaux, sans asset de l'œuvre | 04 §8 |
| C-22 | Tableau d'enquête (fils, épingles), gazette, tampons | 04 §5 |
| C-23 | Checklist 04 §2 appliquée à **chaque** écran (polices, icônes retouchées, pas de « card + shadow + rounded ») | 04 §2 |
| C-24 | 60 FPS et 4K : **non mesurables** dans le conteneur (Chromium sans GPU) | 00 §8, 04 §9 |
| C-25 | Hook Stop : l'IA ne l'a pas vu se déclencher (P0) | 14 §1 |
| C-26 | « Sourire figé » donné aux silhouettes de Titans : détail de design `A`, à ne pas présenter comme canon | 01, 11 |
| C-27 | Ville-usine rattachée à Paradis (D-41) : décision de design `A`, localisation `?` | 11 §2 |

## 5. PROMPT À COLLER DANS LA SESSION : AUDIT DE CONFORMITÉ

```
Avant de continuer, fais un AUDIT DE CONFORMITÉ de ce qui est construit par rapport aux
spécifications docs/spec/00…15. Écris docs/CONFORMITE.md avec, pour chaque section normative
(03 §1–§14, 04 §2–§9, 05 §3 et §5, 09 par fonction F-xxx de priorité P1 et P2) :
 - l'attente (citée par fichier et section),
 - le statut : FAIT / PARTIEL / ABSENT / NON VÉRIFIABLE ICI,
 - la preuve (test, commande, capture) ou la raison de l'absence.
Reprends les lignes C-01 à C-27 du fichier 15 : confirme ou infirme chacune avec preuve, et ajoute
les écarts que tu trouves toi-même. N'invente aucun statut : si tu n'as pas de preuve, écris
NON VÉRIFIÉ. Termine par la liste des écarts classés P1 / P2 / P3 avec un critère vérifiable par
correction. Ne modifie aucun code dans cette étape ; commit docs seul.
```

Puis, une fois `docs/CONFORMITE.md` relu par toi :

```
Traite les corrections P1 puis P2 de docs/CONFORMITE.md, un commit par correction, `npm run verify`
et les smoke concernés avant chaque commit, sans régression des critères existants. Les corrections P3
(visuelles) sont groupées avec la phase 8. Mets à jour docs/PROGRESS.md.
```

## 6. DÉCISIONS QUI T'APPARTIENNENT

1. **C-12** : le combat est-il assez dur ? (à juger en y jouant.)
2. **C-05 à C-07** : corriger la direction artistique du combat maintenant ou à la phase 8 ? (Recommandation : phase 8, sauf si la grille rigide te gêne déjà.)
3. **C-24** : tu n'as pas de poste pour mesurer les 60 FPS : accepter « non vérifié », ou prévoir un essai sur un ordinateur avant la phase 8.
4. **Bâtiments** : 25 ou 60 comme minimum de contenu ?

## 7. LIMITES DE CE FICHIER

- Il ne couvre pas les phases P1, P2 et P3 en détail : je n'ai vu que des sorties de tests et un message d'arrêt, pas les rapports complets ni les captures.
- Les lignes `À VÉRIFIER` peuvent être déjà conformes ; ne rien « corriger » avant l'audit du §5.
- Je n'ai pas relancé de commande moi-même : tout provient des sorties collées par l'IA.
