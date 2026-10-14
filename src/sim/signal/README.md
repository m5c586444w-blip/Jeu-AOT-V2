# src/sim/signal

Pilier P4 (spec 26 §5) : fusées (visibilité monotone selon pluie, fumée, nuit, relief), relais avec délai et chaîne coupée, erreurs de transmission (mauvais code, fusée mouillée, fumée, incompréhension), fantômes d'information, brouillard à trois niveaux (Récit, Normal, Rude) par faction/siège, doctrine programmable (table de règles). Paramètres : `data/balance/signal.json` `[A]` (codes de couleur par branche `[C]`, 03 §7).

API pure, aléa via `Rng` injecté (fork par signal et par unité). **État branché (C9.6, D-172)** derrière `GameState.pillars?.signal` + `EnableSignal` (`state.ts` : `initSignal`, `doctrineOf`, `withDoctrine`, `withGhosts` ; désactivé par défaut, pas de pas de tick) ; non branchée à la bataille. Connaissance par faction (`GhostBook.byObserver`), vue par siège via `fogViewForSeat` (`knowledge.factionOfSeat`).
Choix `[A]` : plan 2D ; un signal ennemi n'est jamais lisible (pas d'écoute) ; Rude n'expose aucune entité exacte ; communications « moderne » (Marley `[?]`) réduisent délais et erreurs.
