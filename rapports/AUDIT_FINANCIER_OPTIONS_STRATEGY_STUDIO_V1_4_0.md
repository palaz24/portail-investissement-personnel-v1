# Audit financier — Options Strategy Studio V1.4.0

Date : 4 août 2026

## Méthode

Le P/L à l’échéance applique directement les flux d’entrée, l’intrinsèque, le sens, la quantité, le multiplicateur et les commissions. La valorisation avant échéance utilise le modèle binomial américain Cox–Ross–Rubinstein et compare, à chaque nœud, continuation et exercice immédiat.

## Résultats de référence

- Long call 100 payé 5 : -500, -500, 0 et 500 aux cours 90, 100, 105 et 110;
- long put 100 payé 4 : 600, 0, -400 et -400 aux cours 90, 96, 100 et 110;
- short put 100 vendu 4 : -600, 0, 400 et 400;
- bull call 100/110 payé 4 : perte 400, profit 600, seuil 104;
- bear call 100/110 crédit 4 : profit 400, perte 600, seuil 104;
- covered call : seuil 97, profit maximal 1 300, perte théorique 9 700.

Le call américain sans dividende, 500 pas, converge à moins de 0,03 $ de la référence Black–Scholes interne du test.

## Limites

- Les Greeks sont des différences numériques et dépendent du pas de calcul.
- Une multiéchéance dépend de la trajectoire; ses extrema ne sont pas présentés comme certains.
- Le capital des structures complexes est une estimation à confirmer au courtier.
- Bid-ask, liquidité, dividendes réels, assignation, exercice anticipé et règles de marge peuvent changer le résultat réel.

Verdict : **GO pour une validation locale**, comme outil pédagogique d’analyse de scénarios.
