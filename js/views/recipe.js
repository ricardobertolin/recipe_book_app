/** Recipe detail — hero, stats, then ingredients / steps / notes.
 *  Playful and Editorial tab between the three panels; Pixel stacks them,
 *  and so does the website shell, which has the width for it. */

import { h } from '../dom.js';
import { CONFIG } from '../config.js';
import { groupColor } from '../themes.js';
import { coverPhoto } from '../store.js';
import { readImageFile, shortDate } from '../util.js';
import { iconEl, mediaVars, photoPicker, difficultyDots, toastHost, starRow, avgLabel } from './common.js';

export function renderRecipe(ctx) {
  const { store, theme, copy, state } = ctx;
  const recipe = store.recipe(state.recipeId);
  if (!recipe) return missing(ctx);

  const group = recipe.groupId ? store.group(recipe.groupId) : null;
  const page = h('div', { class: 'view recipe-page', style: mediaVars(ctx, recipe) });

  page.append(hero(ctx, recipe));
  page.append(h('div', { class: 'sheetTop' },
    head(ctx, recipe, group),
    h('div', { class: 'marks' },
      cookedToggle(ctx, recipe),
      ratingRow(ctx, recipe)),
    stats(ctx, recipe),
    panels(ctx, recipe)));

  return page;
}

function missing(ctx) {
  return h('div', { class: 'view', style: 'padding:60px 22px' },
    h('p', { class: 'empty__title', text: 'That recipe is gone.' }),
    h('button', { class: 'btn btn--primary', type: 'button', style: 'margin-top:16px', onclick: () => ctx.nav.home() }, 'Back to the book'));
}

function hero(ctx, recipe) {
  const { theme, copy } = ctx;
  const cover = coverPhoto(recipe);
  return h('div', { class: 'hero' },
    h('div', { class: 'hero__bar' },
      h('button', {
        class: 'iconbtn', type: 'button', 'aria-label': copy.back, title: copy.back,
        onclick: () => ctx.nav.back()
      }, iconEl('back', theme.id)),
      h('div', { class: 'hero__tools' },
        h('button', {
          class: 'iconbtn', type: 'button', 'aria-label': 'Share or export', title: 'Share or export',
          onclick: () => ctx.openRecipeTransfer(recipe)
        }, iconEl('share', theme.id)),
        h('button', {
          class: 'btn', type: 'button', onclick: () => ctx.nav.edit(recipe.id)
        }, iconEl('edit', theme.id), copy.edit))),
    cover
      ? h('button', {
        class: 'hero__album', type: 'button',
        'aria-label': copy.albumTitle, title: copy.albumTitle,
        onclick: () => ctx.openAlbum(recipe.id)
      },
        cover.date ? h('span', { class: 'hero__stamp', text: shortDate(cover.date) }) : null,
        h('span', { text: copy.photoCount(recipe.photos.length) }))
      : null,
    photoPicker({
      className: 'hero__photo',
      label: copy.addPhoto,
      onPick: (file) => pickPhoto(ctx, recipe.id, file)
    }));
}

/** New photos always join the album; the first one doubles as the cover. */
async function pickPhoto(ctx, id, file) {
  try {
    const url = await readImageFile(file, CONFIG.maxPhotoEdge, CONFIG.photoQuality);
    const had = ctx.store.recipe(id).photos.length;
    ctx.store.addPhoto(id, url);
    if (had > 0) toastHost(ctx.copy.photoAdded);
  } catch (err) {
    toastHost(err.message || 'Could not read that image.');
  }
}

function head(ctx, recipe, group) {
  const { theme, copy } = ctx;
  return h('div', { class: 'recipe__head', style: { '--group-color': groupColor(theme, group) } },
    h('span', { class: 'recipe__kicker', text: group ? group.name : 'Unfiled' }),
    h('h1', { class: 'recipe__title', text: recipe.title || 'Untitled' }));
}

/** Have I made this one yet? Set automatically when cook mode finishes,
 *  and togglable by hand for the dishes cooked before the app existed. */
function cookedToggle(ctx, recipe) {
  const { store, copy } = ctx;
  const when = store.cookedAt(recipe.id);
  return h('button', {
    class: 'cooked', type: 'button',
    'aria-pressed': when ? 'true' : 'false',
    onclick: () => store.toggleCooked(recipe.id)
  },
    h('span', { class: 'cooked__box', 'aria-hidden': 'true', text: when ? '✓' : '' }),
    h('span', { class: 'cooked__label', text: when ? copy.cookedOn(shortDate(when)) : copy.markCooked }));
}

/** The dish's running score. Every cooking adds a 0–5 note; this shows the
 *  average so far. Tapping the score opens the history of every note,
 *  the Rate button adds another. */
function ratingRow(ctx, recipe) {
  const { store, copy } = ctx;
  const avg = store.ratingAvg(recipe.id);
  const count = store.ratingsFor(recipe.id).length;
  return h('div', { class: 'raterow' },
    h('button', {
      class: 'raterow__open', type: 'button',
      'aria-label': copy.scoreHistoryTitle, title: copy.scoreHistoryTitle,
      onclick: () => ctx.openRatingHistory(recipe.id)
    },
      avg === null
        ? h('span', { class: 'raterow__label', text: copy.notRated })
        : h('span', { class: 'raterow__score' },
          starRow(avg),
          h('span', {
            class: 'raterow__label',
            text: `${avgLabel(avg)} · ${copy.ratingCount(count)}`
          }))),
    h('button', {
      class: 'btn btn--soft raterow__btn', type: 'button',
      onclick: () => ctx.openRating(recipe.id)
    }, copy.rate));
}

function stats(ctx, recipe) {
  const { copy, theme } = ctx;
  const unit = theme.statsUnit !== false;
  const diffCell = theme.lvBg
    ? h('span', { class: 'stat__v', text: String(recipe.difficulty + 1) })
    : h('span', { class: 'stat__v' },
      copy.diff[recipe.difficulty],
      theme.id === 'playful' ? difficultyDots(ctx, recipe.difficulty) : null);

  return h('div', { class: 'stats' },
    h('div', { class: 'stat' },
      h('span', { class: 'stat__k', text: copy.stats.time }),
      h('span', { class: 'stat__v', text: recipe.time ? (unit ? `${recipe.time} min` : String(recipe.time)) : '–' })),
    h('div', { class: 'stat' },
      h('span', { class: 'stat__k', text: copy.stats.servings }),
      h('span', { class: 'stat__v', text: recipe.servings ? String(recipe.servings) : '–' })),
    h('div', { class: 'stat' },
      h('span', { class: 'stat__k', text: copy.stats.difficulty }),
      diffCell));
}

function panels(ctx, recipe) {
  const { theme, copy, state } = ctx;
  const mode = ctx.layout === 'web' ? 'stack' : theme.panelMode;

  const wrap = h('div', { class: 'panels', dataset: { mode, active: state.tab } });

  const tabs = h('div', { class: 'tabs', role: 'tablist' });
  for (const key of ['ingredients', 'steps', 'notes']) {
    tabs.append(h('button', {
      class: 'tab', type: 'button', role: 'tab',
      'aria-selected': state.tab === key ? 'true' : 'false',
      onclick: () => {
        state.tab = key;
        wrap.dataset.active = key;
        tabs.querySelectorAll('.tab').forEach((t, i) =>
          t.setAttribute('aria-selected', ['ingredients', 'steps', 'notes'][i] === key ? 'true' : 'false'));
      }
    }, copy.tabs[key]));
  }
  wrap.append(tabs);

  wrap.append(panel('ingredients', copy.tabs.ingredients, ingredients(ctx, recipe)));
  wrap.append(panel('steps', copy.tabs.steps, steps(ctx, recipe)));
  wrap.append(panel('notes', copy.tabs.notes, notes(ctx, recipe)));
  return wrap;
}

const panel = (key, title, ...body) =>
  h('section', { class: 'panel', dataset: { panel: key } },
    h('h2', { class: 'panel__title', text: title }), ...body);

function ingredients(ctx, recipe) {
  const { state } = ctx;
  if (recipe.ingredients.length === 0) {
    return h('p', { class: 'empty__text', text: 'No ingredients listed.' });
  }
  const list = h('div', { class: 'ings' });
  recipe.ingredients.forEach((item, i) => {
    const checked = !!state.checked[i];
    const row = h('button', {
      class: 'ing', type: 'button', 'aria-pressed': checked ? 'true' : 'false',
      onclick: () => {
        state.checked[i] = !state.checked[i];
        row.setAttribute('aria-pressed', state.checked[i] ? 'true' : 'false');
        tick.textContent = state.checked[i] ? '✓' : '';
      }
    });
    const tick = h('span', { class: 'ing__box', 'aria-hidden': 'true', text: checked ? '✓' : '' });
    row.append(tick,
      h('span', { class: 'ing__name', text: item.name }),
      h('span', { class: 'ing__qty', text: item.qty }));
    list.append(row);
  });
  return list;
}

function steps(ctx, recipe) {
  const { copy, theme } = ctx;
  const group = recipe.groupId ? ctx.store.group(recipe.groupId) : null;
  const list = h('div', { class: 'steps', style: { '--group-color': groupColor(theme, group) } });

  recipe.steps.forEach((text, i) => {
    list.append(h('div', { class: 'step' },
      h('span', { class: 'step__n', 'aria-hidden': 'true', text: String(i + 1) }),
      h('p', { class: 'step__text', text })));
  });

  if (recipe.steps.length === 0) {
    list.append(h('p', { class: 'empty__text', text: 'No steps yet.' }));
  } else {
    list.append(h('button', {
      class: `btn btn--lg btn--block ${theme.id === 'pixel' ? 'btn--go' : 'btn--primary'}`,
      type: 'button', style: 'margin-top:6px',
      onclick: () => ctx.nav.cook(recipe.id, 0)
    }, copy.startCook));
  }
  return list;
}

function notes(ctx, recipe) {
  const { copy } = ctx;
  return h('div', { style: 'display:flex;flex-direction:column;gap:12px;align-items:flex-start' },
    h('div', { class: 'notes' }, h('span', { text: recipe.notes || copy.noNotes })),
    h('button', {
      class: 'linkbtn', type: 'button', onclick: () => ctx.nav.edit(recipe.id)
    }, copy.editNotes));
}
