# Portail d’investissement personnel V1.3.0

## Nouveautés V1.3.0

La fiche du titre présente maintenant deux graphiques complémentaires :

- **Cours du titre et strikes actifs** : courbe des cotations réelles conservées localement, prix actuel et lignes des strikes actifs;
- **Distance entre le cours et les strikes** : comparaison neutre en dollars et en pourcentage, sans interprétation du risque.

L’historique `priceHistory` se construit progressivement à partir des cotations Market Data réellement reçues. Il demeure dans le navigateur, évite les doublons dans une même période de 15 minutes et conserve au maximum 5 000 points par titre. Les anciennes sauvegardes restent compatibles et les nouvelles sauvegardes incluent cet historique privé.

Ce site permet de suivre un petit portefeuille dans un compte sur marge avec des prix automatiques sécurisés et une saisie manuelle de secours.

L’interface demeure un site statique GitHub Pages. Un petit Cloudflare Worker séparé protège la clé de Market Data. Les données réelles sont conservées uniquement dans le navigateur utilisé.

Worker installé : https://portail-investissement-market-prices.palazz24.workers.dev

## Important — confidentialité

Le dossier publié sur GitHub contient seulement des exemples fictifs.

Ne publiez jamais :

- une sauvegarde téléchargée par le portail;
- un relevé de courtage;
- un export Wealthsimple;
- un numéro de compte;
- un fichier JSON contenant vos transactions réelles.

Les fichiers de sauvegarde portent un nom comme :

`Portail_Investissement_Sauvegarde_2026-07-28_1430.json`

Conservez-les dans un dossier privé sur votre ordinateur.

## Ouvrir le site localement

1. Ouvrez le dossier `Portail_Investissement_Personnel_V1`.
2. Double-cliquez sur `index.html`.
3. Le site s’ouvre dans votre navigateur.
4. Le bandeau orange confirme que les premières données sont fictives.

Pour une utilisation régulière sur plusieurs appareils, utilisez plutôt GitHub Pages. Chaque appareil possède toutefois son propre stockage local : une sauvegarde JSON est nécessaire pour transférer les données.

## Première utilisation

1. Examinez les exemples Ford et SPY.
2. Cliquez sur **Commencer avec un portefeuille vide**.
3. Ajoutez votre dépôt initial avec **Ajouter une opération**.
4. Ajoutez ou modifiez vos titres dans **Gestion des titres**.
5. Entrez les prix dans **Mise à jour des prix**.
6. Exportez une sauvegarde privée après vos modifications importantes.

## Choisir la garantie d’un put vendu

Lorsque vous choisissez **Vente d’option à l’ouverture**, puis **PUT**, le portail exige un mode de garantie :

- **Put garanti à 100 %** : le portail réserve le strike × 100 × le nombre de contrats;
- **Put sur marge — garantie partielle** : le portail estime la garantie avec le taux du titre.
- **Put couvert par une option achetée** : le portail réserve un put long admissible du même titre et empêche qu’il soit utilisé au-delà de sa quantité disponible.

Vous pouvez inscrire facultativement la garantie réelle affichée par Wealthsimple et sa date de vérification. Le portail indique toujours clairement si le montant utilisé est réel ou estimé.

Pour une couverture par option, le put acheté doit être encore ouvert et expirer à la même date ou plus tard. Le portail reconnaît les spreads verticaux, calendriers et diagonaux. Il exige que tous les contrats d’une transaction soient couverts et bloque la fermeture ou la suppression d’un put long tant qu’il protège un put vendu.

La prime reçue demeure séparée de la garantie. Une fermeture partielle libère seulement la portion fermée. Une expiration libère toute la portion expirée. Une assignation remplace la garantie du put par celle des actions acquises, sans double comptabilisation.

Les détails des formulaires, calculs et sauvegardes sont dans `DOCUMENTATION_GARANTIES_PUTS_V1_2.md`.

## Corriger ou supprimer une opération

Dans **Opérations**, chaque ligne possède maintenant les boutons **Modifier** et **Supprimer**.

- **Modifier** ouvre le formulaire déjà rempli et conserve l’identifiant original.
- **Supprimer** présente un résumé clair avant toute suppression.
- **Annuler la dernière correction** rétablit immédiatement la dernière modification ou suppression.
- Les opérations liées à un contrat d’option sont corrigées ou supprimées ensemble après une confirmation explicite.
- Le portail refuse une correction qui rendrait l’historique impossible, par exemple une vente avant l’achat ou une fermeture avant l’ouverture du contrat.

## Ajouter une opération

1. Cliquez sur **Ajouter une opération**.
2. Choisissez la date.
3. Choisissez le type d’opération.
4. Remplissez seulement les champs affichés.
5. Vérifiez le montant calculé.
6. Cliquez sur **Enregistrer l’opération**.

Les frais sont fixés à 0 $ par défaut.

Lors d’une assignation, le portail demande une confirmation claire avant de fermer le contrat et de créer le mouvement d’actions correspondant.

## Mettre à jour les prix

1. Ouvrez **Mise à jour des prix**.
2. Cliquez sur **Actualiser les prix** pour demander F, SPY et les symboles OCC nécessaires.
3. Le portail conserve les anciens prix lorsqu’une donnée fiable est absente.
4. La mise à jour se répète toutes les 60 minutes lorsque l’onglet est visible.
5. La saisie manuelle demeure disponible sous l’indicateur automatique.

Le navigateur ne transmet jamais les quantités, coûts moyens, soldes, marges, transactions, notes ou sauvegardes privées. La clé API n’est jamais présente dans le navigateur ou dans GitHub.

La gratuité ou le délai des données dépend du forfait Market Data. Le portail affiche donc « temps réel ou retardé selon le forfait » et ne promet jamais du temps réel sans confirmation explicite.

## Tri des historiques

Les opérations et historiques sont affichés de la plus récente à la plus ancienne. En cas d’égalité, le portail utilise l’heure de création, l’identifiant, puis l’ordre d’enregistrement. Les prochaines échéances d’options restent volontairement classées de la plus proche à la plus éloignée.

Dans les listes complètes d’options ouvertes, les échéances futures sont présentées de la plus proche à la plus éloignée. Les options échues non régularisées sont placées ensuite et clairement identifiées. Les longues notes sont abrégées dans les tableaux; le bouton **Voir la note** affiche leur contenu complet sans interpréter de code HTML.

## Sauvegarder les données

1. Ouvrez **Sauvegarde**.
2. Cliquez sur **Exporter une sauvegarde**.
3. Placez le fichier JSON téléchargé dans un dossier privé.

Le fichier contient vos données financières. Ne le placez jamais dans le dépôt GitHub.

## Restaurer les données

1. Ouvrez **Sauvegarde**.
2. Cliquez sur **Restaurer une sauvegarde**.
3. Choisissez votre fichier JSON privé.
4. Le portail vérifie sa version, sa structure et ses identifiants.
5. Une sauvegarde de secours est téléchargée automatiquement.
6. Confirmez le remplacement seulement si le résumé est correct.

Si la validation échoue, les données actuelles ne sont pas remplacées.

## Publier gratuitement sur GitHub Pages

Le moyen le plus simple est de créer un dépôt public contenant uniquement les fichiers de ce dossier. GitHub Pages est offert gratuitement pour les dépôts publics avec GitHub Free.

### 1. Créer le dépôt

1. Ouvrez [GitHub](https://github.com/).
2. Cliquez sur **New repository**.
3. Nommez-le, par exemple, `portail-investissement`.
4. Choisissez **Public**.
5. Créez le dépôt.

### 2. Envoyer les fichiers

1. Dans le nouveau dépôt, cliquez sur **Add file**, puis **Upload files**.
2. Glissez le contenu du dossier `Portail_Investissement_Personnel_V1`.
3. Vérifiez que `index.html` se trouve à la racine du dépôt.
4. Vérifiez qu’aucune sauvegarde privée n’est dans la liste.
5. Inscrivez un message simple, par exemple `Publier le portail V1.1`.
6. Confirmez l’envoi.

La procédure officielle est décrite dans [Ajouter un fichier à un dépôt — GitHub Docs](https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository).

### 3. Activer GitHub Pages

1. Dans le dépôt, ouvrez **Settings**.
2. Dans la colonne de gauche, ouvrez **Pages**.
3. Sous **Build and deployment**, choisissez **Deploy from a branch**.
4. Choisissez la branche `main`.
5. Choisissez le dossier `/(root)`.
6. Cliquez sur **Save**.
7. Attendez quelques minutes.

La procédure officielle est décrite dans [Configurer la source de publication — GitHub Docs](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

### 4. Ouvrir le site

L’adresse devrait ressembler à :

`https://palaz24.github.io/portail-investissement-personnel-v1/`

Le portail utilise uniquement des chemins relatifs et fonctionne donc dans ce sous-répertoire.

## Mettre le site à jour avec Codex

1. Faites d’abord une sauvegarde JSON privée.
2. Dites à Codex exactement ce que vous voulez modifier.
3. Rappelez que les données réelles et les sauvegardes privées ne doivent jamais être ajoutées au projet.
4. Demandez à Codex d’exécuter tous les tests.
5. Remplacez ensuite les anciens fichiers du dépôt GitHub par les fichiers validés.
6. GitHub Pages publiera automatiquement la nouvelle version.

## Tests

Les tests automatisés se trouvent dans `tests`.

- `calculations.test.js` vérifie les calculs et les validations.
- `v1-1.test.js` vérifie les symboles OCC, les prix, la confidentialité et le tri.
- `v1-1-1.test.js` vérifie la modification, la suppression, l’annulation et l’intégrité chronologique.
- `v1-2.test.js` vérifie les garanties des puts, les fermetures partielles, l’assignation et la migration.
- `v1-2-1.test.js` vérifie le tri des options, les longues notes et la couverture d’un put vendu par un put acheté.
- `test-runner.html` affiche les résultats dans le navigateur.
- `worker-market-prices/tests/worker.test.js` vérifie le Worker, CORS, le cache et la sécurité.

Pour afficher les tests, ouvrez `tests/test-runner.html`.

Résultat local V1.3.0 : **164 tests précédents sur 164 et 18 nouveaux tests sur 18**, soit **182 tests sur 182**.

## Limites de la V1.3.0

- Les données gratuites Market Data peuvent être retardées.
- L’historique graphique commence au premier prix réel reçu par cette version; aucun cours antérieur n’est inventé.
- Une connexion Internet et un Worker Cloudflare configuré sont nécessaires aux prix automatiques.
- Les données d’un navigateur ne sont pas automatiquement copiées vers un autre appareil.
- Les sauvegardes JSON ne sont pas chiffrées.
- Les exigences de marge des options courtes sont saisies manuellement.
- Le portail travaille en dollars US et ne fait pas de conversion automatique de devises.
- Le portail n’importe pas encore les exports Wealthsimple.
- Pour un spread calendrier ou diagonal, l’estimation du portail n’est pas une exigence officielle du courtier. Une valeur nulle ou négative exige la garantie réelle Wealthsimple.
