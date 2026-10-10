# Phase PACK — application Windows (double-clic)

Source : fichier 23 §6 (prompt PACK). Départ : commit de fin de P10. Branche `claude/intelligent-feynman-8ekib4` (D-148).
Plafond : 100 tours. Pas d'arrêt de revue (ROADMAP) ; arrêts obligatoires 1 à 4. `src/sim` inchangé. Aucune publication en
ligne, aucun envoi de données.

## Tâches
- **PACK.1 Choix de l'enveloppe** : Electron ou Tauri, choix consigné dans `docs/DECISIONS.md` (critères du prompt :
  simplicité de la construction sous Windows, taille, WebGL, IndexedDB, Worker). Par défaut Electron (un seul outil à installer,
  pas de chaîne Rust).
- **PACK.2 `npm run package:win`** (à lancer sur Windows) : construit le jeu, prépare l'application (fenêtre titrée, icône,
  plein écran optionnel, sauvegardes locales dans le profil de l'utilisateur, aucun accès réseau nécessaire ni permis) et produit
  un dossier `release/` avec l'exécutable. Les outils d'emballage sont téléchargés à la première construction (rien d'ajouté aux
  dépendances du dépôt, donc rien de plus à `npm ci`).
- **PACK.3 Hors réseau** : l'application ne charge que ses propres fichiers ; toute autre requête est refusée ; aucune
  télémétrie.
- **PACK.4 `docs/LANCER_SUR_WINDOWS.md`** : trois étapes (installer Node, cloner, lancer la commande), puis le double-clic.
- **PACK.5 Contrôle** : le même emballage pour Linux est construit dans le cloud et lancé sous Xvfb (Playwright, mode
  Electron) : le menu principal se charge, une partie démarre, aucune requête sortante ; capture.

## Critères d'acceptation
| Id | Critère | Commande |
|---|---|---|
| CPACK-01 | verify code 0 | `timeout 1800 npm run verify` |
| CPACK-02 | le package se construit (Windows : « non vérifié, à lancer sur Windows » si non exécuté sur Windows ; construction croisée depuis Linux notée telle quelle) | `npm run package:win` |
| CPACK-03 | le jeu lancé hors navigateur charge le menu | `npm run smoke:pack` (Linux, Xvfb) |

## Hors-périmètre
Installateur signé, mise à jour automatique, publication, macOS ; nouveaux contenus de jeu.
