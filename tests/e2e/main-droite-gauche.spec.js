// Main droite / gauche : chaque move de main porte D ou G, alternance automatique à la pose (D, G, D, G…), modifiable par appui long.
const { test, expect } = require('./fixtures');
const { ALICE, login, seed } = require('./helpers');

const uid = testInfo => `${testInfo.project.name}-${Date.now()}`;
const START = { t: 'start', x: 0.3, y: 0.9 };
const spot = (page, nx, ny) => page.evaluate(([nx, ny]) => { const v = editView, r = v.el.getBoundingClientRect(); return { x: r.left + v.ox + nx * v.s * v.bw, y: r.top + v.oy + ny * v.s * v.bh }; }, [nx, ny]);
const holdXY = (page, i) => page.evaluate(i => { const v = editView, r = v.el.getBoundingClientRect(), h = state.holds[i]; return { x: r.left + v.ox + h.x * v.s * v.bw, y: r.top + v.oy + h.y * v.s * v.bh }; }, i);
const press = async (page, p) => { await page.mouse.move(p.x, p.y); await page.mouse.down(); await page.waitForTimeout(650); await page.mouse.up(); };
const sides = page => page.evaluate(() => state.holds.filter(h => h.t === 'hand').map(h => h.side ?? null));
const tags = page => page.evaluate(() => [...document.querySelectorAll('#editWall svg rect + text')].map(t => t.textContent));

async function openEditor(page, id, holds = [START]) {
  await seed('gyms', id, { name: `Salle ${id}`, city: 'Albi', createdAt: 1 });
  await seed('walls', `w-${id}`, { gymId: id, name: 'Spray', image: '', w: 100, h: 100, active: true, createdAt: 1 });
  await page.goto(`/#/salle/${id}`);
  await login(page, ALICE);
  await page.locator('#tabCreate').click();
  await page.evaluate(h => { state.holds = h.map(x => ({ ...x })); state.tool = 'hand'; renderEditor(); }, holds);
}

test('les mains posées alternent droite, gauche, droite, gauche, avec une pastille D / G', async ({ page }, testInfo) => {
  await openEditor(page, uid(testInfo));
  for (const [x, y] of [[0.35, 0.75], [0.55, 0.62], [0.4, 0.48], [0.6, 0.34]]) { const p = await spot(page, x, y); await page.mouse.click(p.x, p.y); await page.waitForTimeout(350); }
  expect(await sides(page)).toEqual(['R', 'L', 'R', 'L']);
  expect(await tags(page)).toEqual(['D', 'G', 'D', 'G']);
  // Un pied ne porte pas de main.
  await page.locator('#vCreate [data-t="foot"]').click();
  const p = await spot(page, 0.7, 0.8); await page.mouse.click(p.x, p.y);
  expect(await page.evaluate(() => state.holds.at(-1))).toMatchObject({ t: 'foot' });
  expect(await page.evaluate(() => 'side' in state.holds.at(-1))).toBe(false);
});

test('appui long : passer une main de droite à gauche, puis « Alterner la suite »', async ({ page }, testInfo) => {
  const holds = [START, ...[0.75, 0.62, 0.48, 0.34].map((y, i) => ({ t: 'hand', x: 0.35 + 0.07 * i, y, side: 'R' }))];
  await openEditor(page, uid(testInfo), holds);
  await press(page, await holdXY(page, 2)); // main 2
  await expect(page.locator('[data-hm="side"]')).toHaveText('Passer en main gauche');
  await page.locator('[data-hm="side"]').click();
  expect(await sides(page)).toEqual(['R', 'L', 'R', 'R']);
  await press(page, await holdXY(page, 1)); // main 1 : alterner tout ce qui suit
  await page.locator('[data-hm="alt"]').click();
  expect(await sides(page)).toEqual(['R', 'L', 'R', 'L']);
  await press(page, await holdXY(page, 2));
  await expect(page.locator('[data-hm="side"]')).toHaveText('Passer en main droite');
});

test('un move inséré après une main prend la main opposée, et un pied passé en main reçoit une main', async ({ page }, testInfo) => {
  const holds = [START, { t: 'hand', x: 0.4, y: 0.7, side: 'R' }, { t: 'foot', x: 0.5, y: 0.8 }, { t: 'hand', x: 0.5, y: 0.5, side: 'L' }];
  await openEditor(page, uid(testInfo), holds);
  await press(page, await holdXY(page, 1));
  await page.locator('[data-hm="after:hand"]').click();
  const p = await spot(page, 0.7, 0.62); await page.mouse.click(p.x, p.y);
  // Mains dans l'ordre : la première (D), la nouvelle insérée juste après (opposée : G), puis l'ancienne seconde main (G, inchangée).
  expect(await sides(page)).toEqual(['R', 'L', 'L']);
  // Le pied devient une main : opposée de la main qui précède.
  const iFoot = await page.evaluate(() => state.holds.findIndex(h => h.t === 'foot'));
  await press(page, await holdXY(page, iFoot));
  await page.locator('[data-hm="swap"]').click();
  expect(await page.evaluate(i => state.holds[i].side, iFoot)).toBe('R');
});

test('replay : la légende indique main droite ou gauche ; un ancien bloc sans marquage reste inchangé', async ({ page }, testInfo) => {
  const id = uid(testInfo);
  await seed('gyms', id, { name: `Salle ${id}`, city: 'Albi', createdAt: 1 });
  await seed('walls', `w-${id}`, { gymId: id, name: 'Spray', image: '', w: 100, h: 100, active: true, createdAt: 1 });
  const base = { gymId: id, wallId: `w-${id}`, grade: '6a', setter: 'Paul', authorId: 'autre', createdAt: 1 };
  await seed('blocs', `n-${id}`, { ...base, name: `Nouveau ${id}`, holds: [START, { t: 'hand', x: 0.4, y: 0.7, side: 'R' }, { t: 'hand', x: 0.5, y: 0.5, side: 'L' }, { t: 'top', x: 0.5, y: 0.15 }] });
  await seed('blocs', `o-${id}`, { ...base, name: `Ancien ${id}`, holds: [START, { t: 'hand', x: 0.4, y: 0.7 }, { t: 'hand', x: 0.5, y: 0.5 }, { t: 'top', x: 0.5, y: 0.15 }] });
  await page.goto(`/#/bloc/n-${id}`);
  await expect(page.locator('#dWall svg rect + text')).toHaveText(['D', 'G']);
  await page.locator('#dReplay').click();
  const cap = page.locator('#rpCap');
  await page.locator('#rpNext').click(); await expect(cap).toContainText('Main droite · Move 1 / 2');
  await page.locator('#rpNext').click(); await expect(cap).toContainText('Main gauche · Move 2 / 2');
  await page.locator('#fsClose').click();
  await page.goto('about:blank'); await page.goto(`/#/bloc/o-${id}`);
  await expect(page.locator('#dWall svg')).toBeVisible();
  await expect(page.locator('#dWall svg rect + text')).toHaveCount(0);
  await page.locator('#dReplay').click();
  await page.locator('#rpNext').click(); await expect(page.locator('#rpCap')).toContainText('Move 1 / 2');
  await expect(page.locator('#rpCap')).not.toContainText('Main');
});

test('méthode de voie : les mains alternent D / G, les pieds sont sans côté, la légende du replay le dit', async ({ page }, testInfo) => {
  const id = uid(testInfo);
  await seed('secteurs', id, { name: `Secteur ${id}`, region: '', createdAt: 1 });
  await seed('voies', `v-${id}`, { secteurId: id, name: `Voie ${id}`, grade: '6a', w: 100, h: 100, image: '', anchors: [], authorId: 'autre', addedBy: 'Paul', methodCount: 0, createdAt: 1 });
  await page.goto(`/#/secteur/${id}`);
  await login(page, ALICE);
  await page.locator('.name', { hasText: `Voie ${id}` }).click();
  await page.locator('[data-act="newm"]').click();
  // Position recalculée à chaque tap : un clic sur un outil peut faire défiler la page.
  const tap = async (fx, fy) => { const box = await page.locator('#oeWall').boundingBox(); await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy); await page.waitForTimeout(400); };
  await tap(0.4, 0.8); await tap(0.55, 0.65);
  await page.locator('#oeTools [data-ot="foot"], [data-otools] [data-ot="foot"]').first().click();
  await tap(0.45, 0.9);
  await page.locator('[data-otools] [data-ot="hand"]').first().click();
  await tap(0.6, 0.5);
  expect(await page.evaluate(() => state.oe.steps.map(s => `${s.t}:${s.side ?? '-'}`))).toEqual(['hand:R', 'hand:L', 'foot:-', 'hand:R']);
  await expect(page.locator('#oeWall svg rect + text')).toHaveText(['D', 'G', 'D']);
});
