// Minuteur de poutre : un petit outil à part (effort, repos, répétitions, séries), ouvert depuis l'accueil, sans lien avec les salles ni les falaises.
const { test, expect } = require('./fixtures');

const open = async page => {
  await page.goto('/');
  await page.locator('#hTimer').click();
  await expect(page.locator('#tmSetup')).toBeVisible();
};
const set = async (page, k, v) => { await page.locator(`#tm-${k}`).fill(String(v)); await page.locator(`#tm-${k}`).blur(); };

test('depuis l\'accueil : réglages par défaut (répéteurs 7 s / 3 s × 6, 3 séries) et durée totale', async ({ page }) => {
  await open(page);
  await expect(page.locator('#vTimer h1')).toHaveText('Minuteur poutre');
  for (const [k, v] of [['effort', 7], ['rest', 3], ['reps', 6], ['sets', 3], ['setRest', 180]]) await expect(page.locator(`#tm-${k}`)).toHaveValue(String(v));
  // 3 × (6 × 7 s + 5 × 3 s) + 2 × 180 s = 531 s
  await expect(page.locator('#tmTotal')).toHaveText('8 min 51 s');
  // ＋ / − : un pas à la fois (5 s pour le repos entre séries) ; la durée totale suit.
  await page.locator('button[data-k="effort"][data-d="1"]').click();
  await expect(page.locator('#tm-effort')).toHaveValue('8');
  await page.locator('button[data-k="setRest"][data-d="-1"]').click();
  await expect(page.locator('#tm-setRest')).toHaveValue('175');
  // Les bornes sont respectées (effort : 1 s au moins).
  await set(page, 'effort', 0);
  await expect(page.locator('#tm-effort')).toHaveValue('1');
  // Retour à l'accueil.
  await page.locator('[data-tm-home]').click();
  await expect(page.locator('#hTimer')).toBeVisible();
});

test('une séance complète : préparation, effort, repos, repos entre séries, fin ; pause qui fige ; sons joués', async ({ page }) => {
  test.setTimeout(60000);
  await open(page);
  await set(page, 'effort', 1); await set(page, 'rest', 1); await set(page, 'reps', 2); await set(page, 'sets', 2); await set(page, 'setRest', 1);
  // 2 × (2 × 1 + 1) + 1 = 7 s
  await expect(page.locator('#tmTotal')).toHaveText('7 s');
  // On note chaque changement de phase.
  await page.evaluate(() => {
    window.__seq = [];
    const r = document.getElementById('tmRun');
    new MutationObserver(() => { const s = `${r.dataset.phase}:${r.dataset.set || ''}.${r.dataset.rep || ''}`; if (window.__seq[window.__seq.length - 1] !== s) window.__seq.push(s); })
      .observe(r, { attributes: true, attributeFilter: ['data-phase', 'data-set', 'data-rep'] });
  });
  await page.locator('#tmGo').click();
  const run = page.locator('#tmRun');
  await expect(run).toBeVisible();
  await expect(run).toHaveAttribute('data-phase', 'prep');
  await expect(page.locator('#tmPhase')).toHaveText('Préparation');
  await expect(page.locator('#tmDigits')).toHaveText(/^[1-5]$/);
  // Pause pendant la préparation : le chiffre ne bouge plus ; Reprendre relance.
  await page.locator('#tmPause').click();
  await expect(page.locator('#tmPause')).toHaveText('Reprendre');
  const frozen = await page.locator('#tmDigits').textContent();
  await page.waitForTimeout(1500);
  await expect(page.locator('#tmDigits')).toHaveText(frozen);
  await expect(run).toHaveAttribute('data-phase', 'prep');
  await page.locator('#tmPause').click();
  await expect(page.locator('#tmPause')).toHaveText('Pause');
  await expect(run).toHaveAttribute('data-phase', 'effort', { timeout: 9000 });
  await expect(page.locator('#tmPhase')).toHaveText('Effort');
  await expect(page.locator('#tmPos')).toContainText('Série 1 / 2');
  await expect(page.locator('#tmPos')).toContainText('Répétition 1 / 2');
  await expect(page.locator('#tmNext')).toContainText('Ensuite : Repos');
  await expect(run).toHaveAttribute('data-phase', 'done', { timeout: 15000 });
  await expect(page.locator('#tmPhase')).toHaveText('Séance terminée');
  expect(await page.evaluate(() => window.__seq)).toEqual(['prep:1.1', 'effort:1.1', 'rest:1.1', 'effort:1.2', 'setrest:1.2', 'effort:2.1', 'rest:2.1', 'effort:2.2', 'done:2.2']);
  // Un son (ou plus) a bien été émis, et le bouton son coupe les suivants.
  expect(await page.evaluate(() => window.TSTimer.beeps)).toBeGreaterThan(5);
  // Recommencer relance une séance ; Arrêter revient aux réglages.
  await page.locator('#tmPause').click();
  await expect(run).toHaveAttribute('data-phase', 'prep');
  await page.locator('#tmStop').click();
  await expect(page.locator('#tmSetup')).toBeVisible();
  await expect(run).toBeHidden();
});

test('les réglages sont gardés au rechargement, et le bouton son se coupe', async ({ page }) => {
  await open(page);
  await set(page, 'effort', 10); await set(page, 'reps', 4);
  await page.reload();
  await page.locator('#hTimer').click();
  await expect(page.locator('#tm-effort')).toHaveValue('10');
  await expect(page.locator('#tm-reps')).toHaveValue('4');
  await page.locator('#tmGo').click();
  await expect(page.locator('#tmSnd')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#tmSnd').click();
  await expect(page.locator('#tmSnd')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#tmSnd')).toHaveAttribute('aria-label', 'Son coupé');
  const before = await page.evaluate(() => window.TSTimer.beeps);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.TSTimer.beeps)).toBe(before);   // plus aucun son
  await page.locator('#tmStop').click();
});

test('en anglais et en espagnol, tout le minuteur est traduit', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('ts-lang', 'en'));
  await open(page);
  await expect(page.locator('#vTimer h1')).toHaveText('Hangboard timer');
  await expect(page.locator('#tmSetup')).toContainText('Rest between sets');
  await expect(page.locator('#tmSetup')).toContainText('Total time');
  await expect(page.locator('#tmGo')).toHaveText('Start');
  await expect(page.locator('#tmSetup')).not.toContainText(/Effort|Répétitions|Lancer|Réglez/);
  await page.locator('#tmGo').click();
  await expect(page.locator('#tmPhase')).toHaveText('Get ready');
  await expect(page.locator('#tmPause')).toHaveText('Pause');
  await expect(page.locator('#tmStop')).toHaveText('Stop');
  await page.locator('#tmStop').click();
  await page.evaluate(() => TS_I18N.set('es'));
  await expect(page.locator('#vTimer h1')).toHaveText('Temporizador de hangboard');
  await expect(page.locator('#tmGo')).toHaveText('Empezar');
  await expect(page.locator('#tmSetup')).toContainText('Descanso entre series');
});

test('à 390 px : rien ne déborde, ni dans les réglages ni pendant la séance ; la barre du bas n\'est pas touchée', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(await overflow()).toBeLessThanOrEqual(0);
  await expect(page.locator('#tabHome')).toHaveAttribute('aria-current', 'page');
  for (const t of ['#tabSalles', '#tabFalaises', '#tabCreate']) await expect(page.locator(t)).toBeVisible();
  await page.locator('#tmGo').click();
  const box = await page.locator('#tmRun').boundingBox();
  expect(box.width).toBeLessThanOrEqual(390);
  expect(await overflow()).toBeLessThanOrEqual(0);
  const bottom = await page.locator('#tmStop').boundingBox();
  expect(bottom.y + bottom.height).toBeLessThanOrEqual(844);
  await page.locator('#tmStop').click();
});
