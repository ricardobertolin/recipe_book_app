/** A very small DOM builder. Everything is created as real nodes, so
 *  recipe text never goes near innerHTML. */

/**
 * h('div', { class: 'card', onclick: fn }, child, child, ...)
 * Props: `class`, `text`, `html` (trusted markup only), `dataset`, `style`
 * (string or object, `--custom` keys supported), `on*` listeners, anything
 * else becomes an attribute. `null`/`undefined`/`false` props are skipped.
 */
export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') el.className = value;
    else if (key === 'text') el.textContent = value;
    else if (key === 'html') el.innerHTML = value;
    else if (key === 'dataset') Object.assign(el.dataset, value);
    else if (key === 'style') setStyle(el, value);
    else if (key === 'value') el.value = value;
    else if (key.startsWith('on')) el.addEventListener(key.slice(2).toLowerCase(), value);
    else if (value === true) el.setAttribute(key, '');
    else el.setAttribute(key, value);
  }
  append(el, children);
  return el;
}

function setStyle(el, value) {
  if (typeof value === 'string') { el.setAttribute('style', value); return; }
  for (const [prop, v] of Object.entries(value)) {
    if (v === null || v === undefined) continue;
    if (prop.startsWith('--')) el.style.setProperty(prop, v);
    else el.style[prop] = v;
  }
}

export function append(parent, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false || child === true) continue;
    parent.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return parent;
}

/** Inline SVG from a markup string, e.g. svg('<svg …>…</svg>'). */
export function svg(markup) {
  const wrap = document.createElement('div');
  wrap.innerHTML = markup.trim();
  return wrap.firstElementChild;
}

export const clear = (node) => { while (node.firstChild) node.firstChild.remove(); return node; };

export const qs = (sel, root = document) => root.querySelector(sel);
