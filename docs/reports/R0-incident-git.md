# R0 — incident git du 2026-10-05 (réapplication de deux commits)

## Ce qui s'est passé

- **Contexte.** Le push de mon commit 43f4134 (ajout de la règle des captures à la fin de CLAUDE.md) a été refusé : la branche distante portait 7e59ad2, la modification de l'utilisateur faite sur GitHub, qui contenait la même règle.
- **L'erreur.** Pour retirer mon ajout en double, j'ai lancé `git rebase --onto origin/… HEAD`. Cette commande ramène la branche au sommet distant ; elle a donc écarté, en plus de 43f4134, deux commits **non poussés** :
  - 596ee80 (R0.2c, suite) ;
  - 3660eb9 (R0.3, suite).
- **La réparation.** Je les ai réappliqués par `git cherry-pick` : 596ee80 → dea43bc, 3660eb9 → 1360f79.
- **La vérification.** `npm run verify` est au code 0, puis push en avance rapide, sans force. La modification de l'utilisateur (7e59ad2) est intacte.

## `git reflog` (extrait, sortie réelle)

```
af63404 HEAD@{2026-10-05 21:01:53 +0000}: commit: R0.2g (suite) : le récit de l'épilogue n'écrit plus « 0 événements sont survenus, 0 évités » (relevé
1360f79 HEAD@{2026-10-05 21:00:49 +0000}: reset: moving to HEAD
1360f79 HEAD@{2026-10-05 20:58:27 +0000}: cherry-pick: R0.3 (suite) : en 4K, la bataille qui remplit la scène se rastérise plus lentement sans GPU (~0
dea43bc HEAD@{2026-10-05 20:58:27 +0000}: cherry-pick: R0.2c (suite) : la légende « Calques » ne s'efface que si une fenêtre ouverte la recouvre réell
7e59ad2 HEAD@{2026-10-05 20:58:26 +0000}: reset: moving to HEAD
7e59ad2 HEAD@{2026-10-05 20:58:17 +0000}: rebase (finish): returning to refs/heads/claude/attack-on-titan-strategy-game-4ukom6
7e59ad2 HEAD@{2026-10-05 20:58:17 +0000}: rebase (start): checkout origin/claude/attack-on-titan-strategy-game-4ukom6
43f4134 HEAD@{2026-10-05 20:58:17 +0000}: reset: moving to HEAD
43f4134 HEAD@{2026-10-05 20:57:56 +0000}: commit: CLAUDE.md : règle de vérification des captures (décrire chaque capture en 3 lignes, lister au moins 
3660eb9 HEAD@{2026-10-05 20:56:51 +0000}: reset: moving to HEAD
3660eb9 HEAD@{2026-10-05 19:59:01 +0000}: commit: R0.3 (suite) : en 4K, la bataille qui remplit la scène se rastérise plus lentement sans GPU (~0,75 s
596ee80 HEAD@{2026-10-05 19:57:55 +0000}: reset: moving to HEAD
596ee80 HEAD@{2026-10-05 18:49:15 +0000}: commit: R0.2c (suite) : la légende « Calques » ne s'efface que si une fenêtre ouverte la recouvre réellement
d26e977 HEAD@{2026-10-05 18:48:10 +0000}: reset: moving to HEAD
d26e977 HEAD@{2026-10-05 17:58:03 +0000}: commit: R0.4 (outil) : smoke:r0 affiné — bande à droite de l'atlas mesurée sur la hauteur de l'atlas (la mes
2c4a7bc HEAD@{2026-10-05 17:56:58 +0000}: reset: moving to HEAD
2c4a7bc HEAD@{2026-10-05 17:56:25 +0000}: commit: R0.3 : zone de jeu ≥ 85 % en 4K — le plafond d'échelle du cadrage de bataille suit la taille de la s
2bd1325 HEAD@{2026-10-05 17:55:21 +0000}: reset: moving to HEAD
```

## `git range-diff` (originaux d26e977..3660eb9 contre réappliqués 7e59ad2..1360f79)

Le signe `=` indique des patchs identiques.

```
1:  596ee80 = 1:  dea43bc R0.2c (suite) : la légende « Calques » ne s'efface que si une fenêtre ouverte la recouvre réellement (intersection des rectangles) ; masquer à c
2:  3660eb9 = 2:  1360f79 R0.3 (suite) : en 4K, la bataille qui remplit la scène se rastérise plus lentement sans GPU (~0,75 s par image) ; le pas de temps plafonné à 0,2
```

## Patchs, identifiants et arbres

```
diff 596ee80 / dea43bc : aucune différence de patch
diff 3660eb9 / 1360f79 : aucune différence de patch
596ee80  patch-id 25a9d409a974d78ac25a33ebc2d474820b16ed5d  date d'auteur Mon Oct 5 18:49:15 2026 +0000
dea43bc  patch-id 25a9d409a974d78ac25a33ebc2d474820b16ed5d  date d'auteur Mon Oct 5 18:49:15 2026 +0000
3660eb9  patch-id eb544c03aa4e539196674605d4ec5baf76f2c426  date d'auteur Mon Oct 5 19:59:01 2026 +0000
1360f79  patch-id eb544c03aa4e539196674605d4ec5baf76f2c426  date d'auteur Mon Oct 5 19:59:01 2026 +0000
$ git diff --stat 3660eb9 1360f79   # arbre d'origine contre arbre réparé
 CLAUDE.md | 2 +-
 1 file changed, 1 insertion(+), 1 deletion(-)
```

## Conclusion

- **Contenu.** Les deux commits réappliqués sont identiques aux originaux : même patch-id, même date d'auteur, `range-diff` à `=`.
- **Arbre.** L'arbre réparé ne diffère de l'arbre d'origine que par la ligne de CLAUDE.md de l'utilisateur.
- **Ce qui a changé.** Seuls les identifiants de commit ont changé, puisque le parent a changé. Aucun historique distant n'a été réécrit.
- **À l'avenir.** Pour retirer un commit local, utiliser `git revert` ou un `rebase` qui le cible lui seul, jamais `--onto <distant> HEAD`.
