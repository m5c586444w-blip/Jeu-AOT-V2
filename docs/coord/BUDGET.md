# Budget et quotas

> Décision de Gabriel : la session **B (08:00–16:00)** s'arrête à **75 % de sa limite hebdomadaire**. La session **A (00:00–08:00)** s'arrête à la limite d'usage (clôture propre, voir `PROTOCOLE.md` §7).

## Ce qui est vérifié et ce qui ne l'est pas
- Une session cloud **ne peut pas lire le pourcentage réel de la limite hebdomadaire** (aucune commande ni API fournie ; non vérifié dans une session de code planifiée). Le seuil de 75 % ne peut donc pas être appliqué « à l'octet près » : il est appliqué par **trois mécanismes**, du plus fiable au moins fiable.
- Compte : `[?]` **même compte pour A et B, ou deux comptes distincts** — à renseigner par Gabriel. Si c'est le même compte, la limite hebdomadaire est partagée et **ce qu'A consomme réduit ce qui reste à B**.

## Réglages (modifiables par Gabriel ; les sessions les lisent à chaque fin de tâche)

```
B_AUTORISE: oui                 # "non" = B ne démarre aucune tâche (interrupteur manuel, le plus fiable)
B_PLAFOND_PCT: 75               # seuil voulu
SEMAINE_REINITIALISATION: ?     # jour et heure (Paris) où la limite hebdomadaire se remet à zéro — à renseigner par Gabriel
COMPTE_PARTAGE: ?               # oui / non — à renseigner par Gabriel
B_TOURS_SEMAINE_REFERENCE: 400  # [A] PROVISOIRE, non calibré : nombre de « tours » de B correspondant à 100 % ; à calibrer (ci-dessous)
A_PLAFOND_PCT: 100              # A travaille jusqu'à la limite ; si COMPTE_PARTAGE=oui et que Gabriel veut garder une réserve, abaisser ici
```

## Mécanismes de B (appliqués dans cet ordre)
1. **Interrupteur manuel** : si `B_AUTORISE: non`, clôture immédiate. Gabriel peut aussi suspendre la tâche planifiée de B depuis l'interface (réglages des tâches planifiées) quand il voit 75 % dans son compte (Paramètres → Utilisation).
2. **Compteur de tours** : B compte ses « tours » (un tour = un message de l'assistant suivi d'appels d'outils ; chaque sous-agent lancé compte pour 5) et les cumule dans la table ci-dessous. Si le cumul de la semaine en cours atteint `75 % × B_TOURS_SEMAINE_REFERENCE`, B exécute la clôture et n'ouvre plus de tâche.
3. **Message de limite** : si l'environnement affiche que la limite est atteinte ou approche, clôture immédiate (100 % dépasse le souhait de 75 %, d'où l'importance de 1 et 2).

## Calibrage (une fois, à la fin de la première semaine)
Gabriel relève dans son compte le pourcentage hebdomadaire réellement consommé et l'écrit ci-dessous ; une session calcule `B_TOURS_SEMAINE_REFERENCE = tours_B_semaine / (pourcentage_relevé_pour_B / 100)` (si le compte est partagé, il faut le pourcentage imputable à B : relever le pourcentage au début et à la fin de la fenêtre de B sur quelques jours) et le consigne dans `DECISIONS.md`.

## Compteurs de B (mis à jour par B à chaque clôture)

| Semaine (lundi → dimanche, Paris) | Tours de B | Sous-agents lancés | Cumul pondéré | % de la référence | Note |
|---|---|---|---|---|---|
| 2026-10-12 | 0 | 0 | 0 | 0 % | départ |

## Relevé de Gabriel (à remplir)

| Date | % hebdomadaire affiché | Moment (Paris) | Remarque |
|---|---|---|---|
| | | | |
