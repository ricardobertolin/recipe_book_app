/** The recipe book itself: load, save, mutate, migrate.
 *
 *  Groups keep a palette *index* rather than a hex colour so that switching
 *  theme recolours the whole book instead of leaving v1's pastels behind.
 */

import { CONFIG } from './config.js';
import { uid } from './util.js';
import { THEMES } from './themes.js';

const ing = (pairs) => pairs.map(([qty, name]) => ({ qty, name }));

export const SEED = {
  version: 2,
  groups: [
    { id: 'g1', name: 'Breakfast', colorIndex: 0 },
    { id: 'g2', name: 'Weeknight dinners', colorIndex: 1 },
    { id: 'g3', name: 'Baking', colorIndex: 4 },
    { id: 'g4', name: 'Soups', colorIndex: 2 }
  ],
  recipes: [
    {
      id: 'r1', groupId: 'g1', title: 'Fluffy pancakes', difficulty: 0, time: 20, servings: 4, photo: null,
      ingredients: ing([['200 g', 'Plain flour'], ['2 tsp', 'Baking powder'], ['1 tbsp', 'Sugar'], ['1 pinch', 'Salt'], ['2', 'Eggs'], ['300 ml', 'Milk'], ['2 tbsp', 'Melted butter']]),
      steps: [
        'Whisk the flour, baking powder, sugar and salt in a large bowl.',
        'Beat the eggs with the milk and melted butter in a jug.',
        'Pour the wet mix into the dry and stir until just combined. A few lumps are fine.',
        'Heat a non-stick pan over medium heat and lightly butter it.',
        'Add a ladle of batter. Flip when bubbles appear on top, then cook 1 more minute.',
        'Keep warm in a low oven while you cook the rest.'
      ],
      notes: 'Rest the batter for 10 minutes for extra fluffy ones.\nDrop blueberries on after pouring, not into the bowl.'
    },
    {
      id: 'r2', groupId: 'g4', title: 'Tomato basil soup', difficulty: 0, time: 35, servings: 4, photo: null,
      ingredients: ing([['2 tbsp', 'Olive oil'], ['1', 'Onion, chopped'], ['2 cloves', 'Garlic'], ['800 g', 'Tinned tomatoes'], ['500 ml', 'Vegetable stock'], ['1 handful', 'Basil leaves']]),
      steps: [
        'Soften the onion in olive oil for 8 minutes.',
        'Add garlic and cook 1 minute more.',
        'Add tomatoes and stock, simmer for 20 minutes.',
        'Blend with the basil until smooth. Season to taste.'
      ],
      notes: 'A splash of cream at the end makes it extra cosy.'
    },
    {
      id: 'r3', groupId: 'g3', title: 'Lemon drizzle cake', difficulty: 1, time: 60, servings: 8, photo: null,
      ingredients: ing([['225 g', 'Softened butter'], ['225 g', 'Caster sugar'], ['4', 'Eggs'], ['225 g', 'Self-raising flour'], ['2', 'Lemons, zested & juiced'], ['85 g', 'Icing sugar']]),
      steps: [
        'Heat oven to 180°C and line a loaf tin.',
        'Beat butter and sugar until pale, then beat in the eggs one at a time.',
        'Fold in the flour and lemon zest.',
        'Bake for 45–50 minutes until a skewer comes out clean.',
        'Mix lemon juice with icing sugar and spoon over the warm cake.'
      ],
      notes: 'Prick the top with a fork before drizzling so it soaks in.'
    },
    {
      id: 'r4', groupId: 'g2', title: 'Chicken katsu curry', difficulty: 2, time: 50, servings: 2, photo: null,
      ingredients: ing([['2', 'Chicken breasts'], ['50 g', 'Plain flour'], ['1', 'Egg, beaten'], ['80 g', 'Panko'], ['1', 'Onion'], ['1', 'Carrot'], ['2 tbsp', 'Curry powder'], ['400 ml', 'Chicken stock']]),
      steps: [
        'Fry onion and carrot until soft, stir in curry powder and flour.',
        'Whisk in the stock and simmer 15 minutes, then blend.',
        'Flatten the chicken, dip in flour, egg, then panko.',
        'Shallow fry 4–5 minutes per side until golden and cooked through.',
        'Slice and serve over rice with the sauce.'
      ],
      notes: ''
    },
    {
      id: 'r5', groupId: 'g2', title: 'Garlic butter pasta', difficulty: 0, time: 15, servings: 2, photo: null,
      ingredients: ing([['200 g', 'Spaghetti'], ['40 g', 'Butter'], ['3 cloves', 'Garlic, sliced'], ['30 g', 'Parmesan'], ['1 small bunch', 'Parsley']]),
      steps: [
        'Cook the pasta in salted water. Save a mug of pasta water.',
        'Melt butter and gently cook the garlic until fragrant.',
        'Toss in the pasta, a splash of pasta water, parmesan and parsley.'
      ],
      notes: 'Chilli flakes on top for the grown-ups.'
    }
  ],
  cooked: {}
};

const EMPTY = { version: 2, groups: [], recipes: [], cooked: {} };

/** Every palette the app has ever shipped, so legacy hex colours can be
 *  turned back into an index. */
const KNOWN_PALETTES = [
  ...Object.values(THEMES).map((t) => t.palette),
  ['#FFE3A3', '#FFD0C0', '#D3E7C6', '#CCE1F2', '#E5D7F3'],
  ['#D9CBB0', '#CDB4A0', '#BFC4A8', '#B8C3C6', '#CDBFC2'],
  ['#E8C872', '#D98E6A', '#9DB77A', '#8FB0C4', '#B99AC4']
];

function colorToIndex(hex) {
  if (typeof hex !== 'string') return 0;
  const want = hex.trim().toLowerCase();
  for (const palette of KNOWN_PALETTES) {
    const i = palette.findIndex((c) => c.toLowerCase() === want);
    if (i >= 0) return i;
  }
  return 0;
}

function normalise(raw) {
  if (!raw || !Array.isArray(raw.groups) || !Array.isArray(raw.recipes)) return null;
  const groups = raw.groups.map((g) => ({
    id: g.id || uid(),
    name: String(g.name ?? 'Untitled'),
    colorIndex: typeof g.colorIndex === 'number' ? g.colorIndex : colorToIndex(g.color)
  }));
  const recipes = raw.recipes.map((r) => ({
    id: r.id || uid(),
    groupId: r.groupId ?? null,
    title: String(r.title ?? ''),
    difficulty: Number.isInteger(r.difficulty) ? Math.min(2, Math.max(0, r.difficulty)) : 0,
    time: r.time === '' || r.time === null || r.time === undefined ? '' : Number(r.time) || '',
    servings: r.servings === '' || r.servings === null || r.servings === undefined ? '' : Number(r.servings) || '',
    photo: typeof r.photo === 'string' ? r.photo : null,
    ingredients: Array.isArray(r.ingredients)
      ? r.ingredients.map((i) => ({ qty: String(i.qty ?? ''), name: String(i.name ?? '') }))
      : [],
    steps: Array.isArray(r.steps) ? r.steps.map((s) => String(s)) : [],
    notes: String(r.notes ?? '')
  }));
  return { version: 2, groups, recipes, cooked: normaliseCooked(raw.cooked, recipes) };
}

/**
 * When each recipe was last cooked, keyed by recipe id.
 *
 * Deliberately kept beside the recipes rather than inside them: cooking a
 * dish is a fact about *you*, not about the recipe, so it must not make an
 * otherwise identical re-import look like a changed recipe (see sameRecipe).
 * Entries pointing at recipes that are gone are dropped on the way in.
 */
function normaliseCooked(raw, recipes) {
  if (!raw || typeof raw !== 'object') return {};
  const ids = new Set(recipes.map((r) => r.id));
  const out = {};
  for (const [id, when] of Object.entries(raw)) {
    if (!ids.has(id) || !when) continue;
    out[id] = typeof when === 'string' ? when : new Date().toISOString();
  }
  return out;
}

/** Content equality, ignoring the id, so a re-import is recognised. */
function sameRecipe(a, b) {
  const shape = (r) => JSON.stringify([
    r.title, r.groupId, r.difficulty, r.time, r.servings, r.notes,
    r.ingredients.map((i) => [i.qty, i.name]), r.steps, !!r.photo
  ]);
  return shape(a) === shape(b);
}

function readJSON(key) {
  try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; }
}

function loadData() {
  const current = normalise(readJSON(CONFIG.storageKey));
  if (current) return current;

  // Carry over anything the Design Components prototypes left behind.
  const legacy = normalise(readJSON(CONFIG.legacyKey));
  if (legacy) return legacy;

  return CONFIG.seedOnFirstRun ? structuredClone(SEED) : structuredClone(EMPTY);
}

const DEFAULT_SETTINGS = {
  theme: CONFIG.defaultTheme,
  layout: CONFIG.defaultLayout
};

function loadSettings() {
  return { ...DEFAULT_SETTINGS, ...(readJSON(CONFIG.settingsKey) || {}) };
}

class Store extends EventTarget {
  constructor() {
    super();
    this.data = loadData();
    this.settings = loadSettings();
    this.storageError = null;
  }

  onChange(fn) {
    this.addEventListener('change', fn);
    return () => this.removeEventListener('change', fn);
  }

  #commit(next) {
    this.data = next;
    try {
      localStorage.setItem(CONFIG.storageKey, JSON.stringify(next));
      this.storageError = null;
    } catch (err) {
      this.storageError = 'Storage is full. Recent changes are only in memory — try removing a photo.';
      console.warn('recipe-book: could not persist', err);
    }
    this.dispatchEvent(new CustomEvent('change'));
  }

  saveSettings(patch) {
    this.settings = { ...this.settings, ...patch };
    try { localStorage.setItem(CONFIG.settingsKey, JSON.stringify(this.settings)); } catch { /* non-fatal */ }
    this.dispatchEvent(new CustomEvent('settings'));
  }

  onSettings(fn) {
    this.addEventListener('settings', fn);
    return () => this.removeEventListener('settings', fn);
  }

  // ── reads ────────────────────────────────────────────────────
  group(id) { return this.data.groups.find((g) => g.id === id) || null; }
  recipe(id) { return this.data.recipes.find((r) => r.id === id) || null; }
  groupIndex(id) { return this.data.groups.findIndex((g) => g.id === id); }
  recipesIn(groupId) { return this.data.recipes.filter((r) => r.groupId === groupId); }

  /** ISO timestamp of the last time this recipe was cooked, or null. */
  cookedAt(id) { return this.data.cooked?.[id] || null; }

  search(query, groupId = null) {
    const q = query.trim().toLowerCase();
    let pool = groupId ? this.recipesIn(groupId) : this.data.recipes;
    if (!q) return pool;
    return pool.filter((r) =>
      r.title.toLowerCase().includes(q) ||
      r.ingredients.some((i) => i.name.toLowerCase().includes(q)));
  }

  // ── writes ───────────────────────────────────────────────────
  addGroup(name, colorIndex) {
    const group = { id: uid(), name: name.trim(), colorIndex };
    this.#commit({ ...this.data, groups: [...this.data.groups, group] });
    return group;
  }

  removeGroup(id) {
    this.#commit({
      ...this.data,
      groups: this.data.groups.filter((g) => g.id !== id),
      // Recipes outlive their group; they just become unfiled.
      recipes: this.data.recipes.map((r) => (r.groupId === id ? { ...r, groupId: null } : r))
    });
  }

  saveRecipe(recipe) {
    const clean = {
      ...recipe,
      title: recipe.title.trim(),
      time: recipe.time === '' ? '' : Number(recipe.time) || '',
      servings: recipe.servings === '' ? '' : Number(recipe.servings) || '',
      ingredients: recipe.ingredients.filter((i) => i.name.trim() || i.qty.trim()),
      steps: recipe.steps.filter((s) => s.trim()),
      notes: recipe.notes || ''
    };
    const id = clean.id || uid();
    const exists = clean.id && this.data.recipes.some((r) => r.id === clean.id);
    const recipes = exists
      ? this.data.recipes.map((r) => (r.id === id ? { ...clean, id } : r))
      : [...this.data.recipes, { ...clean, id }];
    this.#commit({ ...this.data, recipes });
    return id;
  }

  removeRecipe(id) {
    const cooked = { ...this.data.cooked };
    delete cooked[id];
    this.#commit({ ...this.data, recipes: this.data.recipes.filter((r) => r.id !== id), cooked });
  }

  /** Mark a recipe as cooked (now) or clear the mark. */
  setCooked(id, done = true) {
    const cooked = { ...this.data.cooked };
    if (done) cooked[id] = new Date().toISOString();
    else delete cooked[id];
    this.#commit({ ...this.data, cooked });
  }

  toggleCooked(id) {
    const next = !this.cookedAt(id);
    this.setCooked(id, next);
    return next;
  }

  setPhoto(id, photo) {
    this.#commit({ ...this.data, recipes: this.data.recipes.map((r) => (r.id === id ? { ...r, photo } : r)) });
  }

  replaceAll(raw) {
    const next = normalise(raw);
    if (!next) throw new Error('That file does not look like a recipe book export.');
    this.#commit(next);
    return { groups: next.groups.length, recipes: next.recipes.length, skipped: 0 };
  }

  /**
   * Fold an export into the current book instead of replacing it.
   *
   * Groups match on name so importing twice does not leave two "Baking"s.
   * Recipes match on id: an identical one is skipped as a re-import, a
   * changed one comes in alongside under a fresh id rather than silently
   * overwriting whatever is already there.
   */
  merge(raw) {
    const incoming = normalise(raw);
    if (!incoming) throw new Error('That file does not look like a recipe book export.');

    const groups = this.data.groups.slice();
    const byName = new Map(groups.map((g) => [g.name.trim().toLowerCase(), g]));
    const groupIdMap = new Map();
    let groupsAdded = 0;

    for (const group of incoming.groups) {
      const key = group.name.trim().toLowerCase();
      const existing = byName.get(key);
      if (existing) {
        groupIdMap.set(group.id, existing.id);
      } else {
        const fresh = { ...group, id: uid() };
        groups.push(fresh);
        byName.set(key, fresh);
        groupIdMap.set(group.id, fresh.id);
        groupsAdded++;
      }
    }

    const recipes = this.data.recipes.slice();
    const byId = new Map(recipes.map((r) => [r.id, r]));
    const cooked = { ...this.data.cooked };
    let recipesAdded = 0;
    let skipped = 0;

    for (const recipe of incoming.recipes) {
      const mapped = {
        ...recipe,
        groupId: recipe.groupId ? (groupIdMap.get(recipe.groupId) ?? null) : null
      };
      const wasCooked = incoming.cooked[recipe.id];
      const existing = byId.get(mapped.id);
      if (existing) {
        if (sameRecipe(existing, mapped)) {
          // A re-import of the same recipe still brings its cooked mark over.
          if (wasCooked && !cooked[mapped.id]) cooked[mapped.id] = wasCooked;
          skipped++;
          continue;
        }
        mapped.id = uid();
      }
      recipes.push(mapped);
      byId.set(mapped.id, mapped);
      if (wasCooked) cooked[mapped.id] = wasCooked;
      recipesAdded++;
    }

    this.#commit({ version: 2, groups, recipes, cooked });
    return { groups: groupsAdded, recipes: recipesAdded, skipped };
  }

  reset() { this.#commit(structuredClone(CONFIG.seedOnFirstRun ? SEED : EMPTY)); }
}

export const store = new Store();
