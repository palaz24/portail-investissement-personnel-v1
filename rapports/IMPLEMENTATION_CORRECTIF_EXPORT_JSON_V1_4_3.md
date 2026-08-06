# Implémentation du correctif Export JSON V1.4.3

Date : 6 août 2026

## Point de départ

- Version officielle : 1.4.2
- Branche de départ : `main`
- Commit officiel : `603a2804254399cd93d4e6bfde83eaa6e87aab19`
- Tests de référence : 308 / 308

## Cause exacte

`OptionsStrategyStorage.exportDocument(strategy)` retourne volontairement un objet JavaScript. Le gestionnaire du bouton transmettait directement cet objet à `Blob`. La conversion implicite de l’objet produisait donc le texte `[object Object]` au lieu d’un document JSON.

Le défaut a été reproduit avec le bouton réel avant la correction : le fichier téléchargé faisait 15 octets, contenait exactement `[object Object]` et ne pouvait pas être lu par `JSON.parse`.

## Correction ciblée

- Sérialisation explicite avec `JSON.stringify(document, null, 2)`.
- Création d’un artefact d’export unique comprenant le contenu, le nom du fichier et le type MIME.
- Nom de fichier daté : `options-strategy-F-2026-08-06.json`.
- Nettoyage des caractères interdits dans le symbole utilisé par le nom de fichier.
- Type MIME exact : `application/json`.
- Téléchargement avec `Blob`, `URL.createObjectURL`, un lien temporaire, puis `URL.revokeObjectURL` après le déclenchement.
- Aucun appel réseau ajouté.
- Retrait des notes privées du document exporté; les champs inconnus comme les comptes, identifiants et secrets sont éliminés par la normalisation existante.
- Conservation des prix facultatifs, y compris la valeur `null`, ainsi que des hypothèses et des jambes publiques nécessaires à la stratégie.

## Portée des fichiers

- `js/options-storage.js` : préparation et sérialisation sécuritaire de l’artefact JSON.
- `js/options-studio.js` : téléchargement fiable de l’artefact sérialisé.
- `options-studio.html` et `index.html` : identification locale V1.4.3.
- `tests/test-runner.html` et `tests/v1-4-3.test.js` : ajout des contrôles V1.4.3.
- Trois rapports V1.4.3.

Le moteur financier, les Greeks, le graphique profit/perte, le pas Ford, le tableau de dix lignes, le tri, le Worker et les données du portail n’ont pas été modifiés.

## Résultat

Le correctif local V1.4.3 est limité à l’export JSON et à sa validation. Il n’est ni fusionné dans `main`, ni étiqueté, ni publié.
