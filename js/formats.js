/** Turning the book into something you can carry elsewhere, and back again.
 *
 *  JSON is the round-trip format: a single recipe exports as a one-recipe
 *  book, so there is only ever one shape to import.
 *  Markdown is export only, for pasting into notes or sending to someone.
 */

import { todayStamp } from './util.js';

export const FILE_KIND = 'recipe-book';
export const FILE_VERSION = 2;

const DIFF = ['Easy', 'Medium', 'Hard'];

/* ── JSON ─────────────────────────────────────────────────────── */

/**
 * @param {object} data   the whole book
 * @param {object[]} [recipes] subset to export; defaults to all of them
 * @param {object} [opts] `withPhotos: false` strips the data URLs
 */
export function toJSON(data, recipes = data.recipes, opts = {}) {
  const withPhotos = opts.withPhotos !== false;
  const used = new Set(recipes.map((r) => r.groupId).filter(Boolean));
  const ids = new Set(recipes.map((r) => r.id));
  const cooked = Object.fromEntries(
    Object.entries(data.cooked || {}).filter(([id]) => ids.has(id)));
  return JSON.stringify({
    app: FILE_KIND,
    version: FILE_VERSION,
    exported: new Date().toISOString(),
    groups: data.groups.filter((g) => used.has(g.id)),
    recipes: recipes.map((r) => (withPhotos ? r : { ...r, photo: null })),
    cooked
  }, null, 2);
}

/** Parse an import, with messages a human can act on. */
export function parseJSON(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: 'That is not valid JSON. Paste the contents of an export file.' };
  }
  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, error: 'That file is empty.' };
  }
  if (!Array.isArray(parsed.recipes) || !Array.isArray(parsed.groups)) {
    return { ok: false, error: 'That file has no recipes and groups in it. Expected a Recipe Book export.' };
  }
  return {
    ok: true,
    data: parsed,
    counts: { recipes: parsed.recipes.length, groups: parsed.groups.length }
  };
}

/* ── Markdown ─────────────────────────────────────────────────── */

const esc = (s) => String(s ?? '').replace(/\r\n/g, '\n').trim();

function recipeBody(recipe, { diff = DIFF, heading = '##' } = {}) {
  const lines = [];
  lines.push(`${heading} ${esc(recipe.title) || 'Untitled'}`, '');

  const facts = [
    recipe.time ? `${recipe.time} min` : null,
    recipe.servings ? `Serves ${recipe.servings}` : null,
    diff[recipe.difficulty] || null
  ].filter(Boolean);
  if (facts.length) lines.push(`_${facts.join(' · ')}_`, '');

  if (recipe.ingredients.length) {
    lines.push('**Ingredients**', '');
    for (const item of recipe.ingredients) {
      const qty = esc(item.qty);
      lines.push(qty ? `- **${qty}** ${esc(item.name)}` : `- ${esc(item.name)}`);
    }
    lines.push('');
  }

  if (recipe.steps.length) {
    lines.push('**Method**', '');
    recipe.steps.forEach((step, i) => lines.push(`${i + 1}. ${esc(step)}`));
    lines.push('');
  }

  const notes = esc(recipe.notes);
  if (notes) {
    lines.push('**Notes**', '');
    lines.push(...notes.split('\n').map((line) => `> ${line}`));
    lines.push('');
  }

  return lines;
}

export function recipeToMarkdown(data, recipe, diff) {
  const group = recipe.groupId ? data.groups.find((g) => g.id === recipe.groupId) : null;
  const lines = recipeBody(recipe, { diff, heading: '#' });
  if (group) lines.splice(2, 0, `_${esc(group.name)}_`, '');
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

export function bookToMarkdown(data, diff) {
  const lines = [
    '# Recipe Book',
    '',
    `_${data.recipes.length} recipes in ${data.groups.length} groups · exported ${todayStamp()}_`,
    ''
  ];

  const unfiled = data.recipes.filter((r) => !r.groupId || !data.groups.some((g) => g.id === r.groupId));
  const sections = [
    ...data.groups.map((g) => [g.name, data.recipes.filter((r) => r.groupId === g.id)]),
    ...(unfiled.length ? [['Unfiled', unfiled]] : [])
  ];

  for (const [name, recipes] of sections) {
    if (!recipes.length) continue;
    lines.push(`## ${esc(name)}`, '');
    for (const recipe of recipes) lines.push(...recipeBody(recipe, { diff, heading: '###' }));
  }

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

/* ── Filenames ────────────────────────────────────────────────── */

export const slug = (text) => esc(text)
  .toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 48) || 'recipe';

export const bookFilename = (ext) => `recipe-book-${todayStamp()}.${ext}`;
export const recipeFilename = (recipe, ext) => `${slug(recipe.title)}.${ext}`;

/* ── Clipboard ────────────────────────────────────────────────── */

/** Clipboard API needs a secure context, so fall back to a hidden textarea. */
export async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* fall through to the legacy path */ }

  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.cssText = 'position:fixed;top:-1000px;opacity:0';
  document.body.append(area);
  area.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch { ok = false; }
  area.remove();
  return ok;
}

export function canShare() {
  return typeof navigator.share === 'function';
}

export async function shareText(title, text) {
  try {
    await navigator.share({ title, text });
    return true;
  } catch (err) {
    // AbortError just means the user dismissed the share sheet.
    if (err && err.name === 'AbortError') return true;
    return false;
  }
}
