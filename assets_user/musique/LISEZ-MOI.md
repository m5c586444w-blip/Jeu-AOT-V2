# Musique personnelle (assets_user/musique/)

Déposez ici vos propres fichiers **mp3** ou **ogg** (enregistrements libres de droits ou dont vous détenez la licence).
Le jeu les propose comme pistes dans Options > Musique ; ils ne sont **jamais versionnés** (`.gitignore`) ni envoyés nulle part.

## Procédure
1. Copiez les fichiers dans ce dossier (nom sans barre oblique ; extensions `.mp3` ou `.ogg`).
2. Relancez le jeu (`npm run dev` : la liste est relue à chaque chargement de la page ; version construite : refaire `npm run build`).
3. Ouvrez Options > Musique : choisissez la source (pièces du jeu, mixte, pistes personnelles seulement) et l'état de chaque piste
   (paix, guerre, combat, ou écartée).
4. Préfixes de nom reconnus pour l'état proposé au départ : `calme-`, `tension-`, `combat-` (sans préfixe : paix).

## Licences
Notez pour chaque fichier son titre, son auteur, sa licence et l'URL de la page source (fichier `licences.txt` ici, non versionné).
N'utilisez ni musique de jeu vidéo, ni musique de l'œuvre originale (règle du projet, `docs/ASSETS_LICENSES.md`).

Les domaines à autoriser dans l'accès réseau du cloud pour un téléchargement automatique futur sont listés dans `docs/reports/AUD.md`.
