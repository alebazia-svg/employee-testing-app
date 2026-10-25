const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

// Execute the shipped hook with a controlled page lifecycle; no business actions.
function page({ preview = null, visible = true, disabled = false } = {}) {
  let now = 100000, effect;
  const timers = new Map(), listeners = new Map(), events = [];
  let id = 0;
  const document = { visibilityState: visible ? 'visible' : 'hidden',
    addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: name => listeners.delete(name) };
  const window = { setTimeout: (fn, delay) => { const key = ++id; timers.set(key, { fn, due: now + delay }); return key; }, clearTimeout: key => timers.delete(key) };
  const context = { exports: {}, document, window, location: { pathname: '/employee' },
    Date: { now: () => now }, crypto: { randomUUID: () => `test-event-${++id}` }, AbortSignal,
    fetch: async (_url, init) => { events.push(JSON.parse(init.body)); return { ok: true }; },
    require: name => name === 'react' ? { useEffect: fn => { effect = fn; } } : name === 'next/navigation' ? { usePathname: () => '/employee' } : name.includes('PreviewProvider') ? { useEmployeePreview: () => preview } : {} };
  const source = fs.readFileSync('components/EmployeeActivityTracker.tsx', 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, context);
  let cleanup;
  const mount = section => { cleanup?.(); context.exports.useEmployeeActivityVisit(section, disabled); cleanup = effect(); };
  const advance = ms => { now += ms; for (const [key, timer] of [...timers]) if (timer.due <= now) { timers.delete(key); timer.fn(); } };
  const visibility = value => { document.visibilityState = value ? 'visible' : 'hidden'; listeners.get('visibilitychange')?.(); };
  return { events, mount, advance, visibility, unmount: () => cleanup?.() };
}
test('tab visits are captured without saves, including returning to a previous tab', async () => {
  const p = page();
  for (const section of ['day', 'schedule', 'payroll', 'schedule']) { p.mount(section); p.advance(350); }
  await new Promise(setImmediate);
  assert.deepEqual(p.events.map(e => e.section), ['day', 'schedule', 'payroll', 'schedule']);
  await new Promise(setImmediate);
  assert.ok(p.events.every(e => e.kind === 'visit'));
});
test('return from background after a break records the unchanged tab; brief interruptions do not', async () => {
  const p = page(); p.mount('schedule'); p.advance(350);
  p.visibility(false); p.advance(1000); p.visibility(true); p.advance(350);
  await new Promise(setImmediate);
  assert.equal(p.events.length, 1);
  p.visibility(false); p.advance(60000); p.visibility(true); p.advance(350);
  await new Promise(setImmediate);
  assert.equal(p.events.length, 2);
  p.advance(300000); assert.equal(p.events.length, 2); // No polling/counting time spent.
});
test('hidden mounts, rapid tab transitions and unmounts do not invent visits', async () => {
  const p = page({ visible: false }); p.mount('day'); p.advance(1000);
  await new Promise(setImmediate);
  assert.equal(p.events.length, 0);
  p.visibility(true); p.advance(350); assert.equal(p.events.length, 1);
  p.mount('schedule'); p.advance(100); p.mount('payroll'); p.advance(350);
  await new Promise(setImmediate);
  assert.deepEqual(p.events.map(e => e.section), ['day', 'payroll']);
  p.unmount(); p.visibility(false); p.advance(60000); p.visibility(true); p.advance(350);
  await new Promise(setImmediate);
  assert.equal(p.events.length, 2);
});
test('administrator inspection and disabled trackers never create employee visits', async () => {
  for (const config of [{ preview: {} }, { disabled: true }]) {
    const p = page(config); p.mount('day'); p.advance(350);
    p.visibility(false); p.advance(60000); p.visibility(true); p.advance(350);
    await new Promise(setImmediate);
  assert.equal(p.events.length, 0);
  }
});
