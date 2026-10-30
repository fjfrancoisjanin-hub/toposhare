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
const trace = (uid, data) => ({ ...data, updatedAt: Date.now(), updatedBy: uid });

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
    await assertSucceeds(user('alice').doc('blocs/b1').update(trace('alice', { name: 'Bloc v2' })));
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
  test('le compteur de méthodes ne peut pas passer sous 0', async () => {
    await seed('voies/v1', { authorId: 'alice', name: 'Voie', methodCount: 0 });
    await assertFails(user('bob').doc('voies/v1').update({ methodCount: -1 }));
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
    await assertSucceeds(owner().doc('gyms/g1').update(trace('owner', { name: 'Altissimo' })));
  });
  test("un grimpeur quelconque ne doit pas pouvoir remplacer la photo du mur d'une salle", async () => {
    await seed('walls/w1', { gymId: 'g1', photo: 'photo:abc', authorId: 'alice' });
    await assertFails(user('bob').doc('walls/w1').update({ photo: 'photo:pirate' }));
  });
  test('un invité ne peut pas créer de salle', async () => {
    await assertFails(anon().doc('gyms/g2').set({ name: 'Nouvelle salle' }));
  });
});

describe('Propriétaires de salle', () => {
  const ALICE = { email: 'alice@example.com', email_verified: true };
  const alice = () => env.authenticatedContext('alice', ALICE).firestore();
  const bob = () => env.authenticatedContext('bob', { email: 'bob@example.com', email_verified: true }).firestore();
  const owns = (gymId, email = ALICE.email) => seed(`gymOwners/${gymId}__${email}`, { gymId, email });
  const wall = { gymId: 'g1', image: 'photo:x', active: true, createdAt: 1 };

  test('un connecté non-propriétaire ne peut pas changer le mur', async () => {
    await seed('gyms/g1', { name: 'A' });
    await seed('walls/w1', wall);
    await assertFails(bob().doc('walls/w1').update({ active: false }));
    await assertFails(bob().doc('walls/w2').set(wall));
  });
  test('le propriétaire ajoute et désactive un mur de sa salle, l\'admin aussi', async () => {
    await owns('g1');
    await seed('gyms/g1', { name: 'A' });
    await seed('walls/w1', wall);
    await assertSucceeds(alice().doc('walls/w1').update({ active: false }));
    await assertSucceeds(alice().doc('walls/w2').set(wall));
    await assertSucceeds(owner().doc('walls/w1').update({ active: true }));
    await assertSucceeds(owner().doc('walls/w3').set(wall));
  });
  test('un mur ne change pas de salle', async () => {
    await owns('g1');
    await seed('walls/w1', wall);
    await assertFails(alice().doc('walls/w1').update({ gymId: 'g2' }));
  });
  test('le propriétaire de la salle A ne peut pas changer le mur de la salle B', async () => {
    await owns('g1');
    await seed('gyms/g2', { name: 'B' });
    await seed('walls/w9', { ...wall, gymId: 'g2' });
    await assertFails(alice().doc('walls/w9').update({ active: false }));
    await assertFails(alice().doc('walls/w10').set({ ...wall, gymId: 'g2' }));
  });
  test('une personne peut posséder plusieurs salles', async () => {
    await owns('g1'); await owns('g2');
    await seed('walls/w1', wall);
    await seed('walls/w2', { ...wall, gymId: 'g2' });
    await assertSucceeds(alice().doc('walls/w1').update({ active: false }));
    await assertSucceeds(alice().doc('walls/w2').update({ active: false }));
  });
  test('un e-mail non vérifié ne donne pas le rôle', async () => {
    await owns('g1');
    await seed('walls/w1', wall);
    const fake = env.authenticatedContext('x', { email: ALICE.email, email_verified: false }).firestore();
    await assertFails(fake.doc('walls/w1').update({ active: false }));
  });
  test('un rôle retiré ne donne plus aucun droit', async () => {
    await owns('g1');
    await seed('walls/w1', wall);
    await owner().doc(`gymOwners/g1__${ALICE.email}`).delete();
    await assertFails(alice().doc('walls/w1').update({ active: false }));
  });
  test('la création d\'une salle reste ouverte, avec sa photo initiale dans le même lot', async () => {
    const db = bob(), batch = db.batch();
    batch.set(db.doc('gyms/neuve'), { name: 'Neuve', commune: { nom: 'Albi', code: '81004', departement: '81', simple: 'albi', verifie: true } });
    batch.set(db.doc('walls/init'), { ...wall, gymId: 'neuve' });
    await assertSucceeds(batch.commit());
    // Le créateur ne devient pas propriétaire : le mur suivant lui est refusé.
    await assertFails(bob().doc('walls/w2').set({ ...wall, gymId: 'neuve' }));
    await assertFails(bob().doc('walls/init').update({ active: false }));
  });
  test('sans créer la salle, le mur initial est refusé', async () => {
    await assertFails(bob().doc('walls/w1').set({ ...wall, gymId: 'inexistante' }));
  });
  test('le propriétaire supprime le bloc d\'un autre dans sa salle, sans pouvoir le modifier', async () => {
    await owns('g1');
    await seed('blocs/b1', { authorId: 'bob', gymId: 'g1', name: 'Bloc' });
    await seed('blocs/b2', { authorId: 'bob', gymId: 'g2', name: 'Bloc' });
    await assertFails(alice().doc('blocs/b1').update({ name: 'Autre', updatedAt: 1, updatedBy: 'alice' }));
    await assertFails(alice().doc('blocs/b2').delete());
    await assertSucceeds(alice().doc('blocs/b1').delete());
  });
  test('personne ne peut s\'attribuer un rôle', async () => {
    const data = { gymId: 'g1', email: ALICE.email };
    await assertFails(alice().doc(`gymOwners/g1__${ALICE.email}`).set(data));
    await assertFails(anon().doc(`gymOwners/g1__${ALICE.email}`).set(data));
    await owns('g1');
    await assertFails(alice().doc(`gymOwners/g1__${ALICE.email}`).delete());
    await assertFails(alice().doc(`gymOwners/g2__${ALICE.email}`).set({ gymId: 'g2', email: ALICE.email }));
  });
  test('l\'admin attribue et retire un rôle, avec un identifiant cohérent', async () => {
    await assertSucceeds(owner().doc(`gymOwners/g1__${ALICE.email}`).set({ gymId: 'g1', email: ALICE.email }));
    await assertFails(owner().doc('gymOwners/autre').set({ gymId: 'g1', email: ALICE.email }));
    await assertFails(owner().doc('gymOwners/g1__ALICE@EXAMPLE.COM').set({ gymId: 'g1', email: 'ALICE@EXAMPLE.COM' }));
    await assertSucceeds(owner().doc(`gymOwners/g1__${ALICE.email}`).delete());
  });
  test('chacun ne lit que ses propres rôles', async () => {
    await owns('g1');
    await assertSucceeds(alice().collection('gymOwners').where('email', '==', ALICE.email).get());
    await assertFails(bob().doc(`gymOwners/g1__${ALICE.email}`).get());
    await assertFails(bob().collection('gymOwners').get());
    await assertFails(anon().collection('gymOwners').get());
    await assertSucceeds(owner().collection('gymOwners').get());
  });
});

describe('Méthodes privées', () => {
  const meth = { authorId: 'alice', voieId: 'v1', climber: 'Alice', createdAt: 1 };
  test('un autre connecté et un invité ne lisent pas une méthode privée, même avec son identifiant', async () => {
    await seed('methodesPrivees/m1', meth);
    await assertFails(user('bob').doc('methodesPrivees/m1').get());
    await assertFails(anon().doc('methodesPrivees/m1').get());
    await assertFails(user('bob').collection('methodesPrivees').where('voieId', '==', 'v1').get());
  });
  test("l'auteur la lit, la modifie et la crée à son nom seulement", async () => {
    await seed('methodesPrivees/m1', meth);
    await assertSucceeds(user('alice').doc('methodesPrivees/m1').get());
    await assertSucceeds(user('alice').collection('methodesPrivees').where('voieId', '==', 'v1').where('authorId', '==', 'alice').get());
    await assertSucceeds(user('alice').doc('methodesPrivees/m1').update(trace('alice', { climber: 'Alicia' })));
    await assertFails(user('alice').doc('methodesPrivees/m1').update(trace('alice', { authorId: 'bob' })));
    await assertFails(user('bob').doc('methodesPrivees/m1').update(trace('bob', { climber: 'X' })));
    await assertFails(user('bob').doc('methodesPrivees/m2').set(meth));
  });
  test("l'admin la lit et la supprime", async () => {
    await seed('methodesPrivees/m1', meth);
    await assertSucceeds(owner().doc('methodesPrivees/m1').get());
    await assertSucceeds(owner().collection('methodesPrivees').where('voieId', '==', 'v1').get());
    await assertSucceeds(owner().doc('methodesPrivees/m1').delete());
  });
  test('passer en public est un déplacement dans un seul lot, le compteur fait +1', async () => {
    await seed('voies/v1', { authorId: 'bob', name: 'V', methodCount: 0 });
    await seed('methodesPrivees/m1', meth);
    const db = user('alice'), batch = db.batch();
    batch.delete(db.doc('methodesPrivees/m1'));
    batch.set(db.doc('methodes/m1'), meth);
    batch.update(db.doc('voies/v1'), { methodCount: 1 });
    await assertSucceeds(batch.commit());
  });
});

describe('Suppression d\'une voie avec des contributeurs', () => {
  const voie = (foreignCount = 0) => ({ authorId: 'alice', name: 'V', methodCount: 0, foreignCount });
  const contribute = async uid => {
    const db = user(uid), batch = db.batch();
    batch.set(db.doc(`voies/v1/contributeurs/${uid}`), { createdAt: 1 });
    batch.update(db.doc('voies/v1'), { foreignCount: 1 });
    return batch.commit();
  };
  test("l'auteur supprime sa voie sans contributeur", async () => {
    await seed('voies/v1', voie());
    await assertSucceeds(user('alice').doc('voies/v1').delete());
  });
  test("l'auteur ne peut pas supprimer la voie si un autre y a une méthode, publique ou privée ; l'admin le peut", async () => {
    await seed('voies/v1', voie());
    await assertSucceeds(contribute('bob'));
    await assertFails(user('alice').doc('voies/v1').delete());
    await assertSucceeds(owner().doc('voies/v1').delete());
  });
  test("l'auteur ne peut pas remettre le compteur à zéro ni retirer la marque d'un autre", async () => {
    await seed('voies/v1', voie());
    await assertSucceeds(contribute('bob'));
    await assertFails(user('alice').doc('voies/v1').update({ foreignCount: 0 }));
    const db = user('alice'), batch = db.batch();
    batch.delete(db.doc('voies/v1/contributeurs/bob'));
    batch.update(db.doc('voies/v1'), { foreignCount: 0 });
    await assertFails(batch.commit());
  });
  test('le compteur ne bouge pas sans la marque, et la marque pas sans le compteur', async () => {
    await seed('voies/v1', voie());
    await assertFails(user('bob').doc('voies/v1').update({ foreignCount: 1 }));
    await assertFails(user('bob').doc('voies/v1/contributeurs/bob').set({ createdAt: 1 }));
    await seed('voies/v2', { ...voie(), foreignCount: 1 });
    await assertFails(user('bob').doc('voies/v2').update({ foreignCount: 0 }));
  });
  test("l'auteur de la voie ne se marque pas comme contributeur, ni au nom d'un autre", async () => {
    await seed('voies/v1', voie());
    await assertFails(contribute('alice'));
    const db = user('bob'), batch = db.batch();
    batch.set(db.doc('voies/v1/contributeurs/carole'), { createdAt: 1 });
    batch.update(db.doc('voies/v1'), { foreignCount: 1 });
    await assertFails(batch.commit());
  });
  test('un contributeur retire sa marque avec le compteur : la voie redevient supprimable', async () => {
    await seed('voies/v1', voie());
    await assertSucceeds(contribute('bob'));
    const db = user('bob'), batch = db.batch();
    batch.delete(db.doc('voies/v1/contributeurs/bob'));
    batch.update(db.doc('voies/v1'), { foreignCount: 0 });
    await assertSucceeds(batch.commit());
    await assertSucceeds(user('alice').doc('voies/v1').delete());
  });
});

describe('Commune obligatoire', () => {
  const ok = { nom: 'Saint-Antonin-Noble-Val', code: '82155', departement: '82', lat: 44.15, lon: 1.75, simple: 'saint antonin noble val', verifie: true };
  const libre = { nom: 'Saint Machin', simple: 'saint machin', verifie: false };
  for (const col of ['secteurs', 'gyms']) {
    test(`${col} : créé avec une commune de la liste ou une saisie non vérifiée, refusé sinon`, async () => {
      await assertSucceeds(user('alice').doc(`${col}/a`).set({ name: 'A', commune: ok }));
      await assertSucceeds(user('alice').doc(`${col}/b`).set({ name: 'B', commune: libre }));
      await assertFails(user('alice').doc(`${col}/c`).set({ name: 'C' }));
      await assertFails(user('alice').doc(`${col}/d`).set({ name: 'D', commune: { ...ok, nom: '  ' } }));
      await assertFails(user('alice').doc(`${col}/e`).set({ name: 'E', commune: { nom: 'X', simple: 'x', verifie: true } }));
      await assertFails(anon().doc(`${col}/f`).set({ name: 'F', commune: ok }));
    });
  }
  test("un non-admin ne modifie pas la commune du secteur d'un autre, ni du sien ; l'admin la rattache", async () => {
    await seed('secteurs/s1', { name: 'S', authorId: 'alice' });
    await assertFails(user('bob').doc('secteurs/s1').update(trace('bob', { commune: ok, region: 'X' })));
    await assertFails(user('alice').doc('secteurs/s1').update(trace('alice', { commune: ok, region: 'X' })));
    await assertSucceeds(owner().doc('secteurs/s1').update(trace('owner', { commune: ok, region: 'Saint-Antonin-Noble-Val (82)' })));
    await seed('secteurs/s2', { name: 'S2' });
    await assertFails(owner().doc('secteurs/s2').update({ commune: libre }));
  });
});

describe('Notes', () => {
  const voie = (extra = {}) => ({ authorId: 'alice', name: 'V', ...extra });
  const vid = uid => `voies__v1__${uid}`;
  const vote = (uid, value) => ({ kind: 'voies', targetId: 'v1', authorId: uid, value, createdAt: 1, updatedAt: 1 });
  function cast(uid, value, { count = 1, sum = value, id = vid(uid) } = {}) {
    const db = user(uid), b = db.batch();
    b.set(db.doc(`votes/${id}`), vote(uid, value));
    b.update(db.doc('voies/v1'), { ratingCount: count, ratingSum: sum });
    return b.commit();
  }
  test('un grimpeur vote de 0 à 3 ; le compteur suit', async () => {
    await seed('voies/v1', voie());
    await assertSucceeds(cast('bob', 0));
    await seed('voies/v2', voie());
    const db = user('carole'), b = db.batch();
    b.set(db.doc('votes/voies__v2__carole'), { ...vote('carole', 3), targetId: 'v2' });
    b.update(db.doc('voies/v2'), { ratingCount: 1, ratingSum: 3 });
    await assertSucceeds(b.commit());
  });
  test('les valeurs −1, 4 et 2,5 sont refusées', async () => {
    await seed('voies/v1', voie());
    for (const v of [-1, 4, 2.5]) await assertFails(cast('bob', v));
  });
  test('un invité ne peut pas voter', async () => {
    await seed('voies/v1', voie());
    const db = anon(), b = db.batch();
    b.set(db.doc(`votes/${vid('bob')}`), vote('bob', 2));
    b.update(db.doc('voies/v1'), { ratingCount: 1, ratingSum: 2 });
    await assertFails(b.commit());
  });
  test("l'auteur ne peut pas noter son propre contenu", async () => {
    await seed('voies/v1', voie());
    await assertFails(cast('alice', 3));
  });
  test('un second vote du même grimpeur ne compte pas deux fois', async () => {
    await seed('voies/v1', voie());
    await assertSucceeds(cast('bob', 2));
    await assertFails(cast('bob', 3, { count: 2, sum: 5 }));
    const db = user('bob'), b = db.batch();
    b.update(db.doc(`votes/${vid('bob')}`), { value: 3 });
    b.update(db.doc('voies/v1'), { ratingSum: 3 });
    await assertSucceeds(b.commit());
  });
  test('un vote ne peut pas être enregistré sous un autre identifiant', async () => {
    await seed('voies/v1', voie());
    await assertFails(cast('bob', 2, { id: 'voies__v1__autre' }));
    await assertFails(cast('bob', 2, { id: 'libre' }));
  });
  test("personne ne peut modifier ni lire le vote d'un autre", async () => {
    await seed('voies/v1', voie({ ratingCount: 1, ratingSum: 2 }));
    await seed(`votes/${vid('bob')}`, vote('bob', 2));
    await assertFails(user('carole').doc(`votes/${vid('bob')}`).get());
    await assertFails(anon().doc(`votes/${vid('bob')}`).get());
    await assertFails(user('carole').doc(`votes/${vid('bob')}`).update({ value: 0 }));
    await assertFails(user('carole').doc(`votes/${vid('bob')}`).delete());
    await assertSucceeds(user('bob').doc(`votes/${vid('bob')}`).get());
    await assertSucceeds(owner().doc(`votes/${vid('bob')}`).get());
  });
  test("chacun lit son vote même s'il n'existe pas encore, pas celui d'un autre", async () => {
    await assertSucceeds(user('bob').doc(`votes/${vid('bob')}`).get());
    await assertFails(user('carole').doc(`votes/${vid('bob')}`).get());
    await assertFails(user('bob').collection('votes').get());
  });
  test('la moyenne ne peut pas être faussée', async () => {
    await seed('voies/v1', voie({ ratingCount: 1, ratingSum: 2 }));
    await seed(`votes/${vid('bob')}`, vote('bob', 2));
    await assertFails(user('carole').doc('voies/v1').update({ ratingCount: 2, ratingSum: 5 }));
    await assertFails(user('alice').doc('voies/v1').update(trace('alice', { ratingSum: 300 })));
    await assertFails(owner().doc('voies/v1').update(trace('owner', { ratingSum: 300 })));
    await assertFails(cast('carole', 1, { count: 2, sum: 90 }));
    // Retirer son vote exige de retirer aussi sa part du total.
    await assertFails(user('bob').doc(`votes/${vid('bob')}`).delete());
    const db = user('bob'), b = db.batch();
    b.delete(db.doc(`votes/${vid('bob')}`));
    b.update(db.doc('voies/v1'), { ratingCount: 0, ratingSum: 0 });
    await assertSucceeds(b.commit());
  });
  test('on ne crée pas un contenu avec une note déjà remplie', async () => {
    await assertFails(user('alice').doc('voies/v9').set({ authorId: 'alice', name: 'V', ratingCount: 9, ratingSum: 27 }));
    await assertFails(user('alice').doc('blocs/b9').set({ authorId: 'alice', name: 'B', ratingCount: 9, ratingSum: 27 }));
  });
  test('un bloc archivé garde sa note mais ne peut plus être noté', async () => {
    await seed('walls/old', { gymId: 'g1', active: false });
    await seed('walls/new', { gymId: 'g1', active: true });
    await seed('blocs/b1', { authorId: 'alice', name: 'B', wallId: 'old', ratingCount: 3, ratingSum: 6 });
    await seed('blocs/b2', { authorId: 'alice', name: 'B', wallId: 'new' });
    const go = (bloc, count, sum) => {
      const db = user('bob'), b = db.batch();
      b.set(db.doc(`votes/blocs__${bloc}__bob`), { kind: 'blocs', targetId: bloc, authorId: 'bob', value: 2, createdAt: 1, updatedAt: 1 });
      b.update(db.doc(`blocs/${bloc}`), { ratingCount: count, ratingSum: sum });
      return b.commit();
    };
    await assertFails(go('b1', 4, 8));
    await assertSucceeds(go('b2', 1, 2));
  });
  test("l'admin supprime les votes d'un contenu qu'il supprime", async () => {
    await seed('voies/v1', voie({ ratingCount: 1, ratingSum: 2 }));
    await seed(`votes/${vid('bob')}`, vote('bob', 2));
    await assertSucceeds(owner().collection('votes').where('targetId', '==', 'v1').get());
    await assertSucceeds(owner().doc(`votes/${vid('bob')}`).delete());
  });
});

describe('Longueurs et vues', () => {
  const voie = (extra = {}) => ({ authorId: 'alice', name: 'V', grade: '6a', methodCount: 0, longueurs: [{ id: 'l1', name: 'L1', grade: '6a' }], longueurIds: ['l1'], ...extra });
  const vue = (uid, extra = {}) => ({ voieId: 'v1', longueurId: 'l1', label: 'Vue', authorId: uid, anchors: [], order: 1, createdAt: 1, ...extra });
  function addVue(uid, id = 'x1', extra = {}, count = 1) {
    const db = user(uid), b = db.batch();
    b.set(db.doc(`vues/${id}`), vue(uid, extra));
    b.set(db.doc(`voies/v1/contributeurs/${uid}`), { createdAt: 1 });
    b.update(db.doc('voies/v1'), { foreignCount: count });
    return b.commit();
  }
  test("un grimpeur non auteur ajoute une vue, mais pas de longueur ni de cotation", async () => {
    await seed('voies/v1', voie());
    await assertSucceeds(addVue('bob'));
    await assertFails(user('bob').doc('voies/v1').update(trace('bob', { longueurs: [], longueurIds: ['l1', 'l2'] })));
    await assertFails(user('bob').doc('voies/v1').update(trace('bob', { grade: '9a' })));
  });
  test("une vue sans sa marque de contribution, ou sur une longueur inexistante, est refusée", async () => {
    await seed('voies/v1', voie());
    await assertFails(user('bob').doc('vues/x1').set(vue('bob')));
    await assertFails(addVue('bob', 'x2', { longueurId: 'autre' }));
    await assertFails(addVue('bob', 'x3', { label: '  ' }));
    await assertFails(user('bob').doc('vues/x4').set(vue('alice')));
    await assertFails(anon().doc('vues/x5').set(vue('bob')));
  });
  test("l'auteur de la voie ajoute une vue sans marque, et un ancien document sans longueurs accepte L1", async () => {
    await seed('voies/v1', { authorId: 'alice', name: 'V', grade: '6a' });
    await assertSucceeds(user('alice').doc('vues/x1').set(vue('alice')));
  });
  test("un grimpeur ne peut pas modifier la vue d'un autre ; l'auteur et l'admin oui", async () => {
    await seed('voies/v1', voie());
    await seed('vues/x1', vue('bob'));
    await assertFails(user('carole').doc('vues/x1').update(trace('carole', { label: 'Pirate' })));
    await assertSucceeds(user('bob').doc('vues/x1').update(trace('bob', { label: 'Mieux' })));
    await assertSucceeds(owner().doc('vues/x1').update(trace('owner', { label: 'Encore' })));
    await assertFails(user('bob').doc('vues/x1').update(trace('bob', { label: '' })));
    await assertFails(user('bob').doc('vues/x1').update(trace('bob', { voieId: 'autre' })));
  });
  test("l'auteur de la voie range les vues des autres, sans les modifier", async () => {
    await seed('voies/v1', voie());
    await seed('vues/x1', vue('bob'));
    await assertSucceeds(user('alice').doc('vues/x1').update({ order: 5 }));
    await assertFails(user('alice').doc('vues/x1').update(trace('alice', { label: 'Pirate' })));
    await assertFails(user('alice').doc('vues/x1').delete());
    await assertFails(user('carole').doc('vues/x1').update({ order: 5 }));
  });
  test("l'auteur ne peut pas supprimer une vue utilisée par la méthode d'un autre ; l'admin le peut", async () => {
    await seed('voies/v1', voie());
    await seed('vues/x1', vue('bob'));
    const db = user('carole'), b = db.batch();
    b.set(db.doc('vues/x1/utilisateurs/carole'), { createdAt: 1 });
    b.update(db.doc('vues/x1'), { foreignUses: 1 });
    await assertSucceeds(b.commit());
    await assertFails(user('bob').doc('vues/x1').delete());
    await assertFails(user('bob').doc('vues/x1').update({ foreignUses: 0 }));
    await assertSucceeds(owner().doc('vues/x1').delete());
  });
  test("l'auteur supprime sa vue si personne ne l'utilise", async () => {
    await seed('voies/v1', voie());
    await seed('vues/x1', vue('bob'));
    await assertSucceeds(user('bob').doc('vues/x1').delete());
  });
  test("l'auteur d'une voie ne peut pas la supprimer si un autre grimpeur y a une vue, l'admin le peut", async () => {
    await seed('voies/v1', voie());
    await assertSucceeds(addVue('bob'));
    await assertFails(user('alice').doc('voies/v1').delete());
    await assertSucceeds(owner().doc('voies/v1').delete());
  });
  test("retirer une longueur : l'auteur seul sans contributeur, sinon seul l'admin", async () => {
    const two = { longueurs: [{ id: 'l1', name: 'L1', grade: '6a' }, { id: 'l2', name: 'L2', grade: '6b' }], longueurIds: ['l1', 'l2'] };
    const one = { longueurs: [{ id: 'l1', name: 'L1', grade: '6a' }], longueurIds: ['l1'] };
    await seed('voies/v1', voie(two));
    await assertSucceeds(user('alice').doc('voies/v1').update(trace('alice', one)));
    await seed('voies/v2', voie({ ...two, foreignCount: 1 }));
    await assertFails(user('alice').doc('voies/v2').update(trace('alice', one)));
    await assertSucceeds(user('alice').doc('voies/v2').update(trace('alice', { longueurs: [...two.longueurs, { id: 'l3', name: 'L3', grade: '7a' }], longueurIds: ['l1', 'l2', 'l3'], grade: '7a' })));
    await assertSucceeds(owner().doc('voies/v2').update(trace('owner', one)));
  });
});

describe('Correction des noms', () => {
  const CONTENUS = [
    ['blocs/b1', { authorId: 'alice', gymId: 'g1', wallId: 'w1', createdAt: 1, name: 'Bloc', grade: '6a', setter: 'Alice' }, { setter: 'Alicia', name: 'Bloc v2', grade: '6b' }],
    ['voies/v1', { authorId: 'alice', secteurId: 's1', createdAt: 1, name: 'Voie', grade: '6a', addedBy: 'Paul', methodCount: 0 }, { addedBy: 'Alice', name: 'Voie v2', grade: '6b' }],
    ['methodes/m1', { authorId: 'alice', voieId: 'v1', secteurId: 's1', createdAt: 1, climber: 'Alice' }, { climber: 'Alicia' }],
  ];
  for (const [path, doc, edit] of CONTENUS) {
    test(`${path} : l'admin et l'auteur corrigent, ni un autre ni un invité`, async () => {
      await seed(path, doc);
      await assertSucceeds(owner().doc(path).update(trace('owner', edit)));
      await assertSucceeds(user('alice').doc(path).update(trace('alice', edit)));
      await assertFails(user('bob').doc(path).update(trace('bob', edit)));
      await assertFails(anon().doc(path).update(edit));
    });
    test(`${path} : auteur réel, création et rattachements sont intouchables, même pour l'admin`, async () => {
      await seed(path, doc);
      for (const f of ['authorId', 'createdAt', 'gymId', 'wallId', 'secteurId', 'voieId']) {
        await assertFails(owner().doc(path).update(trace('owner', { [f]: f === 'createdAt' ? 2 : 'autre' })));
        await assertFails(user('alice').doc(path).update(trace('alice', { [f]: f === 'createdAt' ? 2 : 'autre' })));
      }
    });
    test(`${path} : un nom vide ou fait d'espaces est refusé`, async () => {
      await seed(path, doc);
      const f = Object.keys(edit)[0];
      await assertFails(owner().doc(path).update(trace('owner', { [f]: '' })));
      await assertFails(owner().doc(path).update(trace('owner', { [f]: '   ' })));
      await assertFails(user('alice').doc(path).update(trace('alice', { [f]: '   ' })));
    });
    test(`${path} : un changement de nom doit être signé par celui qui le fait`, async () => {
      await seed(path, doc);
      await assertFails(owner().doc(path).update(edit));
      await assertFails(owner().doc(path).update(trace('alice', edit)));
    });
  }
  test("l'admin modifie une salle et un secteur, un non-admin non, même son auteur", async () => {
    await seed('gyms/g1', { name: 'Salle', city: 'Albi', createdAt: 1 });
    await seed('secteurs/s1', { name: 'St Antonin noble val', region: '', authorId: 'alice', createdAt: 1 });
    await assertSucceeds(owner().doc('gyms/g1').update(trace('owner', { name: 'Altissimo', city: 'Albi (81)' })));
    await assertSucceeds(owner().doc('secteurs/s1').update(trace('owner', { name: 'Saint-Antonin', region: 'Saint-Antonin-Noble-Val' })));
    await assertFails(user('bob').doc('gyms/g1').update(trace('bob', { name: 'Piraté' })));
    await assertFails(user('alice').doc('secteurs/s1').update(trace('alice', { name: 'Piraté' })));
    await assertFails(anon().doc('secteurs/s1').update({ name: 'Piraté' }));
  });
  test('un nom de salle, de secteur ou de voie vide est refusé', async () => {
    await seed('gyms/g1', { name: 'Salle' });
    await seed('secteurs/s1', { name: 'Secteur' });
    await assertFails(owner().doc('gyms/g1').update(trace('owner', { name: '  ' })));
    await assertFails(owner().doc('secteurs/s1').update(trace('owner', { name: '' })));
  });
  test('les longueurs maximales sont celles de la création', async () => {
    await seed('gyms/g1', { name: 'Salle' });
    await seed('secteurs/s1', { name: 'Secteur' });
    await seed('voies/v1', { authorId: 'alice', name: 'Voie' });
    await assertSucceeds(owner().doc('gyms/g1').update(trace('owner', { name: 'x'.repeat(40) })));
    await assertFails(owner().doc('gyms/g1').update(trace('owner', { name: 'x'.repeat(41) })));
    await assertSucceeds(owner().doc('secteurs/s1').update(trace('owner', { name: 'x'.repeat(50) })));
    await assertFails(owner().doc('secteurs/s1').update(trace('owner', { name: 'x'.repeat(51) })));
    await assertSucceeds(owner().doc('voies/v1').update(trace('owner', { name: 'x'.repeat(50) })));
    await assertFails(owner().doc('voies/v1').update(trace('owner', { name: 'x'.repeat(51) })));
  });
  test('un ancien document au nom vide reste modifiable sur ses autres champs', async () => {
    await seed('voies/v1', { authorId: 'alice', name: 'Voie', addedBy: '', anchors: [] });
    await assertSucceeds(user('alice').doc('voies/v1').update({ anchors: [{ x: 1 }] }));
  });
  test('le compteur de méthodes reste ouvert sans signature', async () => {
    await seed('voies/v1', { authorId: 'alice', name: 'Voie', methodCount: 0 });
    await assertSucceeds(user('bob').doc('voies/v1').update({ methodCount: 1 }));
    await assertSucceeds(user('alice').doc('voies/v1').update({ methodCount: 2 }));
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
