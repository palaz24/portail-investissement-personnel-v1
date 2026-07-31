# Résultats des tests — Portail d’investissement personnel V1.3.0

Date de validation : 30 juillet 2026

## Résultat final

**182 tests réussis sur 182.**

- Tests précédents conservés : **164 / 164**
  - calculs historiques : **34 / 34**
  - portail V1.1 : **21 / 21**
  - corrections V1.1.1 : **25 / 25**
  - garanties V1.2.0 : **25 / 25**
  - premiers correctifs V1.2.1 : **34 / 34**
  - Cloudflare Worker inchangé : **17 / 17**
- Nouveaux tests V1.3.0 : **18 / 18**
- Tests du portail affichés dans le navigateur : **165 / 165**
- Erreurs JavaScript dans le navigateur : **0**

## Contrôles V1.3.0

- Retrait visuel de la section Risque et conservation des calculs internes.
- Enregistrement privé des seules cotations Market Data réelles.
- Déduplication par période de 15 minutes et limite de 5 000 points.
- Compatibilité, exportation et restauration de `priceHistory`.
- Affichage du cours actuel, des strikes actifs et du message d’historique initial.
- Calcul exact des distances en dollars et en pourcentage.
- Synchronisation de la sélection entre les deux graphiques.
- Modes clair et sombre et affichage mobile sans débordement.

## Contrôles V1.2.2 conservés

- Tri pur et non destructif des options futures et échues.
- Ordre secondaire par PUT, CALL, strike et identifiant de contrat.
- Notes courtes directes et notes longues abrégées sur ordinateur et mobile.
- Fenêtre complète accessible, refermable avec Échap et protégée contre le HTML.
- Troisième mode de garantie réservé aux puts vendus.
- Sélection obligatoire d’un put long admissible du même symbole.
- Refus des calls, mauvaises échéances et doubles allocations.
- Détection des spreads verticaux, calendriers et diagonaux.
- Calcul vertical exact de 175 $ pour l’exemple de référence.
- Priorité à la garantie réelle Wealthsimple.
- Libération proportionnelle après fermeture, expiration, assignation ou suppression.
- Blocage d’une opération qui laisserait un put vendu sans couverture.
- Assignation sans double comptabilisation et conservation du put long.
- Sauvegarde, restauration, modification et annulation des liens de couverture.
- Prix comptable net distinct pour chaque option longue et courte.
- Frais et valeur restante après fermeture partielle inclus dans le prix comptable.
- Colonnes de vérification retirées uniquement du tableau, sans retrait des données.

## Confidentialité et isolation

- Worker Cloudflare : aucun fichier modifié.
- Secret `MARKETDATA_TOKEN` : jamais lu, affiché ou publié.
- Données privées : aucune détectée dans les changements.
- Projet Ford parent : aucun fichier suivi modifié.
