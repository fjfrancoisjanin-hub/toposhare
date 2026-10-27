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
- `public/admin.html` : `/admin`, suivi d'activité, avis, import du seed, modération. Réservé au propriétaire.
- `public/config.js` : config Firebase (publique par nature) + e-mail propriétaire.
- `firestore.rules` : seule vraie barrière de sécurité. Tout changement de règle = test dans `tests/rules/`.
- `redirect/` : site `betatheque` qui redirige.

## Commandes
- `npm run dev` : émulateurs (Auth, Firestore sur :8085, Hosting sur http://localhost:5000, UI sur :4000). Jamais de données de prod en local.
- `npm test` : règles Firestore puis E2E Playwright (Pixel 7 + iPhone 14). Nécessite Java 21.
- `npm run test:rules` / `npm run test:e2e` séparément.
- Déploiement : **ne pas lancer `firebase deploy` à la main**. Merge sur `main` → GitHub Actions teste puis déploie (site + règles). Une PR → URL de prévisualisation commentée sur la PR.

## Modèle de données (collections)
`gyms`, `walls` (photo du mur d'une salle), `blocs`, `secteurs`, `voies` (champ `methodCount`), `methodes`, `photos`, `feedback`, `data/users/{uid}/{docId}` (brouillons privés).
Chaque contenu porte `authorId` = uid de l'auteur. Le propriétaire (`isOwner()` dans les règles : e-mail vérifié) peut tout modérer.

## Sécurité : failles connues (tests `todo` dans tests/rules)
1. `walls` : n'importe quel grimpeur connecté peut remplacer la photo du mur d'une salle → à fermer avec le rôle « admin de salle ».
2. Aucun schéma validé à la création (`blocs`, `voies`, `gyms`, `secteurs`) : champs et tailles libres.
3. `feedback` ouvert sans compte : risque de spam (limité à 2000 caractères).
Avant une diffusion large : App Check, alerte budget, mentions légales / politique de confidentialité (connexion Google, RGPD).

## Backlog
Rôle admin de salle (seul à changer la photo du mur) ; suggestions de modification validées par l'ouvreur ; archivage des blocs au remontage ; multi-salles ; types d'utilisateurs (invité, inscrit), profils ouvreurs, commentaires ; import de vidéo de drone pour tracer une voie ; indicateur « clip » des méthodes falaise.

## Façon de travailler
- Une branche par fonctionnalité, petits commits en français, PR vers `main`.
- Avant de proposer une PR : `npm test` vert. Nouvelle fonctionnalité = au moins un test E2E ; nouvelle règle = tests de règles (accès autorisé ET refusé).
- Pour une fonctionnalité non triviale : proposer un plan d'abord.
- Ne pas casser l'interface `window.claude.use(...)` du shim sans adapter `index.html` et `admin.html`.
- Garder l'appli légère et rapide sur mobile ; vérifier en viewport 390 px.
