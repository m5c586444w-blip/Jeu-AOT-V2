# Matin (direction autonome, mis à jour après chaque phase)

## 2026-10-14 — Nuit de la session A (à lire en premier)
- Fait, commité, poussé : C0 audit (`docs/reports/C0-audit.md`, bug cadre confirmé : `.bataille` fixed recouvre le HUD → C1 pour B) ; C3 socle multijoueur (sièges, enveloppes de commandes, rejeu) ; les **7 piliers de la spec 26 en modules purs testés** (`src/sim/gas, signal, wall, clock, tide, truth, registry`, données `data/balance/*.json`) ; mur (P1) et registre (P7) **branchés au tick, désactivés par défaut** (`EnableWall`, `EnableRegistry`). Chaque lot a eu une revue indépendante.
- Dernier verify : 149 fichiers, **1259 tests**, EXIT=0 ; les 8 empreintes `sim:selftest` sont **inchangées**.
- Dette 71 à 95 dans `docs/reports/dette.md`. Décisions D-157 à D-166.
- **À valider par toi** : D-157 (owner facultatif) ; prénoms de `data/names/paradis.json` empruntés à l'œuvre (« Ilse », « Frieda ») hors module, à trier (dette 94) ; rien n'est visible en jeu tant que les piliers ne sont pas activés/branchés (C9 suite) ; `npm run verify` dure ≈ 20-30 min sur cette machine (pas 11).
- Aucune capture ni mesure GPU cette nuit (code de simulation pur).
- **Suite** : A : C9.3 (clock) puis truth, gas, signal, tide, puis morts → registre ; B : C1 (cadre d'interface).

## 2026-10-13 — Refonte V3 (décisions de Gabriel) — à lire en premier
- Installés : `docs/spec/ERRATA_V3.md`, `26` (mécaniques, validé), `27` (multijoueur, à confirmer), `docs/coord/` (protocole, tableau C0–C14, budget, prompts A et B), outil `npm run coord`.
- **Décidé par Gabriel (soir)** : plan validé avec **tous les lieux jouables** (C15 à C18) ; pas de « Simulation de bataille » ; multijoueur **coopératif** ; deux comptes (A : reset le mardi ; B : jusqu'au vendredi 16).
- **À faire par Gabriel** : créer la tâche planifiée de B sur le compte B (`docs/coord/PROMPT_SESSION_B.md`) ; ajouter les domaines de Perchance au réseau de l'environnement ; surveiller l'usage de B (plafond levé : 100 %).
- **Décidé (2ᵉ message du soir)** : plafond de B à **100 %** ; multijoueur avec **choix du camp**, Titans commandés par leurs joueurs jusqu'à ≈ saison 4, **trahison** possible (27 §4.2 à 4.4). Pause, anti-triche, connexion, PC le plus faible : inchangés (défauts `[A]`).
- **À vérifier** : date de l'époque charnière (« saison 4 », `[?]`) ; limite assumée : à 100 %, une session peut être coupée avant sa clôture.
- **Rappel** : les mesures GPU de R2+ et R3 restent à faire sur ton PC (dettes n° 49 et 61).

**Établi (sorties réelles)**
- **N1 et N2 terminés, R3 fusionnée** (N3) : dernier verify code 0, 719/719, 8 empreintes inchangées (`docs/reports/R3-verify-fusion.log`).
- R3 : Titans de 3 à 15 m à trois variantes (peau, proportions), états lisibles (marche, saisie, dévoration, nuque tranchée, vapeur), soldats du Bataillon, de la Garnison, des Brigades spéciales et de Marley ; branchés sur les deux batailles. Réserve : Titans pas encore dérangeants (dette n° 69, R4).
- R2+ : bataille de compagnies en temps réel (jusqu'à 400 unités) : sélection, groupes, ordres, formations, tir d'artillerie sur zone, pause avec file d'ordres, caméra du dessus ou de suivi (V), porteurs commandés par ordres généraux ; les rencontres d'armées se jouent puis sont reportées dans la campagne ; repli 2D sans WebGL 2. Les hommes ne traversent plus les maisons ni ne tirent à travers.
- TUT : guide de 14 étapes (menu principal, ou Options > Rejouer), en 850. MIS : arbre de missions (touche Z).

**En dette** : n° 13–15, 21, 22–27, 28–32, 34–40, 41–45 (TUT), 46–60 (R2+), 61–70 (R3).

**À valider par Gabriel** : **mesurer R2+ et R3 sur ton PC (RTX 3050)** : rendu logiciel seulement ici (« prêt » 4,5 à 18 s contre 3 s visés) ; écouter la musique ; D-114 ; D-122/D-124/D-132 (hash) ; D-130 (deux sessions de code) ; D-147 (CLAUDE.md : `src/sim` hors `map.ts` en R2+).

**Prochaine action** : N3, phase P9 (scénarios, IA, équilibrage) sur `claude/v2-p9`, puis P10, PACK.

**Quota** : non mesuré (aucun % fourni) ; ≈ 1 750 tours depuis le 2026-10-08 matin (tableaux de DECISIONS).
