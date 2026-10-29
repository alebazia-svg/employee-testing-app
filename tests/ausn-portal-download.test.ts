import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { parsePortalReport, portalFreshness } from '../lib/ausn-portal-view';
import { portalFixture } from './ausn-portal-fixture';

// Execute the real route handler with bounded auth/storage doubles. The route's
// authorization order, response bytes and headers are exercised together.
function route(access: { ok: boolean; response?: Response }, reports = [parsePortalReport(portalFixture(), 'ausn-executive-full-20261026T080000.md')]) {
  let storageReads = 0;
  const compiled = ts.transpileModule(readFileSync(new URL('../app/api/admin/taxes/report/route.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports: { GET?: (request: Request) => Promise<Response> } = {};
  vm.runInNewContext(compiled, { exports, Request, Response, URL, require: (name: string) => {
    if (name === '@/lib/admin-api-auth') return { requireAdminApi: async () => access };
    if (name === '@/lib/ausn-portal-view') return { loadPortalReports: async () => { storageReads++; return reports; }, portalFreshness: (report: typeof reports[number]) => portalFreshness(report, new Date('2026-10-26T10:00:00Z')) };
    throw new Error(`Unexpected dependency: ${name}`);
  } });
  return { GET: exports.GET!, storageReads: () => storageReads };
}
const file = 'ausn-executive-full-20261026T080000.md';
const request = (name = file) => new Request(`https://portal.example/api/admin/taxes/report?file=${encodeURIComponent(name)}`);

test('unauthenticated and non-admin download requests cannot read report files', async () => {
  for (const status of [401, 403]) {
    const handler = route({ ok: false, response: Response.json({ error: 'denied' }, { status }) });
    assert.equal((await handler.GET(request())).status, status);
    assert.equal(handler.storageReads(), 0);
  }
});

test('download retains every UTF-8 byte, source block and newline of canonical report', async () => {
  const handler = route({ ok: true });
  const response = await handler.GET(request());
  assert.equal(response.status, 200);
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), Buffer.from(portalFixture(), 'utf8'));
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
  assert.equal(response.headers.get('Content-Type'), 'text/plain; charset=utf-8');
  assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
  assert.match(response.headers.get('Content-Disposition')!, /attachment/);
});

test('path traversal, missing files and incomplete reports never become downloads', async () => {
  const handler = route({ ok: true });
  assert.equal((await handler.GET(request('../../etc/passwd'))).status, 400);
  assert.equal(handler.storageReads(), 0);
  assert.equal((await handler.GET(request('ausn-executive-full-20261025T080000.md'))).status, 404);
  const blocked = route({ ok: true }, [parsePortalReport(portalFixture({ ofd: 'нет' }), file)]);
  assert.equal((await blocked.GET(request())).status, 404);
});
