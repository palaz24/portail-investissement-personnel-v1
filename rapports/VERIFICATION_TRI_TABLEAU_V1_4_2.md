# Vérification du tri du tableau V1.4.2

Date : 6 août 2026

## Résultat

Le tableau « Analyse détaillée — Tableau des résultats » affiche au plus 10 lignes. Avec le scénario Ford Wheel vérifié, les prix visibles sont présentés du maximum au minimum et respectent toujours le pas de 0,50 $.

- Première ligne : prix représentatif maximal.
- Dernière ligne : prix représentatif minimal.
- Ordre strictement décroissant et sans doublon.
- Point voisin du prix actuel conservé.
- Point voisin du seuil de rentabilité conservé lorsque possible.
- Tri manuel ascendant vérifié.
- Après changement de plage, de symbole ou de modèle, retour automatique au tri décroissant vérifié dans le navigateur.

Le CSV reste construit à partir de la collection complète avant la sélection des 10 lignes. Son ordre de calcul historique, croissant, est conservé.
