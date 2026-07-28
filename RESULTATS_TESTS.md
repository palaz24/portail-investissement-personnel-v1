# Résultats des tests — Portail d’investissement personnel V1

Date de validation : 28 juillet 2026

## Résultat final

**34 tests réussis sur 34.**

- Tests exécutés avec le moteur JavaScript : **34 / 34**
- Tests exécutés dans le navigateur : **34 / 34**
- Erreurs JavaScript dans le navigateur : **0**

## Calculs et règles vérifiés

| No | Contrôle | Résultat attendu | Résultat |
|---:|---|---|---|
| 1 | Achat d’actions | 100 actions à 10 $ = valeur comptable de 1 000 $ | Réussi |
| 2 | Coût moyen pondéré | Deux achats à 10 $ et 20 $ = coût moyen de 15 $ | Réussi |
| 3 | Vente partielle | Le coût moyen restant demeure 10 $ | Réussi |
| 4 | Option courte profitable | 100 $ reçus − 40 $ de rachat = 60 $ | Réussi |
| 5 | Option courte déficitaire | 50 $ reçus − 120 $ de rachat = −70 $ | Réussi |
| 6 | Option longue profitable | 100 $ reçus − 50 $ payés = 50 $ | Réussi |
| 7 | Expiration option courte | Prime de 50 $ entièrement réalisée | Réussi |
| 8 | Expiration option longue | Prime de 50 $ entièrement perdue | Réussi |
| 9 | Assignation PUT | 1 contrat crée 100 actions | Réussi |
| 10 | Assignation CALL | 100 actions sont vendues | Réussi |
| 11 | Dividende net | 15 $ − 2,25 $ = 12,75 $ | Réussi |
| 12 | Dépôt et retrait | 3 000 $ − 500 $ = 2 500 $ | Réussi |
| 13 | Intérêt sur marge | 10 $ réduit le P/L réalisé de 10 $ | Réussi |
| 14 | Garantie Ford | 30 % de 1 000 $ = 300 $ | Réussi |
| 15 | Marge utilisée | Liquidités −100 $ = marge utilisée 100 $ | Réussi |
| 16 | Marge disponible | Équité 1 000 $ − garantie 300 $ = 700 $ | Réussi |
| 17 | P/L réalisé | 50 actions × profit de 2 $ = 100 $ | Réussi |
| 18 | P/L non réalisé | 100 actions × gain latent de 2 $ = 200 $ | Réussi |
| 19 | P/L économique | 100 $ réalisé + 100 $ latent = 200 $ | Réussi |
| 20 | Valeur totale | 500 $ liquidités + 500 $ actions = 1 000 $ | Réussi |
| 21 | Exportation JSON | Toutes les transactions sont conservées | Réussi |
| 22 | Restauration JSON | Une sauvegarde compatible est acceptée | Réussi |
| 23 | Doublon exact | Une transaction identique est refusée | Réussi |
| 24 | Données manquantes | Un achat sans symbole est refusé | Réussi |
| 25 | Affichage mobile | Règles responsive et tableaux défilables présents | Réussi |
| 26 | Division par zéro | Rendement sans dépôt = 0 % | Réussi |
| 27 | Consolidation par titre | Une seule fiche Ford | Réussi |
| 28 | Absence de séparation | Aucun champ de méthode d’investissement | Réussi |
| 29 | Assignation CALL invalide | Refus si les actions sont insuffisantes | Réussi |
| 30 | Fermeture invalide | Refus d’un contrat inexistant | Réussi |
| 31 | Sauvegarde incompatible | Version majeure incorrecte refusée | Réussi |
| 32 | Valeur fictive de démonstration | 3 172,75 $ | Réussi |
| 33 | P/L fictif de démonstration | 172,75 $ | Réussi |
| 34 | Garantie fictive totale | 793,50 $ | Réussi |

## Vérifications réelles dans le navigateur

- Tableau de bord chargé avec 12 indicateurs.
- Ford et SPY affichés dans un seul tableau consolidé.
- Même fiche générique utilisée pour Ford et SPY.
- Formulaire d’opération ouvert et utilisé avec succès.
- Donnée d’essai conservée après rechargement de la page.
- Navigation mobile fonctionnelle.
- Aucun débordement horizontal de la page à 390 × 844 pixels.
- Tableaux configurés pour défiler horizontalement sur petit écran.
- Site chargé correctement dans le sous-répertoire simulé `/portail-investissement/`.
- Aucun avertissement ni erreur JavaScript détecté.
