/* Retro Notes — standalone PWA port of the "Retro Notes v2" design component.
   No framework: state lives in S, the screen is rebuilt from it, and clicks are
   dispatched by data-act. Notes and groups persist under the same localStorage
   key and shape the original component used. */
'use strict';
(function () {

  // ---------------------------------------------------------------- constants

  var KEY = 'retronotes.v2';
  var PREFS_KEY = 'retronotes.v2.prefs';

  var INK = '#000000', PAPER = '#FFFFFF', PAGE = '#F0F0F0';

  // Group swatches. Every one is built from ink and paper only, so inverting
  // the document for dark mode keeps them coherent.
  var PATS = [
    INK,
    'repeating-linear-gradient(45deg,' + INK + ' 0 2px,' + PAPER + ' 2px 4px)',
    'radial-gradient(' + INK + ' 1px,' + PAPER + ' 1.4px) 0 0/3px 3px',
    'repeating-conic-gradient(' + INK + ' 0 25%,' + PAPER + ' 0 50%) 0 0/4px 4px',
    'repeating-linear-gradient(0deg,' + INK + ' 0 1px,' + PAPER + ' 1px 3px)',
    'repeating-linear-gradient(90deg,' + INK + ' 0 1px,' + PAPER + ' 1px 3px)'
  ];

  var MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
    'August', 'September', 'October', 'November', 'December'];
  var DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  var SEED_GROUPS = [
    { id: 'g1', name: 'Ideas', p: 1 },
    { id: 'g2', name: 'Work', p: 0 },
    { id: 'g3', name: 'Groceries', p: 2 },
    { id: 'g4', name: 'Reading', p: 3 }
  ];

  // ------------------------------------------------------------------ helpers

  function pad(n) { return String(n).padStart(2, '0'); }
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parseISO(s) {
    var a = s.split('-').map(Number);
    return new Date(a[0], a[1] - 1, a[2]);
  }
  function addDays(n) { var d = new Date(); d.setDate(d.getDate() + n); return iso(d); }
  function short(s) { var d = parseISO(s); return MON[d.getMonth()].slice(0, 3).toUpperCase() + ' ' + d.getDate(); }
  function long(s) {
    var d = parseISO(s);
    return DOW[d.getDay()].toUpperCase() + ' ' + d.getDate() + ' ' + MON[d.getMonth()].slice(0, 3).toUpperCase();
  }
  function uid() { return Math.random().toString(36).slice(2, 9); }

  var ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ESC[c]; }); }

  function $(id) { return document.getElementById(id); }

  function seed() {
    var t = Date.now();
    return [
      { id: 'n1', title: 'Dentist 3:30', body: 'Bring the insurance card. Ask about the night guard.', date: addDays(0), group: null },
      { id: 'n2', title: 'Standup', body: 'Ship calendar sync. Ask Priya about the export bug.', date: addDays(0), group: 'g2' },
      { id: 'n3', title: 'Call mom', body: 'Her birthday plans: the lake house or the restaurant?', date: addDays(2), group: null },
      { id: 'n4', title: 'Book club', body: 'Chapters 4–6. Bring the marked-up copy.', date: addDays(-3), group: 'g4' },
      { id: 'n5', title: 'Haircut', body: 'Saturday slot with Leo.', date: addDays(5), group: null },
      { id: 'n6', title: 'Rent due', body: 'Transfer before noon.', date: addDays(9), group: null },
      { id: 'n7', title: 'Plant watering log', body: 'An app that reminds you which plant is thirsty. Photos per plant, a small growth chart.', date: null, group: 'g1' },
      { id: 'n8', title: 'Weekly shop', body: 'Oat milk\nEggs\nCoffee beans\nLemons\nRice', date: null, group: 'g3' },
      { id: 'n9', title: 'Q4 retro themes', body: 'What slowed us down. Fewer meetings on Wednesdays.', date: null, group: 'g2' },
      { id: 'n10', title: 'To borrow', body: 'The Dispossessed\nPiranesi\nA Psalm for the Wild-Built', date: null, group: 'g4' },
      { id: 'n11', title: 'Loose thought', body: 'Walk the long way home more often.', date: null, group: null }
    ].map(function (n, i) { n.updated = t - i * 60000; return n; });
  }

  // ------------------------------------------------------- backup validation

  // Both the local store and an imported file go through these. They coerce
  // rather than reject wherever a value can be salvaged, and only drop an entry
  // that is unusable (not an object, or a group with no name).

  function cleanGroup(g, i) {
    if (!g || typeof g !== 'object') return null;
    var name = typeof g.name === 'string' ? g.name.trim() : '';
    if (!name) return null;
    var p = Number(g.p);
    if (!isFinite(p) || p < 0) p = i % PATS.length;
    return {
      id: (typeof g.id === 'string' && g.id) ? g.id : uid(),
      name: name,
      p: Math.floor(p)
    };
  }

  // `group` is left as whatever string was in the file; ids are resolved later,
  // once we know which groups actually survive the import.
  function cleanNote(n) {
    if (!n || typeof n !== 'object') return null;
    var date = null;
    if (typeof n.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(n.date)) {
      // Rejects impossible dates like 2026-13-45, which would render as garbage.
      date = iso(parseISO(n.date)) === n.date ? n.date : null;
    }
    var updated = Number(n.updated);
    return {
      id: (typeof n.id === 'string' && n.id) ? n.id : uid(),
      title: typeof n.title === 'string' ? n.title : '',
      body: typeof n.body === 'string' ? n.body : '',
      date: date,
      group: (typeof n.group === 'string' && n.group) ? n.group : null,
      updated: isFinite(updated) ? updated : Date.now()
    };
  }

  // A note pointing at a group that no longer exists would match no folder at
  // all on the Notes screen — it would simply vanish. Unfile it instead.
  function reconcile(notes, groups) {
    var live = {};
    groups.forEach(function (g) { live[g.id] = true; });
    return notes.map(function (n) {
      if (n.group == null || live[n.group]) return n;
      var out = Object.assign({}, n);
      out.group = null;
      return out;
    });
  }

  function parseBackup(text) {
    var raw = JSON.parse(text);
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new Error('That file isn’t a Retro Notes backup.');
    }
    if (!Array.isArray(raw.notes)) {
      throw new Error('That file has no notes in it.');
    }
    var groups = (Array.isArray(raw.groups) ? raw.groups : []).map(cleanGroup).filter(Boolean);
    var notes = raw.notes.map(cleanNote).filter(Boolean);
    if (!notes.length) throw new Error('That backup has no readable notes.');
    return { groups: groups, notes: notes };
  }

  // -------------------------------------------------------------------- state

  var S;

  function load() {
    var saved = null, prefs = null;
    try { saved = JSON.parse(localStorage.getItem(KEY)); } catch (e) { /* corrupt or blocked */ }
    try { prefs = JSON.parse(localStorage.getItem(PREFS_KEY)); } catch (e) { /* ditto */ }
    var t = new Date();
    var groups = (saved && Array.isArray(saved.groups)) ? saved.groups.map(cleanGroup).filter(Boolean) : SEED_GROUPS;
    var notes = (saved && Array.isArray(saved.notes)) ? saved.notes.map(cleanNote).filter(Boolean) : seed();
    S = {
      notes: reconcile(notes, groups),
      groups: groups,
      screen: 'cal',
      prev: 'cal',
      vy: t.getFullYear(),
      vm: t.getMonth(),
      sel: iso(t),
      editId: null,
      dialog: null,
      pending: null,
      importError: '',
      py: t.getFullYear(),
      pm: t.getMonth(),
      open: {},
      mode: 'group',
      theme: (prefs && prefs.theme === 'Dark') ? 'Dark' : 'Light',
      weekStart: (prefs && prefs.weekStart === 'Sun') ? 'Sun' : 'Mon'
    };
  }

  var saveTimer = null;
  function flush() {
    clearTimeout(saveTimer);
    saveTimer = null;
    try {
      localStorage.setItem(KEY, JSON.stringify({ notes: S.notes, groups: S.groups }));
    } catch (e) { /* private mode / quota: keep running in memory */ }
  }
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flush, 180);
  }
  function savePrefs() {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({ theme: S.theme, weekStart: S.weekStart }));
    } catch (e) { /* ignore */ }
  }

  // --------------------------------------------------------------- derivation

  function derive() {
    var gmap = {};
    S.groups.forEach(function (g) { gmap[g.id] = g; });

    function swatch(n) {
      return (n.group && gmap[n.group]) ? PATS[gmap[n.group].p % PATS.length] : PAPER;
    }

    var sorted = S.notes.slice().sort(function (a, b) { return b.updated - a.updated; });
    var byDate = {};
    sorted.forEach(function (n) {
      if (n.date) (byDate[n.date] = byDate[n.date] || []).push(n);
    });

    return {
      mon: S.weekStart === 'Mon',
      today: iso(new Date()),
      gmap: gmap,
      swatch: swatch,
      sorted: sorted,
      byDate: byDate,
      ed: S.notes.filter(function (n) { return n.id === S.editId; })[0] || null
    };
  }

  function cellsFor(y, m, mon, byDate, sel, today, dotBg) {
    var first = new Date(y, m, 1).getDay();
    var off = mon ? (first + 6) % 7 : first;
    var days = new Date(y, m + 1, 0).getDate();
    var rows = Math.ceil((off + days) / 7);
    var out = [];
    for (var i = 0; i < rows * 7; i++) {
      var d = i - off + 1;
      if (d < 1 || d > days) {
        out.push({ label: '', bg: PAGE, fg: INK, ring: 'none', dots: [], key: null });
        continue;
      }
      var k = y + '-' + pad(m + 1) + '-' + pad(d);
      var isS = k === sel, isT = k === today, ns = byDate[k] || [];
      out.push({
        label: String(d),
        bg: isS ? INK : PAPER,
        fg: isS ? PAPER : INK,
        key: k,
        isToday: isT,
        isSel: isS,
        ring: isT
          ? (isS
            ? 'inset 0 0 0 3px ' + INK + ', inset 0 0 0 5px ' + PAPER
            : 'inset 0 0 0 3px ' + PAPER + ', inset 0 0 0 5px ' + INK)
          : 'none',
        dots: ns.slice(0, 4).map(function (x) { return dotBg(x); })
      });
    }
    return out;
  }

  // ------------------------------------------------------------------ markup

  function weekdayLabels(mon) {
    return mon
      ? ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU']
      : ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
  }

  function rowHTML(n, meta, d, withSwatch) {
    var title = n.title || 'Untitled';
    var snip = n.body.split('\n').filter(Boolean).join(' · ') || 'Empty note';
    var metaTxt = meta === 'group'
      ? (n.group && d.gmap[n.group] ? d.gmap[n.group].name : '')
      : (n.date ? short(n.date) : '');
    return '<button class="rn-row' + (withSwatch ? '' : ' rn-row-in') + '" data-act="openNote" data-arg="' + esc(n.id) + '">'
      + (withSwatch ? '<span class="rn-sw" style="background:' + d.swatch(n) + '"></span>' : '')
      + '<span class="rn-row-body">'
      + '<span class="rn-row-top">'
      + '<span class="rn-row-title">' + esc(title) + '</span>'
      + '<span class="rn-row-meta">' + esc(metaTxt) + '</span>'
      + '</span>'
      + '<span class="rn-row-snip">' + esc(snip) + '</span>'
      + '</span></button>';
  }

  function gridHTML(cells, small, act) {
    var cls = small ? 'rn-cell-sm' : 'rn-cell';
    return '<div class="rn-grid">' + cells.map(function (c) {
      if (!c.key) {
        return '<button class="' + cls + '" style="background:' + c.bg + '" disabled aria-hidden="true"></button>';
      }
      var label = long(c.key) + ' ' + parseISO(c.key).getFullYear();
      var dots = '';
      if (!small) {
        dots = '<span class="rn-dots">' + c.dots.map(function (bg) {
          return '<span style="border-color:' + c.fg + ';background:' + bg + '"></span>';
        }).join('') + '</span>';
        if (c.dots.length) label += ', ' + c.dots.length + ' note' + (c.dots.length > 1 ? 's' : '');
      }
      return '<button class="' + cls + '" data-act="' + act + '" data-arg="' + c.key + '"'
        + ' aria-label="' + esc(label) + '"'
        + (c.isToday ? ' aria-current="date"' : '')
        + ' aria-pressed="' + (c.isSel ? 'true' : 'false') + '"'
        + ' style="background:' + c.bg + ';color:' + c.fg + ';box-shadow:' + c.ring + '">'
        + '<span>' + c.label + '</span>' + dots + '</button>';
    }).join('') + '</div>';
  }

  function calHTML(d) {
    var cells = cellsFor(S.vy, S.vm, d.mon, d.byDate, S.sel, d.today, d.swatch);
    var dayList = d.byDate[S.sel] || [];
    var h = '<div class="rn-pad">';

    h += '<div class="rn-month">'
      + '<button class="rn-month-btn" data-act="prevMonth" aria-label="Previous month">◀</button>'
      + '<div class="rn-month-label">' + MON[S.vm].toUpperCase() + ' ' + S.vy + '</div>'
      + '<button class="rn-month-btn" data-act="nextMonth" aria-label="Next month">▶</button>'
      + '</div>';

    h += '<div><div class="rn-dow">'
      + weekdayLabels(d.mon).map(function (w) { return '<span>' + w + '</span>'; }).join('')
      + '</div>' + gridHTML(cells, false, 'pickDay') + '</div>';

    h += '<div class="rn-sel-head">'
      + '<span class="rn-sel-label">' + long(S.sel) + (S.sel === d.today ? ' · TODAY' : '') + '</span>'
      + '<span class="rn-tag">' + (dayList.length === 1 ? '1 NOTE' : dayList.length + ' NOTES') + '</span>'
      + '</div>';

    h += '<div class="rn-list rn-tight">'
      + dayList.map(function (n) { return rowHTML(n, 'group', d, true); }).join('')
      + (dayList.length === 0 ? '<div class="rn-empty">Nothing filed on this day.</div>' : '')
      + '</div>';

    h += '<button class="rn-btn-dash" data-act="newForDay">+ New note on ' + short(S.sel) + '</button>';

    return h + '</div>';
  }

  function notesHTML(d) {
    var h = '<div class="rn-pad rn-gap14">';

    h += '<div class="rn-toolbar">'
      + '<div class="rn-seg" role="group" aria-label="Grouping">'
      + '<button data-act="modeGroup" class="' + (S.mode === 'group' ? 'is-on' : '') + '" aria-pressed="' + (S.mode === 'group') + '">BY GROUP</button>'
      + '<button data-act="modeDate" class="' + (S.mode === 'date' ? 'is-on' : '') + '" aria-pressed="' + (S.mode === 'date') + '">BY DATE</button>'
      + '</div>'
      + '<button class="rn-btn" data-act="openGroupDialog">+ GROUP</button>'
      + '</div>';

    if (S.mode === 'group') {
      var folders = S.groups.concat([{ id: null, name: 'Unfiled', p: -1 }]).map(function (g) {
        // A real group holds everything filed under it. "Unfiled" only collects
        // notes that are neither grouped nor pinned to a day, so nothing hides.
        var items = d.sorted.filter(function (n) {
          return (n.group || null) === g.id && (g.id || !n.date);
        });
        var k = g.id == null ? '_' : g.id;
        var open = S.open[k] === undefined ? true : S.open[k];
        return { g: g, items: items, open: open, k: k };
      });

      h += '<div class="rn-folders">' + folders.map(function (f) {
        var sw = f.g.p < 0 ? PAPER : PATS[f.g.p % PATS.length];
        var s = '<div class="rn-folder">'
          + '<button class="rn-folder-head" data-act="toggleFolder" data-arg="' + esc(f.k) + '" aria-expanded="' + f.open + '">'
          + '<span class="rn-caretx">' + (f.open ? '▾' : '▸') + '</span>'
          + '<span class="rn-sw-lg" style="background:' + sw + '"></span>'
          + '<span class="rn-fname">' + esc(f.g.name) + '</span>'
          + '<span class="rn-fcount">' + f.items.length + '</span>'
          + '</button>';
        if (f.open) {
          s += '<div class="rn-folder-body">'
            + f.items.map(function (n) { return rowHTML(n, 'date', d, false); }).join('')
            + '<button class="rn-btn-dash rn-sm" data-act="addToFolder" data-arg="' + esc(f.g.id == null ? '' : f.g.id) + '">+ Add to ' + esc(f.g.name) + '</button>'
            + '</div>';
        }
        return s + '</div>';
      }).join('') + '</div>';
    } else {
      var dates = Object.keys(d.byDate).sort();
      var sections = dates.map(function (dt) {
        return {
          label: long(dt) + ' ' + parseISO(dt).getFullYear(),
          tag: dt === d.today ? 'TODAY' : (dt < d.today ? 'PAST' : ''),
          items: d.byDate[dt],
          jump: dt
        };
      });
      var undated = d.sorted.filter(function (n) { return !n.date; });
      if (undated.length) {
        sections.push({ label: 'NO DATE', tag: String(undated.length), items: undated, jump: '' });
      }

      h += '<div class="rn-sections">' + sections.map(function (sec) {
        return '<div class="rn-section">'
          + '<button class="rn-section-head" data-act="jumpDate" data-arg="' + sec.jump + '">'
          + '<span>' + esc(sec.label) + '</span><span class="rn-tag">' + esc(sec.tag) + '</span>'
          + '</button>'
          + sec.items.map(function (n) { return rowHTML(n, 'group', d, true); }).join('')
          + '</div>';
      }).join('') + '</div>';
    }

    return h + '</div>';
  }

  function editorHTML(d) {
    var ed = d.ed;
    var hasDate = !!ed.date;
    var chips = [{ id: null, name: 'None', p: -1 }].concat(S.groups);

    var h = '<div class="rn-editor">';

    h += '<div class="rn-ed-bar">'
      + '<button class="rn-btn" data-act="closeEditor">◀ DONE</button>'
      + '<button class="rn-btn" data-act="askDelete">DELETE</button>'
      + '</div>';

    h += '<div class="rn-ed-meta">'
      + '<input id="edTitle" class="rn-ed-title" value="' + esc(ed.title) + '" placeholder="Untitled" aria-label="Note title">'
      + '<div class="rn-field">'
      + '<span class="rn-field-label">DATE</span>'
      + '<button class="rn-chip' + (hasDate ? ' is-on' : '') + '" data-act="openDate">'
      + (hasDate ? esc(long(ed.date) + ' ' + parseISO(ed.date).getFullYear()) : '+ PICK A DAY')
      + '</button>'
      + (hasDate ? '<button class="rn-chip" data-act="clearDate">UNLINK</button>' : '')
      + '</div>'
      + '<div class="rn-field">'
      + '<span class="rn-field-label">GROUP</span>'
      + '<div class="rn-chips rn-scroll">'
      + chips.map(function (g) {
        var on = (ed.group || null) === g.id;
        var sw = g.p < 0 ? 'transparent' : PATS[g.p % PATS.length];
        return '<button class="rn-chip' + (on ? ' is-on' : '') + '" data-act="pickGroup" data-arg="' + esc(g.id == null ? '' : g.id) + '" aria-pressed="' + on + '">'
          + '<span class="rn-chip-sw" style="border-color:currentColor;background:' + sw + '"></span>' + esc(g.name) + '</button>';
      }).join('')
      + '<button class="rn-chip rn-chip-dash" data-act="openGroupDialog" aria-label="New group">+</button>'
      + '</div></div></div>';

    h += '<textarea id="edBody" class="rn-ed-body" placeholder="Start typing…" aria-label="Note body">' + esc(ed.body) + '</textarea>';

    h += '<div class="rn-ed-foot"><span id="edStats">' + stats(ed) + '</span><span>AUTOSAVED</span></div>';

    return h + '</div>';
  }

  function stats(ed) {
    var words = (ed.body.trim().match(/\S+/g) || []).length;
    return words + ' WORDS · ' + ed.body.length + ' CHARS';
  }

  function dialogHTML(d) {
    if (S.dialog === 'date') {
      var ed = d.ed;
      var cells = cellsFor(S.py, S.pm, d.mon, {}, ed && ed.date, d.today, d.swatch);
      return '<div class="rn-dlg-label">LINK TO A DAY</div>'
        + '<div class="rn-dlg-month">'
        + '<button data-act="pPrev" aria-label="Previous month">◀</button>'
        + '<div class="rn-dlg-mlabel">' + MON[S.pm].slice(0, 3).toUpperCase() + ' ' + S.py + '</div>'
        + '<button data-act="pNext" aria-label="Next month">▶</button>'
        + '</div>'
        + '<div><div class="rn-dow-sm">'
        + weekdayLabels(d.mon).map(function (w) { return '<span>' + w + '</span>'; }).join('')
        + '</div>' + gridHTML(cells, true, 'pPick') + '</div>'
        + '<div class="rn-dlg-actions">'
        + '<button class="rn-btn-flat" data-act="clearDate">NO DATE</button>'
        + '<button class="rn-btn-flat" data-act="closeDialog">CANCEL</button>'
        + '</div>';
    }

    if (S.dialog === 'group') {
      return '<div class="rn-dlg-label">NEW GROUP</div>'
        + '<div class="rn-dlg-text">Groups hold notes that don’t belong to a day.</div>'
        + '<input id="dlgInput" class="rn-input" placeholder="e.g. Recipes" aria-label="Group name">'
        + '<div class="rn-dlg-actions" style="padding-top:2px">'
        + '<button class="rn-btn-flat" data-act="closeDialog">CANCEL</button>'
        + '<button class="rn-btn-flat rn-btn-default" data-act="confirmGroup">OK</button>'
        + '</div>';
    }

    if (S.dialog === 'delete') {
      var t = d.ed ? (d.ed.title || 'Untitled') : '';
      return '<div class="rn-warn">'
        + '<div class="rn-warn-badge" aria-hidden="true"><span>!</span></div>'
        + '<div class="rn-warn-text">Throw away “' + esc(t) + '”? This can’t be undone.</div>'
        + '</div>'
        + '<div class="rn-dlg-actions">'
        + '<button class="rn-btn-flat rn-btn-default" data-act="closeDialog">CANCEL</button>'
        + '<button class="rn-btn-flat rn-btn-danger" data-act="confirmDelete">DELETE</button>'
        + '</div>';
    }

    if (S.dialog === 'settings') {
      return '<div class="rn-dlg-label">SETTINGS</div>'
        + '<div class="rn-setting">'
        + '<span class="rn-dlg-label">SCREEN</span>'
        + '<div class="rn-seg" role="group" aria-label="Screen">'
        + '<button data-act="setTheme" data-arg="Light" class="' + (S.theme === 'Light' ? 'is-on' : '') + '" aria-pressed="' + (S.theme === 'Light') + '">PAPER</button>'
        + '<button data-act="setTheme" data-arg="Dark" class="' + (S.theme === 'Dark' ? 'is-on' : '') + '" aria-pressed="' + (S.theme === 'Dark') + '">INVERTED</button>'
        + '</div></div>'
        + '<div class="rn-setting">'
        + '<span class="rn-dlg-label">WEEK STARTS</span>'
        + '<div class="rn-seg" role="group" aria-label="Week starts">'
        + '<button data-act="setWeekStart" data-arg="Mon" class="' + (S.weekStart === 'Mon' ? 'is-on' : '') + '" aria-pressed="' + (S.weekStart === 'Mon') + '">MONDAY</button>'
        + '<button data-act="setWeekStart" data-arg="Sun" class="' + (S.weekStart === 'Sun' ? 'is-on' : '') + '" aria-pressed="' + (S.weekStart === 'Sun') + '">SUNDAY</button>'
        + '</div></div>'
        + '<div class="rn-setting">'
        + '<span class="rn-dlg-label">DATA</span>'
        + '<div class="rn-dlg-row">'
        + '<button class="rn-btn-flat" data-act="exportData">EXPORT</button>'
        + '<button class="rn-btn-flat" data-act="pickFile">IMPORT</button>'
        + '</div>'
        + '<div class="rn-dlg-fine">' + S.notes.length + ' notes · ' + S.groups.length + ' groups · saved on this device</div>'
        + '</div>'
        + '<div class="rn-dlg-actions">'
        + '<button class="rn-btn-flat rn-btn-default" data-act="closeDialog">DONE</button>'
        + '</div>';
    }

    if (S.dialog === 'import' && S.pending) {
      var pn = S.pending.notes.length, pg = S.pending.groups.length;
      return '<div class="rn-dlg-label">IMPORT</div>'
        + '<div class="rn-dlg-text"><b>' + esc(S.pending.name || 'That file') + '</b> holds '
        + pn + (pn === 1 ? ' note' : ' notes') + ' and ' + pg + (pg === 1 ? ' group' : ' groups') + '.</div>'
        + '<div class="rn-dlg-fine">Merge keeps what you have and adds what is new. Where the same note exists on both sides, the newer edit wins.</div>'
        + '<div class="rn-dlg-fine">Replace throws away all ' + S.notes.length + ' notes here first. That can’t be undone.</div>'
        + '<div class="rn-dlg-actions">'
        + '<button class="rn-btn-flat" data-act="cancelImport">CANCEL</button>'
        + '<button class="rn-btn-flat rn-btn-danger" data-act="importReplace">REPLACE</button>'
        + '<button class="rn-btn-flat rn-btn-default" data-act="importMerge">MERGE</button>'
        + '</div>';
    }

    if (S.dialog === 'importError') {
      return '<div class="rn-warn">'
        + '<div class="rn-warn-badge" aria-hidden="true"><span>!</span></div>'
        + '<div class="rn-warn-text">' + esc(S.importError || 'That file could not be read.') + '</div>'
        + '</div>'
        + '<div class="rn-dlg-fine">Nothing was changed.</div>'
        + '<div class="rn-dlg-actions">'
        + '<button class="rn-btn-flat rn-btn-default" data-act="cancelImport">BACK</button>'
        + '</div>';
    }

    return '';
  }

  // ------------------------------------------------------------------ render

  // Rebuilding innerHTML would otherwise drop the caret, so snapshot and restore
  // the focused field around every render.
  function withFocus(fn) {
    var a = document.activeElement;
    var snap = null;
    if (a && a.id && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA')) {
      snap = { id: a.id, start: a.selectionStart, end: a.selectionEnd, scroll: a.scrollTop };
    }
    fn();
    if (snap) {
      var el = $(snap.id);
      if (el) {
        el.focus({ preventScroll: true });
        try { el.setSelectionRange(snap.start, snap.end); } catch (e) { /* type has no range */ }
        el.scrollTop = snap.scroll;
      }
    }
  }

  function render() {
    withFocus(function () {
      var d = derive();

      // Some state combinations can leave editId dangling (e.g. a deleted note).
      if (S.screen === 'editor' && !d.ed) { S.screen = S.prev || 'cal'; S.editId = null; }

      $('app').classList.toggle('is-dark', S.theme === 'Dark');
      var meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', S.theme === 'Dark' ? '#252525' : '#DADADA');
      document.querySelector('meta[name="color-scheme"]').setAttribute('content', S.theme === 'Dark' ? 'dark' : 'light');

      $('winTitle').textContent =
        S.screen === 'cal' ? 'CALENDAR' : S.screen === 'notes' ? 'ALL NOTES' : 'NOTE';

      var screen = $('screen');
      screen.innerHTML =
        S.screen === 'cal' ? calHTML(d) :
        S.screen === 'notes' ? notesHTML(d) :
        editorHTML(d);

      $('tabCal').classList.toggle('is-on', S.screen === 'cal');
      $('tabCal').setAttribute('aria-pressed', S.screen === 'cal');
      $('tabNotes').classList.toggle('is-on', S.screen === 'notes');
      $('tabNotes').setAttribute('aria-pressed', S.screen === 'notes');

      var overlay = $('overlay');
      if (S.dialog) {
        $('dialogBody').innerHTML = dialogHTML(d);
        overlay.hidden = false;
      } else {
        overlay.hidden = true;
        $('dialogBody').innerHTML = '';
      }
    });

    if (S.dialog === 'group') {
      var inp = $('dlgInput');
      if (inp && document.activeElement !== inp) inp.focus();
    }
  }

  function announce(msg) { $('live').textContent = msg; }

  // ------------------------------------------------------------------ actions

  function currentNote() {
    return S.notes.filter(function (n) { return n.id === S.editId; })[0] || null;
  }

  function updateNote(fields) {
    S.notes = S.notes.map(function (n) {
      if (n.id !== S.editId) return n;
      var out = Object.assign({}, n, fields);
      out.updated = Date.now();
      return out;
    });
    save();
  }

  function newNote(opts) {
    opts = opts || {};
    var n = {
      id: uid(), title: '', body: '',
      date: opts.date === undefined ? null : opts.date,
      group: opts.group === undefined ? null : opts.group,
      updated: Date.now()
    };
    S.notes = [n].concat(S.notes);
    S.prev = S.screen === 'editor' ? S.prev : S.screen;
    S.editId = n.id;
    S.screen = 'editor';
    S.dialog = null;
    save();
    render();
    var t = $('edTitle');
    if (t) t.focus();
  }

  function openNote(id) {
    S.prev = S.screen;
    S.editId = id;
    S.screen = 'editor';
    S.dialog = null;
    render();
  }

  // Leaving the editor throws away a note that was never written in, and pulls
  // the calendar to the note's day when that is where we are heading.
  function closeEditor(target) {
    if (S.screen !== 'editor') {
      if (target) S.screen = target;
      return;
    }
    var n = currentNote();
    var empty = !!n && !n.title.trim() && !n.body.trim();
    var to = target || S.prev || 'cal';
    if (empty) S.notes = S.notes.filter(function (x) { return x.id !== S.editId; });
    S.screen = to;
    S.editId = null;
    S.dialog = null;
    if (to === 'cal' && n && n.date && !empty) {
      var dt = parseISO(n.date);
      S.sel = n.date;
      S.vy = dt.getFullYear();
      S.vm = dt.getMonth();
    }
    save();
  }

  function shiftMonth(k, dir) {
    var y = S[k + 'y'], m = S[k + 'm'] + dir;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    S[k + 'y'] = y;
    S[k + 'm'] = m;
  }

  function goToday() {
    var t = new Date();
    closeEditor('cal');
    S.sel = iso(t);
    S.vy = t.getFullYear();
    S.vm = t.getMonth();
  }

  function confirmGroup() {
    var inp = $('dlgInput');
    var name = inp ? inp.value.trim() : '';
    if (!name) { if (inp) inp.focus(); return; }
    var g = { id: uid(), name: name, p: S.groups.length % PATS.length };
    S.groups = S.groups.concat([g]);
    S.dialog = null;
    if (S.screen === 'editor' && S.editId) updateNote({ group: g.id });
    save();
    render();
    announce('Group ' + name + ' created.');
  }

  // ----------------------------------------------------------- import/export

  // Preferences are deliberately not in the backup: theme and week start belong
  // to the device you are reading on, not to the notes.
  function exportData() {
    var payload = {
      app: 'retro-notes',
      version: 1,
      exported: new Date().toISOString(),
      groups: S.groups,
      notes: S.notes
    };
    var url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    var a = document.createElement('a');
    a.href = url;
    a.download = 'retro-notes-' + iso(new Date()) + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    announce('Exported ' + S.notes.length + ' notes and ' + S.groups.length + ' groups.');
  }

  function applyImport(mode) {
    var p = S.pending;
    if (!p) return;
    var groups, notes;

    if (mode === 'replace') {
      groups = p.groups.slice();
      notes = p.notes.slice();
    } else {
      groups = S.groups.slice();
      var byId = {}, byName = {}, remap = {};
      groups.forEach(function (g) { byId[g.id] = true; byName[g.name.toLowerCase()] = g.id; });

      p.groups.forEach(function (g) {
        var sameName = byName[g.name.toLowerCase()];
        if (sameName) {
          // Two devices made the same group independently: fold them together.
          remap[g.id] = sameName;
          return;
        }
        var g2 = g;
        if (byId[g.id]) {
          // Same id, different name — a genuine collision. Keep both.
          g2 = { id: uid(), name: g.name, p: g.p };
          remap[g.id] = g2.id;
        }
        groups.push(g2);
        byId[g2.id] = true;
        byName[g2.name.toLowerCase()] = g2.id;
      });

      var map = {};
      S.notes.forEach(function (n) { map[n.id] = n; });
      p.notes.forEach(function (n) {
        var g = n.group && remap[n.group] ? remap[n.group] : n.group;
        var incoming = g === n.group ? n : Object.assign({}, n, { group: g });
        var cur = map[n.id];
        // Same id on both sides: last edit wins.
        if (!cur || incoming.updated >= cur.updated) map[n.id] = incoming;
      });
      notes = Object.keys(map).map(function (k) { return map[k]; });
    }

    S.groups = groups;
    S.notes = reconcile(notes, groups);
    S.pending = null;
    S.dialog = null;
    S.editId = null;
    if (S.screen === 'editor') S.screen = S.prev || 'cal';
    S.open = {};
    flush();
    announce(mode === 'replace'
      ? 'Replaced everything with ' + S.notes.length + ' notes.'
      : 'Merged. Now holding ' + S.notes.length + ' notes.');
  }

  function onFilePicked(file) {
    if (!file) return;
    file.text().then(function (text) {
      var parsed = parseBackup(text);
      S.pending = parsed;
      S.pending.name = file.name;
      S.dialog = 'import';
      render();
    }).catch(function (err) {
      S.pending = null;
      S.importError = (err && err.message && err.name !== 'SyntaxError')
        ? err.message
        : 'That file isn’t readable JSON.';
      S.dialog = 'importError';
      render();
    });
  }

  var ACTIONS = {
    stop: function () { /* swallow clicks inside the dialog */ },

    openSettings: function () { S.dialog = 'settings'; },
    setTheme: function (v) { S.theme = v === 'Dark' ? 'Dark' : 'Light'; savePrefs(); },
    setWeekStart: function (v) { S.weekStart = v === 'Sun' ? 'Sun' : 'Mon'; savePrefs(); },

    goToday: goToday,
    goCal: function () { closeEditor('cal'); },
    goNotes: function () { closeEditor('notes'); },
    newBlank: function () { newNote(); return true; },

    prevMonth: function () { shiftMonth('v', -1); },
    nextMonth: function () { shiftMonth('v', 1); },
    pickDay: function (k) { S.sel = k; },
    newForDay: function () { newNote({ date: S.sel }); return true; },
    openNote: function (id) { openNote(id); return true; },

    modeGroup: function () { S.mode = 'group'; },
    modeDate: function () { S.mode = 'date'; },
    toggleFolder: function (k) {
      var cur = S.open[k] === undefined ? true : S.open[k];
      S.open[k] = !cur;
    },
    addToFolder: function (id) { newNote({ group: id || null }); return true; },
    jumpDate: function (dt) {
      if (!dt) return;
      var x = parseISO(dt);
      S.screen = 'cal';
      S.sel = dt;
      S.vy = x.getFullYear();
      S.vm = x.getMonth();
    },

    closeEditor: function () { closeEditor(); },
    askDelete: function () { S.dialog = 'delete'; },
    openDate: function () {
      var n = currentNote();
      var d = (n && n.date) ? parseISO(n.date) : new Date(S.vy, S.vm, 1);
      S.py = d.getFullYear();
      S.pm = d.getMonth();
      S.dialog = 'date';
    },
    clearDate: function () { updateNote({ date: null }); S.dialog = null; },
    pickGroup: function (id) { updateNote({ group: id || null }); },

    pPrev: function () { shiftMonth('p', -1); },
    pNext: function () { shiftMonth('p', 1); },
    pPick: function (k) { updateNote({ date: k }); S.dialog = null; },

    exportData: function () { exportData(); return true; },
    pickFile: function () {
      var f = $('fileIn');
      f.value = '';          // so re-choosing the same file still fires change
      f.click();
      return true;
    },
    importMerge: function () { applyImport('merge'); },
    importReplace: function () { applyImport('replace'); },
    cancelImport: function () { S.pending = null; S.dialog = 'settings'; },

    openGroupDialog: function () { S.dialog = 'group'; },
    confirmGroup: function () { confirmGroup(); return true; },
    closeDialog: function () { S.dialog = null; S.pending = null; },
    confirmDelete: function () {
      var n = currentNote();
      S.notes = S.notes.filter(function (x) { return x.id !== S.editId; });
      S.editId = null;
      S.screen = S.prev || 'cal';
      S.dialog = null;
      save();
      announce('Deleted ' + (n ? (n.title || 'Untitled') : 'note') + '.');
    }
  };

  // -------------------------------------------------------------------- wiring

  document.addEventListener('click', function (e) {
    var el = e.target.closest ? e.target.closest('[data-act]') : null;
    if (!el) return;
    var fn = ACTIONS[el.dataset.act];
    if (!fn) return;
    // The overlay only dismisses on a click that actually landed on the backdrop.
    if (el.id === 'overlay' && e.target !== el) return;
    // Actions returning true have already rendered (and may have moved focus).
    if (fn(el.dataset.arg) !== true) render();
  });

  $('fileIn').addEventListener('change', function (e) {
    onFilePicked(e.target.files && e.target.files[0]);
  });

  document.addEventListener('input', function (e) {
    if (e.target.id === 'edTitle') {
      updateNote({ title: e.target.value });
    } else if (e.target.id === 'edBody') {
      updateNote({ body: e.target.value });
    } else {
      return;
    }
    // Patch the footer rather than re-render: a full rebuild on every keystroke
    // is wasted work, and the fields already show what was typed.
    var n = currentNote();
    var out = $('edStats');
    if (n && out) out.textContent = stats(n);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (S.dialog) { S.dialog = null; S.pending = null; render(); }
      else if (S.screen === 'editor') { closeEditor(); render(); }
      return;
    }
    if (e.key === 'Enter' && e.target.id === 'dlgInput') {
      e.preventDefault();
      confirmGroup();
      return;
    }
    var mod = e.metaKey || e.ctrlKey;
    if (!mod) return;
    var k = e.key.toLowerCase();
    if (k === 'n') { e.preventDefault(); newNote(); }
    else if (k === 'g') { e.preventDefault(); S.dialog = 'group'; render(); }
    else if (k === 't') { e.preventDefault(); goToday(); render(); }
    else if (k === '1') { e.preventDefault(); closeEditor('cal'); render(); }
    else if (k === '2') { e.preventDefault(); closeEditor('notes'); render(); }
  });

  // Flush pending writes before the tab goes away. On mobile an app is usually
  // backgrounded rather than closed, so visibilitychange is the one that counts.
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') flush();
  });

  // Another tab edited the same store: adopt it rather than fight over it.
  window.addEventListener('storage', function (e) {
    if (e.key !== KEY || !e.newValue) return;
    try {
      var v = JSON.parse(e.newValue);
      if (Array.isArray(v.notes)) S.notes = v.notes;
      if (Array.isArray(v.groups)) S.groups = v.groups;
      render();
    } catch (err) { /* ignore */ }
  });

  load();

  // Manifest shortcuts land on ./?new=1 and ./?screen=notes. Honour them, then
  // strip the query so a refresh does not create a second blank note.
  (function applyLaunchIntent() {
    var q = new URLSearchParams(location.search);
    var wantsNew = q.get('new') === '1';
    if (q.get('screen') === 'notes') S.screen = 'notes';
    if (q.has('new') || q.has('screen')) {
      history.replaceState(null, '', location.pathname + location.hash);
    }
    if (wantsNew) { newNote(); return; }
    render();
  })();

  // ------------------------------------------------------------ service worker

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('./sw.js').catch(function () { /* offline is best-effort */ });

      var had = !!navigator.serviceWorker.controller;
      navigator.serviceWorker.addEventListener('controllerchange', function () {
        // A new worker took over an already-controlled page: reload once so the
        // HTML, CSS and JS in memory all come from the same version.
        if (had && !window.__rnReloaded) { window.__rnReloaded = true; location.reload(); }
      });
    });
  }

})();
