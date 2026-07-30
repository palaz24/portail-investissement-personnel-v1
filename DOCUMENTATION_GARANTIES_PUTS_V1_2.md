# Garanties des puts vendus et options ouvertes — V1.2.2

## Formulaire

Le choix **Mode de garantie** apparaît uniquement pour une transaction :

- `type = OPTION_SELL_OPEN`;
- `optionType = PUT`.

L’utilisateur doit choisir l’un des trois modes :

- `FULLY_SECURED` — Put garanti à 100 %;
- `MARGIN_PARTIAL` — Put sur marge avec garantie partielle.
- `COVERED_BY_LONG_PUT` — Put couvert par une option achetée.

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

### Put couvert par une option achetée

Le put long doit être ouvert, du même symbole, de type PUT et expirer à la même date ou après le put vendu. Le portail conserve les champs `coveringContractId`, `coveredContracts` et `coverageType`.

Chaque put long possède trois quantités calculées :

- `longPutContractsOpen`;
- `longPutContractsAllocated`;
- `longPutContractsAvailable`.

La quantité allouée ne peut jamais dépasser la quantité ouverte. La V1.2.1 exige une couverture complète de chaque transaction; une portion non couverte doit être enregistrée séparément avec un autre mode de garantie.

Une même échéance avec des strikes différents forme un spread vertical. Un strike identique avec une échéance longue postérieure forme un calendrier. Des strikes et des échéances différents forment un diagonal.

Pour un vertical put créditeur :

```text
garantie = max(0, (strike vendu − strike acheté) × 100 × contrats
  − (prime vendue − prime achetée) × 100 × contrats)
```

Pour un calendrier ou un diagonal, une garantie Wealthsimple réelle a priorité. Sans celle-ci, le portail affiche une estimation conservatrice clairement marquée **Estimée — à vérifier**. Si cette estimation est nulle ou négative, le dossier devient `REVIEW_REQUIRED` et la garantie réelle ainsi que sa date sont obligatoires.

### Fermeture, expiration et assignation

La garantie est calculée uniquement sur les contrats encore ouverts. Une fermeture partielle libère donc seulement la portion correspondante. Une expiration ou une fermeture complète la libère entièrement.

Lors d’une assignation d’un put vendu :

1. la garantie du put assigné est libérée;
2. les actions sont achetées au strike;
3. la garantie des actions est calculée selon le taux du titre;
4. la garantie du put et celle des actions ne sont jamais comptées simultanément pour les mêmes contrats.

Le put long demeure une position distincte après l’assignation. Sa quantité allouée est libérée et une alerte rappelle qu’il reste ouvert.

La fermeture, l’expiration, l’exercice ou la suppression d’un put long sont refusés s’ils laisseraient un put vendu sans couverture. Le message indique les contrats liés qui doivent d’abord être fermés ou recevoir un autre mode de garantie.

## Sauvegardes et migration

Les sauvegardes V1.2.1 conservent :

- `putCollateralMode`;
- `actualMarginRequirement`;
- `marginRequirementCheckedAt`.
- `coveringContractId`;
- `coveredContracts`;
- `coverageType`.

Une sauvegarde V1.2.0 demeure compatible. Les modes `FULLY_SECURED` et `MARGIN_PARTIAL` ne sont jamais changés automatiquement.

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
- une surallocation d’un put long;
- un lien de couverture absent ou invalide;
- une estimation de calendrier ou de diagonal qui exige la garantie réelle.

## Tableau des options ouvertes

Le tableau présente séparément le **Prix comptable**, le **Prix actuel** et le **P/L non réalisé** de chaque jambe. Le prix comptable correspond à la valeur comptable restante divisée par les contrats encore ouverts et par le multiplicateur de 100. Il inclut donc les frais et demeure exact après une fermeture partielle.

Les colonnes « Réelle ou estimée » et « Date de vérification » ne sont plus affichées dans ce tableau afin de le simplifier. Les champs `actualMarginRequirement` et `marginRequirementCheckedAt` demeurent toutefois intacts dans les transactions, les sauvegardes, le formulaire de modification, les alertes et les calculs.
