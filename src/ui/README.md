# src/ui

Écrans, composants, console de debug.

## Audio (AUD)
`audio.ts` : moteur WebAudio (bus musique, ambiances, effets, interface ; ducking ; silence ; pièces de `src/audio/`), sons d'interface et de
notification, ambiances (vent, ville, forêt, mur), bruits de bataille. `audioSetup.ts` : pistes de `assets_user/musique/` et bibliothèque
musicale tirée des préférences. `optionsPanel.ts` : cinq curseurs, « musique en combat seulement », source de la musique, pistes personnelles.
