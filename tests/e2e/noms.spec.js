// Ticket 1 : l'admin corrige les noms, et le prénom vient du compte connecté.
const path = require('path');
const { test, expect } = require('./fixtures');
const { ADMIN, ALICE, BOB, login, seed } = require('./helpers');

const uid = testInfo => `${testInfo.project.name}-${Date.now()}`;

// Ouvre l'appli en falaise, sur le secteur donné.
async function openCrag(page, secteurId, extra = {}) {
  await page.addInitScript(([s, x]) => {
    if (sessionStorage.getItem('init')) return;
    sessionStorage.setItem('init', '1');
    localStorage.setItem('pan-mode', 'out');
    localStorage.setItem('pan-sect', s);
    for (const [k, v] of Object.entries(x)) localStorage.setItem(k, v);
  }, [secteurId, extra]);
  await page.route('**/geo.api.gouv.fr/**', r => r.abort());
  await page.goto(`/#/secteur/${secteurId}`);
}

async function seedCrag(id) {
  await seed('secteurs', id, { name: `St Antonin noble val ${id}`, region: '', authorId: 'alice-e2e', createdAt: 1 });
  await seed('voies', `v-${id}`, { secteurId: id, name: `Voie ${id}`, grade: '6a', w: 100, h: 100, anchors: [], authorId: 'alice-e2e', addedBy: 'Mauvais', methodCount: 1, createdAt: 1 });
  await seed('methodes', `m-${id}`, { voieId: `v-${id}`, secteurId: id, authorId: 'bob-e2e', climber: 'Bobby', steps: [], createdAt: 1 });
}

test("l'admin renomme un secteur et corrige l'auteur d'une voie, visibles en direct chez un autre", async ({ page, browser }, testInfo) => {
  const id = uid(testInfo);
  await seedCrag(id);
  await openCrag(page, id);
  await login(page, ADMIN);

  // Un autre grimpeur a la fiche de la voie ouverte.
  const ctx = await browser.newContext(testInfo.project.use);
  const other = await ctx.newPage();
  await openCrag(other, id);
  await login(other, BOB);
  await other.getByText(`Voie ${id}`).click();
  await expect(other.locator('#ovBy')).toContainText('ajoutée par Mauvais');
  await expect(other.locator('[data-act="adminv"]')).toHaveCount(0);

  // Renommage du secteur.
  await page.locator('#gymName').click();
  await page.locator(`[data-edit="secteurs:${id}"]`).click();
  await page.locator('#e_name').fill(`  Saint-Antonin ${id}  `);
  await page.locator('#e_region').fill('Saint-Antonin-Noble-Val');
  await page.locator('#eForm button[type=submit]').click();
  await expect(page.locator('#eForm')).toBeHidden();
  await expect(other.locator('#ovBy')).toContainText(`Saint-Antonin ${id} · ajoutée par Mauvais`);

  // Correction de l'auteur de la voie.
  await page.getByText(`Voie ${id}`).click();
  await page.locator('[data-act="adminv"]').click();
  await expect(page.locator('#e_addedBy')).toHaveValue('Mauvais');
  await page.locator('#e_addedBy').fill('Alice');
  await page.locator('#eForm button[type=submit]').click();
  await expect(page.locator('#ovBy')).toContainText('ajoutée par Alice');
  await expect(other.locator('#ovBy')).toContainText('ajoutée par Alice');
  await ctx.close();
});

test("l'admin corrige le prénom d'une méthode et un nom vide est refusé", async ({ page }, testInfo) => {
  const id = uid(testInfo);
  await seedCrag(id);
  await openCrag(page, id);
  await login(page, ADMIN);
  await page.getByText(`Voie ${id}`).click();
  await page.getByRole('button', { name: 'Méthode de Bobby' }).click();
  await page.locator('[data-act="adminm"]').click();
  await page.locator('#e_climber').fill('   ');
  await page.locator('#eForm button[type=submit]').click();
  await expect(page.locator('#eErr')).toHaveText('Ce champ ne peut pas être vide.');
  await page.locator('#e_climber').fill('Robert');
  await page.locator('#eForm button[type=submit]').click();
  await expect(page.getByRole('button', { name: 'Méthode de Robert' })).toBeVisible();
  // Rouvrir la fiche repart de la valeur enregistrée, sans l'ancienne erreur.
  await page.locator('[data-act="adminm"]').click();
  await expect(page.locator('#e_climber')).toHaveValue('Robert');
  await expect(page.locator('#eErr')).toHaveText('');
});

test("deux secteurs de même nom dans la même commune : l'appli avertit sans bloquer", async ({ page }, testInfo) => {
  const id = uid(testInfo);
  await seed('secteurs', id, { name: `Anglars ${id}`, region: 'Saint-Antonin', createdAt: 1 });
  await seed('secteurs', `${id}b`, { name: `Autre ${id}`, region: 'Saint Antonin', createdAt: 1 });
  await openCrag(page, id);
  await login(page, ADMIN);
  await page.locator('#gymName').click();
  await page.locator(`[data-edit="secteurs:${id}b"]`).click();
  await expect(page.locator('#eWarn')).toBeHidden();
  await page.locator('#e_name').fill(`anglars ${id}`);
  await expect(page.locator('#eWarn')).toBeVisible();
  await page.locator('#eForm button[type=submit]').click();
  await expect(page.locator('#eForm')).toBeHidden();
});

test('un grimpeur ordinaire ne voit aucun bouton de correction', async ({ page }, testInfo) => {
  const id = uid(testInfo);
  await seedCrag(id);
  await openCrag(page, id);
  await login(page, BOB);
  await page.locator('#gymName').click();
  await expect(page.locator('#sheet .gymrow').first()).toBeVisible();
  await expect(page.locator('[data-edit]')).toHaveCount(0);
});

test('une nouvelle voie affiche un prénom pré-rempli avec le compte, pas le dernier saisi', async ({ page }, testInfo) => {
  const id = uid(testInfo);
  await seedCrag(id);
  await openCrag(page, id, { 'pan-setter': 'Paul' });
  await login(page, ALICE);
  await page.locator('#tabCreate').click();
  await page.locator('#oeFile').setInputFiles(path.join(__dirname, '..', '..', 'public', 'wall.jpg'));
  await expect(page.locator('#oAddedBy')).toHaveValue('Alice');
  await page.locator('#oAddedBy').fill('Alicia');
  await page.locator('#oName').fill(`Neuve ${id}`);
  const box = await page.locator('#oeWall').boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.locator('#oSave').click();
  await expect(page.locator('#ovBy')).toContainText('ajoutée par Alicia');
});

test('le prénom de la méthode suit le compte connecté après un changement de compte', async ({ page }, testInfo) => {
  const id = uid(testInfo);
  await seedCrag(id);
  await openCrag(page, id, { 'pan-setter': 'Paul' });
  await login(page, ALICE);
  await page.getByText(`Voie ${id}`).click();
  await page.locator('[data-act="newm"]').click();
  await expect(page.locator('#oClimber')).toHaveValue('Alice');
  await page.evaluate(() => BT.signOut());
  await login(page, BOB);
  await expect(page.locator('#oClimber')).toHaveValue('Bob');
});

test("l'admin corrige une salle et l'ouvreur d'un bloc", async ({ page }, testInfo) => {
  const id = uid(testInfo);
  await seed('gyms', id, { name: `Salle ${id}`, city: 'Albi', createdAt: 1 });
  await seed('walls', `w-${id}`, { gymId: id, name: 'Spray wall', image: '', w: 100, h: 100, active: true, createdAt: 1 });
  await seed('blocs', `b-${id}`, { gymId: id, wallId: `w-${id}`, name: `Bloc ${id}`, grade: '6a', setter: 'Mauvais', holds: [], authorId: 'alice-e2e', createdAt: 1 });
  await page.goto(`/#/salle/${id}`);
  await login(page, ADMIN);

  await page.getByText(`Bloc ${id}`).click();
  await expect(page.locator('#dEdit')).toBeHidden();
  await page.locator('#dAdminEdit').click();
  await page.locator('#e_setter').fill('Alice');
  await page.locator('#eForm button[type=submit]').click();
  await expect(page.locator('#dBy')).toContainText('Ouvert par Alice');

  await page.locator('#gymName').click();
  await page.locator(`[data-edit="gyms:${id}"]`).click();
  await page.locator('#e_name').fill(`Altissimo ${id}`);
  await page.locator('#eForm button[type=submit]').click();
  await expect(page.locator('#gymName')).toContainText(`Altissimo ${id}`);

  // À 390 px, la liste avec les boutons « Modifier » ne déborde pas.
  await page.locator('#gymName').click();
  await expect(page.locator(`[data-edit="gyms:${id}"]`)).toBeVisible();
  const { scroll, client } = await page.locator('#sheet').evaluate(s => ({ scroll: s.scrollWidth, client: s.clientWidth }));
  expect(scroll).toBeLessThanOrEqual(client);
});

test("l'auteur d'une voie corrige son prénom dans son formulaire", async ({ page }, testInfo) => {
  const id = uid(testInfo);
  await seedCrag(id);
  await openCrag(page, id);
  await login(page, ALICE);
  // L'émulateur attribue lui-même l'identifiant du compte : la voie est rattachée après la connexion.
  const me = await page.evaluate(() => BT.user().uid);
  await seed('voies', `v-${id}`, { secteurId: id, name: `Voie ${id}`, grade: '6a', w: 100, h: 100, anchors: [{ x: 50, y: 50, t: 'bolt' }], authorId: me, addedBy: 'Mauvais', methodCount: 0, createdAt: 1 });
  await page.getByText(`Voie ${id}`).click();
  await page.locator('[data-act="editr"]').click();
  await expect(page.locator('#oAddedBy')).toHaveValue('Mauvais');
  await page.locator('#oAddedBy').fill('Alice');
  await page.locator('#oSave').click();
  await expect(page.locator('#ovBy')).toContainText('ajoutée par Alice');
  await expect(page.locator('[data-act="adminv"]')).toHaveCount(0);
});
