# Liste des fichiers créés

```text
Portail_Investissement_Personnel_V1/
├── .gitignore
├── .nojekyll
├── index.html
├── README.md
├── RAPPORT_FINAL.md
├── RESULTATS_TESTS.md
├── LISTE_FICHIERS.md
├── DOCUMENTATION_GARANTIES_PUTS_V1_2.md
├── css/
│   └── style.css
├── data/
│   └── demo-data.json
├── js/
│   ├── app.js
│   ├── backup.js
│   ├── calculations.js
│   ├── collateral.js
│   ├── forms.js
│   ├── history-utils.js
│   ├── market-data.js
│   ├── storage.js
│   └── transaction-corrections.js
└── tests/
    ├── calculations.test.js
    ├── v1-1.test.js
    ├── v1-1-1.test.js
    ├── v1-2.test.js
    ├── v1-2-1.test.js
    └── test-runner.html
├── DEPANNAGE_PRIX_AUTOMATIQUES.md
└── worker-market-prices/
    ├── src/index.js
    ├── tests/worker.test.js
    ├── package.json
    ├── wrangler.jsonc
    └── README_PRIX_AUTOMATIQUES.md
```

## Rôle des principaux fichiers

- `index.html` : structure complète du portail.
- `css/style.css` : design sombre, responsive et accessible.
- `js/app.js` : navigation et affichage.
- `js/calculations.js` : calculs financiers.
- `js/collateral.js` : modes de garantie, calculs proportionnels et migration.
- `js/forms.js` : validations et règles de saisie.
- `js/storage.js` : stockage local et données fictives.
- `js/transaction-corrections.js` : corrections atomiques, annulation et intégrité chronologique.
- `js/backup.js` : exportation et restauration JSON.
- `js/history-utils.js` : tri des historiques et des échéances.
- `js/market-data.js` : symboles OCC, requêtes minimales et application sécurisée des prix.
- `js/security-charts.js` : modèles et rendus des graphiques de cours, strikes et distances.
- `data/demo-data.json` : exemples publics entièrement fictifs.
- `tests/calculations.test.js` : 34 tests automatisés.
- `tests/v1-1.test.js` : 21 tests supplémentaires du portail.
- `tests/v1-1-1.test.js` : 25 tests de correction sécurisée.
- `tests/v1-2.test.js` : 25 tests de garantie des puts vendus.
- `tests/v1-2-1.test.js` : 42 tests de tri, notes, couverture par put long et prix comptable.
- `tests/v1-3.test.js` : 18 tests de priceHistory, graphiques, interactions, thèmes et mobile.
- `tests/test-runner.html` : affichage des 165 tests du portail dans un navigateur.
- `worker-market-prices` : Worker Cloudflare et 17 tests de sécurité.
- `README.md` : instructions simples d’utilisation et de publication.
- `DOCUMENTATION_GRAPHIQUES_V1_3.md` : fonctionnement de priceHistory et des deux graphiques.
- `RAPPORT_FINAL.md` : rapport complet de livraison.
