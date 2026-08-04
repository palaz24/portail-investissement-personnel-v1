# Implémentation des corrections V1.4.1

Date : 4 août 2026

## Résultat

Le correctif est terminé localement sur la branche `fix/ford-step-0-5-studio-table-10-v1-4-1`.

- Une règle centrale reconnaît `F` sans tenir compte des majuscules/minuscules et retourne un pas de 0,50 $.
- Les points Ford sont construits à partir de demi-dollars entiers, ce qui évite les artefacts de calcul flottant.
- Le graphique, le tableau complet et le CSV utilisent la même grille Ford.
- Les autres symboles conservent leur pas configuré et leur comportement antérieur.
- Le tableau visible sélectionne au plus 10 points représentatifs; la collection complète reste en mémoire pour le CSV.
- Le message explicatif demandé est visible sous le titre du tableau.

## Limites respectées

Le moteur CRR, les formules de profit/perte, les Greeks, la comparaison, les transactions, les sauvegardes et le Worker n’ont pas été modifiés. Aucun fichier privé n’a été ajouté ni publié.
