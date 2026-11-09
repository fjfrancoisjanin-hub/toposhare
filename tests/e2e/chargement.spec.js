// Écran de chargement : slogan, attente des données, miniature d'accueil prête à l'arrivée, message de connexion lente.
const { test, expect } = require('./fixtures');
const { seed } = require('./helpers');

const uid = testInfo => `${testInfo.project.name}-${Date.now()}`;
const FIRESTORE = /127\.0\.0\.1:8085/;
const splashGone = page => page.waitForFunction(() => !document.getElementById('splash'));

// Retient les réponses de Firestore jusqu'à `release()`.
async function holdFirestore(page) {
  let release; const gate = new Promise(r => { release = r; });
  await page.route(FIRESTORE, async route => { await gate; try { await route.continue(); } catch { /* page fermée */ } });
  return release;
}

test("l'écran de chargement affiche le slogan et reste tant que les données n'arrivent pas", async ({ page }, testInfo) => {
  const id = uid(testInfo);
  // Page vierge : aucun cache sur le téléphone, les données viennent du réseau.
  await seed('gyms', `g-${id}`, { name: `Salle ${id}`, city: 'Albi', createdAt: 1 });
  await seed('secteurs', `s-${id}`, { name: `Anglars ${id}`, region: '', createdAt: 1 });
  const release = await holdFirestore(page);
  await page.goto('/');
  await expect(page.locator('#splash')).toContainText('Par les grimpeurs, pour les grimpeurs.');
  await expect(page.locator('#splash .en')).toHaveText('By climbers, for climbers.');
  await expect(page.locator('#splMsg')).not.toHaveText('');
  // Au-delà de l'ancien délai de 2,6 s : l'écran est toujours là, aucune appli vide derrière.
  await page.waitForTimeout(3200);
  await expect(page.locator('#splash')).toBeVisible();
  await expect(page.locator('#splSlow')).toBeHidden();
  release();
  await splashGone(page);
  await expect(page.locator('#hEntrySalles')).toBeVisible();
  await expect(page.locator('#hEntrySalles')).toContainText('salle');
});

test('en anglais, le slogan est « By climbers, for climbers. »', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('ts-lang', 'en'));
  const release = await holdFirestore(page);
  await page.goto('/');
  await expect(page.locator('#splash')).toContainText('By climbers, for climbers.');
  await expect(page.locator('#splash')).not.toContainText('Par les grimpeurs');
  release();
});

test('après 12 s, un message propose de continuer ou de réessayer', async ({ page }) => {
  await page.clock.install();
  const release = await holdFirestore(page);
  await page.goto('/');
  await expect(page.locator('#splSlow')).toBeHidden();
  await page.clock.fastForward(13_000);
  await expect(page.locator('#splSlow')).toBeVisible();
  await expect(page.locator('#splash')).toContainText('Connexion lente');
  await page.locator('#splGo').click();
  await page.clock.fastForward(1_000);
  await splashGone(page);
  release();
});

test("la miniature de la carte « Reprendre » est déjà là quand l'écran de chargement disparaît", async ({ page }, testInfo) => {
  const id = uid(testInfo);
  await page.goto('/');
  const b64 = await page.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 40; c.height = 30; const x = c.getContext('2d'); x.fillStyle = '#3a6'; x.fillRect(0, 0, 40, 30);
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.9));
    return new Promise(r => { const f = new FileReader(); f.onload = () => r(String(f.result).split(',')[1]); f.readAsDataURL(blob); });
  });
  await seed('secteurs', id, { name: `Secteur ${id}`, region: '', createdAt: 1 });
  await seed('voies', `v-${id}`, { secteurId: id, name: `Voie ${id}`, grade: '6a', w: 400, h: 300, image: `photo:p-${id}`, anchors: [{ x: 0.5, y: 0.5, t: 'bolt' }], authorId: 'autre', addedBy: 'Paul', methodCount: 0, createdAt: 1 });
  await seed('miniatures', `p-${id}`, { data: b64, w: 40, h: 30, mime: 'image/jpeg', authorId: 'autre', createdAt: 1 });
  await page.addInitScript(i => { localStorage.setItem('pan-sect', i); localStorage.setItem('ts-recents', JSON.stringify([{ type: 'secteur', id: i, t: Date.now() }])); }, id);
  await page.reload();
  await splashGone(page);
  // Lecture immédiate, sans attente : la miniature était prête avant la sortie de l'écran de chargement.
  expect(await page.locator('#hResume img').getAttribute('src')).toMatch(/^blob:/);
});

test("sans miniature (photo d'avant), l'écran de chargement n'attend pas", async ({ page }, testInfo) => {
  const id = uid(testInfo);
  await page.goto('/');
  await seed('secteurs', id, { name: `Secteur ${id}`, region: '', createdAt: 1 });
  await seed('voies', `v-${id}`, { secteurId: id, name: `Voie ${id}`, grade: '6a', w: 400, h: 300, image: `photo:p-${id}`, anchors: [{ x: 0.5, y: 0.5, t: 'bolt' }], authorId: 'autre', addedBy: 'Paul', methodCount: 0, createdAt: 1 });
  await page.addInitScript(i => { localStorage.setItem('pan-sect', i); localStorage.setItem('ts-recents', JSON.stringify([{ type: 'secteur', id: i, t: Date.now() }])); }, id);
  const t0 = Date.now();
  await page.reload();
  await splashGone(page);
  expect(Date.now() - t0).toBeLessThan(3500);
  await expect(page.locator('#hResume')).toContainText(`Secteur ${id}`);
});
