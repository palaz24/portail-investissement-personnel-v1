# Résultats des tests V1.4.3

Date : 6 août 2026

## Résumé

- Tests existants avant correction : **308 / 308**.
- Tests existants après correction : **308 / 308**.
- Nouveaux tests V1.4.3 : **25 / 25**.
- Total incluant le Worker : **333 / 333**.
- Tests du portail dans le navigateur : **316 / 316**.
- Tests du Worker inchangé : **17 / 17**.
- Erreurs JavaScript dans le navigateur : **0**.

## Couverture des 25 nouveaux tests

Les contrôles couvrent le bouton Exporter JSON, l’absence de `[object Object]`, `JSON.parse`, le schéma, la version, `exportedAt`, l’objet stratégie, les jambes, les hypothèses, les types numériques, les valeurs nulles, les caractères français, l’extension, le type MIME, le nettoyage du nom, la boucle export-import, l’absence de données privées, l’export CSV, le partage URL, la sauvegarde locale, l’absence d’appel réseau, la syntaxe JavaScript, les modes clair et sombre et le format mobile 390 × 844.

## Validation réelle

- Ordinateur 1366 × 900 : conforme, aucun débordement.
- Mobile 390 × 844 : conforme, aucun débordement de page; le tableau conserve son défilement horizontal interne.
- Mode clair : conforme.
- Mode sombre : conforme.
- Graphique profit/perte : deux courbes présentes.
- Tableau visible : dix lignes.
- Export CSV réel : 13 lignes de données, donc analyse complète non limitée aux dix lignes visibles.

## Conclusion

Tous les contrôles automatisés et manuels locaux réussissent. Aucun test n’a été ignoré.
