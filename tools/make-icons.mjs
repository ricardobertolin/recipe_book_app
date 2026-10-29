/**
 * Generates the PWA icon set from one 16x16 pixel-art grid.
 * No dependencies: the PNGs are encoded by hand with node:zlib.
 *
 *   node tools/make-icons.mjs
 */

import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'icons');

const PALETTE = {
  '.': null,              // transparent
  K: '#2E1F14',           // outline
  R: '#C94A37',           // cover
  D: '#8A2E1F',           // spine
  P: '#FFF8EE',           // page / label
  I: '#3D2A1C',           // lettering
  Y: '#E8C872'            // ribbon
};

const ART = [
  '................',
  '..KKKKKKKKKKKKK.',
  '..KDDKRRRRRRRRK.',
  '..KDDKRRRRRRRRK.',
  '..KDDKRPPPPPPRK.',
  '..KDDKRPIIIIPRK.',
  '..KDDKRPPPPPPRK.',
  '..KDDKRPIIIIPRK.',
  '..KDDKRPPPPPPRK.',
  '..KDDKRPIIPPPRK.',
  '..KDDKRPPPPPPRK.',
  '..KDDKRRRRRRRRK.',
  '..KDDKRRRYYRRRK.',
  '..KDDKRRRYYRRRK.',
  '..KKKKKKKKKKKKK.',
  '................'
];

const BACKDROP = '#F3E6D3';
const GRID = ART.length;

/* ── PNG encoding ─────────────────────────────────────────────── */

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePng(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // colour type: RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

/* ── Drawing ──────────────────────────────────────────────────── */

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/**
 * @param {number} size   output edge in px
 * @param {number} inset  0 = full bleed art, 0.2 = 20% padding each side
 * @param {string|null} backdrop fill behind the art, or null for transparent
 */
function draw(size, inset, backdrop) {
  const rgba = Buffer.alloc(size * size * 4);

  if (backdrop) {
    const [r, g, b] = rgb(backdrop);
    for (let i = 0; i < size * size; i++) {
      rgba[i * 4] = r; rgba[i * 4 + 1] = g; rgba[i * 4 + 2] = b; rgba[i * 4 + 3] = 255;
    }
  }

  const artSize = Math.round(size * (1 - inset * 2));
  const cell = artSize / GRID;
  const offset = Math.round((size - artSize) / 2);

  for (let gy = 0; gy < GRID; gy++) {
    for (let gx = 0; gx < GRID; gx++) {
      const hex = PALETTE[ART[gy][gx]];
      if (!hex) continue;
      const [r, g, b] = rgb(hex);
      const x0 = offset + Math.round(gx * cell);
      const x1 = offset + Math.round((gx + 1) * cell);
      const y0 = offset + Math.round(gy * cell);
      const y1 = offset + Math.round((gy + 1) * cell);
      for (let y = y0; y < y1; y++) {
        if (y < 0 || y >= size) continue;
        for (let x = x0; x < x1; x++) {
          if (x < 0 || x >= size) continue;
          const i = (y * size + x) * 4;
          rgba[i] = r; rgba[i + 1] = g; rgba[i + 2] = b; rgba[i + 3] = 255;
        }
      }
    }
  }
  return encodePng(size, size, rgba);
}

function svgIcon() {
  const rects = [];
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const hex = PALETTE[ART[y][x]];
      if (hex) rects.push(`<rect x="${x}" y="${y}" width="1" height="1" fill="${hex}"/>`);
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${GRID} ${GRID}" shape-rendering="crispEdges">
<title>Recipe Book</title>
${rects.join('\n')}
</svg>
`;
}

/* ── Write ────────────────────────────────────────────────────── */

mkdirSync(OUT, { recursive: true });

const files = [
  ['icon-192.png', draw(192, 0.04, null)],
  ['icon-512.png', draw(512, 0.04, null)],
  ['maskable-192.png', draw(192, 0.2, BACKDROP)],
  ['maskable-512.png', draw(512, 0.2, BACKDROP)],
  ['apple-touch-icon.png', draw(180, 0.12, BACKDROP)],
  ['favicon.png', draw(64, 0.02, null)],
  ['icon.svg', Buffer.from(svgIcon(), 'utf8')]
];

for (const [name, data] of files) {
  writeFileSync(join(OUT, name), data);
  console.log(`wrote icons/${name} (${data.length} bytes)`);
}
