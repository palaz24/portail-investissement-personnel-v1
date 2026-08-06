# Vérification export-import JSON V1.4.3

Date : 6 août 2026

## Reproduction avant correction

- Action : clic réel sur **Exporter JSON** dans la version locale 1.4.2.
- Fichier obtenu : `F-strategie-options (2).json`.
- Taille : 15 octets.
- Contenu : `[object Object]`.
- Validation JSON : échec.

## Export après correction

- Action : création d’une stratégie Ford comportant une jambe, un nom avec caractères français et un cours exact de 14,137 $, puis clic réel sur **Exporter JSON**.
- Fichier obtenu : `options-strategy-F-2026-08-06.json`.
- Taille observée : 1 174 octets.
- SHA-256 observé : `EA22ED01C49FBD1CCC848C8F7F9FA9C3F9CC335D4324E025547A6829D8A5EBFC`.
- Premier caractère utile : `{`.
- Type MIME demandé au navigateur : `application/json`.
- Schéma : `options-strategy-studio`.
- Version : `1`.
- `exportedAt` : présent et conforme à ISO-8601.
- `strategy` : objet valide.
- Jambes : 1 / 1 conservée.
- Caractères français : conservés.
- Valeurs numériques : conservées comme nombres.
- Valeur `currentMark: null` : conservée.
- Notes privées : absentes.
- Appel réseau : aucun.

## Réimportation réelle

1. Le nom de la stratégie affichée a été remplacé temporairement par `État temporaire à remplacer`.
2. Le fichier exporté a été sélectionné avec le bouton **Importer JSON**.
3. La confirmation d’importation a été acceptée.
4. Le portail a restauré `Stratégie été Ford V1.4.3`, le symbole `F`, le cours exact `14.137` et la jambe unique.
5. Un fichier volontairement invalide a ensuite été tenté : l’import a été refusé et la stratégie courante est demeurée intacte.

## Fonctions connexes

- Sauvegarde locale : réussie.
- Partage URL : réussi et sans donnée privée.
- Export CSV réel : réussi, 13 lignes de données conservées.
- Graphique profit/perte : fonctionnel.
- Modèles Ford : fonctionnels.
- Aucune erreur JavaScript : confirmée.

## Conclusion

La boucle complète export, lecture, validation, import et restauration réussit. Le fichier exporté est un document JSON valide et réimportable; l’échec d’un import invalide ne remplace pas la stratégie courante.
