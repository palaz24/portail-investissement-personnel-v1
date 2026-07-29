# Garanties des puts vendus — V1.2.0

## Formulaire

Le choix **Mode de garantie** apparaît uniquement pour une transaction :

- `type = OPTION_SELL_OPEN`;
- `optionType = PUT`.

L’utilisateur doit choisir l’un des deux modes :

- `FULLY_SECURED` — Put garanti à 100 %;
- `MARGIN_PARTIAL` — Put sur marge avec garantie partielle.

Aucun mode n’est présélectionné lors d’un nouvel ajout. Pour le mode sur marge, le montant réel affiché par Wealthsimple et sa date de vérification sont facultatifs. Si un montant réel est saisi, la date devient obligatoire.

## Calculs

### Put garanti à 100 %

```text
garantie = strike × 100 × contrats ouverts
```

La prime reçue demeure séparée dans les liquidités et les revenus d’options.

### Put sur marge

Si une garantie réelle valide est disponible :

```text
garantie = garantie réelle × contrats encore ouverts ÷ contrats ouverts à l’origine
```

Sinon :

```text
garantie estimée = strike × 100 × contrats ouverts × taux de marge du titre
```

Une estimation est toujours identifiée comme telle et n’est jamais présentée comme une donnée officielle de Wealthsimple.

### Fermeture, expiration et assignation

La garantie est calculée uniquement sur les contrats encore ouverts. Une fermeture partielle libère donc seulement la portion correspondante. Une expiration ou une fermeture complète la libère entièrement.

Lors d’une assignation d’un put vendu :

1. la garantie du put assigné est libérée;
2. les actions sont achetées au strike;
3. la garantie des actions est calculée selon le taux du titre;
4. la garantie du put et celle des actions ne sont jamais comptées simultanément pour les mêmes contrats.

## Sauvegardes et migration

Les sauvegardes V1.2.0 conservent :

- `putCollateralMode`;
- `actualMarginRequirement`;
- `marginRequirementCheckedAt`.

Pendant la restauration d’une ancienne sauvegarde :

- un `shortMarginRequirement` positif est migré vers `MARGIN_PARTIAL` et devient `actualMarginRequirement`;
- un put vendu sans montant existant devient `REVIEW_REQUIRED`;
- la restauration continue et présente le nombre de transactions à vérifier;
- aucun mode n’est inventé silencieusement.

## Alertes

Le portail signale :

- un mode de garantie manquant;
- un taux de marge manquant;
- une garantie réelle négative;
- une estimation utilisée à la place d’un montant réel invalide;
- une garantie réelle non vérifiée depuis plus de 30 jours;
- une marge disponible négative.
