/** Home — masthead, search, groups and the recipe list.
 *
 *  Two group behaviours, chosen by the theme:
 *   groupNav 'page'   (Playful, Editorial) picking a group opens it as its
 *                     own page, the way v1/v2 did.
 *   groupNav 'filter' (Pixel) the groups are a chip rail that filters the
 *                     list in place, the way v3 did.
 *  The website shell always keeps the rail visible and filters in place,
 *  because there is room for both.
 */

import { h } from '../dom.js';
import { groupColor, mediaBackground, numeral } from '../themes.js';
import { debounce } from '../util.js';
import { iconEl, recipeCard, sectionHead, emptyState } from './common.js';

export function renderHome(ctx) {
  const { store, theme, state } = ctx;
  const web = ctx.layout === 'web';
  const activeGroup = state.groupId ? store.group(state.groupId) : null;

  // A dedicated chapter page only happens in the phone shell for the themes
  // that want one; the website always shows the rail alongside.
  const chapterPage = !!activeGroup && !web && theme.groupNav === 'page';

  const view = h('div', { class: 'view home', dataset: { filtered: activeGroup ? 'true' : 'false' } });

  if (chapterPage) {
    view.append(groupHeader(ctx, activeGroup));
  } else {
    view.append(masthead(ctx), searchBar(ctx));
    view.append(groupsSection(ctx, activeGroup));
  }

  view.append(listSection(ctx, activeGroup, chapterPage));
  return view;
}

/* ── Masthead ─────────────────────────────────────────────────── */

function masthead(ctx) {
  const { store, theme, copy } = ctx;
  return h('header', { class: 'masthead' },
    h('div', { class: 'masthead__text' },
      h('h1', { class: 'masthead__title', html: copy.titleHTML }),
      h('div', { class: 'masthead__rule', 'aria-hidden': 'true' }),
      h('p', { class: 'masthead__sub', text: copy.tagline(store.data.recipes.length, store.data.groups.length) })),
    h('div', { class: 'masthead__actions' },
      h('button', {
        class: 'btn btn--primary masthead__new', type: 'button',
        onclick: () => ctx.nav.newRecipe()
      }, copy.newRecipe),
      h('button', {
        class: 'iconbtn', type: 'button', 'aria-label': copy.settings, title: copy.settings,
        onclick: () => ctx.openSettings()
      }, iconEl('gear', theme.id)),
      h('div', { class: 'masthead__mark', 'aria-hidden': 'true' }, iconEl('chef', theme.id))));
}

function groupHeader(ctx, group) {
  const { store, theme, copy } = ctx;
  const index = store.groupIndex(group.id);
  const recipes = store.recipesIn(group.id);
  return h('header', { class: 'masthead masthead--group', style: { '--group-color': groupColor(theme, group) } },
    h('div', { class: 'masthead__text' },
      h('button', {
        class: 'btn btn--ghost filterbar__back', type: 'button', onclick: () => ctx.nav.home()
      }, iconEl('backLong', theme.id), copy.groupsTitle),
      theme.numerals
        ? h('p', { class: 'eyebrow', text: `Chapter ${numeral(index)}` })
        : null,
      h('h1', { class: 'masthead__title', text: group.name }),
      h('div', { class: 'masthead__rule', 'aria-hidden': 'true' }),
      h('p', { class: 'masthead__sub', text: copy.count(recipes.length) })),
    h('div', { class: 'masthead__actions' },
      h('button', {
        class: 'iconbtn', type: 'button', 'aria-label': copy.settings, title: copy.settings,
        onclick: () => ctx.openSettings()
      }, iconEl('gear', theme.id))));
}

/* ── Search ───────────────────────────────────────────────────── */

function searchBar(ctx) {
  const { theme, copy, state } = ctx;

  const input = h('input', {
    type: 'search',
    value: state.search,
    placeholder: copy.searchPlaceholder,
    'aria-label': copy.searchPlaceholder,
    autocomplete: 'off',
    oninput: debounce((e) => {
      state.search = e.target.value;
      ctx.refreshList();
    }, 120)
  });

  return h('div', { class: 'search', role: 'search' },
    iconEl('search', theme.id),
    input,
    h('button', {
      class: 'search__clear', type: 'button', 'aria-label': 'Clear search',
      onclick: () => { input.value = ''; state.search = ''; ctx.refreshList(); input.focus(); }
    }, '×'));
}

/* ── Groups ───────────────────────────────────────────────────── */

function groupsSection(ctx, activeGroup) {
  const { store, theme, copy } = ctx;
  const section = h('section', { class: 'section groups-section' });

  section.append(sectionHead(copy.groupsTitle,
    h('button', {
      class: 'btn btn--soft section__action', type: 'button', onclick: () => ctx.openGroupSheet()
    }, copy.newGroup)));

  const list = h('div', { class: 'groups' });

  // "All" only earns a slot when the rail doubles as a filter.
  const filtering = theme.groupNav === 'filter' || ctx.layout === 'web';
  if (filtering) {
    list.append(groupChip(ctx, null, !activeGroup));
  }

  store.data.groups.forEach((group, i) => {
    list.append(groupChip(ctx, group, activeGroup?.id === group.id, i));
  });

  section.append(list);
  return section;
}

function groupChip(ctx, group, current, index = 0) {
  const { store, theme, copy } = ctx;
  const color = group ? groupColor(theme, group) : theme.palette[0];
  const recipes = group ? store.recipesIn(group.id) : store.data.recipes;
  const filtering = theme.groupNav === 'filter' || ctx.layout === 'web';

  const thumbs = h('span', { class: 'group__thumbs', 'aria-hidden': 'true' },
    recipes.slice(0, 3).map((r) => h('span', {
      class: 'group__thumb',
      style: { '--thumb': mediaBackground(theme, r.photo, color) }
    })));

  return h('button', {
    class: 'group',
    type: 'button',
    'aria-current': current ? 'true' : 'false',
    style: { '--group-color': color },
    onclick: () => {
      if (!group) ctx.nav.home();
      else if (filtering && current) ctx.nav.home();
      else ctx.nav.group(group.id);
    }
  },
    h('span', { class: 'group__numeral', 'aria-hidden': 'true', text: group ? numeral(index) : '·' }),
    thumbs,
    h('span', { class: 'group__name', text: group ? group.name : 'All' }),
    h('span', { class: 'group__leader', 'aria-hidden': 'true' }),
    h('span', {
      class: 'group__count',
      text: theme.groupCount === 'label' ? copy.count(recipes.length) : String(recipes.length)
    }));
}

/* ── Recipe list ──────────────────────────────────────────────── */

function listSection(ctx, activeGroup, chapterPage) {
  const section = h('section', { class: 'section list-section' });
  const head = h('div', { class: 'list-section__head' });
  // Inside a group every card would repeat the same group name.
  const body = h('div', { class: activeGroup ? 'cards cards--scoped' : 'cards' });
  section.append(head, body);

  // Kept on the context so typing in the search box only repaints this part
  // and never steals focus from the input.
  ctx._listNodes = { head, body, activeGroup, chapterPage };
  paintList(ctx);
  return section;
}

/** Level 1 first, then 2, then 3. Array.sort is stable, so recipes of the
 *  same level keep the order they have in the book. */
const byDifficulty = (recipes) =>
  recipes.slice().sort((a, b) => a.difficulty - b.difficulty);

export function paintList(ctx) {
  const nodes = ctx._listNodes;
  if (!nodes) return;
  const { store, theme, copy, state } = ctx;
  const { head, body, activeGroup, chapterPage } = nodes;

  head.replaceChildren();
  body.replaceChildren();

  const searching = state.search.trim().length > 0;
  const scope = activeGroup ? activeGroup.id : null;
  let results = store.search(state.search, scope);

  // Phone shell + a theme with group pages shows a short teaser on home,
  // exactly like v1 and v2 did. Everywhere else, show it all.
  const teaser = !searching && !activeGroup && ctx.layout !== 'web' && theme.groupNav === 'page';

  // Every list reads easiest first, so a chapter can be worked through in
  // order. That also makes the teaser the four to start with, not the four
  // that happened to be imported last.
  results = byDifficulty(results);
  if (teaser) results = results.slice(0, 4);

  const title = searching ? copy.searchResults
    : teaser ? copy.startHere
      : activeGroup ? activeGroup.name
        : copy.allRecipes;

  // A chapter page already names itself in the header.
  if (!(chapterPage && !searching)) {
    head.append(sectionHead(title,
      h('span', { class: 'section__count', text: copy.count(results.length) })));
  }

  if (results.length === 0) {
    body.append(emptyState(ctx, {
      title: searching ? copy.nothingFound : copy.emptyTitle,
      text: searching ? '' : copy.emptyText,
      actions: searching ? [] : [
        h('button', { class: 'btn btn--primary', type: 'button', onclick: () => ctx.nav.newRecipe() }, copy.addFirst),
        activeGroup
          ? h('button', {
            class: 'linkbtn', type: 'button',
            onclick: () => { ctx.store.removeGroup(activeGroup.id); ctx.nav.home(); }
          }, copy.deleteGroup)
          : null
      ].filter(Boolean)
    }));
    return;
  }

  for (const recipe of results) body.append(recipeCard(ctx, recipe));
}
