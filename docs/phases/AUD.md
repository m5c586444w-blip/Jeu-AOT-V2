# Phase AUD — musique et sons (branche `claude/v2-aud`)

Sources : fichier 22 §6, amendement 23 §3.1, E-UX-4, fichier 24 §2.4. Plafond : 120 tours. `src/sim` inchangé.

**Fait établi (D-114)** : le réseau du cloud refuse les domaines de musique (403 du proxy). Aucun enregistrement n'est donc
téléchargé. La musique est **synthétisée** (WebAudio, déterministe) à partir de **partitions du domaine public**
transcrites en notes dans le code (compositeur mort depuis plus de 70 ans, œuvre publiée avant 1929), plus des pièces
originales consonantes. L'écoute revient à Gabriel : ce rapport ne dit que ce qui est mesuré.

## Tâches
- **AUD.1** Diagnostic cité (lignes de `src/ui/audio.ts`) dans `docs/reports/AUD.md`.
- **AUD.2** Musique : `src/audio/` (notation, pièces, rendu en événements, listes de lecture, instruments). Marches pour la
  guerre (tension, combat), classique rythmé pour la carte et le menu (calme). Trois états par choix des pièces **et**
  filtre/volume. Modes majeurs, aucun bourdon, silences entre les pièces, listes ≥ 4 min avant répétition.
- **AUD.3** Sons de jeu en synthèse : interface (clic, ouvrir, fermer, valider, refus), notifications, ambiances (vent,
  ville, forêt, mur), bataille (existants, graves raccourcis).
- **AUD.4** `assets_user/musique/` (mp3, ogg) : liste servie au jeu, pistes proposées, chacune réglable.
- **AUD.5** Options : curseurs général, musique, ambiances, effets, interface ; « musique en combat seulement » ; pistes.

## Critères d'acceptation
| ID | Critère | Commande |
|---|---|---|
| CAUD-01 | `verify` code 0 | `npm run verify` |
| CAUD-02 | Diagnostic cité (lignes de code) | lecture de `docs/reports/AUD.md` §1 |
| CAUD-03 | Volume par défaut de la musique ≤ 0,35 | `npx vitest run tests/audio/` (« volume par défaut ») |
| CAUD-04 | Aucune note grave tenue > 8 s (mesuré sur les événements et sur le code des instruments) ; pas de dissonance tenue | `npx vitest run tests/audio/` |
| CAUD-05 | Liste de lecture de chaque état ≥ 240 s avant répétition ; génération déterministe | `npx vitest run tests/audio/` |
| CAUD-06 | `docs/ASSETS_LICENSES.md` : une entrée par pièce ; `assets:check` code 0 | `npm run assets:check` |
| CAUD-07 | `assets_user/musique/` : liste, lecture, options, procédure | `npx vitest run tests/audio/ tests/ui/` |

## Hors-périmètre
Téléchargement d'enregistrements (réseau refusé) ; mesure à l'oreille ; refonte de l'interface hors du panneau Options ;
nouvel outil de mesure ; `src/sim`.
