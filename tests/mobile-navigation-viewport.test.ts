import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bindMobileNavigationViewport } from '../lib/mobile-navigation-viewport';

class Target {
  events = new Map<string, Set<() => void>>();
  addEventListener(name: string, callback: () => void) { if (!this.events.has(name)) this.events.set(name, new Set()); this.events.get(name)!.add(callback); }
  removeEventListener(name: string, callback: () => void) { this.events.get(name)?.delete(callback); }
  fire(name: string) { for (const callback of [...this.events.get(name) ?? []]) callback(); }
}
class Element {
  isContentEditable = false; isConnected = true;
  attrs = new Map<string, string>();
  style = { position: '', overflow: '', values: new Map<string, [string, string]>(),
    getPropertyValue(name: string) { return this.values.get(name)?.[0] ?? ''; },
    getPropertyPriority(name: string) { return this.values.get(name)?.[1] ?? ''; },
    setProperty(name: string, value: string, priority = '') { this.values.set(name, [value, priority]); },
    removeProperty(name: string) { this.values.delete(name); },
  };
  setAttribute(name: string, value: string) { this.attrs.set(name, value); }
  removeAttribute(name: string) { this.attrs.delete(name); }
}
class Input extends Element { type = 'text'; readOnly = false; disabled = false; }
class Textarea extends Element { readOnly = false; disabled = false; }
function fixture() {
  let now = 1000, id = 0, reads = 0, modal = false;
  let mutation!: () => void, disconnected = false;
  const tasks = new Map<number, { at: number; callback: () => void }>();
  const scrolls: ScrollToOptions[] = [];
  const media = { matches: true };
  const doc = Object.assign(new Target(), { body: new Element(), activeElement: new Element(), visibilityState: 'visible', querySelector: () => modal ? {} : null });
  const viewport = Object.assign(new Target(), { height: 844, scale: 1 });
  const nav = Object.assign(new Element(), { contains: (value: unknown) => false });
  Object.defineProperty(nav, 'offsetHeight', { get: () => { reads++; return 72; } });
  nav.style.setProperty('display', 'grid', 'important');
  const host = Object.assign(new Target(), {
    document: doc, visualViewport: viewport as typeof viewport | null,
    innerWidth: 390, innerHeight: 844, scrollX: 4, scrollY: 240,
    HTMLElement: Element, HTMLInputElement: Input, HTMLTextAreaElement: Textarea,
    Date: { now: () => now }, matchMedia: () => media,
    scrollTo: (options: ScrollToOptions) => scrolls.push(options),
    setTimeout(callback: () => void, delay: number) { const key = ++id; tasks.set(key, { at: now + delay, callback }); return key; },
    clearTimeout(key: number) { tasks.delete(key); },
    MutationObserver: class { constructor(callback: () => void) { mutation = callback; } observe() {} disconnect() { disconnected = true; } },
  });
  const stop = bindMobileNavigationViewport(nav as unknown as HTMLElement, host as unknown as Window & typeof globalThis);
  const advance = (ms: number) => {
    const until = now + ms;
    while (true) {
      const next = [...tasks].filter(([, task]) => task.at <= until).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      tasks.delete(next[0]); now = next[1].at; next[1].callback();
    }
    now = until;
  };
  return { host, doc, nav, viewport, media, scrolls, tasks, stop, advance,
    mutation: () => mutation(), modal: (value: boolean) => { modal = value; mutation(); },
    get reads() { return reads; }, get disconnected() { return disconnected; },
    focus(element: Element) { doc.activeElement = element; doc.fire('focusin'); },
    blur() { doc.activeElement = new Element(); doc.fire('focusout'); },
  };
}

test('keyboard hides the dock, dismissal rebuilds it without changing the current scroll position', () => {
  const f = fixture(); f.focus(new Input()); f.viewport.height = 500; f.viewport.fire('resize'); f.advance(400);
  assert.equal(f.nav.attrs.get('data-portal-keyboard'), 'open'); assert.equal(f.reads, 0);
  f.blur(); f.viewport.height = 844; f.viewport.fire('resize'); f.advance(800);
  assert.equal(f.nav.attrs.has('data-portal-keyboard'), false); assert.ok(f.reads > 0);
  assert.ok(f.scrolls.every(s => s.top === 240 && s.left === 4 && s.behavior === 'instant'));
  assert.equal(f.nav.style.getPropertyValue('display'), 'grid'); assert.equal(f.nav.style.getPropertyPriority('display'), 'important'); f.stop();
});
test('switching text fields does not show or reposition navigation while typing', () => {
  const f = fixture(); f.focus(new Input()); f.viewport.height = 490; f.viewport.fire('resize');
  f.focus(new Textarea()); f.advance(1000);
  assert.equal(f.nav.attrs.get('data-portal-keyboard'), 'open'); assert.equal(f.reads, 0); f.stop();
});
test('a newly remounted dock recovers after a conditional editor disappears', () => {
  const f = fixture(); f.advance(800); assert.ok(f.reads > 0); f.stop();
});
test('removing a focused dialog recovers even when WebKit retains a stale smaller visual viewport', () => {
  const f = fixture(); f.modal(true); f.focus(new Input()); f.viewport.height = 500; f.viewport.fire('resize');
  f.doc.activeElement = new Element(); f.modal(false); f.advance(800);
  assert.equal(f.nav.attrs.has('data-portal-keyboard'), false); assert.ok(f.reads > 0); f.stop();
});
test('open dialogs and a fixed/locked body are never scrolled by recovery', () => {
  const f = fixture(); f.modal(true); f.doc.body.style.position = 'fixed'; f.mutation(); f.host.fire('resize'); f.advance(800);
  assert.equal(f.reads, 0); assert.equal(f.scrolls.length, 0);
  f.doc.body.style.position = ''; f.doc.body.style.overflow = ''; f.modal(false); f.advance(800);
  assert.ok(f.reads > 0); f.stop();
});
test('desktop, zoom and read-only/file fields do not activate keyboard handling', () => {
  const f = fixture(); const file = new Input(); file.type = 'file'; f.focus(file); f.viewport.height = 490; f.viewport.fire('resize');
  assert.equal(f.nav.attrs.has('data-portal-keyboard'), false);
  const readOnly = new Input(); readOnly.readOnly = true; f.focus(readOnly);
  assert.equal(f.nav.attrs.has('data-portal-keyboard'), false);
  f.viewport.scale = 2; f.focus(new Input()); f.advance(800); assert.equal(f.reads, 0);
  f.viewport.scale = 1; f.media.matches = false; f.blur(); f.host.fire('resize'); f.advance(800); assert.equal(f.reads, 0); f.stop();
});
test('orientation and browser viewport resize do not reuse a portrait keyboard height', () => {
  const f = fixture(); f.host.innerWidth = 844; f.host.innerHeight = 390; f.viewport.height = 390; f.host.fire('orientationchange');
  assert.equal(f.nav.attrs.has('data-portal-keyboard'), false);
  f.focus(new Input()); f.viewport.height = 200; f.viewport.fire('resize'); assert.equal(f.nav.attrs.get('data-portal-keyboard'), 'open');
  f.blur(); f.host.innerWidth = 390; f.host.innerHeight = 844; f.viewport.height = 844; f.host.fire('resize'); f.advance(800);
  assert.equal(f.nav.attrs.has('data-portal-keyboard'), false); assert.ok(f.reads > 0); f.stop();
});
test('fallback without VisualViewport is safe and unmount removes timers and listeners', () => {
  const f = fixture(); f.host.fire('resize'); assert.ok(f.tasks.size > 0); f.stop(); f.advance(1000);
  assert.equal(f.tasks.size, 0); assert.equal(f.reads, 0); assert.equal(f.disconnected, true);
  assert.ok([...f.host.events.values(), ...f.doc.events.values(), ...f.viewport.events.values()].every(listeners => listeners.size === 0));
  const g = fixture(); g.stop(); g.host.visualViewport = null;
  const stop = bindMobileNavigationViewport(g.nav as unknown as HTMLElement, g.host as unknown as Window & typeof globalThis);
  g.host.fire('resize'); g.advance(800); assert.ok(g.reads > 0); stop();
});

test('both real navigation components use the guard and dialog return focus cannot scroll the page', () => {
  for (const name of ['components/AdminShell.tsx', 'components/EmployeeNavigation.tsx']) {
    const source = readFileSync(name, 'utf8');
    assert.match(source, /const navRef = useMobileNavigationViewport\(\)/);
    assert.match(source, /<nav ref=\{navRef\}/);
  }
  for (const name of ['components/NotificationRecordDialog.tsx', 'components/FiscalNotificationDialog.tsx', 'components/workday/EmployeeNotificationInbox.tsx', 'app/(dashboard)/employee/CashIssueClient.tsx', 'app/(dashboard)/admin/employees/EmployeeAccessDialog.tsx', 'app/(dashboard)/admin/employees/EmployeeActivityDialog.tsx']) {
    assert.match(readFileSync(name, 'utf8'), /(?:opener|previous|previousFocus|focused)(?:\.current)?\??\.focus\(\{\s*preventScroll:\s*true\s*\}\)/, name);
  }
  const css = readFileSync('app/globals.css', 'utf8');
  assert.match(css, /\.admin-mobile-nav\[data-portal-keyboard='open'\],[\s\S]*?\.employee-material-nav\[data-portal-keyboard='open'\] \{[\s\S]*?visibility: hidden !important;/);
});
