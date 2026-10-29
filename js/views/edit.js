/** Create / edit a recipe.
 *
 *  The draft is a plain object and the inputs are uncontrolled: typing writes
 *  straight into the draft with no re-render, so the caret never jumps. Only
 *  structural edits (adding or removing a row) repaint, and only the one list.
 */

import { h } from '../dom.js';
import { CONFIG } from '../config.js';
import { groupColor, mediaBackground } from '../themes.js';
import { readImageFile } from '../util.js';
import { photoPicker, difficultyDots, toastHost } from './common.js';

export function renderEdit(ctx) {
  const { theme, copy, state } = ctx;
  const draft = state.draft;
  if (!draft) { ctx.nav.home(); return h('div'); }

  const page = h('div', { class: 'view edit-page' });
  const form = h('form', {
    class: 'form',
    novalidate: true,
    onsubmit: (e) => { e.preventDefault(); save(); }
  });

  const titleInput = h('input', {
    class: 'input', type: 'text', value: draft.title, placeholder: copy.namePlaceholder,
    id: 'recipe-title', autocomplete: 'off',
    oninput: (e) => { draft.title = e.target.value; clearError(); }
  });
  const errorNote = h('p', { class: 'field__error', hidden: true, text: copy.nameError });

  function clearError() {
    errorNote.hidden = true;
    titleInput.setAttribute('aria-invalid', 'false');
  }

  function save() {
    if (!draft.title.trim()) {
      errorNote.hidden = false;
      titleInput.setAttribute('aria-invalid', 'true');
      titleInput.focus();
      titleInput.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }
    const id = ctx.store.saveRecipe(draft);
    state.draft = null;
    ctx.nav.recipe(id, { replace: true });
  }

  page.append(h('div', { class: 'formbar' },
    h('button', {
      class: 'btn btn--ghost', type: 'button',
      onclick: () => { state.draft = null; ctx.nav.back(); }
    }, copy.cancel),
    h('span', { class: 'formbar__title', text: draft.id ? copy.editTitle : copy.createTitle }),
    h('button', { class: 'btn btn--primary', type: 'submit', form: 'recipe-form' }, copy.save)));

  form.id = 'recipe-form';

  // Photo
  const drop = photoPicker({
    className: 'photodrop',
    label: draft.photo ? copy.changePhoto : copy.addPhoto,
    style: { '--media': draftMedia(ctx, draft) },
    onPick: async (file) => {
      try {
        draft.photo = await readImageFile(file, CONFIG.maxPhotoEdge, CONFIG.photoQuality);
        drop.style.setProperty('--media', draftMedia(ctx, draft));
        drop.querySelector('span').textContent = copy.changePhoto;
      } catch (err) {
        toastHost(err.message || 'Could not read that image.');
      }
    }
  });
  form.append(drop);

  // Name
  form.append(h('div', { class: 'field' },
    h('label', { class: 'field__label', for: 'recipe-title', text: copy.nameLabel }),
    titleInput,
    errorNote));

  // Group
  const groupChips = h('div', { class: 'chips' });
  const paintGroups = () => {
    groupChips.replaceChildren();
    for (const group of ctx.store.data.groups) {
      const on = group.id === draft.groupId;
      groupChips.append(h('button', {
        class: 'chip', type: 'button', 'aria-pressed': on ? 'true' : 'false',
        style: { '--chip-color': on ? groupColor(theme, group) : null },
        onclick: () => { draft.groupId = group.id; paintGroups(); drop.style.setProperty('--media', draftMedia(ctx, draft)); }
      }, group.name));
    }
    groupChips.append(h('button', {
      class: 'chip', type: 'button', 'aria-pressed': draft.groupId === null ? 'true' : 'false',
      onclick: () => { draft.groupId = null; paintGroups(); drop.style.setProperty('--media', draftMedia(ctx, draft)); }
    }, 'Unfiled'));
  };
  paintGroups();
  form.append(h('fieldset', { class: 'field', style: 'border:0;padding:0;margin:0' },
    h('legend', { class: 'field__label', text: copy.groupLabel }),
    groupChips));

  // Difficulty
  const diffGrid = h('div', { class: 'diffgrid' });
  const paintDiff = () => {
    diffGrid.replaceChildren();
    copy.diff.forEach((label, i) => {
      const on = draft.difficulty === i;
      diffGrid.append(h('button', {
        class: 'diffopt', type: 'button', 'aria-pressed': on ? 'true' : 'false',
        style: { '--lv-bg': theme.lvBg ? theme.lvBg[i] : null },
        onclick: () => { draft.difficulty = i; paintDiff(); }
      },
        h('span', { class: 'diffopt__lv', text: `LV ${i + 1}` }),
        difficultyDots(ctx, i),
        h('span', { class: 'diffopt__label', text: label })));
    });
  };
  paintDiff();
  form.append(h('fieldset', { class: 'field', style: 'border:0;padding:0;margin:0' },
    h('legend', { class: 'field__label', text: copy.difficultyLabel }),
    diffGrid));

  // Time + servings
  form.append(h('div', { class: 'grid2' },
    numberField(copy.minutesLabel, 'recipe-time', draft.time, '30', (v) => { draft.time = v; }),
    numberField(copy.servesLabel, 'recipe-serves', draft.servings, '4', (v) => { draft.servings = v; })));

  // Ingredients
  const ingRows = h('div', { class: 'rows' });
  const paintIngredients = () => {
    ingRows.replaceChildren();
    draft.ingredients.forEach((item, i) => {
      ingRows.append(h('div', { class: 'row' },
        h('input', {
          class: 'input input--qty', type: 'text', value: item.qty, placeholder: '200 g',
          'aria-label': `Quantity for ingredient ${i + 1}`,
          oninput: (e) => { item.qty = e.target.value; }
        }),
        h('input', {
          class: 'input input--name', type: 'text', value: item.name, placeholder: 'Ingredient',
          'aria-label': `Ingredient ${i + 1}`,
          oninput: (e) => { item.name = e.target.value; }
        }),
        h('button', {
          class: 'row__del', type: 'button', 'aria-label': `Remove ingredient ${i + 1}`,
          onclick: () => { draft.ingredients.splice(i, 1); paintIngredients(); }
        }, '×')));
    });
    ingRows.append(h('button', {
      class: 'row__add', type: 'button',
      onclick: () => {
        draft.ingredients.push({ qty: '', name: '' });
        paintIngredients();
        ingRows.querySelectorAll('.input--qty')[draft.ingredients.length - 1]?.focus();
      }
    }, copy.addIngredient));
  };
  paintIngredients();
  form.append(h('div', { class: 'field' },
    h('span', { class: 'field__label', text: copy.ingredientsLabel }),
    ingRows));

  // Steps
  const stepRows = h('div', { class: 'rows' });
  const paintSteps = () => {
    stepRows.replaceChildren();
    draft.steps.forEach((text, i) => {
      stepRows.append(h('div', { class: 'row' },
        h('span', { class: 'row__n', 'aria-hidden': 'true', text: String(i + 1) }),
        h('textarea', {
          class: 'textarea', rows: 2, placeholder: copy.stepPlaceholder,
          'aria-label': `Step ${i + 1}`,
          oninput: (e) => { draft.steps[i] = e.target.value; }
        }, text),
        h('button', {
          class: 'row__del', type: 'button', 'aria-label': `Remove step ${i + 1}`,
          onclick: () => { draft.steps.splice(i, 1); paintSteps(); }
        }, '×')));
    });
    stepRows.append(h('button', {
      class: 'row__add', type: 'button',
      onclick: () => {
        draft.steps.push('');
        paintSteps();
        stepRows.querySelectorAll('textarea')[draft.steps.length - 1]?.focus();
      }
    }, copy.addStep));
  };
  paintSteps();
  form.append(h('div', { class: 'field' },
    h('span', { class: 'field__label', text: copy.stepsLabel }),
    stepRows));

  // Notes
  form.append(h('div', { class: 'field' },
    h('label', { class: 'field__label', for: 'recipe-notes', text: copy.notesLabel }),
    h('textarea', {
      class: 'textarea', id: 'recipe-notes', rows: 4, placeholder: copy.notesPlaceholder,
      oninput: (e) => { draft.notes = e.target.value; }
    }, draft.notes || '')));

  if (draft.id && ctx.store.recipe(draft.id)) {
    form.append(h('button', {
      class: 'btn btn--danger btn--block', type: 'button',
      onclick: () => {
        if (!window.confirm('Delete this recipe?')) return;
        ctx.store.removeRecipe(draft.id);
        state.draft = null;
        ctx.nav.home({ replace: true });
      }
    }, copy.del));
  }

  page.append(form);
  return page;
}

function numberField(label, id, value, placeholder, onInput) {
  return h('div', { class: 'field' },
    h('label', { class: 'field__label', for: id, text: label }),
    h('input', {
      class: 'input input--num', type: 'number', inputmode: 'numeric', min: '0',
      id, value: value === '' ? '' : String(value), placeholder,
      oninput: (e) => onInput(e.target.value)
    }));
}

function draftMedia(ctx, draft) {
  const group = draft.groupId ? ctx.store.group(draft.groupId) : null;
  return mediaBackground(ctx.theme, draft.photo, groupColor(ctx.theme, group));
}

/** A blank recipe, pre-filed into whichever group the user came from. */
export function blankDraft(groupId) {
  return {
    id: null,
    groupId: groupId ?? null,
    title: '',
    difficulty: 0,
    time: '',
    servings: '',
    photo: null,
    ingredients: [{ qty: '', name: '' }],
    steps: [''],
    notes: ''
  };
}
