import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyPayrollSalesRows, type PayrollSalesSourceRow, type PayrollSalesClassificationRule } from '../lib/payroll-sales-classification';
const row: PayrollSalesSourceRow = {manager:'Чеченова Милана', client:'Покупатель', category:'Кабели', item:'  ТЕСТОВЫЙ  Ё-КАБЕЛЬ  ', registrar:'', registrars:[], revenue:1000, cost:400, grossProfit:600, profitability:60};
const rule: PayrollSalesClassificationRule = {id:1,title:'QA',isActive:true,priority:1,matchType:'EXACT_ITEM',itemText:'тестовый ё-кабель',categoryText:null,article:null,department:'retail',saleContext:'all',targetCalculationType:'MANUAL_EXCLUDED',reason:'QA'};
test('exact-string memo preserves whitespace/case/ё semantics and never caches a mutable rule decision', () => {
 const excluded = classifyPayrollSalesRows([row],[rule]);
 assert.equal(excluded.rows[0].calculationType,'MANUAL_EXCLUDED');
 const included = classifyPayrollSalesRows([row],[{...rule,targetCalculationType:'RETAIL_ACCESSORY_5'}]);
 assert.equal(included.rows[0].calculationType,'RETAIL_ACCESSORY_5');
 assert.equal(included.managerSummaries[0].accessoryBonus,50);
 const changed = classifyPayrollSalesRows([{...row,revenue:2000}],[{...rule,targetCalculationType:'RETAIL_ACCESSORY_5'}]);
 assert.equal(changed.managerSummaries[0].accessoryBonus,100);
});
test('eviction and long uncached text cannot change classifications or totals', () => {
 const expected = classifyPayrollSalesRows([row],[rule]);
 // More unique short inputs than the bounded memo capacity.
 for(let i=0;i<4500;i++) classifyPayrollSalesRows([{...row,client:`Покупатель ${i}`,item:`Кабель QA ${i}`}]);
 assert.deepEqual(classifyPayrollSalesRows([row],[rule]),expected);
 const long = {...row,item:'КАБЕЛЬ '.repeat(100)};
 const first = classifyPayrollSalesRows([long]);
 assert.deepEqual(classifyPayrollSalesRows([long]),first);
});
