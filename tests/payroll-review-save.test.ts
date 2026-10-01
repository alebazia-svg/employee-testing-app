import { test } from 'node:test';
import assert from 'node:assert/strict';
import { savePayrollReviewDecisions, type PayrollReviewDecision } from '../lib/payroll-review-save';
const decision: PayrollReviewDecision = { item: 'Телефон', category: 'Электроника', department: 'retail', saleContext: 'regular', target: 'RETAIL_GROSS_PROFIT_10' };
test('writes exact rules, never all contexts or departments', async () => {
  const writes: any[] = [];
  const mock = (async (_url: any, options: any) => {
    if (options?.method === 'POST') { writes.push(JSON.parse(options.body)); return Response.json({ id: 1 }); }
    return Response.json([]);
  }) as typeof fetch;
  assert.equal(await savePayrollReviewDecisions([decision], mock), 1);
  assert.equal(writes[0].matchType, 'EXACT_ITEM');
  assert.equal(writes[0].department, 'retail');
  assert.equal(writes[0].saleContext, 'regular');
  assert.equal(writes[0].targetCalculationType, decision.target);
});
test('conflicting existing exact rule blocks all writes', async () => {
  let writes = 0;
  const mock = (async (_u: any, o: any) => {
    if (o?.method === 'POST') writes++;
    return Response.json([{ isActive: true, matchType: 'EXACT_ITEM', itemText: ' телефон ', categoryText: 'Электроника', department: 'all', saleContext: 'all', targetCalculationType: 'RETAIL_ACCESSORY_5' }]);
  }) as typeof fetch;
  await assert.rejects(savePayrollReviewDecisions([decision], mock), /Ничего не сохранено/);
  assert.equal(writes, 0);
});
test('partial failure reports confirmed count, not success', async () => {
  let writes = 0;
  const mock = (async (_u: any, o: any) => {
    if (o?.method !== 'POST') return Response.json([]);
    return ++writes === 1 ? Response.json({ id: 1 }) : new Response('', { status: 500 });
  }) as typeof fetch;
  await assert.rejects(savePayrollReviewDecisions([decision, { ...decision, item: 'Другой' }], mock), /1 из 2/);
});
test('failed permission/source read prevents writes', async () => {
  const mock = (async () => new Response('', { status: 403 })) as typeof fetch;
  await assert.rejects(savePayrollReviewDecisions([decision], mock), /Ничего не сохранено/);
});
