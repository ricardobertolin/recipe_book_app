# Recipe Book

A personal recipe book that runs entirely in the browser. It installs as a PWA, works
with no network, and ships with four looks you can switch between at runtime.

Ported from the three Claude Design prototypes in the "Recipe book app design" project
(`Recipe Book.dc.html`, `Recipe Book v2.dc.html`, `Recipe Book v3.dc.html`). Those were
`x-dc` templates driven by `support.js`, a React-based preview runtime. None of that
runtime is here: the markup is built with plain DOM calls and the three designs survive
as CSS themes over one shared component layer.

## The four styles

Listed in the order they appear in Settings. **Editorial is the default.**

| id | name | comes from | character |
| --- | --- | --- | --- |
| `editorial` | Editorial | Recipe Book v2 | A printed cookbook. Hairline rules, no radii, Cormorant over Source Serif, chapters with roman numerals. The default |
| `editorial-dark` | Editorial Night | new | The same press inverted for dark rooms |
| `playful` | Playful | Recipe Book v1 | Cream and coral, rounded corners, hard offset shadows, Fredoka over Nunito |
| `pixel` | Pixel | Recipe Book v3 | A handheld cartridge. Level badges, 2px drawn edges, spiral binding, Pixelify Sans |

The menu order is simply the declaration order of `THEMES` in `js/themes.js`.

Themes are more than a palette swap. Each one picks its own words (groups versus
chapters, "Tricky" versus "Advanced"), its own difficulty display (dots versus an RPG
level plate), and its own navigation model. Playful and Editorial open a group as its own
page the way v1 and v2 did. Pixel filters the list in place from a chip rail the way v3
did. The DOM is identical in all four cases and the CSS decides what shows.

## Two shells

`app` is the phone shell: a 390x844 device frame on a desktop browser, edge to edge on a
phone or once installed.

`web` is the website: a top bar, a group rail, a card grid, and two column recipe pages
with the tabs expanded into side by side panels.

The default is `auto`, which picks `web` above 920px in a browser tab and `app` on narrow
screens or when launched as an installed app.

## Changing the defaults

Edit `js/config.js` for what a fresh install starts with:

```js
export const CONFIG = {
  defaultTheme: 'editorial',      // editorial | editorial-dark | playful | pixel
  defaultLayout: 'auto',          // auto | app | web
  webBreakpoint: 920,
  seedOnFirstRun: true,
  ...
};
```

Changing `defaultTheme` also means updating the two constants at the top of the inline
script in `index.html`. They are duplicated there on purpose, so the very first paint is
already in the right theme instead of flashing.

At runtime the gear button opens Settings, which also handles export, import and reset.
Whatever is chosen there is stored in `localStorage` and wins over the config file, so the
default only applies to someone who has never picked a style.

A query string overrides both for one visit without touching stored preferences, which is
useful for sharing a link or taking screenshots:

```
?theme=pixel&layout=web
```

## Running it

**Double-clicking `index.html` will not work.** You get the page background and nothing
else. Browsers block ES modules and service workers on `file://`, so none of the app code
can load. The page detects this and tells you what to do instead of failing silently.

Serve the folder over http. On Windows, double-click **`serve.cmd`**. Elsewhere, run
**`./serve.sh`**. Either one starts a static server on port 8765 and opens the browser.
By hand it is just:

```sh
python -m http.server 8765
# or: npx serve -l 8765
# then http://localhost:8765
```

For GitHub Pages, push the directory and point Pages at it. Every path in the app is
relative, so it works from a project subpath without configuration.

## Import and export

Settings has an **Import / export** sheet for the whole book, and every recipe page has a
share button for just that one.

Export comes in two formats. JSON is the round-trip format: it keeps everything including
photos, and it imports back. Markdown is export only, meant for pasting into notes or
sending to someone. Both are available as a downloaded file or copied to the clipboard.

A single recipe exports as a one-recipe book, so there is only ever one shape to import.
The per-recipe sheet also offers the system share sheet where the browser supports it, and
Print, which uses a print stylesheet that drops the app chrome, opens all three panels
regardless of which tab is selected, and lays the recipe out as a clean card.

Import takes JSON and asks what to do with it:

- **Merge** folds the file into the current book. Groups match on name, so importing twice
  does not leave you with two "Baking". Recipes match on id: an identical one is skipped as
  a re-import, a changed one comes in alongside under a fresh id rather than silently
  overwriting what is already there. The toast reports what was added and what was skipped.
- **Replace** throws away the current book and uses the file instead, after a confirmation
  that names the counts on both sides.

A malformed paste reports what is wrong and changes nothing.

The serialization lives in `js/formats.js` and the merge in `store.merge()`.

## Data

Everything lives in `localStorage` under `recipebook.v2`. Photos are downscaled to a
1000px longest edge and stored as JPEG data URLs. Nothing leaves the device and there is
no backend.

Groups store a palette *index* rather than a hex colour, so switching theme recolours the
whole book instead of leaving the previous theme's pastels behind. On first run the app
also picks up anything the original Design Components prototypes wrote to
`recipebook-v1`, mapping those old colours back to indices.

Settings live separately under `recipebook.settings` so resetting the recipes does not
reset the look.

## Offline

`sw.js` precaches the shell and serves it cache first. Google Fonts go through
stale while revalidate, so the first online visit warms them and every later visit, online
or not, gets them from the cache. Navigations always resolve to `index.html` because the
router lives in the URL hash. Bump `CACHE_VERSION` in `sw.js` when the shell changes.

## Layout of the source

```
index.html                 shell, a pre-paint theme bootstrap, and the boot guard
manifest.webmanifest
sw.js
serve.cmd  serve.sh        start a local server and open it
styles/
  base.css                 reset, design tokens, the shared component layer
  layout.css               the app shell and the website shell
  theme-playful.css        token values plus the few decorative bits each look needs
  theme-editorial.css      light and dark in one file
  theme-pixel.css
js/
  config.js                defaults you are meant to edit
  app.js                   router, shell, theme and layout application
  store.js                 data, seed, migration, merge, persistence
  themes.js                the theme registry: palettes, fonts, words, behaviour flags
  formats.js               JSON and Markdown serialization, clipboard, share
  dom.js  util.js  icons.js
  views/                   home, recipe, cook, edit, sheets, common
tools/
  make-icons.mjs           generates the icon set from one 16x16 pixel grid
  shot.mjs                 screenshot one page in headless Chrome
  smoke.mjs                click through the main flows and report pass/fail
```

`tools/` is development only and is not needed to serve the site.

## Tests

With the server running on port 8765:

```sh
node tools/smoke.mjs
```

It drives headless Chrome through boot, navigation, cook mode, creating and editing a
recipe, groups, search, all four themes, both layouts, import and export in both modes,
the print stylesheet, service worker registration and an offline reload. Set `BASE` or
`CHROME_PATH` if your setup differs.

`tools/shot.mjs <url> <out.png> [w] [h] [js]` screenshots a single page and reports
console errors. `PRINT=1` renders it with print media emulated.

## Regenerating the icons

```sh
node tools/make-icons.mjs
```

The whole set comes from the `ART` grid at the top of that script. No image tooling is
involved: the PNGs are encoded by hand with `node:zlib`.
