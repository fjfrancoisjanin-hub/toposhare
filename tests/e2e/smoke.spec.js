// Parcours de base de TopoShare en vue mobile, contre les émulateurs (base vide, aucune donnée de prod).
const { test, expect } = require('./fixtures');

test("l'appli s'ouvre avec la barre d'onglets", async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('TopoShare');
  await expect(page.locator('#tabList')).toBeVisible();
  await expect(page.locator('#tabOut')).toBeVisible();
  await expect(page.locator('#tabCreate')).toBeVisible();
});

test("l'onglet Falaise s'active", async ({ page }) => {
  await page.goto('/');
  await page.locator('#tabOut').click();
  await expect(page.locator('#tabOut')).toHaveAttribute('aria-current', 'page');
  await page.locator('#tabList').click();
  await expect(page.locator('#tabList')).toHaveAttribute('aria-current', 'page');
});

test('le lien « Donnez votre avis » ouvre le formulaire', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-feedback]').first().click();
  await expect(page.locator('textarea').first()).toBeVisible();
});

test('la page de suivi /admin se charge', async ({ page }) => {
  await page.goto('/admin');
  await expect(page).toHaveTitle('Suivi TopoShare');
});
