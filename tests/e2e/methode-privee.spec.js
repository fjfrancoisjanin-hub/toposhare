// Ticket 3 : méthode privée en falaise.
const { test, expect } = require('./fixtures');
const { ADMIN, ALICE, BOB, login, seed } = require('./helpers');

const uid = testInfo => `${testInfo.project.name}-${Date.now()}`;

async function seedVoie(id, authorId = 'autre-grimpeur') {
  await seed('secteurs', id, { name: `Secteur ${id}`, region: '', createdAt: 1 });
  await seed('voies', `v-${id}`, { secteurId: id, name: `Voie ${id}`, grade: '6a', w: 100, h: 100, anchors: [], authorId, addedBy: 'Paul', methodCount: 0, createdAt: 1 });
}
async function open(page, id) {
  await page.goto(`/#/secteur/${id}`);
}
async function addMethod(page, { pub = false } = {}) {
  await page.locator('[data-act="newm"]').click();
  await expect(page.locator('#oVisPrivate')).toBeChecked();
  if (pub) await page.locator('#oVisPublic').check();
  const box = await page.locator('#oeWall').boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.locator('#oSave').click();
  await expect(page.locator('[data-act="editm"]')).toBeVisible();
}

test('une méthode privée se répète, reste invisible pour un autre compte, puis devient visible une fois publiée', async ({ page, browser }, testInfo) => {
  const id = uid(testInfo);
  await seedVoie(id);
  await open(page, id);
  await login(page, ALICE);
  await page.locator('.name', { hasText: `Voie ${id}` }).click();
  await addMethod(page);
  await expect(page.locator('#ovMethods')).toContainText('Privée');
  await page.locator('[data-act="replay"]').click();
  await expect(page.locator('#rpNext')).toBeVisible();
  await page.locator('#fsClose').click();

  const ctx = await browser.newContext(testInfo.project.use), bob = await ctx.newPage();
  await open(bob, id);
  await login(bob, BOB);
  await bob.locator('.name', { hasText: `Voie ${id}` }).click();
  await expect(bob.locator('#ovSeq')).toContainText('aucune méthode partagée');
  await expect(bob.locator('#ovMethods')).not.toContainText('Méthode de');

  // Publication : la méthode apparaît chez l'autre compte, sans rechargement, et le compteur passe à 1.
  await page.locator('[data-act="editm"]').click();
  await expect(page.locator('#oVisPrivate')).toBeChecked();
  await page.locator('#oVisPublic').check();
  await page.locator('#oSave').click();
  await expect(bob.locator('#ovMethods')).toContainText('Méthode de Alice');
  await expect(page.locator('#ovMethods')).not.toContainText('Privée');

  // Retour en privé : elle disparaît de l'écran de l'autre compte, sans erreur.
  await page.locator('[data-act="editm"]').click();
  await page.locator('#oVisPrivate').check();
  await page.locator('#oSave').click();
  await expect(page.locator('#ovMethods')).toContainText('Privée');
  await expect(bob.locator('#ovMethods')).not.toContainText('Méthode de');
  await ctx.close();
});

test('une méthode privée ne compte pas dans le nombre de méthodes', async ({ page }, testInfo) => {
  const id = uid(testInfo);
  await seedVoie(id);
  await open(page, id);
  await login(page, ALICE);
  await page.locator('.name', { hasText: `Voie ${id}` }).click();
  await addMethod(page);
  await page.locator('#tabPlace').click();
  await expect(page.locator('.name', { hasText: `Voie ${id}` })).toBeVisible();
  await expect(page.locator('.by', { hasText: 'méthode' })).toHaveCount(0);
});

test("l'admin ne voit pas la méthode privée d'un autre sur la fiche", async ({ page, browser }, testInfo) => {
  const id = uid(testInfo);
  await seedVoie(id);
  await open(page, id);
  await login(page, ALICE);
  await page.locator('.name', { hasText: `Voie ${id}` }).click();
  await addMethod(page);

  const ctx = await browser.newContext(testInfo.project.use), admin = await ctx.newPage();
  await open(admin, id);
  await login(admin, ADMIN);
  await admin.locator('.name', { hasText: `Voie ${id}` }).click();
  await expect(admin.locator('#ovName')).toBeVisible();
  await expect(admin.locator('#ovMethods')).not.toContainText('Méthode de');

  // Il peut quand même supprimer la voie, avec ce qui en dépend.
  await admin.locator('[data-act="delv"]').click();
  await admin.locator('[data-act="delv"]').click();
  await expect(admin.locator('.name', { hasText: `Voie ${id}` })).toHaveCount(0);
  await ctx.close();
});

test("l'auteur supprime sa voie sans contributeur, mais plus dès qu'un autre y a une méthode", async ({ page, browser }, testInfo) => {
  const id = uid(testInfo);
  await seed('secteurs', id, { name: `Secteur ${id}`, region: '', createdAt: 1 });
  await open(page, id);
  await login(page, ALICE);
  const me = await page.evaluate(() => BT.user().uid);
  await seed('voies', `v-${id}`, { secteurId: id, name: `Voie ${id}`, grade: '6a', w: 100, h: 100, anchors: [], authorId: me, addedBy: 'Alice', methodCount: 0, createdAt: 1 });
  await seed('voies', `w-${id}`, { secteurId: id, name: `Seconde ${id}`, grade: '6a', w: 100, h: 100, anchors: [], authorId: me, addedBy: 'Alice', methodCount: 0, createdAt: 1 });

  const ctx = await browser.newContext(testInfo.project.use), bob = await ctx.newPage();
  await open(bob, id);
  await login(bob, BOB);
  await bob.locator('.name', { hasText: `Voie ${id}` }).click();
  await addMethod(bob);

  await page.locator('.name', { hasText: `Voie ${id}` }).click();
  await expect(page.locator('#ovName')).toBeVisible();
  await expect(page.locator('[data-act="delv"]')).toHaveCount(0);

  await page.locator('#tabPlace').click();
  await page.locator('.name', { hasText: `Seconde ${id}` }).click();
  await page.locator('[data-act="delv"]').click();
  await page.locator('[data-act="delv"]').click();
  await expect(page.locator('.name', { hasText: `Seconde ${id}` })).toHaveCount(0);
  await ctx.close();
});
