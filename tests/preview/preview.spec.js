// Contrôle lancé par la CI après chaque déploiement : le site de test en ligne parle au projet de test, et jamais à la prod.
const { test, expect } = require('@playwright/test');

test('la prévisualisation utilise le projet de test, avec le jeu de données fictif', async ({ page }) => {
  const prod = [];
  page.on('request', r => { if (decodeURIComponent(r.url()).includes('betatheque')) prod.push(r.url()); });
  await page.goto('/#/salle/salle-test');
  await page.waitForFunction(() => window.BT);
  expect(await page.evaluate(() => BT.fs.app.options.projectId)).toBe('toposhare-test');
  await expect(page.locator('#tsEnvBanner')).toHaveText(`Environnement de test · PR #${process.env.PREVIEW_PR}`);
  await expect(page.getByText('Bloc de test A')).toBeVisible();
  expect(prod, 'requêtes vers la prod').toEqual([]);
});
