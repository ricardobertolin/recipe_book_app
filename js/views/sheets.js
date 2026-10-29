/** The bottom sheets: Settings, "new group", and the two transfer sheets. */

import { h } from '../dom.js';
import { THEMES, THEME_IDS, numeral } from '../themes.js';
import { download } from '../util.js';
import { toastHost } from './common.js';
import {
  toJSON, parseJSON, bookToMarkdown, recipeToMarkdown,
  bookFilename, recipeFilename, copyText, canShare, shareText
} from '../formats.js';

/* ── Settings ─────────────────────────────────────────────────── */

export function settingsSheet(ctx, close) {
  const { store, copy } = ctx;
  const sheet = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': copy.settings });

  sheet.append(
    h('div', { class: 'sheet__grab', 'aria-hidden': 'true' }),
    h('div', { class: 'row-between' },
      h('h2', { class: 'sheet__title', text: copy.settings }),
      h('button', { class: 'btn btn--soft', type: 'button', onclick: close }, 'Done')));

  // Style
  const themeOpts = h('div', { class: 'opts' });
  for (const id of THEME_IDS) {
    const theme = THEMES[id];
    themeOpts.append(h('button', {
      class: 'opt', type: 'button',
      'aria-pressed': ctx.settingValue('theme') === id ? 'true' : 'false',
      onclick: () => { ctx.setTheme(id); close(); }
    },
      h('span', {
        class: 'opt__swatch',
        style: { background: theme.surface, boxShadow: `inset 0 0 0 1px rgba(128,128,128,.35)` }
      }, theme.palette.slice(0, 4).map((c) => h('i', { style: { background: c } }))),
      h('span', { class: 'opt__name', text: theme.name }),
      h('span', { class: 'opt__hint', text: theme.hint })));
  }
  sheet.append(h('div', { class: 'setting' },
    h('span', { class: 'setting__label', text: 'Style' }),
    themeOpts));

  // Layout
  const layouts = [
    ['auto', 'Auto', 'Phone shell on small screens, website on big ones.'],
    ['app', 'App', 'Always the phone shell.'],
    ['web', 'Website', 'Always the wide layout.']
  ];
  const layoutOpts = h('div', { class: 'opts', style: 'grid-template-columns:repeat(3,1fr)' });
  for (const [id, name, hint] of layouts) {
    layoutOpts.append(h('button', {
      class: 'opt', type: 'button',
      'aria-pressed': ctx.settingValue('layout') === id ? 'true' : 'false',
      onclick: () => { ctx.setLayout(id); close(); }
    },
      h('span', { class: 'opt__name', text: name }),
      h('span', { class: 'opt__hint', text: hint })));
  }
  sheet.append(h('div', { class: 'setting' },
    h('span', { class: 'setting__label', text: 'Layout' }),
    layoutOpts));

  // Install
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  if (!standalone) {
    const install = h('div', { class: 'setting' },
      h('span', { class: 'setting__label', text: 'Install on your phone' }));
    if (ctx.installPrompt) install.append(h('button', {
      class: 'btn btn--primary btn--block', type: 'button',
      onclick: async () => { await ctx.install(); close(); }
    }, 'Install Recipe Book'));
    install.append(h('p', { class: 'opt__hint', text:
      'Android: open the browser menu and choose Install app or Add to Home screen. ' +
      'iPhone / iPad: open in Safari, tap Share, then Add to Home Screen. ' +
      'Keep Open as Web App enabled if shown, then tap Add.' }));
    sheet.append(install);
  }

  // Data
  sheet.append(h('div', { class: 'setting' },
    h('span', { class: 'setting__label', text: 'Your recipes' }),
    h('div', { style: 'display:flex;gap:10px;flex-wrap:wrap' },
      h('button', {
        class: 'btn btn--soft', type: 'button',
        onclick: () => { close(); ctx.openTransfer(); }
      }, 'Import / export'),
      h('button', {
        class: 'btn btn--outline', type: 'button',
        onclick: () => {
          if (!window.confirm('Replace everything with the sample recipes?')) return;
          store.reset();
          toastHost('Back to the samples.');
          close();
        }
      }, 'Reset')),
    h('p', { class: 'opt__hint', text: `${store.data.recipes.length} recipes · ${store.data.groups.length} groups · stored on this device only` }),
    store.storageError ? h('p', { class: 'field__error', text: store.storageError }) : null));

  return sheet;
}

/* ── Import / export: the whole book ──────────────────────────── */

export function transferSheet(ctx, close) {
  const { store, copy } = ctx;
  const sheet = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Import and export' });
  let mode = 'merge';

  sheet.append(
    h('div', { class: 'sheet__grab', 'aria-hidden': 'true' }),
    h('div', { class: 'row-between' },
      h('h2', { class: 'sheet__title', text: 'Import / export' }),
      h('button', { class: 'btn btn--soft', type: 'button', onclick: close }, 'Done')));

  /* Export */
  const json = () => toJSON(store.data);
  const markdown = () => bookToMarkdown(store.data, copy.diff);

  sheet.append(h('div', { class: 'setting' },
    h('span', { class: 'setting__label', text: 'Export' }),
    h('div', { class: 'btnrow' },
      h('button', {
        class: 'btn btn--soft', type: 'button',
        onclick: () => { download(bookFilename('json'), json()); toastHost('Backup saved.'); }
      }, 'JSON file'),
      h('button', {
        class: 'btn btn--soft', type: 'button',
        onclick: () => { download(bookFilename('md'), markdown(), 'text/markdown'); toastHost('Markdown saved.'); }
      }, 'Markdown file'),
      h('button', {
        class: 'btn btn--soft', type: 'button',
        onclick: async () => toastHost(await copyText(json()) ? 'JSON copied.' : 'Could not copy.')
      }, 'Copy JSON'),
      h('button', {
        class: 'btn btn--soft', type: 'button',
        onclick: async () => toastHost(await copyText(markdown()) ? 'Markdown copied.' : 'Could not copy.')
      }, 'Copy Markdown')),
    h('p', { class: 'opt__hint', text: 'JSON keeps everything, photos included, and can be imported back. Markdown is for reading and sharing.' })));

  /* Import */
  const modeRow = h('div', { class: 'opts', style: 'grid-template-columns:1fr 1fr' });
  const paintMode = () => {
    modeRow.replaceChildren();
    for (const [id, name, hint] of [
      ['merge', 'Merge', 'Add what is missing. Nothing already here is lost.'],
      ['replace', 'Replace', 'Throw away this book and use the file instead.']
    ]) {
      modeRow.append(h('button', {
        class: 'opt', type: 'button', 'aria-pressed': mode === id ? 'true' : 'false',
        onclick: () => { mode = id; paintMode(); }
      },
        h('span', { class: 'opt__name', text: name }),
        h('span', { class: 'opt__hint', text: hint })));
    }
  };
  paintMode();

  const status = h('p', { class: 'opt__hint', hidden: true });

  function apply(text) {
    const parsed = parseJSON(text);
    if (!parsed.ok) {
      status.hidden = false;
      status.className = 'field__error';
      status.textContent = parsed.error;
      return;
    }
    if (mode === 'replace' &&
        !window.confirm(`Replace all ${store.data.recipes.length} recipes with the ${parsed.counts.recipes} in this file?`)) {
      return;
    }
    try {
      const result = mode === 'replace' ? store.replaceAll(parsed.data) : store.merge(parsed.data);
      toastHost(mode === 'replace'
        ? `Replaced with ${result.recipes} recipes.`
        : `Added ${result.recipes} ${result.recipes === 1 ? 'recipe' : 'recipes'}${result.skipped ? `, skipped ${result.skipped} already here` : ''}.`);
      close();
    } catch (err) {
      status.hidden = false;
      status.className = 'field__error';
      status.textContent = err.message || 'That file could not be read.';
    }
  }

  const fileInput = h('input', {
    type: 'file', accept: 'application/json,.json', style: 'display:none',
    onchange: async (e) => {
      const file = e.target.files && e.target.files[0];
      e.target.value = '';
      if (file) apply(await file.text());
    }
  });

  const paste = h('textarea', {
    class: 'textarea', rows: 4, hidden: true,
    placeholder: 'Paste the contents of an export here', 'aria-label': 'Paste JSON to import'
  });

  sheet.append(h('div', { class: 'setting' },
    h('span', { class: 'setting__label', text: 'Import' }),
    modeRow,
    h('div', { class: 'btnrow' },
      h('button', { class: 'btn btn--soft', type: 'button', onclick: () => fileInput.click() }, 'Choose a file'),
      h('button', {
        class: 'btn btn--soft', type: 'button',
        onclick: (e) => {
          paste.hidden = !paste.hidden;
          e.currentTarget.textContent = paste.hidden ? 'Paste JSON' : 'Hide box';
          if (!paste.hidden) paste.focus();
        }
      }, 'Paste JSON'),
      fileInput),
    paste,
    h('button', {
      class: 'btn btn--primary btn--block', type: 'button',
      onclick: () => {
        if (paste.hidden || !paste.value.trim()) { fileInput.click(); return; }
        apply(paste.value);
      }
    }, 'Import'),
    status,
    h('p', { class: 'opt__hint', text: 'Import reads the JSON this app exports. Markdown is export only.' })));

  return sheet;
}

/* ── Export one recipe ────────────────────────────────────────── */

export function recipeTransferSheet(ctx, close, recipe) {
  const { store, copy } = ctx;
  const sheet = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': `Share ${recipe.title}` });

  const md = () => recipeToMarkdown(store.data, recipe, copy.diff);
  const json = () => toJSON(store.data, [recipe]);

  sheet.append(
    h('div', { class: 'sheet__grab', 'aria-hidden': 'true' }),
    h('div', { class: 'row-between' },
      h('h2', { class: 'sheet__title', text: 'Share this recipe' }),
      h('button', { class: 'btn btn--soft', type: 'button', onclick: close }, 'Done')),
    h('p', { class: 'opt__hint', text: recipe.title }));

  const row = h('div', { class: 'btnrow' });

  if (canShare()) {
    row.append(h('button', {
      class: 'btn btn--primary', type: 'button',
      onclick: async () => { await shareText(recipe.title, md()); close(); }
    }, 'Share'));
  }

  row.append(
    h('button', {
      class: 'btn btn--soft', type: 'button',
      onclick: async () => toastHost(await copyText(md()) ? 'Copied as Markdown.' : 'Could not copy.')
    }, 'Copy text'),
    h('button', {
      class: 'btn btn--soft', type: 'button',
      onclick: () => { download(recipeFilename(recipe, 'md'), md(), 'text/markdown'); toastHost('Markdown saved.'); }
    }, 'Markdown file'),
    h('button', {
      class: 'btn btn--soft', type: 'button',
      onclick: () => { download(recipeFilename(recipe, 'json'), json()); toastHost('Recipe saved.'); }
    }, 'JSON file'),
    h('button', {
      class: 'btn btn--soft', type: 'button',
      onclick: () => { close(); setTimeout(() => window.print(), 80); }
    }, 'Print'));

  sheet.append(row);
  sheet.append(h('p', { class: 'opt__hint', text: 'The JSON file imports back into any Recipe Book, photo and all.' }));
  return sheet;
}

/* ── New group ────────────────────────────────────────────────── */

export function groupSheet(ctx, close) {
  const { store, theme, copy } = ctx;
  let colorIndex = store.data.groups.length % theme.palette.length;

  const sheet = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': copy.newGroupTitle });
  const input = h('input', {
    class: 'input', type: 'text', placeholder: copy.newGroupPlaceholder,
    'aria-label': copy.newGroupTitle, autocomplete: 'off',
    onkeydown: (e) => { if (e.key === 'Enter') { e.preventDefault(); create(); } }
  });
  const error = h('p', { class: 'field__error', hidden: true, text: 'Give the group a name.' });

  const swatches = h('div', { class: 'swatches' });
  const paintSwatches = () => {
    swatches.replaceChildren();
    theme.palette.forEach((color, i) => {
      swatches.append(h('button', {
        class: 'swatch', type: 'button', 'aria-label': `Colour ${i + 1}`,
        'aria-pressed': colorIndex === i ? 'true' : 'false',
        style: { '--sw': color, background: color },
        onclick: () => { colorIndex = i; paintSwatches(); }
      }));
    });
  };
  paintSwatches();

  function create() {
    const name = input.value.trim();
    if (!name) { error.hidden = false; input.focus(); return; }
    const group = store.addGroup(name, colorIndex);
    close();
    ctx.nav.group(group.id);
  }

  sheet.append(
    h('div', { class: 'sheet__grab', 'aria-hidden': 'true' }),
    theme.numerals
      ? h('p', { class: 'sheet__kicker', text: `Chapter ${numeral(store.data.groups.length)}` })
      : null,
    h('h2', { class: 'sheet__title', text: copy.newGroupTitle }),
    input,
    error,
    swatches,
    h('div', { style: 'display:flex;gap:10px' },
      h('button', { class: 'btn btn--soft', type: 'button', style: 'flex:1', onclick: close }, copy.cancel),
      h('button', { class: 'btn btn--primary', type: 'button', style: 'flex:1', onclick: create }, copy.createGroup)));

  queueMicrotask(() => input.focus());
  return sheet;
}
