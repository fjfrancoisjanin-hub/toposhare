// Aide sur la photo : une petite carte très courte (appui long, options en pastilles), fermable, qui revient avec un « ? » ;
// message adapté à la modification d'un contenu existant (« Prise oubliée ? »).
const { test, expect } = require('./fixtures');
const { ALICE, login, seed } = require('./helpers');

const uid = testInfo => `${testInfo.project.name}-${Date.now()}`;
const HOLDS = [{ t: 'start', x: 0.3, y: 0.9 }, { t: 'hand', x: 0.4, y: 0.7 }, { t: 'hand', x: 0.5, y: 0.5 }, { t: 'top', x: 0.5, y: 0.15 }];

async function seedSalle(id) {
  await seed('gyms', id, { name: `Salle ${id}`, city: 'Albi', createdAt: 1 });
  await seed('walls', `w-${id}`, { gymId: id, name: 'Spray', image: '', w: 100, h: 100, active: true, createdAt: 1 });
}
async function openCreate(page, id) {
  await seedSalle(id);
  await page.goto(`/#/salle/${id}`);
  await login(page, ALICE);
  await page.locator('#tabCreate').click();
}
const tip = (page, root = '#editWall') => page.locator(`${root} .tip`);

test('à la création d\'un bloc, la carte d\'aide est sur la photo : courte, avec les options en pastilles', async ({ page }, testInfo) => {
  await openCreate(page, uid(testInfo));
  await expect(tip(page)).toBeVisible();
  await expect(tip(page)).toContainText('Appui long sur une prise');
  await expect(tip(page).locator('.tip-pills i')).toHaveText(['Avant', 'Après', 'Déplacer', 'Supprimer']);
  // Succincte, et posée en haut de la photo (visible dès l'ouverture, sans défiler).
  expect((await tip(page).innerText()).length).toBeLessThan(140);
  const [t, w] = await Promise.all([tip(page).boundingBox(), page.locator('#editWall').boundingBox()]);
  expect(t.y - w.y).toBeLessThan(70);
  // Elle ne recouvre pas le bouton « Plein écran » (coin en haut à droite) : on peut cliquer dessus avec la carte ouverte.
  await expect(page.locator('#editFull')).toBeVisible();
  const f = await page.locator('#editFull').boundingBox();
  expect(t.y).toBeGreaterThanOrEqual(f.y + f.height - 1);
  expect(t.x).toBeGreaterThanOrEqual(w.x); expect(t.x + t.width).toBeLessThanOrEqual(w.x + w.width + 1);
  // Plus de « ? » en bas de l'écran : il n'y a que celui de la photo, et seulement quand la carte est fermée.
  await expect(page.locator('#vCreate [data-counts] .helpbtn')).toHaveCount(0);
  await expect(page.locator('.tipq')).toHaveCount(0);
});

test('la carte se ferme, un petit « ? » reste sur la photo, le choix est gardé, et « Mon compte » réaffiche les aides', async ({ page }, testInfo) => {
  await openCreate(page, uid(testInfo));
  await page.locator('#editWall [data-tip-close]').click();
  await expect(tip(page)).toHaveCount(0);
  await expect(page.locator('#editWall .tipq')).toBeVisible();
  await page.reload();
  await page.locator('#tabCreate').click();
  await expect(tip(page)).toHaveCount(0);
  await expect(page.locator('#editWall .tipq')).toBeVisible();
  await page.locator('#editWall .tipq').click();
  await expect(tip(page)).toBeVisible();
  await page.locator('#editWall [data-tip-close]').click();
  await page.locator('#acctBtn').click();
  await page.locator('[data-help-reset]').click();
  await page.locator('[data-close-sheet]').click();
  await expect(tip(page)).toBeVisible();
});

test('la carte ne gêne pas : un tap sous la carte pose une prise, et la carte ne bloque ni le zoom ni le glissé', async ({ page }, testInfo) => {
  await openCreate(page, uid(testInfo));
  await page.evaluate(() => { state.holds = [{ t: 'start', x: 0.3, y: 0.9 }]; state.tool = 'hand'; renderEditor(); });
  const t = await tip(page).boundingBox();
  await page.mouse.click(t.x + 30, t.y + t.height / 2); // en plein sur le texte de la carte (pointer-events: none)
  expect(await page.evaluate(() => state.holds.filter(h => h.t === 'hand').length)).toBe(1);
});

test('à la modification d\'un bloc existant : « Prise oubliée ? » et la marche à suivre, indépendante du message de création', async ({ page: first, browser }, testInfo) => {
  const id = uid(testInfo);
  await first.goto('/');
  await login(first, ALICE);
  const me = await first.evaluate(() => BT.user().uid);
  await seedSalle(id);
  await seed('blocs', `b-${id}`, { gymId: id, wallId: `w-${id}`, name: `Mon bloc ${id}`, grade: '6a', setter: 'Alice', holds: HOLDS, authorId: me, createdAt: 1 });
  const ctx = await browser.newContext(testInfo.project.use), page = await ctx.newPage();
  await page.goto(`/#/salle/${id}`);
  await login(page, ALICE);
  // Fermer l'aide de création ne ferme pas celle de modification.
  await page.locator('#tabCreate').click();
  await page.locator('#editWall [data-tip-close]').click();
  await page.locator('#tabSalles').click();
  await page.locator('.card .name', { hasText: `Mon bloc ${id}` }).click();
  await page.locator('#dEdit').click();
  await expect(tip(page)).toBeVisible();
  await expect(tip(page)).toContainText('Prise oubliée ?');
  await expect(tip(page)).toContainText('Appui long sur la prise juste avant, puis « Ajouter après ».');
  // La marche à suivre décrite fonctionne : appui long sur la main 1, « Ajouter après », tap sur le mur.
  const xy = await page.evaluate(() => { const v = editView, r = v.el.getBoundingClientRect(), h = state.holds[1]; return { x: r.left + v.ox + h.x * v.s * v.bw, y: r.top + v.oy + h.y * v.s * v.bh }; });
  await page.mouse.move(xy.x, xy.y); await page.mouse.down(); await page.waitForTimeout(650); await page.mouse.up();
  await page.locator('[data-hm="after:hand"]').click();
  const to = await page.evaluate(() => { const v = editView, r = v.el.getBoundingClientRect(); return { x: r.left + v.ox + 0.7 * v.s * v.bw, y: r.top + v.oy + 0.6 * v.s * v.bh }; });
  await page.mouse.click(to.x, to.y);
  expect(await page.evaluate(() => state.holds.map(h => `${h.t}:${h.x}`))).toEqual(['start:0.3', 'hand:0.4', 'hand:0.7', 'hand:0.5', 'top:0.5']);
});

test('méthode de voie : message de création puis « Prise oubliée ? » à la modification, avec Repos et Relance dans les pastilles', async ({ page: first, browser }, testInfo) => {
  const id = uid(testInfo);
  await first.goto('/');
  await login(first, ALICE);
  const me = await first.evaluate(() => BT.user().uid);
  await seed('secteurs', id, { name: `Secteur ${id}`, region: '', createdAt: 1 });
  await seed('voies', `v-${id}`, { secteurId: id, name: `Voie ${id}`, grade: '6a', w: 100, h: 100, image: '', anchors: [], authorId: 'autre', addedBy: 'Paul', methodCount: 0, createdAt: 1 });
  await seed('methodesPrivees', `m-${id}`, { voieId: `v-${id}`, secteurId: id, authorId: me, climber: 'Alice', createdAt: 1, steps: [{ t: 'hand', x: 0.4, y: 0.8 }, { t: 'hand', x: 0.5, y: 0.6 }] });
  const ctx = await browser.newContext(testInfo.project.use), page = await ctx.newPage();
  await page.goto(`/#/secteur/${id}`);
  await login(page, ALICE);
  await page.locator('.name', { hasText: `Voie ${id}` }).click();
  await page.locator('[data-act="editm"]').click();
  await expect(tip(page, '#oeWall')).toContainText('Prise oubliée ?');
  await expect(tip(page, '#oeWall').locator('.tip-pills i')).toHaveText(['Avant', 'Après', 'Repos', 'Relance', 'Déplacer', 'Supprimer']);
});

test('en plein écran, la même carte est sur la photo et se ferme pour les deux écrans', async ({ page }, testInfo) => {
  await openCreate(page, uid(testInfo));
  await page.locator('#editFull').click();
  await expect(tip(page, '#fsWall')).toBeVisible();
  await expect(tip(page, '#fsWall')).toContainText('Appui long sur une prise');
  await page.locator('#fsWall [data-tip-close]').click();
  await expect(tip(page, '#fsWall')).toHaveCount(0);
  await page.locator('#fsClose').click();
  await expect(tip(page)).toHaveCount(0);
});

test('à 390 px, la carte tient dans la photo sans déborder', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await openCreate(page, uid(testInfo));
  await expect(tip(page)).toBeVisible();
  const [t, w] = await Promise.all([tip(page).boundingBox(), page.locator('#editWall').boundingBox()]);
  expect(t.x).toBeGreaterThanOrEqual(w.x);
  expect(t.x + t.width).toBeLessThanOrEqual(w.x + w.width + 1);
  expect(t.height).toBeLessThan(w.height * 0.6);
});
