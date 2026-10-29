/** PWA regression checks. Serve the parent folder on port 8765, then run:
 *  node tools/check-pwa.mjs
 *  Override BASE or CHROME_PATH if needed. No dependencies.
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = process.env.BASE || 'http://127.0.0.1:8765/calendar_notes_app/';
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const profile = mkdtempSync(join(tmpdir(), 'retro-notes-pwa-'));
const port = 9600 + Math.floor(Math.random() * 300);
const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run',
  '--no-default-browser-check', `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`, 'about:blank'
], { stdio: 'ignore' });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let ws;

try {
  let target;
  for (let i = 0; i < 60 && !target; i++) {
    try {
      const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      target = pages.find(page => page.type === 'page');
    } catch { /* Chrome is starting. */ }
    if (!target) await sleep(150);
  }
  if (!target) throw new Error('Chrome did not start. Check CHROME_PATH.');
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  const pending = new Map();
  let id = 0;
  ws.onmessage = event => {
    const message = JSON.parse(event.data);
    const call = pending.get(message.id);
    if (!call) return;
    pending.delete(message.id);
    clearTimeout(call.timer);
    message.error ? call.reject(new Error(message.error.message)) : call.resolve(message.result);
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const next = ++id;
    const timer = setTimeout(() => {
      pending.delete(next);
      reject(new Error(`${method} timed out`));
    }, 15000);
    pending.set(next, { resolve, reject, timer });
    ws.send(JSON.stringify({ id: next, method, params }));
  });
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || 'Evaluation failed');
    return result.result.value;
  };
  let passed = 0, failed = 0;
  const check = async (name, test) => {
    try {
      const result = await test();
      if (result !== true) throw new Error(JSON.stringify(result));
      passed++;
      console.log(`PASS ${name}`);
    } catch (error) {
      failed++;
      console.log(`FAIL ${name}: ${error.message}`);
    }
  };
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await send('Page.navigate', { url: BASE });
  await sleep(1800);

  await check('Chrome computes a unique Calendar Notes app ID', async () => {
    const { appId } = await send('Page.getAppId');
    const expected = new URL('/calendar_notes_app/', BASE).href;
    return appId === expected || { actual: appId, expected };
  });
  await check('Chrome reports no installability errors', async () => {
    const { installabilityErrors } = await send('Page.getInstallabilityErrors');
    return installabilityErrors.length === 0 || installabilityErrors;
  });
  await check('launch URL and worker scope stay inside the project', () => evaluate(`(async () => {
    const reg = await navigator.serviceWorker.ready;
    const manifestURL = document.querySelector('link[rel=manifest]').href;
    const manifest = await (await fetch(manifestURL)).json();
    const expected = new URL('./', manifestURL).href;
    return reg.scope === expected && new URL(manifest.scope, manifestURL).href === expected &&
      new URL(manifest.start_url, manifestURL).href === expected;
  })()`));
  await check('worker update keeps sibling caches and deletes obsolete own caches', () => evaluate(`(async () => {
    const sibling = '__retro-notes-check-sibling';
    const obsolete = 'retronotes-shell-check-obsolete';
    try {
      const other = await caches.open(sibling);
      await other.put('./__sibling', new Response('sibling offline data'));
      await caches.open(obsolete);
      const reg = await navigator.serviceWorker.register('./sw.js?check-cache-isolation=1');
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('activation timed out')), 10000);
        const worker = reg.installing || reg.waiting || reg.active;
        const done = () => { if (worker.state === 'activated') { clearTimeout(timer); resolve(); } };
        worker.addEventListener('statechange', done);
        done();
      });
      const keys = await caches.keys();
      const saved = await (await caches.open(sibling)).match('./__sibling');
      return keys.includes(sibling) && !keys.includes(obsolete) &&
        !!saved && await saved.text() === 'sibling offline data';
    } finally {
      await caches.delete(sibling);
      await caches.delete(obsolete);
    }
  })()`));
  await check('notes shortcut opens offline with local fonts', async () => {
    await send('Network.enable');
    await send('Network.emulateNetworkConditions', {
      offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0
    });
    await send('Page.navigate', { url: new URL('?screen=notes', BASE).href });
    await sleep(1500);
    return evaluate(`(async () => {
      await document.fonts.ready;
      return document.querySelector('#tabNotes')?.classList.contains('is-on') &&
        document.querySelector('#screen')?.children.length > 0 &&
        document.fonts.check('16px "VT323"') && document.fonts.check('16px "IBM Plex Mono"');
    })()`);
  });
  console.log(`${passed} passed, ${failed} failed`);
  process.exitCode = failed ? 1 : 0;
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  ws?.close();
  chrome.kill();
  await sleep(400);
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* Chrome can briefly hold Windows file locks. */ }
}
