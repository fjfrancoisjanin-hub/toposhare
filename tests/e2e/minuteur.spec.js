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

test('séances enregistrées : enregistrer, charger, mettre à jour, supprimer, retrouver après rechargement', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  await expect(page.locator('#tmPres')).toBeEmpty();
  // Les réglages de l'exemple : 10 s d'effort, 6 s de repos, 6 répétitions, 3 séries, 60 s entre séries.
  await set(page, 'effort', 10); await set(page, 'rest', 6); await set(page, 'reps', 6); await set(page, 'sets', 3); await set(page, 'setRest', 60);
  await page.locator('#tmSaveOpen').click();
  await expect(page.locator('#tmName')).toHaveValue('10/6 × 6 (×3)');   // nom proposé, modifiable
  await page.locator('#tmName').fill('Pan Güllich');
  await page.locator('#tmName').press('Enter');
  await expect(page.locator('#tmMsg')).toHaveText('Séance enregistrée');
  const row = page.locator('#tmPres .tm-pre');
  await expect(row).toHaveCount(1);
  await expect(row).toContainText('Pan Güllich');
  await expect(row).toContainText('10 s / 6 s × 6 · 3 séries · 1 min');
  await expect(page.locator('.tm-pre-load')).toHaveAttribute('aria-current', 'true');
  // On change les réglages : la séance n'est plus « la courante » ; un tap la recharge.
  await set(page, 'effort', 7); await set(page, 'sets', 1);
  await expect(page.locator('.tm-pre-load')).toHaveAttribute('aria-current', 'false');
  await page.locator('.tm-pre-load').click();
  for (const [k, v] of [['effort', 10], ['rest', 6], ['reps', 6], ['sets', 3], ['setRest', 60]]) await expect(page.locator(`#tm-${k}`)).toHaveValue(String(v));
  await expect(page.locator('.tm-pre-load')).toHaveAttribute('aria-current', 'true');
  // 3 × (6 × 10 s + 5 × 6 s) + 2 × 60 s = 390 s
  await expect(page.locator('#tmTotal')).toHaveText('6 min 30 s');
  // Un même nom (majuscules ignorées) met à jour au lieu de dupliquer.
  await set(page, 'effort', 12);
  await page.locator('#tmSaveOpen').click();
  await page.locator('#tmName').fill('pan güllich');
  await page.locator('#tmSaveOk').click();
  await expect(page.locator('#tmMsg')).toHaveText('Séance mise à jour');
  await expect(row).toHaveCount(1);
  await expect(row).toContainText('12 s / 6 s × 6');
  // Une seconde séance, au nom proposé ; Annuler n'enregistre rien.
  await set(page, 'effort', 7); await set(page, 'rest', 3); await set(page, 'sets', 1);
  await page.locator('#tmSaveOpen').click();
  await page.locator('#tmSaveNo').click();
  await expect(row).toHaveCount(1);
  await page.locator('#tmSaveOpen').click();
  await page.locator('#tmSaveOk').click();
  await expect(row).toHaveCount(2);
  await expect(row.nth(1)).toContainText('7/3 × 6');
  // À 390 px, rien ne déborde avec des séances.
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  // Rechargement : les séances sont toujours là.
  await page.reload();
  await page.locator('#hTimer').click();
  await expect(row).toHaveCount(2);
  await row.first().locator('.tm-pre-load').click();
  await expect(page.locator('#tm-effort')).toHaveValue('12');
  // Supprimer demande une confirmation : un premier tap arme, le second supprime.
  await row.first().locator('.tm-pre-del').click();
  await expect(row).toHaveCount(2);
  await expect(row.first().locator('.tm-pre-del')).toHaveText('Supprimer');
  await row.first().locator('.tm-pre-del').click();
  await expect(row).toHaveCount(1);
  await expect(row).toContainText('7/3 × 6');
});

test('une séance enregistrée se lance avec ses réglages', async ({ page }) => {
  test.setTimeout(45000);
  await page.addInitScript(() => { if (!localStorage.getItem('ts-timer-presets')) localStorage.setItem('ts-timer-presets', JSON.stringify([{ id: 'p1', name: 'Courte', effort: 1, rest: 0, reps: 1, sets: 2, setRest: 1 }])); });
  await open(page);
  await page.locator('.tm-pre-load').click();
  await expect(page.locator('#tmTotal')).toHaveText('3 s');
  await page.locator('#tmGo').click();
  await expect(page.locator('#tmRun')).toHaveAttribute('data-phase', 'effort', { timeout: 9000 });
  await expect(page.locator('#tmPos')).toContainText('Série 1 / 2');
  await page.locator('#tmStop').click();
});

test('20 séances au plus ; en anglais, textes traduits mais pas le nom choisi', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('ts-lang', 'en');
    if (!localStorage.getItem('ts-timer-presets')) localStorage.setItem('ts-timer-presets', JSON.stringify(Array.from({ length: 20 }, (_, i) => ({ id: `p${i}`, name: i === 0 ? 'Ma séance' : `S${i}`, effort: 7, rest: 3, reps: 6, sets: 3, setRest: 180 }))));
  });
  await open(page);
  await expect(page.locator('#tmPres .label')).toHaveText('My sessions');
  await expect(page.locator('#tmSaveOpen')).toHaveText('Save this session');
  await expect(page.locator('.tm-pre').first()).toContainText('Ma séance');            // le nom saisi n'est jamais traduit
  await expect(page.locator('.tm-pre').first()).toContainText('7 s / 3 s × 6 · 3 sets · 3 min');
  await page.locator('#tmSaveOpen').click();
  await expect(page.locator('#tmName')).toHaveAttribute('placeholder', 'Session name');
  await page.locator('#tmName').fill('Une de trop');
  await page.locator('#tmSaveOk').click();
  await expect(page.locator('#tmMsg')).toHaveText('20 sessions at most.');
  await expect(page.locator('.tm-pre')).toHaveCount(20);
  await page.evaluate(() => TS_I18N.set('es'));
  await expect(page.locator('#tmPres .label')).toHaveText('Mis sesiones');
  await expect(page.locator('.tm-pre').first()).toContainText('3 series');
});
