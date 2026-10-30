// Ticket 6b : méthodes et répétition sur plusieurs vues.
const { test, expect } = require('./fixtures');
const { ALICE, BOB, login, seed } = require('./helpers');

const uid = testInfo => `${testInfo.project.name}-${Date.now()}`;

async function seedVoie(id, extra = {}) {
  await seed('secteurs', id, { name: `Secteur ${id}`, region: '', createdAt: 1 });
  await seed('voies', `v-${id}`, { secteurId: id, name: `Voie ${id}`, grade: '6c', w: 100, h: 100, image: '', anchors: [], authorId: 'autre', addedBy: 'Paul', methodCount: 0,
    longueurs: [{ id: 'l1', name: 'L1', grade: '6a' }, { id: 'l2', name: 'L2', grade: '6c' }], longueurIds: ['l1', 'l2'], createdAt: 1, ...extra });
  await seed('vues', `x-${id}`, { voieId: `v-${id}`, longueurId: 'l2', label: 'Vue depuis le relais', image: '', w: 100, h: 100, anchors: [], authorId: 'autre', order: 5, createdAt: 1 });
}
// Viser le haut de la photo : le bas peut passer sous la barre fixe.
async function tap(page, fx = 0.5, fy = 0.2) {
  const box = await page.locator('#oeWall').boundingBox();
  await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
  await page.waitForTimeout(400); // Deux touches rapprochées compteraient pour un double tap.
}
const caption = page => page.locator('#rpCap');

test('une méthode avec des prises sur L1 puis sur L2 se répète dans le bon ordre et change de photo au bon moment', async ({ page }, testInfo) => {
  const id = uid(testInfo);
  await seedVoie(id);
  await page.goto(`/#/voie/v-${id}`);
  await login(page, ALICE);
  await page.locator('[data-act="newm"]').click();
  await expect(page.locator('#oeVues [data-oev]')).toHaveText(["L1 · Vue d'ensemble", 'L2 · Vue depuis le relais']);
  await tap(page, 0.3, 0.3);
  await expect(page.locator('#oeWork [data-ocounts]').first()).toContainText('Mains 1');
  await page.locator(`#oeVues [data-oev="x-${id}"]`).click();
  await tap(page, 0.6, 0.2);
  await expect(page.locator('#oeWork [data-ocounts]').first()).toContainText('Mains 2');
  await page.locator('#oSave').click();

  await page.locator('[data-act="replay"]').click();
  await expect(caption(page)).toContainText('move 1 / 2');
  await page.locator('#rpNext').click();
  await expect(caption(page)).toContainText('move 2 / 2');
  await expect(page.locator('#rpVue')).toHaveText('L2 · Vue depuis le relais');
  await page.locator('#rpPrev').click();
  await expect(page.locator('#rpVue')).toHaveText("L1 · Vue d'ensemble");
  await page.locator('#fsClose').click();

  // Sur la fiche, chaque vue ne montre que ses prises.
  const rings = () => page.locator('#ovWall svg text', { hasText: /^\d+$/ }).count();
  await page.locator('#ovLens [data-len="l1"]').click();
  const l1 = await rings();
  await page.locator('#ovLens [data-len="l2"]').click();
  const l2 = await rings();
  expect(l1).toBe(1);
  expect(l2).toBe(1);
});

test("l'insertion au milieu reste possible après un changement de vue, dans l'ordre global", async ({ page }, testInfo) => {
  const id = uid(testInfo);
  await seedVoie(id);
  await page.goto(`/#/voie/v-${id}`);
  await login(page, ALICE);
  await page.locator('[data-act="newm"]').click();
  await tap(page, 0.3, 0.25);
  await tap(page, 0.3, 0.1);
  await page.locator(`#oeVues [data-oev="x-${id}"]`).click();
  await tap(page, 0.7, 0.2);
  await page.locator('#oeVues [data-oev="base"]').click();
  // Retirer la seconde prise de L1 place l'insertion à cet endroit ; la suivante se pose avant la prise de L2.
  await tap(page, 0.3, 0.1);
  await tap(page, 0.5, 0.2);
  await page.locator('#oSave').click();
  await expect(page.locator('[data-act="replay"]')).toBeVisible();
  const steps = await page.evaluate(i => BT.fs.collection('methodesPrivees').where('voieId', '==', i).where('authorId', '==', BT.user().uid).get().then(s => s.docs[0].data().steps), `v-${id}`);
  expect(steps.map(s => s.viewId || 'base')).toEqual(['base', 'base', `x-${id}`]);
  expect(steps[1].x).toBeCloseTo(0.5, 1);
});

test('une méthode qui n\'a des prises que sur L2 s\'affiche et se répète directement sur L2', async ({ page }, testInfo) => {
  const id = uid(testInfo);
  await seedVoie(id, { methodCount: 1 });
  await seed('methodes', `m-${id}`, { voieId: `v-${id}`, secteurId: id, authorId: 'autre', climber: 'Paul', vueIds: [`x-${id}`], steps: [{ t: 'hand', x: 0.5, y: 0.5, viewId: `x-${id}` }], createdAt: 1 });
  await page.goto(`/#/voie/v-${id}`);
  await page.getByRole('button', { name: 'Méthode de Paul' }).click();
  await expect(page.locator('#ovLens [aria-pressed="true"]')).toContainText('L2');
  await page.locator('[data-act="replay"]').click();
  await expect(page.locator('#rpVue')).toHaveText('L2 · Vue depuis le relais');
  await expect(caption(page)).toContainText('move 1 / 1');
});

test('une vue supprimée : ses prises disparaissent, et seul l\'auteur de la méthode voit le message', async ({ page, browser }, testInfo) => {
  const id = uid(testInfo);
  await seedVoie(id, { methodCount: 1 });
  await page.goto(`/#/voie/v-${id}`);
  await login(page, ALICE);
  const me = await page.evaluate(() => BT.user().uid);
  await seed('methodes', `m-${id}`, { voieId: `v-${id}`, secteurId: id, authorId: me, climber: 'Alice', vueIds: ['disparue', 'autre-voie'],
    steps: [{ t: 'hand', x: 0.2, y: 0.9 }, { t: 'hand', x: 0.5, y: 0.5, viewId: 'disparue' }, { t: 'hand', x: 0.6, y: 0.4, viewId: 'autre-voie' }], createdAt: 1 });
  await page.getByRole('button', { name: 'Méthode de Alice' }).click();
  await expect(page.locator('#ovLost')).toHaveText('2 prises étaient sur une vue supprimée');
  await page.locator('[data-act="replay"]').click();
  await expect(caption(page)).toContainText('move 1 / 1');

  const ctx = await browser.newContext(testInfo.project.use), bob = await ctx.newPage();
  await bob.goto(`/#/voie/v-${id}`);
  await login(bob, BOB);
  await bob.getByRole('button', { name: 'Méthode de Alice' }).click();
  await expect(bob.locator('#ovLost')).toBeHidden();
  await ctx.close();
});

test("les méthodes d'avant se répètent comme avant, et l'auteur d'une vue utilisée par un autre ne peut plus la supprimer", async ({ page, browser }, testInfo) => {
  const id = uid(testInfo);
  await seedVoie(id, { methodCount: 1 });
  await seed('methodes', `old-${id}`, { voieId: `v-${id}`, secteurId: id, authorId: 'autre', climber: 'Paul', steps: [{ t: 'hand', x: 0.5, y: 0.5 }], createdAt: 1 });
  await page.goto(`/#/voie/v-${id}`);
  await login(page, ALICE);
  const alice = await page.evaluate(() => BT.user().uid);
  await seed('vues', `y-${id}`, { voieId: `v-${id}`, longueurId: 'l2', label: 'Vue Alice', image: '', w: 100, h: 100, anchors: [], authorId: alice, order: 9, createdAt: 1 });
  await page.getByRole('button', { name: 'Méthode de Paul' }).click();
  await page.locator('[data-act="replay"]').click();
  await expect(caption(page)).toContainText('move 1 / 1');
  await page.locator('#fsClose').click();
  await page.locator('#ovLens [data-len="l2"]').click();
  await page.locator(`#ovVues [data-vue="y-${id}"]`).click();
  await expect(page.locator('[data-act="delvue"]')).toBeVisible();

  const ctx = await browser.newContext(testInfo.project.use), bob = await ctx.newPage();
  await bob.goto(`/#/voie/v-${id}`);
  await login(bob, BOB);
  await bob.locator('#ovLens [data-len="l2"]').click();
  await bob.locator(`#ovVues [data-vue="y-${id}"]`).click();
  await bob.locator('[data-act="newm"]').click();
  await tap(bob);
  await bob.locator('#oSave').click();
  await expect(bob.locator('[data-act="editm"]')).toBeVisible();

  await expect(page.locator('[data-act="delvue"]')).toHaveCount(0);
  await ctx.close();
});
