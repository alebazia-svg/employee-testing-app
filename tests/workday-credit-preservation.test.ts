import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';
import { oneCDateTimestamp, parseOneCDateTime } from '../lib/one-c-date';
import { formatTime } from '../lib/workday';
import { loadWorkdayCreditFiscal } from '../lib/workday-credit-source';

const file = 'app/(dashboard)/admin/workday/page.tsx';
function engine(source: string) {
  const start = source.indexOf('const devWorkdayToolsEnabled');
  const end = source.indexOf('export default async function AdminWorkdayPage');
  assert.ok(start > 0 && end > start);
  const js = ts.transpileModule(source.slice(start, end) + '\nreturn {buildEmployeeAutoChecks,matchesEmployeeManager,taskCutoff};', { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText;
  return new Function('oneCDateTimestamp', 'parseOneCDateTime', 'formatTime', js)(oneCDateTimestamp, parseOneCDateTime, formatTime);
}
// Pin the pre-reliability production baseline so committing/rebasing this
// candidate cannot turn the preservation check into a comparison with itself.
const before = engine(execFileSync('git', ['show', `8b4c751c41b554d88abf5cdd45ebc043c251f538:${file}`], { encoding: 'utf8' }));
const after = engine(fs.readFileSync(file, 'utf8'));
for (const scenario of ['matched', 'no-receipt', 'wrong-amount', 'ambiguous', 'unavailable', 'waiting', 'none', 'unknown-date']) {
  test(`selective reads preserve the actual credit check output: ${scenario}`, async () => {
    const task = { id: 1, title: 'Credit', category: 'credit', status: scenario === 'waiting' ? 'pending' : 'done', completedAt: new Date('2026-11-08T12:00:00+03:00'), integerValue: 1, numericValue: null, handoverData: {} };
    const documents = scenario === 'none' ? [] : [
      { ref: 'a', managerName: 'Мария Соколова', number: 'A', date: scenario === 'unknown-date' ? 'bad date' : '2026-11-08T10:00:00+03:00', amount: 100 },
      { ref: 'later', managerName: 'Мария Соколова', number: 'B', date: '2026-11-08T14:00:00+03:00', amount: 100 },
      { ref: 'other', managerName: 'Анна Смирнова', number: 'C', date: '2026-11-08T10:00:00+03:00', amount: 100 },
    ];
    const operation = { fiscalized: true, amount: scenario === 'wrong-amount' ? 90 : 100, postpayment: 100 };
    const read = async (ref: string) => ({ ok: scenario !== 'unavailable', realizationRef: ref, fiscalized: scenario !== 'no-receipt', operations: scenario === 'ambiguous' ? [operation, operation] : [operation] }) as any;
    const full: any = { ok: true, documents, fiscalByRealization: Object.fromEntries(await Promise.all(documents.map(async d => [d.ref, await read(d.ref)]))) };
    const selected = await loadWorkdayCreditFiscal({ ...full, fiscalByRealization: {} }, (d: any) => {
      const timestamp = oneCDateTimestamp(d.date);
      return task.status === 'done' && timestamp !== null && after.matchesEmployeeManager('Мария Соколова', d.managerName) && timestamp <= after.taskCutoff(task).getTime();
    }, read);
    const params = { inventoryResolutions: new Map(), confirmedKkmTaskIds: new Set(), employeeName: 'Мария Соколова', department: 'retail', tasks: [task], cashboxName: null, cashRegisterRef: null, kkmAssignments: [], kkmMode: 'personal', cashStatement: null, reserveCashboxName: null, reserveStatement: null, depositSafeCashboxName: null, depositSafeStatement: null, cashOperations: [], kkmDiagnostics: { ok: false }, cashShifts: { ok: false } };
    assert.deepEqual(after.buildEmployeeAutoChecks({ ...params, tbankSales: selected }), before.buildEmployeeAutoChecks({ ...params, tbankSales: full }));
    assert.ok(Object.keys(selected.fiscalByRealization).length <= 1);
  });
}
