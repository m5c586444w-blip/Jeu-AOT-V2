# Matin (direction autonome, mis à jour après chaque phase)

## 2026-10-13 — Refonte V3 (décisions de Gabriel) — à lire en premier
- Installés : `docs/spec/ERRATA_V3.md`, `26` (mécaniques, validé), `27` (multijoueur, à confirmer), `docs/coord/` (protocole, tableau C0–C14, budget, prompts A et B), outil `npm run coord`.
- **À renseigner par Gabriel** (`docs/coord/BUDGET.md`) : même compte ou deux comptes ; jour et heure de remise à zéro hebdomadaire ; pourcentage relevé après une semaine pour calibrer le plafond de B à 75 %.
- **À préciser par Gabriel** : Q11 (mode « Simulation de bataille » dans le menu), Q12 (ordre de mise en œuvre), questions du multijoueur (27 §10).
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
