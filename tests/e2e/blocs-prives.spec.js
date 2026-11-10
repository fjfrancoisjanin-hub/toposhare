// Blocs privés ou publics : choix à la publication, visibilité réservée à l'auteur, lien direct, changement de visibilité.
const { test, expect } = require('./fixtures');
const { ALICE, BOB, login, seed } = require('./helpers');

const uid = testInfo => `${testInfo.project.name}-${Date.now()}`;

async function seedSalle(id) {
  await seed('gyms', id, { name: `Salle ${id}`, city: 'Albi', createdAt: 1 });
  await seed('walls', `w-${id}`, { gymId: id, name: 'Spray', image: '', w: 100, h: 100, active: true, createdAt: 1 });
  await seed('blocs', `pub-${id}`, { gymId: id, wallId: `w-${id}`, name: `Public ${id}`, grade: '6a', setter: 'Paul', holds: [{ t: 'start', x: 0.5, y: 0.5 }, { t: 'top', x: 0.5, y: 0.2 }], authorId: 'autre', createdAt: 1 });
}
// Alice trace un bloc : nom, ouvreur, prises, visibilité, publication. Renvoie l'identifiant du bloc.
async function publish(page, name, { priv } = {}) {
  await page.locator('#tabCreate').click();
  await page.locator('#fName').fill(name);
  await page.locator('#fSetter').fill('Alice');
  await page.evaluate(() => { state.holds = [{ t: 'start', x: 0.3, y: 0.8 }, { t: 'hand', x: 0.4, y: 0.5 }, { t: 'top', x: 0.5, y: 0.2 }]; });
  if (priv !== undefined) await page.locator(priv ? '#fVisPrivate' : '#fVisPublic').check();
  await page.locator('#fSave').click();
  await expect(page.locator('#dName')).toHaveText(name);
  return page.evaluate(() => state.current);
}
async function bobPage(browser, testInfo, hash) {
  const ctx = await browser.newContext(testInfo.project.use), page = await ctx.newPage();
  await page.goto(hash);
  await login(page, BOB);
  return page;
}
// Ouverture d'un lien direct à froid : le lien efface son « # » une fois suivi, recharger ne le rejouerait pas.
const cold = async (page, url) => { await page.goto('about:blank'); await page.goto(url); };
const card = (page, text) => page.locator('.card .name', { hasText: text });

test('à la publication, public par défaut ; un bloc privé n\'est vu que par son auteur, lien direct compris', async ({ page, browser }, testInfo) => {
  const id = uid(testInfo);
  await seedSalle(id);
  await page.goto(`/#/salle/${id}`);
  await login(page, ALICE);
  await page.locator('#tabCreate').click();
  await expect(page.locator('#fVisPublic')).toBeChecked();
  await expect(page.locator('#fVisPrivate')).toBeEnabled();
  await page.locator('#tabSalles').click();

  const bid = await publish(page, `Mon essai ${id}`, { priv: true });
  await expect(page.locator('#dBy')).toContainText('Privé');
  await page.locator('#tabSalles').click();
  await expect(card(page, `Mon essai ${id}`)).toBeVisible();
  await expect(page.locator('.card', { hasText: `Mon essai ${id}` }).locator('.tag')).toContainText('Privé');

  // Un autre grimpeur voit les blocs publics de la salle, jamais celui-là.
  const bob = await bobPage(browser, testInfo, `/#/salle/${id}`);
  await expect(card(bob, `Public ${id}`)).toBeVisible();
  await expect(card(bob, `Mon essai ${id}`)).toHaveCount(0);
  await cold(bob, `/#/bloc/${bid}`);
  await expect(bob.locator('#toast')).toHaveText("Ce contenu n'existe plus");
  // Même chose pour un invité.
  const guest = await browser.newContext(testInfo.project.use), gp = await guest.newPage();
  await gp.goto(`/#/bloc/${bid}`);
  await expect(gp.locator('#toast')).toHaveText("Ce contenu n'existe plus");
  // L'auteur, lui, ouvre son lien après rechargement.
  await cold(page, `/#/bloc/${bid}`);
  await expect(page.locator('#dName')).toHaveText(`Mon essai ${id}`);
});

test('le dernier choix de visibilité est gardé pour le bloc suivant', async ({ page }, testInfo) => {
  const id = uid(testInfo);
  await seedSalle(id);
  await page.goto(`/#/salle/${id}`);
  await login(page, ALICE);
  await page.locator('#tabCreate').click();
  await page.locator('#fVisPrivate').check();
  await page.reload();
  await page.locator('#tabCreate').click();
  await expect(page.locator('#fVisPrivate')).toBeChecked();
});

test('le propriétaire d\'un bloc le rend public, puis le replay et la modification restent disponibles', async ({ page, browser }, testInfo) => {
  const id = uid(testInfo);
  await seedSalle(id);
  await page.goto(`/#/salle/${id}`);
  await login(page, ALICE);
  const bid = await publish(page, `Projet ${id}`, { priv: true });
  await expect(page.locator('#dReplay')).toBeVisible();
  await page.locator('#dEdit').click();
  await expect(page.locator('#fVisPrivate')).toBeChecked();
  await page.locator('#fVisPublic').check();
  await page.locator('#fSave').click();
  await expect(page.locator('#dName')).toHaveText(`Projet ${id}`);
  await expect(page.locator('#dBy')).not.toContainText('Privé');
  const bob = await bobPage(browser, testInfo, `/#/salle/${id}`);
  await expect(card(bob, `Projet ${id}`)).toBeVisible();
  // Le lien direct reste le même après le déplacement.
  await cold(bob, `/#/bloc/${bid}`);
  await expect(bob.locator('#dName')).toHaveText(`Projet ${id}`);
});

test("l'auteur supprime son bloc privé", async ({ page }, testInfo) => {
  const id = uid(testInfo);
  await seedSalle(id);
  await page.goto(`/#/salle/${id}`);
  await login(page, ALICE);
  await publish(page, `À jeter ${id}`, { priv: true });
  await page.locator('#dDel').click();
  await page.locator('#dDelOk').click();
  await expect(page.locator('#toast')).toHaveText('Bloc supprimé');
  await expect(card(page, `À jeter ${id}`)).toHaveCount(0);
});
