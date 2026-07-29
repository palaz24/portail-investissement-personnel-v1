# Rapport final — Portail d’investissement personnel V1.1

## Mise à niveau V1.1

La V1.1 ajoute :

- un Cloudflare Worker séparé qui protège `MARKETDATA_TOKEN`;
- la récupération de F, SPY et des symboles OCC des options ouvertes;
- une cache minimale de 15 minutes et une limitation raisonnable des requêtes;
- une actualisation à l’ouverture, puis toutes les 60 minutes lorsque l’onglet est visible;
- un délai minimal de cinq minutes entre deux actualisations manuelles;
- la conservation des anciens prix lorsqu’aucune donnée fiable n’est disponible;
- le tri décroissant de tous les historiques visibles;
- le tri croissant des prochaines échéances;
- des indicateurs de source, d’heure et d’état;
- une saisie manuelle de secours.

Le Worker ne reçoit aucune quantité, transaction, valeur de portefeuille, marge, note, sauvegarde ou identité.

## Objectif du projet

Créer un portail personnel, simple et moderne pour suivre manuellement un petit portefeuille d’environ 3 000 $ US.

Le portail est entièrement statique. Il ne communique avec aucun serveur, aucune API, aucune base de données externe et aucun courtier. Les données réelles restent dans le navigateur de l’utilisateur.

## Architecture réalisée

Le projet utilise uniquement :

- HTML5;
- CSS3;
- JavaScript moderne;
- `localStorage`;
- JSON pour les sauvegardes;
- fichiers statiques compatibles avec GitHub Pages.

La logique est séparée en cinq modules :

1. `app.js` — interface, navigation et rendu;
2. `calculations.js` — calculs financiers;
3. `forms.js` — validation des formulaires;
4. `storage.js` — stockage local;
5. `backup.js` — sauvegarde et restauration.

Une seule fiche générique est alimentée dynamiquement selon le symbole sélectionné. Ford, SPY et les futurs titres utilisent exactement la même structure.

## Éléments réutilisés du projet Ford précédent

Les éléments suivants ont servi d’inspiration générale :

- la palette sombre professionnelle;
- la navigation latérale sur ordinateur;
- le menu compact sur mobile;
- les cartes d’indicateurs;
- les tableaux financiers défilables;
- le principe de stockage local;
- le principe d’exportation et de restauration JSON;
- les messages en français clair.

Aucun fichier existant n’a été modifié. Aucun calcul, aucune transaction et aucune donnée réelle de Ford Options Studio n’ont été copiés dans ce portail.

## Fichiers créés

La liste complète se trouve dans `LISTE_FICHIERS.md`.

Les principaux livrables sont :

- `index.html`;
- `css/style.css`;
- les cinq modules JavaScript;
- `data/demo-data.json`;
- les tests;
- `README.md`;
- `RESULTATS_TESTS.md`;
- le présent rapport.

L’archive finale se nomme `Portail_Investissement_Personnel_V1.zip`. Elle contient les 15 fichiers du projet. Elle a été extraite dans un dossier temporaire, puis les 34 tests ont été exécutés de nouveau avec succès à partir de son contenu.

## Fonctionnalités terminées

- Tableau de bord global avec 12 indicateurs.
- Une seule ligne consolidée par symbole.
- Répartition du capital par titre.
- Alertes de prix, de marge et d’échéance.
- Prochaines échéances.
- Fiche générique pour Ford, SPY et les futurs titres.
- Ajout et modification des titres.
- Saisie manuelle de 15 types d’opérations.
- Mise à jour manuelle des prix des actions, FNB et options.
- Assignations PUT et CALL avec confirmation.
- Stockage automatique après chaque modification.
- Données persistantes après rechargement.
- Exportation JSON.
- Validation et restauration JSON.
- Sauvegarde de secours automatique avant restauration.
- Double confirmation avant effacement complet.
- Données fictives de démonstration.
- Bouton pour commencer avec un portefeuille vide.
- Mise en page responsive.
- Navigation au clavier.
- Messages d’erreur en français.

## Calculs implantés

- Capital net déposé.
- Liquidités.
- Coût moyen pondéré des actions.
- P/L réalisé des actions.
- P/L non réalisé des actions.
- Flux des options avec multiplicateur de 100.
- P/L des options longues et courtes.
- Expiration des options.
- Assignation des options vendues.
- Exercice des options achetées.
- Dividendes nets.
- Intérêts reçus.
- Intérêts sur marge.
- P/L réalisé total.
- P/L non réalisé total.
- P/L économique.
- Valeur totale du portefeuille.
- Rendement global avec protection contre la division par zéro.
- Garantie par titre.
- Exigence manuelle des options courtes.
- Marge utilisée.
- Marge disponible.

## Tests exécutés

Les 34 tests historiques possèdent chacun un résultat attendu explicite et demeurent réussis. La V1.1 ajoute 21 tests du portail et 17 tests du Worker, pour 72 contrôles automatisés au total.

Résultats :

- moteur JavaScript : **34 / 34**;
- navigateur : **34 / 34**;
- erreurs JavaScript : **0**.

Les détails sont dans `RESULTATS_TESTS.md`.

## Validations visuelles et fonctionnelles

Le portail a été ouvert réellement dans un navigateur.

Vérifications réussies :

- tableau de bord sur ordinateur;
- fiche Ford;
- fiche SPY avec la même page;
- formulaire d’ajout;
- persistance après rechargement;
- affichage mobile à 390 × 844 pixels;
- ouverture du menu mobile;
- absence de débordement horizontal;
- fonctionnement dans un sous-répertoire simulant GitHub Pages;
- tests affichés dans le navigateur.

## Procédure de sauvegarde

1. Ouvrir **Sauvegarde**.
2. Cliquer sur **Exporter une sauvegarde**.
3. Conserver le fichier JSON dans un dossier privé.
4. Ne jamais téléverser ce fichier sur GitHub.

Avant une restauration, le portail :

1. lit le JSON;
2. vérifie sa version;
3. vérifie sa structure;
4. vérifie les identifiants;
5. télécharge une sauvegarde de secours;
6. demande une confirmation;
7. remplace les données uniquement si la validation réussit.

## Procédure GitHub Pages

Le projet est prêt pour une publication depuis la branche `main` et le dossier `/(root)`.

Tous les chemins sont relatifs. Le site fonctionne avec une adresse du type :

`https://palaz24.github.io/portail-investissement-personnel-v1/`

Les instructions détaillées pour un débutant sont dans `README.md`.

## Protection des données

La vérification finale confirme :

- aucune donnée financière personnelle dans le projet;
- aucun numéro de compte;
- aucun export Wealthsimple;
- aucune transaction réelle;
- aucune clé API;
- aucun secret;
- aucune dépendance distante;
- aucune transmission vers Internet;
- seulement des données fictives clairement identifiées.

La clé principale du navigateur est :

`portailInvestissementV1`

## Limites connues

- Les données gratuites Market Data peuvent être retardées.
- Les prix automatiques exigent un Worker Cloudflare configuré et le secret Market Data.
- La saisie manuelle demeure le mode de secours.
- Le stockage local est propre à chaque navigateur et appareil.
- Les sauvegardes JSON ne sont pas chiffrées.
- Les options courtes utilisent une exigence de marge manuelle.
- La V1 ne convertit pas automatiquement les devises.
- La V1 ne gère pas automatiquement les fractionnements ou fusions de titres.
- La V1 n’importe pas les CSV Wealthsimple.
- La publication réelle sur GitHub Pages doit être effectuée dans le compte GitHub de l’utilisateur.

## Prochaines améliorations possibles

- Importateur Wealthsimple avec prévisualisation et détection des doublons.
- Historique graphique de la valeur du portefeuille.
- Conversion manuelle ou facultative des devises.
- Journal d’annulation du dernier lot importé.
- Exportation d’un rapport annuel.
- Tests additionnels pour les opérations complexes à plusieurs contrats.

## Conclusion

Le Portail d’investissement personnel V1.1 conserve une interface statique compatible avec GitHub Pages, ajoute un Worker sécurisé pour les prix, protège les données privées et est livré avec 34 tests historiques et 38 nouveaux tests réussis.
