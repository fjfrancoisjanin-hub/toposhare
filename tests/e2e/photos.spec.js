// Photos : lancement léger, cache et compression. Aucune photo complète lue au lancement, une seule passe de compression, miniature, EXIF/GPS retirés.
const { test, expect } = require('./fixtures');
const { ALICE, login, seed } = require('./helpers');

const uid = testInfo => `${testInfo.project.name}-${Date.now()}`;

// Image de test fabriquée dans le navigateur (dégradé et cercles : se compresse bien).
const makeImage = (page, w, h, type = 'image/jpeg') => page.evaluate(async ([w, h, type]) => {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'), g = x.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, '#3a6'); g.addColorStop(1, '#a36'); x.fillStyle = g; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 40; i++) { x.beginPath(); x.arc((i * 97) % w, (i * 61) % h, 20 + (i % 7) * 12, 0, 7); x.fillStyle = `hsl(${i * 9} 60% 50%)`; x.fill(); }
  const blob = await new Promise(r => c.toBlob(r, type, 0.9));
  const b64 = await new Promise(r => { const f = new FileReader(); f.onload = () => r(String(f.result).split(',')[1]); f.readAsDataURL(blob); });
  return b64;
}, [w, h, type]);

async function seedSecteur(page, id, { thumb = false, full = true } = {}) {
  const b64 = await makeImage(page, 400, 300);
  await seed('secteurs', id, { name: `Secteur ${id}`, region: '', createdAt: 1 });
  await seed('voies', `v-${id}`, { secteurId: id, name: `Voie ${id}`, grade: '6a', w: 400, h: 300, image: `photo:p-${id}`, anchors: [{ x: 0.5, y: 0.5, t: 'bolt' }], authorId: 'autre', addedBy: 'Paul', methodCount: 0, createdAt: 1 });
  if (full) await seed('photos', `p-${id}`, { data: b64, w: 400, h: 300, mime: 'image/jpeg', authorId: 'autre', createdAt: 1 });
  if (thumb) await seed('miniatures', `p-${id}`, { data: b64, w: 40, h: 30, mime: 'image/jpeg', authorId: 'autre', createdAt: 1 });
}
const resume = (page, id) => page.addInitScript(id => {
  localStorage.setItem('pan-sect', id);
  localStorage.setItem('ts-recents', JSON.stringify([{ type: 'secteur', id, t: Date.now() }]));
}, id);
const splashGone = page => page.waitForFunction(() => !document.getElementById('splash'));
const photoReads = page => page.evaluate(() => ({ ...BT.stats }));

test("au lancement, aucune photo complète n'est lue, même avec « Reprendre » sur l'accueil", async ({ page }, testInfo) => {
  const id = uid(testInfo);
  await page.goto('/');
  await seedSecteur(page, id, { thumb: true });
  await resume(page, id);
  await page.reload();
  await expect(page.locator('#hResume')).toContainText(`Secteur ${id}`);
  await splashGone(page);
  // La carte n'affiche que la miniature.
  await expect(page.locator('#hResume img')).toHaveAttribute('src', /^blob:/);
  const s = await photoReads(page);
  expect(s.photoServer + s.photoCache).toBe(0);
  expect(s.thumbServer + s.thumbCache).toBeGreaterThan(0);
});

test("la liste des voies d'un secteur n'utilise que les miniatures : seule la photo d'en-tête est lue en entier", async ({ page }, testInfo) => {
  const id = uid(testInfo);
  await page.goto('/');
  await seedSecteur(page, id, { thumb: true });
  const b64 = await makeImage(page, 400, 300);
  await seed('voies', `v2-${id}`, { secteurId: id, name: `Voie B ${id}`, grade: '6b', w: 400, h: 300, image: `photo:q-${id}`, anchors: [{ x: 0.5, y: 0.5, t: 'bolt' }], authorId: 'autre', addedBy: 'Paul', methodCount: 0, createdAt: 2 });
  await seed('photos', `q-${id}`, { data: b64, w: 400, h: 300, mime: 'image/jpeg', authorId: 'autre', createdAt: 1 });
  await seed('miniatures', `q-${id}`, { data: b64, w: 40, h: 30, mime: 'image/jpeg', authorId: 'autre', createdAt: 1 });
  await resume(page, id);
  await page.reload();
  await page.locator('#hResume').click();
  await expect(page.locator('#oListEl .card')).toHaveCount(2);
  await expect(page.locator('#oListEl .card image').first()).toHaveAttribute('href', /^blob:/);
  await expect(page.locator('#oListEl .card image').nth(1)).toHaveAttribute('href', /^blob:/);
  await expect(page.locator('[data-hero="secteur"] img')).toHaveAttribute('src', /^blob:/);
  const s = await photoReads(page);
  expect(s.photoServer).toBe(1);
  expect(s.thumbServer).toBe(2);
});

test("une voie dont la photo d'avant n'a pas de miniature s'affiche quand même dans la liste", async ({ page }, testInfo) => {
  const id = uid(testInfo);
  await page.goto('/');
  await seedSecteur(page, id);
  await resume(page, id);
  await page.reload();
  await page.locator('#hResume').click();
  await expect(page.locator('#oListEl .card image').first()).toHaveAttribute('href', /^blob:/);
  await expect(page.locator('#toast')).toBeHidden();
});

test("une photo d'avant, sans miniature : l'accueil n'affiche pas d'image, et l'écran du secteur affiche la photo complète sans erreur", async ({ page }, testInfo) => {
  const id = uid(testInfo);
  await page.goto('/');
  await seedSecteur(page, id);
  await resume(page, id);
  await page.reload();
  await expect(page.locator('#hResume')).toContainText(`Secteur ${id}`);
  await splashGone(page);
  await expect(page.locator('#hResume img')).toHaveCount(0);
  expect((await photoReads(page)).photoServer).toBe(0);
  await page.locator('#hResume').click();
  await expect(page.locator('[data-hero="secteur"] img')).toHaveAttribute('src', /^blob:/);
  await expect(page.locator('#toast')).toBeHidden();
  expect((await photoReads(page)).photoServer).toBe(1);
});

test("un deuxième lancement ne relit pas du serveur une photo déjà vue", async ({ page }, testInfo) => {
  const id = uid(testInfo);
  await page.goto('/');
  await seedSecteur(page, id, { thumb: true });
  await resume(page, id);
  await page.reload();
  await page.locator('#hResume').click();
  await expect(page.locator('[data-hero="secteur"] img')).toHaveAttribute('src', /^blob:/);
  await expect.poll(async () => (await photoReads(page)).photoServer).toBe(1);
  // Le cache s'écrit sur le téléphone juste après la lecture : on laisse ce temps avant de relancer.
  await page.waitForTimeout(1500);

  await page.reload();
  await splashGone(page);
  await page.locator('#hResume').click();
  await expect(page.locator('[data-hero="secteur"] img')).toHaveAttribute('src', /^blob:/);
  await expect.poll(async () => (await photoReads(page)).photoCache).toBeGreaterThan(0);
  const s = await photoReads(page);
  expect(s.photoServer).toBe(0);
  expect(s.thumbServer).toBe(0);
});

test("la miniature s'affiche en attendant la photo, et un message clair apparaît si la photo ne charge pas", async ({ page }, testInfo) => {
  const id = uid(testInfo);
  await page.goto('/');
  await seedSecteur(page, id, { thumb: true, full: false });
  await resume(page, id);
  await page.reload();
  await page.locator('#hResume').click();
  await expect(page.locator('[data-hero="secteur"] img')).toHaveAttribute('src', /^blob:/);
  await expect(page.locator('#toast')).toContainText('La photo ne charge pas');
});

test("hors ligne : ce qui est déjà vu reste consultable, un message clair apparaît pour une photo qui ne charge pas, puis elle revient avec le réseau", async ({ page, context }, testInfo) => {
  const id = uid(testInfo), other = `${id}-b`;
  await page.goto('/');
  await seedSecteur(page, id, { thumb: true });
  const b64 = await makeImage(page, 400, 300);
  await seed('photos', `p-${other}`, { data: b64, w: 400, h: 300, mime: 'image/jpeg', authorId: 'autre', createdAt: 1 });
  await resume(page, id);
  await page.reload();
  await page.locator('#hResume').click();
  await expect(page.locator('[data-hero="secteur"] img')).toHaveAttribute('src', /^blob:/);
  await expect(page.locator('#oListEl')).toContainText(`Voie ${id}`);

  await context.setOffline(true);
  await page.evaluate(ref => BT.img(ref), `photo:p-${other}`);
  await expect(page.locator('#toast')).toContainText('La photo ne charge pas', { timeout: 25_000 });
  await expect(page.locator('#oListEl')).toContainText(`Voie ${id}`);
  expect(await page.evaluate(ref => BT.photoFailed(ref), `photo:p-${other}`)).toBe(true);

  await context.setOffline(false);
  await expect.poll(() => page.evaluate(ref => BT.img(ref), `photo:p-${other}`), { timeout: 25_000 }).toMatch(/^blob:/);
});

test('une grande photo sort en une passe : 2 000 px au plus, moins de 400 Ko, miniature légère', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.BT);
  const r = await page.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 3200; c.height = 2400;
    const x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 3200, 2400);
    g.addColorStop(0, '#2a7'); g.addColorStop(1, '#a27'); x.fillStyle = g; x.fillRect(0, 0, 3200, 2400);
    for (let i = 0; i < 80; i++) { x.beginPath(); x.arc((i * 137) % 3200, (i * 89) % 2400, 30 + (i % 9) * 20, 0, 7); x.fillStyle = `hsl(${i * 5} 55% 50%)`; x.fill(); }
    const src = await new Promise(res => c.toBlob(res, 'image/jpeg', 0.92));
    const p = await BT.preparePhoto(src);
    return { w: p.w, h: p.h, size: p.blob.size, type: p.blob.type, tw: p.thumb.w, th: p.thumb.h, tsize: p.thumb.blob.size, ttype: p.thumb.blob.type, src: src.size };
  });
  expect(Math.max(r.w, r.h)).toBe(2000);
  expect(r.size).toBeLessThan(400_000);
  expect(r.tsize).toBeLessThanOrEqual(28_000);
  expect(Math.max(r.tw, r.th)).toBeLessThanOrEqual(320);
  expect(['image/webp', 'image/jpeg']).toContain(r.type);
  expect(r.ttype).toBe(r.type);
});

test("un navigateur qui ne sait pas encoder le WebP (il rend du PNG) retombe sur le JPEG", async ({ page }) => {
  await page.addInitScript(() => {
    const orig = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (cb, type, q) { return orig.call(this, cb, type === 'image/webp' ? 'image/png' : type, q); };
  });
  await page.goto('/');
  await page.waitForFunction(() => window.BT);
  const r = await page.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 2600; c.height = 1800;
    const x = c.getContext('2d'); x.fillStyle = '#468'; x.fillRect(0, 0, 2600, 1800); x.fillStyle = '#e92'; x.fillRect(300, 300, 900, 700);
    const src = await new Promise(res => c.toBlob(res, 'image/jpeg', 0.9));
    const p = await BT.preparePhoto(src);
    return { type: p.blob.type, ttype: p.thumb.blob.type, size: p.blob.size, w: p.w };
  });
  expect(r).toMatchObject({ type: 'image/jpeg', ttype: 'image/jpeg', w: 2000 });
  expect(r.size).toBeLessThan(400_000);
});

test('une photo trop lourde, même compressée, est refusée avec une erreur claire', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.BT);
  const code = await page.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 3000; c.height = 3000;
    const x = c.getContext('2d'), d = x.createImageData(3000, 3000);
    for (let i = 0; i < d.data.length; i++) d.data[i] = (i % 4 === 3) ? 255 : Math.random() * 256;
    x.putImageData(d, 0, 0);
    const src = await new Promise(res => c.toBlob(res, 'image/jpeg', 0.95));
    try { await BT.preparePhoto(src); return 'passée'; } catch (e) { return e.code; }
  });
  expect(code).toBe('photo-too-large');
});

test("l'EXIF et le GPS d'une photo sont supprimés à l'envoi, et la miniature est rangée avec elle", async ({ page }) => {
  await page.goto('/');
  await login(page, ALICE);
  const r = await page.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 1200; c.height = 800;
    const x = c.getContext('2d'); x.fillStyle = '#357'; x.fillRect(0, 0, 1200, 800); x.fillStyle = '#fc4'; x.fillRect(100, 100, 400, 300);
    const base = new Uint8Array(await (await new Promise(res => c.toBlob(res, 'image/jpeg', 0.9))).arrayBuffer());
    const txt = new TextEncoder().encode('Exif\0\0GPSLatitude=43.9279 GPSLongitude=2.1480 Make=Pixel');
    const len = txt.length + 2, seg = new Uint8Array([0xFF, 0xE1, len >> 8, len & 255, ...txt]);
    const withExif = new Uint8Array(base.length + seg.length);
    withExif.set(base.slice(0, 2)); withExif.set(seg, 2); withExif.set(base.slice(2), 2 + seg.length);
    const latin = u8 => new TextDecoder('latin1').decode(u8);
    const inputHasGps = latin(withExif).includes('GPSLatitude');
    const up = await BT.uploadPhoto(new Blob([withExif], { type: 'image/jpeg' }));
    const id = up.url.slice(6);
    const photo = (await BT.fs.collection('photos').doc(id).get()).data(), thumb = await BT.fs.collection('miniatures').doc(id).get();
    const bytes = b64 => Uint8Array.from(atob(b64), ch => ch.charCodeAt(0));
    const out = latin(bytes(photo.data)), tout = latin(bytes(thumb.data().data));
    return {
      inputHasGps, size: bytes(photo.data).length, w: photo.w, h: photo.h, mime: photo.mime, authorId: photo.authorId, uid: BT.user().uid,
      leak: /GPS|Exif|EXIF|Pixel/.test(out), thumbLeak: /GPS|Exif|EXIF|Pixel/.test(tout), thumbExists: thumb.exists, thumbSize: bytes(thumb.data().data).length, thumbAuthor: thumb.data().authorId,
    };
  });
  expect(r.inputHasGps).toBe(true);
  expect(r.leak).toBe(false);
  expect(r.thumbLeak).toBe(false);
  expect(r.thumbExists).toBe(true);
  expect(r.size).toBeLessThan(400_000);
  expect(r.thumbSize).toBeLessThanOrEqual(28_000);
  expect(r.w).toBeLessThanOrEqual(2000);
  expect(['image/webp', 'image/jpeg']).toContain(r.mime);
  expect(r.authorId).toBe(r.uid);
  expect(r.thumbAuthor).toBe(r.uid);
});
