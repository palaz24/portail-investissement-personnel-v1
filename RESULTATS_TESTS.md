# Résultats des tests — Portail d’investissement personnel V1.2.0

Date de validation : 29 juillet 2026

## Résultat final

**122 tests réussis sur 122.**

- Anciens tests conservés : **97 / 97**
  - calculs historiques : **34 / 34**
  - portail V1.1 : **21 / 21**
  - corrections V1.1.1 : **25 / 25**
  - Cloudflare Worker : **17 / 17**
- Nouveaux tests V1.2.0 : **25 / 25**
- Tests du portail affichés dans le navigateur : **105 / 105**
- Erreurs JavaScript dans le navigateur : **0**

## Contrôles V1.2.0

- Choix obligatoire uniquement pour les puts vendus à l’ouverture.
- Put Ford garanti à 100 % : 1 400 $ pour un strike de 14 $.
- Put Ford sur marge à 30 % : 420 $.
- Garantie réelle Wealthsimple prioritaire sur l’estimation.
- Recalcul après modification du mode, du strike, des contrats ou du taux du titre.
- Libération complète ou partielle lors d’une fermeture.
- Libération lors de l’expiration et de l’assignation.
- Garantie des actions appliquée après assignation, sans double comptabilisation.
- Suppression et annulation cohérentes.
- Sauvegarde, restauration et migration des anciennes transactions.
- Garantie totale ventilée et exacte.

## Validation dans le navigateur

- Aucun choix affiché pour un call vendu.
- Deux choix sans présélection affichés pour un put vendu.
- Enregistrement refusé sans mode.
- Estimation Ford affichée à 420 $.
- Garantie réelle affichée à 435 $ et identifiée comme Wealthsimple.
- Nouvelles colonnes visibles dans la fiche Ford.
- Page de tests : **105 / 105**.
- Erreurs JavaScript : **0**.
