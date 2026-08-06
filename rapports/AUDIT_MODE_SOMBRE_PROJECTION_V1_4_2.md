# Audit du mode sombre — Projection V1.4.2

Date : 6 août 2026

## Cause constatée

Avant la correction, les nombres des axes SVG avaient une couleur CSS héritée correcte, mais leur propriété SVG `fill` demeurait noire (`rgb(0, 0, 0)`). Ils devenaient donc difficiles ou impossibles à lire sur le panneau sombre.

## Correction et mesures

| Élément | Mode sombre | Mode clair |
|---|---:|---:|
| Titre Profit et perte | 15,12:1 | 15,02:1 |
| Titre Projection | 4,78:1 | 5,53:1 |
| Nombres des axes | 6,47:1 | 4,76:1 |
| Titres des axes | 15,12:1 | 15,02:1 |
| Légende | 15,12:1 | 15,02:1 |
| Info-bulle | 13,80:1 | 13,83:1 |

Les textes SVG ne contiennent aucun `fill="black"`, `fill="#000"` ni équivalent. La grille reste discrète grâce à `var(--border)`. Les courbes, le zéro, le cours actuel et les seuils gardent aussi des libellés textuels : l’information ne dépend pas uniquement de la couleur.
