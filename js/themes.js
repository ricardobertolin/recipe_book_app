/** The four looks. A theme is a palette, a font bundle, a set of words and
 *  a swatch generator; the CSS files do the rest. Add one here plus a
 *  `[data-theme="…"]` block in styles/ and it shows up in Settings. */

import { mixHex } from './util.js';

const FONTS = {
  playful: 'https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600&family=Nunito:wght@400;600;700;800&display=swap',
  editorial: 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500;1,600&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;1,8..60,400&family=Libre+Franklin:wght@500;600&display=swap',
  pixel: 'https://fonts.googleapis.com/css2?family=Pixelify+Sans:wght@400;500;600;700&display=swap'
};

const BASE_COPY = {
  titleHTML: 'Recipe Book',
  tagline: (r, g) => `${r} recipes in ${g} groups`,
  groupsTitle: 'Groups',
  newGroup: '+ New group',
  newGroupTitle: 'New group',
  newGroupPlaceholder: 'e.g. Sunday roasts',
  createGroup: 'Create group',
  deleteGroup: 'Delete this group',
  allRecipes: 'All recipes',
  recent: 'Recently added',
  searchPlaceholder: 'Search recipes or ingredients',
  searchResults: 'Search results',
  nothingFound: 'Nothing found',
  count: (n) => (n === 1 ? '1 recipe' : `${n} recipes`),
  newRecipe: 'Add recipe',
  emptyTitle: 'No recipes here yet',
  emptyText: 'Add your first one to this group.',
  addFirst: 'Add a recipe',
  tabs: { ingredients: 'Ingredients', steps: 'Steps', notes: 'Notes' },
  stats: { time: 'Time', servings: 'Serves', difficulty: 'Difficulty' },
  startCook: 'Start cooking, step by step',
  cookStep: (i, n) => `Step ${i} of ${n}`,
  cookBack: 'Back',
  cookNext: 'Next step',
  cookDone: 'Done, enjoy!',
  cookClose: 'Close',
  noNotes: 'No notes yet.',
  editNotes: 'Edit notes',
  edit: 'Edit',
  back: 'Back',
  editTitle: 'Edit recipe',
  createTitle: 'New recipe',
  save: 'Save',
  cancel: 'Cancel',
  del: 'Delete recipe',
  nameLabel: 'Recipe name',
  namePlaceholder: "e.g. Grandma's apple pie",
  nameError: 'Give your recipe a name first.',
  groupLabel: 'Group',
  difficultyLabel: 'Difficulty',
  minutesLabel: 'Minutes',
  servesLabel: 'Serves',
  ingredientsLabel: 'Ingredients',
  stepsLabel: 'Steps',
  notesLabel: 'Notes',
  notesPlaceholder: 'Tips, swaps, who loved it…',
  addIngredient: '+ Add ingredient',
  addStep: '+ Add step',
  stepPlaceholder: 'Describe this step',
  addPhoto: '+ Add photo',
  changePhoto: 'Change photo',
  settings: 'Settings'
};

/** Diagonal candy stripes. */
const stripes = (c, light) =>
  `repeating-linear-gradient(135deg, ${c} 0 12px, ${mixHex(c, light, 0.45)} 12px 24px)`;

/** Fine engraver's hatching over a flat ground. */
const hatch = (c, ink) =>
  `repeating-linear-gradient(135deg, ${mixHex(c, ink, 0.2)} 0 1px, transparent 1px 10px), ${c}`;

/** 12px checkerboard. */
const checker = (c, light) =>
  `repeating-conic-gradient(${c} 0 25%, ${mixHex(c, light, 0.3)} 0 50%) 0 0 / 12px 12px`;

/* Declaration order is the order they appear in Settings. Editorial leads
   and is the default (see CONFIG.defaultTheme), with its night edition
   next to it. */
export const THEMES = {
  editorial: {
    id: 'editorial',
    name: 'Editorial',
    hint: 'Printed cookbook. Hairlines, Cormorant + Source Serif.',
    fonts: FONTS.editorial,
    dark: false,
    themeColor: '#F6F1E7',
    palette: ['#D9CBB0', '#CDB4A0', '#BFC4A8', '#B8C3C6', '#CDBFC2'],
    accent: '#8A2E1F',
    surface: '#F6F1E7',
    panelMode: 'tabs',
    groupNav: 'page',
    numerals: true,
    media: (c) => hatch(c, '#1F1B16'),
    copy: {
      titleHTML: 'The Kitchen<br><em>Notebook</em>',
      tagline: (r, g) => `${r} recipes in ${g} chapters`,
      diff: ['Easy', 'Medium', 'Advanced'],
      groupsTitle: 'Contents',
      newGroup: '+ Add a chapter',
      newGroupTitle: 'A new chapter',
      createGroup: 'Add chapter',
      deleteGroup: 'Remove this chapter',
      allRecipes: 'All recipes',
      recent: 'Recently added',
      searchPlaceholder: 'Search by recipe or ingredient',
      count: (n) => (n === 1 ? 'One recipe' : `${n} recipes`),
      newRecipe: 'New recipe',
      emptyTitle: 'This chapter is still blank.',
      emptyText: '',
      addFirst: 'Write the first recipe',
      tabs: { ingredients: 'Ingredients', steps: 'Method', notes: 'Notes' },
      startCook: 'Begin cooking · step by step',
      cookNext: 'Next step',
      cookDone: 'Finish',
      namePlaceholder: "e.g. Grandmother's apple tart",
      nameLabel: 'Title',
      nameError: 'A recipe needs a title.',
      groupLabel: 'Chapter',
      stepsLabel: 'Method',
      notesLabel: "Cook's notes",
      notesPlaceholder: 'Variations, sources, what to serve it with…',
      editNotes: 'Add or edit notes'
    }
  },

  'editorial-dark': {
    id: 'editorial-dark',
    name: 'Editorial Night',
    hint: 'The same press, inverted. Easy on the eyes after dark.',
    fonts: FONTS.editorial,
    dark: true,
    themeColor: '#17140F',
    palette: ['#6B5B40', '#6E4C3F', '#4E5B42', '#455459', '#584755'],
    accent: '#D98466',
    surface: '#17140F',
    panelMode: 'tabs',
    groupNav: 'page',
    numerals: true,
    media: (c) => hatch(c, '#EFE7D8'),
    copy: null // filled in below from `editorial`
  },

  playful: {
    id: 'playful',
    name: 'Playful',
    hint: 'Rounded, cream and coral. Fredoka + Nunito.',
    fonts: FONTS.playful,
    dark: false,
    themeColor: '#FFF8EE',
    palette: ['#FFE3A3', '#FFD0C0', '#D3E7C6', '#CCE1F2', '#E5D7F3'],
    accent: '#E8604C',
    surface: '#FFF8EE',
    panelMode: 'tabs',
    groupNav: 'page',
    groupCount: 'label',
    numerals: false,
    media: (c) => stripes(c, '#FFFFFF'),
    copy: {
      titleHTML: 'My Recipe<br>Book',
      diff: ['Easy', 'Medium', 'Tricky'],
      newGroupPlaceholder: 'e.g. Sunday roasts'
    }
  },

  pixel: {
    id: 'pixel',
    name: 'Pixel',
    hint: 'Handheld cartridge. Level badges, hard edges, Pixelify Sans.',
    fonts: FONTS.pixel,
    dark: false,
    themeColor: '#4A3324',
    palette: ['#E8C872', '#D98E6A', '#9DB77A', '#8FB0C4', '#B99AC4'],
    accent: '#8C3B22',
    surface: '#E9D6B2',
    panelMode: 'stack',
    // v3 filters in place from a chip rail instead of opening a group page.
    groupNav: 'filter',
    groupCount: 'number',
    // The stat plates are labelled MIN / SRV / LV, so the values stay bare.
    statsUnit: false,
    numerals: false,
    lvBg: ['#F5E6C4', '#E8C872', '#D98E6A'],
    media: (c) => checker(c, '#FFF3D6'),
    copy: {
      titleHTML: 'Recipe Book',
      diff: ['Easy', 'Medium', 'Hard'],
      newGroup: '+ Group',
      newGroupPlaceholder: 'e.g. Desserts',
      createGroup: 'Create',
      deleteGroup: 'Remove this group',
      count: (n) => (n === 1 ? '1 recipe' : `${n} recipes`),
      newRecipe: '+ New recipe',
      emptyTitle: 'No recipes here yet',
      emptyText: '',
      addFirst: '+ New recipe',
      nothingFound: 'Nothing found...',
      searchPlaceholder: 'Search recipe or ingredient...',
      startCook: '▸ Start cooking',
      cookDone: '★ Done!',
      cookNext: 'Next ▸',
      cookBack: '◂ Back',
      cookClose: '✕ Close',
      cookStep: (i, n) => `Step ${i}/${n}`,
      back: '◂ Back',
      edit: 'Edit recipe',
      editNotes: 'Edit recipe',
      namePlaceholder: 'e.g. Apple pie',
      nameLabel: 'Name',
      nameError: '! Name your recipe first',
      notesPlaceholder: 'Tips, swaps, memories...',
      addPhoto: '+ add photo',
      changePhoto: 'change photo',
      stats: { time: 'MIN', servings: 'SRV', difficulty: 'LV' }
    }
  }
};

// The night edition speaks the same language as the day edition.
THEMES['editorial-dark'].copy = { ...THEMES.editorial.copy };

// Merge every theme's overrides onto the shared copy deck.
for (const theme of Object.values(THEMES)) {
  theme.copy = {
    ...BASE_COPY,
    ...theme.copy,
    tabs: { ...BASE_COPY.tabs, ...(theme.copy?.tabs) },
    stats: { ...BASE_COPY.stats, ...(theme.copy?.stats) },
    diff: theme.copy?.diff || ['Easy', 'Medium', 'Hard']
  };
}

export const THEME_IDS = Object.keys(THEMES);
export const FALLBACK_THEME = 'editorial';

export const getTheme = (id) => THEMES[id] || THEMES[FALLBACK_THEME];

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X',
  'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX'];

export const numeral = (i) => ROMAN[i] || String(i + 1);

/** Colour for a group under the active theme. Groups store a palette index
 *  so switching themes recolours everything instead of clashing. */
export function groupColor(theme, group) {
  if (!group) return theme.palette[0];
  if (typeof group.colorIndex === 'number') return theme.palette[group.colorIndex % theme.palette.length];
  return group.color || theme.palette[0];
}

/** CSS `background` shorthand for a recipe tile: the photo if there is one,
 *  otherwise the theme's generated swatch. */
export function mediaBackground(theme, photo, color) {
  if (photo) return `center / cover no-repeat url("${photo}")`;
  return theme.media(color);
}
