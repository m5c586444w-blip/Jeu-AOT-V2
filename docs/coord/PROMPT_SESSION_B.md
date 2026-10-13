# Prompt de la session B — jour (08:00 → 16:00, heure de Paris)

> Texte à coller comme **prompt de la tâche planifiée B**. Il est volontairement court : tout le détail est dans le dépôt.

```
Tu es la session AUTOMATIQUE « B » du projet Murs et Sang (dépôt Jeu-AOT-V2). Ta fenêtre de travail est 08:00 → 16:00, heure de Paris ; tu ne dois rien écrire en dehors. Tu as un plafond hebdomadaire de 75 % de ta limite d'usage.

1. Récupère le dépôt : git fetch origin && git checkout claude/attack-on-titan-strategy-game-4ukom6 && git pull --rebase (et npm ci si node_modules manque).
2. Lis docs/coord/PROMPT_COMMUN.md et exécute-le à la lettre. Ta session est « B ».
3. Vérifie l'heure avec « npm run coord -- fenetre » : si session ≠ B, arrête-toi sans rien modifier.
4. Lis docs/coord/BUDGET.md : si B_AUTORISE vaut « non » ou si ton compteur de la semaine atteint 75 % de la référence, n'ouvre aucune tâche : écris-le dans le journal et arrête-toi.
5. Si « npm run coord -- verrou prendre B … » répond OCCUPE, une instance vivante (B ou A) travaille déjà : arrête-toi (ce déclenchement n'est qu'un relais). Pendant le travail, pousse un battement avec « npm run coord -- verrou battement B » au moins toutes les 30 minutes.

Tu es autonome : Gabriel ne répond pas. Tu ne communiques avec la session A que par les fichiers de docs/coord/. Tu clôtures proprement à 15:40 (voir docs/coord/PROTOCOLE.md §6), tu ne démarres aucune nouvelle tâche après 15:15, et tu mets à jour tes compteurs dans BUDGET.md à chaque clôture.
Si docs/coord/PROMPT_COMMUN.md est introuvable, arrête-toi et écris la raison dans docs/MORNING.md.
```

## Paramètres propres à B
- **Déclenchement conseillé** : `CRON_TZ=Europe/Paris 0 8,10,12,14 * * *` — lancement à 08:00 puis trois relais. B ne démarre qu'à partir de **08:00 exactement** (pas avant : A clôture à 07:40 et le test de fenêtre de `npm run coord` l'interdit).
- **Voie conseillée** : interface, assets, scripts Blender, illustrations, documentation, tests visuels (C1, C2, C10, C11, C12) ; si ces voies sont vides, toute tâche libre dont les dépendances sont faites.
- **Modèle** : intermédiaire, qui économise le plafond ; sous-agents de **revue** indépendants à chaque jalon (modèle le plus capable disponible si le compteur le permet).
- **Plafond 75 %** : voir `BUDGET.md` — l'interrupteur manuel, puis le compteur de tours (provisoire, à calibrer), puis le message de limite. **La session ne peut pas lire le pourcentage réel** ; ne jamais prétendre le connaître.
- **Capacité** : la première journée, C1 (cadre d'interface unique), puis C2, puis l'outillage de C10.
