// Outils partagés par le figeage de la référence et la remise à zéro du site de test.
import { readFileSync } from 'node:fs';

export const TEST_PROJECT = 'toposhare-test';
// Liste fermée : uniquement ce que la prod montre à tout le monde. Votes, méthodes privées, avis, brouillons, propriétaires et contributeurs n'y entrent pas.
export const PUBLIC_COLLECTIONS = ['gyms', 'walls', 'blocs', 'secteurs', 'voies', 'methodes', 'vues', 'photos'];
const PROD_DOCUMENTS = 'https://firestore.googleapis.com/v1/projects/betatheque/databases/(default)/documents';

// Ces scripts effacent des données : ils refusent de tourner avec une autre clé que celle du projet de test.
export function requireTestKey(keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  const keyProject = keyFile && JSON.parse(readFileSync(keyFile, 'utf8')).project_id;
  if (keyProject !== TEST_PROJECT) {
    console.error(`Refusé : ce script ne s'exécute que sur ${TEST_PROJECT} (clé reçue : ${keyProject || 'aucune'}).`);
    process.exit(1);
  }
}

// Un type inconnu arrête tout : mieux vaut un figeage refusé qu'une référence silencieusement fausse.
export function decodeValue(value) {
  const [type, raw] = Object.entries(value)[0];
  switch (type) {
    case 'stringValue': case 'booleanValue': return raw;
    case 'integerValue': case 'doubleValue': return Number(raw);
    case 'nullValue': return null;
    case 'timestampValue': return new Date(raw);
    case 'arrayValue': return (raw.values || []).map(decodeValue);
    case 'mapValue': return decodeFields(raw.fields);
    default: throw new Error(`Type Firestore non géré : ${type}`);
  }
}
export function decodeFields(fields = {}) {
  return Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, decodeValue(v)]));
}

// Lit la prod comme un visiteur sans compte : aucune clé, donc aucun accès au-delà de ce qui est public.
export async function readPublicCollection(collection, fetchPage = fetch) {
  const docs = {};
  let token = '';
  do {
    const url = `${PROD_DOCUMENTS}/${collection}?pageSize=100${token ? `&pageToken=${encodeURIComponent(token)}` : ''}`;
    const res = await fetchPage(url);
    if (!res.ok) throw new Error(`Lecture de ${collection} refusée : ${res.status}`);
    const page = await res.json();
    for (const d of page.documents || []) docs[d.name.split('/').pop()] = decodeFields(d.fields);
    token = page.nextPageToken || '';
  } while (token);
  return docs;
}

export const referenceDocs = (db, collection) => db.collection('reference').doc(collection).collection('docs');
