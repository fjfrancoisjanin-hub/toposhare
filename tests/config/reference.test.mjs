// Référence du site de test : seules les données publiques sont lues, et le type d'une valeur ne se perd pas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PUBLIC_COLLECTIONS, decodeFields, readPublicCollection } from '../../scripts/reference-lib.mjs';

test('aucune collection privée dans la référence', () => {
  for (const col of ['votes', 'methodesPrivees', 'feedback', 'data', 'gymOwners', 'contributeurs', 'utilisateurs']) assert.ok(!PUBLIC_COLLECTIONS.includes(col), col);
});

test('les valeurs Firestore sont décodées avec leur type', () => {
  assert.deepEqual(decodeFields({
    name: { stringValue: 'Voie' }, createdAt: { integerValue: '1720000000000' }, x: { doubleValue: 0.25 }, ok: { booleanValue: false }, rien: { nullValue: null },
    vide: { arrayValue: {} }, steps: { arrayValue: { values: [{ mapValue: { fields: { t: { stringValue: 'hand' } } } }] } }, m: { mapValue: {} },
  }), { name: 'Voie', createdAt: 1720000000000, x: 0.25, ok: false, rien: null, vide: [], steps: [{ t: 'hand' }], m: {} });
});

test('un type inconnu arrête le figeage', () => {
  assert.throws(() => decodeFields({ r: { referenceValue: 'projects/x' } }), /non géré/);
});

test("toutes les pages sont lues, sans en-tête d'authentification", async () => {
  const calls = [];
  const pages = [
    { documents: [{ name: 'p/d/voies/a', fields: { n: { integerValue: '1' } } }], nextPageToken: 't/1' },
    { documents: [{ name: 'p/d/voies/b' }] },
  ];
  const docs = await readPublicCollection('voies', async (...args) => { calls.push(args); return { ok: true, json: async () => pages[calls.length - 1] }; });
  assert.deepEqual(docs, { a: { n: 1 }, b: {} });
  assert.match(calls[1][0], /pageToken=t%2F1/);
  assert.ok(calls.every(args => args.length === 1 && args[0].includes('/projects/betatheque/')));
});

test('une lecture refusée fait échouer le figeage', async () => {
  await assert.rejects(readPublicCollection('voies', async () => ({ ok: false, status: 403 })), /refusée/);
});
