# Résultats des tests — Options Strategy Studio V1.4.0

Date : 4 août 2026

## Résultat final

- Tests historiques conservés : 182 / 182;
- nouveaux tests du Studio : 61 / 61;
- total : 243 / 243;
- tests du portail dans le navigateur : 226 / 226;
- tests du Worker inchangé : 17 / 17;
- erreurs JavaScript : 0.

## Couverture

Les tests couvrent les scénarios de référence long call, long put, short put, bull call spread, bear call spread et covered call; l’iron condor; les commissions; les quantités; les actions courtes; CRR et sa convergence; les Greeks; les cas limites; les 20 modèles; le graphique; le tableau CSV; la sauvegarde; l’import/export JSON; le partage nettoyé; la comparaison; le retrait des graphiques V1.3 et la compatibilité `priceHistory`.

## Commandes

```powershell
Get-ChildItem tests -Filter *.test.js | Sort-Object Name | ForEach-Object { node $_.FullName }
Set-Location worker-market-prices
node --test tests\worker.test.js
```

La page `tests/test-runner.html` affiche les 226 tests du portail dans un navigateur.
