# TopoShare — contexte projet pour Claude

Web app mobile (PWA) pour tracer et partager les betas : blocs du spray wall d'une salle (Altissimo Albi au départ) et voies de falaise (secteurs, voies avec points d'ancrage communs, méthodes de plusieurs grimpeurs).
Prod : https://toposhare.web.app (l'ancien site betatheque.web.app redirige en 301). Projet Firebase : `betatheque` (identifiant figé).
Public visé : ~50 grimpeurs de la communauté, puis multi-salles. Mobile d'abord, réponses en français.

## Stack
- HTML/CSS/JS vanilla, **sans build** : `public/` est servi tel quel.
- Firebase compat SDK 10.12.2 chargé depuis gstatic. Auth Google, Firestore. **Pas de Cloud Storage** (offre Spark) : photos compressées en base64 dans la collection `photos` (< 1 Mo par document).
- `public/firebase-shim.js` expose `window.claude.use("db" | "user" | "assets")`, la même interface que le prototype artifact : l'appli n'appelle pas Firebase directement. En local (localhost), le shim se branche sur les émulateurs.
- `public/i18n.js` : textes FR/EN. Toute chaîne visible passe par i18n, dans les deux langues.

## Fichiers
- `public/index.html` : l'appli (un seul fichier, ~110 Ko).
- `public/admin.html` : `/admin`, suivi d'activité, avis, import du seed, modération. Réservé à l'admin.
- `public/config.js` : config Firebase (publique par nature), prod seulement sur les adresses listées, projet de test partout ailleurs. Tout nouveau domaine de prod doit y être ajouté. Contient aussi l'e-mail de l'admin.
- `firestore.rules` : seule vraie barrière de sécurité. Tout changement de règle = test dans `tests/rules/`.
- `redirect/` : site `betatheque` qui redirige.

## Commandes
- `npm run dev` : émulateurs (Auth, Firestore sur :8085, Hosting sur http://localhost:5000, UI sur :4000). Jamais de données de prod en local.
- `npm test` : règles Firestore puis E2E Playwright (Pixel 7 + iPhone 14). Nécessite Java 21.
- `npm run test:rules` / `npm run test:e2e` séparément.
- Déploiement : **ne pas lancer `firebase deploy` à la main**. Merge sur `main` → GitHub Actions teste puis déploie (site + règles). Une PR → déployée sur l'environnement de test https://toposhare-test.web.app (projet `toposhare-test`, données fictives remises à zéro à chaque déploiement, une seule URL : la dernière PR déployée s'affiche, voir le bandeau). Le job `preview` n'a aucun accès à la prod.

## Modèle de données (collections)
`gyms`, `walls` (photo du mur d'une salle), `blocs`, `secteurs`, `voies` (champ `methodCount`), `methodes` (publiques), `methodesPrivees` (auteur et admin seuls ; changer de visibilité déplace le document), `voies/{id}/contributeurs/{uid}` (marque + `foreignCount` : si d'autres grimpeurs ont contribué, seul l'admin supprime la voie), `photos`, `feedback`, `data/users/{uid}/{docId}` (brouillons privés), `gymOwners/{gymId__email}` (propriétaires de salle, écrits par l'admin seul).
Chaque contenu porte `authorId` = uid de l'auteur. L'admin (`isAdmin()` dans les règles : e-mail vérifié) peut tout modérer.

## Décisions de référence
- **Rôles :**
  - **Invité** : consulte seulement.
  - **Grimpeur connecté** : crée et modifie ce qu'il a créé ; ajoute sa méthode et ses vues sur la voie d'un autre.
  - **Propriétaire de salle** : change la photo du mur de sa salle ; supprime, sans les modifier, les blocs de sa salle.
  - **Admin** : tous les droits.
- **Propriétaire de salle** : attribué par l'admin depuis `/admin`, par e-mail. Créer une salle ne rend pas propriétaire.
- **Création de salle** : ouverte à tout grimpeur connecté, avec la photo initiale.
- **Méthodes falaise** : privées par défaut, publiques sur choix explicite. L'admin peut les lire et les supprimer pour la modération, sans qu'elles s'affichent dans sa navigation normale.
- **Suppression d'une voie** : si d'autres grimpeurs y ont une méthode ou une vue, seul l'admin peut la supprimer.
- **Notes** : de 0 à 3 étoiles, connexion obligatoire, un vote par personne, moyenne affichée à partir de 3 votes, pas de note sur son propre contenu.
- **Géographie** : deux niveaux en falaise, commune puis secteur. La commune vient de la liste officielle française (geo.api.gouv.fr), elle est obligatoire pour un nouveau secteur, et affichée « Saint-Antonin-Noble-Val (82) ». France uniquement pour l'instant.
- **Voies** : une ou plusieurs longueurs, chacune avec sa cotation ; une ou plusieurs vues (photos) par longueur ; points d'ancrage propres à chaque vue.
- **Navigation** : écran d'accueil avec recherche ; barre du bas « Accueil · lieu en cours · Nouveau bloc / Nouvelle voie ».
- **Contrôle côté serveur** : toute règle d'accès est appliquée par les règles Firestore, jamais seulement en cachant un bouton.

## Sécurité : failles connues (tests `todo` dans tests/rules)
1. Aucun schéma validé à la création (`blocs`, `voies`, `gyms`, `secteurs`) : champs et tailles libres.
2. `feedback` ouvert sans compte : risque de spam (limité à 2000 caractères).
Avant une diffusion large : App Check, alerte budget, mentions légales / politique de confidentialité (connexion Google, RGPD).

## Backlog
Suggestions de modification validées par l'ouvreur ; archivage des blocs au remontage ; multi-salles ; types d'utilisateurs (invité, inscrit), profils ouvreurs, commentaires ; import de vidéo de drone pour tracer une voie ; indicateur « clip » des méthodes falaise.

## Façon de travailler
- Une branche par fonctionnalité, petits commits en français, PR vers `main`.
- Avant de proposer une PR : `npm test` vert. Nouvelle fonctionnalité = au moins un test E2E ; nouvelle règle = tests de règles (accès autorisé ET refusé).
- Avant chaque ticket, vérifier le dépôt actuel, signaler les écarts avec la spec et proposer un plan avant de coder.
- Pour une fonctionnalité non triviale : proposer un plan d'abord.
- Ne pas casser l'interface `window.claude.use(...)` du shim sans adapter `index.html` et `admin.html`.
- Garder l'appli légère et rapide sur mobile ; vérifier en viewport 390 px.
