# 00 — Index de la documentation V4 (Godot)

> Point d'entrée. Mis à jour le 2026-10-17 (ajout du dossier d'univers, D-193). Rédigé par la direction (Claude) à la demande de Gabriel : refonte intégrale du jeu, moteur Godot, modèles 3D détaillés, bataille « commandant + combattant » avec ordres à la voix.

## 1. Ordre de lecture

| # | Document | Pour qui / pourquoi | Statut | Relu par |
|---|---|---|---|---|
| 1 | `01_CAHIER_DES_CHARGES.md` | **Gabriel** : ce que le jeu sera (3 niveaux de jeu, exigences, possibilités nouvelles classées Must/Should/Could/Won't) | PROPOSÉ | R-D1 |
| 2 | `04_REGISTRE_DES_DECISIONS.md` | **Gabriel** : toutes les décisions, FIGÉES / PROPOSÉES / PAR SPIKE ; modèle de demande de changement | PROPOSÉ | R-D1 |
| 3 | `03_PLAN_DE_PRODUCTION.md` | tout le monde : jalons M0 à M11, critères vérifiables, réutilisation de l'ancien dépôt, modes de portage | PROPOSÉ | fin de M0 |
| 4 | `02_ARCHITECTURE.md` | développement : couches, déterminisme, commandes, réseau, niveaux de détail, chaîne de modèles | PROPOSÉ | fin de M0 |
| 5 | `05_SPIKES_RISQUES.md` | développement et Gabriel : 7 expériences chronométrées (S0 à S6) avec seuils et replis | PROPOSÉ | R-M0 |
| 6 | `06_COMMANDE_VOCALE.md` | voix : contrat, chaîne, grammaire de 60 énoncés, protocole d'essai | PROPOSÉ (faisabilité par S3) | S3 |
| 7 | `07_REFERENCES_VISUELLES.md` | art : méthode de la bible d'images **écrite**, fiche modèle, catalogue des sujets | PROPOSÉ | première séance de référence |
| 8 | `08_MODELE_CLAUDE_MD.md` | sessions : modèle du `CLAUDE.md` du nouveau dépôt | PROPOSÉ | fin de S0 |
| 9 | `univers/U00_LISEZ_MOI.md` | **dossier d'univers** (15 fichiers `U00`–`U15`, sans `U13`) : lore détaillé et sourcé, sources **non officielles**, contradictions et lacunes consignées ; `U14` = implications pour le jeu (`A`) | SOURCES NON OFFICIELLES (D-193) | `U14` §8 par Gabriel |

Gabriel n'a **que deux documents à relire** pour la première revue (R-D1) : `01` et `04`. Le reste est de la mise en œuvre. Le dossier d'univers (`univers/`) ne se relit pas en entier : `U14` §8 pose sept questions, chacune avec un défaut, et `U15` §6 liste ce qu'il vaut la peine de vérifier dans l'œuvre.

## 2. Règle anti-retour (résumé)

Une décision FIGÉE ne se rouvre pas pendant un jalon ; tout risque ouvert passe par un spike avec seuil ; une seule revue humaine large (R-D1) ; ensuite, revue par jalon. Détail : `04` §0.

## 3. Conventions communes

| Convention | Valeur |
|---|---|
| Étiquettes | `[C]` canon · `[A]` choix de la direction · `[?]` inconnu à lever par une mesure |
| Statuts de décision | FIGÉ · PROPOSÉ · PAR SPIKE |
| Identifiants | décisions `V4-Dnn` · jalons `Mn` · spikes `Sn` · possibilités nouvelles `Nnn` · fiches visuelles `Vcc-nn` · revues `R-…` |
| Estimations | tailles S/M/L/XL **non mesurées**, recalibrées à la fin de M1 |
| Langue | documents et textes joueur en français ; identifiants de code en anglais |
| Provenance | aucune image, capture, texture ou modèle de l'œuvre ou de fans dans le dépôt ; références visuelles = descriptions écrites (`07`) |
| Preuves | rien n'est déclaré réussi sans la **sortie réelle** de la commande, collée dans le rapport du jalon |

## 4. Ce qui est décidé par Gabriel (rappel)

Refonte intégrale du code · Godot · machine minimale RTX 3050 avec qualité réglable · style réaliste sombre début XXᵉ siècle · bataille commandant + combattant avec ordres à la voix · tâche automatique de nuit **mise en pause** · structure en jalons sans retours en arrière. Détail et références : `04` §1.

## 5. Ce que Gabriel doit faire (liste courte)

1. **R-D1** : relire `01` et `04`, corriger en une passe (les 5 questions, chacune avec un défaut, sont en `04` §5).
2. Décider du **dépôt** : créer un dépôt privé `Murs-et-Sang-V4`, ou laisser tout dans `docs/v4/` de l'ancien en attendant (défaut : ancien dépôt).
3. Donner le **nom exact et la mémoire vidéo** de sa carte graphique (pour S2).
4. Le moment venu : lancer de petits exécutables de test sur son PC (S0, S1), puis des séances d'essai (S2, S3, S5, S6).
5. Louer un PC Windows avec GPU **seulement quand il faudra juger de l'image** (à partir de M7, ou S2 si le PC de Gabriel ne suffit pas) : aucune location n'est nécessaire pour M0 à M6, qui se développent dans le nuage sans GPU.
6. Séances de référence visuelle (`07` §8), au rythme qu'il veut.

## 6. Prochaine action exacte

Gabriel fait R-D1 (`01`, `04`). La direction applique ses corrections puis lance **M0** (spikes S0, S1, S4 dans le nuage ; S2, S3, S5, S6 quand il peut tester sur son PC).

## 7. Relations avec l'ancien dépôt

L'ancien dépôt (`docs/spec/`, `data/`, `docs/art/assets/projet/`, `src/` en TypeScript) reste la **référence** et n'est pas modifié par la V4, sauf pour produire les **traces d'or** (`02` §9). Les sessions automatiques de l'ancien dépôt sont en pause ; l'historique de leurs décisions est dans `docs/DECISIONS.md` (D-192 pour la V4).
