# P9 — Propositions de correctifs de `src/sim` (non appliquées)

`src/sim` est resté inchangé pendant P9 (diff vide, 8 empreintes identiques). Les correctifs ci-dessous sont **à valider par Gabriel** (D-161) ; aucun n'est appliqué.

## SP-1 — L'armée d'invasion bombarde un segment déjà percé jusqu'à la fin

- **Fichier** : `src/sim/armies/ai.ts`, fonction `siegeSpot`.
- **Constat** (campagne 854, `sim:balance` et sonde) : l'armée de Marley débarque, perce le segment de mur le plus proche (structure 0 vers le 60ᵉ jour), occupe sa province de siège, puis reste sur place à « bombarder » ce segment détruit jusqu'à l'échéance (environ 120 décisions « bombarder » par partie). `siegeSpot` retient tout segment tenu par Paradis dont la structure n'est pas nulle (`!== null`), même tombé sous `siege.capture_below_structure`.
- **Diff proposé** :

```diff
 function siegeSpot(ctx: ArmyCtx, a: ArmyState): string | null {
   const g = geoOf(ctx.world);
   let best: { p: string; d: number } | null = null;
   for (const [seg, node] of [...g.nodes].sort(([x], [y]) => x.localeCompare(y))) {
-    if (!node.zone.startsWith("mur_") || ctx.st.provinces[seg]?.control !== "paradis") continue;
+    const ps = ctx.st.provinces[seg];
+    if (!node.zone.startsWith("mur_") || ps?.control !== "paradis") continue;
+    // Segment déjà percé : plus rien à y bombarder ; l'armée assiège le suivant (ou franchit la brèche, à décider).
+    if (ps.wall_structure !== null && ps.wall_structure < ctx.aw.balance.siege.capture_below_structure) continue;
     for (const e of g.adj.get(seg) ?? []) {
```

- **Raison** : enlever le cycle dégénéré ; l'IA de Marley poursuit l'invasion (segment suivant). Franchir la brèche vers l'anneau intérieur demande une règle de plus (à trancher : 02 §16).
- **Effet attendu sur les empreintes** : seules les empreintes dont la partie contient une brèche changent. Le scénario 854 de `sim:selftest` est à remesurer ; 845 et 850 (aucune armée d'invasion) restent identiques.

## SP-2 — Notion de fin de partie dans l'état

- **Fichier** : `src/sim/core/state.ts` (champ facultatif), `src/sim/sim.ts`.
- **Constat** : la fin de campagne est évaluée hors de la simulation (D-155) ; le suivi des jours sans vivres repart de zéro quand une partie est reprise d'une sauvegarde.
- **Proposition** : un compteur `famineStreak` dans `StrategicState` (mis à jour par `tickDay`), lu par `src/campaign/outcome.ts` à la place du suivi.
- **Effet attendu sur les empreintes** : toutes changent (nouveau champ dans l'état canonique). À ne faire qu'avec une nouvelle série d'empreintes de référence.
