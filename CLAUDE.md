# Murs et Sang — mémoire de travail

> **Ligne éditoriale (décision de Gabriel, 2026-10-13) : réalisme, fidélité au lore, jouabilité.** C'est un projet personnel, non commercial, **privé** (amis invités, jamais publié).
> **Refonte quasi totale en cours** : `docs/spec/ERRATA_V3.md` (prime sur ce fichier), mécaniques `docs/spec/26_MECANIQUES_THEORIQUES.md` (validé), multijoueur coopératif `docs/spec/27_MULTIJOUEUR_9_JOUEURS.md` (confirmé le 2026-10-13), coordination `docs/coord/`.

## Priorités et documents
- Ordre de priorité : **ERRATA_V3 > ERRATA_UX > ERRATA > 24 > 23 > 22 > 26 > 27 (après confirmation) > 21 > 20 > 18 > 11 (faits canon `C`) > 01 > 02/03 > 06/07/08/10/12/13 > 09 > 04 > 05**. Spécifications : `docs/spec/`.
- Stack : TypeScript strict + Vite, Vitest, ESLint (flat), Zod.
- Scripts : `dev`, `build`, `typecheck`, `lint`, `test`, `data:validate`, `canon:check`, `assets:check`, `sim:selftest`, `sim:balance`, `verify:rapide`, `coord` (fenêtres et verrou), **`verify`** (enchaîne tout). À créer par la refonte : `smoke:cadre`, `assets:blender`, `smoke:bataille`.
- Le détail du plan est dans `docs/coord/PLAN_FONCTIONNALITES.md` ; l'état dans `docs/coord/COORD.md` et `docs/PROGRESS.md`.

## Organisation du travail : deux sessions automatiques (ERRATA_V3 §8)
- **A** : 00:00 → 08:00, **B** : 08:00 → 16:00 (heure de Paris, `npm run coord -- fenetre`). Deux comptes distincts. B n'a **pas de plafond avant sa limite d'usage** (utilisation maximale voulue par Gabriel) et **n'existe que jusqu'au vendredi 16 octobre 2026** ; ensuite A seule (`docs/coord/BUDGET.md`).
- Elles ne se parlent **jamais** : uniquement par les fichiers de `docs/coord/` (verrou, tableau, boîte de passage, journaux). Protocole : `docs/coord/PROTOCOLE.md` ; mission : `docs/coord/PROMPT_COMMUN.md`.
- **Tronc unique** `claude/attack-on-titan-strategy-game-4ukom6` ; un commit par tâche ; `npm run verify` **complet** vert avant le commit de fin de tâche et à la clôture (≈ 11 min en session cloud à 2 cœurs : lancer en arrière-plan avec `nohup … > fichier.log &` et relever la sortie, la commande de l'outil Bash étant limitée à 10 min) ; commits intermédiaires (WIP) : `npm run verify:rapide` (typecheck, lint, données, assets, canon) plus les tests ciblés du module touché ; `git pull --rebase` avant chaque push ; jamais de `--force`, jamais de suppression de branche.
- Chaque chantier `Cn` commence par `docs/phases/Cn.md` (tâches, critères d'acceptation avec commandes, hors-périmètre) et finit par `docs/reports/Cn.md` (≤ 150 lignes, sorties réelles collées, captures dans `docs/screenshots/`). Une **revue indépendante** (sous-agent distinct, jamais l'auteur) clôt chaque chantier (D-107). `docs/PROGRESS.md` à jour : phase, tâche, dernier verify, **PROCHAINE ACTION EXACTE**.
- Les sessions **décident** et journalisent (`docs/DECISIONS.md`, D-nnn) ; elles n'attendent pas Gabriel. Les décisions à valider vont dans `docs/MORNING.md`. D-130 (sessions de Gabriel lui-même) : il peut poser un verrou `GABRIEL` dans `docs/coord/LOCK.json`.

## Simulation
- `src/sim` : logique **pure**. **Jamais** de DOM, de Pixi, de `Math.random`, de `Date.now` (temps et aléa injectés). Pas de `any`.
- `src/sim` **peut être modifié** par les chantiers de la refonte (C3 à C8, puis C13 pour les prérequis réseau), avec des tests de signature par pilier. Les empreintes de référence peuvent changer **délibérément** (raison dans `DECISIONS.md`) ; le test de rejeu doit rester vert. (L'ancienne exception « `map.ts` seulement en R2 » est caduque.)
- **Multijoueur** (27) : choix du camp selon le scénario, conseil mixte joueurs + conseillers IA dans chaque camp, trahison possible, en bataille chaque joueur dirige ses groupes, formations, escouades (et ses Titans jusqu'à l'époque charnière ≈ saison 4 `[?]`) : `src/net` seulement au chantier C13. Toute action du joueur est une **commande typée sérialisable** ; chaque entité porte un `owner` (siège) ; connaissance par faction et brouillard par siège : pas d'hypothèse « un seul joueur » (multijoueur).
- Valeurs d'équilibre `[A]` : dans `/data`, jamais en dur.

## Lore : la création est autorisée (ERRATA_V3 §2)
- Gabriel a l'autorisation de créer des éléments précis de l'univers : **enseignes et emblèmes, noms de personnages, lieux, apparences**.
- Chaque entrée porte `canon: "C" | "A" | "?"`. Une création est `A` avec `creation: true` et une raison, consignée dans `docs/lore/creations.md` ; elle n'est **jamais** présentée comme canon (l'étiquette reste visible en mode auteur).
- Les **faits canon `C`** (fichier 11, puis 01) ne sont pas contredits. Le fichier 11 prime sur le 01. Époque : début du XXᵉ siècle d'inspiration européenne ; une création est jugée sur le réalisme, la fidélité au lore, la jouabilité.
- **Plus d'arrêt pour lore ambigu** : on décide, on étiquette `A`, on journalise, on avance. `canon:check` accepte les créations `A` correctement déclarées et rejette toute contradiction d'un fait `C`.
- Emblèmes : la Police militaire porte une **licorne** (fait fourni par Gabriel, source à recouper dans `docs/lore/`). Les insignes sont **redessinés par le projet** comme objets de données (`data/emblems/`), rendus en SVG, texture et décalque 3D depuis la même définition.
- **Provenance des fichiers (inchangée)** : aucun fichier, modèle, texture ou image tiré de l'œuvre originale ou d'un fan (Sketchfab, DeviantArt, Roblox, MMD…), aucun décalque. Les formes sont construites d'après des descriptions.

## Assets
- Aucun CDN (polices auto-hébergées). Licences dans `docs/ASSETS_LICENSES.md`. Manifeste `docs/art/assets/manifest.json` ; `npm run assets:check` échoue si un fichier n'a pas d'entrée ou si l'origine/la licence n'est pas admise.
- **Modèles 3D créés avec Blender** (ERRATA_V3 §4) : scripts `tools/blender/` pilotant le module Python `bpy` (aucune fenêtre en session cloud), sorties `.glb` dans `docs/art/assets/projet/`, commande `npm run assets:blender`, manifeste `origine: "creation-projet"` (script + empreinte, CC0 création originale). Budgets : soldat LOD0 ≤ 8 000 triangles, LOD1 ≤ 2 000, LOD2 ≤ 400 ; accessoire ≤ 1 500 ; une texture 1024 par famille. Tests `tests/art/models.test.ts`.
- **Sources externes retenues** (R1c, R1d) : **MakeHuman** (CC0, dépôts officiels `makehumancommunity`) pour les corps de base et animations ; **Poly Haven** (CC0) pour au plus **12 textures d'environnement** en 1024 × 1024 WebP. Aucun modèle, HDRI ou autre ressource Poly Haven. Kenney, KayKit, Quaternius, Poly Pizza écartées. Les tenues et accessoires sont désormais **créés par le projet**.
- **Illustrations** (ERRATA_V3 §5) : portraits, événements, écrans de chargement. Voie 1 : Gabriel génère sur perchance.org d'après `docs/art/illustrations/DEMANDES.md` et dépose dans `assets_user/illustrations/` ; voie 2 : pilotage Playwright seulement si accessible sans défi anti-robot ; voie 3 : rendus Blender stylisés. **Ne jamais contourner** Cloudflare, CAPTCHA ou limites. Évaluation par un sous-agent distinct (grille de `docs/art/STYLE.md`), ≤ 3 essais, WebP ≤ 1 Mo.
- Chargement 3D : `GLTFLoader`, à la demande, dans `src/render/tactical3d` seulement ; rien dans le bundle principal. Pixi uniquement dans `src/render`. three.js uniquement dans `src/render/tactical3d` (règle ESLint prouvée par `tests/lint/sim-purity.test.ts`).
- Jeu **privé** : hors Internet public ; une session réseau n'existe que si l'hôte la lance (voir 27). Pas de compression d'assets.

## Interface (ERRATA_V3 §3)
- Un **seul cadre d'interface** (barre supérieure, alertes, menu de gestion, fil de notifications, barre des joueurs) monté une fois et présent dans **tous** les modes (carte, conseil, bataille, lieux, tutoriel, options). Un mode peut le réduire par un bouton explicite, jamais le perdre. Critère : `npm run smoke:cadre` en 1366 × 768 et 3840 × 2160.
- **Pas** d'entrée de menu « Simulation de bataille » (décision définitive de Gabriel) ; la bataille se joue depuis la campagne.

## Rendu et latence
- Pas d'objectif moyen d'images par seconde (R1c). Contraintes de **latence** (04 §9) : chargement < 8 s à froid, scène tactique < 3 s ; « prêt » = ville visible avec repères simplifiés, corps détaillés ensuite ; cible de 3 s en qualité basse allégée (rendu logiciel) ; qualités moyenne et haute et mesure sur GPU réel : **« à vérifier » sur le PC de Gabriel** (RTX 3050).
- Interdit : nouvel outil de mesure ; optimiser pour le rendu logiciel.
- Districts : tout reste `?` ou `A` paramétrable ; pas de portes de rivière ailleurs qu'à Shiganshina. **Toutes les villes et tous les lieux doivent être créés et jouables** (exigence de Gabriel, 2026-10-13) : chantiers C15 à C18 (murs Rose et Sina, hors-murs, Marley, Hizuru, alliés, couverture de l'atlas 06). Lieux principaux faits à la main (`data/places/<id>.json`), lieux courants générés une fois puis figés ; villes de taille réaliste (population ÷ densité) et plantées.

## Qualité
- **N'affirme jamais qu'un test est vert, ni qu'un critère passe, sans avoir collé la sortie réelle de la commande.** Un critère qui échoue deux fois : l'écrire dans le rapport et `docs/reports/dette.md`, puis passer à une autre tâche.
- Avant d'écrire OK sur un critère visuel : ouvre chaque capture avec l'outil de lecture d'image, décris ce que tu vois en 3 lignes et liste au moins 3 défauts possibles (texte répété, zone vide, chevauchement, élément absent, valeur à 0 incohérente, cadre d'interface manquant). Écris-les dans le rapport, même si tu les juges mineurs. Capture vide ou sans l'élément testé : critère KO.
- Un écran dont une valeur n'est pas branchée est un défaut, pas un « 0 ».

## Arrêts (remplacent l'ancienne liste ; ERRATA_V3 §9)
1. **Limite d'usage atteinte** : clôture propre (commit, `COORD.md`, `PROGRESS.md` avec la PROCHAINE ACTION EXACTE, push), arrêt.
2. **Fin de la fenêtre horaire** : clôture à T−20 min (`docs/coord/PROTOCOLE.md` §6).
3. **Action destructive** (force-push, suppression de branche ou de données) : interdite ; on choisit l'alternative, on n'attend pas.
4. **Argent** : aucun achat, aucun paiement, aucun changement d'abonnement.
5. **Une commande ne peut pas s'exécuter** après deux tentatives différentes : consigner, passer à une autre tâche.
Toute autre difficulté : décider, journaliser, avancer. Gabriel relit `docs/MORNING.md` au retour.
