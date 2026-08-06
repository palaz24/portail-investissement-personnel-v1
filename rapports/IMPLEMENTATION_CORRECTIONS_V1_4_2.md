# Implémentation des corrections V1.4.2

Date : 6 août 2026

## Résultat

La V1.4.2 est terminée localement sur la branche `fix/projection-dark-table-desc-v1-4-2`.

- Les textes SVG héritent explicitement de la couleur du thème.
- Les titres des axes utilisent `var(--text)`; le cours actuel utilise `var(--warning)`; les seuils utilisent `var(--positive)`.
- La courbe sélectionnée utilise une variable dédiée définie dans les deux thèmes.
- L’info-bulle possède un fond, une bordure et un texte compatibles avec les thèmes.
- Le tableau sélectionne les mêmes points représentatifs, puis applique séparément un tri décroissant par défaut.
- Le tri est rétabli après un changement de modèle, de stratégie enregistrée, de symbole ou de plage.

Le moteur financier, les formules, les Greeks, les seuils, les données privées et le Worker n’ont pas été modifiés.
