// Mesure ce que l'appli lit dans Firestore au lancement, à l'ouverture d'un mur et d'un secteur, puis au deuxième lancement.
// Les données publiques de la prod sont lues sans clé (comme freeze-reference.mjs), copiées dans l'émulateur, et l'appli locale est lancée dessus.
// Rien n'est écrit en prod. Compte les documents reçus du serveur (pas ceux relus depuis le cache du téléphone) et leur poids en JSON.
//
// Usage :  npx firebase emulators:exec --only auth,firestore --project betatheque "node scripts/mesure-lancement.mjs [--repo <dossier>]"
// --miniatures : génère d'abord les miniatures des photos existantes (ce que fait le bouton admin « Générer les miniatures manquantes »).
// --repo : dossier d'un autre état du dépôt (git worktree) à comparer. Par défaut, le dépôt courant.
// Variables facultatives : PW_CHROMIUM (chemin d'un Chromium), MESURE_SDK_LOCAL=1 (sert le SDK Firebase depuis node_modules si gstatic est bloqué).
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { PUBLIC_COLLECTIONS, readPublicCollection } from './reference-lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MAIN = path.join(HERE, '..');
const arg = n => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const REPO = path.resolve(arg('--repo') || MAIN);
const PORT = 4200 + Math.floor(Math.random() * 500); // port libre au hasard : un ancien serveur ne répond jamais à la place
const require = createRequire(path.join(MAIN, 'package.json'));
const { chromium, devices } = require('@playwright/test');
const EMU = 'http://127.0.0.1:8085/v1/projects/betatheque/databases/(default)/documents';

// 1. Données publiques de la prod -> émulateur.
const enc = v => v === null ? { nullValue: null } : typeof v === 'string' ? { stringValue: v } : typeof v === 'boolean' ? { booleanValue: v }
  : typeof v === 'number' ? (Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v })
  : v instanceof Date ? { timestampValue: v.toISOString() } : Array.isArray(v) ? { arrayValue: { values: v.map(enc) } } : { mapValue: { fields: encFields(v) } };
const encFields = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, enc(v)]));
await fetch('http://127.0.0.1:8085/emulator/v1/projects/betatheque/databases/(default)/documents', { method: 'DELETE' });
const data = {};
for (const col of PUBLIC_COLLECTIONS) {
  data[col] = await readPublicCollection(col).catch(() => ({}));
  for (const [id, doc] of Object.entries(data[col])) {
    const r = await fetch(`${EMU}/${col}/${id}`, { method: 'PATCH', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: encFields(doc) }) });
    if (!r.ok) throw new Error(`copie ${col}/${id} : ${r.status}`);
  }
}
const count = c => Object.keys(data[c] || {}).length;
console.log(`Données copiées de la prod : ${PUBLIC_COLLECTIONS.map(c => `${c} ${count(c)}`).join(', ')}\n`);
const gymId = Object.keys(data.gyms)[0];
// Le secteur qui a des voies avec photo : c'est lui qu'un grimpeur ouvre vraiment.
const parSecteur = {};
for (const v of Object.values(data.voies)) if (v.image) parSecteur[v.secteurId] = (parSecteur[v.secteurId] || 0) + 1;
const secteurId = Object.entries(parSecteur).sort((a, b) => b[1] - a[1])[0]?.[0] || Object.keys(data.secteurs)[0];

// 2. Serveur de l'appli et navigateur.
const server = spawn('node', [path.join(REPO, 'tests/serve.js'), String(PORT)], { stdio: 'ignore' });
process.on('exit', () => server.kill());
await new Promise(r => setTimeout(r, 800));
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, args: ['--no-sandbox'] });
// Compteur de lectures, ajouté au shim de l'appli au passage : documents reçus du serveur, par collection.
const SPY = `;(() => {
  const R = window.__reads = {};
  const note = d => { const c = d.ref.parent.id, o = R[c] || (R[c] = { docs: 0, bytes: 0 }); o.docs++; o.bytes += JSON.stringify(d.data()).length + d.id.length; };
  const seeSnap = s => { if (!s || !s.metadata || s.metadata.fromCache) return; if (s.docChanges) s.docChanges().forEach(c => { if (c.type !== 'removed') note(c.doc); }); else if (s.exists) note(s); };
  const wrap = (P, name) => { const o = P[name]; P[name] = function (...a) {
    if (name === 'get') return o.apply(this, a).then(s => (seeSnap(s), s));
    const i = a.findIndex(x => typeof x === 'function'); if (i >= 0) { const f = a[i]; a[i] = s => { seeSnap(s); return f(s); }; }
    return o.apply(this, a); }; };
  for (const P of [firebase.firestore.Query.prototype, firebase.firestore.DocumentReference.prototype]) { wrap(P, 'get'); wrap(P, 'onSnapshot'); }
})();`;
const sdkLocal = async context => {
  if (!process.env.MESURE_SDK_LOCAL) return;
  await context.route(/gstatic\.com\/firebasejs\/[^/]+\/(firebase-[a-z-]+-compat\.js)/, r => {
    const f = r.request().url().match(/(firebase-[a-z-]+-compat\.js)/)[1];
    r.fulfill({ status: 200, contentType: 'text/javascript', body: readFileSync(path.join(MAIN, 'node_modules/firebase', f)) });
  });
};
const URL0 = `http://localhost:${PORT}/`;

// Simule le bouton admin : miniature de chaque photo existante, créée avec le code de compression de l'appli.
if (process.argv.includes('--miniatures')) {
  const context = await browser.newContext({ ...devices['Pixel 7'] });
  await sdkLocal(context);
  const page = await context.newPage();
  await page.goto(URL0);
  await page.waitForFunction(() => window.BT && BT.preparePhoto);
  for (const id of Object.keys(data.photos)) {
    const t = await page.evaluate(async id => {
      const d = (await BT.fs.collection('photos').doc(id).get({ source: 'server' })).data();
      const bin = atob(d.data), arr = Uint8Array.from(bin, c => c.charCodeAt(0));
      const p = await BT.preparePhoto(new Blob([arr], { type: d.mime || 'image/jpeg' }));
      const b64 = await new Promise(r => { const f = new FileReader(); f.onload = () => r(String(f.result).split(',')[1]); f.readAsDataURL(p.thumb.blob); });
      return { data: b64, w: p.thumb.w, h: p.thumb.h, mime: p.thumb.blob.type, authorId: d.authorId, createdAt: Date.now() };
    }, id);
    const r = await fetch(`${EMU}/miniatures/${id}`, { method: 'PATCH', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: encFields(t) }) });
    if (!r.ok) throw new Error(`miniature ${id} : ${r.status}`);
    console.log(`miniature ${id} : ${Math.round(t.data.length * 0.75 / 1024)} Ko`);
  }
  await context.close();
}
const rows = [];

// Une session = un téléphone neuf (cache vide), avec ou sans secteur en cours.
async function session(titre, { habitue = false } = {}) {
  const context = await browser.newContext({ ...devices['Pixel 7'], locale: 'fr-FR', serviceWorkers: 'block' });
  await sdkLocal(context);
  await context.route('**/firebase-shim.js', async r => {
    const res = await r.fetch(), body = await res.text();
    await r.fulfill({ response: res, body: body.replace('firebase.initializeApp(', `${SPY.replace(/^;/, '')}\n  firebase.initializeApp(`) });
  });
  if (habitue) await context.addInitScript(id => {
    if (localStorage.getItem('ts-recents')) return;
    localStorage.setItem('pan-sect', id); localStorage.setItem('ts-recents', JSON.stringify([{ type: 'secteur', id, t: Date.now() }]));
  }, secteurId);
  const page = await context.newPage();
  const snapshot = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__reads || {})));
  const diff = (a, b) => Object.fromEntries(Object.keys(b).map(c => [c, { docs: b[c].docs - (a[c]?.docs || 0), bytes: b[c].bytes - (a[c]?.bytes || 0) }]).filter(([, v]) => v.docs));
  // fresh : la page vient d'être (re)chargée, les compteurs repartent de zéro.
  const step = async (label, action, fresh = false) => {
    const before = fresh ? {} : await snapshot();
    await action();
    await page.waitForFunction(() => !document.getElementById('splash'));
    await page.waitForTimeout(2500);
    const d = diff(before, await snapshot()), all = Object.values(d);
    const photo = ['photos', 'miniatures'].map(c => d[c] || { docs: 0, bytes: 0 });
    rows.push({ titre, label, docs: all.reduce((n, v) => n + v.docs, 0), ko: Math.round(all.reduce((n, v) => n + v.bytes, 0) / 1024),
      photoDocs: photo[0].docs + photo[1].docs, photoKo: Math.round((photo[0].bytes + photo[1].bytes) / 1024), detail: Object.entries(d).map(([c, v]) => `${c} ${v.docs}`).join(', ') });
  };
  await step('lancement (accueil)', () => page.goto(URL0), true);
  if (!habitue) {
    await step("ouverture d'un mur (salle)", () => page.evaluate(h => { location.hash = h; }, `#/salle/${gymId}`));
    await step("ouverture d'un secteur", () => page.evaluate(h => { location.hash = h; }, `#/secteur/${secteurId}`));
  }
  await page.waitForTimeout(1500); // laisse le cache s'écrire avant de relancer
  await step('2e lancement (même téléphone)', () => page.reload(), true);
  await context.close();
}
await session('Visiteur qui arrive');
await session('Habitué : son secteur est « en cours »', { habitue: true });

console.log('| Cas | Étape | Documents lus | Ko (JSON) | dont photos et miniatures | Détail |\n|---|---|---:|---:|---:|---|');
for (const r of rows) console.log(`| ${r.titre} | ${r.label} | ${r.docs} | ${r.ko} | ${r.photoDocs} doc (${r.photoKo} Ko) | ${r.detail} |`);
await browser.close();
server.kill();
