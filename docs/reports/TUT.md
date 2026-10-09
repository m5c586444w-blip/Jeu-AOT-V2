# Rapport TUT — tutoriel guidé (branche `claude/v2-tut`)

Base 8795576. Commits : `750bd9a` (TUT.1 à TUT.3), puis ce rapport. Un seul commit de code : les trois tâches partagent les mêmes fichiers (contrôleur, textes, options).
Décisions D-135 (scénario), D-136 (forme), D-137 (préférences) ; dettes n° 41 à 44.

## Ce qui est livré
- **TUT.1** guide de 14 étapes : accueil, carte, province, ressources, temps, économie, armées, cabinet, recherche, missions, événements, expéditions, bataille, fin. Chaque étape : une ACTION demandée (bulle et halo doré sur le bouton ou la zone à utiliser), puis une EXPLICATION ancrée à ce qui s'est ouvert ; condition de passage = l'action puis « Suivant » (verrouillé à la bataille tant qu'elle est ouverte). Temps suspendu au départ ; registre refermé en passant à l'étape suivante ; dossiers d'événements non ouverts d'eux-mêmes pendant le guide.
- **TUT.2** « Quitter le guide » et « Passer l'étape » à tout moment ; « Rejouer le guide de prise en main » et case « Aides contextuelles » dans les options ; bouton d'entrée dans le menu principal (et `?tutoriel=1`). Aides contextuelles : une carte « Compris » à la première ouverture de chaque registre (21), du dossier de province et de la bataille, après le guide (terminé ou quitté). Préférences dans `Settings.tutorial` (localStorage) ; aucune écriture dans l'état de partie.
- **TUT.3** textes sobres en français, sans année, phase, canon ni code (test no-leaks sur toutes les clés `tuto.*`, `aide.*`, options et menu).
- **Scénario (D-135)** : le bac à sable 845 n'a aucun registre et en donner suppose une couche politique (empreinte `59a9b1b2` changée) ; le guide se joue donc au premier mois du bac à sable 850 (défaut de la direction). Le 845 ne propose pas de guide (vérifié).

## Critères
| Critère | État | Preuve |
|---|---|---|
| CTUT-01 `verify` code 0 | OK | `docs/reports/TUT-verify-1.log` : `Test Files  100 passed (100)`, `Tests  660 passed (660)`, `EXIT 0` |
| CTUT-02 le guide se termine sans erreur (`smoke:tuto`) | OK | `docs/reports/TUT-smoke-1.log` : 91 OK, 0 KO, `0 erreur console`, `smoke:tuto : tout est conforme.`, `EXIT 0` |
| CTUT-03 aucune mention interne | OK | `tests/ui/no-leaks.test.ts` (dans verify) ; `smoke:tuto` contrôle chaque bulle (action et explication), l'aide, les options, le menu : « aucune clé, identifiant ni mention interne » |
| CTUT-04 captures lues | OK | quinze captures ci-dessous, ouvertes une à une |
| `src/sim` inchangé | OK | `git diff origin/claude/attack-on-titan-strategy-game-4ukom6 -- src/sim \| wc -l` → `0` ; test : aucune mention du guide dans `src/sim` |
| Empreintes inchangées | OK | `sim:selftest : OK (direct = worker : …)` ; 845 `59a9b1b2`, 850 `7d032fb4`, 854 `56dc43aa` |

## Sorties réelles
`smoke:tuto` (extrait, `TUT-smoke-1.log`) :
```
  OK  étape 1/14 : « accueil » … étape 14/14 : « fin »
  OK  14 étapes parcourues dans l'ordre, jusqu'à la fin
  OK  préférences locales : guide terminé, aides activées ({"done":true,"disabled":false,"hints":true,"seen":[]})
  OK  aide contextuelle : pas une seconde fois pour le même élément
  OK  guide quitté à l'étape 2 : désactivé, aides activées ({"done":true,"disabled":true,"hints":true,"seen":["decrets"]})
  OK  1920×1080 « recherche » : bulle dans la fenêtre, sans recouvrir l'élément montré (côté « droite »)
  OK  845 : pas de guide (aucun registre dans le bac à sable économique)
  OK  0 erreur console
smoke:tuto : tout est conforme.
```
`verify` (extrait, `TUT-verify-1.log`) :
```
 Test Files  100 passed (100)
      Tests  660 passed (660)
canon:check : « data » conforme (R1–R14, 840 entrées).
sim:selftest : OK (direct = worker : sans monde, bac à sable 845, … 845 avec des missions).
EXIT 0
```
Tests ajoutés : `tests/ui/tutorial.test.ts` (16 : étapes, machine d'états, placement de la bulle, préférences, une aide par registre).

## Captures (`docs/screenshots/`) — chacune ouverte avec l'outil de lecture
1. `tuto-menu.png` (1366×768) : menu principal, quatre entrées, trois scénarios, et un encadré doré « Commencer par le guide de prise en main ». Défauts : (a) l'encadré est collé sous la liste, sans titre de section ; (b) « Continuer » grisé, sans raison visible ; (c) le guide mène au 850 sans le dire ; (d) fond très sombre à gauche.
2. `tuto-accueil-1366.png` : barre du haut entourée d'or, bulle « Étape 1 sur 14 / Bienvenue à Paradis » au centre de la carte, bouton « Suivant ». Défauts : (a) la bulle masque Mitras et les remparts ; (b) texte long de sept lignes ; (c) l'étape annonce « Le temps est suspendu » sans montrer le bouton pause ; (d) halo de la barre peu distinct de son cadre.
3. `tuto-carte-action-1366.png` : cadre doré autour de la carte, bulle « La carte » avec la consigne sur fond brun et « Passer l'étape ». Défauts : (a) la bulle recouvre le sud de l'île ; (b) pas de « Suivant » : voulu, mais on ne voit pas que l'action le débloque ; (c) le halo plein cadre ressemble à une bordure de page ; (d) « Quitter le guide » discret.
4. `tuto-temps-action-1366.png` : dossier de Utopia resté ouvert à gauche, halo sur le bloc date et vitesses, bulle dessous. Défauts : (a) le dossier de province ouvert à l'étape 3 reste affiché ; (b) la bulle cache le début de la barre d'alerte ; (c) la consigne cite « la touche 1 » alors que le bouton seul est montré ; (d) bulle collée au bord droit.
5. `tuto-province-1366.png` : dossier de Utopia à gauche, contour rouge de la province, bulle à droite du dossier sur la carte. Défauts : (a) la bulle recouvre le centre de l'île ; (b) « Strates » avec « 1 280 · 50 » sans libellé (préexistant, dette n° 21) ; (c) pas de flèche entre bulle et dossier ; (d) texte de la consigne absent après l'action (normal).
6. `tuto-economie-1366.png` : registre Économie ouvert (rations, ressources, production, consommation), bulle « L'économie » rangée au bord droit sous l'en-tête, « Suivant ». Défauts : (a) la bulle mord sur la fin de la réserve (« 447299 / 151… ») et sur « Variation du jour » ; (b) elle masque la colonne de notifications ; (c) infobulle « Raccourci V » restée sur le menu ; (d) halo doré et cadre du registre superposés.
7. `tuto-missions-1366.png` : registre Missions, bulle rangée au bord droit, sous l'en-tête. Défauts : (a) elle mord d'environ 50 px sur le registre et recouvre une partie des effets de « Inventaire des garnisons » ; (b) elle masque la colonne de notifications ; (c) le texte de l'explication est long ; (d) le bouton « Lancer » existe deux fois (préexistant).
8. `tuto-cabinet-1366.png` : plan de table du cabinet, bulle à droite en haut, « Suivant ». Défauts : (a) la bulle recouvre le haut des notifications ; (b) grand vide sous le plan de table (préexistant) ; (c) noms de personnages lisibles mais petits ; (d) « Capital 30 » sans explication visible.
9. `tuto-recherche-1920.png` (1920×1080) : Bureau d'études, arbre de technologies, bulle à droite du registre sans le recouvrir. Défauts : (a) moitié basse du registre vide ; (b) « Exige : « Combat de rue Levi / Kenny » » coupé sur deux lignes ; (c) bulle trop proche des calques ; (d) infobulle de bouton restée.
10. `tuto-recherche-3840.png` (3840×2160, affichée réduite) : même écran en 4K, registre sur la moitié gauche, bulle sur la carte à droite. Défauts : (a) texte petit par rapport à l'écran ; (b) la bulle se pose au milieu de la carte sans lien visuel ; (c) registre à moitié vide ; (d) arbre minuscule (dettes n° 21 et 31).
11. `tuto-bataille-1366.png` : bataille d'essai, bulle « La bataille » en bas à droite avec « Suivant » grisé et la note de fermeture. Défauts : (a) la bulle recouvre le coin du carnet de combat ; (b) fond de ville très chargé ; (c) « Fermer » en haut à droite, loin de la bulle ; (d) commandes d'escouade lisibles mais la bulle ne dit pas comment les utiliser.
12. `tuto-fin-1366.png` : dernière bulle « À vous de jouer », bouton « Terminer », carte dégagée, barre d'alerte rouge sur le mariage de notables. Défauts : (a) la bulle masque le nord de l'île ; (b) l'alerte rouge persiste ; (c) pas de rappel de la touche des options ; (d) aucune récapitulation des étapes.
13. `tuto-aide-1366.png` : registre Décrets, petite carte d'aide « Un décret engage le pays… » avec « Compris » à droite. Défauts : (a) la carte recouvre le haut de la légende des calques ; (b) elle masque une partie de la liste de notifications ; (c) texte court, sans lien vers la suite ; (d) bordure peu visible sur la carte.
14. `tuto-options-1366.png` : Options avec la section « Guide de prise en main » : case des aides cochée, bouton « Rejouer le guide de prise en main ». Défauts : (a) la section est tout en bas, il faut défiler à 1366 ; (b) bouton d'aspect discret ; (c) aucun état du guide (fait, quitté) affiché ; (d) infobulle « Décrets » restée.
15. `tuto-cabinet-action-1366.png` : carte dégagée (le registre Armées de l'étape précédente est refermé), halo sur le bouton Cabinet, bulle au-dessus avec la consigne et « Passer l'étape ». Défauts : (a) la bulle recouvre le titre « GOUVERNEMENT » ; (b) elle masque le coin sud-ouest de la carte ; (c) consigne qui cite la touche K sans la montrer ; (d) le halo du bouton est jaune sur fond jaune pâle, peu contrasté.

## Dettes (n° 41 à 44) et décisions
Voir `docs/reports/dette.md` et `docs/DECISIONS.md` (D-135 à D-137). Aucun critère n'a échoué deux fois. Défauts de capture en reprise possible : aide recouvrant les calques ; dossier de province non refermé en quittant l'étape 3 (dette n° 43).

## Revue de la direction (D-138)
- Deux défauts bloquants corrigés : « Rejouer le guide » hors d'une partie de Paradis ouvre la partie accompagnée de 850 ; `?tutoriel=1` est retiré de l'adresse au lancement. `smoke:tuto` n'avale plus d'erreur (case des aides cliquée, préférence vérifiée).
- `smoke:tuto` : 94 OK, code 0 (`docs/reports/TUT-smoke-2.log`) ; verify : code 0, 100 fichiers, 660 tests (`docs/reports/TUT-verify-final.log`). Captures régénérées par ce passage. Autres remarques : dette n° 45.
