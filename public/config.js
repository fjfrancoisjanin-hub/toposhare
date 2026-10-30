// Configuration Firebase de TopoShare. Ces valeurs ne sont pas secrètes : ce sont les règles d'accès (firestore.rules) qui protègent les données.
// La prod (projet « betatheque », dont l'identifiant ne peut pas changer) n'est utilisée que sur les adresses listées ici.
// Toute autre adresse utilise le projet de test : une adresse inconnue ne peut jamais écrire en prod.
// En local, firebase-shim.js branche l'appli sur les émulateurs : aucune des deux bases n'est touchée.
(function () {
  const PROD_HOSTS = ["toposhare.web.app", "toposhare.firebaseapp.com", "localhost", "127.0.0.1"];
  const PROD = {
    apiKey: "AIzaSyDDz2sRIC6G7OypKAOkSQ1-gmSFhw5kOmQ",
    authDomain: "betatheque.firebaseapp.com",
    projectId: "betatheque",
    storageBucket: "betatheque.firebasestorage.app",
    messagingSenderId: "671949048651",
    appId: "1:671949048651:web:26879388bf49fec6e2b6ce",
    measurementId: "G-QQMJFNFSPL",
  };
  const TEST = {
    apiKey: "AIzaSyDSaO36xCFvLopuucxPdN6vF0XUaqUjxBY",
    authDomain: "toposhare-test.firebaseapp.com",
    projectId: "toposhare-test",
    storageBucket: "toposhare-test.firebasestorage.app",
    messagingSenderId: "795728438485",
    appId: "1:795728438485:web:932031c5414351a2f4ee5c",
    measurementId: "G-VD2W4J80Q1",
  };
  const isProd = PROD_HOSTS.includes(location.hostname);
  window.FIREBASE_CONFIG = isProd ? PROD : TEST;
  window.TS_TEST_ENV = !isProd;
})();
// Numéro de la PR déployée sur l'environnement de test, renseigné par la CI.
window.TS_PREVIEW_PR = "";
// Compte qui voit la page de suivi (/admin) et les avis.
window.BT_OWNER_EMAIL = "fj.francoisjanin@gmail.com";
