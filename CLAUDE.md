# TopoShare — contexte projet pour Claude

Web app mobile (PWA) pour tracer et partager les betas : blocs du spray wall d'une salle (Altissimo Albi au départ) et voies de falaise (secteurs, voies avec points d'ancrage communs, méthodes de plusieurs grimpeurs).
Prod : https://toposhare.web.app (l'ancien site betatheque.web.app redirige en 301). Projet Firebase : `betatheque` (identifiant figé).
Public visé : ~50 grimpeurs de la communauté, puis multi-salles. Mobile d'abord, réponses en français.

## Stack
- HTML/CSS/JS vanilla, **sans build** : `public/` est servi tel quel.
- Firebase compat SDK 10.12.2 chargé depuis gstatic. Auth Google, Firestore. **Pas de Cloud Storage** (offre Spark) : photos compressées en base64 dans la collection `photos` (≤ 400 Ko binaires, 2 000 px au plus, WebP si le navigateur sait l'encoder, sinon JPEG), avec une miniature (~20 Ko) dans `miniatures` sous le même identifiant. Cache Firestore activé sur le téléphone.
- `public/firebase-shim.js` expose `window.claude.use("db" | "user" | "assets")`, la même interface que le prototype artifact : l'appli n'appelle pas Firebase directement. En local (localhost), le shim se branche sur les émulateurs.
- `public/i18n.js` : textes FR/EN. Toute chaîne visible passe par i18n, dans les deux langues.

## Fichiers
- `public/index.html` : l'appli (un seul fichier, ~110 Ko).
- `public/admin.html` : `/admin`, suivi d'activité, avis, import du seed, modération. Réservé à l'admin.
- `public/mesure.js` : mesure d'audience Umami, chargée sur `toposhare.web.app` seulement. Seuls le slug de la salle (identifiant du secteur pour une voie) et le type partent dans les événements.
- `public/config.js` : config Firebase (publique par nature), prod seulement sur les adresses listées, projet de test partout ailleurs. Tout nouveau domaine de prod doit y être ajouté. Contient aussi l'e-mail de l'admin.
- `firestore.rules` : seule vraie barrière de sécurité. Tout changement de règle = test dans `tests/rules/`.
- `redirect/` : site `betatheque` qui redirige.

## Commandes
- `npm run dev` : émulateurs (Auth, Firestore sur :8085, Hosting sur http://localhost:5000, UI sur :4000). Jamais de données de prod en local.
- `npm test` : règles Firestore puis E2E Playwright (Pixel 7 + iPhone 14). Nécessite Java 21.
- `npm run test:rules` / `npm run test:e2e` séparément.
- Mesure de lancement : `npx firebase emulators:exec --only auth,firestore --project betatheque "node scripts/mesure-lancement.mjs [--miniatures] [--repo <dossier>]"` copie les données publiques de la prod (lecture seule, sans clé) dans l'émulateur et compte les documents et Ko lus au lancement, à l'ouverture d'un mur et d'un secteur, puis au 2e lancement. `--miniatures` simule le bouton admin ; `--repo` compare avec un autre état du dépôt (git worktree).
- Déploiement : **ne pas lancer `firebase deploy` à la main**. Merge sur `main` → GitHub Actions teste puis déploie (site + règles). Une PR → déployée sur l'environnement de test https://toposhare-test.web.app (projet `toposhare-test`, remis à zéro à chaque déploiement, une seule URL : la dernière PR déployée s'affiche, voir le bandeau). Le job `preview` n'a aucun accès à la prod.
- Données du site de test : la référence figée (données publiques de la prod, collection `reference` du projet de test, jamais dans Git) plus le jeu fictif. Pour la rafraîchir : action « Figer la référence » dans l'onglet Actions, lecture de la prod sans clé. Méthodes privées, blocs privés, avis, brouillons, propriétaires et contributeurs ne sont pas copiés.

## Photos et lectures
- **Une seule passe de compression**, dans `firebase-shim.js` (`preparePhoto`) : depuis l'image d'origine, 2 000 px au plus, qualité baissée puis taille réduite jusqu'à 400 Ko ; au-delà, refus avec un message clair. Le canvas ne recopie ni EXIF ni GPS. Photo et miniature partent dans le même lot.
- **Lecture** (`BT.img`) : cache du téléphone d'abord (une photo ne change jamais), serveur ensuite. Écran d'accueil et carte « Reprendre » : miniature seulement. Petites cartes de liste : miniature, photo complète s'il n'y en a pas. Photo d'en-tête : chargée quand l'écran est visible, miniature en attendant.
- **Lancement** : secteurs, salles, murs et voies (une seule écoute sur `voies`) ; les blocs d'une salle ne se lisent qu'à l'entrée dans la salle. Aucune photo complète.
- **Écran de chargement** (`#splash`) : reste affiché jusqu'à l'arrivée des secteurs, salles et murs, voies (`state.oLoaded`, `loaded`, `vLoaded`) puis de la miniature de la carte « Reprendre » (4 s au plus ; pas de miniature = pas d'attente). Après 12 s : message « Connexion lente » avec Continuer / Réessayer. On n'attend volontairement pas toutes les photos : lecture Firestore lourde et quota gratuit de 50 000 lectures par jour. Slogan : « Par les grimpeurs, pour les grimpeurs. » (i18n FR/EN/ES, `manifest`, meta description).
- Chaque envoi crée une photo distincte : le partage d'une photo entre voies ou vues n'existe pas encore (supprimer une vue supprime sa photo).

## Navigation
Barre du bas : **Accueil · Salles · Falaises · +** (création). Accueil : carte « Reprendre » (dernier lieu), deux entrées Salles / Falaises (listes `vPlaces`, dernières visites puis par commune, étoile de favori), puis Favoris. Plus de bloc « Récents » à l'écran (`ts-recents` sert encore à « Reprendre » et aux dernières visites). Onglet Salles/Falaises : au fond d'une fiche il remonte au lieu, dans le lieu il ouvre la liste, ailleurs il rouvre le dernier lieu de ce type. L'en-tête d'un lieu propose « Passer aux falaises / salles ». Liens directs en `/#/salle/id`, `/#/secteur/id`, `/#/voie/id`, `/#/bloc/id`. Favoris (`ts-favs`) et récents (`ts-recents`) restent dans `localStorage`.

## Mesure d'audience
Tableau de bord : Umami Cloud. Le suivi automatique est coupé, chaque écran est envoyé depuis `go()`, avec des adresses `/salle/id`, `/bloc/id`, etc. QR code d'une salle : `/?src=qr#/salle/id` (`docs/qr/`, régénéré par `node scripts/make-qr.mjs <slug>`).

**Exclure ses propres visites :** Umami ignore un navigateur qui porte la marque `umami.disabled`. À faire une fois par navigateur et par appareil, sur `https://toposhare.web.app`, puis recharger :
- **Ordinateur :** F12, onglet Console, taper `localStorage.setItem('umami.disabled', '1')`.
- **Android (Chrome) :** sur le site, taper dans la barre d'adresse `javascript:localStorage.setItem('umami.disabled','1');location.reload()` (Chrome retire `javascript:` au collage : le retaper).
- **iPhone :** pas de console ; passer par l'inspecteur web de Safari sur un Mac.
- **Vérifier :** dans l'onglet Réseau, plus aucun appel vers `gateway.umami.is`. Vider les données du site efface la marque. Pour la retirer : `localStorage.removeItem('umami.disabled')`.

## Modèle de données (collections)
`gyms` et `secteurs` (commune dans `commune`, libellé dans `city` / `region`), `walls` (photo du mur d'une salle), `blocs` (publics ; champ `seq` : `"ordered"` = pieds dans l'ordre de l'enchaînement, replay et tracé main / pied ; `"free"` ou absent = anciens blocs, pieds imposés visibles dès le départ), `blocsPrivees` (auteur et admin seuls, même identifiant et mêmes champs que le bloc public ; changer de visibilité déplace le document ; pas de propriétaire de salle), `voies` (champ `methodCount`), `methodes` (publiques), `methodesPrivees` (auteur et admin seuls ; changer de visibilité déplace le document), `voies/{id}/contributeurs/{uid}` (marque + `foreignCount` : si d'autres grimpeurs ont contribué, seul l'admin supprime la voie), `vues` (les prises d'une méthode portent `viewId`, absent = vue d'ensemble, et la méthode liste `vueIds` ; photos supplémentaires d'une voie, par longueur ; la photo portée par la voie est la « vue d'ensemble » ; une voie sans `longueurs` vaut L1), `photos` (`data`, `w`, `h` ≤ 2 000, `mime` jpeg ou webp, `authorId` ; jamais modifiée), `miniatures/{même id que la photo}` (≤ 400 px, ≤ 40 000 caractères ; absente pour les photos d'avant, l'appli affiche alors la photo complète ; l'admin les crée depuis `/admin`), `feedback`, `data/users/{uid}/{docId}` (brouillons privés), `gymOwners/{gymId__email}` (propriétaires de salle, écrits par l'admin seul).
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
- **Visibilité** : à la publication d'un bloc ou d'une méthode, choix « Visible par tous » / « Privé (moi seul) » (blocs : public par défaut, dernier choix gardé dans `ts-bloc-vis`). Les salles, murs et voies avec points d'ancrage sont toujours publics. Un bloc privé n'est lisible que par son auteur et l'admin ; son lien direct répond « n'existe plus » aux autres.
- **Notes** : supprimées de l'application (trop de surcharge au départ). Les anciens documents `votes` et les compteurs `ratingCount` / `ratingSum` restent en base, inertes : aucune règle n'autorise plus d'y accéder, et les compteurs sont figés.
- **Géographie** : deux niveaux en falaise, commune puis secteur. La commune vient de la liste officielle française (geo.api.gouv.fr), elle est obligatoire pour un nouveau secteur, et affichée « Saint-Antonin-Noble-Val (82) ». France uniquement pour l'instant.
- **Replay** (blocs et méthodes de voie) : fenêtre de 5 prises (mains ou pieds) centrée sur la prise en cours, 2 avant et 2 après (5 prises aussi au début et à la fin). La prise en cours a un double anneau orange, les précédentes sont estompées, les suivantes normales. La numérotation reste celle du circuit entier. Bouton « Fenêtre de 5 prises » / « Tout depuis le début » (`ts-replay-win`) : ce dernier révèle tout jusqu'à la prise en cours, sans estomper.
- **Pied interdit** (blocs seulement) : type de prise `nofoot`, rond rouge barré posé comme les autres prises, compté à part (« Interdits »), visible sur la fiche et pendant tout le replay ; il n'est ni un move ni une étape, et aucun trait ne le relie aux autres prises.
- **Tracés** : trait blanc plein vers une main, pointillé jaune vers un pied (blocs en pieds dans l'ordre et méthodes de voie). Appui long sur une prise : menu (avant / après, déplacer, changer, repos, supprimer) ; un tap sur une prise posée la reprend ; bouton d'aide « ? » sur les écrans d'édition (`ts-help`). Point d'ancrage : drapeau `work` (point de travail) ; prise de méthode : drapeau `rest` (repos).
- **Voies** : une ou plusieurs longueurs, chacune avec sa cotation ; une ou plusieurs vues (photos) par longueur ; points d'ancrage propres à chaque vue.
- **Navigation** : écran d'accueil avec recherche ; barre du bas « Accueil · Salles · Falaises · Nouveau / Nouveau bloc / Nouvelle voie ». Pas de bloc « Récents » sur l'accueil.
- **Contrôle côté serveur** : toute règle d'accès est appliquée par les règles Firestore, jamais seulement en cachant un bouton.

## Sécurité : failles connues (tests `todo` dans tests/rules)
1. Aucun schéma validé (sauf `photos` et `miniatures`, dont taille, dimensions et format sont contrôlés) à la création (`blocs`, `voies`, `gyms`, `secteurs`) : champs et tailles libres.
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
