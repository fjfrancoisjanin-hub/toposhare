// Traduction de l'interface TopoShare : français (langue source), anglais, espagnol.
// Le texte affiché est traduit à la volée ; les contenus saisis par les grimpeurs (noms de blocs, de voies,
// de salles, de secteurs, prénoms, consignes, notes) ne sont jamais traduits.
(function () {
  const LANGS = { fr: "Français", en: "English", es: "Español" };
  const LOCALES = { fr: "fr-FR", en: "en-GB", es: "es-ES" };
  const pick = () => {
    try { const s = localStorage.getItem("ts-lang"); if (LANGS[s]) return s; } catch {}
    const n = (navigator.language || "fr").slice(0, 2).toLowerCase();
    return n === "es" ? "es" : n === "en" ? "en" : n === "fr" ? "fr" : "en";
  };
  let LANG = pick();

  // [français, anglais, espagnol]
  const E = [
    ["Afficher", "Show", "Mostrar"],
    ["Annuler", "Cancel", "Cancelar"],
    ["Avancer ▶", "Forward ▶", "Avanzar ▶"],
    ["Cadrez la voie entière, du pied au relais, bien de face. Une photo par voie : c'est ce qui la rend lisible.", "Frame the whole route, from the ground to the anchor, straight on. One photo per route keeps it readable.", "Encuadra la vía entera, del pie a la reunión, de frente. Una foto por vía: así se lee bien."],
    ["Ce bloc était tracé sur un ancien mur, démonté depuis. Il reste consultable en archive.", "This boulder was set on an old wall that has since been taken down. It stays viewable in the archive.", "Este bloque se trazó en un muro antiguo, ya desmontado. Sigue disponible en el archivo."],
    ["Changer de salle", "Change gym", "Cambiar de rocódromo"],
    ["Chargement…", "Loading…", "Cargando…"],
    ["Confirmer la suppression", "Confirm deletion", "Confirmar eliminación"],
    ["Consignes (optionnel)", "Rules (optional)", "Consignas (opcional)"],
    ["Cotation", "Grade", "Grado"],
    ["Départ", "Start", "Salida"],
    ["Effacer les prises", "Clear holds", "Borrar presas"],
    ["Enregistrer", "Save", "Guardar"],
    ["Faire ressortir", "Highlight", "Resaltar"],
    ["Falaise", "Crag", "Roca"],
    ["Fermer", "Close", "Cerrar"],
    ["Fermer sans publier", "Close without publishing", "Cerrar sin publicar"],
    ["Filtrer", "Filter", "Filtrar"],
    ["Garder en brouillon", "Save as draft", "Guardar como borrador"],
    ["Grimpeur", "Climber", "Escalador"],
    ["Impossible de joindre la base. Vérifiez votre connexion puis rechargez la page.", "Can't reach the database. Check your connection, then reload the page.", "No se puede conectar con la base de datos. Revisa tu conexión y recarga la página."],
    ["Main", "Hand", "Mano"],
    ["Mains", "Hands", "Manos"],
    ["Mains, dans l'ordre", "Hands, in order", "Manos, en orden"],
    ["Modifier le bloc", "Edit boulder", "Editar bloque"],
    ["Mur en plein écran", "Wall in full screen", "Muro a pantalla completa"],
    ["Nom de la voie", "Route name", "Nombre de la vía"],
    ["Nom du bloc", "Boulder name", "Nombre del bloque"],
    ["Notes de méthode (optionnel)", "Beta notes (optional)", "Notas del método (opcional)"],
    ["Nouveau bloc", "New boulder", "Nuevo bloque"],
    ["Ouvreur", "Setter", "Trazador"],
    ["Partage tes voies, prise par prise.", "Share your routes, hold by hold.", "Comparte tus vías, presa a presa."],
    ["Photographier la voie", "Photograph the route", "Fotografiar la vía"],
    ["Pied", "Foot", "Pie"],
    ["Pieds", "Feet", "Pies"],
    ["Pincez pour zoomer, glissez pour vous déplacer. Touchez les prises dans l'ordre de la montée : les mains sont numérotées au fur et à mesure.", "Pinch to zoom, drag to move around. Tap the holds in climbing order: hands are numbered as you go.", "Pellizca para hacer zoom y desliza para moverte. Toca las presas en el orden de subida: las manos se numeran sobre la marcha."],
    ["Point d'ancrage", "Bolt", "Chapa"],
    ["Points d'ancrage", "Bolts", "Chapas"],
    ["Prendre ou choisir une photo", "Take or choose a photo", "Hacer o elegir una foto"],
    ["Publier le bloc", "Publish boulder", "Publicar bloque"],
    ["Retour à la liste", "Back to the list", "Volver a la lista"],
    ["Salle", "Gym", "Rocódromo"],
    ["Se connecter", "Sign in", "Iniciar sesión"],
    ["Suivant ▶", "Next ▶", "Siguiente ▶"],
    ["↺ Recommencer", "↺ Start over", "↺ Volver a empezar"],
    ["Supprimer ce bloc", "Delete this boulder", "Eliminar este bloque"],
    ["Supprimer le brouillon", "Delete draft", "Eliminar borrador"],
    ["Tracer un bloc", "Set a boulder", "Trazar un bloque"],
    ["Une idée, un bug ? Donnez votre avis", "An idea, a bug? Send feedback", "¿Una idea, un fallo? Danos tu opinión"],
    ["Voir la voie en plein écran", "View route full screen", "Ver la vía a pantalla completa"],
    ["Voir le bloc en plein écran", "View boulder full screen", "Ver el bloque a pantalla completa"],
    ["Votre prénom", "Your first name", "Tu nombre"],
    ["ex. Assis départ, pieds marqués uniquement", "e.g. Sit start, marked feet only", "ej. Salida sentado, solo pies marcados"],
    ["ex. La réglette du lundi", "e.g. Monday crimp", "ej. La regleta del lunes"],
    ["ex. Repos genou après le 3e point, crux entre le 4e et le 5e", "e.g. Knee-bar rest after the 3rd bolt, crux between the 4th and 5th", "ej. Reposo de rodilla tras la 3.ª chapa, paso clave entre la 4.ª y la 5.ª"],
    ["ex. J'aimerais pouvoir filtrer les blocs par ouvreur", "e.g. I'd like to filter boulders by setter", "ej. Me gustaría filtrar los bloques por trazador"],
    ["▶ Répéter le bloc", "▶ Replay the boulder", "▶ Repasar el bloque"],
    ["▶ Répéter la voie", "▶ Replay the route", "▶ Repasar la vía"],
    ["◀ Précédent", "◀ Previous", "◀ Anterior"],
    ["◀ Revenir", "◀ Back", "◀ Atrás"],
    ["⤢ Plein écran", "⤢ Full screen", "⤢ Pantalla completa"],
    ["Type de prise", "Hold type", "Tipo de presa"],
    ["Mon compte", "My account", "Mi cuenta"],
    // filtres et listes
    ["Tous", "All", "Todos"],
    ["7a et +", "7a and up", "7a y más"],
    ["Mes blocs", "My boulders", "Mis bloques"],
    ["Archives", "Archive", "Archivo"],
    ["Archivé", "Archived", "Archivado"],
    ["Ouvreur inconnu", "Unknown setter", "Trazador desconocido"],
    ["Ancien mur", "Old wall", "Muro antiguo"],
    ["Brouillon", "Draft", "Borrador"],
    ["Visibles par vous seul. Touchez un brouillon pour le terminer et le publier.", "Only you can see these. Tap a draft to finish and publish it.", "Solo tú los ves. Toca un borrador para terminarlo y publicarlo."],
    ["Chargement des blocs…", "Loading boulders…", "Cargando bloques…"],
    ["Choisissez votre salle", "Choose your gym", "Elige tu rocódromo"],
    ["Sélectionnez une salle existante ou ajoutez la vôtre avec une photo de son mur.", "Pick an existing gym or add yours with a photo of its wall.", "Elige un rocódromo existente o añade el tuyo con una foto de su muro."],
    ["Choisir une salle", "Choose a gym", "Elegir rocódromo"],
    ["Pas encore de photo du mur", "No wall photo yet", "Aún no hay foto del muro"],
    ["Prenez le pan en photo pour que la salle puisse tracer ses blocs.", "Take a photo of the wall so the gym can start setting boulders.", "Haz una foto del muro para que el rocódromo pueda trazar sus bloques."],
    ["Ajouter la photo du mur", "Add the wall photo", "Añadir la foto del muro"],
    ["Aucun bloc sur ce mur", "No boulders on this wall yet", "Aún no hay bloques en este muro"],
    ["Tracez le premier : touchez les prises dans l'ordre, choisissez la cotation, publiez. Il apparaîtra ici pour toute la salle.", "Set the first one: tap the holds in order, pick a grade, publish. It will show up here for the whole gym.", "Traza el primero: toca las presas en orden, elige el grado y publica. Aparecerá aquí para todo el rocódromo."],
    ["Tracer le premier bloc", "Set the first boulder", "Trazar el primer bloque"],
    ["Aucun bloc pour ce filtre.", "No boulders for this filter.", "No hay bloques con este filtro."],
    ["Pas de photo du mur", "No wall photo", "Sin foto del muro"],
    // éditeur de bloc
    ["Reprendre à la fin", "Back to the end", "Volver al final"],
    ["Départ posé. Touchez maintenant les mains dans l'ordre.", "Start placed. Now tap the hands in order.", "Salida colocada. Ahora toca las manos en orden."],
    ["Annuler la dernière prise", "Undo last hold", "Deshacer la última presa"],
    ["Moves", "Moves", "Movs."],
    ["Prochaine prise insérée au début du bloc", "Next hold goes at the start of the boulder", "La próxima presa irá al inicio del bloque"],
    ["Ce bloc est sur un ancien mur : il ne peut plus être modifié.", "This boulder is on an old wall: it can no longer be edited.", "Este bloque está en un muro antiguo: ya no se puede editar."],
    ["Reprendre le brouillon", "Resume draft", "Retomar el borrador"],
    ["Enregistrer les modifications", "Save changes", "Guardar cambios"],
    ["Mettre à jour le brouillon", "Update draft", "Actualizar borrador"],
    ["Annuler les modifications", "Discard changes", "Descartar cambios"],
    ["Brouillon supprimé", "Draft deleted", "Borrador eliminado"],
    ["Suppression impossible", "Couldn't delete", "No se pudo eliminar"],
    ["Le brouillon est vide : posez au moins une prise.", "The draft is empty: place at least one hold.", "El borrador está vacío: coloca al menos una presa."],
    ["Brouillon enregistré. Retrouvez-le dans « Mes brouillons ».", "Draft saved. Find it under “My drafts”.", "Borrador guardado. Lo encontrarás en «Mis borradores»."],
    ["Le brouillon n'a pas pu être enregistré. Réessayez.", "The draft couldn't be saved. Try again.", "No se pudo guardar el borrador. Inténtalo de nuevo."],
    ["Cette salle n'a pas encore de photo du mur.", "This gym has no wall photo yet.", "Este rocódromo aún no tiene foto del muro."],
    ["Ajoutez au moins une prise de départ.", "Add at least one start hold.", "Añade al menos una presa de salida."],
    ["Ajoutez la prise du top.", "Add the top hold.", "Añade la presa de top."],
    ["Un bloc compte au moins 3 prises.", "A boulder needs at least 3 holds.", "Un bloque necesita al menos 3 presas."],
    ["Donnez un nom au bloc.", "Give the boulder a name.", "Ponle un nombre al bloque."],
    ["Indiquez le nom de l'ouvreur.", "Enter the setter's name.", "Indica el nombre del trazador."],
    ["Modifications enregistrées", "Changes saved", "Cambios guardados"],
    ["Bloc publié", "Boulder published", "Bloque publicado"],
    ["Enregistrement refusé : vous n'avez pas les droits d'écriture sur ce pan.", "Save refused: you don't have write access to this wall.", "Guardado rechazado: no tienes permiso de escritura en este muro."],
    ["Enregistrement impossible pour l'instant. Réessayez dans un instant.", "Can't save right now. Try again in a moment.", "No se puede guardar ahora. Inténtalo en un momento."],
    ["Enregistrement impossible pour l'instant. Réessayez.", "Can't save right now. Try again.", "No se puede guardar ahora. Inténtalo de nuevo."],
    ["Introuvable", "Not found", "No encontrado"],
    // plein écran et répétition
    ["Ma méthode", "My beta", "Mi método"],
    ["pincez pour zoomer", "pinch to zoom", "pellizca para hacer zoom"],
    ["Terminé", "Done", "Listo"],
    ["Tracer", "Set", "Trazar"],
    ["pieds imposés en jaune", "set feet in yellow", "pies obligatorios en amarillo"],
    // fiche bloc
    ["Bloc introuvable", "Boulder not found", "Bloque no encontrado"],
    ["Il a peut-être été supprimé.", "It may have been deleted.", "Puede que se haya eliminado."],
    ["un grimpeur", "a climber", "un escalador"],
    ["pieds libres", "feet free", "pies libres"],
    ["Bloc supprimé", "Boulder deleted", "Bloque eliminado"],
    ["Suppression refusée", "Deletion refused", "Eliminación rechazada"],
    // salles et murs
    ["L'envoi de photos n'est pas disponible avec votre accès à cette page.", "Photo upload isn't available with your access to this page.", "El envío de fotos no está disponible con tu acceso a esta página."],
    ["Ajouter une salle", "Add a gym", "Añadir un rocódromo"],
    ["Nom de la salle", "Gym name", "Nombre del rocódromo"],
    ["Ville", "City", "Ciudad"],
    ["Nom du mur", "Wall name", "Nombre del muro"],
    ["Prenez le mur bien de face, en entier, avec un bon éclairage. La photo devient le support de tous les blocs.", "Shoot the whole wall straight on, in good light. This photo becomes the base for every boulder.", "Fotografía el muro entero, de frente y con buena luz. La foto será la base de todos los bloques."],
    ["Prenez le mur bien de face, en entier, avec un bon éclairage.", "Shoot the whole wall straight on, in good light.", "Fotografía el muro entero, de frente y con buena luz."],
    ["Photographier le mur et créer", "Photograph the wall and create", "Fotografiar el muro y crear"],
    ["Photographier le nouveau mur", "Photograph the new wall", "Fotografiar el muro nuevo"],
    ["Donnez un nom à la salle.", "Give the gym a name.", "Ponle un nombre al rocódromo."],
    ["Envoi de la photo…", "Uploading photo…", "Enviando la foto…"],
    ["La création a échoué. Vérifiez la photo et réessayez.", "Creation failed. Check the photo and try again.", "No se pudo crear. Revisa la foto e inténtalo de nuevo."],
    ["La création a échoué. Réessayez.", "Creation failed. Try again.", "No se pudo crear. Inténtalo de nuevo."],
    ["Le mur a été remonté", "The wall has been reset", "El muro se ha vuelto a montar"],
    ["Une nouvelle photo remplace la précédente. Les", "A new photo replaces the previous one. The", "Una foto nueva sustituye a la anterior. Los"],
    ["Il n'y a aucun bloc à archiver.", "There are no boulders to archive.", "No hay bloques que archivar."],
    ["Nouveau mur en place. Les anciens blocs sont archivés.", "New wall in place. Old boulders are archived.", "Muro nuevo listo. Los bloques antiguos están archivados."],
    ["Le changement de mur a échoué. Réessayez.", "The wall change failed. Try again.", "No se pudo cambiar el muro. Inténtalo de nuevo."],
    ["Salles", "Gyms", "Rocódromos"],
    ["Sélectionnée", "Selected", "Seleccionado"],
    ["Sélectionné", "Selected", "Seleccionado"],
    ["Choisir", "Choose", "Elegir"],
    ["Aucune salle pour l'instant.", "No gyms yet.", "Aún no hay rocódromos."],
    ["+ Ajouter une salle", "+ Add a gym", "+ Añadir un rocódromo"],
    ["Actuel", "Current", "Actual"],
    ["Démonté", "Taken down", "Desmontado"],
    ["Aucune photo du mur.", "No wall photo.", "Sin foto del muro."],
    ["Le mur a été remonté : nouvelle photo", "The wall was reset: new photo", "El muro se ha cambiado: foto nueva"],
    // onglets et en-tête
    ["Bloc en cours", "Boulder in progress", "Bloque en curso"],
    ["Nouvelle voie", "New route", "Nueva vía"],
    ["Choisir un secteur", "Choose a sector", "Elegir un sector"],
    ["Impossible de charger les blocs pour l'instant.", "Couldn't load boulders right now.", "No se pudieron cargar los bloques."],
    ["Impossible de charger les voies pour l'instant.", "Couldn't load routes right now.", "No se pudieron cargar las vías."],
    // falaise
    ["La falaise, voie par voie", "The crag, route by route", "La roca, vía a vía"],
    ["Choisissez un secteur ou créez-le, puis ajoutez la photo d'une voie, ses points d'ancrage et votre méthode.", "Pick a sector or create it, then add a route photo, its bolts and your beta.", "Elige un sector o créalo, y añade la foto de una vía, sus chapas y tu método."],
    ["Aucune voie dans ce secteur", "No routes in this sector yet", "Aún no hay vías en este sector"],
    ["Photographiez une voie, placez ses points d'ancrage et le relais. Chacun pourra ensuite y ajouter sa méthode.", "Photograph a route, place its bolts and the anchor. Everyone can then add their own beta.", "Fotografía una vía, coloca sus chapas y la reunión. Después cada uno podrá añadir su método."],
    ["Ajouter la première voie", "Add the first route", "Añadir la primera vía"],
    ["Points seuls", "Bolts only", "Solo chapas"],
    ["aucune méthode partagée", "no shared beta yet", "ningún método compartido"],
    ["Modifier ma méthode", "Edit my beta", "Editar mi método"],
    ["Ajouter ma méthode", "Add my beta", "Añadir mi método"],
    ["Modifier les points", "Edit bolts", "Editar chapas"],
    ["Supprimer ma méthode", "Delete my beta", "Eliminar mi método"],
    ["Supprimer cette méthode", "Delete this beta", "Eliminar este método"],
    ["Supprimer la voie (admin)", "Delete route (admin)", "Eliminar la vía (admin)"],
    ["Méthode supprimée", "Beta deleted", "Método eliminado"],
    ["Confirmer : voie et méthodes", "Confirm: route and betas", "Confirmar: vía y métodos"],
    ["Voie supprimée", "Route deleted", "Vía eliminada"],
    ["Voie introuvable", "Route not found", "Vía no encontrada"],
    ["Point", "Bolt", "Chapa"],
    ["Points", "Bolts", "Chapas"],
    ["Relais", "Anchor", "Reunión"],
    ["oui", "yes", "sí"],
    ["non", "no", "no"],
    ["Annuler le dernier repère", "Undo last mark", "Deshacer la última marca"],
    ["Prochain point inséré en bas de la voie", "Next bolt goes at the bottom of the route", "La próxima chapa irá al pie de la vía"],
    ["Prochain repère inséré au début", "Next mark goes at the start", "La próxima marca irá al inicio"],
    ["Touchez chaque point d'ancrage du bas vers le haut, puis le relais. Ces repères sont communs à tous les grimpeurs.", "Tap each bolt from bottom to top, then the anchor. These marks are shared by all climbers.", "Toca cada chapa de abajo arriba y luego la reunión. Estas marcas son comunes a todos."],
    ["Touchez mains et pieds dans l'ordre où vous les prenez. Vous pouvez enregistrer une partie et compléter à la prochaine sortie.", "Tap hands and feet in the order you use them. You can save part of it and finish on your next trip.", "Toca manos y pies en el orden en que los usas. Puedes guardar una parte y completarla en la próxima salida."],
    ["Enregistrer les points", "Save bolts", "Guardar chapas"],
    ["Publier la voie", "Publish route", "Publicar vía"],
    ["Enregistrer ma méthode", "Save my beta", "Guardar mi método"],
    ["Cette photo n'a pas pu être lue. Essayez-en une autre.", "This photo couldn't be read. Try another one.", "No se pudo leer esta foto. Prueba con otra."],
    ["Donnez un nom à la voie.", "Give the route a name.", "Ponle un nombre a la vía."],
    ["Placez au moins un point d'ancrage.", "Place at least one bolt.", "Coloca al menos una chapa."],
    ["Points enregistrés", "Bolts saved", "Chapas guardadas"],
    ["Voie publiée. Ajoutez maintenant votre méthode.", "Route published. Now add your beta.", "Vía publicada. Ahora añade tu método."],
    ["Placez au moins une prise.", "Place at least one hold.", "Coloca al menos una presa."],
    ["Indiquez votre prénom.", "Enter your first name.", "Indica tu nombre."],
    ["Modifier", "Edit", "Editar"],
    ["Modifier la salle", "Edit gym", "Editar rocódromo"],
    ["Modifier le secteur", "Edit sector", "Editar sector"],
    ["Modifier la voie", "Edit route", "Editar vía"],
    ["Modifier l'ouvreur", "Edit setter", "Editar trazador"],
    ["Modifier le prénom", "Edit first name", "Editar nombre"],
    ["Commune", "Town", "Municipio"],
    ["Ajoutée par", "Added by", "Añadida por"],
    ["Ouvert par", "Set by", "Trazado por"],
    ["Ce champ ne peut pas être vide.", "This field can't be empty.", "Este campo no puede estar vacío."],
    ["Un autre secteur porte déjà ce nom dans cette commune.", "Another sector already has this name in this town.", "Otro sector ya tiene este nombre en este municipio."],
    ["Modification enregistrée", "Change saved", "Cambio guardado"],
    ["Méthode enregistrée", "Beta saved", "Método guardado"],
    ["Touchez un point d'ancrage pour placer le clip.", "Tap a bolt to place the clip.", "Toca una chapa para colocar el chapaje."],
    // secteurs
    ["Nouveau secteur", "New sector", "Nuevo sector"],
    ["Nom du secteur", "Sector name", "Nombre del sector"],
    ["Nom du secteur sur le topo", "Sector name in the guidebook", "Nombre del sector en la guía"],
    ["Site ou commune", "Crag or town", "Escuela o municipio"],
    ["Créer le secteur", "Create sector", "Crear sector"],
    ["Secteurs de falaise", "Crag sectors", "Sectores de roca"],
    ["Aucun secteur pour l'instant. Créez le premier.", "No sectors yet. Create the first one.", "Aún no hay sectores. Crea el primero."],
    ["+ Ajouter un secteur", "+ Add a sector", "+ Añadir un sector"],
    ["Donnez un nom au secteur.", "Give the sector a name.", "Ponle un nombre al sector."],
    // connexion, compte, avis
    ["ajouter une voie", "add a route", "añadir una vía"],
    ["publier un bloc", "publish a boulder", "publicar un bloque"],
    ["garder un brouillon", "save a draft", "guardar un borrador"],
    ["publier", "publish", "publicar"],
    ["enregistrer", "save", "guardar"],
    ["créer un secteur", "create a sector", "crear un sector"],
    ["envoyer une photo", "upload a photo", "enviar una foto"],
    ["publier vos blocs et vos voies", "publish your boulders and routes", "publicar tus bloques y vías"],
    ["Consulter TopoShare reste libre. Pour ajouter du contenu, on vous demande simplement de vous identifier avec votre compte Google.", "Browsing TopoShare stays open to everyone. To add content, you just need to sign in with your Google account.", "Consultar TopoShare es libre. Para añadir contenido, solo tienes que identificarte con tu cuenta de Google."],
    ["Pas de compte à créer.", "No account to create.", "Sin crear cuenta."],
    ["Un tap avec le compte Google que vous avez déjà.", "One tap with the Google account you already have.", "Un toque con la cuenta de Google que ya tienes."],
    ["Gratuit.", "Free.", "Gratis."],
    ["Rien à payer, ni maintenant ni plus tard.", "Nothing to pay, now or later.", "Nada que pagar, ni ahora ni después."],
    ["Discret.", "Discreet.", "Discreto."],
    ["Votre prénom signe vos blocs, voies et méthodes. Aucune publicité, aucun e-mail envoyé.", "Your first name signs your boulders, routes and betas. No ads, no emails.", "Tu nombre firma tus bloques, vías y métodos. Sin publicidad ni correos."],
    ["Votre travail est gardé.", "Your work is kept.", "Tu trabajo se conserva."],
    ["Les prises déjà posées restent en place pendant la connexion.", "Holds you've already placed stay put while you sign in.", "Las presas ya colocadas se mantienen mientras inicias sesión."],
    ["Google affiche ensuite sa page de connexion avec l'adresse « betatheque.firebaseapp.com » : c'est l'adresse technique de TopoShare.", "Google then shows its sign-in page with the address “betatheque.firebaseapp.com”: that's TopoShare's technical address.", "Después Google muestra su página de inicio de sesión con la dirección «betatheque.firebaseapp.com»: es la dirección técnica de TopoShare."],
    ["Continuer avec Google", "Continue with Google", "Continuar con Google"],
    ["Plus tard", "Later", "Más tarde"],
    ["La connexion n'a pas abouti. Réessayez.", "Sign-in didn't go through. Try again.", "No se pudo iniciar sesión. Inténtalo de nuevo."],
    ["Donner mon avis", "Send feedback", "Dar mi opinión"],
    ["Une idée, un bug, une fonction qui manque ? Tout est lu.", "An idea, a bug, a missing feature? Everything gets read.", "¿Una idea, un fallo, una función que falta? Lo leemos todo."],
    ["Votre message", "Your message", "Tu mensaje"],
    ["Prénom (optionnel)", "First name (optional)", "Nombre (opcional)"],
    ["Envoyer", "Send", "Enviar"],
    ["Connecté en tant que", "Signed in as", "Sesión iniciada como"],
    ["Suivi d'activité", "Activity", "Actividad"],
    ["Se déconnecter", "Sign out", "Cerrar sesión"],
    ["Déconnecté", "Signed out", "Sesión cerrada"],
    ["Écrivez votre message avant d'envoyer.", "Write your message before sending.", "Escribe tu mensaje antes de enviarlo."],
    ["Merci, votre avis est bien arrivé", "Thanks, your feedback was received", "Gracias, hemos recibido tu opinión"],
    ["L'envoi a échoué. Réessayez dans un instant.", "Sending failed. Try again in a moment.", "No se pudo enviar. Inténtalo en un momento."],
    // dates relatives
    ["aujourd'hui", "today", "hoy"],
    ["hier", "yesterday", "ayer"],
    // sélecteur de langue
    ["Langue", "Language", "Idioma"],
    ["Environnement de test", "Test environment", "Entorno de prueba"],
  ];
  const MAP = { en: new Map(), es: new Map() };
  for (const [fr, en, es] of E) { MAP.en.set(fr, en); MAP.es.set(fr, es); }

  const pl = (n, one, many) => (+n > 1 ? many : one);
  const sub = g => look(g) ?? g;
  // [motif français, anglais(m), espagnol(m)]
  const P = [
    [/^(\d+) moves?$/, m => `${m[1]} move${pl(m[1], "", "s")}`, m => `${m[1]} movimiento${pl(m[1], "", "s")}`],
    [/^(\d+) pieds? imposés?$/, m => `${m[1]} set ${pl(m[1], "foot", "feet")}`, m => `${m[1]} pie${pl(m[1], "", "s")} obligatorio${pl(m[1], "", "s")}`],
    [/^(\d+) prises?$/, m => `${m[1]} hold${pl(m[1], "", "s")}`, m => `${m[1]} presa${pl(m[1], "", "s")}`],
    [/^(\d+) blocs?$/, m => `${m[1]} boulder${pl(m[1], "", "s")}`, m => `${m[1]} bloque${pl(m[1], "", "s")}`],
    [/^(\d+) voies?$/, m => `${m[1]} route${pl(m[1], "", "s")}`, m => `${m[1]} vía${pl(m[1], "", "s")}`],
    [/^(\d+) points?$/, m => `${m[1]} bolt${pl(m[1], "", "s")}`, m => `${m[1]} chapa${pl(m[1], "", "s")}`],
    [/^(\d+) méthodes?$/, m => `${m[1]} beta${pl(m[1], "", "s")}`, m => `${m[1]} método${pl(m[1], "", "s")}`],
    [/^(\d+) méthodes? partagées?$/, m => `${m[1]} shared beta${pl(m[1], "", "s")}`, m => `${m[1]} método${pl(m[1], "", "s")} compartido${pl(m[1], "", "s")}`],
    [/^(\d+) points? d'ancrage( \+ relais)?$/, m => `${m[1]} bolt${pl(m[1], "", "s")}${m[2] ? " + anchor" : ""}`, m => `${m[1]} chapa${pl(m[1], "", "s")}${m[2] ? " + reunión" : ""}`],
    [/^(\d+) mains$/, m => `${m[1]} hands`, m => `${m[1]} manos`],
    [/^il y a (\d+) j$/, m => `${m[1]} d ago`, m => `hace ${m[1]} d`],
    [/^Environnement de test · PR #(\d+)$/, m => `Test environment · PR #${m[1]}`, m => `Entorno de prueba · PR #${m[1]}`],
    [/^Ouvert par (.+)$/, m => `Set by ${sub(m[1])}`, m => `Trazado por ${sub(m[1])}`],
    [/^modifié le (.+)$/, m => `edited ${m[1]}`, m => `editado el ${m[1]}`],
    [/^ajoutée par (.+)$/, m => `added by ${sub(m[1])}`, m => `añadida por ${sub(m[1])}`],
    [/^photo du (.+)$/, m => `photo from ${m[1]}`, m => `foto del ${m[1]}`],
    [/^Murs de (.+)$/, m => `Walls at ${m[1]}`, m => `Muros de ${m[1]}`],
    [/^Méthode de (.+?)( \(vous\))?$/, m => `${m[1]}'s beta${m[2] ? " (you)" : ""}`, m => `Método de ${m[1]}${m[2] ? " (tú)" : ""}`],
    [/^méthode de (.+)$/, m => `${m[1]}'s beta`, m => `método de ${m[1]}`],
    [/^Modifier « (.+) »$/, m => `Edit “${m[1]}”`, m => `Editar «${m[1]}»`],
    [/^Connectez-vous pour (.+?)\. Votre travail est conservé\.$/, m => `Sign in to ${sub(m[1])}. Your work is kept.`, m => `Inicia sesión para ${sub(m[1])}. Tu trabajo se conserva.`],
    [/^Connectez-vous pour (.+)$/, m => `Sign in to ${sub(m[1])}`, m => `Inicia sesión para ${sub(m[1])}`],
    [/^Connecté : (.+)$/, m => `Signed in: ${m[1]}`, m => `Sesión iniciada: ${m[1]}`],
    [/^Secteur (.+) créé$/, m => `Sector ${m[1]} created`, m => `Sector ${m[1]} creado`],
    [/^(.+) est prête : tracez le premier bloc$/, m => `${m[1]} is ready: set the first boulder`, m => `${m[1]} está listo: traza el primer bloque`],
    [/^(\d+) prises « (.+) » maximum$/, m => `${m[1]} “${sub(m[2])}” holds max`, m => `${m[1]} presas «${sub(m[2])}» como máximo`],
    [/^Prochaine prise insérée après le move (\d+)$/, m => `Next hold goes after move ${m[1]}`, m => `La próxima presa irá tras el movimiento ${m[1]}`],
    [/^Prochain point inséré après le point (\d+)$/, m => `Next bolt goes after bolt ${m[1]}`, m => `La próxima chapa irá tras la chapa ${m[1]}`],
    [/^Prochain repère inséré après le move (\d+)$/, m => `Next mark goes after move ${m[1]}`, m => `La próxima marca irá tras el movimiento ${m[1]}`],
    [/^[Mm]ove (\d+) \/ (\d+)$/, m => `Move ${m[1]} / ${m[2]}`, m => `Movimiento ${m[1]} / ${m[2]}`],
    [/^étape (\d+) \/ (\d+)$/, m => `step ${m[1]} / ${m[2]}`, m => `paso ${m[1]} / ${m[2]}`],
    [/^Mes brouillons \((\d+)\)$/, m => `My drafts (${m[1]})`, m => `Mis borradores (${m[1]})`],
    [/^actuels? passeront en archives, grisés mais consultables\.$/, () => "currently on the wall will move to the archive, greyed out but still viewable.", () => "actuales pasarán al archivo, en gris pero consultables."],
    [/^Photo du mur avec (\d+) prises marquées$/, m => `Wall photo with ${m[1]} marked hold${pl(m[1], "", "s")}`, m => `Foto del muro con ${m[1]} presa${pl(m[1], "", "s")} marcada${pl(m[1], "", "s")}`],
    [/^Photo de la voie avec (\d+) points et (\d+) étapes$/, m => `Route photo with ${m[1]} bolts and ${m[2]} steps`, m => `Foto de la vía con ${m[1]} chapas y ${m[2]} pasos`],
    [/^ex\. (.+)$/, m => `e.g. ${m[1]}`, m => `ej. ${m[1]}`],
  ];

  function look(k) {
    if (LANG === "fr") return null;
    const hit = MAP[LANG].get(k);
    if (hit != null) return hit;
    for (const [re, en, es] of P) { const m = k.match(re); if (m) return (LANG === "en" ? en : es)(m); }
    if (k.includes(" · ")) {
      let changed = false;
      const out = k.split(" · ").map(seg => { const r = look(seg); if (r != null) { changed = true; return r; } return seg; }).join(" · ");
      return changed ? out : null;
    }
    return null;
  }
  function tr(s) {
    const k = s.trim(); if (!k) return s;
    const r = look(k);
    return r == null ? s : s.replace(k, r);
  }

  // Contenus saisis par les grimpeurs : jamais traduits.
  const SKIP = ".name, #dName, #ovName, #dDesc, #ovNote, .gymrow b, .gymrow span small, .fb p, [data-nt], script, style, textarea";
  const ORIG = new WeakMap(), AORIG = new WeakMap(), ATTRS = ["placeholder", "aria-label", "title"];

  function doText(n) {
    const p = n.parentElement; if (!p || p.closest(SKIP)) return;
    let o = ORIG.get(n);
    if (o == null || (n.data !== o && n.data !== n.__ts)) { o = n.data; ORIG.set(n, o); }
    let out;
    if (p.closest("svg") && o === "D") out = LANG === "fr" ? "D" : "S";
    else if (o.trim() === "Annuler" && p.closest(".undo")) out = LANG === "en" ? "Undo" : LANG === "es" ? "Deshacer" : o;
    else out = LANG === "fr" ? o : tr(o);
    if (n.data !== out) { n.__ts = out; n.data = out; } else n.__ts = out;
  }
  function doAttrs(el) {
    if (el.closest && el.closest("[data-nt]")) return;
    let m = AORIG.get(el);
    for (const a of ATTRS) {
      if (!el.hasAttribute || !el.hasAttribute(a)) continue;
      const v = el.getAttribute(a);
      if (!m) { m = {}; AORIG.set(el, m); }
      if (m[a] == null || (v !== m[a] && v !== m["_" + a])) m[a] = v;
      const out = LANG === "fr" ? m[a] : tr(m[a]);
      m["_" + a] = out;
      if (v !== out) el.setAttribute(a, out);
    }
  }
  function walk(root) {
    if (root.nodeType === 3) { doText(root); return; }
    if (root.nodeType !== 1) return;
    doAttrs(root);
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    let n; while ((n = tw.nextNode())) { if (n.nodeType === 3) doText(n); else doAttrs(n); }
  }
  let busy = false;
  const mo = new MutationObserver(recs => {
    if (busy) return; busy = true;
    try {
      for (const r of recs) {
        if (r.type === "childList") r.addedNodes.forEach(walk);
        else if (r.type === "attributes") doAttrs(r.target);
        else if (r.type === "characterData") doText(r.target);
      }
    } finally { mo.takeRecords(); busy = false; }
  });

  function apply() {
    document.documentElement.lang = LANG;
    document.querySelectorAll(".splash .en").forEach(e => e.hidden = LANG !== "fr");
    walk(document.body);
  }
  window.TS_I18N = {
    get lang() { return LANG; },
    langs: LANGS,
    locale: () => LOCALES[LANG],
    t: s => (LANG === "fr" ? s : tr(s)),
    set(l) {
      if (!LANGS[l]) return;
      LANG = l; try { localStorage.setItem("ts-lang", l); } catch {}
      busy = true; try { apply(); } finally { mo.takeRecords(); busy = false; }
      document.dispatchEvent(new CustomEvent("ts-lang", { detail: l }));
    },
  };
  apply();
  mo.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
})();
