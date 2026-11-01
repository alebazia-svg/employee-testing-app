import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { createSessionToken } from '../lib/session';
import { PAYROLL_COMPENSATION_VERSION } from '../lib/payroll-compensation';

async function main() {
  const url = new URL(process.env.DATABASE_URL!);
  assert.equal(url.hostname, '127.0.0.1');
  assert.equal(url.pathname, '/payroll_final_correction_20261101');
  const db = new PrismaClient();
  let periodId: number | undefined;
  try {
    const admin = await db.user.findFirstOrThrow({ where: { role: 'ADMIN', isActive: true } });
    const cookie = `offonika_session=${createSessionToken(admin.id)}`;
    const request = async (path: string, method = 'GET', body?: unknown, correction?: number, auth = true) => {
      const response = await fetch(`http://127.0.0.1:3225/api/admin/payroll/${path}`, { method, headers: {
        'Content-Type': 'application/json', ...(auth ? { Cookie: cookie } : {}), ...(correction ? { 'X-Payroll-Correction-Run': String(correction) } : {}),
      }, ...(body ? { body: JSON.stringify(body) } : {}) });
      return { status: response.status, body: await response.json() };
    };
    const key = '2097-10';
    assert.equal(await db.payrollPeriod.count({ where: { periodKey: key } }), 0);
    const payload = (bonus = 0) => ({ compensationVersion: PAYROLL_COMPENSATION_VERSION, bonuses: [], period: { year: 2097, month: 9 },
      totals: { employeeCount: 1, reviewCount: 0, grossPay: 30000 + bonus, netPay: 29000 + bonus, advance: 1000, deductions: 0 },
      sourceSummary: { kind: 'automatic-1c-v1', periodKey: key, verifiedThrough: `${key}-31`, finboxRevision: 0, finboxAmount: null, approvalIssues: [] },
      manualInputs: [{ employeeName: 'QA correction', inputType: 'fixed', fixedBonus: String(bonus), advance: '1000', comment: 'Saved input' }],
      employeeResults: [{ employeeName: 'QA correction', salaryType: 'fixed_salary', fixedSalary: 30000, fixedBonus: bonus, fixedDeduction: 0, oneTimeBonus: 0, advance: 1000, grossPay: 30000 + bonus, netPay: 29000 + bonus, calculationDetails: [
        { component: 'Фиксированный оклад', amount: 30000 }, ...(bonus ? [{ component: 'Премия', amount: bonus }] : []), { component: 'Аванс', amount: -1000, comment: 'Расходник №QA от 01.10.2097: 1000' },
        { component: 'Начислено за месяц', amount: 30000 + bonus }, { component: 'К выплате', amount: 29000 + bonus },
      ] }],
    });
    const first = await request('runs', 'POST', payload()); assert.equal(first.status, 201, JSON.stringify(first.body));
    periodId = first.body.periodId;
    assert.equal((await request(`runs/${first.body.id}/status`, 'PATCH', { status: 'FINAL' })).status, 200);
    const before = await request(`runs/${first.body.id}`);
    assert.equal((await request(`draft?period=${key}`)).body.locked, true);
    const draft = await request(`draft?period=${key}&correctionRunId=${first.body.id}`);
    assert.equal(draft.status, 200); assert.equal(draft.body.locked, false);
    assert.equal(draft.body.payload.fixed['QA correction'].advance, '', '1C advances must be re-read, not copied as manual deductions');
    const write = { period: key, revision: draft.body.revision, requestId: randomUUID(), payload: draft.body.payload };
    assert.equal((await request('draft', 'PUT', write)).status, 409);
    assert.equal((await request('draft', 'PUT', write, first.body.id + 1000)).status, 409);
    assert.equal((await request('draft', 'PUT', write, first.body.id)).status, 200);
    assert.equal((await request(`draft?period=${key}&correctionRunId=${first.body.id + 1000}`)).status, 409);
    assert.equal((await request(`finbox?period=${key}`)).body.locked, true);
    assert.equal((await request('finbox', 'PUT', { period: key, amount: '123.45', revision: 0 })).status, 409);
    assert.equal((await request('finbox', 'PUT', { period: key, amount: '123.45', revision: 0 }, first.body.id)).status, 200);
    // Automatic save must reflect the separately versioned Finbox input.
    const nextPayload = payload(500); nextPayload.sourceSummary.finboxRevision = 1;
    (nextPayload.sourceSummary as Record<string, unknown>).finboxAmount = '123.45';
    const second = await request('runs', 'POST', nextPayload); assert.equal(second.status, 201, JSON.stringify(second.body));
    assert.equal((await request(`runs/${second.body.id}/status`, 'PATCH', { status: 'FINAL', replaceExistingFinal: true, expectedFinalId: first.body.id + 1000 })).status, 409);
    assert.equal((await request(`runs/${first.body.id}`)).body.status, 'FINAL');
    assert.equal((await request(`runs/${second.body.id}/status`, 'PATCH', { status: 'FINAL', replaceExistingFinal: true, expectedFinalId: first.body.id })).status, 200);
    assert.equal((await request(`runs/${second.body.id}/status`, 'PATCH', { status: 'FINAL', replaceExistingFinal: true, expectedFinalId: first.body.id })).status, 200, 'lost successful final response is retryable');
    const after = await request(`runs/${first.body.id}`);
    assert.equal(after.body.status, 'SUPERSEDED');
    assert.equal(after.body.supersededByRun.id, second.body.id);
    for (const field of ['grossPay', 'netPay', 'employeeResults', 'manualInputs']) assert.deepEqual(after.body[field], before.body[field], field);
    assert.equal(await db.payrollRun.count({ where: { periodId, status: 'FINAL' } }), 1);
    assert.equal((await request('draft', 'PUT', { ...write, revision: 1, requestId: randomUUID() }, first.body.id)).status, 409);
    assert.equal((await request(`runs/${second.body.id}/status`, 'PATCH', { status: 'FINAL' }, undefined, false)).status, 401);
    const contenders = [await request('runs', 'POST', nextPayload), await request('runs', 'POST', nextPayload)];
    // Compete at final replacement, after both draft versions exist.
    assert.ok(contenders.every(result => result.status === 201));
    const race = await Promise.all(contenders.map(result => request(`runs/${result.body.id}/status`, 'PATCH', {
      status: 'FINAL', replaceExistingFinal: true, expectedFinalId: second.body.id,
    })));
    assert.deepEqual(race.map(result => result.status).sort(), [200, 409]);
    const winner = await db.payrollRun.findFirstOrThrow({ where: { periodId, status: 'FINAL' } });
    assert.equal(await db.payrollRun.count({ where: { periodId, status: 'FINAL' } }), 1);
    await db.payrollPeriod.update({ where: { id: periodId }, data: { status: 'CLOSED' } });
    assert.equal((await request(`draft?period=${key}&correctionRunId=${winner.id}`)).body.locked, true);
    console.log('PASS: final save, exact-final draft/Finbox access, stale-final rejection, immutable prior employee details, atomic replacement, auth and closed-period protection.');
  } finally {
    if (periodId) await db.payrollPeriod.delete({ where: { id: periodId } });
    await db.payrollDraftRevision.deleteMany({ where: { periodKey: '2097-10' } });
    await db.payrollFinboxRevision.deleteMany({ where: { periodKey: '2097-10' } });
    await db.$disconnect();
  }
}
void main();
