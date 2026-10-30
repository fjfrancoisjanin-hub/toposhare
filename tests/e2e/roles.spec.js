// Ticket 2 : rôles, propriétaire de salle et photo du mur.
const path = require('path');
const { test, expect } = require('./fixtures');
const { ADMIN, ALICE, BOB, login, loginAdminPage, seed } = require('./helpers');

const uid = testInfo => `${testInfo.project.name}-${Date.now()}`;
const WALL_FILE = path.join(__dirname, '..', '..', 'public', 'wall.jpg');

async function seedGym(id, authorId = 'autre-grimpeur') {
  await seed('gyms', id, { name: `Salle ${id}`, city: 'Albi', createdAt: 1 });
  await seed('walls', `w-${id}`, { gymId: id, name: 'Spray wall', image: '', w: 100, h: 100, active: true, createdAt: 1 });
  await seed('blocs', `b-${id}`, { gymId: id, wallId: `w-${id}`, name: `Bloc ${id}`, grade: '6a', setter: 'Paul', holds: [], authorId, createdAt: 1 });
}
async function openGym(page, id) {
  await page.addInitScript(g => { localStorage.setItem('pan-mode', 'in'); localStorage.setItem('pan-gym', g); }, id);
  await page.goto('/');
}

test("l'admin désigne un propriétaire par e-mail : lui seul voit « Le mur a été remonté », puis le rôle est retiré", async ({ page, browser }, testInfo) => {
  const id = uid(testInfo);
  await seedGym(id);
  await loginAdminPage(page);
  await page.locator('#ownerGym').selectOption(id);
  await page.locator('#ownerEmail').fill(' Alice@Example.com ');
  await page.locator('#ownerForm button[type=submit]').click();
  await expect(page.locator('#ownerList')).toContainText('alice@example.com');

  const opts = testInfo.project.use;
  const aliceCtx = await browser.newContext(opts), alice = await aliceCtx.newPage();
  await openGym(alice, id);
  await login(alice, ALICE);
  await alice.locator('#gymName').click();
  const rewall = alice.locator('[data-sheet="rewall"]');
  await expect(rewall).toBeVisible();

  const bobCtx = await browser.newContext(opts), bob = await bobCtx.newPage();
  await openGym(bob, id);
  await login(bob, BOB);
  await bob.locator('#gymName').click();
  await expect(bob.locator('.gymrow').first()).toBeVisible();
  await expect(bob.locator('[data-sheet="rewall"]')).toHaveCount(0);

  // Retrait en direct : le bouton disparaît chez la personne concernée.
  await page.locator(`[data-owner="${id}__alice@example.com"]`).click();
  await expect(rewall).toHaveCount(0);
  await aliceCtx.close(); await bobCtx.close();
});

test('le propriétaire remonte le mur : un seul mur actif, et les blocs passent en archive', async ({ page }, testInfo) => {
  const id = uid(testInfo);
  await seedGym(id);
  await seed('gymOwners', `${id}__${ALICE.email}`, { gymId: id, email: ALICE.email });
  await openGym(page, id);
  await login(page, ALICE);
  await page.locator('#gymName').click();
  await page.locator('[data-sheet="rewall"]').click();
  await page.locator('#rwFile').setInputFiles(WALL_FILE);
  await expect(page.locator('#sheetBg')).toBeHidden();
  await page.locator('#tabList').click();
  await page.locator('#gymName').click();
  await expect(page.locator('.walllist > div')).toHaveCount(2);
  await expect(page.locator('.walllist')).toContainText('Actuel');
  await expect(page.locator('.walllist b', { hasText: 'Actuel' })).toHaveCount(1);
});

test("le propriétaire supprime le bloc d'un autre sans pouvoir le modifier", async ({ page }, testInfo) => {
  const id = uid(testInfo);
  await seedGym(id);
  await seed('gymOwners', `${id}__${ALICE.email}`, { gymId: id, email: ALICE.email });
  await openGym(page, id);
  await login(page, ALICE);
  await page.getByText(`Bloc ${id}`).click();
  await expect(page.locator('#dEdit')).toBeHidden();
  await page.locator('#dDel').click();
  await page.locator('#dDelOk').click();
  await expect(page.getByText(`Bloc ${id}`)).toHaveCount(0);
});

test('un grimpeur sans rôle ne peut ni supprimer le bloc d\'un autre, ni changer le mur', async ({ page }, testInfo) => {
  const id = uid(testInfo);
  await seedGym(id);
  await openGym(page, id);
  await login(page, BOB);
  await page.getByText(`Bloc ${id}`).click();
  await expect(page.locator('#dName')).toBeVisible();
  await expect(page.locator('#dDel')).toBeHidden();
});

test('un grimpeur connecté crée une salle avec sa photo, sans en devenir propriétaire', async ({ page }, testInfo) => {
  const id = uid(testInfo);
  await page.goto('/');
  await login(page, BOB);
  await page.locator('#gymName').click();
  await page.locator('[data-sheet="newgym"]').click();
  await page.route('**/geo.api.gouv.fr/**', r => r.abort());
  await page.locator('#ngName').fill(`N ${id}`.slice(0, 40));
  await page.locator('#ngCity').fill('Albi');
  await page.locator('#ngFile').setInputFiles(WALL_FILE);
  await expect(page.locator('#gymName')).toContainText(`N ${id}`.slice(0, 12));
  await page.locator('#gymName').click();
  await expect(page.locator('.walllist')).toContainText('Actuel');
  await expect(page.locator('[data-sheet="rewall"]')).toHaveCount(0);
});

test('un invité ouvre l\'écran de connexion à chaque action de création', async ({ page }) => {
  await page.goto('/');
  await page.locator('#tabCreate').click();
  await expect(page.locator('#sheetTitle')).toBeVisible();
  await page.locator('#sheetBg').click({ position: { x: 5, y: 5 } });
  await expect(page.locator('#sheetBg')).toBeHidden();
  await page.locator('#tabList').click();
  await page.locator('#tabCreate').click();
  await expect(page.locator('#sheetBg')).toBeVisible();
});

test("l'admin garde la main sur le mur d'une salle sans propriétaire", async ({ page }, testInfo) => {
  const id = uid(testInfo);
  await seedGym(id);
  await openGym(page, id);
  await login(page, ADMIN);
  await page.locator('#gymName').click();
  await expect(page.locator('[data-sheet="rewall"]')).toBeVisible();
});
