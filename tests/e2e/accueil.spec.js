// Ticket 7 : accueil, recherche, liens directs et QR code.
const path = require('path');
const { test, expect } = require('./fixtures');
const { ALICE, login, loginAdminPage, seed } = require('./helpers');

const uid = testInfo => `${testInfo.project.name}-${Date.now()}`;
const commune = { nom: 'Saint-Antonin-Noble-Val', code: '82155', departement: '82', simple: 'saint antonin noble val', verifie: true };

async function seedPlaces(id) {
  await seed('gyms', `g-${id}`, { name: `Salle ${id}`, city: 'Albi', createdAt: 1 });
  await seed('walls', `w-${id}`, { gymId: `g-${id}`, name: 'Spray', image: '', w: 100, h: 100, active: true, createdAt: 1 });
  await seed('blocs', `b-${id}`, { gymId: `g-${id}`, wallId: `w-${id}`, name: `Bloc ${id}`, grade: '6a', setter: 'Paul', holds: [], authorId: 'x', createdAt: 1 });
  await seed('secteurs', `s-${id}`, { name: `Anglars ${id}`, region: 'Saint-Antonin-Noble-Val (82)', commune, createdAt: 1 });
  await seed('voies', `v-${id}`, { secteurId: `s-${id}`, name: `Le marché ${id}`, grade: '7c', w: 100, h: 100, anchors: [], authorId: 'x', addedBy: 'Paul', methodCount: 0, createdAt: 1 });
}
const card = (page, text) => page.locator('.card .name', { hasText: text });

test('premier lancement : titre, recherche, lieux existants, et « Nouveau » sur le bouton de création', async ({ page }, testInfo) => {
  const id = uid(testInfo);
  await seedPlaces(id);
  await page.goto('/');
  await expect(page.locator('#hTitle')).toHaveText("Où grimpes-tu aujourd'hui ?");
  await expect(page.locator('#hBody')).toContainText(`Salle ${id}`);
  await expect(page.locator('#hBody')).toContainText(`Anglars ${id}`);
  await expect(page.locator('[data-add-place]')).toBeVisible();
  await expect(page.locator('#tabPlace')).toBeHidden();
  await expect(page.locator('#tabCreateLbl')).toHaveText('Nouveau');
});

test("ouvrir le lien d'une salle, d'un secteur, d'une voie ou d'un bloc mène à la page, sans aucun tap", async ({ page }, testInfo) => {
  const id = uid(testInfo);
  await seedPlaces(id);
  await page.goto(`/#/salle/g-${id}`);
  await expect(card(page, `Bloc ${id}`)).toBeVisible();
  await expect(page.locator('#tabCreateLbl')).toHaveText('Nouveau bloc');
  await page.goto(`/#/secteur/s-${id}`);
  await expect(card(page, `Le marché ${id}`)).toBeVisible();
  await expect(page.locator('#tabCreateLbl')).toHaveText('Nouvelle voie');
  await page.goto(`/#/voie/v-${id}`);
  await expect(page.locator('#ovName')).toHaveText(`Le marché ${id}`);
  await page.goto(`/#/bloc/b-${id}`);
  await expect(page.locator('#dName')).toHaveText(`Bloc ${id}`);
});

test('un lien vers un contenu supprimé renvoie à l\'accueil avec un message', async ({ page }) => {
  await page.goto('/#/voie/inexistante');
  await expect(page.locator('#toast')).toHaveText("Ce contenu n'existe plus");
  await expect(page.locator('#tabHome')).toHaveAttribute('aria-current', 'page');
});

test('un lien vers un bloc archivé s\'ouvre avec le bandeau d\'archive', async ({ page }, testInfo) => {
  const id = uid(testInfo);
  await seedPlaces(id);
  await seed('walls', `w-${id}`, { gymId: `g-${id}`, name: 'Spray', image: '', w: 100, h: 100, active: false, createdAt: 1 });
  await page.goto(`/#/bloc/b-${id}`);
  await expect(page.locator('#dOld')).toBeVisible();
});

test("le dernier lieu s'ouvre en 1 tap depuis l'accueil, une de ses voies en 2, et le bouton suit le lieu", async ({ page }, testInfo) => {
  const id = uid(testInfo);
  await seedPlaces(id);
  await page.goto(`/#/secteur/s-${id}`);
  await expect(card(page, `Le marché ${id}`)).toBeVisible();
  await page.locator('#tabHome').click();
  await expect(page.locator('#hResume')).toContainText(`Reprendre : Anglars ${id}`);
  await expect(page.locator('#hResume')).toContainText('Saint-Antonin-Noble-Val (82)');
  await expect(page.locator('#tabCreateLbl')).toHaveText('Nouvelle voie');
  await expect(page.locator('#tabPlace')).toContainText(`Anglars ${id}`);
  await page.locator('#hResume').click();
  await card(page, `Le marché ${id}`).click();
  await expect(page.locator('#ovName')).toHaveText(`Le marché ${id}`);
  await page.reload();
  await expect(page.locator('#hResume')).toBeVisible();
  await expect(page.locator('#hBody')).toContainText('Récents');
});

test('un invité utilise la recherche : préfixes, accents, tirets et st / saint', async ({ page }, testInfo) => {
  const id = uid(testInfo);
  await seedPlaces(id);
  await page.goto('/');
  const results = page.locator('#hResults');
  for (const q of ['angl', 'st anto', 'Saint-Antonin', 'SAINT ANTONIN']) {
    await page.locator('#hSearch').fill(q);
    await expect(results).toContainText(`Anglars ${id}`);
    if (q !== 'angl') await expect(results).toContainText('Commune');
    await expect(results.locator('mark').first()).toBeVisible();
  }
  await page.locator('#hSearch').fill('marché');
  await expect(results).toContainText(`Le marché ${id}`);
  await page.locator('#hSearch').fill('marche ' + id);
  await results.locator('[data-go]').click();
  await expect(page.locator('#ovName')).toHaveText(`Le marché ${id}`);
});

test('sans résultat, le lien de création demande la connexion, puis préremplit la commune', async ({ page }, testInfo) => {
  await page.route('**/geo.api.gouv.fr/**', r => r.abort());
  await page.goto('/');
  await page.locator('#hSearch').fill(`Nulle part ${uid(testInfo)}`);
  await page.locator('[data-new-sector]').click();
  await expect(page.locator('[data-login-go]')).toBeVisible();
  await page.locator('[data-close-sheet]').click();
  await login(page, ALICE);
  await page.locator('[data-new-sector]').click();
  await expect(page.locator('#nsRegion')).toHaveValue(/Nulle part/);
});

test('les favoris se gardent, sans compte, et un lieu supprimé disparaît sans erreur', async ({ page }, testInfo) => {
  const id = uid(testInfo);
  await seedPlaces(id);
  await page.goto(`/#/secteur/s-${id}`);
  await page.locator('[data-hero="secteur"] [data-star]').click();
  await page.locator('[data-hero="secteur"] [data-home]').click();
  await expect(page.locator('#hBody')).toContainText('Favoris');
  await page.evaluate(() => localStorage.setItem('ts-recents', JSON.stringify([{ type: 'secteur', id: 'supprime', t: 1 }, ...JSON.parse(localStorage.getItem('ts-recents'))])));
  await page.reload();
  await expect(page.locator('#hResume')).toContainText(`Anglars ${id}`);
});

test('« Nouveau » fait choisir entre bloc et voie, puis le lieu', async ({ page }, testInfo) => {
  const id = uid(testInfo);
  await seedPlaces(id);
  await page.goto('/');
  await login(page, ALICE);
  await page.locator('#tabCreate').click();
  await page.locator('[data-pick-after="main"]').click();
  await page.locator(`[data-gym="g-${id}"]`).click();
  await expect(page.locator('#vCreate')).toBeVisible();
});

test('la recherche ne renvoie jamais de méthode privée', async ({ page }, testInfo) => {
  const id = uid(testInfo);
  await seed('methodesPrivees', `m-${id}`, { voieId: 'x', authorId: 'y', climber: `Secret${id}`, createdAt: 1 });
  await page.goto('/');
  await page.locator('#hSearch').fill(`Secret${id}`);
  await expect(page.locator('#hResults')).toContainText('Aucun résultat');
});

test('le QR code généré sur /admin mène à la bonne salle', async ({ page }, testInfo) => {
  const id = uid(testInfo);
  await seedPlaces(id);
  await loginAdminPage(page);
  await page.locator('#qrPlace').selectOption(`salle:g-${id}`);
  await page.locator('#qrMake').click();
  await expect(page.locator('#poster')).toContainText('Sans compte, sans appli à installer');
  await page.addScriptTag({ path: path.join(__dirname, '..', '..', 'node_modules', 'jsqr', 'dist', 'jsQR.js') });
  const url = await page.evaluate(async () => {
    const img = document.getElementById('qrImg'); await img.decode();
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    return jsQR(x.getImageData(0, 0, c.width, c.height).data, c.width, c.height)?.data;
  });
  expect(new URL(url).hash).toBe(`#/salle/g-${id}`);
  await page.goto(url);
  await expect(card(page, `Bloc ${id}`)).toBeVisible({ timeout: 15_000 });
});

test('à 390 px, la barre du bas tronque un nom très long sans déborder', async ({ page }, testInfo) => {
  const id = uid(testInfo);
  await seed('secteurs', id, { name: `Un nom de secteur vraiment très long ${id}`, region: '', createdAt: 1 });
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto(`/#/secteur/${id}`);
  await expect(page.locator('#tabPlace')).toBeVisible();
  const box = await page.locator('nav.tabs .in').evaluate(n => ({ s: n.scrollWidth, c: n.clientWidth }));
  expect(box.s).toBeLessThanOrEqual(box.c);
  await expect(page.locator('[data-hero="secteur"] b')).toHaveText(`Un nom de secteur vraiment très long ${id}`);
});
