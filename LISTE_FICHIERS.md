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
- `data/demo-data.json` : exemples publics entièrement fictifs.
- `tests/calculations.test.js` : 34 tests automatisés.
- `tests/v1-1.test.js` : 21 tests supplémentaires du portail.
- `tests/v1-1-1.test.js` : 25 tests de correction sécurisée.
- `tests/v1-2.test.js` : 25 tests de garantie des puts vendus.
- `tests/v1-2-1.test.js` : 42 tests de tri, notes, couverture par put long et prix comptable.
- `tests/v1-3.test.js` : 18 tests de priceHistory, graphiques, interactions, thèmes et mobile.
- `tests/test-runner.html` : affichage des 226 tests du portail dans un navigateur.
- `worker-market-prices` : Worker Cloudflare et 17 tests de sécurité.
- `README.md` : instructions simples d’utilisation et de publication.
- `DOCUMENTATION_GRAPHIQUES_V1_3.md` : fonctionnement de priceHistory et des deux graphiques.
- `RAPPORT_FINAL.md` : rapport complet de livraison.

## Fichiers ajoutés en V1.4.0

- `options-studio.html` : page intégrée du Studio;
- `css/options-studio.css` : présentation responsive du Studio;
- `js/options-engine.js` : calculs financiers et modèle CRR américain;
- `js/options-chart.js` : graphique SVG et tableau analytique;
- `js/options-storage.js` : sauvegarde locale, JSON et partage;
- `js/options-studio.js` : interactions de la page;
- `tests/options-studio.test.js` : 61 tests reproductibles;
- `rapports/` : implantation, tests, audits, instructions et journal V1.4.0.

Le fichier V1.3.0 `js/security-charts.js` a été retiré avec les deux graphiques de la fiche du titre.
