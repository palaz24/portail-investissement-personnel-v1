# Service privé de prix automatiques

Ce Worker protège le secret `MARKETDATA_TOKEN` et expose uniquement `POST /quotes`.

Le portail lui transmet exclusivement :

- les symboles `F` et `SPY`;
- les symboles OCC des options ouvertes sur `F` ou `SPY`.

Il ne reçoit jamais les quantités, coûts moyens, transactions, soldes, marges, revenus, notes ou sauvegardes privées.

Adresse déployée : https://portail-investissement-market-prices.palazz24.workers.dev

## Configuration

```powershell
npx wrangler login
npx wrangler secret put MARKETDATA_TOKEN
npx wrangler deploy
```

Le jeton doit être collé uniquement dans l’invite sécurisée de Wrangler. Il ne doit jamais être écrit dans un fichier.

## Tests

```powershell
npm test
```

## Dépannage

- `Service non configuré` : le secret Cloudflare n’est pas installé.
- `Origine refusée` : utilisez le site GitHub Pages officiel ou `localhost` en développement.
- `Prix partiellement mis à jour` : certains contrats n’ont pas de bid, ask, mid ou last fiable; les anciens prix sont conservés.
- `Trop de requêtes` : attendez au moins une minute.
