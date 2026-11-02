import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { parseGoogleAttendanceTimestamp as parse } from '../lib/google-attendance-date';
import { mapGoogleAttendanceRows } from '../lib/google-sheets';
import { googleDay } from '../lib/team-control';
import { resolveTeamAttendance } from '../lib/team-attendance';
import { buildFormSummaries } from '../lib/payroll-attendance-summary';
import { mergePayrollAttendanceSources } from '../lib/payroll-attendance-source';

const employee = 'Хурзокова Лиана';
const raw = [
  ['Отметка времени', 'Действие', '', 'ФИО', 'Смена'],
  ['11.02.2026 9:47:33', 'Начало рабочего дня', '', employee, '10:00–19:102'],
  ['11.02.2026 19:12:18', 'Окончание рабочего дня', '', employee, ''],
];

test('real Liana February marks never become November attendance, while genuine Google fallback survives', () => {
  const rows = mapGoogleAttendanceRows(raw);
  assert.deepEqual(rows.map(r => r.timestamp), raw.slice(1).map(r => r[0]));
  assert.deepEqual(rows.map(r => r.date), ['11.02.2026', '11.02.2026']);
  const february = googleDay(employee, '2026-02-11', [], rows);
  assert.equal(february.arrival, 9 * 60 + 47);
  assert.equal(february.departure, 19 * 60 + 12);
  const november = googleDay(employee, '2026-11-02', [], rows);
  assert.equal(november.arrival, null);
  assert.equal(november.departure, null);
  const off = resolveTeamAttendance({date:'2026-11-02',today:'2026-11-02',google:november,googleAvailable:true,fallbackState:'Выходной'});
  assert.equal(off.start, '—'); assert.equal(off.end, '—'); assert.equal(off.state, 'Выходной');
  assert.equal(off.sourceLabel, 'Приложение');
  const actual = googleDay(employee,'2026-11-02',[],mapGoogleAttendanceRows([
    ['02.11.2026 09:47:00','Начало рабочего дня','',employee,'10:00–19:00'],
  ]));
  assert.equal(resolveTeamAttendance({date:'2026-11-02',today:'2026-11-02',google:actual,googleAvailable:true,fallbackState:'Выходной'}).sourceLabel,'Google · резерв');
});

test('every ambiguous day/month pair retains the original Russian calendar date', () => {
  for (let month=1; month<=12; month++) for (let day=1; day<=12; day++) {
    const d=String(day).padStart(2,'0'), m=String(month).padStart(2,'0');
    assert.deepEqual(parse(`${d}.${m}.2026 09:47:00`),{date:`${d}.${m}.2026`,dateKey:`2026-${m}-${d}`,time:'09:47'});
  }
  assert.equal(parse('29.02.2024 09:47')?.dateKey,'2024-02-29');
  assert.deepEqual(parse('1.2.2026 9:47:33'),{date:'01.02.2026',dateKey:'2026-02-01',time:'09:47'});
  assert.equal(parse('31.12.2026 23:59:59')?.dateKey,'2026-12-31');
});

test('invalid and ambiguous non-Russian formats cannot be guessed or rolled into another date', () => {
  for (const value of ['', '11/02/2026 09:47', '31.02.2026 09:47', '29.02.2026 09:47', '00.11.2026 09:47',
    '11.13.2026 09:47', '11.02.2026 24:00', '11.02.2026 09:60', '11.02.2026 09:47:60',
    '2026-02-31T09:47:00Z', '2026-02-11T09:47:00+03:99', '11.02.2026 09:47 trailing']) assert.equal(parse(value),null,value);
  assert.throws(()=>mapGoogleAttendanceRows([['31.02.2026 09:47:00','Начало рабочего дня','',employee]]),/Некорректная дата/);
  assert.throws(()=>mapGoogleAttendanceRows([['','Начало рабочего дня','',employee]]),/Некорректная дата/);
});

test('Russian civil dates are timezone independent and explicit ISO keeps the existing server-local convention', () => {
  assert.equal(parse('2026-11-02 09:47:00')?.time,'09:47');
  const code="const {parseGoogleAttendanceTimestamp:p}=require('./lib/google-attendance-date.ts');console.log(JSON.stringify([p('11.02.2026 09:47:00'),p('2026-11-01T22:30:00Z')]));";
  const results=['UTC','Europe/Moscow','America/Los_Angeles'].map(TZ => execFileSync(process.execPath,['--import','tsx','-e',code],{cwd:process.cwd(),env:{...process.env,TZ},encoding:'utf8'}));
  const parsed = results.map(r=>JSON.parse(r));
  assert.deepEqual(parsed[0][0],parsed[1][0]); assert.deepEqual(parsed[0][0],parsed[2][0]);
  assert.deepEqual(parsed[0][1],{date:'01.11.2026',dateKey:'2026-11-01',time:'22:30'});
  assert.deepEqual(parsed[1][1],{date:'02.11.2026',dateKey:'2026-11-02',time:'01:30'});
  assert.deepEqual(parsed[2][1],{date:'01.11.2026',dateKey:'2026-11-01',time:'14:30'});
});

test('salary day/late summaries keep using the original February timestamps, without a phantom November day', () => {
  const corrected = mapGoogleAttendanceRows(raw);
  const oldMapped = corrected.map(r=>({...r,date:'02.11.2026'}));
  for (const period of ['2026-02','2026-11']) assert.deepEqual(buildFormSummaries(corrected,period),buildFormSummaries(oldMapped,period));
  assert.equal(buildFormSummaries(corrected,'2026-02')[0].uniqueFormDates,1);
  assert.deepEqual(buildFormSummaries(corrected,'2026-11'),[]);
  const merged=mergePayrollAttendanceSources({googleRows:corrected,appUsers:[{id:8,name:employee,payrollName:employee,workDays:[]}],periodKey:'2026-11',throughDate:'2026-11-02',cutovers:[{userId:8,employee,aliases:[employee],fromDate:'2026-10-18'}]});
  assert.deepEqual(merged.sources[0].googleFallbackDates,[]);
  assert.equal(merged.formSummaries[0].uniqueFormDates,0);
});
