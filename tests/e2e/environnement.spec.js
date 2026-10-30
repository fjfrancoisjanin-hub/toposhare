// Bandeau de l'environnement de test : visible seulement hors prod.
const { test, expect } = require('./fixtures');

async function asTestEnv(page, pr) {
  await page.route('**/config.js', async route => {
    const res = await route.fetch();
    await route.fulfill({ response: res, body: `${await res.text()}\nwindow.TS_TEST_ENV = true; window.TS_PREVIEW_PR = "${pr}";` });
  });
}

test("le bandeau n'apparaît pas hors environnement de test", async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#tabList')).toBeVisible();
  await expect(page.locator('#tsEnvBanner')).toHaveCount(0);
});

test("le bandeau indique l'environnement de test et le numéro de PR", async ({ page }) => {
  await asTestEnv(page, '14');
  await page.goto('/');
  await expect(page.locator('#tsEnvBanner')).toHaveText('Environnement de test · PR #14');
  await page.goto('/admin');
  await expect(page.locator('#tsEnvBanner')).toHaveText('Environnement de test · PR #14');
});

test('le bandeau est traduit', async ({ page }) => {
  await asTestEnv(page, '14');
  await page.addInitScript(() => localStorage.setItem('ts-lang', 'en'));
  await page.goto('/');
  await expect(page.locator('#tsEnvBanner')).toHaveText('Test environment · PR #14');
});
