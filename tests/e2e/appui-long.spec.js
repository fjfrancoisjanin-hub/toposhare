// Édition au doigt : appui long sur une prise (ajouter avant / après, déplacer, changer, repos, point de travail, supprimer),
// même prise plusieurs fois, bouton d'aide « ? ».
const { test, expect } = require('./fixtures');
const { ALICE, login, seed } = require('./helpers');

const uid = testInfo => `${testInfo.project.name}-${Date.now()}`;
const HOLDS = [{ t: 'start', x: 0.3, y: 0.85 }, { t: 'hand', x: 0.4, y: 0.6 }, { t: 'hand', x: 0.6, y: 0.4 }, { t: 'top', x: 0.5, y: 0.15 }];

async function seedSalle(id) {
  await seed('gyms', id, { name: `Salle ${id}`, city: 'Albi', createdAt: 1 });
  await seed('walls', `w-${id}`, { gymId: id, name: 'Spray', image: '', w: 100, h: 100, active: true, createdAt: 1 });
}
async function openEditor(page, id, holds = HOLDS) {
  await seedSalle(id);
  await page.goto(`/#/salle/${id}`);
  await login(page, ALICE);
  await page.locator('#tabCreate').click();
  await page.evaluate(h => { state.holds = h.map(x => ({ ...x })); state.tool = 'hand'; renderEditor(); }, holds);
}
// Position écran d'une prise du bloc (éditeur en ligne).
const holdXY = (page, i) => page.evaluate(i => { const v = editView, r = v.el.getBoundingClientRect(), h = state.holds[i]; return { x: r.left + v.ox + h.x * v.s * v.bw, y: r.top + v.oy + h.y * v.s * v.bh }; }, i);
const pressAt = async (page, p, ms = 650) => { await page.mouse.move(p.x, p.y); await page.mouse.down(); await page.waitForTimeout(ms); await page.mouse.up(); };
const spot = (page, nx, ny) => page.evaluate(([nx, ny]) => { const v = editView, r = v.el.getBoundingClientRect(); return { x: r.left + v.ox + nx * v.s * v.bw, y: r.top + v.oy + ny * v.s * v.bh }; }, [nx, ny]);

test('un tap sur une prise déjà posée la reprend : la même prise revient plusieurs fois', async ({ page }, testInfo) => {
  await openEditor(page, uid(testInfo));
  const p = await holdXY(page, 1);
  await page.mouse.click(p.x, p.y);
  const holds = await page.evaluate(() => state.holds);
  expect(holds).toHaveLength(5);
  expect(holds[4]).toMatchObject({ t: 'hand', x: 0.4, y: 0.6 });
  expect(await page.evaluate(() => state.holds.filter(h => h.t === 'hand').length)).toBe(3);
});

test('appui long : le menu s\'ouvre, « Ajouter après » en pied place la prise au bon rang', async ({ page }, testInfo) => {
  await openEditor(page, uid(testInfo));
  await pressAt(page, await holdXY(page, 1));
  await expect(page.locator('#holdMenu')).toBeVisible();
  await expect(page.locator('#holdMenu .hm-h')).toContainText('Move 1');
  await page.locator('[data-hm="after:foot"]').click();
  await expect(page.locator('#holdMenu')).toBeHidden();
  expect(await page.evaluate(() => [state.insertAt, state.tool])).toEqual([2, 'foot']);
  const n = await spot(page, 0.2, 0.5);
  await page.mouse.click(n.x, n.y);
  const holds = await page.evaluate(() => state.holds.map(h => h.t));
  expect(holds).toEqual(['start', 'hand', 'foot', 'hand', 'top']);
});

test('appui long : « Ajouter avant » en main décale les moves suivants', async ({ page }, testInfo) => {
  await openEditor(page, uid(testInfo));
  await pressAt(page, await holdXY(page, 2));
  await page.locator('[data-hm="before:hand"]').click();
  const n = await spot(page, 0.7, 0.7);
  await page.mouse.click(n.x, n.y);
  const holds = await page.evaluate(() => state.holds);
  expect(holds.map(h => h.t)).toEqual(['start', 'hand', 'hand', 'hand', 'top']);
  expect(holds[2]).toMatchObject({ x: 0.7, y: 0.7 });
  expect(holds[3]).toMatchObject({ x: 0.6, y: 0.4 });
});

test('appui long : déplacer, changer en pied, supprimer', async ({ page }, testInfo) => {
  await openEditor(page, uid(testInfo));
  await pressAt(page, await holdXY(page, 1));
  await page.locator('[data-hm="move"]').click();
  const to = await spot(page, 0.75, 0.55);
  await page.mouse.click(to.x, to.y);
  expect(await page.evaluate(() => state.holds[1])).toMatchObject({ t: 'hand', x: 0.75, y: 0.55 });
  expect(await page.evaluate(() => state.holds)).toHaveLength(4);

  await pressAt(page, await holdXY(page, 1));
  await page.locator('[data-hm="swap"]').click();
  expect(await page.evaluate(() => state.holds[1].t)).toBe('foot');

  await pressAt(page, await holdXY(page, 2));
  await page.locator('[data-hm="del"]').click();
  expect(await page.evaluate(() => state.holds.map(h => h.t))).toEqual(['start', 'foot', 'top']);
});

test("un appui court n'ouvre pas le menu, et un appui long dans le vide non plus", async ({ page }, testInfo) => {
  await openEditor(page, uid(testInfo));
  await pressAt(page, await holdXY(page, 1), 120);
  await expect(page.locator('#holdMenu')).toBeHidden();
  const vide = await spot(page, 0.9, 0.9);
  await pressAt(page, vide, 650);
  await expect(page.locator('#holdMenu')).toBeHidden();
});

test('la même prise posée deux fois : le menu propose de choisir le move concerné', async ({ page }, testInfo) => {
  const holds = [...HOLDS.slice(0, 2), { t: 'hand', x: 0.4, y: 0.6 }, HOLDS[3]];
  await openEditor(page, uid(testInfo), holds);
  await pressAt(page, await holdXY(page, 1));
  await expect(page.locator('#holdMenu .hm-occ')).toHaveText(['Move 1', 'Move 2']);
  await expect(page.locator('#holdMenu .hm-occ[aria-pressed="true"]')).toHaveText('Move 2');
  await page.locator('#holdMenu .hm-occ').first().click();
  await page.locator('[data-hm="del"]').click();
  expect(await page.evaluate(() => state.holds.map(h => h.t))).toEqual(['start', 'hand', 'top']);
});

test('les deux badges d\'une prise répétée sont côte à côte, sans se recouvrir', async ({ page }, testInfo) => {
  await openEditor(page, uid(testInfo), [...HOLDS.slice(0, 2), { t: 'hand', x: 0.4, y: 0.6 }, HOLDS[3]]);
  const xs = await page.evaluate(() => [...document.querySelectorAll('#editWall svg text')].filter(t => ['1', '2'].includes(t.textContent)).map(t => +t.getAttribute('x')));
  expect(xs).toHaveLength(2);
  expect(Math.abs(xs[0] - xs[1])).toBeGreaterThan(1);
});

// ----- Falaise : repos sur une prise de la méthode, point de travail sur un point d'ancrage -----
async function seedVoie(id, authorId) {
  await seed('secteurs', id, { name: `Secteur ${id}`, region: '', createdAt: 1 });
  await seed('voies', `v-${id}`, { secteurId: id, name: `Voie ${id}`, grade: '6a', w: 100, h: 100, image: '', anchors: [{ x: 0.5, y: 0.8, t: 'bolt' }, { x: 0.5, y: 0.5, t: 'bolt' }, { x: 0.5, y: 0.2, t: 'relais' }], authorId, addedBy: 'Alice', methodCount: 0, createdAt: 1 });
}
const oXY = (page, nx, ny) => page.evaluate(([nx, ny]) => { const v = oView, r = v.el.getBoundingClientRect(); return { x: r.left + v.ox + nx * v.s * v.bw, y: r.top + v.oy + ny * v.s * v.bh }; }, [nx, ny]);

test('méthode : appui long sur une prise, « Repos ici » la marque et le rendu affiche le repos', async ({ page }, testInfo) => {
  const id = uid(testInfo);
  await seedVoie(id, 'autre');
  await page.goto(`/#/secteur/${id}`);
  await login(page, ALICE);
  await page.locator('.name', { hasText: `Voie ${id}` }).click();
  await page.locator('[data-act="newm"]').click();
  await page.evaluate(() => { state.oe.steps = [{ x: 0.4, y: 0.7, t: 'hand' }, { x: 0.6, y: 0.5, t: 'foot' }, { x: 0.45, y: 0.3, t: 'hand' }]; renderOE(); });
  await expect(page.locator('#oeWall svg')).not.toContainText('zZ');
  await pressAt(page, await oXY(page, 0.6, 0.5));
  await expect(page.locator('#holdMenu')).toBeVisible();
  await page.locator('[data-hm="rest"]').click();
  expect(await page.evaluate(() => state.oe.steps[1].rest)).toBe(true);
  await expect(page.locator('#oeWall svg')).toContainText('zZ');
  // La même prise reprise par un tap, puis « Ajouter après » en main.
  await pressAt(page, await oXY(page, 0.4, 0.7));
  await page.locator('[data-hm="after:hand"]').click();
  const n = await oXY(page, 0.2, 0.4);
  await page.mouse.click(n.x, n.y);
  expect(await page.evaluate(() => state.oe.steps.map(s => s.t))).toEqual(['hand', 'hand', 'foot', 'hand']);
  const pill = await page.evaluate(() => state.oe.steps.findIndex(s => s.rest));
  expect(pill).toBe(2);
});

test("voie : appui long sur un point d'ancrage, « point de travail » change son aspect ; un tap n'efface plus le point", async ({ page: first, browser }, testInfo) => {
  const id = uid(testInfo);
  await first.goto('/');
  await login(first, ALICE);
  const me = await first.evaluate(() => BT.user().uid);
  await seedVoie(id, me);
  // Contexte neuf : sans cache Firestore, le secteur créé à l'instant est connu dès le lancement.
  const ctx = await browser.newContext(testInfo.project.use), page = await ctx.newPage();
  await page.goto(`/#/secteur/${id}`);
  await login(page, ALICE);
  await page.locator('.name', { hasText: `Voie ${id}` }).click();
  await page.locator('[data-act="editr"]').click();
  const p = await oXY(page, 0.5, 0.5);
  await page.mouse.click(p.x, p.y);
  expect(await page.evaluate(() => state.oe.anchors)).toHaveLength(3);
  await expect(page.locator('#toast')).toContainText('Appui long');
  await pressAt(page, p);
  await expect(page.locator('#holdMenu .hm-h')).toContainText('Point 2');
  await page.locator('[data-hm="work"]').click();
  expect(await page.evaluate(() => state.oe.anchors[1].work)).toBe(true);
  await expect(page.locator('#oeWall svg rect[fill="#FFB020"]')).toHaveCount(1);
  await pressAt(page, p);
  await page.locator('[data-hm="del"]').click();
  expect(await page.evaluate(() => state.oe.anchors.map(a => a.t))).toEqual(['bolt', 'relais']);
});
