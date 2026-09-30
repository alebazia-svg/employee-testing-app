import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import XLSX from 'xlsx-js-style';
import * as helpers from '../lib/payroll-workbook';

test('actual workbook generator preserves totals, advance provenance and manual fallback', async () => {
  const text = readFileSync('app/(dashboard)/admin/payroll/PayrollClient.tsx','utf8');
  const source = text.slice(text.indexOf('async function downloadPayrollWorkbook('),text.indexOf('\nfunction getSavedRunReviewReasons('))
    .replace("const XLSX = (await import('xlsx-js-style')).default;", 'const XLSX = testXLSX;');
  let workbook: XLSX.WorkBook | null = null;
  const context = vm.createContext({ ...helpers,
    formatMoney: (n: number) => `${n.toLocaleString('ru-RU',{minimumFractionDigits:2})} ₽`,
    testXLSX: { ...XLSX, writeFile: (value: XLSX.WorkBook) => { workbook = value; } },
  });
  vm.runInContext(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);
  const employeeName='СтажерРозница · поклейка (09.2026)';
  const model = {periodLabel:'Сентябрь 2026',versionLabel:'Предварительный расчёт по данным 1С',generatedAt:'17.09.2026',fileName:'test.xlsx',
    oneCAdvanceEmployees:[employeeName],
    employeeRows:[{employeeName,category:'Розничные продажи',salaryType:'retail_sales_bonus',grossPay:35490,workedDays:null,basePay:0,performancePay:35490,specialPay:0,disciplinePay:0,additionalPay:0,advance:15000,deduction:0,netPay:20490,status:'Готово',comment:''}],
    accrualRows:[
      [employeeName,'Розничные продажи','','Услуги оказываемые 70%',50700,'выручка × 70%',35490,''],
      [employeeName,'Розничные продажи','','Начислено за месяц',null,'сумма начислений',35490,''],
      [employeeName,'Розничные продажи','','Аванс',15000,'вычитается после начисления зарплаты',-15000,'Расходник №00OF-001697 от 17.09.2026'],
      [employeeName,'Розничные продажи','','К выплате',35490,'начислено − аванс',20490,''],
    ],checkRows:[],sourceRows:[['Авансы','Расходники 1С','Сентябрь 2026']]};
  await context.downloadPayrollWorkbook(model);
  assert.ok(workbook);
  const book = workbook as XLSX.WorkBook;
  const rows = (sheet: string) => XLSX.utils.sheet_to_json<(string|number)[]>(book.Sheets[sheet],{header:1,defval:''});
  const employee=rows('Итоги').find(r=>r[0]===employeeName)!;
  assert.equal(employee[1],35490); assert.equal(employee[7],15000); assert.equal(employee[8],20490);
  const advance=rows('Расшифровка').find(r=>r[5]==='Аванс')!;
  assert.equal(advance[7],'Расходники 1С'); assert.match(String(advance[8]),/00OF-001697/);
  assert.ok(!rows('Контроль расчёта').some(r=>r.includes('Ошибка')));
  await context.downloadPayrollWorkbook({...model,oneCAdvanceEmployees:[]});
  const manual=XLSX.utils.sheet_to_json<(string|number)[]>((workbook as unknown as XLSX.WorkBook).Sheets['Расшифровка'],{header:1});
  assert.equal(manual.find(r=>r[5]==='Аванс')![7],'Ручной ввод в портале');
});
