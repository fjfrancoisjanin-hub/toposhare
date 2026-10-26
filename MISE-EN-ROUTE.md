# TopoShare : mise en route du dépôt (à faire une seule fois)

Le dossier est déjà versionné avec git (historique local, tag de l'état gelé), avec des tests et l'automatisation GitHub Actions.
Il reste les étapes qui demandent tes comptes. Compte environ 45 minutes la première fois, puis 10 minutes pour le second projet.
Toutes les commandes se lancent dans **PowerShell**, ouvert dans `C:\Users\fjfra\Documents\FJ\toposhare`.

## 1. Outils (une fois pour les deux projets)

1. **Git for Windows** : https://git-scm.com/downloads/win (options par défaut).
2. **Java 21** (requis par l'émulateur Firestore) : https://adoptium.net, « Temurin 21 LTS », cocher « Set JAVA_HOME ».
3. **Claude Code** : `irm https://claude.ai/install.ps1 | iex`, puis fermer et rouvrir PowerShell, vérifier avec `claude --version`.
4. Node.js est déjà installé.

## 2. Installer les dépendances et lancer les tests en local

```
npm install
npx playwright install chromium
npm test
```

`npm install` crée `package-lock.json`. Il faut le versionner, la CI en a besoin :

```
git add package-lock.json
git commit -m "Verrouillage des dépendances"
```

Les tests « todo » affichés en jaune sont des **failles de sécurité connues** (voir CLAUDE.md), pas des erreurs.

## 3. Créer le dépôt GitHub

1. Créer un compte sur https://github.com/signup (gratuit).
2. https://github.com/new : nom `toposhare`, **Private**, ne rien cocher (ni README, ni .gitignore, ni licence).
3. Relier et pousser (remplacer `TON-PSEUDO`) :

```
git remote add origin https://github.com/TON-PSEUDO/toposhare.git
git push -u origin main --tags
```

Une fenêtre de connexion GitHub s'ouvre au premier push.

## 4. Autoriser GitHub à déployer sur Firebase

```
npx firebase login
npx firebase init hosting:github
```

- Dépôt : `TON-PSEUDO/toposhare`.
- « Set up the workflow to run a build script before every deploy? » : **No**.
- « Set up automatic deployment to your site's live channel when a PR is merged? » : **No**.

La commande crée le secret GitHub `FIREBASE_SERVICE_ACCOUNT_BETATHEQUE` (c'est le nom attendu par nos workflows) et peut ajouter des fichiers `.github/workflows/firebase-hosting-*.yml`. **Supprimer ces fichiers-là** : nos workflows `ci.yml` et `deploy.yml` les remplacent. Garder `ci.yml` et `deploy.yml`.

Pour que la CI puisse aussi publier les règles Firestore :
Google Cloud console → projet `betatheque` → **IAM** → compte de service dont le nom commence par `github-action-` → Modifier → **Ajouter un rôle** → « Administrateur Firebase Rules » (Firebase Rules Admin).

## 5. Vérifier la chaîne complète

```
git switch -c test/chaine
git commit --allow-empty -m "Test de la chaîne CI"
git push -u origin test/chaine
```

Sur GitHub, ouvrir une **pull request** depuis cette branche : la CI lance les tests, puis commente la PR avec une **URL de prévisualisation** valable 7 jours. Fusionner la PR : le workflow Deploy met en production.

Note : la connexion Google ne fonctionne pas sur les URL de prévisualisation (domaine non autorisé). La consultation, si. Une URL de prévisualisation utilise la **base de prod** : ce que les testeurs y publient est réel.

## Au quotidien, ensuite

```
claude
```

dans ce dossier. Claude lit `CLAUDE.md`, crée une branche, code, lance `npm test`, commite, et ouvre la PR (après `gh auth login` si tu installes GitHub CLI : https://cli.github.com). Tu relis la prévisualisation, tu fusionnes, c'est en ligne.
Ne plus utiliser `firebase deploy` à la main.
