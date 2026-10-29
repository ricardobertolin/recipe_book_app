/**
 * Dev helper: drive headless Chrome over CDP to screenshot the app and
 * report console errors. Not part of the shipped site.
 *
 *   node tools/shot.mjs <url> <out.png> [width] [height] ['js to eval']
 */

import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [, , url, out, w = '430', h = '900', evalJs = ''] = process.argv;
if (!url || !out) { console.error('usage: shot.mjs <url> <out.png> [w] [h] [js]'); process.exit(1); }

const CHROME = process.env.CHROME_PATH ||
  'C:/Program Files/Google/Chrome/Application/chrome.exe';

const port = 9222 + Math.floor(Math.random() * 500);
const profile = mkdtempSync(join(tmpdir(), 'rb-chrome-'));

const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
  '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`,
  `--window-size=${w},${h}`,
  'about:blank'
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function findTarget() {
  for (let i = 0; i < 60; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      const page = list.find((t) => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch { /* not up yet */ }
    await sleep(150);
  }
  throw new Error('Chrome did not come up');
}

const ws = new WebSocket(await findTarget());
await new Promise((r) => { ws.onopen = r; });

let nextId = 1;
const pending = new Map();
const logs = [];

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
    return;
  }
  if (msg.method === 'Runtime.consoleAPICalled') {
    logs.push(`[${msg.params.type}] ${msg.params.args.map((a) => a.value ?? a.description ?? a.type).join(' ')}`);
  }
  if (msg.method === 'Runtime.exceptionThrown') {
    const d = msg.params.exceptionDetails;
    logs.push(`[uncaught] ${d.exception?.description || d.text} @ ${d.url}:${d.lineNumber}`);
  }
  if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') {
    logs.push(`[network] ${msg.params.entry.text} ${msg.params.entry.url || ''}`);
  }
};

const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = nextId++;
  pending.set(id, { resolve, reject });
  ws.send(JSON.stringify({ id, method, params }));
});

await send('Runtime.enable');
await send('Log.enable');
await send('Page.enable');

// Chrome will not make a window narrower than ~500px on Windows, so the
// viewport has to be overridden rather than sized with --window-size.
await send('Emulation.setDeviceMetricsOverride', {
  width: Number(w), height: Number(h), deviceScaleFactor: 1,
  mobile: Number(w) < 700
});

// PRINT=1 renders with print media emulated, to check the print stylesheet.
if (process.env.PRINT) await send('Emulation.setEmulatedMedia', { media: 'print' });

await send('Page.navigate', { url });
await sleep(2200);

if (evalJs) {
  const result = await send('Runtime.evaluate', { expression: evalJs, returnByValue: true, awaitPromise: true });
  console.log('EVAL:', JSON.stringify(result.result.value ?? result.result.description, null, 2));
  await sleep(600); // let any opening animation finish before capturing
}

const shot = await send('Page.captureScreenshot', { format: 'png' });
writeFileSync(out, Buffer.from(shot.data, 'base64'));

console.log(logs.length ? 'CONSOLE:\n' + logs.join('\n') : 'CONSOLE: clean');
console.log('wrote', out);

ws.close();
chrome.kill();
await sleep(300);
try { rmSync(profile, { recursive: true, force: true }); } catch { /* windows lock */ }
process.exit(0);
