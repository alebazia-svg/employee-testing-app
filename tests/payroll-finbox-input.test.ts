import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateFinboxWrite, validateFinboxPeriod} from '../lib/payroll-finbox-input';
import {parseFinboxReport} from '../lib/payroll-finbox';
test('Finbox writes bind cents to explicit period and expected revision',()=>{
  assert.deepEqual(validateFinboxWrite({period:'2026-09',amount:'123,45',revision:2}),{period:'2026-09',amountCents:12345,revision:2});
  assert.equal(validateFinboxWrite({period:'2026-10',amount:'0',revision:0}).amountCents,0);
});
test('invalid periods, negative/empty/overprecision amounts and revisions are rejected',()=>{
  for(const period of ['2026-00','2026-13','09.2026','2026-9',null]) assert.throws(()=>validateFinboxPeriod(period));
  for(const amount of ['', '-1','1.001','Infinity','1e4','10000000.01']) assert.throws(()=>validateFinboxWrite({period:'2026-09',amount,revision:0}));
  for(const revision of [-1,null,undefined,'1',0.5]) assert.throws(()=>validateFinboxWrite({period:'2026-09',amount:'10',revision}));
});
test('a report from another month cannot be applied to selected Finbox month',()=>{
  const report='Начальный остаток на 2026-09-01\t0\n01.09.2026\tНачисление агентского вознаграждения\t100\nКонечный остаток на 2026-09-30\t100';
  assert.equal(parseFinboxReport(report,'2026-09').errors.length,0);
  assert.ok(parseFinboxReport(report,'2026-10').errors.length>0);
});
