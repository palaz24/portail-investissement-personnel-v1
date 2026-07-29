# Dépannage — prix automatiques V1.1

## Prix manuel conservé

Le Worker n’est pas configuré ou les prix automatiques sont désactivés. Ouvrez **Paramètres**, vérifiez l’URL du Worker et activez **Prix automatiques**.

## Service temporairement indisponible

Le portail n’efface aucun ancien prix. Attendez au moins cinq minutes, puis cliquez sur **Actualiser les prix**.

## Prix partiellement mis à jour

Market Data n’a pas fourni un bid, un ask, un mid ou un last fiable pour tous les contrats. Les prix valides sont enregistrés; les autres demeurent inchangés.

## Données retardées

La fraîcheur dépend du forfait Market Data. Consultez la date affichée près du prix. Le portail ne présente jamais une donnée comme temps réel sans confirmation explicite.

## Erreur d’origine

Le Worker accepte seulement `https://palaz24.github.io` et les adresses locales de développement. Il refuse les autres sites.

## Secret absent

Dans le dossier `worker-market-prices`, exécutez :

```powershell
npx wrangler secret put MARKETDATA_TOKEN
```

Collez le jeton uniquement dans l’invite sécurisée de Wrangler. Ne l’écrivez jamais dans un fichier.

## La saisie manuelle

Elle demeure disponible en tout temps dans **Mise à jour des prix**, même si le service automatique est désactivé.
