# src/net — multijoueur privé (spec 27, chantier C13)

Lockstep déterministe, **un hôte séquenceur**. Aucun `Math.random`, aucun `Date.now` : le temps est celui de l'appelant (boucle de la partie ou de test).

- `protocol.ts` : messages JSON typés (Zod) client ↔ hôte ; `Turn` = enveloppes ordonnées par l'hôte + avance en jours.
- `lockstep.ts` : `applyTurn` — SEUL chemin par lequel l'état change (hôte compris) ; un refus à l'exécution n'interrompt pas le tour et est identique chez tous.
- `host.ts` : `Host` (accueil mot de passe/siège, forme + siège usurpé + droit à la réception, tour, comparaison d'empreintes, instantané au fautif, journal, coffre de secrets).
- `client.ts` : `Client` (tampon des tours en désordre, empreinte à la cadence convenue, reprise sur instantané). Une action du joueur est TOUJOURS une commande envoyée à l'hôte.
- `transport.ts` : interface `Link` + `LoopbackNetwork` (latence tirée d'une graine, ordre conservé, coupure) ; `wsTransport.ts` : WebSocket réel (`ws`), boucle locale par défaut.
- `battle.ts` : bataille à plusieurs au pas de la bataille (20 Hz) : `BattleHost`/`BattleClient`, `applyBattleTurn` (ordres de siège vérifiés par escouade via `applyBattleOrderAs`, puis `steps` pas), empreinte `battleHash`, instantané = état JSON de la bataille ; les escouades portent `owner`.
- `secrets.ts` : `assignTraitors` (aucune | possible | garantie, plafond 1 pour ≤ 5 joueurs, 2 au-delà), `SecretVault` (hors état partagé, tours et instantanés ; message privé `secret` à un seul siège).

Camps rivaux : `src/sim/core/table.ts` (`withTable`), `nations.humans` (D-179). Reste (C13) : salon d'attente et choix du camp, conseils propres aux camps rivaux, conseil mixte et IA de remplacement, bataille à plusieurs dans l'interface (le protocole existe), pause et vitesse par vote, messages/pings, conséquences des actes de traître, transfert d'hôte, interface (barre des joueurs).
