# TopoShare : mise en ligne

> **Développement (depuis octobre 2026)** : le projet est versionné avec git, testé (`npm test`) et déployé automatiquement par GitHub Actions à chaque merge sur `main`.
> Première installation : voir [`MISE-EN-ROUTE.md`](MISE-EN-ROUTE.md). Contexte pour Claude Code : [`CLAUDE.md`](CLAUDE.md).
> Les sections de déploiement manuel ci-dessous restent valables en secours, mais ne sont plus la voie normale.

Site web mobile pour tracer et partager les betas des blocs de spray wall et des voies de falaise.
Adresse : **https://toposhare.web.app** (l'ancienne adresse betatheque.web.app redirige vers elle).
Le projet Firebase garde son identifiant technique `betatheque`, qui ne peut pas être modifié.

## Contenu du dossier

| Fichier | Rôle |
|---|---|
| `public/index.html` | L'appli |
| `public/admin.html` | Page de suivi d'activité et d'avis, réservée au propriétaire (`/admin`) |
| `public/config.js` | Configuration Firebase du projet `betatheque` |
| `public/firebase-shim.js` | Connexion à la base, à Google et au stockage des photos |
| `public/seed/` | Données du prototype, importées une fois depuis `/admin` |
| `firestore.rules` | Règles d'accès : qui lit, qui écrit |
| `firebase.json`, `.firebaserc` | Paramètres de déploiement : site `toposhare`, redirection du site `betatheque` |
| `redirect/` | Page de l'ancienne adresse, qui renvoie vers TopoShare |

## 1. Configuration (déjà remplie)

`public/config.js` contient déjà la configuration du projet `betatheque`.

## 2. Installer l'outil Firebase (une seule fois)

Il faut **Node.js** (version LTS, sur nodejs.org). Ensuite, dans un terminal :

```
npm install -g firebase-tools
firebase login
```

## 3. Déployer

La première fois seulement, créer le site `toposhare` :

```
firebase hosting:sites:create toposhare
```

Puis, dans Firebase > Authentication > Paramètres > **Domaines autorisés**, ajouter `toposhare.web.app`.

Ensuite, et à chaque mise à jour :

Dans un terminal ouvert **dans ce dossier** :

```
firebase deploy
```

Cette commande met en ligne le site et les règles de la base. Pour republier après une modification de l'appli seulement : `firebase deploy --only hosting:toposhare`.

## 4. Après la première mise en ligne

1. Ouvrir **https://toposhare.web.app/admin**, se connecter avec le compte Google propriétaire, puis cliquer sur **Importer les données**.
2. Ouvrir **https://toposhare.web.app** sur le téléphone, puis utiliser le menu du navigateur > **Ajouter à l'écran d'accueil**.
3. Diffuser le lien.

## Comment ça marche pour les grimpeurs

- La consultation est libre, sans compte.
- Pour publier un bloc, une voie ou une méthode, ou garder un brouillon, on se connecte avec Google en un tap. Le travail en cours est conservé.
- Seul l'auteur modifie ou supprime son bloc, sa voie ou sa méthode. Les brouillons sont privés.
- Le lien « Donnez votre avis », en bas des listes, envoie un message visible dans `/admin`.
- Le propriétaire peut tout supprimer : depuis la section « Gérer le contenu » de `/admin`, ou directement sur la fiche d'un bloc ou d'une voie.

## Coûts

Offre gratuite (Spark), sans carte bancaire. Les photos sont compressées et rangées dans la base de données : aucun service payant n'est utilisé. Au volume d'une communauté de quelques dizaines de grimpeurs, l'usage reste dans les quotas gratuits.
