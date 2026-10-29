/** Cook mode — one step at a time, big type, thumb-sized targets.
 *  Arrow keys work too, and the screen is asked to stay awake. */

import { h } from '../dom.js';
import { groupColor } from '../themes.js';
import { clamp } from '../util.js';

let wakeLock = null;

export function renderCook(ctx) {
  const { store, theme, copy, state } = ctx;
  const recipe = store.recipe(state.recipeId);
  if (!recipe || recipe.steps.length === 0) {
    return h('div', { class: 'view', style: 'padding:60px 22px' },
      h('p', { class: 'empty__title', text: 'Nothing to cook here yet.' }),
      h('button', { class: 'btn btn--primary', type: 'button', style: 'margin-top:16px', onclick: () => ctx.nav.home() }, 'Back to the book'));
  }

  const total = recipe.steps.length;
  const index = clamp(state.cookStep, 0, total - 1);
  const group = recipe.groupId ? store.group(recipe.groupId) : null;
  const last = index >= total - 1;

  const pips = h('div', { class: 'cook__pips', 'aria-hidden': 'true' },
    recipe.steps.map((_, i) => h('i', { class: i <= index ? 'on' : '' })));

  const stepNumber = h('div', { class: 'cook__n', 'aria-hidden': 'true', text: String(index + 1) });
  const stepText = h('p', { class: 'cook__text', text: recipe.steps[index] });

  // Pixel frames the step in a card; the others let it sit on the page.
  const body = theme.id === 'pixel'
    ? [h('div', { class: 'cook__card' }, stepNumber, stepText)]
    : [stepNumber, stepText];

  const page = h('div', { class: 'view cook-page' },
    h('div', { class: 'cook', style: { '--group-color': groupColor(theme, group) } },
      h('div', { class: 'cook__top' },
        h('button', { class: 'btn btn--soft', type: 'button', onclick: () => ctx.nav.recipe(recipe.id) }, copy.cookClose),
        h('span', { class: 'cook__badge', text: copy.cookStep(index + 1, total) })),
      h('div', { class: 'cook__bar', role: 'progressbar', 'aria-valuenow': index + 1, 'aria-valuemin': 1, 'aria-valuemax': total },
        h('div', { class: 'cook__fill', style: { width: `${((index + 1) / total) * 100}%` } })),
      pips,
      h('p', { class: 'cook__kicker', text: recipe.title }),
      ...body,
      h('div', { class: 'cook__nav' },
        h('button', {
          class: 'btn btn--prev', type: 'button', disabled: index === 0,
          onclick: () => ctx.nav.cook(recipe.id, index - 1)
        }, copy.cookBack),
        h('button', {
          class: 'btn btn--next', type: 'button',
          onclick: () => (last ? ctx.nav.recipe(recipe.id) : ctx.nav.cook(recipe.id, index + 1))
        }, last ? copy.cookDone : copy.cookNext))));

  page.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' && !last) ctx.nav.cook(recipe.id, index + 1);
    if (e.key === 'ArrowLeft' && index > 0) ctx.nav.cook(recipe.id, index - 1);
    if (e.key === 'Escape') ctx.nav.recipe(recipe.id);
  });
  page.tabIndex = -1;
  queueMicrotask(() => page.focus({ preventScroll: true }));

  requestWakeLock();
  return page;
}

async function requestWakeLock() {
  if (!('wakeLock' in navigator) || wakeLock) return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => { wakeLock = null; });
  } catch { /* battery saver, unsupported, or no user gesture — not important */ }
}

export function releaseWakeLock() {
  if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; }
}
