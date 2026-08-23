/* Regenerates the site icons in `public/` from the live site's own favicon.
 *
 * Not part of the build — the outputs are committed, because they change only
 * when the brand does. Run it by hand after replacing the source:
 *
 *   node scripts/make-icons.mjs
 *
 * The source is `reference/brand/favicon-source.jpg`, which is
 * `cropped-favicon_csd.jpg` off the live site at its full 512×512: the woman
 * from the book cover, cropped to her head, on white. It is a PHOTOGRAPH, which
 * is why there is no SVG icon here — the placeholder one this replaced was a
 * drawing of coloured bars that looked nothing like the site.
 */
import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';

const SRC = 'reference/brand/favicon-source.jpg';
const png = (size) => sharp(SRC).resize(size, size, { fit: 'cover' }).png({ compressionLevel: 9 }).toBuffer();
// The bigger sizes are JPEG, which is also what the live site serves. A 192px
// PNG of this is 63kB; the JPEG is a tenth of that, for the same picture.
const jpg = (size) => sharp(SRC).resize(size, size, { fit: 'cover' }).jpeg({ quality: 86, mozjpeg: true }).toBuffer();

await writeFile('public/favicon-32.png', await png(32));
console.log('favicon-32.png');
for (const [size, name] of [[180, 'apple-touch-icon.jpg'], [192, 'favicon-192.jpg'], [270, 'mstile-270.jpg']]) {
  await writeFile(`public/${name}`, await jpg(size));
  console.log(name);
}

// A .ico is a container, and Vista-and-later — so every browser in use — accepts
// a PNG inside one. That avoids hand-rolling a BMP with its upside-down rows and
// its separate 1-bit AND mask, for no visible difference.
const body = await png(32);
const header = Buffer.alloc(22);
header.writeUInt16LE(0, 0);            // reserved
header.writeUInt16LE(1, 2);            // type: icon
header.writeUInt16LE(1, 4);            // one image in this file
header.writeUInt8(32, 6);              // width
header.writeUInt8(32, 7);              // height
header.writeUInt8(0, 8);               // palette entries; 0 means truecolour
header.writeUInt8(0, 9);               // reserved
header.writeUInt16LE(1, 10);           // colour planes
header.writeUInt16LE(32, 12);          // bits per pixel
header.writeUInt32LE(body.length, 14); // size of the image data
header.writeUInt32LE(22, 18);          // where it starts
await writeFile('public/favicon.ico', Buffer.concat([header, body]));
console.log('favicon.ico');
