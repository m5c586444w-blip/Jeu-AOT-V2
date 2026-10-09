# Feuille de route V2

Source : `docs/spec/24_DOSSIER_FINAL_1_MOIS.md` §5 et §6 (document maître ; priorité 24 > 23 > 22 > 21 > 20 > 18). Les prompts et plafonds de tours sont dans l'index du fichier 24 §6.

| Niveau | Phase | Prompt | Plafond | Arrêt de revue | Statut |
|---|---|---|---|---|---|
| N1 | UX0 | 22 §3 | 60 | non | fusionnée (PR n° 1) |
| N1 | MAP | 22 §4 | 220 | oui (revue par sous-agent, D-106) | terminée, fusionnée par la PR n° 2 |
| N1 | UI | 22 §5 | 280 | oui (revue par sous-agent, D-113) | terminée, fusionnée par sa PR (dette n° 19 à 21) |
| N1 | AUD | 22 §6 + 23 §3.1 | 120 | non | terminée, fusionnée par sa PR (D-114 à D-117) |
| N1 | CHR | 22 §7 | 120 | non | terminée, fusionnée par sa PR (D-118 à D-123) |
| N1 | PA | 21 §7 + 23 §3.2 | 200 | oui (revue par sous-agent, D-130) | terminée, fusionnée par sa PR (D-124 à D-130) |
| N2 | MIS | 23 §5 | 150 | non | en revue (branche `claude/v2-mis`, D-131 à D-133) |
| N2 | TUT | 23 §5 | 100 | non | à faire |
| N2 | R2+ | 18 §1 + 23 §4 | 300 | oui | à faire |
| N3 | R1e | 20 (§6, §8), périmètre 21 §3, districts 24 §3 | 200 | oui | terminée et acceptée (pilote Shiganshina + Maria) ; LC-B/C/D en N3 si quota |
| N3 | R3 | 18 §2, version courte 21 §8 | 150 | non | à faire |
| N3 | P9 | 18 §9 | 200 | oui | à faire |
| N3 | P10 | 18 §10 | 120 | non | à faire |
| N3 | PACK | 23 §6 | 100 | non | à faire |

Règle de coupe (fichier 24 §5.3) : lieux faits main au-delà de Shiganshina et des districts de Maria → R3 → TUT → MIS → P10 → R2+ → jamais N1.

Depuis le 2026-10-08, les arrêts de revue sont tenus par la direction autonome (revue par un sous-agent distinct, `docs/DECISIONS.md` D-106) ; Gabriel relit au retour (`docs/MORNING.md`).
