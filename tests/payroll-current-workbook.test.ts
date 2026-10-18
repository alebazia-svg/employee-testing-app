import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import XLSX from 'xlsx-js-style';
import * as helpers from '../lib/payroll-workbook';
import { completeSettlementTotal } from '../lib/payroll-current-export';

test('calculation export checks advances without importing unrelated debt warnings', () => {
  const source = fs.readFileSync('app/(dashboard)/admin/payroll/PayrollClient.tsx', 'utf8');
  assert.ok(source.includes("currentSettlement?.rows.filter(row => row.advance === null)"));
  assert.ok(source.includes('Уточнить авансы за месяц'));
  assert.ok(!source.includes('Актуальные выплаты — на листе «Итоги».'));
  assert.ok(!source.includes('currentSettlement?.rows.filter(row => row.remaining === null || row.paid === null)'));
});

test('calculation workbook shows advances, not ordinary payments or outstanding debt', async()=>{
  const source=fs.readFileSync('app/(dashboard)/admin/payroll/PayrollClient.tsx','utf8');
  const body=source.slice(source.indexOf('async function downloadPayrollWorkbook('),source.indexOf('\nfunction getSavedRunReviewReasons('))
    .replace("const XLSX = (await import('xlsx-js-style')).default;",'');
  let book: XLSX.WorkBook | undefined;
  const bindings={...helpers,completeSettlementTotal,formatMoney:(v:number)=>v.toFixed(2)+' ₽',XLSX:{...XLSX,writeFile:(value:XLSX.WorkBook)=>{book=value;}}};
  const compiled=ts.transpileModule(body,{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText;
  const generate=new Function(...Object.keys(bindings),compiled+';return downloadPayrollWorkbook;')(...Object.values(bindings));
  await generate({periodLabel:'Сентябрь 2026',versionLabel:'Утверждено',generatedAt:'18.10.2026',fileName:'test.xlsx',
    employeeRows:[{employeeName:'Милана',category:'Розничные продажи',salaryType:'retail_sales_bonus',grossPay:89116.4,workedDays:21,basePay:12600,specialPay:0,performancePay:73516.4,disciplinePay:3000,additionalPay:0,advance:0,deduction:0,netPay:89116.4,status:'Готово',comment:''}],
    accrualRows:[['Милана','Розничные продажи','','Оплата по дням',21,'21 × 600',12600,''],['Милана','Розничные продажи','','Проценты',null,'',73516.4,''],['Милана','Розничные продажи','','Дисциплина',null,'',3000,''],['Милана','Розничные продажи','','Начислено за месяц',null,'',89116.4,''],['Милана','Розничные продажи','','К выплате',null,'',89116.4,'']],
    checkRows:[],sourceRows:[],currentSettlement:{checkedAt:'18.10.2026',rows:[{employeeName:'Милана',paid:89000,advance:0,remaining:0,totalDebt:0,accruedInOneC:89000}]}});
  assert.ok(book);
  assert.equal(book.Sheets['Итоги'].D6.v,89116.4);
  assert.equal(book.Sheets['Итоги'].E6,undefined);
  assert.equal(book.Sheets['Итоги'].B6.v,89116.4);
  assert.equal(book.Sheets['Итоги'].C6.v,0);
  assert.equal(book.Sheets['Расшифровка'].D6.v,89116.4);
  assert.equal(book.Sheets['Общие остатки'],undefined);
  assert.equal(book.Sheets['Итоги'].D7.v,89116.4);
  assert.equal(book.Sheets['Итоги'].D4.v,'После авансов');
  assert.equal(book.Sheets['Итоги']['!rows']![5].hpt,24);
  assert.equal(book.SheetNames.includes('Выплаты'),false);
  if (process.env.PAYROLL_WORKBOOK_QA_PATH) XLSX.writeFile(book,process.env.PAYROLL_WORKBOOK_QA_PATH);
});
