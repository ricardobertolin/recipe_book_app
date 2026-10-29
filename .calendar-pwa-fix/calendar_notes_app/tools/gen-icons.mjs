/* Draws the app icons and the iOS launch screens as 8-bit grayscale PNGs — no
   dependencies, no binary assets checked in by hand.
   Run with: node tools/gen-icons.mjs

   The mark is the app itself: a bordered paper field, a solid calendar header
   with two ring holes, and a 4x3 grid of day cells with one hollow "today". */

import zlib from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ICONS = join(HERE, '..', 'icons');
const SPLASH = join(HERE, '..', 'splash');

const INK = 0;
const PAPER = 255;
const DESK = 0xda;   // #DADADA, the manifest background_color

const canvas = (w, h, fill) => ({ w, h, buf: new Uint8Array(w * h).fill(fill) });

function fill(cv, x0, y0, x1, y1, v) {
  const a = Math.max(0, x0), b = Math.min(cv.w, x1);
  for (let y = Math.max(0, y0); y < Math.min(cv.h, y1); y++) {
    cv.buf.fill(v, y * cv.w + a, y * cv.w + b);
  }
}

/* The mark is authored on a 32x32 grid and scaled to `size` px at (ox, oy). */
function drawMark(cv, ox, oy, size) {
  const map = (u) => Math.round((u * size) / 32);
  const rect = (x, y, w, h, v) =>
    fill(cv, ox + map(x), oy + map(y), ox + map(x + w), oy + map(y + h), v);

  rect(0, 0, 32, 32, INK);      // ink field
  rect(2, 2, 28, 28, PAPER);    // paper inside the frame
  rect(5, 5, 22, 5, INK);       // calendar header
  rect(9, 6, 3, 3, PAPER);      // ring holes
  rect(20, 6, 3, 3, PAPER);

  for (const y of [12, 17, 22]) {
    for (const x of [6, 11, 16, 21]) rect(x, y, 4, 4, INK);
  }
  rect(12, 18, 2, 2, PAPER);    // today, hollow
}

/* `inset` is padding in units of the 32x32 grid. Maskable icons must keep the
   mark inside the central 80% circle, which inset 8 satisfies. */
function renderIcon(size, inset) {
  const cv = canvas(size, size, PAPER);
  const pad = Math.round((inset * size) / 32);
  drawMark(cv, pad, pad, size - 2 * pad);
  return cv;
}

/* A launch screen: the mark on the same grey the manifest declares, so the
   handoff from splash to app has no flash of a different colour. */
function renderSplash(w, h) {
  const cv = canvas(w, h, DESK);
  const size = Math.round(Math.min(w, h) * 0.28);
  drawMark(cv, Math.round((w - size) / 2), Math.round((h - size) / 2), size);
  return cv;
}

const CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(cv) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(cv.w, 0);
  ihdr.writeUInt32BE(cv.h, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 0;   // colour type: grayscale
  ihdr[10] = 0;  // deflate
  ihdr[11] = 0;  // adaptive filtering
  ihdr[12] = 0;  // no interlace

  // One filter byte per scanline. Filter 2 (Up) makes the large flat areas of a
  // splash screen collapse to runs of zero, which deflate removes almost
  // entirely; row 0 has nothing above it, so it stays unfiltered.
  const raw = Buffer.alloc((cv.w + 1) * cv.h);
  for (let y = 0; y < cv.h; y++) {
    const at = y * (cv.w + 1);
    raw[at] = y === 0 ? 0 : 2;
    for (let x = 0; x < cv.w; x++) {
      const here = cv.buf[y * cv.w + x];
      raw[at + 1 + x] = y === 0 ? here : (here - cv.buf[(y - 1) * cv.w + x]) & 0xff;
    }
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

mkdirSync(ICONS, { recursive: true });
mkdirSync(SPLASH, { recursive: true });

let total = 0;
const emit = (dir, name, cv) => {
  const file = png(cv);
  writeFileSync(join(dir, name), file);
  total += file.length;
  console.log(`${name.padEnd(30)} ${String(cv.w + 'x' + cv.h).padEnd(11)} ${file.length} bytes`);
};

for (const [name, size, inset] of [
  ['icon-192.png', 192, 0],
  ['icon-512.png', 512, 0],
  ['icon-maskable-512.png', 512, 8],
  ['apple-touch-icon-180.png', 180, 0]
]) emit(ICONS, name, renderIcon(size, inset));

console.log('');

/* iOS picks a launch image by matching device-width/height in CSS px and the
   pixel ratio, so each device family needs its own exact-size file.
   [ css width, css height, dpr ] — portrait iPhones, newest first. */
export const SPLASH_TARGETS = [
  [440, 956, 3],   // 16 Pro Max
  [430, 932, 3],   // 15/16 Pro Max, 14 Pro Max
  [402, 874, 3],   // 16 Pro
  [393, 852, 3],   // 15/16, 14 Pro
  [428, 926, 3],   // 13/12 Pro Max
  [390, 844, 3],   // 14/13/12
  [375, 812, 3],   // 13 mini, 11 Pro, X/XS
  [414, 896, 3],   // 11 Pro Max, XS Max
  [414, 896, 2],   // 11, XR
  [414, 736, 3],   // 8 Plus
  [375, 667, 2]    // SE, 8, 7, 6s
];

for (const [cw, ch, dpr] of SPLASH_TARGETS) {
  emit(SPLASH, `splash-${cw}x${ch}@${dpr}x.png`, renderSplash(cw * dpr, ch * dpr));
}

console.log(`\n${(total / 1024).toFixed(1)} KB total`);
