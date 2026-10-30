// Ticket 5 : choisir la commune dans la liste officielle. Le service est simulé : les tests ne dépendent pas du réseau.
const { test, expect } = require('./fixtures');
const { ADMIN, ALICE, login, seed } = require('./helpers');

const uid = testInfo => `${testInfo.project.name}-${Date.now()}`;
const SAINT_ANTONIN = { nom: 'Saint-Antonin-Noble-Val', code: '82155', codeDepartement: '82', centre: { type: 'Point', coordinates: [1.75, 44.15] } };

async function mockGeo(page, queries = []) {
  await page.route('**/geo.api.gouv.fr/**', r => {
    queries.push(new URL(r.request().url()).searchParams.get('nom'));
    r.fulfill({ json: [SAINT_ANTONIN], headers: { 'access-control-allow-origin': '*' } });
  });
}
async function openNewSector(page) {
  await page.addInitScript(() => localStorage.setItem('pan-mode', 'out'));
  await page.goto('/');
  await login(page, ALICE);
  await page.locator('#gymName').click();
  await page.locator('[data-sheet="newsector"]').click();
}
const stored = (page, name) => page.evaluate(n => BT.fs.collection('secteurs').where('name', '==', n).get().then(s => s.docs[0]?.data()), name);

test('« st antonin » propose la commune officielle, enregistrée avec son code INSEE et sa forme simplifiée', async ({ page }, testInfo) => {
  const name = `S ${uid(testInfo)}`, queries = [];
  await mockGeo(page, queries);
  await openNewSector(page);
  await page.locator('#nsName').fill(name);
  await page.locator('#nsRegion').fill('st antonin');
  await page.locator('[data-commune="0"]').click();
  await expect(page.locator('#nsRegion')).toHaveValue('Saint-Antonin-Noble-Val (82)');
  expect(queries).toContain('saint antonin');
  await page.locator('[data-sect-create]').click();
  await expect(page.locator('#sheetBg')).toBeHidden();
  const s = await stored(page, name);
  expect(s.region).toBe('Saint-Antonin-Noble-Val (82)');
  expect(s.commune).toMatchObject({ nom: 'Saint-Antonin-Noble-Val', code: '82155', departement: '82', lat: 44.15, lon: 1.75, simple: 'saint antonin noble val', verifie: true });
});

test("une lettre ne déclenche aucune recherche, et sans choix dans la liste la création est refusée", async ({ page }, testInfo) => {
  const queries = [];
  await mockGeo(page, queries);
  await openNewSector(page);
  await page.locator('#nsName').fill(`S ${uid(testInfo)}`);
  await page.locator('#nsRegion').fill('s');
  await page.waitForTimeout(400);
  expect(queries).toEqual([]);
  await page.locator('#nsRegion').fill('st antonin');
  await page.locator('[data-sect-create]').click();
  await expect(page.locator('#sErr')).toHaveText('Choisissez une commune dans la liste.');
  await expect(page.locator('#sheetBg')).toBeVisible();
});

test('après le choix, les secteurs déjà référencés dans la commune sont listés et mènent au secteur', async ({ page }, testInfo) => {
  const id = uid(testInfo);
  await seed('secteurs', id, { name: `Anglars ${id}`, region: 'Saint-Antonin-Noble-Val (82)', commune: { nom: 'Saint-Antonin-Noble-Val', code: '82155', departement: '82', simple: 'saint antonin noble val', verifie: true }, createdAt: 1 });
  await mockGeo(page);
  await openNewSector(page);
  await page.locator('#nsRegion').fill('st antonin');
  await page.locator('[data-commune="0"]').click();
  await expect(page.locator('#nsKnown')).toContainText('Déjà référencés à Saint-Antonin-Noble-Val');
  await page.locator(`#nsKnown [data-sect="${id}"]`).click();
  await expect(page.locator('#sheetBg')).toBeHidden();
  await expect(page.locator('#gymName')).toContainText(`Anglars ${id}`);
});

test('service indisponible : la saisie libre passe, marquée « commune non vérifiée »', async ({ page }, testInfo) => {
  const name = `S ${uid(testInfo)}`;
  await page.route('**/geo.api.gouv.fr/**', r => r.abort());
  await openNewSector(page);
  await page.locator('#nsName').fill(name);
  await page.locator('#nsRegion').fill('Saint Machin');
  await page.locator('[data-sect-create]').click();
  await expect(page.locator('#sheetBg')).toBeHidden();
  expect((await stored(page, name)).commune).toEqual({ nom: 'Saint Machin', simple: 'saint machin', verifie: false });
  await page.locator('#gymName').click();
  await expect(page.locator('#sheet')).toContainText('commune non vérifiée');
});

test("un secteur sans commune reste valide, et l'admin lui rattache une commune", async ({ page }, testInfo) => {
  const id = uid(testInfo);
  await seed('secteurs', id, { name: `Ancien ${id}`, region: '', createdAt: 1 });
  await mockGeo(page);
  await page.addInitScript(s => { localStorage.setItem('pan-mode', 'out'); localStorage.setItem('pan-sect', s); }, id);
  await page.goto('/');
  await expect(page.locator('#gymName')).toContainText(`Ancien ${id}`);
  await login(page, ADMIN);
  await page.locator('#gymName').click();
  await page.locator(`[data-edit="secteurs:${id}"]`).click();
  await page.locator('#e_region').fill('st antonin');
  await page.locator('#eCommuneBox [data-commune="0"]').click();
  await page.locator('#eForm button[type=submit]').click();
  await expect(page.locator('#eForm')).toBeHidden();
  const s = await page.evaluate(i => BT.fs.collection('secteurs').doc(i).get().then(d => d.data()), id);
  expect(s.region).toBe('Saint-Antonin-Noble-Val (82)');
  expect(s.commune.code).toBe('82155');
});
