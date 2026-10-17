# 07 — Modèles de documents

> Statut : **PROPOSÉ** (2026-10-17). Chaque modèle est volontairement court. Un document qui s'écarte du modèle doit le dire en une ligne.

## 1. Fiche de jalon — `docs/v4/jalons/Mn.md` (une page)

```markdown
# Mn — <titre>
Objectif : <une phrase, reprise de docs/v4/03_PLAN_DE_PRODUCTION.md §2>
Entrées : <ce qui doit être fait avant>
Tâches : <IDs du tableau, avec leur état>
Critères (commandes ou mesures) :
| # | Commande ou mesure | Seuil | Résultat (sortie collée dans le rapport) |
Hors périmètre : <ce qu'on ne fait pas dans ce jalon>
Décisions concernées : <V4-Dnn> → passent à FIGÉ à la fin
Revue : <qui, quand>
```

## 2. Rapport de jalon — `docs/v4/rapports/Mn.md` (150 lignes au plus)

```markdown
# Rapport Mn — <titre> (<date>)
## Résumé
<5 lignes : ce qui marche, ce qui ne marche pas, ce qui est reporté>
## Critères
| # | Critère | Résultat | Preuve |
| 1 | <critère> | OK / OK avec défauts / KO | <sortie collée ci-dessous, §A1> |
## Captures lues (si critère visuel)
Pour chacune : fichier ; ce que je vois (3 lignes) ; défauts possibles (≥ 3) ; verdict.
## Décisions prises (D-nnn) et décisions V4 passées à FIGÉ
## Dette (docs/reports/dette.md) : <lignes ajoutées>
## Revue indépendante : <verdict, chemin du fichier de revue>
## Prochaine action exacte
<phrase exécutable par une session sans mémoire>
## Annexes — sorties collées
A1. <commande> … code de sortie …
```

## 3. Rapport de spike — `docs/v4/spikes/Sn.md`

```markdown
# Sn — <titre> (<date>)
Question : <reprise de docs/v4/05_SPIKES_RISQUES.md>
Environnement : <machine, système, versions exactes (dotnet, Godot, Blender, Python, paquets)>
Protocole suivi : <écarts éventuels par rapport à 05>
Résultats : <tableau de mesures, valeurs réelles>
Seuils (de 05, confirmés par Gabriel le <date> ou `[A]`) : <valeurs>
Verdict : PASS / FAIL (<date>)
Si FAIL : repli appliqué : <lequel> ; décision mise à jour : <V4-Dnn>
Ce qui n'a pas été vérifié : <liste>
Fichiers : <retours Gabriel avec SHA-256, scripts, sorties>
```

## 4. Journal de session — `docs/v4/journal/AAAA-MM-JJ.md`

```markdown
# Journal AAAA-MM-JJ (session <n°>)
## Environnement
lieu : N · dotnet : <v> · godot : <v ou absent> · python : <v> · bpy : <oui/non> · cœurs : <n> · disque libre : <…>
## État au démarrage
git : <branche, dernier commit> · verify : <sortie ou « non applicable avant M1 »>
## Tâche <ID> — <titre>
plan (≤ 5 lignes) :
commandes et sorties :
décisions : <D-nnn ou « aucune »>
résultat : fait / bloqué (cause)
## Clôture
verify : … · push vérifié : <git log origin/… -1> · PROCHAINE ACTION EXACTE : …
```

## 5. Décision — entrée de `docs/DECISIONS.md`

```markdown
## AAAA-MM-JJ — D-nnn <titre court>
- **Contexte** : <une ou deux phrases>
- **Décision** : <ce qui est choisi> (par : Gabriel / direction / session ; défaut écrit : oui/non)
- **Alternative écartée** : <laquelle, pourquoi>
- **Preuve** : <sortie, mesure, source avec URL ou chemin:ligne>
- **Réversible** : oui/non — comment
```

## 6. Ligne de dette — `docs/reports/dette.md`

```markdown
| n° | ID tâche | Quoi | Où | Gravité (bloquant / gênant / mineur) | Tentative 1 | Tentative 2 | Date |
```

## 7. Section de `docs/PROGRESS.md`

```markdown
Phase : <Mn>   Tâche en cours : <ID>   Dernier verify : <date, code, nombre de tests>
PROCHAINE ACTION EXACTE : <une phrase avec : ID de tâche, première commande, premier fichier à ouvrir>
Bloqué par : <IDs `H` ou `G` en attente, avec ce qu'on attend>
```

## 8. Entrée de `docs/MORNING.md`

```markdown
### À faire par toi (Gabriel)
- [ ] <action concrète> — pourquoi : <une ligne> — durée estimée : <…> — ce que tu renvoies : <fichier ou réponse>
### À décider (défaut si pas de réponse)
- <question> — défaut : <valeur> — appliqué le : <date>
### Fait depuis la dernière fois
- <une ligne par résultat, avec le chemin du rapport>
```

## 9. Fiche de consignes d'un kit (tâche `G`, 5 lignes)

```
1. Mets le dossier <nom> où tu veux (ex. Bureau).
2. Lance <exécutable> (double-clic). Il dure environ <durée>.
3. Il écrit un seul fichier : <nom exact du fichier>.
4. Dépose ce fichier dans <dossier convenu> ou joins-le à la conversation.
5. Rien n'est envoyé sur Internet, aucune donnée personnelle n'est collectée.
```

## 10. Verdict de revue — `docs/v4/revues/<id>-<date>.md`

```markdown
# Revue <id> (<date>) — relecteur indépendant
Verdict : ACCEPTÉ / ACCEPTÉ AVEC RÉSERVES / REFUSÉ
| Critère | Prouvé ? | Sortie obtenue par le relecteur |
Défauts trouvés : <liste, gravité>
Captures : <fichier, 3 lignes, ≥ 3 défauts, verdict>
Critères en cause (si REFUSÉ) : <liste>
```

## 11. Demande de changement

Modèle dans `docs/v4/04_REGISTRE_DES_DECISIONS.md` §4 (non dupliqué ici).

## 12. Entrée du registre d'assets

Champs dans `04_POLITIQUE_DE_PROVENANCE.md` §5.
