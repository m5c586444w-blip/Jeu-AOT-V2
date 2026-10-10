# Rapport PACK — application Windows (double-clic)

Plan : `docs/phases/PACK.md` (23 §6). Départ `205f549` (fin de P10). Branche `claude/intelligent-feynman-8ekib4` (D-148).
Commits : `32e9d3a` (PACK.0–PACK.1 : plan, D-164), `d03b882` (PACK.2–PACK.5), puis ce rapport. Pas d'arrêt de revue.

## Ce qui est livré
- **Choix (PACK.1, D-164)** : Electron 44.4.5 (Chromium embarqué : WebGL 2, IndexedDB, Workers comme dans les essais), plutôt
  que Tauri (chaîne Rust et outils Microsoft à installer, WebView2 distinct du moteur des essais).
- **`npm run package:win` (PACK.2)** : construit le jeu, prépare `release/app` (programme `electron/main.mjs`, icône, jeu
  construit) et appelle `@electron/packager` 20.3.0 par `npx` : rien n'est ajouté aux dépendances du dépôt (`npm ci` inchangé).
  Résultat sous Windows : `release\Murs et Sang-win32-x64\Murs et Sang.exe`, dossier copiable tel quel.
- **Hors réseau (PACK.3)** : le jeu est servi par un protocole local `jeu://` (schéma standard et sûr : chemins absolus,
  modules, Worker, IndexedDB) ; toute requête hors de ce protocole est refusée ; aucune permission accordée ; ni navigation ni
  fenêtre extérieure ; aucune télémétrie. Sauvegardes dans le profil de l'utilisateur (`%APPDATA%\Murs et Sang`).
- **Notice (PACK.4)** : `docs/LANCER_SUR_WINDOWS.md` : installer Node.js (et Git), cloner, `npm run package:win` ; double-clic,
  plein écran F11, sauvegardes, mise à jour, SmartScreen.
- **Contrôle (PACK.5)** : `npm run smoke:pack` lance le même emballage construit pour Linux dans un écran virtuel (Xvfb),
  piloté par Playwright en mode Electron.

## Critères
| Critère | État | Preuve |
|---|---|---|
| CPACK-01 verify code 0 | OK | `docs/reports/PACK-verify.log` : 119 fichiers, 761 tests, `EXIT=0` |
| CPACK-02 le package se construit | Linux : OK ; Windows : **construit depuis Linux, non lancé** | `PACK-package-linux.log` ; `PACK-package-win32.log` : « Wrote new app to: release/Murs et Sang-win32-x64 », `Murs et Sang.exe` (385 Mo, icône non posée hors Windows). **À lancer sur Windows** : `npm run package:win` puis double-clic |
| CPACK-03 le jeu hors navigateur charge le menu | OK (Linux) | `npm run smoke:pack` : « smoke:pack : OK » (10 contrôles) |

Sortie réelle de `npm run smoke:pack` (`docs/reports/PACK-smoke-pack.log`) :
```
  OK  fenêtre : « Murs et Sang »
  OK  jeu servi par le protocole local (jeu://local/?menu=1)
  OK  menu principal : 4 scénarios
  OK  partie ouverte dans l'application (/?scenario=scn_sandbox_850)
  OK  partie : le temps avance
  OK  sauvegarde dans le profil (IndexedDB)
  OK  rechargement de la sauvegarde
  OK  manuel (F1)
  OK  aucune requête hors du protocole local (21 requêtes)
  OK  aucune erreur de page (0)
smoke:pack : OK
```

## Captures (`docs/screenshots/pack-*.png`, application Electron, 1366×768)
1. **pack-menu** : menu principal dans la fenêtre de l'application : rempart au crépuscule, cinq entrées (Manuel avec l'icône du
   livre), quatre scénarios, difficultés, guide de prise en main. Défauts : couvertures en emblèmes génériques, « Continuer »
   grisé (profil neuf), mention « aucun élément de l'œuvre » à revoir (D-163).
2. **pack-partie** : partie de 850 au jour 11, dossier de Trost différé : carte de Paradis, segment de Trost en rouge, alerte
   « Brèche de Trost » ; fil de notifications. Défauts : bouton « Économie » en surbrillance (survol), notification tronquée en
   bas du fil, nom « Mitras » masqué par les pions.

## Limites et suites
- Construction et lancement sous Windows **non vérifiés** (pas de Windows dans le cloud) ; exécutable non signé (SmartScreen).
- Taille : ≈ 385 Mo pour Windows (Chromium embarqué). Suite : dette n° 72 (tenues des soldats), contrôle de conformité de la
  3D demandé par l'utilisateur, puis dettes.
