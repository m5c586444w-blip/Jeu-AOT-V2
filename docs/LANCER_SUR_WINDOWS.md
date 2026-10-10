# Lancer Murs et Sang sur Windows

Le jeu devient une application Windows ordinaire : une fenêtre « Murs et Sang », lancée par un double-clic, sans navigateur ni
connexion. Rien n'est publié ni envoyé. Il faut une connexion **une seule fois**, pour l'étape 2 et la première construction.

## Trois étapes

1. **Installer Node.js** (version 22 ou plus récente) : <https://nodejs.org/>, programme d'installation « LTS » pour Windows,
   options par défaut. Installer aussi **Git** (<https://git-scm.com/download/win>) si ce n'est pas déjà fait.
2. **Récupérer le jeu** : ouvrir « Invite de commandes » (ou PowerShell) dans le dossier de votre choix, puis :
   ```bat
   git clone https://github.com/m5c586444w-blip/Jeu-AOT-V2.git
   cd Jeu-AOT-V2
   git checkout claude/intelligent-feynman-8ekib4
   npm ci
   ```
3. **Construire l'application** :
   ```bat
   npm run package:win
   ```
   Compter quelques minutes la première fois (Electron, environ 100 Mo, est téléchargé une fois).

## Jouer

Ouvrir le dossier `release\Murs et Sang-win32-x64` et double-cliquer sur **`Murs et Sang.exe`**. On peut créer un raccourci vers
ce fichier sur le Bureau (clic droit → Envoyer vers → Bureau). Le dossier entier peut être copié ailleurs (clé USB, autre
ordinateur Windows) : il contient tout ce qu'il faut.

- **Plein écran** : F11 (ou lancer le raccourci avec l'option `--plein-ecran`).
- **Manuel** : F1 ; **options** : F9.
- **Sauvegardes** : automatiques tous les trente jours de jeu ; elles restent sur l'ordinateur, dans
  `%APPDATA%\Murs et Sang` (le dossier `release` peut être reconstruit sans les perdre).
- **Mettre à jour** : dans le dossier `Jeu-AOT-V2`, `git pull`, `npm ci`, puis de nouveau `npm run package:win`.

## Si quelque chose bloque

- **Windows SmartScreen** (« Windows a protégé votre ordinateur ») : l'exécutable n'est pas signé (usage personnel). Cliquer
  « Informations complémentaires », puis « Exécuter quand même ».
- **`npm` introuvable** : fermer et rouvrir l'invite de commandes après l'installation de Node.js.
- **Écran noir ou 3D absente** : mettre à jour le pilote de la carte graphique ; la carte et la gestion fonctionnent aussi sans
  la vue 3D des batailles.
- **Sans construire** : `npm run jouer` ouvre le jeu dans le navigateur, depuis un petit serveur local (voir `README.md`).

L'application a été construite et essayée sous Linux (même emballage, `npm run smoke:pack`). Sous Windows, la construction et
le lancement restent **à vérifier sur votre PC** (le cloud n'a pas de Windows).
