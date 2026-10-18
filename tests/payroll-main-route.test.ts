import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('ordinary payroll route enables workspace and keeps admin authorization', () => {
  const source = readFileSync('app/(dashboard)/admin/payroll/page.tsx', 'utf8');
  assert.match(source, /admin\.role !== 'ADMIN'/);
  assert.match(source, /<AdminPayrollPage liveWorkspace testEnvironment=/);
  assert.match(source, /payroll-settlement-preview\.css/);
});

test('settlement API is admin-only, read-only and available without preview flag', () => {
  const source = readFileSync('app/api/admin/payroll/settlement/route.ts', 'utf8');
  assert.match(source, /await requireAdminApi\(\)/);
  assert.match(source, /if \(!auth.ok\) return auth.response/);
  assert.doesNotMatch(source, /PAYROLL_SETTLEMENT_PREVIEW/);
  assert.doesNotMatch(source, /export async function (POST|PUT|PATCH|DELETE)/);
  assert.match(source, /status: 503/);
});
