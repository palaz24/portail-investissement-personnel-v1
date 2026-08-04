# Rapport final — Portail d’investissement personnel V1.4.1

## Correctifs V1.4.1 — scénarios Ford et tableau détaillé

La V1.4.1 impose un pas exact de 0,50 $ uniquement aux prix de scénarios Ford générés pour le graphique, le tableau complet et le CSV. Le cours réel demeure une ligne exacte indépendante; les strikes, primes, commissions, transactions, seuils de rentabilité et résultats financiers ne sont jamais arrondis par ce correctif.

Le tableau visible « Analyse détaillée — Tableau des résultats » présente au plus 10 points représentatifs, incluant les bornes, le voisinage du cours actuel et celui des seuils lorsque possible. Le moteur conserve tous les points et le CSV exporte toujours l’analyse complète. Les 243 tests antérieurs et les 35 nouveaux tests réussissent, pour un total de 278 sur 278. Le Worker demeure inchangé.

## Évolution V1.4.0 — Options Strategy Studio

La V1.4.0 ajoute une page locale distincte pour construire, valoriser, comparer, sauvegarder et partager des hypothèses de stratégies d’options. Le moteur utilise un arbre binomial américain Cox–Ross–Rubinstein avec exercice anticipé, dividende et 50 à 500 pas. Les résultats à l’échéance sont exacts selon les flux saisis; les valeurs avant échéance, les Greeks et les structures multiéchéances sont clairement présentées comme estimatives.

Les anciens graphiques de cours et de distance ont été retirés de la fiche du titre. La compatibilité de lecture de `priceHistory` est préservée, sans nouvel ajout de points. Le Worker et sa configuration sont inchangés.

La validation locale totalise 243 tests réussis sur 243, dont 182 tests existants et 61 nouveaux tests du Studio.

## Évolution V1.3.0 — cours, strikes et historique local

La fiche du titre remplace l’affichage simplifié du risque par deux graphiques. Le premier combine les cotations réelles conservées localement, le prix actuel et les strikes actifs. Le second compare chaque strike au cours actuel en dollars et en pourcentage, sans présenter cette distance comme une mesure de risque.

La collection privée `priceHistory` est alimentée uniquement après une réponse Market Data réussie. Elle ne contient aucun prix manuel, fictif, estimé ou reconstruit. Un seul point est conservé par symbole et période de 15 minutes, jusqu’à un maximum de 5 000 points par titre. Les anciennes sauvegardes sont migrées vers une collection vide et les nouvelles sauvegardes incluent les points réels disponibles.

Les données, alertes et calculs internes de risque demeurent intacts même si la section visible « Risque » a été retirée de la fiche.

## Correctif V1.2.2 — prix comptable des options ouvertes

La V1.2.2 présente le prix comptable net de chaque jambe d’option ouverte, distinctement du prix actuel et du P/L non réalisé. Le calcul utilise la valeur comptable restante, les contrats encore ouverts et le multiplicateur de 100; il tient donc compte des frais et des fermetures partielles.

Les colonnes « Réelle ou estimée » et « Date de vérification » sont retirées uniquement du tableau. Les données de garantie demeurent disponibles dans les transactions, les sauvegardes, le formulaire, les alertes et les calculs.

## Correctifs V1.2.1 — options, notes et couverture

La V1.2.1 classe toutes les listes complètes d’options ouvertes sans modifier l’historique des transactions. Les échéances futures viennent d’abord; les positions échues non régularisées sont ensuite identifiées par une pastille claire.

Les longues notes sont maintenant limitées dans les tableaux sur ordinateur et mobile. Leur contenu complet demeure accessible dans une fenêtre qui protège le texte avec `escapeHtml` et se ferme au bouton, avec Échap ou par un clic à l’extérieur.

Le troisième mode `COVERED_BY_LONG_PUT` réserve un put long admissible. Un registre calculé empêche toute double allocation. Le portail reconnaît les spreads verticaux, calendriers et diagonaux, applique la formule exacte du risque défini aux verticaux créditeurs et donne priorité à la garantie réelle Wealthsimple pour les autres structures. Une valeur conservatrice nulle ou négative exige une révision.

Les fermetures partielles libèrent la quantité correspondante. Une assignation libère la couverture, conserve le put long, crée les actions et applique uniquement leur garantie. Les sauvegardes V1.2.0 demeurent compatibles et leurs anciens modes ne sont pas modifiés.

## Évolution V1.2.0 — garanties des puts vendus

La V1.2.0 ajoute un choix obligatoire entre un put garanti à 100 % et un put sur marge. Le portail sépare les garanties des actions, des puts garantis à 100 %, des puts sur marge et des autres options courtes.

Les fermetures partielles, expirations et assignations libèrent la garantie au prorata des contrats réellement fermés. Lors d’une assignation, la garantie du put disparaît avant l’application de la garantie des actions, ce qui empêche toute double comptabilisation.

Une garantie réelle Wealthsimple peut être enregistrée avec sa date de vérification. Sans montant réel valide, le portail utilise une estimation clairement identifiée fondée sur le taux du titre. Les anciennes sauvegardes sont migrées et les transactions ambiguës deviennent `REVIEW_REQUIRED`.

Le détail fonctionnel se trouve dans `DOCUMENTATION_GARANTIES_PUTS_V1_2.md`.

## Correction V1.1.1

La V1.1.1 permet de modifier et de supprimer une transaction de façon sécurisée. Elle ajoute une annulation immédiate, protège les relations entre l’ouverture et la fermeture des options, recalcule tout l’historique et refuse une correction qui créerait une incohérence chronologique. Le Worker de prix n’a pas été modifié ni redéployé.

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

Le portail demeure un site statique. Il communique seulement avec le Worker sécurisé pour obtenir des prix de marché; il ne communique avec aucun courtier et n’envoie aucune transaction, position ou valeur de compte. Les données réelles restent dans le navigateur de l’utilisateur.

## Architecture réalisée

Le projet utilise uniquement :

- HTML5;
- CSS3;
- JavaScript moderne;
- `localStorage`;
- JSON pour les sauvegardes;
- fichiers statiques compatibles avec GitHub Pages.

La logique est séparée en modules spécialisés :

1. `app.js` — interface, navigation et rendu;
2. `calculations.js` — calculs financiers;
3. `collateral.js` — modes de garantie, calculs et migration;
4. `forms.js` — validation des formulaires;
5. `storage.js` — stockage local;
6. `backup.js` — sauvegarde et restauration.

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
- les modules JavaScript spécialisés;
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
- Modification et suppression sécurisées des opérations.
- Annulation immédiate de la dernière correction.
- Correction groupée des contrats d’options et de leurs opérations liées.
- Validation chronologique complète avant chaque correction.
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

Les suites historiques et correctives demeurent réussies. Le portail possède maintenant 226 contrôles dans le navigateur et le Worker conserve ses 17 contrôles séparés.

Résultats :

- tests existants V1.3.0 : **182 / 182**;
- nouveaux tests V1.4.0 : **61 / 61**;
- total : **243 / 243**;
- portail dans le navigateur : **226 / 226**;
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
- Les calendriers et diagonales peuvent exiger une garantie réelle Wealthsimple, car l’estimation du portail n’est pas l’exigence officielle du courtier.
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

Le Portail d’investissement personnel V1.4.0 demeure une interface statique compatible avec GitHub Pages. Il protège les données privées, conserve le Worker de prix inchangé et réussit 243 tests sur 243. La branche locale est prête pour une validation avant toute fusion ou publication.
