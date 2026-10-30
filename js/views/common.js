/** Pieces shared by more than one view. */

import { h, svg } from '../dom.js';
import { icon } from '../icons.js';
import { groupColor, mediaBackground } from '../themes.js';
import { shortDate } from '../util.js';

export const iconEl = (name, theme) => svg(icon(name, theme));

/** Inline style bag that paints a recipe tile: photo, or the theme's swatch. */
export function mediaVars(ctx, recipe) {
  const group = recipe.groupId ? ctx.store.group(recipe.groupId) : null;
  const color = groupColor(ctx.theme, group);
  return { '--media': mediaBackground(ctx.theme, recipe.photo, color), '--group-color': color };
}

export function difficultyDots(ctx, difficulty) {
  return h('span', { class: 'dots', 'aria-hidden': 'true' },
    [0, 1, 2].map((i) => h('span', { class: i <= difficulty ? 'dot dot--on' : 'dot' })));
}

export function metaLine(ctx, recipe) {
  const { copy } = ctx;
  const time = recipe.time ? `${recipe.time} min` : '– min';
  const diff = copy.diff[recipe.difficulty];
  return h('span', { class: 'rcard__meta' },
    h('span', { text: time }),
    h('span', { class: 'rcard__sep', 'aria-hidden': 'true' }),
    h('span', { text: diff }),
    difficultyDots(ctx, recipe.difficulty));
}

/** One recipe in a list. Emits every decorative variant the themes need
 *  (level plate, group kicker, difficulty dots) and lets CSS choose. */
export function recipeCard(ctx, recipe) {
  const group = recipe.groupId ? ctx.store.group(recipe.groupId) : null;
  const lvBg = ctx.theme.lvBg ? ctx.theme.lvBg[recipe.difficulty] : null;
  const cooked = ctx.store.cookedAt(recipe.id);

  return h('button', {
    class: 'rcard',
    type: 'button',
    dataset: { cooked: cooked ? 'true' : 'false' },
    style: { ...mediaVars(ctx, recipe), '--lv-bg': lvBg },
    onclick: () => ctx.nav.recipe(recipe.id)
  },
    h('span', { class: 'rcard__lv', 'aria-hidden': 'true' },
      h('b', { text: 'LV' }),
      h('span', { text: String(recipe.difficulty + 1) })),
    h('span', { class: 'rcard__media', 'aria-hidden': 'true' },
      cooked ? cookedStamp(ctx, cooked) : null),
    h('span', { class: 'rcard__body' },
      h('span', { class: 'rcard__kicker', text: group ? group.name : 'Unfiled' }),
      h('span', { class: 'rcard__title', text: recipe.title || 'Untitled' }),
      metaLine(ctx, recipe)));
}

/** The "already made this" badge that sits on a cooked recipe's tile. */
function cookedStamp(ctx, when) {
  const { copy } = ctx;
  return h('span', {
    class: 'rcard__cooked',
    title: copy.cookedOn(shortDate(when)),
    'aria-label': copy.cookedOn(shortDate(when))
  }, h('span', { 'aria-hidden': 'true', text: '✓' }));
}

export function sectionHead(title, action) {
  return h('div', { class: 'section__head' },
    h('h2', { class: 'section__title', text: title }),
    action || null);
}

export function emptyState(ctx, { title, text, actions = [] }) {
  return h('div', { class: 'empty' },
    h('p', { class: 'empty__title', text: title }),
    text ? h('p', { class: 'empty__text', text }) : null,
    ...actions);
}

/** A label-wrapped file input used for both the hero and the edit form. */
export function photoPicker({ className, label, onPick, style }) {
  const input = h('input', {
    type: 'file',
    accept: 'image/*',
    onchange: (e) => {
      const file = e.target.files && e.target.files[0];
      e.target.value = '';
      if (file) onPick(file);
    }
  });
  return h('label', { class: className, style }, input, h('span', { text: label }));
}

export function toastHost(message) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const node = h('div', { class: 'toast', role: 'status', text: message });
  document.body.append(node);
  setTimeout(() => node.remove(), 3200);
}
