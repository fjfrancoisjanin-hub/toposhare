// Ticket 6a : longueurs et vues d'une voie.
const path = require('path');
const { test, expect } = require('./fixtures');
const { ADMIN, ALICE, BOB, login, seed } = require('./helpers');

const uid = testInfo => `${testInfo.project.name}-${Date.now()}`;
const PHOTO = path.join(__dirname, '..', '..', 'public', 'wall.jpg');

async function seedVoie(id, authorId = 'autre', extra = {}) {
  await seed('secteurs', id, { name: `Secteur ${id}`, region: '', createdAt: 1 });
  await seed('voies', `v-${id}`, { secteurId: id, name: `Voie ${id}`, grade: '6a', w: 100, h: 100, image: '', anchors: [{ x: 0.5, y: 0.5, t: 'bolt' }], authorId, addedBy: 'Paul', methodCount: 0, createdAt: 1, ...extra });
}

test('une voie existante, sans longueurs, s\'affiche comme avant, avec sa méthode intacte', async ({ page }, testInfo) => {
  const id = uid(testInfo);
  await seedVoie(id, 'autre', { methodCount: 1 });
  await seed('methodes', `m-${id}`, { voieId: `v-${id}`, secteurId: id, authorId: 'autre', climber: 'Paul', steps: [{ t: 'hand', x: 0.5, y: 0.4 }], createdAt: 1 });
  await page.goto(`/#/voie/v-${id}`);
  await expect(page.locator('#ovGrade')).toHaveText('6a');
  await expect(page.locator('#ovTabs')).toBeHidden();
  await expect(page.locator('#ovSeq')).toContainText("1 point d'ancrage");
  await page.getByRole('button', { name: 'Méthode de Paul' }).click();
  await page.locator('[data-act="replay"]').click();
  await expect(page.locator('#rpCap')).toContainText('Main');
});

test("l'auteur crée L2 en 6c+, un autre ajoute une vue « L2 depuis le relais », et la liste affiche la cotation la plus dure", async ({ page, browser }, testInfo) => {
  const id = uid(testInfo);
  await seed('secteurs', id, { name: `Secteur ${id}`, region: '', createdAt: 1 });
  await page.goto(`/#/secteur/${id}`);
  await login(page, ALICE);
  const me = await page.evaluate(() => BT.user().uid);
  await seedVoie(id, me);
  await page.goto(`/#/voie/v-${id}`);

  await page.locator('[data-act="lens"]').click();
  await page.locator('[data-ladd]').click();
  await page.locator('[data-row="1"] [data-grade]').selectOption('6c+');
  await page.locator('#lgForm button[type=submit]').click();
  await expect(page.locator('#ovLens')).toContainText('L1 · 6a');
  await expect(page.locator('#ovLens')).toContainText('L2 · 6c+');
  await expect(page.locator('#ovGrade')).toHaveText('6c+');

  const ctx = await browser.newContext(testInfo.project.use), bob = await ctx.newPage();
  await bob.goto(`/#/voie/v-${id}`);
  await login(bob, BOB);
  await expect(bob.locator('[data-act="lens"]')).toHaveCount(0);
  await bob.locator('[data-act="addvue"]').click();
  await bob.locator('#oeFile').setInputFiles(PHOTO);
  await bob.locator('#oVueLabel').fill('L2 depuis le relais');
  await bob.locator('#oVueLen').selectOption({ label: 'L2 · 6c+' });
  const box = await bob.locator('#oeWall').boundingBox();
  await bob.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await bob.locator('#oSave').click();
  await expect(bob.locator('#ovLens [aria-pressed="true"]')).toContainText('L2');
  await expect(bob.locator('#ovSeq')).toContainText("1 point d'ancrage");
  await expect(bob.locator('[data-act="delvue"]')).toBeVisible();

  // En direct chez l'auteur, qui ne peut plus supprimer sa voie.
  await page.locator('#ovLens [data-len]').nth(1).click();
  await expect(page.locator('#ovWall')).toBeVisible();
  await expect(page.locator('[data-act="delv"]')).toHaveCount(0);
  await page.locator('#tabPlace').click();
  await expect(page.locator('#oListEl .card .grade')).toHaveText('6c+');

  // Le contributeur retire sa vue : la voie redevient supprimable par son auteur.
  await bob.locator('[data-act="delvue"]').click();
  await bob.locator('[data-act="delvue"]').click();
  await expect(bob.locator('#ovNoPhoto')).toBeVisible();
  await page.locator('#oListEl .card').click();
  await expect(page.locator('[data-act="delv"]')).toBeVisible();
  await ctx.close();
});

test('avec plusieurs vues : on les fait défiler, et un invité est invité à se connecter pour en ajouter', async ({ page }, testInfo) => {
  const id = uid(testInfo);
  await seedVoie(id);
  await seed('vues', `x-${id}`, { voieId: `v-${id}`, longueurId: 'l1', label: 'De côté', image: '', w: 100, h: 200, anchors: [], authorId: 'bob', order: 5, createdAt: 1 });
  await page.goto(`/#/voie/v-${id}`);
  await expect(page.locator('#ovVues [data-vue]')).toHaveText(["Vue d'ensemble", 'De côté']);
  await page.locator('#ovVues [data-vue]').nth(1).click();
  await expect(page.locator('#ovSeq')).toContainText("0 point d'ancrage");
  await page.locator('[data-act="addvue"]').click();
  await expect(page.locator('[data-login-go]')).toBeVisible();
});

test("une voie dont l'admin supprime la seule vue affiche « Pas encore de photo »", async ({ page }, testInfo) => {
  const id = uid(testInfo);
  await seedVoie(id);
  await page.goto(`/#/voie/v-${id}`);
  await login(page, ADMIN);
  await page.locator('[data-act="delvue"]').click();
  await page.locator('[data-act="delvue"]').click();
  await expect(page.locator('#ovNoPhoto')).toContainText('Pas encore de photo');
  await expect(page.locator('#ovWall')).toBeHidden();
  await expect(page.locator('[data-act-nophoto]')).toBeVisible();
});

test("l'auteur de la voie range les vues", async ({ page }, testInfo) => {
  const id = uid(testInfo);
  await seed('secteurs', id, { name: `S ${id}`, region: '', createdAt: 1 });
  await page.goto(`/#/secteur/${id}`);
  await login(page, ALICE);
  const me = await page.evaluate(() => BT.user().uid);
  await seedVoie(id, me);
  await seed('vues', `x-${id}`, { voieId: `v-${id}`, longueurId: 'l1', label: 'De côté', image: '', w: 100, h: 200, anchors: [], authorId: 'bob', order: 5, createdAt: 1 });
  await page.goto(`/#/voie/v-${id}`);
  await page.locator('#ovVues [data-vue]').nth(1).click();
  await page.locator('[data-act="vueup"]').click();
  await expect(page.locator('#ovVues [data-vue]')).toHaveText(['De côté', "Vue d'ensemble"]);
});
