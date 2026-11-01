// Branche l'appli sur Firebase : base de données (Firestore) et connexion Google.
// Les photos sont compressées puis rangées dans la base (collection "photos"), sans Cloud Storage.
// Expose window.claude.use(...) avec la même forme que la version prototype, pour garder le code de l'appli inchangé.
(function () {
  // Hors prod, un bandeau rappelle qu'on est sur l'environnement de test.
  if (window.TS_TEST_ENV) {
    const showBanner = () => {
      const b = document.createElement("div");
      b.id = "tsEnvBanner"; b.setAttribute("role", "status");
      b.style.cssText = "background:#FFD84D;color:#1A1A1A;font:600 12px/1.4 system-ui,sans-serif;text-align:center;padding:4px 8px";
      b.textContent = "Environnement de test" + (window.TS_PREVIEW_PR ? " · PR #" + window.TS_PREVIEW_PR : "");
      document.body.prepend(b);
    };
    if (document.body) showBanner(); else document.addEventListener("DOMContentLoaded", showBanner);
  }
  firebase.initializeApp(window.FIREBASE_CONFIG);
  const auth = firebase.auth(), fs = firebase.firestore();
  // En local (localhost), l'appli parle aux émulateurs Firebase et ne touche jamais la base de prod.
  if (["localhost", "127.0.0.1"].includes(location.hostname)) {
    auth.useEmulator("http://127.0.0.1:9099", { disableWarnings: true });
    fs.useEmulator("127.0.0.1", 8085);
  }
  auth.languageCode = "fr";
  // Cache sur le téléphone : les données et photos déjà vues restent disponibles, même sans réseau. Refusé par certains navigateurs (navigation privée) : l'appli marche alors sans.
  fs.enablePersistence({ synchronizeTabs: true }).catch(() => {});

  const listeners = [], photoListeners = [];
  let initial = true, counted = null;
  // Une connexion compte une fois, qu'elle passe par une fenêtre ou par une redirection. Aucune donnée sur le compte n'est envoyée.
  const countLogin = u => { if (u && u.uid !== counted) { counted = u.uid; window.TS_MESURE?.event("connexion"); } };
  const ready = new Promise(res => {
    auth.onAuthStateChanged(u => {
      if (initial) { initial = false; counted = u ? u.uid : null; res(u); return; }
      if (u) countLogin(u); else counted = null;
      listeners.forEach(fn => { try { fn(u); } catch (e) { console.error(e); } });
    });
  });
  auth.getRedirectResult().then(r => { if (r?.user) { counted = null; countLogin(r.user); } }).catch(() => {});

  function signIn() {
    const p = new firebase.auth.GoogleAuthProvider();
    p.setCustomParameters({ prompt: "select_account" });
    return auth.signInWithPopup(p).catch(e => {
      if (["auth/popup-blocked", "auth/operation-not-supported-in-this-environment", "auth/web-storage-unsupported"].includes(e.code)) return auth.signInWithRedirect(p);
      if (e.code === "auth/popup-closed-by-user" || e.code === "auth/cancelled-popup-request") return null;
      throw e;
    });
  }

  /* ---------- photos stored in Firestore ---------- */
  // Une seule passe de compression depuis l'image d'origine : 2 000 px maximum, WebP si le navigateur sait l'encoder, sinon JPEG.
  // Le canvas ne recopie ni l'EXIF ni le GPS : ils disparaissent à l'envoi.
  // La miniature (~20 Ko) est rangée à part, dans « miniatures », sous le même identifiant que la photo.
  const MAX_PX = 2000, MAX_BYTES = 400000, THUMB_PX = [320, 240], THUMB_GOAL = 22000, THUMB_MAX = 28000;
  const QUALITY = { "image/webp": [0.82, 0.72, 0.62, 0.5], "image/jpeg": [0.84, 0.76, 0.68, 0.58, 0.5] };
  const blobToB64 = blob => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1]); r.onerror = rej; r.readAsDataURL(blob); });
  const toBlob = (c, type, q) => new Promise(r => c.toBlob(r, type, q));
  let webpOk = null;
  // Safari sans WebP ne signale pas d'erreur : il rend un PNG. On vérifie donc le type réellement produit.
  async function canWebp() {
    if (webpOk === null) { const c = document.createElement("canvas"); c.width = c.height = 1; const b = await toBlob(c, "image/webp", 0.8).catch(() => null); webpOk = !!b && b.type === "image/webp"; }
    return webpOk;
  }
  function draw(img, max) {
    const sc = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * sc)), h = Math.max(1, Math.round(img.naturalHeight * sc));
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const ctx = c.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h); ctx.drawImage(img, 0, 0, w, h);
    return { c, w, h };
  }
  async function encode(c, mime, goal) {
    let out = null;
    for (const q of QUALITY[mime]) { out = await toBlob(c, mime, q); if (!out) throw { code: "photo-unreadable" }; if (out.size <= goal) break; }
    return out;
  }
  // Prépare une photo (fichier ou blob) : image principale + miniature. Un objet déjà préparé est rendu tel quel.
  async function preparePhoto(input) {
    if (input && input.blob && input.thumb) return input;
    const url = URL.createObjectURL(input), img = new Image(); img.src = url;
    try { await img.decode(); } finally { URL.revokeObjectURL(url); }
    const mime = (await canWebp()) ? "image/webp" : "image/jpeg";
    let blob = null, w = 0, h = 0;
    for (const max of [MAX_PX, 1800, 1600, 1400]) {
      const d = draw(img, max), out = await encode(d.c, mime, MAX_BYTES);
      if (out.size <= MAX_BYTES) { blob = out; w = d.w; h = d.h; break; }
    }
    if (!blob) throw { code: "photo-too-large" };
    let thumb = null;
    for (const max of THUMB_PX) {
      const d = draw(img, max), out = await encode(d.c, mime, THUMB_GOAL);
      if (out.size <= THUMB_MAX) { thumb = { blob: out, w: d.w, h: d.h }; break; }
    }
    if (!thumb) throw { code: "photo-too-large" };
    return { blob, thumb, w, h, mime: blob.type, preview: URL.createObjectURL(blob) };
  }
  async function uploadPhoto(input) {
    const u = auth.currentUser;
    if (!u) throw { code: "unauthenticated" };
    const p = await preparePhoto(input);
    const [data, tdata] = await Promise.all([blobToB64(p.blob), blobToB64(p.thumb.blob)]);
    const now = Date.now(), ref = fs.collection("photos").doc(), batch = fs.batch();
    batch.set(ref, { data, w: p.w, h: p.h, mime: p.blob.type, authorId: u.uid, createdAt: now });
    batch.set(fs.collection("miniatures").doc(ref.id), { data: tdata, w: p.thumb.w, h: p.thumb.h, mime: p.thumb.blob.type, authorId: u.uid, createdAt: now });
    await batch.commit();
    return { url: "photo:" + ref.id, w: p.w, h: p.h };
  }
  // Miniature d'une photo qui n'en a pas (photos d'avant) : réservé à l'admin, qui la crée depuis la photo existante.
  async function makeMissingThumb(id) {
    const full = await fs.collection("photos").doc(id).get();
    if (!full.exists) return "absente";
    if ((await fs.collection("miniatures").doc(id).get()).exists) return "déjà là";
    const d = full.data(), bin = atob(d.data), arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    const p = await preparePhoto(new Blob([arr], { type: d.mime || "image/jpeg" }));
    await fs.collection("miniatures").doc(id).set({ data: await blobToB64(p.thumb.blob), w: p.thumb.w, h: p.thumb.h, mime: p.thumb.blob.type, authorId: d.authorId, createdAt: Date.now() });
    return "créée";
  }

  // Lecture des photos. Une photo ne change jamais (les règles interdisent de la modifier) : on regarde d'abord le cache du téléphone.
  const cache = {}, thumbCache = {}, pending = {}, tpending = {}, failed = new Set(), noThumb = new Set();
  const stats = { photoCache: 0, photoServer: 0, thumbCache: 0, thumbServer: 0, errors: 0 };
  async function readDoc(col, id, kind) {
    const ref = fs.collection(col).doc(id);
    try { const d = await ref.get({ source: "cache" }); if (d.exists) { stats[kind + "Cache"]++; return d; } } catch (e) { /* pas en cache */ }
    stats[kind + "Server"]++;
    return ref.get({ source: "server" });
  }
  const toUrl = d => { const bin = atob(d.data().data), arr = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i); return URL.createObjectURL(new Blob([arr], { type: d.data().mime || "image/jpeg" })); };
  const notify = (id, err) => photoListeners.forEach(fn => { try { fn(id, err); } catch (e) { console.error(e); } });
  function loadFull(id) {
    if (cache[id] || pending[id] || failed.has(id)) return;
    pending[id] = readDoc("photos", id, "photo").then(d => {
      if (!d.exists || !d.data().data) throw new Error("absente");
      cache[id] = toUrl(d); delete pending[id]; notify(id);
    }).catch(() => { delete pending[id]; failed.add(id); stats.errors++; notify(id, "error"); });
  }
  function loadThumb(id) {
    if (cache[id] || thumbCache[id] || tpending[id] || noThumb.has(id)) return;
    // Pas de miniature (photo d'avant, ou lecture impossible) : on prévient, pour que les écrans qui préfèrent la miniature passent à la photo complète.
    const miss = () => { delete tpending[id]; noThumb.add(id); notify(id); };
    tpending[id] = readDoc("miniatures", id, "thumb").then(d => {
      delete tpending[id];
      if (!d.exists || !d.data().data) { miss(); return; }
      if (!cache[id]) { thumbCache[id] = toUrl(d); notify(id); }
    }).catch(miss);
  }
  // opt.thumbOnly  : la miniature seulement, jamais la photo complète (carte « Reprendre » de l'accueil).
  // opt.thumbFirst : la miniature, et la photo complète seulement s'il n'y a pas de miniature (petites cartes des listes).
  // Sans option : la photo complète, avec la miniature en attendant.
  function img(ref, opt = {}) {
    if (!ref || typeof ref !== "string" || !ref.startsWith("photo:")) return ref || "";
    const id = ref.slice(6);
    if (cache[id]) return cache[id];
    if (opt.thumbFirst) { loadThumb(id); if (noThumb.has(id)) loadFull(id); }
    else { if (!opt.thumbOnly) loadFull(id); loadThumb(id); }
    return thumbCache[id] || "";
  }
  const photoFailed = ref => typeof ref === "string" && ref.startsWith("photo:") && failed.has(ref.slice(6));
  // Relance les photos qui n'ont pas pu charger (retour du réseau, changement d'écran).
  function retryPhotos() { const ids = [...failed]; failed.clear(); ids.forEach(id => notify(id)); }
  window.addEventListener("online", retryPhotos);

  window.BT = {
    auth, fs, signIn,
    signOut: () => auth.signOut(),
    onUser: fn => listeners.push(fn),
    onPhoto: fn => photoListeners.push(fn),
    img, uploadPhoto, preparePhoto, makeMissingThumb, photoFailed, retryPhotos, stats,
    user: () => auth.currentUser,
    ready,
  };

  const dbNs = { collection: p => fs.collection(p), doc: p => fs.doc(p), batch: () => fs.batch(), increment: n => firebase.firestore.FieldValue.increment(n) };
  const userNs = {
    id: async () => auth.currentUser ? auth.currentUser.uid : null,
    me: async () => ({ id: auth.currentUser?.uid || null, name: auth.currentUser?.displayName || "", email: auth.currentUser?.email || null }),
  };
  const assetsNs = { upload: uploadPhoto };
  window.claude = {
    use: async name => {
      await ready;
      return name === "db" ? dbNs : name === "user" ? userNs : name === "assets" ? assetsNs : null;
    },
  };
})();
