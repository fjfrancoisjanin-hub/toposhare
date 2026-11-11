// Relance : un move de main fait avec la même main que le move de main précédent (hors alternance droite / gauche). Petit « R » sur la prise,
// visible dans l'éditeur, sur la fiche, dans le replay (blocs et méthodes de voie), modifiable par appui long.
const { test, expect } = require('./fixtures');
const { ALICE, login, seed } = require('./helpers');

const uid = testInfo => `${testInfo.project.name}-${Date.now()}`;
const START = { t: 'start', x: 0.3, y: 0.9 };
const HANDS = [0.75, 0.62, 0.48, 0.34].map((y, i) => ({ t: 'hand', x: 0.35 + 0.07 * i, y }));
const spot = (page, nx, ny) => page.evaluate(([nx, ny]) => { const v = editView, r = v.el.getBoundingClientRect(); return { x: r.left + v.ox + nx * v.s * v.bw, y: r.top + v.oy + ny * v.s * v.bh }; }, [nx, ny]);
const holdXY = (page, i) => page.evaluate(i => { const v = editView, r = v.el.getBoundingClientRect(), h = state.holds[i]; return { x: r.left + v.ox + h.x * v.s * v.bw, y: r.top + v.oy + h.y * v.s * v.bh }; }, i);
const press = async (page, p) => { await page.mouse.move(p.x, p.y); await page.mouse.down(); await page.waitForTimeout(650); await page.mouse.up(); };
const rTags = (page, root) => page.locator(`${root} svg rect + text`);

async function openEditor(page, id, holds = [START, ...HANDS]) {
  await seed('gyms', id, { name: `Salle ${id}`, city: 'Albi', createdAt: 1 });
  await seed('walls', `w-${id}`, { gymId: id, name: 'Spray', image: '', w: 100, h: 100, active: true, createdAt: 1 });
  await page.goto(`/#/salle/${id}`);
  await login(page, ALICE);
  await page.locator('#tabCreate').click();
  await page.evaluate(h => { state.holds = h.map(x => ({ ...x })); state.tool = 'hand'; renderEditor(); }, holds);
}

test('par défaut aucune relance : les mains posées n\'ont aucun marquage', async ({ page }, testInfo) => {
  await openEditor(page, uid(testInfo), [START]);
  for (const [x, y] of [[0.35, 0.75], [0.55, 0.62], [0.4, 0.48]]) { const p = await spot(page, x, y); await page.mouse.click(p.x, p.y); await page.waitForTimeout(350); }
  expect(await page.evaluate(() => state.holds.filter(h => h.t === 'hand').length)).toBe(3);
  expect(await page.evaluate(() => state.holds.some(h => 'relance' in h || 'side' in h))).toBe(false);
  await expect(rTags(page, '#editWall')).toHaveCount(0);
});

test('appui long sur une main : marquer une relance affiche un R, la retirer l\'enlève', async ({ page }, testInfo) => {
  await openEditor(page, uid(testInfo));
  await press(page, await holdXY(page, 3)); // main 3
  await expect(page.locator('[data-hm="relance"]')).toHaveText('Marquer une relance (même main)');
  await page.locator('[data-hm="relance"]').click();
  expect(await page.evaluate(() => state.holds[3].relance)).toBe(true);
  await expect(rTags(page, '#editWall')).toHaveText(['R']);
  await press(page, await holdXY(page, 3));
  await expect(page.locator('[data-hm="relance"]')).toHaveText('Retirer la relance');
  await page.locator('[data-hm="relance"]').click();
  expect(await page.evaluate(() => 'relance' in state.holds[3])).toBe(false);
  await expect(rTags(page, '#editWall')).toHaveCount(0);
});

test('pas de relance possible sur la première main ni sur un pied ; passer une main en pied retire sa relance', async ({ page }, testInfo) => {
  const holds = [START, { ...HANDS[0] }, { ...HANDS[1], relance: true }, { t: 'foot', x: 0.6, y: 0.85 }];
  await openEditor(page, uid(testInfo), holds);
  await press(page, await holdXY(page, 1)); // première main
  await expect(page.locator('#holdMenu')).toBeVisible();
  await expect(page.locator('[data-hm="relance"]')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await press(page, await holdXY(page, 3)); // pied
  await expect(page.locator('#holdMenu')).toBeVisible();
  await expect(page.locator('[data-hm="relance"]')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await press(page, await holdXY(page, 2)); // main avec relance → pied
  await page.locator('[data-hm="swap"]').click();
  expect(await page.evaluate(() => [state.holds[2].t, 'relance' in state.holds[2]])).toEqual(['foot', false]);
});

test('fiche et replay : le R est visible, et la légende du replay indique la relance', async ({ page }, testInfo) => {
  const id = uid(testInfo);
  await seed('gyms', id, { name: `Salle ${id}`, city: 'Albi', createdAt: 1 });
  await seed('walls', `w-${id}`, { gymId: id, name: 'Spray', image: '', w: 100, h: 100, active: true, createdAt: 1 });
  await seed('blocs', `r-${id}`, { gymId: id, wallId: `w-${id}`, name: `Relance ${id}`, grade: '6a', setter: 'Paul', authorId: 'autre', createdAt: 1,
    holds: [START, { ...HANDS[0] }, { ...HANDS[1], relance: true }, { ...HANDS[2] }, { t: 'top', x: 0.5, y: 0.15 }] });
  await page.goto(`/#/bloc/r-${id}`);
  await expect(rTags(page, '#dWall')).toHaveText(['R']);
  await page.locator('#dReplay').click();
  const cap = page.locator('#rpCap');
  // La fenêtre de 5 prises montre déjà les moves à venir : le R de la main 2 est visible dès le début, la légende n'en parle qu'à son tour.
  await expect(rTags(page, '#fsWall')).toHaveText(['R']);
  await page.locator('#rpNext').click(); await expect(cap).not.toContainText('Relance');
  await page.locator('#rpNext').click(); await expect(cap).toContainText('Move 2 / 3 · Relance (même main)');
  await expect(rTags(page, '#fsWall')).toHaveText(['R']);
  await page.locator('#rpNext').click(); await expect(cap).not.toContainText('Relance');
  await expect(rTags(page, '#fsWall')).toHaveText(['R']); // toujours affichée, estompée, tant que la main 2 reste dans la fenêtre
});

test('méthode de voie : relance visible dans le replay, et modifiable sur une méthode existante par appui long', async ({ page: first, browser }, testInfo) => {
  const id = uid(testInfo);
  await first.goto('/');
  await login(first, ALICE);
  const me = await first.evaluate(() => BT.user().uid);
  await seed('secteurs', id, { name: `Secteur ${id}`, region: '', createdAt: 1 });
  await seed('voies', `v-${id}`, { secteurId: id, name: `Voie ${id}`, grade: '6a', w: 100, h: 100, image: '', anchors: [], authorId: 'autre', addedBy: 'Paul', methodCount: 0, createdAt: 1 });
  await seed('methodesPrivees', `m-${id}`, { voieId: `v-${id}`, secteurId: id, authorId: me, climber: 'Alice', createdAt: 1,
    steps: [{ t: 'hand', x: 0.4, y: 0.8 }, { t: 'hand', x: 0.5, y: 0.65, relance: true }, { t: 'foot', x: 0.45, y: 0.9 }, { t: 'hand', x: 0.55, y: 0.5 }] });
  const ctx = await browser.newContext(testInfo.project.use), page = await ctx.newPage();
  await page.goto(`/#/secteur/${id}`);
  await login(page, ALICE);
  await page.locator('.name', { hasText: `Voie ${id}` }).click();
  await page.locator(`[data-sel="m-${id}"]`).click(); // sélectionne ma méthode : « Répéter la voie » apparaît
  await page.locator('[data-act="replay"]').click();
  const cap = page.locator('#rpCap');
  await expect(cap).toContainText('Main · move 1 / 4');
  await page.locator('#rpNext').click(); await expect(cap).toContainText('Main · move 2 / 4 · Relance (même main)');
  await expect(rTags(page, '#fsWall')).toHaveText(['R']);
  await page.locator('#fsClose').click();
  // Modifier ma méthode : appui long sur la main 2, retirer la relance, enregistrer.
  await page.locator('[data-act="editm"]').click();
  const xy = await page.evaluate(() => { const v = oView, r = v.el.getBoundingClientRect(), s = state.oe.steps[1]; return { x: r.left + v.ox + s.x * v.s * v.bw, y: r.top + v.oy + s.y * v.s * v.bh }; });
  await press(page, xy);
  await expect(page.locator('[data-hm="relance"]')).toHaveText('Retirer la relance');
  await page.locator('[data-hm="relance"]').click();
  expect(await page.evaluate(() => 'relance' in state.oe.steps[1])).toBe(false);
  await expect(page.locator('#oeWall svg rect + text')).toHaveCount(0);
  await press(page, xy);
  await page.locator('[data-hm="relance"]').click(); // la remet
  await expect(page.locator('#oeWall svg rect + text')).toHaveText(['R']);
  await page.locator('#oSave').click();
  await expect(page.locator('[data-act="editm"]')).toBeVisible();
  const saved = await page.evaluate(i => BT.fs.collection('methodesPrivees').doc(`m-${i}`).get().then(d => d.data().steps.map(s => !!s.relance)), id);
  expect(saved).toEqual([false, true, false, false]);
});
