# Résultats des tests — Portail d’investissement personnel V1.1.1

Date de validation : 28 juillet 2026

## Résultat final

**97 tests réussis sur 97.**

- Anciens tests conservés : **72 / 72**
  - calculs historiques : **34 / 34**
  - portail V1.1 : **21 / 21**
  - Cloudflare Worker : **17 / 17**
- Nouveaux tests V1.1.1 : **25 / 25**
- Tests du portail affichés dans le navigateur : **80 / 80**
- Erreurs JavaScript dans le navigateur : **0**

## Nouveaux contrôles V1.1.1

- Modification d’un dépôt, d’un achat, d’une vente, d’un dividende et d’une prime d’option.
- Recalcul du coût moyen, des positions, des liquidités et des profits/pertes.
- Conservation de l’identifiant et de la date de création; ajout d’une date de mise à jour.
- Mise à jour groupée de l’identité d’un contrat, de ses opérations liées et de son prix.
- Suppression simple et suppression groupée d’un contrat avec ses dépendances.
- Réouverture correcte d’une position lorsqu’une fermeture est supprimée.
- Refus des corrections qui rendent l’historique chronologiquement invalide.
- Détection des vrais doublons sans confondre la transaction en cours de modification.
- Annulation immédiate de la dernière modification ou suppression.
- Restauration automatique si l’écriture locale échoue.
- Tri stable, boutons mobiles de 42 pixels et commandes accessibles au clavier.

## Validation réelle dans le navigateur

- Modification d’une opération sans créer de doublon.
- Suppression avec confirmation, puis restauration par le bouton d’annulation.
- Affichage mobile vérifié à **390 × 844 pixels**, sans débordement horizontal.
- Boutons **Modifier** et **Supprimer** empilés et mesurés à **42 pixels** de hauteur.
- Prix automatiques F, SPY et option obtenus par le Worker existant.
- Page de tests : **80 / 80**.
- Erreurs JavaScript : **0**.