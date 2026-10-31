// Fige les données publiques de la prod dans le projet de test (collection reference, illisible par l'appli) ; seed-preview.mjs s'en sert à chaque déploiement.
// Usage : GOOGLE_APPLICATION_CREDENTIALS=clé-du-projet-de-test.json node scripts/freeze-reference.mjs
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { PUBLIC_COLLECTIONS, TEST_PROJECT, readPublicCollection, referenceDocs, requireTestKey } from './reference-lib.mjs';

requireTestKey();

// Tout lire avant d'effacer : une lecture refusée laisse l'ancienne référence intacte.
const snapshot = {};
for (const col of PUBLIC_COLLECTIONS) snapshot[col] = await readPublicCollection(col);
if (!Object.keys(snapshot.gyms).length && !Object.keys(snapshot.secteurs).length) throw new Error('Aucun lieu lu en prod : référence conservée.');

initializeApp({ credential: applicationDefault(), projectId: TEST_PROJECT });
const db = getFirestore();
await db.recursiveDelete(db.collection('reference'));
for (const col of PUBLIC_COLLECTIONS) {
  const docs = Object.entries(snapshot[col]);
  for (const [id, doc] of docs) await referenceDocs(db, col).doc(id).set(doc);
  console.log(`${col} : ${docs.length}`);
}
await db.collection('reference').doc('info').set({ figeeLe: new Date().toISOString() });
console.log(`Référence figée dans ${TEST_PROJECT}.`);
