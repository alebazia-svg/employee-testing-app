// Explicit opt-in test against an isolated LOCAL preview only. Never production.
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { createSessionToken } from '../lib/session';
import { PAYROLL_COMPENSATION_VERSION } from '../lib/payroll-compensation';

async function main() {
  const url = new URL(process.env.DATABASE_URL!);
  assert.ok(['localhost', '127.0.0.1'].includes(url.hostname));
  assert.equal(url.pathname, '/payroll_auto_preview_20260915');
  assert.equal(process.env.PORTAL_SESSION_SECRET, 'payroll-advances-isolated-preview-20260917-only');
  const db = new PrismaClient();
  try {
    const admin = await db.user.findFirstOrThrow({ where: { role: 'ADMIN', isActive: true } });
    const cookie = `offonika_session=${createSessionToken(admin.id)}`;
    const request = async (path: string, method = 'GET', body?: unknown, authenticated = true) => {
      const result = await fetch(`http://127.0.0.1:3025/api/admin/payroll/${path}`, { method, headers: { 'Content-Type': 'application/json', ...(authenticated ? { Cookie: cookie } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
      return { status: result.status, body: await result.json() };
    };
    const year = 2090;
    const period = await db.payrollPeriod.findUnique({ where: { periodKey: `${year}-09` } });
    assert.equal(period, null, 'Use a fresh isolated fixture period; do not mutate earlier tests');
    const payload = {
      compensationVersion: PAYROLL_COMPENSATION_VERSION, bonuses: [], period: { year, month: 8 },
      totals: { employeeCount: 1, reviewCount: 0, grossPay: 30000, netPay: 29000, advance: 1000, deductions: 0 },
      sourceSummary: { kind: 'automatic-1c-v1', periodKey: `${year}-09`, verifiedThrough: `${year}-09-30`, finboxRevision: 0, finboxAmount: null, approvalIssues: [] as string[] },
      manualInputs: [{ employeeName: 'QA автоматическая ведомость', inputType: 'fixed', advance: '1000' }],
      employeeResults: [{ employeeName: 'QA автоматическая ведомость', salaryType: 'fixed_salary', fixedSalary: 30000, fixedBonus: 0, fixedDeduction: 0, oneTimeBonus: 0, advance: 1000, grossPay: 30000, netPay: 29000,
        calculationDetails: [
          { component: 'Фиксированный оклад', amount: 30000 },
          { component: 'Аванс', amount: -1000, comment: 'Тестовый расходник' },
          { component: 'Начислено за месяц', amount: 30000 },
          { component: 'К выплате', amount: 29000 },
        ],
      }],
    };
    assert.equal((await request('runs', 'POST', payload, false)).status, 401);
    payload.sourceSummary.approvalIssues = ['Тест: Finbox требует проверки'];
    const draft = await request('runs', 'POST', payload);
    assert.equal(draft.status, 201, JSON.stringify(draft.body));
    const read = await request(`runs/${draft.body.id}`);
    assert.equal(read.body.employeeResults[0].netPay, 29000);
    assert.equal(read.body.employeeResults[0].calculationDetails.length, 4);
    assert.equal((await request(`runs/${draft.body.id}/status`, 'PATCH', { status: 'FINAL' })).status, 409);
    payload.sourceSummary.approvalIssues = [];
    const checked = await request('runs', 'POST', payload);
    assert.equal(checked.status, 201, JSON.stringify(checked.body));
    assert.equal((await request(`runs/${checked.body.id}/status`, 'PATCH', { status: 'FINAL' })).status, 200);
    const replacement = await request('runs', 'POST', payload);
    assert.equal(replacement.status, 201);
    assert.equal((await request(`runs/${replacement.body.id}/status`, 'PATCH', { status: 'FINAL' })).status, 409);
    assert.equal((await request(`runs/${replacement.body.id}/status`, 'PATCH', { status: 'FINAL', replaceExistingFinal: true })).status, 200);
    assert.equal((await request(`runs/${checked.body.id}`)).body.status, 'SUPERSEDED');
    assert.equal((await request(`runs/${checked.body.id}`)).body.netPay, 29000);
    console.log('PASS: auth, draft save/read, detailed amounts, review gate, final approval, atomic replacement, immutable prior sums. Test period 2090-09 only.');
  } finally { await db.$disconnect(); }
}
void main();
