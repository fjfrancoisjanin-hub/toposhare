// Tests des règles d'accès Firestore de TopoShare, contre l'émulateur.
// Lancer : npm run test:rules
// Les tests marqués « todo » décrivent des failles connues : ils sont affichés mais ne bloquent pas la CI.
// Quand une faille est corrigée dans firestore.rules, retirer le « todo » pour verrouiller le comportement.
import { test, before, after, beforeEach, describe } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';

const OWNER = { email: 'fj.francoisjanin@gmail.com', email_verified: true };
let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-toposhare',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});
after(() => env.cleanup());
beforeEach(() => env.clearFirestore());

const anon = () => env.unauthenticatedContext().firestore();
const user = uid => env.authenticatedContext(uid).firestore();
const owner = () => env.authenticatedContext('owner', OWNER).firestore();
const seed = (path, data) => env.withSecurityRulesDisabled(ctx => ctx.firestore().doc(path).set(data));

describe('Blocs', () => {
  test('tout le monde peut lire un bloc, sans compte', async () => {
    await seed('blocs/b1', { authorId: 'alice', name: 'Bloc' });
    await assertSucceeds(anon().doc('blocs/b1').get());
  });
  test('un invité ne peut pas créer de bloc', async () => {
    await assertFails(anon().doc('blocs/b1').set({ authorId: 'x', name: 'Bloc' }));
  });
  test('un grimpeur connecté crée un bloc à son nom', async () => {
    await assertSucceeds(user('alice').doc('blocs/b1').set({ authorId: 'alice', name: 'Bloc' }));
  });
  test("on ne peut pas créer un bloc au nom d'un autre", async () => {
    await assertFails(user('alice').doc('blocs/b1').set({ authorId: 'bob', name: 'Bloc' }));
  });
  test("bob ne peut ni modifier ni supprimer le bloc d'alice", async () => {
    await seed('blocs/b1', { authorId: 'alice', name: 'Bloc' });
    await assertFails(user('bob').doc('blocs/b1').update({ name: 'Piraté' }));
    await assertFails(user('bob').doc('blocs/b1').delete());
  });
  test("alice modifie son bloc mais ne peut pas en changer l'auteur", async () => {
    await seed('blocs/b1', { authorId: 'alice', name: 'Bloc' });
    await assertSucceeds(user('alice').doc('blocs/b1').update({ name: 'Bloc v2' }));
    await assertFails(user('alice').doc('blocs/b1').update({ authorId: 'bob' }));
  });
  test('le propriétaire du site peut supprimer n’importe quel bloc', async () => {
    await seed('blocs/b1', { authorId: 'alice', name: 'Bloc' });
    await assertSucceeds(owner().doc('blocs/b1').delete());
  });
  test('un e-mail propriétaire non vérifié ne donne aucun droit', async () => {
    await seed('blocs/b1', { authorId: 'alice', name: 'Bloc' });
    const fake = env.authenticatedContext('imposteur', { email: OWNER.email, email_verified: false }).firestore();
    await assertFails(fake.doc('blocs/b1').delete());
  });
});

describe('Voies et méthodes', () => {
  test("bob ne peut pas modifier la voie d'alice", async () => {
    await seed('voies/v1', { authorId: 'alice', name: 'Voie', methodCount: 0 });
    await assertFails(user('bob').doc('voies/v1').update({ name: 'Piraté' }));
  });
  test('un grimpeur connecté peut incrémenter le compteur de méthodes', async () => {
    await seed('voies/v1', { authorId: 'alice', name: 'Voie', methodCount: 0 });
    await assertSucceeds(user('bob').doc('voies/v1').update({ methodCount: 1 }));
  });
  test('le compteur de méthodes ne doit bouger que de 1', async () => {
    await seed('voies/v1', { authorId: 'alice', name: 'Voie', methodCount: 2 });
    await assertFails(user('bob').doc('voies/v1').update({ methodCount: -999 }));
  });
  test('le compteur de méthodes accepte +1', async () => {
    await seed('voies/v1', { authorId: 'alice', name: 'Voie', methodCount: 2 });
    await assertSucceeds(user('bob').doc('voies/v1').update({ methodCount: 3 }));
  });
  test("bob ne peut pas supprimer la méthode d'alice", async () => {
    await seed('methodes/m1', { authorId: 'alice', voieId: 'v1' });
    await assertFails(user('bob').doc('methodes/m1').delete());
  });
});

describe('Salles et murs', () => {
  test('seul le propriétaire modifie une salle', async () => {
    await seed('gyms/g1', { name: 'Altissimo Albi' });
    await assertFails(user('alice').doc('gyms/g1').update({ name: 'Autre' }));
    await assertSucceeds(owner().doc('gyms/g1').update({ name: 'Altissimo' }));
  });
  test("un grimpeur quelconque ne doit pas pouvoir remplacer la photo du mur d'une salle", { todo: 'faille connue : rôle admin de salle au backlog' }, async () => {
    await seed('walls/w1', { gymId: 'g1', photo: 'photo:abc', authorId: 'alice' });
    await assertFails(user('bob').doc('walls/w1').update({ photo: 'photo:pirate' }));
  });
  test('un invité ne peut pas créer de salle', async () => {
    await assertFails(anon().doc('gyms/g2').set({ name: 'Nouvelle salle' }));
  });
});

describe('Brouillons', () => {
  test('alice lit et écrit ses brouillons', async () => {
    await assertSucceeds(user('alice').doc('data/users/alice/d1').set({ draft: true }));
    await assertSucceeds(user('alice').doc('data/users/alice/d1').get());
  });
  test("bob ne voit pas les brouillons d'alice", async () => {
    await seed('data/users/alice/d1', { draft: true });
    await assertFails(user('bob').doc('data/users/alice/d1').get());
  });
});

describe('Photos', () => {
  test('une photo de moins de 1 Mo est acceptée', async () => {
    await assertSucceeds(user('alice').doc('photos/p1').set({ authorId: 'alice', data: 'a'.repeat(1000) }));
  });
  test('une photo trop lourde est refusée', async () => {
    await assertFails(user('alice').doc('photos/p1').set({ authorId: 'alice', data: 'a'.repeat(1_000_001) }));
  });
  test('une photo ne peut pas être modifiée après coup', async () => {
    await seed('photos/p1', { authorId: 'alice', data: 'abc' });
    await assertFails(user('alice').doc('photos/p1').update({ data: 'xyz' }));
  });
});

describe('Avis', () => {
  test('tout le monde peut envoyer un avis', async () => {
    await assertSucceeds(anon().collection('feedback').add({ text: 'Super appli' }));
  });
  test('un avis vide ou trop long est refusé', async () => {
    await assertFails(anon().collection('feedback').add({ text: '' }));
    await assertFails(anon().collection('feedback').add({ text: 'x'.repeat(2001) }));
  });
  test('seul le propriétaire lit les avis', async () => {
    await seed('feedback/f1', { text: 'Avis' });
    await assertFails(user('alice').doc('feedback/f1').get());
    await assertSucceeds(owner().doc('feedback/f1').get());
  });
});
