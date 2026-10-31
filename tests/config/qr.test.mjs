// Le fichier du QR code d'Altissimo, tel qu'il sera imprimé, se relit et mène à la bonne adresse.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import jsQR from 'jsqr';

test('docs/qr/altissimo-albi.png mène à la salle avec src=qr', () => {
  const png = readFileSync('docs/qr/altissimo-albi.png');
  const side = png.readUInt32BE(16);
  assert.ok(side >= 1500, `résolution : ${side}`);
  const start = png.indexOf('IDAT') + 4, raw = inflateSync(png.subarray(start, start + png.readUInt32BE(start - 8)));
  const rgba = new Uint8ClampedArray(side * side * 4);
  for (let y = 0; y < side; y++) for (let x = 0; x < side; x++) {
    const v = raw[y * (side + 1) + 1 + x], i = (y * side + x) * 4;
    rgba[i] = rgba[i + 1] = rgba[i + 2] = v; rgba[i + 3] = 255;
  }
  assert.equal(jsQR(rgba, side, side)?.data, 'https://toposhare.web.app/?src=qr#/salle/altissimo-albi');
});
