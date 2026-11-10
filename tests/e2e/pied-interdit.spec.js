// Pied interdit (blocs seulement) : marqueur rouge barré sur une prise, sans effet sur les mouvements ni sur les tracés.
const { test, expect } = require('./fixtures');
const { ALICE, login, seed } = require('./helpers');

const uid = testInfo => `${testInfo.project.name}-${Date.now()}`;
const BASE = [{ t: 'start', x: 0.3, y: 0.85 }, { t: 'hand', x: 0.4, y: 0.65 }, { t: 'hand', x: 0.55, y: 0.45 }, { t: 'top', x: 0.5, y: 0.15 }];
const slash = (page, root) => page.locator(`${root} svg line[stroke="var(--h-nofoot)"]`);

async function seedSalle(id) {
  await seed('gyms', id, { name: `Salle ${id}`, city: 'Albi', createdAt: 1 });
  await seed('walls', `w-${id}`, { gymId: id, name: 'Spray', image: '', w: 100, h: 100, active: true, createdAt: 1 });
}
async function openEditor(page, id, holds = BASE) {
  await seedSalle(id);
  await page.goto(`/#/salle/${id}`);
  await login(page, ALICE);
  await page.locator('#tabCreate').click();
  await page.evaluate(h => { state.holds = h.map(x => ({ ...x })); state.tool = 'hand'; renderEditor(); }, holds);
}
const spot = (page, nx, ny) => page.evaluate(([nx, ny]) => { const v = editView, r = v.el.getBoundingClientRect(); return { x: r.left + v.ox + nx * v.s * v.bw, y: r.top + v.oy + ny * v.s * v.bh }; }, [nx, ny]);
const holdXY = (page, i) => page.evaluate(i => { const v = editView, r = v.el.getBoundingClientRect(), h = state.holds[i]; return { x: r.left + v.ox + h.x * v.s * v.bw, y: r.top + v.oy + h.y * v.s * v.bh }; }, i);

test('l\'outil « Pied interdit » pose un rond rouge barré, compté à part, sans toucher aux moves', async ({ page }, testInfo) => {
  await openEditor(page, uid(testInfo));
  await expect(page.locator('#vCreate [data-t="nofoot"]')).toContainText('Pied interdit');
  await page.locator('#vCreate [data-t="nofoot"]').click();
  const p = await spot(page, 0.7, 0.6);
  await page.mouse.click(p.x, p.y);
  const holds = await page.evaluate(() => state.holds);
  expect(holds).toHaveLength(5);
  expect(holds[4]).toMatchObject({ t: 'nofoot', x: 0.7, y: 0.6 });
  await expect(slash(page, '#editWall')).toHaveCount(1);
  await expect(page.locator('#vCreate [data-counts]')).toContainText('Interdits');
  await expect(page.locator('#vCreate [data-counts]')).toContainText('Moves 2');
  // Aucun trait ne le relie aux mains : seulement les 3 traits des mains (départ → main 1 → main 2 → top).
  await expect(page.locator('#editWall svg line[stroke="#fff"]')).toHaveCount(3);
});

test('publié, il s\'affiche sur la fiche et pendant tout le replay, sans changer les étapes', async ({ page }, testInfo) => {
  const id = uid(testInfo);
  await openEditor(page, id, [...BASE, { t: 'nofoot', x: 0.7, y: 0.6 }]);
  await page.locator('#fName').fill(`Sans pieds ${id}`);
  await page.locator('#fSetter').fill('Alice');
  await page.locator('#fSave').click();
  await expect(page.locator('#dName')).toHaveText(`Sans pieds ${id}`);
  await expect(page.locator('#dSeq')).toContainText('1 pied interdit');
  await expect(page.locator('#dLegNoFoot')).toBeVisible();
  await expect(slash(page, '#dWall')).toHaveCount(1);
  expect(await page.evaluate(() => state.blocs[0].holds.filter(h => h.t === 'nofoot').length)).toBe(1);
  await page.locator('#dReplay').click();
  const cap = page.locator('#rpCap');
  await expect(cap).toContainText('Départ');
  await expect(slash(page, '#fsWall')).toHaveCount(1); // visible dès la première étape
  await page.locator('#rpNext').click(); await expect(cap).toContainText('Move 1 / 2');
  await page.locator('#rpNext').click(); await expect(cap).toContainText('Move 2 / 2');
  await page.locator('#rpNext').click(); await expect(cap).toContainText('Top');
  await expect(slash(page, '#fsWall')).toHaveCount(1);
});

test('appui long sur un pied interdit : seulement déplacer ou supprimer', async ({ page }, testInfo) => {
  await openEditor(page, uid(testInfo), [...BASE, { t: 'nofoot', x: 0.7, y: 0.6 }]);
  const p = await holdXY(page, 4);
  await page.mouse.move(p.x, p.y); await page.mouse.down(); await page.waitForTimeout(650); await page.mouse.up();
  await expect(page.locator('#holdMenu')).toBeVisible();
  await expect(page.locator('#holdMenu .hm-h')).toContainText('Pied interdit');
  await expect(page.locator('[data-hm^="before"], [data-hm^="after"], [data-hm="swap"]')).toHaveCount(0);
  await page.locator('[data-hm="del"]').click();
  expect(await page.evaluate(() => state.holds.map(h => h.t))).toEqual(['start', 'hand', 'hand', 'top']);
});

test('à 390 px, la rangée d\'outils ne déborde pas : « Pied interdit » est sur une seconde ligne', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await openEditor(page, uid(testInfo));
  const b = await page.evaluate(() => {
    const row = document.querySelector('#vCreate .toolrow'), r = e => e.getBoundingClientRect();
    const start = r(row.querySelector('[data-t="start"]')), no = r(row.querySelector('[data-t="nofoot"]')), undo = r(row.querySelector('[data-undo]')), rr = r(row);
    return { overflow: row.scrollWidth - row.clientWidth, below: no.top >= start.bottom - 1, inside: no.right <= rr.right + 1 && undo.right <= rr.right + 1, noOverlap: no.right <= undo.left + 1 };
  });
  expect(b.overflow).toBeLessThanOrEqual(0);
  expect(b.below).toBe(true);
  expect(b.inside).toBe(true);
  expect(b.noOverlap).toBe(true);
});
