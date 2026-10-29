/** Recipe Book — app shell, router and glue.
 *
 *  Ported from the three Claude Design prototypes (Recipe Book, v2, v3).
 *  The views are plain DOM; the look is entirely CSS, chosen by the
 *  `data-theme` / `data-layout` attributes on <html>.
 */

import { CONFIG } from './config.js';
import { h, svg } from './dom.js';
import { store } from './store.js';
import { getTheme, THEMES } from './themes.js';
import { icon } from './icons.js';
import { debounce } from './util.js';
import { renderHome, paintList } from './views/home.js';
import { renderRecipe } from './views/recipe.js';
import { renderCook, releaseWakeLock } from './views/cook.js';
import { renderEdit, blankDraft } from './views/edit.js';
import { settingsSheet, groupSheet, transferSheet, recipeTransferSheet } from './views/sheets.js';

/* ── Transient state (never persisted) ───────────────────────── */

const state = {
  view: 'home',
  groupId: null,
  recipeId: null,
  tab: 'ingredients',
  checked: {},
  cookStep: 0,
  draft: null,
  search: ''
};

let depth = 0;
const scrollMemory = new Map();

/* A `?theme=` / `?layout=` in the URL wins for this visit without being
   written to storage, so a shared link can show off a style without
   hijacking the reader's own choice. */
const OVERRIDE = {};
{
  const params = new URLSearchParams(location.search);
  if (THEMES[params.get('theme')]) OVERRIDE.theme = params.get('theme');
  if (['app', 'web', 'auto'].includes(params.get('layout'))) OVERRIDE.layout = params.get('layout');
}
const currentThemeId = () => OVERRIDE.theme || store.settings.theme;
const currentLayoutPref = () => OVERRIDE.layout || store.settings.layout;

/* ── Context handed to every view ────────────────────────────── */

const ctx = {
  store,
  state,
  theme: getTheme(currentThemeId()),
  copy: getTheme(currentThemeId()).copy,
  layout: 'app',
  installPrompt: null,
  nav: {},
  refreshList: () => paintList(ctx),
  openSettings: () => openSheet(settingsSheet),
  openGroupSheet: () => openSheet(groupSheet),
  openTransfer: () => openSheet(transferSheet),
  openRecipeTransfer: (recipe) => openSheet((c, close) => recipeTransferSheet(c, close, recipe)),
  settingValue: (key) => (key === 'theme' ? currentThemeId() : currentLayoutPref()),
  setTheme: (id) => { delete OVERRIDE.theme; store.saveSettings({ theme: id }); },
  setLayout: (id) => { delete OVERRIDE.layout; store.saveSettings({ layout: id }); },
  install: async () => {
    if (!ctx.installPrompt) return;
    const prompt = ctx.installPrompt;
    ctx.installPrompt = null;
    await prompt.prompt();
    await prompt.userChoice;
  }
};

/* ── Routing ─────────────────────────────────────────────────── */

function parseRoute(hash) {
  const path = (hash || '').replace(/^#\/?/, '').split('/').filter(Boolean);
  if (path.length === 0) return { view: 'home', groupId: null };
  if (path[0] === 'g') return { view: 'home', groupId: path[1] || null };
  if (path[0] === 'new') return { view: 'edit', newIn: path[1] || null };
  if (path[0] === 'r' && path[1]) {
    if (path[2] === 'cook') return { view: 'cook', recipeId: path[1], cookStep: Number(path[3] || 0) };
    if (path[2] === 'edit') return { view: 'edit', recipeId: path[1] };
    return { view: 'recipe', recipeId: path[1] };
  }
  return { view: 'home', groupId: null };
}

function go(hash, { replace = false } = {}) {
  rememberScroll();
  const next = replace ? depth : depth + 1;
  history[replace ? 'replaceState' : 'pushState']({ depth: next }, '', hash);
  depth = next;
  route();
}

ctx.nav = {
  home: (opts) => go('#/', opts),
  group: (id, opts) => go(`#/g/${id}`, opts),
  recipe: (id, opts) => go(`#/r/${id}`, opts),
  // Entering cook mode is a new place; stepping through it is not.
  cook: (id, step, opts) => go(`#/r/${id}/cook/${step}`, { replace: state.view === 'cook', ...opts }),
  edit: (id, opts) => go(`#/r/${id}/edit`, opts),
  newRecipe: (groupId) => go(groupId ? `#/new/${groupId}` : '#/new'),
  back: () => {
    if (depth > 0) history.back();
    else go('#/', { replace: true });
  }
};

function route() {
  const parsed = parseRoute(location.hash);

  if (parsed.view !== 'cook') releaseWakeLock();
  if (parsed.view !== 'edit') state.draft = null;

  if (parsed.view === 'home') {
    state.view = 'home';
    state.groupId = parsed.groupId && store.group(parsed.groupId) ? parsed.groupId : null;
  } else if (parsed.view === 'recipe') {
    if (!store.recipe(parsed.recipeId)) return go('#/', { replace: true });
    if (state.recipeId !== parsed.recipeId) { state.checked = {}; state.tab = 'ingredients'; }
    state.view = 'recipe';
    state.recipeId = parsed.recipeId;
  } else if (parsed.view === 'cook') {
    if (!store.recipe(parsed.recipeId)) return go('#/', { replace: true });
    state.view = 'cook';
    state.recipeId = parsed.recipeId;
    state.cookStep = Number.isFinite(parsed.cookStep) ? parsed.cookStep : 0;
  } else if (parsed.view === 'edit') {
    if (parsed.recipeId) {
      const recipe = store.recipe(parsed.recipeId);
      if (!recipe) return go('#/', { replace: true });
      // Only start a fresh draft when we arrive, not on every repaint.
      if (!state.draft || state.draft.id !== recipe.id) state.draft = structuredClone(recipe);
    } else if (!state.draft || state.draft.id) {
      const fallback = parsed.newIn || state.groupId || store.data.groups[0]?.id || null;
      state.draft = blankDraft(fallback);
    }
    state.view = 'edit';
    state.recipeId = parsed.recipeId || null;
  }

  render();
}

/* ── Rendering ───────────────────────────────────────────────── */

const appRoot = document.getElementById('app');
let screen = null;

function buildShell() {
  appRoot.replaceChildren();
  const rings = h('div', { class: 'rings', 'aria-hidden': 'true' },
    Array.from({ length: 9 }, () => h('i')));
  screen = h('main', { class: 'screen', id: 'screen' });
  appRoot.append(h('div', { class: 'frame' }, rings, screen));
}

function render() {
  if (!screen) buildShell();

  applyTheme();
  applyLayout();

  const view =
    state.view === 'recipe' ? renderRecipe(ctx) :
      state.view === 'cook' ? renderCook(ctx) :
        state.view === 'edit' ? renderEdit(ctx) :
          renderHome(ctx);

  screen.replaceChildren(view);

  // The floating action lives outside the scroller so it stays put.
  appRoot.querySelector('.fab')?.remove();
  if (state.view === 'home') {
    appRoot.querySelector('.frame').append(h('button', {
      class: 'fab', type: 'button',
      onclick: () => ctx.nav.newRecipe(state.groupId)
    }, svg(icon('plus', ctx.theme.id)), ctx.copy.newRecipe));
  }

  restoreScroll();
  document.title = titleFor();
}

function titleFor() {
  // The app name, not the theme's book name: the tab and the installed
  // shortcut should stay findable whichever style is on.
  const base = CONFIG.appName;
  if (state.view === 'recipe' || state.view === 'cook') {
    const recipe = store.recipe(state.recipeId);
    if (recipe) return `${recipe.title} · ${base}`;
  }
  if (state.view === 'edit') return `${state.draft?.id ? ctx.copy.editTitle : ctx.copy.createTitle} · ${base}`;
  if (state.groupId) {
    const group = store.group(state.groupId);
    if (group) return `${group.name} · ${base}`;
  }
  return base;
}

function applyTheme() {
  const theme = getTheme(currentThemeId());
  ctx.theme = theme;
  ctx.copy = theme.copy;
  const root = document.documentElement;
  if (root.dataset.theme !== theme.id) root.dataset.theme = theme.id;
  const fonts = document.getElementById('theme-fonts');
  if (fonts && fonts.getAttribute('href') !== theme.fonts) fonts.href = theme.fonts;
  const meta = document.getElementById('meta-theme-color');
  if (meta) meta.content = theme.themeColor;
  root.style.colorScheme = theme.dark ? 'dark' : 'light';
}

function computeLayout() {
  const setting = currentLayoutPref();
  if (setting === 'app' || setting === 'web') return setting;
  const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  return !standalone && window.innerWidth >= CONFIG.webBreakpoint ? 'web' : 'app';
}

function applyLayout() {
  ctx.layout = computeLayout();
  if (document.documentElement.dataset.layout !== ctx.layout) {
    document.documentElement.dataset.layout = ctx.layout;
  }
}

/* ── Scroll memory ───────────────────────────────────────────── */

const scrollNode = () => (ctx.layout === 'web' ? document.scrollingElement : screen);

function rememberScroll() {
  const node = scrollNode();
  if (node) scrollMemory.set(location.hash || '#/', node.scrollTop);
}

function restoreScroll() {
  const node = scrollNode();
  if (!node) return;
  const remembered = scrollMemory.get(location.hash || '#/');
  node.scrollTop = state.view === 'home' && remembered ? remembered : 0;
}

/* ── Sheets ──────────────────────────────────────────────────── */

const overlay = document.getElementById('overlay');
let lastFocus = null;

function openSheet(builder) {
  lastFocus = document.activeElement;
  const close = () => {
    overlay.hidden = true;
    overlay.replaceChildren();
    document.removeEventListener('keydown', onKey);
    lastFocus?.focus?.();
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };

  overlay.replaceChildren(builder(ctx, close));
  overlay.hidden = false;
  overlay.onclick = (e) => { if (e.target === overlay) close(); };
  document.addEventListener('keydown', onKey);
}

/* ── Wiring ──────────────────────────────────────────────────── */

store.onChange(() => render());
store.onSettings(() => { render(); });

window.addEventListener('popstate', (e) => {
  depth = e.state?.depth ?? 0;
  route();
});

window.addEventListener('resize', debounce(() => {
  const before = ctx.layout;
  applyLayout();
  if (before !== ctx.layout) render();
}, 150));

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  ctx.installPrompt = e;
});

window.addEventListener('appinstalled', () => {
  ctx.installPrompt = null;
});

history.replaceState({ depth: 0 }, '', location.hash || '#/');
buildShell();
route();

/* ── Service worker ──────────────────────────────────────────── */

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(new URL('../sw.js', import.meta.url), { scope: './' })
      .catch((err) => console.warn('recipe-book: service worker not registered', err));
  });
}
