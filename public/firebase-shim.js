// Branche l'appli sur Firebase : base de données (Firestore) et connexion Google.
// Les photos sont compressées puis rangées dans la base (collection "photos"), sans Cloud Storage.
// Expose window.claude.use(...) avec la même forme que la version prototype, pour garder le code de l'appli inchangé.
(function () {
  firebase.initializeApp(window.FIREBASE_CONFIG);
  const auth = firebase.auth(), fs = firebase.firestore();
  // En local (localhost), l'appli parle aux émulateurs Firebase et ne touche jamais la base de prod.
  if (["localhost", "127.0.0.1"].includes(location.hostname)) {
    auth.useEmulator("http://127.0.0.1:9099", { disableWarnings: true });
    fs.useEmulator("127.0.0.1", 8080);
  }
  auth.languageCode = "fr";

  const listeners = [], photoListeners = [];
  let initial = true;
  const ready = new Promise(res => {
    auth.onAuthStateChanged(u => {
      if (initial) { initial = false; res(u); return; }
      listeners.forEach(fn => { try { fn(u); } catch (e) { console.error(e); } });
    });
  });
  auth.getRedirectResult().catch(() => {});

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
  const LIMIT = 900000; // caractères base64, sous la limite de 1 Mo par document
  const blobToB64 = blob => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1]); r.onerror = rej; r.readAsDataURL(blob); });
  async function compress(blob) {
    const url = URL.createObjectURL(blob), img = new Image(); img.src = url; await img.decode(); URL.revokeObjectURL(url);
    let max = 1800, q = 0.82;
    for (;;) {
      const sc = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.round(img.naturalWidth * sc), h = Math.round(img.naturalHeight * sc);
      const c = document.createElement("canvas"); c.width = w; c.height = h; c.getContext("2d").drawImage(img, 0, 0, w, h);
      const out = await new Promise(r => c.toBlob(r, "image/jpeg", q));
      const b64 = await blobToB64(out);
      if (b64.length < LIMIT || max <= 900) return { b64, w, h };
      if (q > 0.6) q -= 0.08; else { q = 0.78; max -= 250; }
    }
  }
  async function uploadPhoto(blob) {
    const u = auth.currentUser;
    if (!u) throw { code: "unauthenticated" };
    const { b64, w, h } = await compress(blob);
    const ref = await fs.collection("photos").add({ data: b64, w, h, authorId: u.uid, createdAt: Date.now() });
    return { url: "photo:" + ref.id };
  }
  const cache = {}, pending = {};
  function img(ref) {
    if (!ref || typeof ref !== "string" || !ref.startsWith("photo:")) return ref || "";
    const id = ref.slice(6);
    if (cache[id]) return cache[id];
    if (!pending[id]) pending[id] = fs.collection("photos").doc(id).get().then(d => {
      const b64 = d.exists && d.data().data; if (!b64) return;
      const bin = atob(b64), arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      cache[id] = URL.createObjectURL(new Blob([arr], { type: "image/jpeg" }));
      photoListeners.forEach(fn => { try { fn(id); } catch (e) { console.error(e); } });
    }).catch(() => { delete pending[id]; });
    return "";
  }

  window.BT = {
    auth, fs, signIn,
    signOut: () => auth.signOut(),
    onUser: fn => listeners.push(fn),
    onPhoto: fn => photoListeners.push(fn),
    img, uploadPhoto,
    user: () => auth.currentUser,
    ready,
  };

  const dbNs = { collection: p => fs.collection(p), doc: p => fs.doc(p) };
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
