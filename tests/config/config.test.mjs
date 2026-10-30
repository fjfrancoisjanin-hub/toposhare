// Le choix de la base dépend de l'adresse : la prod n'est utilisée que sur les adresses explicitement listées.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync('public/config.js', 'utf8');
function load(hostname) {
  const window = {};
  vm.runInNewContext(source, { window, location: { hostname } });
  return window;
}

for (const host of ['toposhare.web.app', 'toposhare.firebaseapp.com', 'localhost', '127.0.0.1']) {
  test(`${host} utilise la prod, sans bandeau de test`, () => {
    const w = load(host);
    assert.equal(w.FIREBASE_CONFIG.projectId, 'betatheque');
    assert.equal(w.TS_TEST_ENV, false);
  });
}

for (const host of [
  'toposhare-test.web.app',
  'toposhare-test.firebaseapp.com',
  'toposhare--pr13-docs-rangement-abc123.web.app',
  'toposhare.web.app.exemple.com',
  'inconnu.exemple.com',
]) {
  test(`${host} utilise le projet de test`, () => {
    const w = load(host);
    assert.equal(w.FIREBASE_CONFIG.projectId, 'toposhare-test');
    assert.equal(w.FIREBASE_CONFIG.authDomain, 'toposhare-test.firebaseapp.com');
    assert.equal(w.TS_TEST_ENV, true);
  });
}

test('le numéro de PR reste vide dans le dépôt : seule la CI le renseigne', () => {
  assert.equal(load('toposhare.web.app').TS_PREVIEW_PR, '');
});
