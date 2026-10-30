# TopoShare : tickets pour Claude Code

Version finale, toutes les décisions intégrées. Une section par ticket, à copier issue par issue.

**Ordre de réalisation :** 1 · 2 · 3 · 5 · 7 · 4 · 6a · 6b
Le ticket 2 (rôles) est le socle des suivants : le fusionner avant d'attaquer le 3.

**Avant chaque ticket :** ces spécifications partent d'une version antérieure du code. Vérifier d'abord le dépôt actuel et signaler tout écart avant d'implémenter.

---

## Décisions de référence (à reporter dans CLAUDE.md)

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

---

## Ticket 1 : l'admin corrige les noms

**1. Objectif**
Permettre à l'admin de corriger les noms des salles, secteurs et voies, et le nom d'auteur affiché sur un bloc, une voie ou une méthode, sans passer par la console Firebase.

**2. Comportement attendu**
- Connecté en admin, un bouton « Modifier » apparaît :
  - sur chaque salle : nom, ville ;
  - sur chaque secteur : nom, commune ;
  - sur la fiche d'une voie : nom, cotation, « ajoutée par » ;
  - sur la fiche d'un bloc : « ouvert par » ;
  - sur chaque méthode : le prénom du grimpeur.
- Un formulaire pré-rempli s'ouvre. Après enregistrement, la modification s'affiche en direct chez tout le monde.
- Les non-admins ne voient aucun de ces boutons. L'auteur d'une voie ou d'un bloc garde ses droits actuels sur son propre contenu.

**Correction du bug d'origine.** Dans une version antérieure, l'appli retenait un seul « dernier prénom saisi » et le réutilisait partout. Une nouvelle voie récupérait même ce prénom sans champ visible : c'est ainsi qu'un mauvais prénom est resté sur une voie. Vérifier dans le dépôt actuel, puis :
- afficher un champ de prénom à la création d'une voie ;
- pré-remplir chaque champ de prénom avec celui du compte Google, et non avec le dernier saisi ;
- laisser ce champ modifiable.

**3. Règles métier et de sécurité**
- **Salles et secteurs** : seul l'admin les modifie.
- **Voies, blocs et méthodes** : l'auteur ou l'admin modifie le nom, la cotation et le nom affiché de l'auteur.
- **Contrôle côté serveur** : les règles Firestore appliquent ces refus, pas seulement l'interface.
- **Champs protégés** : `authorId`, `createdAt`, les identifiants et les rattachements restent intouchables. Renommer l'auteur affiché ne change pas le propriétaire réel du contenu.
- **Traçabilité** : chaque modification enregistre `updatedAt` et `updatedBy`.

**4. Cas limites**
- Un nom vide ou fait d'espaces est refusé, et les espaces superflus sont nettoyés.
- Les longueurs maximales sont les mêmes qu'à la création (salle 40, secteur 50, voie 50).
- Si deux secteurs portent le même nom dans la même commune, l'appli avertit sans bloquer.
- Les rattachements tiennent après un renommage : une voie reste dans son secteur.
- Une fiche ouverte chez un autre grimpeur se met à jour sans rechargement.

**5. Critères de réussite, à transformer en tests**
- **Règles** :
  - l'admin modifie tous ces champs ;
  - un non-admin ne peut modifier ni une salle ni un secteur ;
  - un non-auteur non-admin ne peut pas modifier la voie, le bloc ou la méthode d'un autre ;
  - un invité ne peut rien modifier ;
  - un nom vide est refusé ;
  - `authorId` ne peut pas être changé.
- **Parcours** :
  - l'admin renomme « St Antonin noble val » et corrige l'auteur d'une voie ; les deux changements s'affichent partout ;
  - une nouvelle voie affiche un champ de prénom pré-rempli avec le compte connecté.
- Les parcours passent en vue Android et en vue iPhone.

**6. Hors périmètre**
- La fusion de secteurs en doublon.
- Le choix de la commune dans une liste (ticket 5).
- L'historique des modifications.

---

## Ticket 2 : les rôles et la protection de la photo du mur

**1. Objectif**
Définir quatre rôles (invité, grimpeur, propriétaire de salle, admin) et réserver le changement de photo du mur au propriétaire de la salle et à l'admin.

**2. Comportement attendu**
- **Invité** : il consulte tout et ne peut rien créer. Toute action de création ouvre l'écran de connexion.
- **Grimpeur connecté** :
  - il crée des blocs, des voies, des méthodes, des secteurs et des salles ;
  - il modifie et supprime uniquement ce qu'il a créé ;
  - il peut ajouter sa méthode sur la voie d'un autre, sans pouvoir modifier cette voie.
- **Propriétaire de salle** :
  - dans sa salle, il voit « Le mur a été remonté » et peut changer la photo, ce qui archive les blocs ;
  - il peut supprimer n'importe quel bloc de sa salle, mais pas le modifier.
- **Admin** : tous les droits partout.
- **Attribution** : sur `/admin`, une section « Propriétaires de salle » permet de choisir une salle et de saisir un e-mail. Le rôle est actif dès la prochaine connexion de la personne, même si elle ne s'est jamais connectée auparavant. Le retrait se fait au même endroit.

**3. Règles métier et de sécurité**
- **Écriture des rôles** : seul l'admin les attribue ou les retire, et un utilisateur ne peut jamais s'attribuer un rôle lui-même.
- **Identification de l'admin** : elle se fait côté serveur, jamais à partir d'une valeur que l'appli pourrait modifier.
- **Photo du mur** : après la création d'une salle, seuls son propriétaire et l'admin peuvent ajouter, activer ou désactiver un mur. Ça ferme la faille actuelle, où tout grimpeur connecté peut remplacer la photo.
- **Création d'une salle** : elle reste ouverte aux grimpeurs connectés, avec la photo initiale. Le créateur ne devient pas propriétaire automatiquement.
- **Contrôle côté serveur** : tous les refus sont appliqués par les règles Firestore.

**4. Cas limites**
- Une salle sans propriétaire : seul l'admin peut changer sa photo.
- Une personne propriétaire de plusieurs salles.
- L'admin qui est aussi propriétaire d'une salle.
- Un rôle retiré pendant que la personne a l'appli ouverte : l'action suivante est refusée, avec un message clair.
- Le propriétaire supprime un bloc dont un grimpeur a un brouillon en cours : ce brouillon privé n'est pas touché.

**5. Critères de réussite, à transformer en tests**
- **Règles** :
  - un connecté non-propriétaire ne peut pas changer le mur d'une salle existante ;
  - le propriétaire de la salle A ne peut pas changer le mur de la salle B ;
  - le propriétaire supprime le bloc d'un autre dans sa salle, mais ne peut pas le modifier ;
  - personne ne peut s'attribuer un rôle ;
  - l'admin attribue et retire un rôle.
- **Parcours** :
  - l'admin désigne un propriétaire par e-mail ;
  - ce propriétaire voit « Le mur a été remonté » dans sa salle, alors qu'un autre grimpeur ne le voit pas.
- Les parcours passent en vue Android et en vue iPhone.

**6. Hors périmètre**
- Les demandes de rôle depuis l'appli.
- Les profils d'ouvreurs.
- Les suggestions de modification.
- Un rôle de modération en falaise.

---

## Ticket 3 : méthode privée en falaise

**1. Objectif**
Permettre à un grimpeur de garder sa méthode pour lui, en ne la rendant publique que s'il le choisit.

**2. Comportement attendu**
- **À l'enregistrement** d'une méthode, un choix apparaît : « Privée (moi seul) », par défaut, ou « Visible par tous ».
- **Sur la fiche de la voie** :
  - l'auteur voit sa méthode privée avec une pastille « Privée » ;
  - la répétition move par move fonctionne comme pour une méthode publique ;
  - les autres grimpeurs ne voient ni la méthode ni son existence.
- **Ensuite**, l'auteur peut passer sa méthode de privée à publique, et inversement.

**3. Règles métier et de sécurité**
- **Lecture** : une méthode privée n'est lisible que par son auteur et par l'admin, et le refus est appliqué côté serveur. Les règles Firestore ne filtrent pas les résultats : l'appli doit donc ne demander que les méthodes publiques, plus celles de l'utilisateur.
- **Admin** : il peut lire et supprimer les méthodes privées, pour la modération et pour pouvoir supprimer une voie avec tout ce qui en dépend. L'interface normale ne les lui affiche pas.
- **Compteur** : seules les méthodes publiques sont comptées dans le nombre de méthodes. Le passage de privé à public fait +1, l'inverse −1, ce qui reste cohérent avec la règle actuelle (±1, jamais sous 0).
- **Une méthode par grimpeur et par voie**, comme aujourd'hui : la visibilité n'est qu'un réglage de cette méthode.
- **Méthodes existantes** : elles restent publiques.
- **Suppression d'une voie** : si d'autres grimpeurs y ont une méthode, publique ou privée, seul l'admin peut la supprimer.

**4. Cas limites**
- Une méthode publique passe en privée pendant qu'un autre grimpeur la regarde : elle disparaît de son écran, sans erreur.
- Une voie qui n'a que des méthodes privées s'affiche comme « aucune méthode partagée » pour les autres.
- La suppression d'une voie supprime aussi les méthodes privées qui y sont liées.
- Un invité ne voit jamais de méthode privée, même en connaissant son identifiant.

**5. Critères de réussite, à transformer en tests**
- **Règles** :
  - un autre connecté ne peut pas lire une méthode privée ;
  - un invité non plus ;
  - l'auteur la lit et la modifie ;
  - l'admin la lit et la supprime ;
  - le compteur ne bouge que pour les méthodes publiques ;
  - l'auteur d'une voie ne peut pas la supprimer si un autre grimpeur y a une méthode.
- **Parcours** :
  - un grimpeur crée une méthode privée et la répète ; un second compte ne la voit pas ;
  - le premier grimpeur la publie, et le second compte la voit.
- Les parcours passent en vue Android et en vue iPhone.

**6. Hors périmètre**
- Les voies privées : la voie et ses points d'ancrage restent publics.
- Le partage avec une liste de personnes.
- Les blocs privés en salle.

---

## Ticket 5 : choisir la commune dans une liste

**1. Objectif**
Éviter les variantes d'orthographe en faisant choisir la commune d'un secteur ou d'une salle dans la liste officielle des communes françaises.

**2. Comportement attendu**
- **Saisie** : dans le champ « Commune » d'un nouveau secteur, et dans le champ « Ville » d'une nouvelle salle, une liste de suggestions apparaît dès 2 lettres. Par exemple, « st anto » propose « Saint-Antonin-Noble-Val (82) ».
- **Validation** : on touche une suggestion pour la valider.
- **Éviter les doublons** : après le choix de la commune, l'appli liste les secteurs déjà référencés dans cette commune (« Déjà référencés à Saint-Antonin-Noble-Val : … »). Un tap sur l'un d'eux y mène au lieu de créer un doublon.
- **Affichage** : la commune apparaît partout sous sa forme officielle, avec le numéro du département : « Saint-Antonin-Noble-Val (82) ».
- **Correction** : l'admin peut rattacher une commune aux secteurs et salles existants, avec le formulaire de modification du ticket 1.

**3. Règles métier et de sécurité**
- **Source** : la base officielle des communes, gratuite et sans clé (geo.api.gouv.fr). Vérifier qu'elle est accessible depuis le site.
- **Commune obligatoire** pour un nouveau secteur et une nouvelle salle.
- **Données enregistrées** : le nom officiel, le code INSEE, le département et les coordonnées du centre de la commune. Elles préparent la recherche et une carte éventuelle.
- **Forme simplifiée** : enregistrer aussi le nom de commune sans accents ni tirets, avec « st » ramené à « saint », pour la recherche du ticket 7.
- **Champ libre** : le nom du secteur ou de la salle reste libre. Seule la commune est contrôlée.
- **France uniquement** pour l'instant.

**4. Cas limites**
- **Service indisponible** : la saisie libre reste possible, marquée « commune non vérifiée », pour ne pas bloquer la création. L'admin pourra la corriger ensuite.
- **Homonymes** : le département distingue les communes de même nom, comme Saint-Martin.
- **Saisie sans accents** ou avec « st » au lieu de « saint » : les bons résultats doivent quand même apparaître.
- **Secteurs et salles existants** sans commune : ils restent valides et s'affichent normalement, en attendant la correction par l'admin.

**5. Critères de réussite, à transformer en tests**
- Taper « st antonin » propose Saint-Antonin-Noble-Val (82).
- La commune choisie est enregistrée avec son code INSEE et sa forme simplifiée.
- Après le choix d'une commune qui a déjà des secteurs, ceux-ci sont listés.
- Créer un secteur sans commune est refusé, sauf en saisie « non vérifiée » quand le service ne répond pas.
- Un non-admin ne peut pas modifier la commune du secteur d'un autre.
- Les parcours passent en vue Android et en vue iPhone.

**6. Hors périmètre**
- Les pays autres que la France.
- Un niveau « site » entre commune et secteur.
- La carte des secteurs.
- La fusion des doublons existants.

---

## Ticket 7 : accueil, recherche et liens directs

**1. Objectif**
Permettre à un grimpeur d'arriver sur la salle, le secteur ou la voie qui l'intéresse en 2 taps au plus, ou directement par un lien ou un QR code.

**2. Comportement attendu**
- **Ouverture normale** : l'appli s'ouvre toujours sur l'accueil, sauf si on arrive par un lien direct. L'accueil affiche, de haut en bas :
  - la barre de recherche ;
  - une grande carte photo **« Reprendre : [dernier lieu visité] »**, avec son type, sa commune et la date de la dernière visite ;
  - les **favoris**, épinglés avec l'étoile depuis une salle ou un secteur ;
  - les **récents**, jusqu'à 5 lieux ou voies.
- **Premier lancement** : le titre « Où grimpes-tu aujourd'hui ? », la recherche, la liste des salles et des secteurs existants, et un lien « Ta salle ou ta falaise n'y est pas ? Ajoute-la ».
- **Barre du bas** : elle remplace les onglets Salle / Falaise par :
  - **Accueil** ;
  - **le lieu en cours**, avec son icône et son nom, tronqué si trop long ; ce bouton est absent tant qu'aucun lieu n'a été ouvert ;
  - **⊕ Nouveau bloc** si le lieu en cours est une salle, **⊕ Nouvelle voie** si c'est un secteur, y compris depuis l'accueil, ou **⊕ Nouveau** sans lieu en cours, qui fait choisir entre bloc et voie puis le lieu.
- **Recherche** : elle porte sur les noms de salles, de secteurs, de communes et de voies. Les résultats sont groupés par type (Commune, Secteurs, Voies, Salles) et la partie qui correspond à la saisie est surlignée. Sans résultat satisfaisant, un lien « Créer un secteur à [commune] » apparaît, après connexion.
- **Page d'une salle ou d'un secteur** : un en-tête photo avec retour à l'accueil, « Partager le lien » et l'étoile de favori.
- **Liens directs** : chaque salle, secteur, voie et bloc a son lien, et ouvrir ce lien mène directement à la page.
- **QR codes** : sur `/admin`, l'admin génère une affiche à imprimer pour une salle ou un secteur, avec le logo, le nom du lieu, le QR code et la mention « Sans compte, sans appli à installer ».

**3. Règles métier et de sécurité**
- **Sans compte** : l'accueil, la recherche, les favoris, les récents, les liens et les QR codes marchent pour un invité. Favoris et récents sont gardés sur le téléphone.
- **Contenu public uniquement** : la recherche ne renvoie jamais de méthode privée ni de brouillon.
- **Liens et droits** : un lien n'ouvre que la consultation, et les règles habituelles s'appliquent pour le reste.

**4. Cas limites**
- **Lien vers un contenu supprimé** : « Ce contenu n'existe plus », puis l'accueil.
- **Lien vers un bloc archivé** : il s'ouvre avec le bandeau d'archive.
- **Lieu récent ou favori supprimé depuis** : il disparaît sans erreur.
- **Lieu en cours supprimé** : le bouton central disparaît et le bouton de création redevient « ⊕ Nouveau ».
- **Recherche tolérante** aux accents, aux majuscules, aux tirets et aux variantes « st » / « saint ».
- **Nom de lieu très long** : il est tronqué dans la barre du bas, et entier sur la page.

**5. Critères de réussite, à transformer en tests**
- Ouvrir le lien d'une salle affiche cette salle, sans aucun tap.
- Avec Anglars en dernier lieu visité, Anglars s'ouvre en 1 tap depuis l'accueil, et une de ses voies en 2.
- Les recherches « angl », « st anto », « Saint-Antonin » et « marché » trouvent le bon lieu ou la bonne voie.
- Le bouton de création affiche « Nouveau bloc » après l'ouverture d'une salle, « Nouvelle voie » après celle d'un secteur, et « Nouveau » au premier lancement.
- Un invité utilise l'accueil, la recherche, les favoris et les liens.
- Le QR code généré mène à la bonne salle.
- Les parcours passent en vue Android et en vue iPhone.

**6. Hors périmètre**
- La carte des secteurs.
- La recherche « près de moi » par géolocalisation.
- La synchronisation des favoris entre appareils.
- La recherche par cotation.

**Référence visuelle :** maquette « TopoShare accueil » (lien à ajouter une fois partagée).

---

## Ticket 4 : noter les voies et les blocs

**1. Objectif**
Aider un grimpeur à choisir quoi grimper grâce à une note de 0 à 3 étoiles, comme dans les topos papier.

**2. Comportement attendu**
- **Sur la fiche** d'une voie ou d'un bloc, un grimpeur connecté choisit entre « Sans plus » (0), ★, ★★ et ★★★.
- **Modifier ou retirer** : il peut changer sa note ou la retirer à tout moment.
- **Affichage de la note** :
  - à partir de 3 votes, la fiche et la carte dans la liste affichent la moyenne en étoiles et le nombre d'avis, par exemple « ★★☆ 2,4 · 7 avis » ;
  - en dessous de 3 votes, la carte n'affiche rien et la fiche indique « 2 avis, note affichée à partir de 3 ».
- **Nouveau tri** dans les listes de blocs et de voies : « Mieux notés ».
- **Un invité** voit les notes. S'il touche les étoiles, l'écran de connexion s'ouvre.

**3. Règles métier et de sécurité**
- **Un seul vote** par grimpeur et par voie ou bloc, appliqué côté serveur.
- **Valeur** : un nombre entier de 0 à 3, rien d'autre.
- **Vote personnel** : chacun ne crée, ne modifie et ne supprime que son propre vote. Les votes individuels ne sont visibles que par leur auteur et l'admin.
- **Pas d'auto-notation** : l'auteur d'une voie ou d'un bloc ne peut pas le noter.
- **Moyenne fiable** : un vote ne peut compter qu'une fois, et la moyenne affichée ne doit pas pouvoir être faussée. Le mécanisme exact (calcul à la lecture ou compteurs protégés comme `methodCount`) est au choix de l'implémentation.
- **Suppression** : supprimer une voie ou un bloc supprime aussi ses votes.

**4. Cas limites**
- Un bloc archivé garde sa note affichée, mais ne peut plus être noté.
- Un grimpeur qui retire son vote fait repasser la note sous le seuil : elle disparaît de la carte.
- Le tri « Mieux notés » place les éléments avec moins de 3 votes en fin de liste.
- Deux votes simultanés sur le même élément ne se perdent pas.

**5. Critères de réussite, à transformer en tests**
- **Règles** :
  - un second vote du même grimpeur ne crée pas de doublon ;
  - les valeurs −1, 4 et 2,5 sont refusées ;
  - un invité ne peut pas voter ;
  - l'auteur ne peut pas noter son propre contenu ;
  - personne ne peut modifier le vote d'un autre.
- **Parcours** :
  - trois comptes votent 3, 2 et 2, et la fiche affiche « ★★☆ 2,3 · 3 avis » ;
  - le tri « Mieux notés » place cet élément en tête.
- Les parcours passent en vue Android et en vue iPhone.

**6. Hors périmètre**
- Les commentaires écrits.
- La note de difficulté ressentie (« plutôt 7a+ »).
- L'historique des votes.
- La note par longueur : la note reste au niveau de la voie.

---

## Ticket 6a : longueurs et vues d'une voie

**1. Objectif**
Décrire une voie en longueurs, chacune avec sa cotation, et permettre d'ajouter plusieurs photos (vues) par longueur : autre angle, ou deuxième longueur invisible depuis le bas.

**2. Comportement attendu**
- **Structure d'une voie** : une voie a une ou plusieurs longueurs (L1, L2…), chacune avec sa cotation. Chaque longueur a une ou plusieurs vues, par exemple « Vue d'ensemble » ou « L2 depuis le relais ».
- **Une vue**, c'est une photo, un libellé, et des points d'ancrage et un relais placés sur cette photo.
- **Une voie d'une seule longueur** se comporte exactement comme aujourd'hui.
- **Sur la fiche de la voie** :
  - des onglets **L1 · L2 · …** affichent la cotation de chaque longueur ;
  - dans chaque longueur, on fait défiler ses vues ;
  - la cotation de la voie affichée dans les listes est celle de la longueur la plus dure.
- **Bouton « Ajouter une vue »** pour tout grimpeur connecté : il choisit la longueur, prend la photo, place les points et donne un libellé.
- **Auteur de la voie et admin** : ils ajoutent, renomment et recotent les longueurs, et changent l'ordre des longueurs et des vues.

**3. Règles métier et de sécurité**
- **Structure de la voie** (nom, longueurs, cotations, ordre) : seuls l'auteur de la voie et l'admin peuvent la modifier.
- **Une vue** :
  - tout grimpeur connecté peut en créer une sur une longueur existante ;
  - seul son auteur, ou l'admin, peut la modifier ;
  - les points d'ancrage sont propres à chaque vue, sans lien entre vues.
- **Suppression d'une vue** : son auteur peut la supprimer, sauf si la méthode d'un autre grimpeur l'utilise. Dans ce cas, seul l'admin peut la supprimer.
- **Suppression d'une longueur** : elle est réservée à l'auteur de la voie et à l'admin, et seulement si aucune méthode d'un autre grimpeur ne l'utilise. Sinon, seul l'admin peut la supprimer.
- **Migration** : chaque voie existante devient une voie à une longueur L1, avec sa cotation, et une vue « Vue d'ensemble » qui garde sa photo et ses points. Aucune méthode existante ne doit être cassée.
- **Contrôle côté serveur** : tous les refus sont appliqués par les règles Firestore.

**4. Cas limites**
- Une voie dont la seule vue est supprimée par l'admin affiche « Pas encore de photo » et un bouton pour en ajouter une.
- Une nouvelle vue s'ajoute en fin de liste, en attendant que l'auteur de la voie la range.
- Une vue d'ensemble couvre plusieurs longueurs : elle est rattachée à L1 pour l'instant.
- L'auteur de la voie n'est plus actif : l'admin garde la main sur la structure.

**5. Critères de réussite, à transformer en tests**
- **Migration** : toutes les voies existantes s'affichent comme avant, avec leurs méthodes intactes.
- **Règles** :
  - un grimpeur non auteur ajoute une vue, mais ne peut pas ajouter de longueur ni changer une cotation ;
  - il ne peut pas modifier la vue d'un autre ;
  - l'auteur ne peut pas supprimer une vue utilisée par la méthode d'un autre, l'admin le peut.
- **Parcours** :
  - l'auteur crée L2 en 6c+ ;
  - un autre grimpeur ajoute une vue « L2 depuis le relais » ;
  - la liste affiche la cotation la plus dure de la voie.
- Les parcours passent en vue Android et en vue iPhone.

**6. Hors périmètre**
- Les méthodes sur plusieurs vues (ticket 6b).
- Une vue rattachée à plusieurs longueurs.
- Le lien automatique d'un même point d'ancrage entre deux vues.
- La note par longueur.

---

## Ticket 6b : méthodes et répétition sur plusieurs vues

**1. Objectif**
Permettre qu'une méthode enchaîne des prises sur plusieurs vues et longueurs, et que la répétition passe d'une photo à l'autre.

**2. Comportement attendu**
- **Dans l'éditeur de méthode**, des onglets de vues apparaissent en haut. Chaque prise posée est rattachée à la vue affichée, et l'ordre global des prises est conservé.
- **Pendant la répétition**, quand l'étape suivante est sur une autre vue, la photo change avec un court bandeau « L2 · Vue depuis le relais », puis le zoom reprend sur la prise.
- **Sur la fiche**, une méthode n'affiche, sur chaque vue, que les prises de cette vue.

**3. Règles métier et de sécurité**
- **Rattachement** : une prise ne peut viser qu'une vue de la même voie.
- **Inchangé** : les règles des méthodes privées (ticket 3) et de « une méthode par grimpeur et par voie » restent valables.
- **Migration** : les prises existantes sont rattachées à la vue « Vue d'ensemble ».

**4. Cas limites**
- Une vue supprimée par l'admin : les prises de cette vue disparaissent de la méthode. L'auteur de la méthode voit un message « X prises étaient sur une vue supprimée ».
- L'insertion au milieu d'une méthode, déjà en place, fonctionne aussi quand on change de vue.
- Une méthode n'a des prises que sur L2 : la répétition commence directement sur L2.

**5. Critères de réussite, à transformer en tests**
- Une méthode avec des prises sur L1 puis sur L2 se répète dans le bon ordre et change de photo au bon moment.
- Une prise rattachée à une vue d'une autre voie est refusée.
- Les méthodes migrées se répètent comme avant.
- Les parcours passent en vue Android et en vue iPhone.

**6. Hors périmètre**
- Les manipulations de corde et de relais (rappel, relais intermédiaire) dans la répétition.
- L'indicateur « clip », qui reste au backlog.

---

## Backlog restant (non spécifié)

- Suggestions de modification validées par l'ouvreur.
- Profils d'ouvreurs, commentaires.
- Import de vidéo de drone pour tracer une voie.
- Indicateur « clip » dans les méthodes falaise.
- Niveau « site » entre commune et secteur.
- Fusion de secteurs en doublon.
- Carte des secteurs, recherche « près de moi ».
