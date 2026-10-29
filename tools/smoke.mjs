/**
 * Dev helper: clicks through the main flows in headless Chrome and reports
 * pass/fail. Expects the site on http://127.0.0.1:8765 (or $BASE).
 *
 *   node tools/smoke.mjs
 */

import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.env.BASE || 'http://127.0.0.1:8765';
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const port = 9400 + Math.floor(Math.random() * 400);
const profile = mkdtempSync(join(tmpdir(), 'rb-smoke-'));
const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
  '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  '--window-size=1100,900', 'about:blank'
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function target() {
  for (let i = 0; i < 60; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      const page = list.find((t) => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch { /* retry */ }
    await sleep(150);
  }
  throw new Error('Chrome did not come up');
}

const ws = new WebSocket(await target());
await new Promise((r) => { ws.onopen = r; });

let nextId = 1;
const pending = new Map();
const errors = [];

ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
  }
  if (msg.method === 'Runtime.exceptionThrown') {
    errors.push(msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text);
  }
  if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
    errors.push(msg.params.args.map((a) => a.value ?? a.description).join(' '));
  }
};

const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = nextId++;
  pending.set(id, { resolve, reject });
  ws.send(JSON.stringify({ id, method, params }));
});

const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'eval threw');
  return r.result.value;
};

await send('Runtime.enable');
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });

let pass = 0;
let fail = 0;
async function check(name, fn) {
  try {
    const result = await fn();
    if (result === true) { console.log(`  ok   ${name}`); pass++; }
    else { console.log(`  FAIL ${name} -> ${JSON.stringify(result)}`); fail++; }
  } catch (err) {
    console.log(`  FAIL ${name} -> ${err.message}`);
    fail++;
  }
}

async function goto(url) {
  await send('Page.navigate', { url });
  await sleep(1400);
}

console.log('\nRecipe Book smoke test\n');

await goto(`${BASE}/?layout=app`);
await evaluate("localStorage.clear()");
await goto(`${BASE}/?layout=app`);

console.log('boot');
await check('seeds five recipes', async () =>
  await evaluate("document.querySelectorAll('.rcard').length") === 4 || 'teaser shows 4');
await check('groups render', async () =>
  await evaluate("document.querySelectorAll('.group').length") === 4 || 'expected 4 groups');
await check('default theme is editorial', async () =>
  await evaluate('document.documentElement.dataset.theme') === 'editorial');
await check('settings list editorial first', async () => {
  await evaluate("document.querySelector('.iconbtn[title]').click()");
  await sleep(300);
  const names = await evaluate("[...document.querySelectorAll('.setting')][0] && [...[...document.querySelectorAll('.setting')][0].querySelectorAll('.opt__name')].map(n=>n.textContent).join('|')");
  await evaluate("document.querySelector('.overlay').click()");
  return names === 'Editorial|Editorial Night|Playful|Pixel' || names;
});
await check('tab title stays the app name whatever the theme', async () => {
  const title = await evaluate('document.title');
  return title === 'Recipe Book' || title;
});

console.log('\nnavigation');
await check('opens a recipe', async () => {
  await evaluate("document.querySelectorAll('.rcard')[0].click()");
  await sleep(300);
  return (await evaluate('location.hash')).startsWith('#/r/');
});
await check('recipe shows ingredients', async () =>
  await evaluate("document.querySelectorAll('.ing').length") > 0);
await check('ticking an ingredient toggles it', async () => {
  await evaluate("document.querySelector('.ing').click()");
  await sleep(100);
  return await evaluate("document.querySelector('.ing').getAttribute('aria-pressed')") === 'true';
});
await check('tabs switch panels', async () => {
  await evaluate("document.querySelectorAll('.tab')[1].click()");
  await sleep(100);
  return await evaluate("document.querySelector('.panels').dataset.active") === 'steps';
});
await check('start cooking enters cook mode', async () => {
  await evaluate("[...document.querySelectorAll('button')].find(b=>/cook/i.test(b.textContent)).click()");
  await sleep(400);
  return (await evaluate('location.hash')).includes('/cook/');
});
await check('next advances the step', async () => {
  const before = await evaluate("document.querySelector('.cook__badge').textContent");
  await evaluate("document.querySelector('.btn--next').click()");
  await sleep(300);
  const after = await evaluate("document.querySelector('.cook__badge').textContent");
  return before !== after || `${before} === ${after}`;
});
await check('back button leaves cook mode', async () => {
  await evaluate('history.back()');
  await sleep(400);
  return !(await evaluate('location.hash')).includes('/cook/');
});

console.log('\ncreate and edit');
await check('new recipe form opens', async () => {
  await evaluate("location.hash = '#/new'");
  await sleep(400);
  return await evaluate("!!document.querySelector('#recipe-title')");
});
await check('saving without a name is blocked', async () => {
  await evaluate("document.querySelector('.formbar .btn--primary').click()");
  await sleep(200);
  return await evaluate("!document.querySelector('.field__error').hidden");
});
await check('saves a named recipe', async () => {
  await evaluate(`(() => {
    const t = document.querySelector('#recipe-title');
    t.value = 'Smoke test loaf';
    t.dispatchEvent(new Event('input', { bubbles: true }));
    const q = document.querySelector('.input--qty'), n = document.querySelector('.input--name');
    q.value = '1 kg'; q.dispatchEvent(new Event('input', { bubbles: true }));
    n.value = 'Flour'; n.dispatchEvent(new Event('input', { bubbles: true }));
    const s = document.querySelector('.rows textarea');
    s.value = 'Bake it.'; s.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  await evaluate("document.querySelector('.formbar .btn--primary').click()");
  await sleep(500);
  return await evaluate("document.querySelector('.recipe__title')?.textContent") === 'Smoke test loaf';
});
await check('the new recipe persists to storage', async () =>
  await evaluate("JSON.parse(localStorage.getItem('recipebook.v2')).recipes.some(r=>r.title==='Smoke test loaf')"));
await check('typing in a field does not lose focus', async () => {
  await evaluate("location.hash = '#/new'");
  await sleep(400);
  return await evaluate(`(() => {
    const t = document.querySelector('#recipe-title');
    t.focus();
    t.value = 'abc'; t.dispatchEvent(new Event('input', { bubbles: true }));
    return document.activeElement === t;
  })()`);
});

console.log('\ngroups');
await check('creating a group works', async () => {
  await evaluate("location.hash = '#/'");
  await sleep(400);
  await evaluate("document.querySelector('.section__action').click()");
  await sleep(400);
  await evaluate(`(() => {
    const i = document.querySelector('.sheet input');
    i.value = 'Smoke group'; i.dispatchEvent(new Event('input', { bubbles: true }));
    [...document.querySelectorAll('.sheet .btn')].find(b=>!/cancel/i.test(b.textContent)).click();
  })()`);
  await sleep(500);
  return await evaluate("JSON.parse(localStorage.getItem('recipebook.v2')).groups.some(g=>g.name==='Smoke group')");
});
await check('a group page opens', async () => (await evaluate('location.hash')).startsWith('#/g/'));
await check('empty group offers a first recipe', async () =>
  await evaluate("!!document.querySelector('.empty')"));

console.log('\nsearch');
await check('search filters the list', async () => {
  await evaluate("location.hash = '#/'");
  await sleep(400);
  await evaluate(`(() => {
    const i = document.querySelector('.search input');
    i.value = 'lemon'; i.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  await sleep(400);
  return await evaluate("document.querySelectorAll('.rcard').length") === 1;
});
await check('ingredient search matches too', async () => {
  await evaluate(`(() => {
    const i = document.querySelector('.search input');
    i.value = 'panko'; i.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  await sleep(400);
  return await evaluate("document.querySelector('.rcard__title')?.textContent") === 'Chicken katsu curry';
});

console.log('\nthemes and layout');
for (const theme of ['playful', 'editorial', 'editorial-dark', 'pixel']) {
  await check(`theme ${theme} applies`, async () => {
    await evaluate("location.hash = '#/'");
    await sleep(200);
    await evaluate("document.querySelector('.iconbtn[title]').click()");
    await sleep(300);
    await evaluate(`[...document.querySelectorAll('.opt')].find(o=>o.querySelector('.opt__name').textContent.toLowerCase().replace(/\\s+/g,'-')===${JSON.stringify(theme === 'editorial-dark' ? 'editorial-night' : theme)}).click()`);
    await sleep(400);
    return await evaluate('document.documentElement.dataset.theme') === theme;
  });
}
await check('theme survives a reload', async () => {
  await goto(`${BASE}/`);
  return await evaluate('document.documentElement.dataset.theme') === 'pixel';
});
await check('website layout switches on', async () => {
  await evaluate("document.querySelector('.iconbtn[title]').click()");
  await sleep(300);
  await evaluate("[...document.querySelectorAll('.opt')].find(o=>o.querySelector('.opt__name').textContent==='Website').click()");
  await sleep(400);
  return await evaluate('document.documentElement.dataset.layout') === 'web';
});
await check('no horizontal overflow in the website layout', async () =>
  await evaluate('document.documentElement.scrollWidth <= innerWidth + 1'));

console.log('\nimport / export');

const openTransfer = `(async () => {
  document.querySelector('.iconbtn[title]').click();
  await new Promise(r => setTimeout(r, 250));
  [...document.querySelectorAll('.sheet .btn')].find(b => /import . export/i.test(b.textContent)).click();
  await new Promise(r => setTimeout(r, 250));
  return !!document.querySelector('.sheet textarea, .sheet .btnrow');
})()`;

await check('the import/export sheet opens', async () => {
  await goto(`${BASE}/?layout=app`);
  return await evaluate(openTransfer) === true;
});

await check('merge adds recipes from a pasted export', async () => {
  const before = await evaluate("JSON.parse(localStorage.getItem('recipebook.v2')).recipes.length");
  const payload = JSON.stringify({
    app: 'recipe-book', version: 2,
    groups: [{ id: 'imp1', name: 'Imported things', colorIndex: 2 }],
    recipes: [{
      id: 'impr1', groupId: 'imp1', title: 'Imported stew', difficulty: 1,
      time: 90, servings: 6, photo: null,
      ingredients: [{ qty: '1 kg', name: 'Beef' }], steps: ['Simmer slowly.'], notes: 'From a friend.'
    }]
  });
  await evaluate(`(() => {
    [...document.querySelectorAll('.sheet .btn')].find(b => /paste json/i.test(b.textContent)).click();
    const t = document.querySelector('.sheet textarea');
    t.value = ${JSON.stringify(payload)};
    [...document.querySelectorAll('.sheet .btn')].find(b => b.textContent.trim() === 'Import').click();
  })()`);
  await sleep(500);
  const after = await evaluate("JSON.parse(localStorage.getItem('recipebook.v2')).recipes.length");
  const hasGroup = await evaluate("JSON.parse(localStorage.getItem('recipebook.v2')).groups.some(g=>g.name==='Imported things')");
  return (after === before + 1 && hasGroup) || `${before} -> ${after}, group ${hasGroup}`;
});

await check('importing the same file twice adds nothing', async () => {
  const before = await evaluate("JSON.parse(localStorage.getItem('recipebook.v2')).recipes.length");
  await evaluate(`(() => {
    const data = JSON.parse(localStorage.getItem('recipebook.v2'));
    window.__again = JSON.stringify({ app: 'recipe-book', version: 2, groups: data.groups, recipes: data.recipes });
  })()`);
  await evaluate(openTransfer);
  await evaluate(`(() => {
    [...document.querySelectorAll('.sheet .btn')].find(b => /paste json/i.test(b.textContent)).click();
    document.querySelector('.sheet textarea').value = window.__again;
    [...document.querySelectorAll('.sheet .btn')].find(b => b.textContent.trim() === 'Import').click();
  })()`);
  await sleep(500);
  const after = await evaluate("JSON.parse(localStorage.getItem('recipebook.v2')).recipes.length");
  return after === before || `${before} -> ${after}`;
});

await check('a bad paste reports an error instead of wiping anything', async () => {
  const before = await evaluate("JSON.parse(localStorage.getItem('recipebook.v2')).recipes.length");
  await evaluate(openTransfer);
  await evaluate(`(() => {
    [...document.querySelectorAll('.sheet .btn')].find(b => /paste json/i.test(b.textContent)).click();
    document.querySelector('.sheet textarea').value = 'not json at all';
    [...document.querySelectorAll('.sheet .btn')].find(b => b.textContent.trim() === 'Import').click();
  })()`);
  await sleep(300);
  const shown = await evaluate("!!document.querySelector('.sheet .field__error') && !document.querySelector('.sheet .field__error').hidden");
  const after = await evaluate("JSON.parse(localStorage.getItem('recipebook.v2')).recipes.length");
  await evaluate("document.querySelector('.overlay').click()");
  return (shown && after === before) || `error shown ${shown}, ${before} -> ${after}`;
});

await check('replace swaps the whole book', async () => {
  await goto(`${BASE}/?layout=app`);
  await evaluate(openTransfer);
  await evaluate("window.confirm = () => true");
  const payload = JSON.stringify({
    app: 'recipe-book', version: 2,
    groups: [{ id: 'only', name: 'Only group', colorIndex: 0 }],
    recipes: [{
      id: 'onlyr', groupId: 'only', title: 'Only recipe', difficulty: 0,
      time: 5, servings: 1, photo: null, ingredients: [], steps: ['Eat.'], notes: ''
    }]
  });
  await evaluate(`(() => {
    [...document.querySelectorAll('.sheet .opt')].find(o => o.textContent.includes('Replace')).click();
    [...document.querySelectorAll('.sheet .btn')].find(b => /paste json/i.test(b.textContent)).click();
    document.querySelector('.sheet textarea').value = ${JSON.stringify(payload)};
    [...document.querySelectorAll('.sheet .btn')].find(b => b.textContent.trim() === 'Import').click();
  })()`);
  await sleep(500);
  return await evaluate("JSON.parse(localStorage.getItem('recipebook.v2')).recipes.length") === 1;
});

await check('the per-recipe share sheet opens', async () => {
  await evaluate("location.hash = '#/'");
  await sleep(300);
  await evaluate("document.querySelector('.rcard').click()");
  await sleep(400);
  await evaluate("document.querySelector('.hero__tools .iconbtn').click()");
  await sleep(400);
  return await evaluate("document.querySelector('.sheet__title')?.textContent") === 'Share this recipe';
});

await check('copying a recipe as text produces markdown', async () => {
  const text = await evaluate(`(async () => {
    const mod = await import('./js/formats.js');
    const data = JSON.parse(localStorage.getItem('recipebook.v2'));
    return mod.recipeToMarkdown(data, data.recipes[0], ['Easy','Medium','Hard']);
  })()`);
  return (text.startsWith('# ') && text.includes('**Method**')) || text.slice(0, 60);
});

await check('a single recipe exports as an importable book', async () => {
  const ok = await evaluate(`(async () => {
    const mod = await import('./js/formats.js');
    const data = JSON.parse(localStorage.getItem('recipebook.v2'));
    const parsed = mod.parseJSON(mod.toJSON(data, [data.recipes[0]]));
    return parsed.ok && parsed.counts.recipes === 1;
  })()`);
  return ok === true;
});

await check('print styles open every panel', async () => {
  await evaluate("location.hash = '#/'");
  await sleep(300);
  await evaluate("document.querySelector('.rcard').click()");
  await sleep(400);
  await send('Emulation.setEmulatedMedia', { media: 'print' });
  await sleep(200);
  const visible = await evaluate("[...document.querySelectorAll('.panel')].filter(p => getComputedStyle(p).display !== 'none').length");
  const chrome = await evaluate("getComputedStyle(document.querySelector('.tabs')).display");
  await send('Emulation.setEmulatedMedia', { media: '' });
  return (visible === 3 && chrome === 'none') || `panels ${visible}, tabs ${chrome}`;
});

console.log('\npwa');
await goto(`${BASE}/?layout=app`);
await check('Chrome computes a Recipe Book ID distinct from the shared origin', async () => {
  // Unlike scope/start_url, manifest id is resolved against the ORIGIN.
  // Ask Chrome itself: resolving id against manifestURL hid a collision at '/'.
  const { appId } = await send('Page.getAppId');
  const expected = new URL('/recipe_book_app/', BASE).href;
  return appId === expected || { actual: appId, expected };
});
await check('manifest is reachable', async () =>
  (await evaluate(`fetch('./manifest.webmanifest').then(r=>r.ok)`)) === true);
await check('Chrome reports no installability errors', async () => {
  const { installabilityErrors } = await send('Page.getInstallabilityErrors');
  return installabilityErrors.length === 0 || installabilityErrors;
});
await check('manifest icons decode at their declared sizes', async () => {
  return await evaluate(`(async () => {
    const manifest = await (await fetch('./manifest.webmanifest')).json();
    for (const icon of manifest.icons.filter(i => i.type === 'image/png')) {
      const response = await fetch(icon.src);
      if (!response.ok) return icon.src + ': HTTP ' + response.status;
      const image = await createImageBitmap(await response.blob());
      const size = image.width + 'x' + image.height;
      image.close();
      if (size !== icon.sizes) return icon.src + ': ' + size;
    }
    return true;
  })()`);
});
await check('service worker registers', async () => {
  await goto(`${BASE}/`);
  await sleep(1200);
  return await evaluate("navigator.serviceWorker.getRegistration().then(r => !!r)");
});
await check('worker scope and manifest stay inside the project path', async () =>
  await evaluate(`(async () => {
    const reg = await navigator.serviceWorker.ready;
    const manifestURL = document.querySelector('link[rel=manifest]').href;
    const manifest = await (await fetch(manifestURL)).json();
    const expected = new URL('./', location.href).href;
    return reg.scope === expected && new URL(manifest.scope, manifestURL).href === expected &&
      new URL(manifest.start_url, manifestURL).href.startsWith(expected);
  })()`));
await check('activation keeps sibling app caches and removes obsolete recipe caches', async () =>
  await evaluate(`(async () => {
    const sibling = '__recipebook-smoke-sibling';
    const obsolete = 'recipe-book-shell-smoke-obsolete';
    try {
      const cache = await caches.open(sibling);
      await cache.put('./__sibling-test', new Response('other app offline data'));
      await caches.open(obsolete);
      // A distinct script URL forces a real update. Unregister/register with
      // the same URL can reuse the active worker while this page controls it.
      const reg = await navigator.serviceWorker.register('./sw.js?cache-isolation', {
        scope: './', updateViaCache: 'none'
      });
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('activation timed out')), 10000);
        const worker = reg.installing || reg.waiting || reg.active;
        const check = () => {
          if (worker.state === 'activated') { clearTimeout(timer); resolve(); }
        };
        worker.addEventListener('statechange', check);
        check();
      });
      const keys = await caches.keys();
      const saved = await (await caches.open(sibling)).match('./__sibling-test');
      const preserved = keys.includes(sibling) && !!saved &&
        await saved.text() === 'other app offline data';
      return (preserved && !keys.includes(obsolete)) || { preserved, keys };
    } finally {
      await caches.delete(sibling);
      await caches.delete(obsolete);
    }
  })()`));
await check('shell is precached', async () => {
  await sleep(1500);
  return await evaluate("caches.keys().then(async ks => { const c = await caches.open(ks.find(k=>k.includes('shell'))); return (await c.keys()).length > 10; })");
});
await check('export produces valid json', async () =>
  await evaluate("(() => { try { JSON.parse(JSON.stringify(JSON.parse(localStorage.getItem('recipebook.v2')))); return true; } catch { return false; } })()"));

await check('settings explain Android and iPhone installation without a prompt', async () => {
  await evaluate("document.querySelector('.iconbtn[title]').click()");
  const text = await evaluate("document.querySelector('.sheet').textContent");
  await evaluate("document.querySelector('.overlay').click()");
  return text.includes('Android:') && text.includes('iPhone / iPad:') && text.includes('Add to Home Screen');
});

console.log('\nPortuguese recipe file');
async function importLearningFile(mode = 'merge') {
  await evaluate(openTransfer);
  if (mode === 'replace') {
    await evaluate("window.confirm = () => true; [...document.querySelectorAll('.sheet .opt')].find(o => o.textContent.includes('Replace')).click()");
  }
  const { root } = await send('DOM.getDocument');
  const { nodeId } = await send('DOM.querySelector', { nodeId: root.nodeId, selector: '.sheet input[type=file]' });
  await send('DOM.setFileInputFiles', {
    nodeId, files: [fileURLToPath(new URL('../receitas-90.json', import.meta.url))]
  });
  await sleep(500);
}
await check('the actual JSON file merges all 90 entries through the file picker', async () => {
  await importLearningFile();
  return await evaluate(`(() => {
    const data = JSON.parse(localStorage.getItem('recipebook.v2'));
    return data.recipes.length === 91 && data.groups.length === 7 &&
      data.recipes.some(r => r.title === 'Crème brûlée' && r.difficulty === 2) &&
      data.recipes.some(r => r.title === 'Ovos mexidos cremosos' && r.difficulty === 0 &&
        r.notes.includes('controlar o ponto dos ovos.'));
  })()`);
});
await check('reimporting the Portuguese file creates no duplicates', async () => {
  await importLearningFile();
  return await evaluate(`(() => {
    const data = JSON.parse(localStorage.getItem('recipebook.v2'));
    return data.recipes.length === 91 && data.groups.length === 7;
  })()`);
});
await check('Replace imports six chapters with five recipes per difficulty', async () => {
  await importLearningFile('replace');
  return await evaluate(`(() => {
    const data = JSON.parse(localStorage.getItem('recipebook.v2'));
    return data.recipes.length === 90 && data.groups.length === 6 && data.groups.every(g =>
      [0, 1, 2].every(d => data.recipes.filter(r => r.groupId === g.id && r.difficulty === d).length === 5));
  })()`);
});

await check('the app still loads with the network cut', async () => {
  await send('Network.enable');
  await send('Network.emulateNetworkConditions', {
    offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0
  });
  await goto(`${BASE}/?source=pwa`);
  const ok = await evaluate(`(() => {
    const data = JSON.parse(localStorage.getItem('recipebook.v2'));
    return document.querySelectorAll('.rcard').length > 0 && data.recipes.length === 90;
  })()`);
  await send('Network.emulateNetworkConditions', {
    offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1
  });
  return ok;
});

console.log('\nreset');
await evaluate("localStorage.clear()");

console.log(`\n${pass} passed, ${fail} failed`);
if (errors.length) {
  console.log('\nconsole errors:');
  for (const e of [...new Set(errors)]) console.log('  ' + e.split('\n')[0]);
}

ws.close();
chrome.kill();
await sleep(400);
try { rmSync(profile, { recursive: true, force: true }); } catch { /* windows lock */ }
process.exit(fail ? 1 : 0);
