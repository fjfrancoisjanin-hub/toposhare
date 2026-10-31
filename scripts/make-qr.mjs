// Génère le QR code d'une salle pour une affiche, en PNG haute résolution, dans docs/qr/.
// Usage : node scripts/make-qr.mjs altissimo-albi
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import qrcode from 'qrcode-generator';

const SIZE = 2048, QUIET = 4; // Marge blanche obligatoire : 4 modules.
const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = buf => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]), len = Buffer.alloc(4), crc = Buffer.alloc(4);
  len.writeUInt32BE(data.length); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

// Modules entiers, sans lissage : les bords restent nets à l'impression.
export function qrPng(text) {
  const qr = qrcode(0, 'Q'); qr.addData(text); qr.make();
  const n = qr.getModuleCount(), scale = Math.floor(SIZE / (n + 2 * QUIET)), side = scale * (n + 2 * QUIET);
  const raw = Buffer.alloc((side + 1) * side, 255);
  for (let y = 0; y < side; y++) {
    const row = y * (side + 1); raw[row] = 0;
    const my = Math.floor(y / scale) - QUIET;
    for (let x = 0; x < side; x++) {
      const mx = Math.floor(x / scale) - QUIET;
      if (mx >= 0 && my >= 0 && mx < n && my < n && qr.isDark(my, mx)) raw[row + 1 + x] = 0;
    }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(side, 0); ihdr.writeUInt32BE(side, 4); ihdr[8] = 8; ihdr[9] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

if (process.argv[1]?.endsWith('make-qr.mjs')) {
  const slug = process.argv[2];
  if (!/^[a-z0-9-]+$/.test(slug || '')) { console.error('Usage : node scripts/make-qr.mjs <slug-de-la-salle>'); process.exit(1); }
  mkdirSync('docs/qr', { recursive: true });
  writeFileSync(`docs/qr/${slug}.png`, qrPng(`https://toposhare.web.app/?src=qr#/salle/${slug}`));
  console.log(`docs/qr/${slug}.png`);
}
