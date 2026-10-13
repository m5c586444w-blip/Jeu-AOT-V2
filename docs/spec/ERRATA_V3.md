# ERRATA V3 — décisions de Gabriel du 2026-10-13

> **Priorité** : ce fichier prime sur `CLAUDE.md` et sur tous les fichiers de `docs/spec/` antérieurs. Exception : un **fait canon** établi dans le fichier 11 (puis 01) ne peut pas être contredit par une création du projet (voir §2).
> Ordre de priorité mis à jour : **ERRATA_V3 > ERRATA_UX > ERRATA > 24 > 23 > 22 > 26 > 21 > 20 > 18 > 11 (faits canon) > 01 > 02/03 > le reste**.
> Ligne éditoriale du projet : **réalisme, fidélité au lore, jouabilité.**

## 1. Contexte
Gabriel a joué au jeu et constaté de grands écarts avec sa demande (jeu « très bêta », bugs, bataille jouable peu visible, barre du bas présente sur la carte mais absente en bataille). Il demande une **refonte quasi totale du jeu** sur la base des mécaniques validées (`26`), avec un modèle de travail à **deux sessions automatiques** (`docs/coord/`). Ce document consigne les règles nouvelles ; chaque règle remplace la règle contraire de `CLAUDE.md`.

## 2. Lore : création autorisée, étiquetée
**Décision** : Gabriel dispose de l'autorisation de créer des éléments précis de l'univers : **enseignes et emblèmes, noms de personnages, lieux, apparences**. Les restrictions antérieures sur le lore sont levées dans cette mesure.

Règles qui remplacent les anciennes :
1. **Créer est permis.** Une création porte `canon: "A"` et un champ `creation: true` (ou la convention équivalente choisie par la session et documentée) ; elle est consignée dans `docs/lore/creations.md` (ancien `questions-ouvertes.md` conservé pour l'historique).
2. **Ne jamais présenter une création comme canon.** L'étiquette `A` reste visible en mode auteur (UX0). Aucune création n'est écrite `C`.
3. **Ne pas contredire un fait canon** (`C` dans les fichiers 11 et 01). En cas de conflit, le canon l'emporte et la création est modifiée.
4. **Cohérence du monde** : une création respecte l'époque (début du XXᵉ siècle d'inspiration européenne), l'économie, la géographie et le ton du reste du monde ; elle est jugée sur le **réalisme**, la **fidélité au lore** et la **jouabilité**.
5. **Les « arrêts pour lore ambigu » sont supprimés** : la session décide, étiquette `A`, journalise dans `docs/DECISIONS.md`, avance.
6. `npm run canon:check` est **adapté** pour accepter les créations `A` (avec `creation: true` et une raison) et rejeter toute création en contradiction avec un fait `C`.
7. **Provenance des fichiers (inchangé)** : aucun fichier, modèle, texture ou image tiré de l'œuvre originale ou d'un fan (Sketchfab, DeviantArt, Roblox, MMD…), et aucun décalque d'une illustration existante. Les formes sont construites d'après des descriptions. C'est une règle de provenance des fichiers, et elle ne limite pas la liberté de création décrite ci-dessus.
8. **Emblèmes** : la Brigade de la Police militaire porte une **licorne** (fait fourni par Gabriel ; `C`, source officielle à recouper et à noter dans `docs/lore/`). Les autres emblèmes (ailes de la Liberté, Garnison, Corps d'entraînement, etc.) sont **redessinés par le projet** d'après les descriptions du fichier 10 §insignes (« redessinés »). Un blason est un **objet de données** (`data/emblems/*.json` ou équivalent), rendu en SVG, texture et décalque 3D à partir de la même définition.

## 3. Cadre d'interface unique (correction du bug de barre)
Constat (2026-10-13, 1366 × 768) : la barre supérieure et le menu de gestion existent sur la carte, mais l'**écran de bataille les remplace entièrement** par son propre en-tête.

**Règle** : il existe **un seul cadre d'interface** (barre supérieure, alertes, menu de gestion, fil de notifications, barre des joueurs en multijoueur) monté **une fois** et présent dans **tous les modes** (carte, conseil, bataille, lieux, tutoriel, menus d'options). Un mode peut **réduire** le cadre (ex. masquer le dock en bataille plein écran avec un bouton explicite), jamais le **perdre** par omission.

**Critère** : `npm run smoke:cadre` (à créer) parcourt tous les modes, en 1366 × 768 et en 3840 × 2160, et échoue si un élément du cadre manque ou est masqué sans bouton de réaffichage. Les captures sont relues par un sous-agent distinct.

## 4. Modèles 3D créés avec Blender
**Décision** : les sessions créent des modèles 3D performants et conformes au lore avec Blender, en scripts versionnés.

**Vérifié le 2026-10-13 dans l'environnement cloud** : `python3 -m venv` puis `pip install bpy` (bpy 5.2.2, Python 3.13) s'installe en ≈ 23 s ; un script crée un maillage et exporte un `.glb` en ≈ 1 s. **Aucune fenêtre Blender n'est nécessaire** (il n'y a pas d'écran en session cloud) ; « se connecter à Blender » signifie piloter le module Python `bpy`. Non vérifié : rendu Cycles/EEVEE (inutile pour l'export).

**Règles** :
1. Les scripts sont dans `tools/blender/` (un script par famille de modèles + un module commun) ; l'environnement virtuel est dans `.venv-blender/` (ignoré par git). Les sorties `.glb` vont dans `docs/art/assets/projet/`.
2. **Reproductibilité** : le `.glb` est régénérable par `npm run assets:blender` (à créer ; installe `bpy` si absent, relance tous les scripts, compare les empreintes). Pas de fichier `.blend` binaire versionné, sauf besoin justifié.
3. Manifeste (`docs/art/assets/manifest.json`) : entrée avec `origine: "creation-projet"`, chemin du script, empreinte, licence **CC0 (création originale du projet)**. `npm run assets:check` est adapté : accepte cette origine, exige le script et l'empreinte, et refuse toujours les sources tierces non retenues.
4. **Budgets (cibles `[A]` à confirmer par mesure sur le PC de Gabriel)** : soldat LOD0 ≤ 8 000 triangles, LOD1 ≤ 2 000, LOD2 ≤ 400 (ou imposteur) ; accessoires (lames, lance de foudre, fusil, canon) ≤ 1 500 ; une seule texture 1024 par famille ; ≤ 4 matériaux par modèle. Instanciation obligatoire pour les foules (100–400 unités).
5. **Conventions glTF** : axe Y haut, mètre, échelle appliquée, origine aux pieds, noms d'os stables (compatibles avec les animations existantes du projet), matériaux nommés.
6. **Lot 1 (priorité)** : tenues et équipements de toutes les institutions de Paradis (Bataillon d'exploration, Garnison, Police militaire avec licorne, Corps d'entraînement, Police intérieure/anti-personnel) et de Marley, dispositif ODM, lames, lances de foudre (après la fin de 850), fusils, canons, chariots-canons. **Lot 2** : variantes de Titans, bateaux de Marley, dirigeables.
7. **Tests** : `tests/art/models.test.ts` (budget de triangles, hauteur réelle, nombre de matériaux, noms d'os) ; une planche de contrôle `?proto3d=...` relue par un sous-agent.
8. Les corps de base (MakeHuman CC0) et les textures Poly Haven (12 fichiers) déjà autorisés restent valides ; **les tenues et accessoires sont désormais créés par le projet**.

## 5. Illustrations (portraits, événements, écrans de chargement)
**Décision de Gabriel** : obtenir les illustrations qui ne demandent pas de code en les générant sur **perchance.org** (générateur d'images gratuit, sans compte), sélectionnées après évaluation par l'IA (réalistes et cohérentes).

**État des faits (2026-10-13)** :
- **Aucune API officielle** n'a été trouvée. La page du générateur fonctionne dans le navigateur (iframe, plugin « text-to-image ») ; une page tierce non officielle (browse.sh, statut : source tierce) décrit son pilotage par interface, avec un lot de 4 à 32 images en 30 à 90 secondes et un domaine **protégé par Cloudflare** (page d'accueil en 403 pour un accès automatisé).
- **Le shell d'une session cloud ne peut pas joindre perchance.org** (blocage par la liste d'autorisation réseau, testé).
- Les conditions d'utilisation et les droits sur les images générées **n'ont pas pu être lus** (page rendue côté client). Usage proposé : jeu privé, non commercial.

**Règles** :
1. **Ne jamais contourner** une protection anti-robot (Cloudflare, vérification, limites). Si l'accès n'est pas normal, la session **s'arrête sur cette voie**, journalise, et passe au repli.
2. **Voie 1 (la plus fiable)** : les sessions produisent `docs/art/illustrations/DEMANDES.md` (une entrée par illustration : identifiant, usage, prompt prêt à coller, format, nombre de variantes). Gabriel génère les images sur son PC avec le site, les dépose dans `assets_user/illustrations/<identifiant>-<n>.jpg`. Les sessions les évaluent à l'arrivée.
3. **Voie 2** : si Gabriel ajoute les domaines de Perchance à la liste réseau du cloud **et** que l'accès fonctionne sans défi anti-robot, une session peut piloter la page avec Playwright (Chromium présent) ; un seul lot à la fois, sans insistance.
4. **Voie 3 (repli sans réseau)** : rendus Blender stylisés (éclairage, passes de couleur, filtre « peinture ») pour les portraits et les décors. Qualité inférieure à la voie 1, mais autonome.
5. **Prompts** : descriptifs (visage, tenue, époque, lumière, composition) ; ils **ne nomment ni l'œuvre, ni ses personnages, ni un artiste vivant**. Un guide de style (`docs/art/STYLE.md`) fixe : peinture stylisée, palette, lumière, cadrage, anachronismes interdits.
6. **Évaluation par l'IA** (sous-agent distinct) : chaque image est ouverte et jugée sur une grille (cohérence avec le style et le lore, époque, visage et mains, absence de texte parasite et de filigrane, lisibilité à la taille d'usage). Au plus **3 essais** par illustration ; sinon repli.
7. **Manifeste** : `docs/art/illustrations/manifest.json` (identifiant, prompt, graine si connue, date, source `perchance` ou `blender`, verdict, décision). Les illustrations ne servent **pas** de textures de terrain ni de modèles.
8. Poids : conversion en WebP ; au plus 1 Mo par illustration ; `assets:check` étendu à ce répertoire.

## 6. Multijoueur (jusqu'à 9 joueurs) — orientation confirmée
Décision de Gabriel (2026-10-13, soir) : **coopération dans chaque camp** — un conseil mixte (joueurs + conseillers IA) et, en bataille, des joueurs qui dirigent **leurs propres groupes, formations et escouades** ; **choix du grand camp** selon le scénario (845 : Paradis ou Marley ; plus de camps pour les scénarios tardifs) avec limites d'équilibre ; Titans commandés directement par leurs joueurs jusqu'à ≈ la saison 4 (`[?]`) ; **trahison possible** (« coopération, mais aussi traître »). But : un jeu amusant à plusieurs. Détail et défauts : `docs/spec/27_MULTIJOUEUR_9_JOUEURS.md` §10. `src/net` est créé au chantier C13 (après C3 et C9). Ce changement modifie la règle « jeu en local, jamais en ligne » : le jeu reste **privé** et hors Internet public ; une session réseau n'existe que si l'hôte la lance.

## 7. Mécaniques
`docs/spec/26_MECANIQUES_THEORIQUES.md` est **validé** (décisions du 2026-10-13, §12 de ce fichier) : sept piliers, rencontres générales et combat humain contre humain (§3 bis), trois échelles. Précisé le 2026-10-13 (soir) : **pas** de mode « Simulation de bataille » dans le menu ; l'ordre de mise en œuvre est accepté à condition que **toutes les villes et tous les endroits soient créés et jouables** (chantiers C15 à C18).

## 8. Organisation du travail
Deux sessions cloud automatiques coordonnées par fichiers (`docs/coord/PROTOCOLE.md`) : **A** de 00:00 à 08:00 et **B** de 08:00 à 16:00, heure de Paris, sur **deux comptes distincts**. B travaille **jusqu'à sa limite d'usage** (plafond de 75 % levé le 2026-10-13 : « utilisation maximum ») et n'est disponible que **jusqu'au vendredi 16 octobre 2026 inclus**. Le protocole de verrou remplace la règle « une seule session de code à la fois » par une règle vérifiable. La gouvernance D-107 (une phase = un sous-agent neuf, revue par un autre sous-agent, plafonds de tours) reste en vigueur.

## 9. Arrêts obligatoires (remplace la liste de CLAUDE.md)
Les sessions sont **autonomes** ; elles n'attendent pas Gabriel. Les seules interruptions :
1. **Limite d'usage atteinte** : commit, `COORD.md` et `PROGRESS.md` à jour avec la « PROCHAINE ACTION EXACTE », push, arrêt propre.
2. **Fin de fenêtre horaire** : clôture à l'heure fixée par le protocole (§ clôture).
3. **Action destructive** (force-push, suppression de branche ou de données) : interdite, pas d'attente, on choisit l'alternative.
4. **Argent** : aucun achat, aucun paiement, aucun changement d'abonnement.
5. **Une commande ne peut pas s'exécuter** après deux tentatives différentes : consigner, passer à une autre tâche.
Toute autre difficulté se règle en décidant, en journalisant dans `docs/DECISIONS.md`, et en avançant. Les « décisions à valider » vont dans `docs/MORNING.md`.
