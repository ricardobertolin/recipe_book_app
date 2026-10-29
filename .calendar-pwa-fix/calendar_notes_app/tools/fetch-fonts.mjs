/* Pulls VT323 and IBM Plex Mono out of Google Fonts and vendors them into
   fonts/, rewriting the @font-face CSS to point at the local copies.
   Run with: node tools/fetch-fonts.mjs

   The app is offline-first and installable, so it cannot depend on a font CDN:
   the stylesheet <link> fires before the service worker controls the first page
   load, which means a user who installs and immediately goes offline would never
   have had it cached. Both families are SIL OFL 1.1, so vendoring is allowed. */

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..', 'fonts');

const SRC = 'https://fonts.googleapis.com/css2?family=VT323&family=IBM+Plex+Mono:wght@400;500;600&display=swap';

// A modern UA is what makes Google serve woff2 rather than ttf.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

// Everything gets precached for offline use, so only vendor the subsets this
// app realistically renders. Cyrillic/greek/vietnamese fall back to the system
// monospace rather than costing every visitor the download.
const KEEP = new Set(['latin', 'latin-ext']);

const full = await fetch(SRC, { headers: { 'User-Agent': UA } }).then(r => {
  if (!r.ok) throw new Error('font css fetch failed: ' + r.status);
  return r.text();
});

// Google emits "/* subset */" immediately before each @font-face block.
const blocks = [...full.matchAll(/\/\*\s*([\w-]+)\s*\*\/\s*(@font-face\s*\{[^}]*\})/g)];
if (!blocks.length) throw new Error('could not parse the font css into blocks');

const dropped = blocks.filter(b => !KEEP.has(b[1])).map(b => b[1]);
const css = blocks.filter(b => KEEP.has(b[1])).map(b => `/* ${b[1]} */\n${b[2]}`).join('\n');
console.log(`keeping ${blocks.length - dropped.length} of ${blocks.length} faces (dropped: ${[...new Set(dropped)].join(', ')})\n`);

await mkdir(OUT, { recursive: true });

const seen = new Map();
const urls = [...css.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g)].map(m => m[1]);

for (const url of urls) {
  if (seen.has(url)) continue;
  // Name files after the family/weight path segments so they stay recognisable.
  const parts = url.split('/');
  const name = (parts[parts.length - 2] + '-' + parts[parts.length - 1]).replace(/[^\w.-]/g, '_');
  const buf = Buffer.from(await fetch(url, { headers: { 'User-Agent': UA } }).then(r => r.arrayBuffer()));
  await writeFile(join(OUT, name), buf);
  seen.set(url, name);
  console.log(`${name.padEnd(42)} ${buf.length} bytes`);
}

const local = '/* Vendored from Google Fonts by tools/fetch-fonts.mjs — do not edit by hand.\n'
  + '   VT323 and IBM Plex Mono are licensed SIL OFL 1.1; see fonts/OFL.txt. */\n\n'
  + css.replace(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g, (_, u) => `url(./fonts/${seen.get(u)})`);

await writeFile(join(HERE, '..', 'fonts.css'), local);

console.log(`\n${seen.size} files -> fonts/`);
console.log(`fonts.css written with ${(local.match(/@font-face/g) || []).length} @font-face rules`);
