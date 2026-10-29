/** Icon markup. The pixel theme gets its own crisp-edges glyphs; the other
 *  themes share a stroked set. `icon()` picks the right one for the theme. */

const stroked = (d, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
  stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" ${extra}>${d}</svg>`;

const SET = {
  search: stroked('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
  back: stroked('<path d="m15 18-6-6 6-6"/>'),
  backLong: stroked('<path d="M19 12H5M11 18l-6-6 6-6"/>'),
  close: stroked('<path d="M18 6 6 18M6 6l12 12"/>'),
  plus: stroked('<path d="M12 5v14M5 12h14"/>'),
  edit: stroked('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>'),
  gear: stroked('<circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/>'),
  chef: stroked('<path d="M6 13.87A4 4 0 0 1 7.41 6a5.11 5.11 0 0 1 1.05-1.54 5 5 0 0 1 7.08 0A5.11 5.11 0 0 1 16.59 6 4 4 0 0 1 18 13.87V21H6Z"/><path d="M6 17h12"/>'),
  play: stroked('<path d="m7 4 13 8-13 8Z" fill="currentColor" stroke-linejoin="round"/>'),
  share: stroked('<path d="M12 16V4"/><path d="m8 8 4-4 4 4"/><path d="M5 14v4.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V14"/>')
};

/** Chunky 8x8 pixel glyphs so the pixel theme keeps its aliased look. */
const px = (paths) => `<svg viewBox="0 0 8 8" shape-rendering="crispEdges" fill="currentColor"><path d="${paths}"/></svg>`;

const PIXEL = {
  search: px('M2 0h3v1H2zM1 1h1v1H1zM5 1h1v1H5zM0 2h1v3H0zM6 2h1v3H6zM1 5h1v1H1zM5 5h1v1H5zM2 6h3v1H2zM6 6h1v1H6zM7 7h1v1H7z'),
  back: px('M4 1h1v1H4zM3 2h1v1H3zM2 3h1v1H2zM1 4h1v1H1zM2 5h1v1H2zM3 6h1v1H3zM4 7h1v1H4z'),
  backLong: px('M3 1h1v1H3zM2 2h1v1H2zM1 3h6v2H1zM2 5h1v1H2zM3 6h1v1H3z'),
  close: px('M1 1h1v1H1zM6 1h1v1H6zM2 2h1v1H2zM5 2h1v1H5zM3 3h2v2H3zM2 5h1v1H2zM5 5h1v1H5zM1 6h1v1H1zM6 6h1v1H6z'),
  plus: px('M3 1h2v2H3zM1 3h6v2H1zM3 5h2v2H3z'),
  edit: px('M5 0h2v1H5zM4 1h1v1H4zM6 1h1v2H6zM3 2h1v1H3zM5 2h1v1H5zM2 3h1v1H2zM4 3h1v1H4zM1 4h1v1H1zM3 4h1v1H3zM1 5h2v1H1zM0 6h1v2H0zM1 7h2v1H1z'),
  gear: px('M2 0h1v1H2zM5 0h1v1H5zM1 1h6v1H1zM2 2h4v1H2zM0 3h3v2H0zM5 3h3v2H5zM2 5h4v1H2zM1 6h6v1H1zM2 7h1v1H2zM5 7h1v1H5z'),
  chef: px('M1 1h6v1H1zM0 2h8v3H0zM1 5h6v3H1z'),
  play: px('M2 1h1v6H2zM3 2h1v4H3zM4 3h1v2H4zM5 4h1v1H5z'),
  share: px('M3 0h2v1H3zM2 1h1v1H2zM5 1h1v1H5zM1 2h1v1H1zM6 2h1v1H6zM3 1h2v4H3zM0 5h2v3H0zM6 5h2v3H6zM2 7h4v1H2z')
};
PIXEL.chef = px('M2 0h4v1H2zM1 1h1v1H1zM6 1h1v1H6zM0 2h1v2H0zM7 2h1v2H7zM1 4h6v1H1zM1 5h6v2H1zM1 7h6v1H1z');

/**
 * @param {string} name one of the keys above
 * @param {string} theme current theme id
 */
export function icon(name, theme) {
  const set = theme === 'pixel' ? PIXEL : SET;
  return set[name] || SET[name] || '';
}
