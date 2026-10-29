/**
 * Build-time-ish configuration. Edit this file to change the defaults a
 * fresh install starts with; anything the user picks in Settings is stored
 * in localStorage and wins over these.
 *
 * You can also force a look with a query string, which is handy for
 * screenshots and for linking to a particular style:
 *   ?theme=playful|editorial|editorial-dark|pixel
 *   ?layout=app|web|auto
 */
export const CONFIG = {
  appName: 'Recipe Book',

  /** One of the ids in js/themes.js, listed there in menu order. */
  defaultTheme: 'editorial',

  /** 'app' = phone shell, 'web' = website shell, 'auto' = decide by viewport. */
  defaultLayout: 'auto',

  /** Viewport width at or above which 'auto' picks the website shell. */
  webBreakpoint: 920,

  /** Put the five sample recipes in on first run. */
  seedOnFirstRun: true,

  /** Longest edge a pasted photo is resized to, and its JPEG quality. */
  maxPhotoEdge: 1000,
  photoQuality: 0.8,

  storageKey: 'recipebook.v2',
  settingsKey: 'recipebook.settings',
  /** Data written by the original Design Components prototypes. */
  legacyKey: 'recipebook-v1'
};
