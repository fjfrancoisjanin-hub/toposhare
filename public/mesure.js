// Mesure d'audience anonyme et sans cookies (Umami). Le script n'est chargé que sur la prod : ni le site de test, ni le local n'appellent Umami.
// L'appli change d'écran sans changer d'adresse : le suivi automatique est coupé et chaque écran est envoyé par TS_MESURE.page().
// Un bloqueur de pub ou une panne d'Umami ne change rien pour l'appli : les envois sont simplement abandonnés.
(function () {
  const PROD_HOST = "toposhare.web.app";
  const MAX_PENDING = 50;
  let pending = [], loading = location.hostname === PROD_HOST;
  let path = "/", previous = null, sent = false;

  function send(build) {
    // Tout passe par ici : l'adresse, le titre et le référent sont imposés, pour que rien de saisi ou d'obsolète ne parte.
    const at = location.origin + path, from = previous && location.origin + previous;
    const track = () => { try { Promise.resolve(window.umami.track(p => build({ ...p, url: at, title: "TopoShare", ...(from ? { referrer: from } : {}) }))).catch(() => {}); } catch {} };
    if (window.umami) track();
    else if (loading && pending.length < MAX_PENDING) pending.push(track);
  }

  // Seuls la salle et le type peuvent partir : jamais de nom, d'e-mail ou d'identifiant d'utilisateur.
  function event(name, { salle, type } = {}) {
    const data = {};
    if (salle) data.salle = String(salle);
    if (type) data.type = String(type);
    send(p => ({ ...p, name, data }));
  }
  function page(next) {
    previous = sent ? path : null; path = next; sent = true;
    send(p => p);
  }

  if (loading) {
    const s = document.createElement("script");
    s.defer = true;
    s.src = "https://cloud.umami.is/script.js";
    s.dataset.websiteId = "64f3bc6d-f1ad-44a1-bb81-86c2a4374047";
    s.dataset.domains = PROD_HOST;
    s.dataset.autoTrack = "false";
    s.onload = () => { const q = pending; pending = []; loading = false; q.forEach(f => f()); };
    s.onerror = () => { pending = []; loading = false; };
    document.head.appendChild(s);
  }

  // Une visite arrive d'un QR code : compter une fois, puis retirer src pour qu'un rechargement ou un lien partagé ne compte pas à nouveau.
  const q = new URLSearchParams(location.search);
  if (q.get("src") === "qr") {
    const m = location.hash.match(/^#\/(salle|secteur)\/(.+)$/);
    if (m) path = `/${m[1]}/${m[2]}`;
    event("arrivee_qr", { salle: m && m[2] });
    q.delete("src");
    const rest = q.toString();
    history.replaceState(null, "", location.pathname + (rest ? `?${rest}` : "") + location.hash);
  }

  window.TS_MESURE = { page, event };
})();
