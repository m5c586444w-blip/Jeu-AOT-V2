# 04 — Politique de provenance (modèles 3D, images, sons, textes, événements)

> Statut : **EN ATTENTE DE GABRIEL** (2026-10-17). Remplace, pour la V4, le statut « FIGÉ » que `04_REGISTRE_DES_DECISIONS.md` donnait à V4-D11 (voir §1). Tant que Gabriel n'a pas répondu, le défaut du §7 s'applique.
> Étiquettes : `[A]` choix de la direction · « fait » = vérifié dans un fichier du dépôt, avec chemin.

## 1. Pourquoi ce fichier

Gabriel a demandé (2026-10-17) pourquoi le `CLAUDE.md` contient des contraintes qu'il n'aurait « jamais demandées », s'il y en a sur les modèles 3D, les images et les événements, et il fournit désormais un fichier de carte Minecraft de Shiganshina comme base de décor.

Ce que j'ai constaté en remontant l'historique :
- La règle « aucun fichier de l'œuvre ou de fans » figure dès le brief initial et le `CLAUDE.md` du 2026-10-07. Le prompt `docs/spec/20_…` (2026-10-07, §0) la présente comme une limite « non négociable » dans un paragraphe intitulé « Décision de l'utilisateur, définitive » : **je ne retrouve aucun message de Gabriel qui la formule**, et il dit aujourd'hui ne l'avoir jamais demandée. Les deux sont possibles (une phrase de lui relayée et reformulée par une session, ou un ajout de la direction) ; les fichiers ne permettent pas de trancher.
- En V4 je l'ai écrite dans `04` (V4-D11) avec le statut **FIGÉ** sans te la redemander : c'est **mon erreur**. Elle est corrigée ici : V4-D11 passe à « EN ATTENTE (contesté le 2026-10-17) ». Ta réponse, quelle qu'elle soit, prime sur tout ce qui précède.
- Limite de cette recherche : elle porte sur les fichiers du dépôt et son historique `git` (dont l'auteur affiché est « Gabriel » pour tous les commits, ce qui ne prouve pas qui a écrit le texte). Je n'ai pas relu les anciennes conversations.

## 2. Historique, avec les emplacements

| Date | Où | Ce que dit le texte | Qui l'a écrit |
|---|---|---|---|
| (brief initial) | `docs/spec/00_BRIEF_MAITRE.md` §6, règle 6 (ligne 126) | « Pas d'actifs extraits de l'anime, du manga, des jeux officiels ou de fans (images, sons, musiques, polices propriétaires). Tout est recréé » | brief de départ |
| 2026-10-07 | `CLAUDE.md` à la révision `fb12c21`, lignes 13 et 41 | « Interdit, quelle que soit la licence : tout modèle ou texture tiré de L'Attaque des Titans ou d'un fan (Sketchfab, DeviantArt, Roblox, MMD, etc.) » ; « aucun fichier de l'œuvre ou de fans, aucun décalque » | session de code |
| 2026-10-07 | `docs/spec/20_PROMPT_R1e_LIEUX_CLES_ET_REORGANISATION.md` §0 (ligne 22) | « Le sujet du droit d'auteur est levé **pour la forme des lieux** […] Une seule limite reste, et elle n'est pas négociable : n'importe aucun fichier (modèle, texture, image) tiré de l'œuvre ou de fans, et ne décalque aucune illustration » ; MakeHuman et Poly Haven « déjà autorisées » | prompt rédigé par la direction, sous l'intitulé « Décision de l'utilisateur, définitive » ; message d'origine non retrouvé |
| 2026-10-07 | `docs/DECISIONS.md` D-91 | intitulé « décisions de l'utilisateur » : textures d'environnement Poly Haven admises (au plus 12 fichiers WebP en 1K, vérifiées par `assets:check`) | Gabriel selon l'intitulé (assouplissement partiel). Pour MakeHuman (corps de base, R1c), les fichiers lus ne disent pas qui a décidé |
| 2026-10-13 | `docs/spec/ERRATA_V3.md` §2 point 7 (et point 8 de la liste de §4 : « corps de base MakeHuman et 12 textures Poly Haven déjà autorisés restent valides ») | « Provenance des fichiers (**inchangé**) : aucun fichier, modèle, texture ou image tiré de l'œuvre originale ou d'un fan […] et aucun décalque d'une illustration existante » ; précise que la règle « ne limite pas la liberté de création » | errata de la direction, titre « décisions de Gabriel » mais point marqué « inchangé » |
| 2026-10-14 | `docs/DECISIONS.md` D-167 | rappelle que la règle de provenance « reste en vigueur » (à propos de deux prénoms) | direction |
| 2026-10-16 | `docs/v4/04_REGISTRE_DES_DECISIONS.md` V4-D11 | reprise en V4 avec le statut FIGÉ | moi (erreur) |
| 2026-10-17 | ce fichier | statut « EN ATTENTE » | moi |

## 3. Ce qui existe aujourd'hui, catégorie par catégorie

| Catégorie | Contrainte en vigueur | Où | Ce que Gabriel ne perd pas |
|---|---|---|---|
| **Modèles 3D** | aucun modèle tiré de l'œuvre ou d'un fan ; formes construites d'après des descriptions écrites ; corps de base MakeHuman (CC0) admis | `CLAUDE.md` ; D-91 | création libre du projet |
| **Textures** | aucune texture de l'œuvre ou de fan ; Poly Haven (CC0) pour au plus 12 textures d'environnement | `CLAUDE.md` ; D-91 | textures créées par le projet |
| **Images, illustrations, portraits** | aucune illustration de l'œuvre ou de fan, aucun décalque d'une illustration existante ; les images sont générées (voie perchance par Gabriel) ou rendues sous Blender ; évaluation par un sous-agent distinct, ≤ 3 essais | `CLAUDE.md` « Illustrations » ; ERRATA_V3 §5 | style, sujets, personnages créés |
| **Emblèmes** | redessinés par le projet comme objets de données ; la licorne de la Police militaire est un fait fourni par Gabriel | ERRATA_V3 §2 point 8 | libre création des autres insignes (`A`) |
| **Sons, musiques, polices** | pas d'extraction de l'œuvre ou de jeux officiels ; polices auto-hébergées, aucun CDN | brief §6 règle 6 ; `CLAUDE.md` | sons générés ou libres de droits |
| **Événements (texte et données)** | **aucune règle de provenance de fichier** : un événement est du texte et des données, régi par les règles de lore : création permise, étiquette `A`, `creation: true` et raison, aucun fait canon `C` contredit (`canon:check`) | ERRATA_V3 §2 points 1 à 6 | création libre |
| **Noms** | « Ilse » et « Frieda » autorisés ; tout autre prénom de l'œuvre nouveau à signaler avant usage | D-167 | — |
| **Références visuelles de Gabriel** | restent **hors du dépôt** ; elles servent à lui vérifier le résultat, jamais de pièce du projet | `07_REFERENCES_VISUELLES.md` §2 | séances de référence en conversation |

**Réponse courte à « pas de contraintes sur les événements ? »** : sur les événements, il n'y a pas de contrainte de provenance, seulement les règles de lore (création libre, étiquetée). Sur les modèles 3D et les images, il y en a une, héritée comme ci-dessus.

## 4. Trois options (Gabriel choisit)

| | **A — Maintenir** | **B — Privé et tracé (recommandée)** | **C — Lever la règle** |
|---|---|---|---|
| Principe | règle actuelle telle quelle | jeu privé, jamais publié ; on trace tout ce qui entre | aucune restriction de provenance écrite dans le `CLAUDE.md` |
| Créations du projet | oui | oui | oui |
| Assets tiers sous licence libre (CC0, CC-BY…) | oui, liste restreinte (MakeHuman, Poly Haven ≤ 12) | oui, avec URL, licence et auteur exacts au registre | oui |
| **Fichiers fournis par Gabriel** (par exemple une carte de fan) | **non** | **oui** comme entrée de conversion, dans le dépôt **privé**, à condition qu'il déclare origine, auteur et s'il a l'accord de l'auteur ; entrée au registre | oui |
| Références visuelles personnelles de Gabriel | hors dépôt, en conversation | idem | idem |
| Extraits de l'œuvre (images, sons, modèles extraits d'un jeu ou d'un animé) | non | **non** | décision de Gabriel, mais **voir les limites du §4.1** |
| Publication ou distribution hors du cercle des joueurs invités | non | **non** sans nouvelle décision | à ta charge |
| S7 (carte voxel) | **exclue** | possible | possible |
| Risque pour toi | nul | faible : dépôt privé, usage entre amis, sources tracées | à ta charge |

### 4.1 Ce que je ne ferai pas, quelle que soit l'option

Ces limites sont **les miennes**, elles ne viennent pas du dépôt et la levée de la règle n'y change rien :
1. Je ne dessine ni ne modélise **à l'identique** un personnage nommé de l'œuvre, ni ne reproduis une illustration, une affiche ou un logo précis. Les personnages et créatures du jeu sont des créations originales décrites par leur rôle et leur époque ; les emblèmes sont des créations du projet (la licorne de la Police militaire étant un fait que tu m'as fourni).
2. Je ne vais pas chercher des fichiers **extraits** des ressources d'un jeu ou d'un animé, ni sur les sites de partage où circulent ces extraits (Sketchfab, MMD, Roblox, etc.), ni ne contourne de protection.
3. Je ne rends pas public ce qui est privé : aucune publication de ton fichier de carte ni des assets dérivés.

Une conversion de **ton** fichier de carte, pour un usage privé, avec ton déclaré sur l'origine et l'accord de l'auteur, est une transformation de format de ton propre fichier : je peux la faire (option B ou C). Je ne peux pas **vérifier** l'accord de l'auteur ; c'est ta déclaration qui est consignée.

### 4.2 Ma recommandation et pourquoi

**B.** Elle lève ce qui te gêne (tu peux utiliser tes fichiers, tes références, ta carte), garde ce qui protège le projet (traçabilité, dépôt privé, pas de publication) et ne coûte presque rien : une ligne par asset au registre.

## 5. Registre d'assets (format)

Fichier : `docs/v4/registre_assets.json` (lu par `Tools assets-check`) ; une vue lisible `docs/v4/registre_assets.md` en est générée. Une entrée **par fichier** :

| Champ | Contenu | Obligatoire |
|---|---|---|
| `id` | identifiant stable (`decor_shiganshina_x3_z2_L1`) | oui |
| `fichier` | chemin dans le dépôt | oui |
| `origine` | `creation-projet` · `tiers-<licence>` · `fournie-par-gabriel` | oui |
| `script` | script générateur et sa révision (si `creation-projet`) | si création |
| `source` | URL exacte de la page de téléchargement (si tiers) ; nom du fichier d'origine et date de réception (si fourni) | si tiers ou fourni |
| `licence` | texte court + URL de la licence | si tiers |
| `auteur` | nom ou pseudonyme déclaré | si tiers ou fourni |
| `accord_auteur` | `oui` · `non` · `inconnu` ; déclaré par Gabriel, date | si fourni |
| `usage` | `prive` (seule valeur admise tant qu'une nouvelle décision n'existe pas) | oui |
| `sha256` | empreinte du fichier du dépôt | oui |
| `original_sha256` | empreinte de l'original reçu (si fourni) | si fourni |
| `triangles`, `niveau` | pour les modèles | si modèle |
| `date` | date d'entrée | oui |

`Tools assets-check` échoue si : un fichier sans entrée, une entrée sans fichier, une empreinte fausse, une origine hors de la liste, une licence absente pour un tiers, `usage` différent de `prive`, `accord_auteur` absent pour un fichier fourni. La liste des cas de test est dans M1-09.

## 6. Procédure d'entrée d'un fichier (toute session)

1. **D'où vient-il ?** Création du projet, tiers sous licence libre, ou fourni par Gabriel. Si aucune des trois : il n'entre pas.
2. Tiers : relever l'**URL exacte** de la page, la licence **sur cette page** (pas de mémoire), l'auteur. Impossible à relever en deux tentatives : il n'entre pas, on consigne.
3. Fourni : demander (une fois, par `MORNING.md`) l'origine, l'auteur, l'accord ; consigner la réponse telle quelle.
4. Copier l'original hors du dépôt (`assets_user/`, ignoré par git), calculer l'empreinte, travailler sur la copie.
5. Écrire l'entrée au registre **avant** de committer le fichier ; `Tools assets-check` doit passer.
6. Les `.glb` dérivés d'un fichier fourni sont commités **dans le dépôt privé** seulement ; ils portent l'entrée `fournie-par-gabriel`.

## 7. En attendant la réponse de Gabriel

- Pour tout ce qui **entre dans le dépôt** : option **A** (la règle héritée).
- Les références visuelles de Gabriel en conversation (séances de référence, `docs/v4/07_REFERENCES_VISUELLES.md` §2) restent possibles : elles ne sont pas versées au dépôt.
- Les tâches qui dépendent de la décision restent `bloqué (provenance)` : S6-b si le corps de base n'est pas MakeHuman, S7-b et suivantes, M8-10, M8-11.
- Une réponse de Gabriel, même brève, est consignée dans `docs/DECISIONS.md` et met à jour V4-D11, `CLAUDE.md` (modèle `docs/v4/08_MODELE_CLAUDE_MD.md`), `docs/v4/07_REFERENCES_VISUELLES.md` §1 et ce fichier.

## 8. Fichiers à modifier quand la réponse arrive

| Fichier | Modification |
|---|---|
| `docs/v4/04_REGISTRE_DES_DECISIONS.md` | V4-D11 : texte et statut selon la réponse |
| `docs/v4/08_MODELE_CLAUDE_MD.md` | section provenance et liste des arrêts |
| `docs/v4/07_REFERENCES_VISUELLES.md` | §1 point 1 |
| `docs/v4/01_CAHIER_DES_CHARGES.md` | exigence « Provenance » (§4) et critère 7 (§7) |
| `docs/v4/organisation/03_PIPELINE_ASSETS_3D.md` | §6 |
| `docs/v4/organisation/08_ACTIONS_ET_DECISIONS_DE_GABRIEL.md` | n° 2 marqué répondu |
