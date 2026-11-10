// Séquences main / pied : « Pieds dans l'ordre » sur les blocs (anciens blocs : pieds imposés). Deux tracés séparés : trait blanc entre les mains, pointillé jaune entre les pieds, jamais de trait entre une main et un pied.
const { test, expect } = require('./fixtures');
const { ALICE, login, seed } = require('./helpers');

const uid = testInfo => `${testInfo.project.name}-${Date.now()}`;
const SEQ = [{ t: 'start', x: 0.3, y: 0.85 }, { t: 'hand', x: 0.4, y: 0.65 }, { t: 'foot', x: 0.35, y: 0.75 }, { t: 'foot', x: 0.45, y: 0.7 }, { t: 'hand', x: 0.55, y: 0.45 }, { t: 'top', x: 0.5, y: 0.15 }];
const footLines = (page, root) => page.locator(`${root} svg line[stroke="var(--h-foot)"]`);
const handLines = (page, root) => page.locator(`${root} svg line[stroke="#fff"]`);

async function seedSalle(id) {
  await seed('gyms', id, { name: `Salle ${id}`, city: 'Albi', createdAt: 1 });
  await seed('walls', `w-${id}`, { gymId: id, name: 'Spray', image: '', w: 100, h: 100, active: true, createdAt: 1 });
}
async function publish(page, name, { seq = true } = {}) {
  await page.locator('#tabCreate').click();
  await page.locator('#fName').fill(name);
  await page.locator('#fSetter').fill('Alice');
  await page.evaluate(h => { state.holds = h.map(x => ({ ...x })); renderEditor(); }, SEQ);
  if (!seq) await page.locator('#fSeq').uncheck();
  await page.locator('#fSave').click();
  await expect(page.locator('#dName')).toHaveText(name);
}
const next = async page => { await page.locator('#rpNext').click(); };
// Ces tests vérifient les tracés pas à pas : on y garde le replay « Tout depuis le début » (la fenêtre de 5 prises a ses tests dans replay-fenetre.spec.js).
test.beforeEach(async ({ page }) => { await page.addInitScript(() => localStorage.setItem('ts-replay-win', 'all')); });

test('pieds dans l\'ordre par défaut : le tracé distingue main (trait plein) et pied (pointillé jaune), et le replay déroule la séquence', async ({ page }, testInfo) => {
  const id = uid(testInfo);
  await seedSalle(id);
  await page.goto(`/#/salle/${id}`);
  await login(page, ALICE);
  await page.locator('#tabCreate').click();
  await expect(page.locator('#fSeq')).toBeChecked();
  // L'éditeur montre déjà les deux tracés : 3 traits entre les mains (départ, main 1, main 2, top), 1 pointillé entre les deux pieds.
  // Aucun trait ne relie une main à un pied : avec 2 mains entre lesquelles s'intercalent 2 pieds, on n'a pas 5 segments.
  await page.evaluate(h => { state.holds = h.map(x => ({ ...x })); renderEditor(); }, SEQ);
  await expect(handLines(page, '#editWall')).toHaveCount(3);
  await expect(footLines(page, '#editWall')).toHaveCount(1);
  await page.locator('#tabSalles').click();
  await publish(page, `Séquence ${id}`);
  await expect(page.locator('#dSeq')).toContainText('2 pieds dans l\'ordre');
  await expect(handLines(page, '#dWall')).toHaveCount(3);
  await expect(footLines(page, '#dWall')).toHaveCount(1);
  await expect(page.locator('#dWall svg')).toContainText('P1');
  await expect(page.locator('#dWall svg')).toContainText('P2');
  expect(await page.evaluate(() => state.blocs[0].seq)).toBe('ordered');

  await page.locator('#dReplay').click();
  const cap = page.locator('#rpCap');
  await expect(cap).toContainText('Départ');
  await next(page); await expect(cap).toContainText('Move 1 / 2');
  await expect(page.locator('#fsWall svg')).not.toContainText('P1');
  await next(page); await expect(cap).toContainText('Pied 1 / 2');
  await expect(page.locator('#fsWall svg')).toContainText('P1');
  await expect(page.locator('#fsWall svg')).not.toContainText('P2');
  await expect(footLines(page, '#fsWall')).toHaveCount(0);
  await expect(handLines(page, '#fsWall')).toHaveCount(1);
  await next(page); await expect(cap).toContainText('Pied 2 / 2');
  await expect(footLines(page, '#fsWall')).toHaveCount(1);
  await expect(handLines(page, '#fsWall')).toHaveCount(1);
  await next(page); await expect(cap).toContainText('Move 2 / 2');
  await expect(handLines(page, '#fsWall')).toHaveCount(2);
  await expect(footLines(page, '#fsWall')).toHaveCount(1);
  await next(page); await expect(cap).toContainText('Top');
});

test('décocher « Pieds dans l\'ordre » : pas de tracé de pied, pieds imposés dès le départ', async ({ page }, testInfo) => {
  const id = uid(testInfo);
  await seedSalle(id);
  await page.goto(`/#/salle/${id}`);
  await login(page, ALICE);
  await page.locator('#tabCreate').click();
  await page.evaluate(h => { state.holds = h.map(x => ({ ...x })); renderEditor(); }, SEQ);
  await page.locator('#fSeq').uncheck();
  await expect(footLines(page, '#editWall')).toHaveCount(0);
  await page.locator('#tabSalles').click();
  await publish(page, `Imposés ${id}`, { seq: false });
  await expect(page.locator('#dSeq')).toContainText('2 pieds imposés');
  await expect(footLines(page, '#dWall')).toHaveCount(0);
  await page.locator('#dReplay').click();
  await expect(page.locator('#rpCap')).toContainText('pieds imposés en jaune');
  await next(page); await expect(page.locator('#rpCap')).toContainText('Move 1 / 2');
  await next(page); await expect(page.locator('#rpCap')).toContainText('Move 2 / 2');
});

test('un ancien bloc (sans champ) garde ses pieds imposés, et on peut le passer « dans l\'ordre » en le modifiant', async ({ page: first, browser }, testInfo) => {
  const id = uid(testInfo);
  await first.goto('/');
  await login(first, ALICE);
  const me = await first.evaluate(() => BT.user().uid);
  await seedSalle(id);
  await seed('blocs', `old-${id}`, { gymId: id, wallId: `w-${id}`, name: `Ancien ${id}`, grade: '6a', setter: 'Alice', holds: SEQ, authorId: me, createdAt: 1 });
  // Contexte neuf : sans cache Firestore, la salle créée à l'instant est connue dès le lancement.
  const ctx = await browser.newContext(testInfo.project.use), page = await ctx.newPage();
  await page.goto(`/#/salle/${id}`);
  await login(page, ALICE);
  await page.locator('.card .name', { hasText: `Ancien ${id}` }).click();
  await expect(page.locator('#dSeq')).toContainText('2 pieds imposés');
  await expect(footLines(page, '#dWall')).toHaveCount(0);
  await page.locator('#dReplay').click();
  await expect(page.locator('#rpCap')).toContainText('pieds imposés en jaune');
  await page.locator('#fsClose').click();
  await page.locator('#dEdit').click();
  await expect(page.locator('#fSeq')).not.toBeChecked();
  await page.locator('#fSeq').check();
  await page.locator('#fSave').click();
  await expect(page.locator('#dSeq')).toContainText('2 pieds dans l\'ordre');
  await expect(footLines(page, '#dWall')).toHaveCount(1);
});

test('méthode de voie : trait plein vers une main, pointillé jaune vers un pied, dans l\'ordre', async ({ page }, testInfo) => {
  const id = uid(testInfo);
  await seed('secteurs', id, { name: `Secteur ${id}`, region: '', createdAt: 1 });
  await seed('voies', `v-${id}`, { secteurId: id, name: `Voie ${id}`, grade: '6a', w: 100, h: 100, image: '', anchors: [{ x: 0.5, y: 0.8, t: 'bolt' }], authorId: 'autre', addedBy: 'Paul', methodCount: 1, createdAt: 1 });
  await seed('methodes', `m-${id}`, { voieId: `v-${id}`, secteurId: id, authorId: 'autre', climber: 'Paul', steps: [{ t: 'hand', x: 0.4, y: 0.7 }, { t: 'foot', x: 0.35, y: 0.8 }, { t: 'foot', x: 0.45, y: 0.75 }, { t: 'hand', x: 0.5, y: 0.5 }], createdAt: 1 });
  await page.goto(`/#/voie/v-${id}`);
  await page.getByRole('button', { name: 'Méthode de Paul' }).click();
  await page.locator('[data-act="replay"]').click();
  const cap = page.locator('#rpCap');
  await expect(cap).toContainText('Main · move 1 / 4');
  await expect(footLines(page, '#fsWall')).toHaveCount(0);
  await next(page); await expect(cap).toContainText('Pied · move 2 / 4');
  await expect(footLines(page, '#fsWall')).toHaveCount(0); // premier pied : rien à relier, et jamais depuis la main
  await next(page); await expect(cap).toContainText('Pied · move 3 / 4');
  await expect(footLines(page, '#fsWall')).toHaveCount(1); // pied 1 → pied 2
  await expect(page.locator('#fsWall svg line[stroke="var(--h-hand)"]')).toHaveCount(0);
  await next(page); await expect(cap).toContainText('Main · move 4 / 4');
  await expect(footLines(page, '#fsWall')).toHaveCount(1);
  await expect(page.locator('#fsWall svg line[stroke="var(--h-hand)"]')).toHaveCount(1); // main 1 → main 2, en sautant les pieds
});

test('deux départs, deux mains, deux pieds, retour à une main puis un pied : deux tracés séparés, jamais de trait main-pied', async ({ page }, testInfo) => {
  const id = uid(testInfo);
  await seedSalle(id);
  await page.goto(`/#/salle/${id}`);
  await login(page, ALICE);
  await page.locator('#tabCreate').click();
  const holds = [
    { t: 'start', x: 0.25, y: 0.9 }, { t: 'start', x: 0.4, y: 0.9 },
    { t: 'hand', x: 0.35, y: 0.7 }, { t: 'hand', x: 0.55, y: 0.55 },
    { t: 'foot', x: 0.3, y: 0.8 }, { t: 'foot', x: 0.45, y: 0.75 },
    { t: 'hand', x: 0.6, y: 0.35 }, { t: 'foot', x: 0.55, y: 0.55 }, // un pied posé sur la prise de la seconde main
    { t: 'top', x: 0.5, y: 0.12 },
  ];
  await page.evaluate(h => { state.holds = h.map(x => ({ ...x })); renderEditor(); }, holds);
  // Mains : départs → main 1 → main 2 → main 3 → top = 4 traits. Pieds : pied 1 → pied 2 → pied 3 = 2 pointillés.
  await expect(handLines(page, '#editWall')).toHaveCount(4);
  await expect(footLines(page, '#editWall')).toHaveCount(2);
  // Chaque extrémité d'un pointillé de pied tombe sur un pied, jamais sur une main : on le vérifie sur les coordonnées.
  const bad = await page.evaluate(() => {
    const W = 100, svg = document.querySelector('#editWall svg'), feet = state.holds.filter(h => h.t === 'foot'), hands = state.holds.filter(h => h.t === 'hand');
    const near = (x, y, list) => list.some(h => Math.hypot(h.x * W - x, h.y * W - y) < 9);
    return [...svg.querySelectorAll('line[stroke="var(--h-foot)"]')].filter(l => {
      const a = [+l.getAttribute('x1'), +l.getAttribute('y1')], b = [+l.getAttribute('x2'), +l.getAttribute('y2')];
      return !(near(a[0], a[1], feet) && near(b[0], b[1], feet)) || (near(a[0], a[1], hands) && !near(a[0], a[1], feet));
    }).length;
  });
  expect(bad).toBe(0);
});
