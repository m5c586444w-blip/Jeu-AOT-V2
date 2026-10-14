# src/sim/gas

Pilier P3 (spec 26 §4) : réseau d'ancrage (registre de pertes séparé de la carte), carte d'ancrage réelle/estimée, fenêtre de coupe, coût stratégique du gaz. Paramètres : `data/balance/gas.json` `[A]`. API pure. **État branché (C9.5, D-171)** derrière `GameState.pillars?.gas` + `EnableGas` (`state.ts` : `initGas`, `ledgerOf`, `withLedger` ; désactivé par défaut, pas de pas de tick). Le branchement à `battle.ts`/conseil reste à faire.
