"""Contrôle de docs/v4/organisation/02_TABLEAU_DES_TACHES.md : 8 colonnes par tâche, états/lieux/tailles valides,
identifiants uniques, dépendances existantes, pas de cycle, toute tâche G précédée d'une tâche N (kit).
Usage : python3 -I docs/v4/organisation/annexes/controle_tableau.py docs/v4/organisation/02_TABLEAU_DES_TACHES.md
Réussite : la ligne « problèmes: [] », « doublons: [] » et « dépendances inconnues: [] »."""
import re, sys
from collections import Counter
p = sys.argv[1]
ID = r"(?:P|M\d+|S\d+|B)-[0-9a-z]+(?:\.[ab])?"
rows, problems = [], []
for n, line in enumerate(open(p, encoding="utf-8"), 1):
    if not line.startswith("|"): continue
    cells = [c.strip() for c in line.strip().strip("|").split("|")]
    if not re.fullmatch(ID, cells[0]): continue
    if len(cells) != 8:
        problems.append((n, cells[0], "colonnes=%d" % len(cells))); continue
    rows.append((n, cells))
    _id, etat, tache, lieu, taille, dep, crit, repli = cells
    if not (etat.startswith(("à faire", "en cours", "fait", "bloqué", "en réserve"))): problems.append((n, _id, "état:" + etat))
    if lieu not in ("N", "G", "H"): problems.append((n, _id, "lieu:" + lieu))
    if taille not in ("S", "M", "L", "—"): problems.append((n, _id, "taille:" + taille))
    if lieu in ("G", "H") and taille != "—": problems.append((n, _id, "G/H doit avoir taille —"))
    if lieu == "N" and taille == "—": problems.append((n, _id, "N sans taille"))
    if len(crit) < 4: problems.append((n, _id, "critère vide"))
ids = [c[0] for _, c in rows]
known = set(ids)
dups = sorted({i for i in ids if ids.count(i) > 1})
unknown = []
for n, c in rows:
    for tok in re.findall(ID, c[5]):
        if tok not in known: unknown.append((n, c[0], tok))
# tâches G précédées d'un kit N : la dépendance doit contenir au moins un ID de lieu N
byid = {c[0]: c for _, c in rows}
for n, c in rows:
    if c[3] == "G":
        deps = re.findall(ID, c[5])
        if not any(byid.get(d, [None]*8)[3] == "N" for d in deps): problems.append((n, c[0], "G sans kit N en dépendance"))
# cycles
import functools
sys.setrecursionlimit(10000)
graph = {c[0]: [d for d in re.findall(ID, c[5]) if d in known] for _, c in rows}
state = {}
def dfs(u, path):
    state[u] = 1
    for v in graph[u]:
        if state.get(v) == 1: problems.append((0, u, "cycle via " + v)); continue
        if v not in state: dfs(v, path + [v])
    state[u] = 2
for u in graph:
    if u not in state: dfs(u, [u])
print("tâches:", len(rows))
print("problèmes:", problems)
print("doublons:", dups)
print("dépendances inconnues:", unknown)
print(sorted(Counter(re.match(r"(P|M\d+|S\d+|B)", i).group(1) for i in ids).items()))
print("lieux:", dict(Counter(c[3] for _, c in rows)), "| tailles:", dict(Counter(c[4] for _, c in rows)))
