import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';

function fixture() {
  const code = ts.transpileModule(readFileSync('components/AdminSectionLink.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const calls: string[] = [], exports: Record<string, any> = {};
  const realRequire = createRequire(import.meta.url);
  const requireModule = (name: string) => name === 'next/link' ? { __esModule: true, default: () => null } : name === './AdminNavigationFeedback' ? { useAdminNavigationFeedback: () => (href: string) => calls.push(href) } : realRequire(name);
  new Function('require', 'exports', code)(requireModule, exports);
  return { Link: exports.default, calls };
}
test('progress respects an existing navigation cancellation', () => {
  const f = fixture(); let cancelled = false;
  const element = f.Link({ href: '/admin/taxes', onNavigate: (event: { preventDefault(): void }) => event.preventDefault(), children: 'Taxes' });
  element.props.onNavigate({ preventDefault() { cancelled = true; } });
  assert.equal(cancelled, true); assert.deepEqual(f.calls, []);
});
test('progress preserves the native destination, click handler, children and prefetch policy', () => {
  const f = fixture(), click = () => {};
  const element = f.Link({ href: '/admin/taxes', prefetch: false, className: 'existing', onClick: click, children: 'Taxes' });
  assert.equal(element.props.href, '/admin/taxes'); assert.equal(element.props.prefetch, false);
  assert.equal(element.props.onClick, click); assert.equal(element.props.children, 'Taxes');
  element.props.onNavigate({ preventDefault() { assert.fail(); } });
  assert.deepEqual(f.calls, ['/admin/taxes']);
});
