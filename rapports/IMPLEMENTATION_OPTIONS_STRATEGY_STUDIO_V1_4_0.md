# Implantation — Options Strategy Studio V1.4.0

Date : 4 août 2026

## Résultat

Le Studio est une page statique locale intégrée au portail. Il ne dépend d’aucun CDN, compte, serveur, courtier ou service externe.

## Composants

- `options-studio.html` : interface, navigation et avertissement financier;
- `css/options-studio.css` : grille, thèmes et adaptations mobiles;
- `js/options-engine.js` : flux, P/L, CRR américain, Greeks, seuils et capital;
- `js/options-chart.js` : graphique SVG et tableau analytique;
- `js/options-storage.js` : espace `optionsStrategyStudio.v1`, JSON et partage;
- `js/options-studio.js` : interaction, modèles, jambes, comparaison et exports.

## Intégration

La fiche Ford ou SPY peut transmettre seulement le symbole, le nom public, le cours public déjà affiché et la devise. L’utilisateur ajoute lui-même toutes les jambes. Le Studio propose F, SPY, QQQ, IWM, TLT ou un symbole personnalisé.

## Décision priceHistory

La normalisation, l’exportation et la restauration de l’ancien champ `priceHistory` sont conservées. Son affichage et son alimentation ont été retirés. Aucune route historique, reconstruction ou donnée fictive n’a été créée.
