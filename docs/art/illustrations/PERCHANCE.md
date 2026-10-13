# API d'images de Perchance — état des connaissances

> Source : page `https://perchance.org/perchance-ai-api` (« Image API »), lue par l'outil de lecture web le 2026-10-13, et **essai de Gabriel dans son navigateur** le même jour. Statut : service **tiers, non officiel pour le projet** ; auteur, limites et conditions d'utilisation **inconnus**.

## Établi (observé)
- **Essai de Gabriel (2026-10-13, 18:51 UTC)** : l'ouverture de `https://perchance.org/perchance-ai-api?prompt=un+chat` dans un navigateur affiche une réponse JSON :
  `ok: true`, `url` (image `.jpg` hébergée sur **`user.uploads.dev`**), `prompt`, `seed`, `resolution: "512x512"`, `guidanceScale: 7`, `negativePrompt: "NSFW, nudity, blurry, low quality, text, watermark"`, `removeBackground: false`, `generator: "perchance-ai-api"`, `generatedAt`, `timeMs: 14232` (≈ 14 s).
- La page déclare : pas de clé, pas de problème CORS, consommable « via iframe + postMessage ».
- **Un accès HTTP simple ne suffit pas** : l'outil de lecture web, qui n'exécute pas le JavaScript, reçoit la page HTML (éditeur Perchance) et non le JSON. Le JSON est donc produit **par le JavaScript de la page, dans un navigateur**.
- Depuis le conteneur cloud, `perchance.org` et `user.uploads.dev` sont **refusés** par la politique réseau (2026-10-13, code 000 / `connect_rejected`).

## Non établi (à découvrir par la première session qui aura l'accès)
- Si les paramètres — `seed`, `resolution`, `guidanceScale`, `negativePrompt`, `removeBackground` — peuvent être **fournis dans l'URL** (les champs de la réponse le suggèrent ; non vérifié).
- Les **résolutions** possibles (le défaut est 512 × 512 : suffisant pour des portraits et vignettes, **insuffisant** pour des fonds en 3840 × 2160).
- Les limites de débit, la **durée de conservation** des images sur `user.uploads.dev` (télécharger immédiatement), les **conditions d'utilisation** et les droits sur les images.
- Si un défi anti-robot (Cloudflare) est présenté à un navigateur automatisé du cloud.

## Procédure de la voie 2 (ERRATA_V3 §5.3)
1. Réseau (action de Gabriel, documentation officielle : https://code.claude.com/docs/en/cloud-environments#network-access) : niveau **Full** de l'environnement (tout domaine), ou niveau **Custom** avec `perchance.org`, `*.perchance.org`, `user.uploads.dev` (un domaine par ligne ; `*.` couvre tous les sous-domaines). Les tâches planifiées utilisent l'environnement et son niveau réseau. La session note tout domaine encore bloqué dans le journal.
   **Point à éclaircir** : l'adresse exacte qui a renvoyé le JSON dans le navigateur de Gabriel (page `perchance.org/perchance-ai-api` ou sous-domaine à identifiant du générateur) ; d'autres essais ont affiché des zones de texte colorées au lieu du JSON, cause inconnue.
2. Test d'accès avec Playwright (Chromium installé) : ouvrir `https://perchance.org/perchance-ai-api?prompt=...`, attendre le JSON dans la page, lire `url`. Défi anti-robot, refus ou 403 : **arrêt de la voie**, journal, retour à la voie 1.
3. `tools/illustrations/perchance.mjs` : une image à la fois, pause entre deux appels, téléchargement immédiat de `url`, enregistrement du fichier avec son prompt et sa graine dans `docs/art/illustrations/manifest.json` (source `perchance`).
4. Évaluation par un sous-agent distinct (grille de `docs/art/STYLE.md`), au plus 3 essais par illustration.
5. Usage **privé et non commercial** noté dans le manifeste ; ne jamais contourner une protection.
