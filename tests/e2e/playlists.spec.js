// Playlists : des listes de blocs et de voies propres à chaque utilisateur (plusieurs, un même circuit dans plusieurs), un bouton ＋ sur chaque
// bloc et chaque voie, un écran « Mes carnets » avec les favoris (salles et falaises), renommer, supprimer, retirer.
const { test, expect } = require('./fixtures');
const { login, seed } = require('./helpers');

const uid = testInfo => `${testInfo.project.name}-${Date.now()}`;
// Un compte par test : les carnets sont propres à chaque compte, et les émulateurs gardent les comptes d'un test à l'autre.
const who = id => ({ sub: `pl-${id}`, email: `pl-${id}@example.com`, name: 'Grimpeur Test' });
const HOLDS = [{ t: 'start', x: 0.4, y: 0.8 }, { t: 'hand', x: 0.5, y: 0.5 }, { t: 'top', x: 0.5, y: 0.2 }];

async function seedAll(id) {
  await seed('gyms', id, { name: `Salle ${id}`, city: 'Albi', createdAt: 1 });
  await seed('walls', `w-${id}`, { gymId: id, name: 'Spray', image: '', w: 100, h: 100, active: true, createdAt: 1 });
  await seed('blocs', `b-${id}`, { gymId: id, wallId: `w-${id}`, name: `Bloc ${id}`, grade: '6a', setter: 'Paul', holds: HOLDS, authorId: 'autre', createdAt: 1 });
  await seed('secteurs', id, { name: `Secteur ${id}`, region: 'Saint-Antonin-Noble-Val (82)', createdAt: 1 });
  await seed('voies', `v-${id}`, { secteurId: id, name: `Voie ${id}`, grade: '7a', w: 100, h: 100, image: '', anchors: [], authorId: 'autre', addedBy: 'Paul', methodCount: 0, createdAt: 1 });
}
const docs = page => page.evaluate(() => BT.fs.collection('data/users/' + BT.user().uid).get().then(s => s.docs.map(d => ({ id: d.id, ...d.data() })).filter(d => d.kind === 'playlist')));
async function createFromSheet(page, name) {
  await page.locator('#dPlus').click();
  await page.locator('#plNewName').fill(name);
  await page.locator('[data-pl-create]').click();
  await expect(page.locator('#sheetBg')).toBeHidden();
}

test('un invité qui touche ＋ est invité à se connecter', async ({ page }, testInfo) => {
  const id = uid(testInfo);
  await seedAll(id);
  await page.goto(`/#/bloc/b-${id}`);
  // Invité, sans cache : l'écran de chargement attend les données (jusqu'à 12 s sur une CI lente).
  await expect(page.locator('#dName')).toHaveText(`Bloc ${id}`, { timeout: 20000 });
  await page.locator('#dPlus').click({ timeout: 20000 });
  await expect(page.locator('[data-login-go]')).toBeVisible();
  await expect(page.locator('#sheet')).toContainText('enregistrer dans un carnet');
});

test('un bloc se range dans plusieurs carnets, qu\'on crée depuis le ＋ ; on le retire d\'une seule', async ({ page }, testInfo) => {
  const id = uid(testInfo);
  await seedAll(id);
  await page.goto(`/#/bloc/b-${id}`);
  await login(page, who(id));
  await expect(page.locator('#dName')).toHaveText(`Bloc ${id}`);
  await expect(page.locator('#dPlus')).toHaveText('＋');
  await createFromSheet(page, 'Projets');
  await expect(page.locator('#dPlus')).toHaveText('✓');
  await expect(page.locator('#toast')).toContainText('Ajouté à « Projets »');
  await createFromSheet(page, 'Échauffement');
  await expect(page.locator('#dPlus')).toHaveAttribute('aria-label', 'Dans 2 carnets');
  let pls = await docs(page);
  expect(pls.map(p => [p.name, p.items.length]).sort()).toEqual([['Projets', 1], ['Échauffement', 1]].sort());
  expect(pls[0].items[0]).toMatchObject({ type: 'bloc', id: `b-${id}`, name: `Bloc ${id}`, grade: '6a' });
  // Retiré de « Projets » seulement : il reste dans « Échauffement ».
  await page.locator('#dPlus').click();
  await expect(page.locator('[data-pl-toggle]')).toHaveCount(2);
  await expect(page.locator('[data-pl-toggle][aria-pressed="true"]')).toHaveCount(2);
  await page.locator('[data-pl-toggle]', { hasText: 'Projets' }).click();
  await expect(page.locator('[data-pl-toggle]', { hasText: 'Projets' })).toHaveAttribute('aria-pressed', 'false');
  await page.locator('[data-close-sheet]').click();
  await expect(page.locator('#dPlus')).toHaveAttribute('aria-label', 'Dans 1 carnet');
  pls = await docs(page);
  expect(pls.find(p => p.name === 'Projets').items).toHaveLength(0);
  expect(pls.find(p => p.name === 'Échauffement').items).toHaveLength(1);
});

test('Mes carnets : lister, ouvrir, retirer un élément, renommer, supprimer (avec confirmation)', async ({ page }, testInfo) => {
  const id = uid(testInfo);
  await seedAll(id);
  await page.goto(`/#/bloc/b-${id}`);
  await login(page, who(id));
  await createFromSheet(page, 'Projets');
  await page.locator('#tabHome').click();
  await expect(page.locator('#hEntryPlaylists')).toContainText('1 carnet');
  // Icône de grimpe (mousqueton dessiné), plus de note de musique ni de mot « playlist ».
  await expect(page.locator('#hEntryPlaylists svg')).toBeVisible();
  await expect(page.locator('#hEntryPlaylists')).not.toContainText(/🎵|playlist/i);
  await page.locator('#hEntryPlaylists').click();
  await expect(page.locator('#plsBody [data-pl-open]')).toHaveCount(1);
  await expect(page.locator('#plsBody [data-pl-open]')).toContainText('1 élément');
  await page.locator('[data-pl-open]').click();
  await expect(page.locator('#plName')).toHaveText('Projets');
  await expect(page.locator('#plItems .plrow')).toContainText(`Bloc ${id}`);
  await expect(page.locator('#plItems .plrow')).toContainText('Bloc');
  // Ouvrir l'élément ramène à sa fiche.
  await page.locator('[data-pl-go]').click();
  await expect(page.locator('#vDetail')).toBeVisible(); // l'écran est réellement ouvert (le nom reste dans la page, masqué)
  await expect(page.locator('#dName')).toHaveText(`Bloc ${id}`);
  await page.locator('#tabHome').click();
  await page.locator('#hEntryPlaylists').click();
  await page.locator('[data-pl-open]').click();
  // Retirer, renommer, supprimer.
  await page.locator('[data-pl-rm]').click();
  await expect(page.locator('#plItems')).toContainText('Ce carnet est vide.');
  await page.locator('[data-pl-rename]').click();
  await page.locator('#plNameIn').fill('Saison 2026');
  await page.locator('[data-pl-save]').click();
  await expect(page.locator('#plName')).toHaveText('Saison 2026');
  await page.locator('[data-pl-del]').click();
  await expect(page.locator('[data-pl-del]')).toHaveText('Confirmer la suppression');
  await page.locator('[data-pl-del]').click();
  await expect(page.locator('#plsBody')).toContainText('Aucun carnet pour l\'instant');
  expect(await docs(page)).toHaveLength(0);
});

test('une voie se range aussi dans un carnet, et s\'ouvre depuis elle', async ({ page }, testInfo) => {
  const id = uid(testInfo);
  await seedAll(id);
  await page.goto(`/#/voie/v-${id}`);
  await login(page, who(id));
  await expect(page.locator('#ovName')).toHaveText(`Voie ${id}`);
  await page.locator('#ovPlus').click();
  await page.locator('#plNewName').fill('Falaise');
  await page.locator('[data-pl-create]').click();
  await expect(page.locator('#ovPlus')).toHaveText('✓');
  await page.locator('#tabHome').click();
  await page.locator('#hEntryPlaylists').click();
  await page.locator('[data-pl-open]').click();
  await expect(page.locator('#plItems .plrow')).toContainText(`Voie ${id}`);
  await expect(page.locator('#plItems .plrow')).toContainText('Voie');
  await page.locator('[data-pl-go]').click();
  await expect(page.locator('#oVoie')).toBeVisible();
  await expect(page.locator('#ovName')).toHaveText(`Voie ${id}`);
});

test('« Mes carnets » regroupe aussi les favoris : salles et falaises', async ({ page }, testInfo) => {
  const id = uid(testInfo);
  await seedAll(id);
  await page.goto(`/#/salle/${id}`);
  await login(page, who(id));
  await page.locator('[data-hero="salle"] [data-star]').click();
  await page.goto('about:blank');
  await page.goto(`/#/secteur/${id}`);
  await page.locator('[data-hero="secteur"] [data-star]').click();
  await page.locator('[data-hero="secteur"] [data-home]').click();
  await page.locator('#hEntryPlaylists').click();
  await expect(page.locator('#plsBody')).toContainText('Favoris');
  await expect(page.locator('#plsBody')).toContainText(`Salle ${id}`);
  await expect(page.locator('#plsBody')).toContainText(`Secteur ${id}`);
  await page.locator('#plsBody [data-go^="secteur:"]').click();
  await expect(page.locator('[data-hero="secteur"] b')).toHaveText(`Secteur ${id}`);
});

test('les carnets sont gardés après rechargement, et un invité qui touche l\'entrée est invité à se connecter', async ({ page }, testInfo) => {
  const id = uid(testInfo);
  await seedAll(id);
  await page.goto(`/#/bloc/b-${id}`);
  await login(page, who(id));
  await createFromSheet(page, 'Projets');
  await page.goto('about:blank');
  await page.goto('/');
  await expect(page.locator('#hEntryPlaylists')).toContainText('1 carnet');
  const guest = await page.context().browser().newContext(testInfo.project.use), gp = await guest.newPage();
  await gp.goto('/');
  await gp.locator('#hEntryPlaylists').click();
  await expect(gp.locator('[data-login-go]')).toBeVisible();
});

test('à 390 px, le bouton ＋ tient dans l\'en-tête d\'un bloc ou d\'une voie, même avec un long nom', async ({ page }, testInfo) => {
  const id = uid(testInfo);
  await seedAll(id);
  await seed('blocs', `l-${id}`, { gymId: id, wallId: `w-${id}`, name: `Un nom de bloc vraiment très très long pour tester le débordement ${id}`, grade: '7c+', setter: 'Paul', holds: HOLDS, authorId: 'autre', createdAt: 2 });
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto(`/#/bloc/l-${id}`);
  await expect(page.locator('#dPlus')).toBeVisible();
  const b = await page.evaluate(() => { const h = document.querySelector('#vDetail .dhead'), p = document.getElementById('dPlus').getBoundingClientRect(), g = document.getElementById('dGrade').getBoundingClientRect(), hr = h.getBoundingClientRect(); return { overflow: h.scrollWidth - h.clientWidth, inside: p.right <= hr.right + 1 && g.right <= hr.right + 1, apart: p.right <= g.left + 1 }; });
  expect(b.overflow).toBeLessThanOrEqual(0);
  expect(b.inside).toBe(true);
  expect(b.apart).toBe(true);
});

test('le bouton retour d\'une fiche ouverte depuis un carnet revient au carnet (bloc et voie), pas à la salle ni au secteur', async ({ page }, testInfo) => {
  const id = uid(testInfo);
  await seedAll(id);
  await page.goto(`/#/bloc/b-${id}`);
  await login(page, who(id));
  await expect(page.locator('#dName')).toHaveText(`Bloc ${id}`);
  await createFromSheet(page, 'Séance');
  // Voie dans le même carnet.
  await page.goto(`/#/voie/v-${id}`);
  await expect(page.locator('#ovName')).toHaveText(`Voie ${id}`);
  await page.locator('#ovPlus').click();
  await page.locator('[data-pl-toggle]', { hasText: 'Séance' }).click();
  await page.locator('[data-close-sheet]').click();
  const openCarnet = async () => {
    await page.locator('#tabHome').click();
    await page.locator('#hEntryPlaylists').click();
    await page.locator('[data-pl-open]').click();
    await expect(page.locator('#plName')).toHaveText('Séance');
  };
  // Bloc : carnet → fiche → retour = carnet.
  await openCarnet();
  await page.locator('[data-pl-go^="bloc:"]').click();
  await expect(page.locator('#vDetail')).toBeVisible();
  await page.locator('#backBtn').click();
  await expect(page.locator('#vPlaylist')).toBeVisible();
  await expect(page.locator('#plName')).toHaveText('Séance');
  await expect(page.locator('#vList')).toBeHidden();
  // Voie : carnet → fiche → retour = carnet (et un second aller-retour fonctionne aussi).
  for (let i = 0; i < 2; i++) {
    await page.locator('[data-pl-go^="voie:"]').click();
    await expect(page.locator('#oVoie')).toBeVisible();
    await page.locator('#backBtn').click();
    await expect(page.locator('#vPlaylist')).toBeVisible();
    await expect(page.locator('#oList')).toBeHidden();
  }
  // Témoin : depuis la salle, le retour ramène toujours à la salle ; depuis le secteur, au secteur.
  await page.locator('#tabHome').click();
  await page.goto(`/#/salle/${id}`);
  await expect(page.locator('#vList')).toBeVisible();
  await page.locator('#vList .card').first().click();
  await expect(page.locator('#vDetail')).toBeVisible();
  await page.locator('#backBtn').click();
  await expect(page.locator('#vList')).toBeVisible();
  // Après un passage par le carnet, une fiche ouverte depuis la salle revient bien à la salle (le carnet est oublié).
  await openCarnet();
  await page.locator('[data-pl-go^="bloc:"]').click();
  await expect(page.locator('#vDetail')).toBeVisible();
  await page.locator('#tabSalles').click();
  await page.locator('#vList .card').first().click();
  await expect(page.locator('#vDetail')).toBeVisible();
  await page.locator('#backBtn').click();
  await expect(page.locator('#vList')).toBeVisible();
});
