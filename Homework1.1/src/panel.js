// §13.7 wanted sliders grouped in sections. There were about fifty, which is
// not a control panel — it is fifty ways to make the piece worse. These are the
// ones worth reaching for; the rest are settled constants in config.js.

import { CFG, SCHEMA } from './config.js?v=a6732beb';

// Not every setting is a number — breakOnHedge is a switch, and calling
// toFixed on it is what used to make `export settings` do nothing at all.
const fmt = (v) => {
  if (typeof v === 'boolean') return String(v);
  if (typeof v !== 'number' || !isFinite(v)) return String(v);
  return Number.isInteger(v) ? String(v) : String(Number(v.toFixed(4)));
};

export function buildPanel(root, onChange) {
  for (const [group, rows] of SCHEMA) {
    const box = document.createElement('details');
    box.open = true;
    const head = document.createElement('summary');
    head.textContent = group;
    box.appendChild(head);
    for (const row of rows) box.appendChild(control(row, onChange));
    root.appendChild(box);
  }
}

function control([key, min, max, step, label, hint], onChange) {
  const row = document.createElement('div');
  row.className = 'ctl';
  const top = document.createElement('div');
  top.className = 'ctl-head';
  const name = document.createElement('span');
  name.className = 'ctl-name';
  name.textContent = label;
  const note = document.createElement('div');
  note.className = 'ctl-hint';
  note.textContent = hint;

  if (typeof CFG[key] === 'boolean') {
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = CFG[key];
    box.addEventListener('change', () => {
      CFG[key] = box.checked;
      onChange && onChange(key, box.checked);
    });
    top.append(name, box);
    row.append(top, note);
    return row;
  }

  const out = document.createElement('input');
  out.className = 'ctl-val';
  out.type = 'text';
  out.value = fmt(CFG[key]);
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = min; slider.max = max; slider.step = step;
  slider.value = CFG[key];

  // An emptied box is not a zero. Number('') === 0 slipped straight past an
  // isFinite guard and quietly set the setting to nothing.
  const set = (raw) => {
    const v = String(raw).trim() === '' ? NaN : Number(raw);
    if (!isFinite(v)) { out.value = fmt(CFG[key]); return; }
    const clamped = Math.min(max, Math.max(min, v));
    CFG[key] = clamped;
    slider.value = clamped;
    out.value = fmt(clamped);
    onChange && onChange(key, clamped);
  };
  slider.addEventListener('input', () => set(slider.value));
  out.addEventListener('change', () => set(out.value));

  top.append(name, out);
  row.append(top, slider, note);
  return row;
}

/** Everything, not just the controls — so a tuning session can be kept. */
export function exportConfig() {
  const shown = new Set(SCHEMA.flatMap(([, rows]) => rows.map((r) => r[0])));
  const lines = [];
  for (const [group, rows] of SCHEMA) {
    lines.push('// ' + group);
    for (const r of rows) lines.push(`${r[0]}: ${fmt(CFG[r[0]])},`);
    lines.push('');
  }
  lines.push('// settled');
  let line = '';
  for (const k of Object.keys(CFG)) {
    if (shown.has(k)) continue;
    const piece = `${k}: ${fmt(CFG[k])},  `;
    if (line.length + piece.length > 74) { lines.push(line.trimEnd()); line = ''; }
    line += piece;
  }
  if (line.trim()) lines.push(line.trimEnd());
  return lines.join('\n');
}
