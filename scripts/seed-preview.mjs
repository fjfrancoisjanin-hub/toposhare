// Remet à zéro le projet de test et y écrit un jeu de données entièrement fictif. Lancé par la CI après chaque déploiement de prévisualisation.
// Usage : GOOGLE_APPLICATION_CREDENTIALS=clé-du-projet-de-test.json node scripts/seed-preview.mjs
import { readFileSync } from 'node:fs';
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const PROJECT = 'toposhare-test';
const COLLECTIONS = ['gymOwners', 'gyms', 'walls', 'blocs', 'secteurs', 'voies', 'methodes', 'photos', 'feedback', 'data'];

// Ce script efface toute la base : il refuse de tourner avec une autre clé que celle du projet de test.
const keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS;
const keyProject = keyFile && JSON.parse(readFileSync(keyFile, 'utf8')).project_id;
if (keyProject !== PROJECT) {
  console.error(`Refusé : ce script ne s'exécute que sur ${PROJECT} (clé reçue : ${keyProject || 'aucune'}).`);
  process.exit(1);
}

initializeApp({ credential: applicationDefault(), projectId: PROJECT });
const db = getFirestore();

const AUTHOR = 'grimpeur-fictif', NOW = Date.now();
const photo = (file, w, h) => ({
  data: readFileSync(new URL(`./preview-data/${file}`, import.meta.url)).toString('base64'),
  w, h, authorId: AUTHOR, createdAt: NOW,
});
const route = [[0.5, 0.82], [0.46, 0.64], [0.54, 0.46], [0.48, 0.28]];
const hold = (t, x, y) => ({ t, x, y });

const DATA = {
  photos: {
    'mur-test': photo('mur-test.jpg', 1200, 800),
    'voie-test': photo('voie-test.jpg', 600, 1200),
  },
  gyms: { 'salle-test': { name: 'Salle de test', city: 'Ville de test', createdAt: NOW } },
  walls: { 'mur-test': { gymId: 'salle-test', name: 'Mur de test', image: 'photo:mur-test', w: 1200, h: 800, active: true, createdAt: NOW } },
  blocs: Object.fromEntries([['a', '5c'], ['b', '6a+'], ['c', '7a']].map(([k, grade], i) => [`bloc-test-${k}`, {
    gymId: 'salle-test', wallId: 'mur-test', name: `Bloc de test ${k.toUpperCase()}`, grade, setter: 'Testeur', desc: '', authorId: AUTHOR, createdAt: NOW - i,
    holds: [hold('start', 0.3 + i * 0.1, 0.8), hold('hand', 0.4 + i * 0.1, 0.55), hold('hand', 0.5 + i * 0.1, 0.35), hold('top', 0.55 + i * 0.1, 0.15)],
  }])),
  secteurs: { 'secteur-test': { name: 'Secteur de test', region: 'Commune de test', authorId: AUTHOR, createdAt: NOW } },
  voies: { 'voie-test': {
    secteurId: 'secteur-test', name: 'Voie de test', grade: '6b', image: 'photo:voie-test', w: 600, h: 1200, addedBy: 'Testeur', authorId: AUTHOR, methodCount: 1, createdAt: NOW,
    anchors: [...route.map(([x, y]) => hold('bolt', x, y)), hold('relais', 0.5, 0.12)],
  } },
  methodes: { 'methode-test': {
    voieId: 'voie-test', secteurId: 'secteur-test', authorId: AUTHOR, climber: 'Testeur', note: 'Méthode fictive.', createdAt: NOW, updatedAt: NOW,
    steps: route.map(([x, y]) => hold('hand', x + 0.05, y - 0.03)),
  } },
};

for (const col of COLLECTIONS) await db.recursiveDelete(db.collection(col));
for (const [col, docs] of Object.entries(DATA)) {
  for (const [id, doc] of Object.entries(docs)) await db.collection(col).doc(id).set(doc);
  console.log(`${col} : ${Object.keys(docs).length}`);
}
console.log(`Jeu de test écrit dans ${PROJECT}.`);
