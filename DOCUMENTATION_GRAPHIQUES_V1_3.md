# Graphiques des cours et des strikes — archive V1.3.0

> **V1.4.0 :** les deux graphiques décrits ci-dessous ont été retirés de la fiche du titre. Cette documentation est conservée uniquement comme historique. Les anciennes sauvegardes `priceHistory` restent lisibles, mais aucun nouveau point n’est ajouté.

## Historique privé `priceHistory`

En V1.3.0, le portail enregistrait un point uniquement lorsqu’une cotation Market Data valide était reçue avec succès. Chaque point contenait le symbole, le prix, la date et l’heure, la source ainsi que la devise.

L’historique demeure dans le navigateur et dans les sauvegardes JSON privées de l’utilisateur. Aucun point n’est ajouté au fichier public de démonstration. Les prix manuels, fictifs, estimés ou reconstruits ne sont jamais ajoutés à cet historique.

Un seul point est conservé par symbole et période de 15 minutes. Chaque titre conserve au maximum 5 000 points; les plus anciens sont retirés automatiquement au-delà de cette limite.

## Cours du titre et strikes actifs

Le premier graphique affiche la courbe des points réellement conservés, le prix actuel et une ligne pour chaque strike actif. Avec moins de deux points, le portail affiche « Historique en cours de constitution » sans inventer de courbe.

Les options fermées et expirées sont masquées par défaut. Le bouton « Afficher tous les strikes » permet d’afficher les strikes expirés qui correspondent encore à une position ouverte à régulariser.

## Distance entre le cours et les strikes

Le deuxième graphique applique :

```text
distance_dollars = strike - prix_actuel
distance_pourcentage = ((strike - prix_actuel) / prix_actuel) × 100
```

Il indique seulement si le strike est au-dessus, au-dessous ou au niveau du cours. Il ne constitue pas une mesure de risque.

## Interaction et apparence

La sélection d’une option dans un graphique met la même option en évidence dans l’autre graphique. Le portail offre des modes clair et sombre. Sur mobile, les graphiques restent dans la largeur de la page et leur contenu interne peut défiler horizontalement.
