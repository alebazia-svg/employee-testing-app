import assert from 'node:assert/strict';
import test from 'node:test';
import { parsePayrollForecastEvidence } from '../lib/procurement-payroll-forecast';
import { FUNDING_PAYROLL_POLICY } from '../lib/procurement-funding-owner-policy';

const asOf = '2026-09-12';
const rows = [
  ['00000000-0000-0000-0000-000000000000', 26900],
  ['f393105e-c21e-11f0-a343-002590803daf', -100],
  ['28f0fcba-4636-11f0-a789-002590803daf', -20],
  ['8ba11a1f-21b3-11e7-b061-0025901e48ee', -150],
  ['f8065f93-1a33-11f0-b3d7-002590803daf', -16000],
  ['55161477-dada-11ea-971d-0025901e48ee', -448115],
].map(([employee_ref, closing_balance_signed]) => ({ employee_ref, closing_balance_signed }));

function payload() {
  return {
    ok: true, endpoint: 'payroll-balance', as_of: asOf, complete: true,
    totals_scope: 'returned_rows', balance_sign_interpretation: 'not_validated_against_report',
    totals: { rows: rows.length, closing_balance_signed: -437485 },
    rows: rows.map((row) => ({ ...row })),
  };
}

test('separates old agreed balances and unassigned trainees from a provisional active salary amount', () => {
  const result = parsePayrollForecastEvidence(payload(), asOf);
  assert.equal(result.sourceComplete, true);
  assert.equal(result.grossNegativeMinor, 46_438_500);
  assert.equal(result.knownOldMinor, 1_627_000);
  assert.equal(result.payableMinor, 44_811_500);
  assert.equal(result.unassignedPositiveMinor, 2_690_000);
});

test('a changed old balance is flagged rather than silently removed from the forecast', () => {
  const changed = payload();
  changed.rows[4].closing_balance_signed = -16001;
  changed.totals.closing_balance_signed = -437486;
  const result = parsePayrollForecastEvidence(changed, asOf);
  assert.equal(result.payableMinor, null);
  assert.ok(result.warnings.includes('known_old_balance_changed'));
});

test('incomplete or inconsistent payroll cannot become a dated cash outflow', () => {
  const incomplete = payload();
  incomplete.complete = false;
  assert.equal(parsePayrollForecastEvidence(incomplete, asOf).payableMinor, null);
  const duplicate = payload();
  duplicate.rows[5].employee_ref = duplicate.rows[4].employee_ref;
  assert.equal(parsePayrollForecastEvidence(duplicate, asOf).payableMinor, null);
});

test('a new employee balance is shown for review and never silently added to the dated payout', () => {
  const newPerson = payload();
  newPerson.rows.push({ employee_ref: 'unreviewed-new-person', closing_balance_signed: -5000 });
  newPerson.totals.rows += 1;
  newPerson.totals.closing_balance_signed -= 5000;
  const result = parsePayrollForecastEvidence(newPerson, asOf);
  assert.equal(result.payableMinor, null);
  assert.equal(result.unreviewedMinor, 500_000);
  assert.ok(result.warnings.includes('new_salary_person_needs_review'));
});

function currentPayload() {
  const p=payload();p.as_of='2026-10-11';
  p.rows[1].closing_balance_signed=-19600;
  p.rows.push({employee_ref:FUNDING_PAYROLL_POLICY.includeRefs[0],closing_balance_signed:-10000});
  p.totals={rows:p.rows.length,closing_balance_signed:p.rows.reduce((s,r)=>s+Number(r.closing_balance_signed),0)};
  return p;
}
test('owner-approved current identities use actual balances and cancel only trainee exclusion',()=>{
  const p=currentPayload(), before=structuredClone(p);
  const r=parsePayrollForecastEvidence(p,p.as_of,FUNDING_PAYROLL_POLICY);
  assert.equal(r.sourceComplete,true);assert.equal(r.knownOldMinor,1617000);
  assert.equal(r.payableMinor,(448115+19600+10000)*100);assert.deepEqual(p,before);
});
test('reviewed salaries are dynamic, not frozen at the reviewed amounts',()=>{
  const p=currentPayload();p.rows[1].closing_balance_signed=-25000;p.rows.at(-1)!.closing_balance_signed=-12000;
  p.totals.closing_balance_signed=p.rows.reduce((s,r)=>s+Number(r.closing_balance_signed),0);
  assert.equal(parsePayrollForecastEvidence(p,p.as_of,FUNDING_PAYROLL_POLICY).payableMinor,(448115+25000+12000)*100);
});
test('dated decision does not reinterpret history or change default production callers',()=>{
  assert.deepEqual(parsePayrollForecastEvidence(payload(),asOf,FUNDING_PAYROLL_POLICY),parsePayrollForecastEvidence(payload(),asOf));
  assert.equal(parsePayrollForecastEvidence(currentPayload(),'2026-10-11').sourceComplete,false);
});
test('other unknown identities, changed exclusions and totals still fail closed',()=>{
  for(const kind of ['new','old','total']){
    const p=currentPayload();
    if(kind==='new'){p.rows.push({employee_ref:'other-person',closing_balance_signed:-100});p.totals.rows++;p.totals.closing_balance_signed-=100;}
    if(kind==='old'){p.rows[2].closing_balance_signed=-21;p.totals.closing_balance_signed--;}
    if(kind==='total')p.totals.closing_balance_signed++;
    assert.equal(parsePayrollForecastEvidence(p,p.as_of,FUNDING_PAYROLL_POLICY).payableMinor,null);
  }
});
