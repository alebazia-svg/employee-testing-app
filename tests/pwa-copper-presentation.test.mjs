import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import postcss from 'postcss';

const css = readFileSync(new URL('../public/pwa-copper.css', import.meta.url), 'utf8');
const root = postcss.parse(css);
const luminance = hex => {
  const rgb = hex.match(/[a-f\d]{2}/gi).map(part => parseInt(part, 16) / 255)
    .map(n => n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4);
  return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
};
const contrast = (a, b) => (Math.max(luminance(a), luminance(b)) + .05) / (Math.min(luminance(a), luminance(b)) + .05);

test('completed checklist edit actions use a readable copper shade, not legacy blue', () => {
  assert.match(css, /\.pwa-review-plan button\.text-primary \{ color:#653919 !important/);
  assert.match(css, /\.pwa-review-plan button\.text-primary:focus-visible \{ outline:2px solid var\(--pwa-copper\)/);
  // Completed rows have 75% opacity: verify the blended foreground on white too.
  assert.ok(contrast('#8c6b53', '#ffffff') >= 4.5);
});

test('active indicators share a larger green dot and a quiet halo', () => {
  for (const selector of ['.pwa-on-shift-dot', "[data-colleague-group='Сейчас работают'] .employee-material-person::before"]) {
    let found = false;
    root.walkRules(rule => {
      if (!rule.selector.includes(selector)) return;
      const value = prop => rule.nodes.find(n => n.prop === prop)?.value;
      if (value('background') !== '#159447') return;
      assert.equal(value('width'), '10px');
      assert.equal(value('height'), '10px');
      assert.equal(value('box-shadow'), '0 0 0 3px #d8efdf');
      found = true;
    });
    assert.ok(found, selector);
  }
  assert.ok(contrast('#159447', '#ffffff') >= 3);
});

test('motion is brief, has no loop, and respects reduced motion', () => {
  assert.match(css, /animation:pwa-sheet-enter 200ms/);
  assert.match(css, /transition:width 240ms ease-out/);
  assert.doesNotMatch(css, /\binfinite\b/);
  const media = root.nodes.find(node => node.type === 'atrule' && node.params.includes('prefers-reduced-motion'));
  assert.match(media.toString(), /\.employee-material-sheet \{ animation:none !important/);
  assert.match(media.toString(), /\.pwa-checklist-track > span \{ transition:none !important/);
  assert.match(media.toString(), /transform:none !important/);
});

test('checklist hierarchy separates the work card, disclosure row and colleagues', () => {
  assert.match(css, /div\.pwa-review-task \{ background:#ffffff !important;[^}]*border-left:3px solid var\(--pwa-copper\)/);
  assert.match(css, /\.pwa-review-task > button\.employee-material-secondary-action \{[^}]*display:flex !important;[^}]*align-items:center !important;[^}]*justify-content:space-between !important;[^}]*min-height:48px/);
  assert.match(css, /\.pwa-review-day > #pwa-colleagues-today \{ margin-top:24px !important/);
});

test('active shift is compact and colleague status colours preserve their meanings', () => {
  assert.match(css, /\.pwa-workday-summary-shell \{ display:grid/);
  assert.match(css, /\.pwa-workday-summary \{ display:contents !important/);
  assert.match(css, /\.pwa-workday-summary-timer \{[^}]*font-variant-numeric:tabular-nums/);
  assert.match(css, /data-colleague-group='График не заполнен'\] \.employee-material-person::before \{ background:#b27b16/);
});

test('scanner instruction has explicit contrasting foreground and background', () => {
  assert.match(css, /div\.pwa-scan-instruction \{ background:#24282d !important/);
  assert.match(css, /div\.pwa-scan-instruction p \{ color:#ffffff !important/);
  assert.ok(contrast('#ffffff', '#24282d') >= 7);
});

test('scanner retry and handover auxiliary actions use the shared theme', () => {
  assert.match(css, /\.employee-material-scanner \{ background:#24282d !important/);
  assert.match(css, /\.employee-material-scanner-warning > button \{ background:#efbd93 !important; color:#24282d !important/);
  assert.match(css, /\.employee-material-sheet button\.underline-offset-4 \{ background:transparent !important/);
  assert.ok(contrast('#efbd93', '#24282d') >= 7);
});

test('all copper presentation rules remain test-marker scoped', () => {
  root.walkRules(rule => {
    let ancestor = rule;
    while (ancestor && !ancestor.selector?.includes('body:has(#pwa-copper-theme)')) ancestor = ancestor.parent;
    assert.ok(ancestor, `Unscoped rule: ${rule.selector}`);
  });
});

test('chosen text token contrasts against the selected graphite surface', () => {
  const token = css.match(/--pwa-selected-text:(#[a-f\d]{6})/i)[1];
  assert.ok(contrast(token, '#24282d') >= 7);
});

test('reduced transparency supplies both solid surface and contrasting labels', () => {
  const media = root.nodes.find(node => node.type === 'atrule' && node.params.includes('prefers-reduced-transparency'));
  assert.ok(media);
  assert.match(media.toString(), /background:#191c20/);
  assert.match(media.toString(), /color:#f6f3ed/);
  assert.ok(contrast('#f6f3ed', '#191c20') >= 7);
});

test('file actions include an explicit disabled state and keyboard focus', () => {
  assert.match(css, /label:has\(> input\[type=file\]:disabled\)/);
  assert.match(css, /label:has\(> input\[type=file\]:focus-visible\)/);
});

test('detail pages use the same light surface, not only the flex home wrapper', () => {
  assert.match(css, /\.employee-material-shell \{ background:var\(--pwa-canvas\) !important; \}/);
  assert.match(css, /\.employee-material-header \+ div \{ background:var\(--pwa-canvas\)/);
});

test('light content overlaps the graphite header without moving the content down', () => {
  assert.match(css, /\.employee-material-header \{ padding:22px 18px 44px !important/);
  assert.match(css, /\.employee-material-header \+ div \{[^}]*border-radius:26px 26px 0 0; position:relative; margin-top:-26px/);
});

test('schedule actions stay compact with touch-sized targets and readable calendar dates', () => {
  assert.match(css, /\.employee-material-day-card > div\.m-0 > button \{ min-height:44px !important/);
  assert.match(css, /\.employee-material-calendar-card > \.justify-center > button \{ min-width:0 !important/);
  assert.match(css, /\.employee-material-calendar-day > span:first-child > span:first-child \{ font-size:15px !important/);
});

test('month cells are square and omit initials without changing the selected-day card', () => {
  assert.match(css, /\.employee-material-calendar-day \{ aspect-ratio:1 !important; min-height:36px/);
  assert.match(css, /\.employee-material-calendar-day > span:not\(:first-child\) \{ display:none !important/);
});

test('active schedule tab uses white text on graphite', () => {
  assert.match(css, /\.employee-material-ui \.employee-material-segment-option\.is-active \{ background:#24282d !important; color:#ffffff !important/);
});

test('today keeps a copper frame independently of the inspected date', () => {
  assert.match(css, /\.employee-material-calendar-day\.is-today \{ outline:2px solid var\(--pwa-copper\) !important; outline-offset:-2px/);
  assert.match(css, /\.employee-material-calendar-day\.is-selected:not\(:focus-visible\) \{ outline:none !important/);
  assert.match(css, /\.employee-material-calendar-day\[aria-pressed=true\] \{ outline:3px solid/);
});

test('legend is left aligned and spaced independently of the bulk edit action', () => {
  assert.match(css, /\.employee-material-calendar-card > \.flex-nowrap \{ justify-content:flex-start; flex-wrap:wrap; gap:8px 12px; margin-top:12px !important/);
  assert.doesNotMatch(css, /\.employee-material-calendar-card > \.justify-center \{/);
});

test('checklist counter decoration cannot recolor the progress fill', () => {
  assert.doesNotMatch(css, /\.pwa-checklist-heading\s*>\s*div\s*>\s*span/);
  assert.match(css, /\.pwa-checklist-track > span \{ background:linear-gradient\(90deg,#cb8956,#b96c36\) !important/);
});

test('cash actions are white and contrast with disabled actions; details remain unfilled', () => {
  assert.match(css, /\.employee-material-ui \.pwa-review-cash > \.grid > button \{[^}]*min-height:70px[^}]*background:#ffffff/);
  assert.match(css, /\.employee-material-ui div\.pwa-review-details \{ background:transparent/);
});
