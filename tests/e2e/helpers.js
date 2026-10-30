// Outils des parcours connectés : connexion et données de départ, directement dans les émulateurs.
const PROJECT = 'betatheque';
const ADMIN = { sub: 'admin-e2e', email: 'fj.francoisjanin@gmail.com', name: 'François Admin' };
const ALICE = { sub: 'alice-e2e', email: 'alice@example.com', name: 'Alice Martin' };
const BOB = { sub: 'bob-e2e', email: 'bob@example.com', name: 'Bob Durand' };

// Connexion Google simulée : l'émulateur Auth accepte un jeton non signé.
async function login(page, who) {
  await page.waitForFunction(() => window.BT && window.firebase);
  await page.evaluate(async u => {
    const cred = firebase.auth.GoogleAuthProvider.credential(JSON.stringify({ ...u, email_verified: true }));
    await BT.auth.signInWithCredential(cred);
  }, who);
  await page.locator('#acctBtn[aria-label="Mon compte"]').waitFor({ state: 'attached' });
}

const toValue = v => {
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'number') return { integerValue: String(v) };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toValue) } };
  return { mapValue: { fields: toFields(v) } };
};
const toFields = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, toValue(v)]));

// Écrit un document sans passer par les règles (jeton réservé à l'émulateur).
async function seed(col, id, data) {
  const url = `http://127.0.0.1:8085/v1/projects/${PROJECT}/databases/(default)/documents/${col}/${id}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: toFields(data) }),
  });
  if (!res.ok) throw new Error(`seed ${col}/${id} : ${res.status} ${await res.text()}`);
}

module.exports = { ADMIN, ALICE, BOB, login, seed };
