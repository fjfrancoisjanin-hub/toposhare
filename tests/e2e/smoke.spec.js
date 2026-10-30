// Parcours de base de TopoShare en vue mobile, contre les émulateurs (base vide, aucune donnée de prod).
const { test, expect } = require('./fixtures');

test("l'appli s'ouvre sur l'accueil, avec sa barre", async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('TopoShare');
  await expect(page.locator('#tabHome')).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('#hSearch')).toBeVisible();
  await expect(page.locator('#tabCreate')).toBeVisible();
});

test('le lien « Donnez votre avis » ouvre le formulaire', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-feedback]').first().click();
  await expect(page.locator('#fbText')).toBeVisible();
});

test('la page de suivi /admin se charge', async ({ page }) => {
  await page.goto('/admin');
  await expect(page).toHaveTitle('Suivi TopoShare');
});
