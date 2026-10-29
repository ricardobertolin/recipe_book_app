# Retro Notes

A calendar and a notebook on the same pile of paper. Notes can be pinned to a day,
filed in a group, both, or neither. Installable, works offline, stores everything
locally, and backs up to a JSON file you keep.

Ported from the Claude Design project *Retro Notes Mobile App*
(`Retro Notes v2.dc.html`). The source was a design component running on a React
template runtime; this is a standalone PWA with no framework and no build step.

## Running it

Any static server will do. Service workers need a secure origin, which
`localhost` counts as:

```sh
python -m http.server 8000
# then open http://localhost:8000
```

Deploying is a file copy — it is already set up for a subpath, so dropping the
folder on GitHub Pages works without configuration.

## Files

| | |
|---|---|
| `index.html` | shell: header, panel, tab bar, dialog host |
| `styles.css` | the whole look |
| `fonts.css`, `fonts/` | vendored VT323 and IBM Plex Mono (OFL 1.1) |
| `app.js` | state, rendering, persistence |
| `sw.js` | offline cache |
| `manifest.webmanifest` | install metadata and shortcuts |
| `icons/`, `splash/` | app icons and iOS launch screens |
| `tools/gen-icons.mjs` | redraws `icons/` and `splash/` — `node tools/gen-icons.mjs` |
| `tools/fetch-fonts.mjs` | re-pulls the fonts — `node tools/fetch-fonts.mjs` |

Both tools are plain Node with no dependencies, and nothing here needs a build
step — the files as committed are the files that get served.

## Installing

It meets the Chrome/Android install criteria and works as an iOS add-to-home-screen
app. Icons cover 192, 512 and 512-maskable (Android adaptive) plus a 180px
apple-touch-icon; `splash/` holds the eleven exact-size iPhone launch images iOS
needs, since it ignores the manifest for those and shows a blank white screen
without them. Every path is relative, so it installs correctly from a GitHub Pages
project subpath, not just a domain root.

Shortcuts (long-press the installed icon) jump straight to a new note or the
notes list.

## How it works

State lives in one object, `S`. Anything that changes it calls `render()`, which
rebuilds the screen from scratch. That is fast enough here and removes a whole
class of stale-DOM bugs, with two accommodations:

- `withFocus()` snapshots the focused field and its caret across the rebuild, so
  a render triggered mid-edit does not drop you out of the textarea.
- Typing does *not* re-render. It writes to state and patches the word count
  directly, because a full rebuild per keystroke is wasted work.

Clicks are handled by one delegated listener that dispatches on `data-act`, so
freshly rendered markup is live without rebinding anything.

Notes and groups persist to `localStorage` under `retronotes.v2`, debounced by
180 ms and flushed on `pagehide` and `visibilitychange`. The key and shape match
the original component, so existing data carries over. Preferences live
separately under `retronotes.v2.prefs`.

### Import and export

Under `≡` → DATA. Export downloads `retro-notes-YYYY-MM-DD.json`:

```json
{ "app": "retro-notes", "version": 1, "exported": "…", "groups": [ … ], "notes": [ … ] }
```

Preferences are deliberately left out — theme and week start belong to the device
you are reading on, not to the notes. Import also accepts the bare
`{ "notes": …, "groups": … }` shape the app stores internally.

Choosing a file never applies it straight away. It is parsed and validated first,
then a dialog says what is in it and offers two ways to take it:

- **Merge** — adds what is new and leaves the rest alone. Groups with the same
  name fold together, so two devices that each made a "Work" folder end up with
  one. Where the same note exists on both sides, the newer `updated` wins.
- **Replace** — drops everything local first. The dialog names the number of
  notes being thrown away, and the button is styled like DELETE.

Validation coerces rather than rejects: a missing id gets a fresh one, a bad
`updated` becomes now, an impossible date like `2026-13-45` becomes undated. Only
entries that cannot be salvaged are dropped, and a file with no `notes` array is
refused outright with nothing changed.

A note pointing at a group that does not exist would match no folder on the Notes
screen and silently disappear, so dangling references are unfiled on the way in.
The local store is checked the same way at startup, which repairs any data that
already drifted.

### The two-colour trick

Everything is ink `#000` and paper `#FFF`. Group swatches are dither patterns
built from those two colours rather than hues, which is why dark mode is a
literal `filter: invert(1)` on the root — the same approach the source design
took, and it keeps every pattern coherent for free.

### Offline

The service worker precaches the shell — HTML, CSS, JS, icons and fonts — and
serves it cache-first. Navigations try the network first so a deploy lands,
falling back to cache. **Bump `SHELL_CACHE` in `sw.js` when you deploy** — install
refetches, activate drops the old cache, and the page reloads once the new worker
takes over.

The app makes no third-party requests. Fonts are vendored into `fonts/` rather
than loaded from Google Fonts, because a CDN stylesheet cannot be precached: the
`<link>` resolves before the service worker controls the very first page load, so
anyone who installed the app and immediately went offline would have lost VT323 —
and the whole look rests on it. `tools/fetch-fonts.mjs` re-pulls them, keeping
only the latin and latin-ext subsets. Both families are SIL OFL 1.1; the license
ships in `fonts/OFL.txt`.

## Keyboard

`⌘/Ctrl N` new note · `⌘/Ctrl G` new group · `⌘/Ctrl T` today ·
`⌘/Ctrl 1` calendar · `⌘/Ctrl 2` all notes · `Esc` close dialog, or leave the editor

## Where this departs from the design

The source renders inside a drawn phone bezel with a fake 9:41 status bar, and
exposes `theme` and `weekStart` as design-tool props. A real app needs neither
and has nowhere to put the latter, so:

- The bezel is gone on phones; the app fills the viewport and uses
  `env(safe-area-inset-*)` instead of the fixed 30px bottom padding and drawn home
  indicator. On screens wide enough for it, the bezel comes back as a desktop frame.
- `theme` and `weekStart` moved into a settings dialog behind `≡` in the header,
  built from the design's own segmented-control vocabulary.
- Inputs are 16px rather than 15px. Below 16px, iOS Safari zooms the viewport when
  a field takes focus.

Everything else — the grid, the dither swatches, the folder and date groupings,
the discard-empty-note behaviour, the seed content — follows the original.
