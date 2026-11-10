// Replay : seules les 5 dernières prises restent affichées, la prise en cours est en orange, les précédentes estompées ; bouton « Toute la séquence ».
const { test, expect } = require('./fixtures');
const { seed } = require('./helpers');

const uid = testInfo => `${testInfo.project.name}-${Date.now()}`;
// Départ, 10 mains, top : 12 étapes.
const LONG = [{ t: 'start', x: 0.3, y: 0.92 }, ...Array.from({ length: 10 }, (_, i) => ({ t: 'hand', x: 0.2 + 0.06 * i, y: 0.85 - 0.07 * i })), { t: 'top', x: 0.5, y: 0.05 }];
const badges = (page, root = '#fsWall') => page.locator(`${root} svg text`);
const texts = async (page, root) => (await badges(page, root).allTextContents()).sort();
const next = async (page, n = 1) => { for (let i = 0; i < n; i++) await page.locator('#rpNext').click(); };

async function openBlocReplay(page, id, extra = {}) {
  await seed('gyms', id, { name: `Salle ${id}`, city: 'Albi', createdAt: 1 });
  await seed('walls', `w-${id}`, { gymId: id, name: 'Spray', image: '', w: 100, h: 100, active: true, createdAt: 1 });
  await seed('blocs', `b-${id}`, { gymId: id, wallId: `w-${id}`, name: `Long ${id}`, grade: '6b', setter: 'Paul', holds: LONG, authorId: 'autre', createdAt: 1, ...extra });
  await page.goto(`/#/bloc/b-${id}`);
  await page.locator('#dReplay').click();
}

test('bloc : 5 prises visibles autour de la prise en cours (2 avant, 2 après), la prise en cours en orange', async ({ page }, testInfo) => {
  await openBlocReplay(page, uid(testInfo));
  await expect(page.locator('#rpCap')).toContainText('Départ');
  expect(await texts(page)).toEqual(['1', '2', '3', '4', 'D']); // au début, la fenêtre reste de 5 prises
  await expect(page.locator('#fsWall svg circle[stroke="#FF6630"]')).toHaveCount(1);
  await next(page, 7); // Move 7 : on voit 5, 6, 7, 8, 9
  await expect(page.locator('#rpCap')).toContainText('Move 7 / 10');
  expect(await texts(page)).toEqual(['5', '6', '7', '8', '9']);
  await expect(page.locator('#fsWall svg circle[stroke="#FF6630"]')).toHaveCount(1);
  // Les 2 précédentes sont estompées ; la prise en cours et les 2 suivantes ne le sont pas.
  await expect(page.locator('#fsWall svg g[opacity=".4"] text')).toHaveCount(2);
  const faded = await page.evaluate(() => [...document.querySelectorAll('#fsWall svg text')].filter(t => t.closest('g[opacity]')).map(t => t.textContent).sort());
  expect(faded).toEqual(['5', '6']);
});

test('la fenêtre avance à chaque étape : la 8 devient la prise en cours, la 5 disparaît', async ({ page }, testInfo) => {
  await openBlocReplay(page, uid(testInfo));
  await next(page, 7);
  expect(await texts(page)).toEqual(['5', '6', '7', '8', '9']);
  await next(page); // Move 8 : 6 à 10
  await expect(page.locator('#rpCap')).toContainText('Move 8 / 10');
  expect(await texts(page)).toEqual(['10', '6', '7', '8', '9']);
  const faded = await page.evaluate(() => [...document.querySelectorAll('#fsWall svg text')].filter(t => t.closest('g[opacity]')).map(t => t.textContent).sort());
  expect(faded).toEqual(['6', '7']);
  await next(page, 2); // Move 10 : fenêtre bloquée sur les 5 dernières prises
  expect(await texts(page)).toEqual(['10', '7', '8', '9', 'T']);
  await next(page); // Top
  await expect(page.locator('#rpCap')).toContainText('Top');
  expect(await texts(page)).toEqual(['10', '7', '8', '9', 'T']);
  await page.locator('#rpPrev').click(); await page.locator('#rpPrev').click(); // Move 9
  await expect(page.locator('#rpCap')).toContainText('Move 9 / 10');
  expect(await texts(page)).toEqual(['10', '7', '8', '9', 'T']);
  await expect(page.locator('#fsWall svg circle[stroke="#FF6630"]')).toHaveCount(1);
});

test('« Tout depuis le début » garde toutes les prises jusqu\'ici, et le choix est gardé d\'un replay à l\'autre', async ({ page }, testInfo) => {
  await openBlocReplay(page, uid(testInfo));
  await expect(page.locator('#rpWin')).toHaveText('Fenêtre de 5 prises');
  await next(page, 7);
  await page.locator('#rpWin').click();
  await expect(page.locator('#rpWin')).toHaveText('Tout depuis le début');
  expect(await texts(page)).toEqual(['1', '2', '3', '4', '5', '6', '7', 'D']);
  await page.locator('#fsClose').click();
  await page.locator('#dReplay').click();
  await expect(page.locator('#rpWin')).toHaveText('Tout depuis le début');
  await page.locator('#rpWin').click();
  await expect(page.locator('#rpWin')).toHaveText('Fenêtre de 5 prises');
});

test('un circuit de 5 prises ou moins reste entièrement affiché', async ({ page }, testInfo) => {
  const id = uid(testInfo);
  await seed('gyms', id, { name: `Salle ${id}`, city: 'Albi', createdAt: 1 });
  await seed('walls', `w-${id}`, { gymId: id, name: 'Spray', image: '', w: 100, h: 100, active: true, createdAt: 1 });
  await seed('blocs', `c-${id}`, { gymId: id, wallId: `w-${id}`, name: `Court ${id}`, grade: '5a', setter: 'Paul', holds: [LONG[0], LONG[1], LONG[2], LONG[11]], authorId: 'autre', createdAt: 1 });
  await page.goto(`/#/bloc/c-${id}`);
  await page.locator('#dReplay').click();
  await next(page, 3); // Top
  expect(await texts(page)).toEqual(['1', '2', 'D', 'T']);
});

test('voie : même fenêtre de 5 prises sur la méthode, la prise en cours en orange', async ({ page }, testInfo) => {
  const id = uid(testInfo);
  await seed('secteurs', id, { name: `Secteur ${id}`, region: '', createdAt: 1 });
  await seed('voies', `v-${id}`, { secteurId: id, name: `Voie ${id}`, grade: '6a', w: 100, h: 100, image: '', anchors: [], authorId: 'autre', addedBy: 'Paul', methodCount: 1, createdAt: 1 });
  await seed('methodes', `m-${id}`, { voieId: `v-${id}`, secteurId: id, authorId: 'autre', climber: 'Paul', steps: LONG.slice(1, 11).map(h => ({ t: 'hand', x: h.x, y: h.y })), createdAt: 1 });
  await page.goto(`/#/voie/v-${id}`);
  await page.getByRole('button', { name: 'Méthode de Paul' }).click();
  await page.locator('[data-act="replay"]').click();
  await next(page, 7); // prise 8
  await expect(page.locator('#rpCap')).toContainText('move 8 / 10');
  expect(await texts(page)).toEqual(['10', '6', '7', '8', '9']);
  await expect(page.locator('#fsWall svg circle[stroke="#FF6630"]')).toHaveCount(1);
  await page.locator('#rpWin').click();
  expect((await texts(page)).length).toBe(8); // tout depuis le début, jusqu'à la prise en cours
});

test('pieds dans l\'ordre : la fenêtre compte les mains et les pieds', async ({ page }, testInfo) => {
  const holds = [{ t: 'start', x: 0.3, y: 0.92 }, { t: 'hand', x: 0.3, y: 0.8 }, { t: 'foot', x: 0.35, y: 0.88 }, { t: 'foot', x: 0.42, y: 0.84 }, { t: 'hand', x: 0.4, y: 0.7 }, { t: 'foot', x: 0.5, y: 0.78 }, { t: 'hand', x: 0.5, y: 0.6 }, { t: 'top', x: 0.5, y: 0.1 }];
  const id = uid(testInfo);
  await seed('gyms', id, { name: `Salle ${id}`, city: 'Albi', createdAt: 1 });
  await seed('walls', `w-${id}`, { gymId: id, name: 'Spray', image: '', w: 100, h: 100, active: true, createdAt: 1 });
  await seed('blocs', `p-${id}`, { gymId: id, wallId: `w-${id}`, name: `Mixte ${id}`, grade: '6a', setter: 'Paul', holds, seq: 'ordered', authorId: 'autre', createdAt: 1 });
  await page.goto(`/#/bloc/p-${id}`);
  await page.locator('#dReplay').click();
  await next(page, 6); // étapes : D, M1, P1, P2, M2, P3, M3, T → Move 3 (index 6)
  await expect(page.locator('#rpCap')).toContainText('Move 3 / 3');
  // Fenêtre de 5 étapes : P2, M2, P3, M3, T. La numérotation reste celle du circuit (P2 et P3, pas P1 et P2).
  expect(await texts(page)).toEqual(['2', '3', 'P2', 'P3', 'T']);
});
