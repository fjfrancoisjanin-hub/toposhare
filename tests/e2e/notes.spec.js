// Ticket 4 : noter les voies et les blocs.
const { test, expect } = require('./fixtures');
const { ALICE, BOB, CAROLE, login, seed } = require('./helpers');

const uid = testInfo => `${testInfo.project.name}-${Date.now()}`;

async function seedGym(id) {
  await seed('gyms', id, { name: `Salle ${id}`, city: 'Albi', createdAt: 1 });
  await seed('walls', `w-${id}`, { gymId: id, name: 'Spray', image: '', w: 100, h: 100, active: true, createdAt: 1 });
  await seed('blocs', `b-${id}`, { gymId: id, wallId: `w-${id}`, name: `Noté ${id}`, grade: '6a', setter: 'Paul', holds: [], authorId: 'autre', createdAt: 1 });
}
const vote = (page, value) => page.locator(`#dRate [data-vote="${value}"]`).click();
const pressed = (page, value) => expect(page.locator(`#dRate [data-vote="${value}"]`)).toHaveAttribute('aria-pressed', 'true');

test('trois comptes votent 3, 2 et 2 : la fiche affiche « ★★☆ 2,3 · 3 avis », et le tri le place en tête', async ({ page }, testInfo) => {
  const id = uid(testInfo);
  await seedGym(id);
  await seed('blocs', `moyen-${id}`, { gymId: id, wallId: `w-${id}`, name: `Moyen ${id}`, grade: '6a', setter: 'P', holds: [], authorId: 'x', ratingCount: 3, ratingSum: 3, createdAt: 3 });
  await seed('blocs', `rare-${id}`, { gymId: id, wallId: `w-${id}`, name: `Rare ${id}`, grade: '6a', setter: 'P', holds: [], authorId: 'x', ratingCount: 2, ratingSum: 6, createdAt: 4 });
  await page.goto(`/#/bloc/b-${id}`);
  await login(page, ALICE);
  await vote(page, 3);
  await pressed(page, 3);
  await expect(page.locator('#dRate')).toContainText('1 avis, note affichée à partir de 3');
  await login(page, BOB);
  await expect(page.locator('#dRate [data-vote="3"]')).toHaveAttribute('aria-pressed', 'false');
  await vote(page, 2);
  await pressed(page, 2);
  await expect(page.locator('#dRate')).toContainText('2 avis, note affichée à partir de 3');
  await login(page, CAROLE);
  await expect(page.locator('#dRate [data-vote="2"]')).toHaveAttribute('aria-pressed', 'false');
  await vote(page, 2);
  await expect(page.locator('#dRate .rating')).toHaveText('★★☆ 2,3 · 3 avis');

  await page.locator('#tabPlace').click();
  await page.locator('[data-f="best"]').click();
  const names = page.locator('#list .card .name');
  await expect(names).toHaveText([`Noté ${id}`, `Moyen ${id}`, `Rare ${id}`]);
  await expect(page.locator('#list .card .rating').first()).toHaveText('★★☆ 2,3 · 3 avis');
  await expect(page.locator('#list .card', { hasText: `Rare ${id}` }).locator('.rating')).toHaveCount(0);
});

test("un grimpeur change puis retire sa note : elle repasse sous le seuil et disparaît", async ({ page }, testInfo) => {
  const id = uid(testInfo);
  await seedGym(id);
  await seed('blocs', `b-${id}`, { gymId: id, wallId: `w-${id}`, name: `Noté ${id}`, grade: '6a', setter: 'Paul', holds: [], authorId: 'autre', ratingCount: 2, ratingSum: 4, createdAt: 1 });
  await page.goto(`/#/bloc/b-${id}`);
  await login(page, ALICE);
  await vote(page, 1);
  await expect(page.locator('#dRate .rating')).toHaveText('★★☆ 1,7 · 3 avis');
  await vote(page, 3);
  await expect(page.locator('#dRate .rating')).toHaveText('★★☆ 2,3 · 3 avis');
  await vote(page, '');
  await expect(page.locator('#dRate')).toContainText('2 avis, note affichée à partir de 3');
  await expect(page.locator('#dRate .rating')).toHaveCount(0);
});

test('un invité voit les notes, et toucher les étoiles ouvre la connexion', async ({ page }, testInfo) => {
  const id = uid(testInfo);
  await seedGym(id);
  await seed('blocs', `b-${id}`, { gymId: id, wallId: `w-${id}`, name: `Noté ${id}`, grade: '6a', setter: 'Paul', holds: [], authorId: 'autre', ratingCount: 3, ratingSum: 9, createdAt: 1 });
  await page.goto(`/#/bloc/b-${id}`);
  await expect(page.locator('#dRate .rating')).toHaveText('★★★ 3,0 · 3 avis');
  await vote(page, 2);
  await expect(page.locator('[data-login-go]')).toBeVisible();
});

test("l'auteur ne voit pas les étoiles sur son contenu, et un bloc archivé garde sa note sans pouvoir être noté", async ({ page }, testInfo) => {
  const id = uid(testInfo);
  await seedGym(id);
  await seed('blocs', `old-${id}`, { gymId: id, wallId: `oldw-${id}`, name: `Ancien ${id}`, grade: '6a', setter: 'P', holds: [], authorId: 'autre', ratingCount: 3, ratingSum: 6, createdAt: 1 });
  await seed('walls', `oldw-${id}`, { gymId: id, name: 'Ancien', image: '', w: 100, h: 100, active: false, createdAt: 1 });
  await page.goto(`/#/bloc/old-${id}`);
  await login(page, ALICE);
  await expect(page.locator('#dRate .rating')).toHaveText('★★☆ 2,0 · 3 avis');
  await expect(page.locator('#dRate [data-vote]')).toHaveCount(0);

  const me = await page.evaluate(() => BT.user().uid);
  await seed('blocs', `mine-${id}`, { gymId: id, wallId: `w-${id}`, name: `Mien ${id}`, grade: '6a', setter: 'A', holds: [], authorId: me, createdAt: 1 });
  await page.goto(`/#/bloc/mine-${id}`);
  await expect(page.locator('#dName')).toHaveText(`Mien ${id}`);
  await expect(page.locator('#dRate [data-vote]')).toHaveCount(0);
});

test('une voie se note aussi, et le tri « Mieux notés » classe les voies', async ({ page }, testInfo) => {
  const id = uid(testInfo);
  await seed('secteurs', id, { name: `Secteur ${id}`, region: '', createdAt: 1 });
  const base = { secteurId: id, grade: '6a', w: 100, h: 100, anchors: [], authorId: 'autre', addedBy: 'P', createdAt: 1 };
  await seed('voies', `a-${id}`, { ...base, name: `Aaa ${id}` });
  await seed('voies', `z-${id}`, { ...base, name: `Zzz ${id}`, ratingCount: 3, ratingSum: 9 });
  await page.goto(`/#/secteur/${id}`);
  await login(page, ALICE);
  await page.locator('.card .name', { hasText: `Aaa ${id}` }).click();
  await page.locator('#ovRate [data-vote="3"]').click();
  await expect(page.locator('#ovRate')).toContainText('1 avis, note affichée à partir de 3');
  await page.locator('#tabPlace').click();
  await page.locator('#oBest').click();
  await expect(page.locator('#oListEl .card .name')).toHaveText([`Zzz ${id}`, `Aaa ${id}`]);
});
