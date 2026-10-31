// Mesure d'audience : ce qui part vers Umami, et l'appli quand Umami n'est pas là.
const fs = require('fs');
const path = require('path');
const base = require('@playwright/test');
const { test, expect } = require('./fixtures');
const { ALICE, login, seed } = require('./helpers');

const uid = testInfo => `${testInfo.project.name}-${Date.now()}`;
const PUBLIC = path.join(__dirname, '..', '..', 'public');

// Remplace Umami par un enregistreur : le vrai script n'est chargé que sur la prod.
async function spy(page) {
  await page.addInitScript(() => {
    window.__sent = [];
    window.umami = { track: fn => window.__sent.push(fn({ website: 'w', hostname: location.hostname, title: 'x', url: 'x', referrer: '' })) };
  });
}
const sent = page => page.evaluate(() => window.__sent);
const events = async (page, name) => (await sent(page)).filter(p => p.name === name);
const pages = async page => (await sent(page)).filter(p => !p.name).map(p => new URL(p.url).pathname);

async function seedAll(id, me = 'autre') {
  await seed('gyms', id, { name: `Salle ${id}`, city: 'Albi', createdAt: 1 });
  await seed('walls', `w-${id}`, { gymId: id, name: 'Spray', image: '', w: 100, h: 100, active: true, createdAt: 1 });
  await seed('blocs', `b-${id}`, { gymId: id, wallId: `w-${id}`, name: `Secret ${id}`, grade: '6a', setter: 'Paul', holds: [{ t: 'start', x: 0.5, y: 0.5 }, { t: 'top', x: 0.5, y: 0.2 }], authorId: me, createdAt: 1 });
  await seed('secteurs', `s-${id}`, { name: `Secteur ${id}`, region: '', createdAt: 1 });
  await seed('voies', `v-${id}`, { secteurId: `s-${id}`, name: `Voie ${id}`, grade: '6a', w: 100, h: 100, image: '', anchors: [], authorId: me, addedBy: 'Paul', methodCount: 1, createdAt: 1 });
  await seed('methodes', `m-${id}`, { voieId: `v-${id}`, secteurId: `s-${id}`, authorId: me, climber: 'Paul', steps: [{ t: 'hand', x: 0.5, y: 0.5 }], createdAt: 1 });
}

// Sert public/ sous une fausse adresse, tout le reste du réseau est coupé : aucune requête ne peut atteindre la prod ni Umami.
async function serveAs(page, host, umami) {
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.hostname === 'www.gstatic.com') return route.continue();
    if (url.hostname === 'cloud.umami.is') { umami.push(url.href); return route.fulfill({ contentType: 'text/javascript', body: '' }); }
    if (url.hostname !== host) { if (url.hostname.includes('umami')) umami.push(url.href); return route.abort(); }
    const file = path.join(PUBLIC, url.pathname === '/' ? 'index.html' : url.pathname);
    return fs.existsSync(file) ? route.fulfill({ path: file }) : route.fulfill({ status: 404, body: '' });
  });
}

base.test('sur la prod, le script Umami se charge, verrouillé sur le domaine et sans suivi automatique', async ({ page }) => {
  const umami = [];
  await serveAs(page, 'toposhare.web.app', umami);
  await page.goto('https://toposhare.web.app/');
  const s = page.locator('script[src="https://cloud.umami.is/script.js"]');
  await expect(s).toHaveAttribute('data-website-id', '64f3bc6d-f1ad-44a1-bb81-86c2a4374047');
  await expect(s).toHaveAttribute('data-domains', 'toposhare.web.app');
  await expect(s).toHaveAttribute('data-auto-track', 'false');
  expect(umami).toEqual(['https://cloud.umami.is/script.js']);
});

for (const host of ['toposhare-test.web.app', 'toposhare--pr24-abc.web.app', 'toposhare.firebaseapp.com']) {
  base.test(`aucun appel vers Umami depuis ${host}`, async ({ page }) => {
    const umami = [];
    await serveAs(page, host, umami);
    await page.goto(`https://${host}/?src=qr#/salle/altissimo-albi`);
    await page.waitForFunction(() => window.TS_MESURE);
    await page.evaluate(() => { TS_MESURE.page('/x'); TS_MESURE.event('connexion'); });
    await page.waitForTimeout(300);
    await expect(page.locator('script[src*="umami"]')).toHaveCount(0);
    expect(umami).toEqual([]);
  });
}

test('en local non plus, aucun appel vers Umami', async ({ page }, testInfo) => {
  const umami = [];
  page.on('request', r => { if (r.url().includes('umami')) umami.push(r.url()); });
  await page.goto('/');
  await expect(page.locator('#tabHome')).toBeVisible();
  expect(umami).toEqual([]);
});

test("l'appli reste utilisable quand Umami est bloqué", async ({ page }, testInfo) => {
  const id = uid(testInfo);
  await seedAll(id);
  // Sans enregistreur, et même si le script était demandé, il échouerait : les envois sont abandonnés sans erreur (la fixture échoue sur toute erreur JS).
  await page.route(/umami/, r => r.abort());
  await page.goto(`/#/bloc/b-${id}`);
  await expect(page.locator('#dName')).toHaveText(`Secret ${id}`);
  await page.locator('#dReplay').click();
  await expect(page.locator('#fs')).toBeVisible();
});

test('chaque changement d\'écran compte comme une page vue, sans doublon sur un lien direct', async ({ page }, testInfo) => {
  const id = uid(testInfo);
  await seedAll(id);
  await spy(page);
  await page.goto('/');
  await expect.poll(() => pages(page)).toEqual(['/']);
  // Un lien direct passe par la salle puis le bloc : une seule page vue, la dernière.
  await page.evaluate(i => { location.hash = `#/bloc/b-${i}`; }, id);
  await expect.poll(() => pages(page)).toEqual(['/', `/bloc/b-${id}`]);
  await page.locator('#tabPlace').click();
  await expect.poll(() => pages(page)).toEqual(['/', `/bloc/b-${id}`, `/salle/${id}`]);
  await page.locator('#tabHome').click();
  await expect.poll(() => pages(page)).toEqual(['/', `/bloc/b-${id}`, `/salle/${id}`, '/']);
  const all = (await sent(page)).filter(p => !p.name);
  expect(new URL(all[3].referrer).pathname).toBe(`/salle/${id}`);
  await page.evaluate(i => { location.hash = `#/voie/v-${i}`; }, id);
  await expect.poll(() => pages(page)).toContain(`/voie/v-${id}`);
});

test('arrivée par QR : une seule fois, avec la salle, et src disparaît de l\'adresse', async ({ page }, testInfo) => {
  const id = uid(testInfo);
  await seedAll(id);
  await spy(page);
  await page.goto(`/?src=qr#/salle/${id}`);
  await expect.poll(() => pages(page)).toEqual([`/salle/${id}`]);
  const qr = await events(page, 'arrivee_qr');
  expect(qr.map(e => e.data)).toEqual([{ salle: id }]);
  expect(page.url()).not.toContain('src=');
  // L'appli retire le # à l'arrivée : un rechargement repart de l'accueil, et ne recompte pas le QR.
  await page.reload();
  await expect.poll(() => pages(page)).toEqual(['/']);
  expect(await events(page, 'arrivee_qr')).toEqual([]);
});

test('une ancienne affiche, sans src, ne compte pas comme une arrivée par QR', async ({ page }, testInfo) => {
  const id = uid(testInfo);
  await seedAll(id);
  await spy(page);
  await page.goto(`/#/salle/${id}`);
  await expect.poll(() => pages(page)).toEqual([`/salle/${id}`]);
  expect(await events(page, 'arrivee_qr')).toEqual([]);
});

test('ouverture et replay comptent, chaque replay compte, avec la salle et le type', async ({ page }, testInfo) => {
  const id = uid(testInfo);
  await seedAll(id);
  await spy(page);
  await page.goto(`/#/bloc/b-${id}`);
  await expect.poll(async () => (await events(page, 'bloc_ouvert')).map(e => e.data)).toEqual([{ salle: id, type: 'bloc' }]);
  await page.locator('#dReplay').click();
  await page.locator('#fsClose').click();
  await page.locator('#dReplay').click();
  await page.locator('#fsClose').click();
  expect((await events(page, 'replay_lance')).map(e => e.data)).toEqual([{ salle: id, type: 'bloc' }, { salle: id, type: 'bloc' }]);

  await page.evaluate(i => { location.hash = `#/voie/v-${i}`; }, id);
  await expect.poll(async () => (await events(page, 'bloc_ouvert')).at(-1).data).toEqual({ salle: `s-${id}`, type: 'voie' });
  await page.getByRole('button', { name: 'Méthode de Paul' }).click();
  await page.locator('[data-act="replay"]').click();
  expect((await events(page, 'replay_lance')).at(-1).data).toEqual({ salle: `s-${id}`, type: 'voie' });
});

test('aucun envoi ne contient de nom, d\'e-mail ni d\'identifiant : connexion, création, consultation', async ({ page }, testInfo) => {
  const id = uid(testInfo);
  await seedAll(id);
  await spy(page);
  await page.goto(`/#/salle/${id}`);
  await login(page, ALICE);
  const me = await page.evaluate(() => BT.user().uid);
  await expect.poll(async () => (await events(page, 'connexion')).length).toBe(1);
  expect((await events(page, 'connexion'))[0].data).toEqual({});

  await page.locator('#tabCreate').click();
  await page.locator('#fName').fill(`Nom privé ${id}`);
  await page.locator('#fSetter').fill('Alice');
  await page.evaluate(() => { state.holds = [{ t: 'start', x: 0.3, y: 0.8 }, { t: 'hand', x: 0.4, y: 0.5 }, { t: 'top', x: 0.5, y: 0.2 }]; });
  await page.locator('#fSave').click();
  await expect.poll(async () => (await events(page, 'bloc_cree')).map(e => e.data)).toEqual([{ salle: id, type: 'bloc' }]);

  const all = await sent(page);
  const text = JSON.stringify(all);
  for (const secret of [ALICE.email, ALICE.name, me, 'Nom privé', `Secret ${id}`, 'Paul']) if (secret) expect(text, secret).not.toContain(secret);
  for (const p of all.filter(x => x.data)) expect(Object.keys(p.data).every(k => ['salle', 'type'].includes(k))).toBe(true);
  expect(all.every(p => p.title === 'TopoShare')).toBe(true);
});

test('publier une voie compte aussi, avec le secteur', async ({ page }, testInfo) => {
  const id = uid(testInfo);
  await seedAll(id);
  await spy(page);
  await page.goto(`/#/secteur/s-${id}`);
  await login(page, ALICE);
  await page.locator('#tabCreate').click();
  await page.locator('#oeFile').setInputFiles(path.join(PUBLIC, 'wall.jpg'));
  await page.locator('#oName').fill(`Voie privée ${id}`);
  const box = await page.locator('#oeWall').boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.locator('#oSave').click();
  await expect.poll(async () => (await events(page, 'bloc_cree')).map(e => e.data)).toEqual([{ salle: `s-${id}`, type: 'voie' }]);
  expect(JSON.stringify(await sent(page))).not.toContain('Voie privée');
});

test("la mention de mesure d'audience est visible et traduite", async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.BT);
  await page.locator('#tabCreate').click();
  await expect(page.locator('#sheet')).toContainText("Mesure d'audience anonyme, sans cookies (Umami)");
  await page.evaluate(() => localStorage.setItem('ts-lang', 'en'));
  await page.reload();
  await page.waitForFunction(() => window.BT);
  await page.locator('#tabCreate').click();
  await expect(page.locator('#sheet')).toContainText('Anonymous audience measurement, no cookies (Umami)');
});
