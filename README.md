# Portail d’investissement personnel V1

Ce site permet de suivre manuellement un petit portefeuille dans un compte sur marge.

Il fonctionne sans serveur, sans abonnement, sans API et sans connexion à Wealthsimple. Les données réelles sont conservées uniquement dans le navigateur utilisé.

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
2. Entrez le prix actuel de chaque action ou FNB.
3. Entrez le coût actuel de fermeture de chaque option ouverte.
4. Vérifiez la date et l’heure.
5. Cliquez sur **Enregistrer**.

Aucun prix n’est demandé à Internet automatiquement.

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
5. Inscrivez un message simple, par exemple `Publier le portail V1`.
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
- `test-runner.html` affiche les résultats dans le navigateur.

Pour afficher les tests, ouvrez `tests/test-runner.html`.

Résultat de livraison : **34 tests réussis sur 34**.

## Limites de la V1

- Les prix sont saisis manuellement.
- Les données d’un navigateur ne sont pas automatiquement copiées vers un autre appareil.
- Les sauvegardes JSON ne sont pas chiffrées.
- Les exigences de marge des options courtes sont saisies manuellement.
- Le portail travaille en dollars US et ne fait pas de conversion automatique de devises.
- Le portail n’importe pas encore les exports Wealthsimple.
