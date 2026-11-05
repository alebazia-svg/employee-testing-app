import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { taxPaymentHistory, taxManagerBrief } from '../lib/tax-manager-brief';
import { TaxOperations } from '../components/taxes/TaxOperations';
import type { TaxManagementReview } from '../lib/tax-management-review';
import type { PortalReport } from '../lib/ausn-portal-view';
const review = { schema:1, cutoff:'2026-10-31',reviewedAt:'2026-11-05',q1UsnCents:240430876,q1PsnCents:1763626140,months:[{periodKey:'2026-04',fnsCents:4000000000,paymentsCents:4100000000}],fnsCrossing:'2026-10-22',paymentsCrossing:'2026-09-29',sources:[],bridge:[],findings:[{title:'Проверить договор',status:'open',action:'Получить первичный документ',detail:'Связь не подтверждена',sourceName:'source.zip'}],regimeStatus:{checkedAt:'2026-11-05',ausnEndedOn:'2026-10-01',certificateNumber:'101551',sourceName:'proof.zip',usnStatus:'not_confirmed'} } as TaxManagementReview;
const report = { available:true,monthDetails:[{periodKey:'2026-09',fnsAssessed:355634,fnsAssessedState:'loaded',enpPayment:355634,enpPaymentState:'found'},{periodKey:'2026-10',tax:802000,fnsAssessed:999,fnsAssessedState:'unknown',enpPayment:999,enpPaymentState:'unknown'}] } as PortalReport;
test('tax obligations expose only explicit official accruals and bank findings; never a fabricated debt',()=>{
 const rows=taxPaymentHistory(report);
 assert.equal(rows[0].assessed,undefined);assert.equal(rows[0].bankPayment,undefined);
 assert.equal(rows[1].assessed,355634);assert.equal(rows[1].bankPayment,355634);
 assert.deepEqual(taxPaymentHistory({...report,available:false}),[]);
 const html=renderToStaticMarkup(<TaxOperations review={review} report={report} base='/admin/taxes'/>);
 assert.match(html,/не требование оплатить/);assert.match(html,/Сальдо ЕНС не сверено/);
 assert.doesNotMatch(html,/802.?000|999,00|Оплачено|Просрочен/);
});
test('missing reports and zero official accruals remain distinct',()=>{
 const html=renderToStaticMarkup(<TaxOperations review={review} base='/admin/taxes'/>);
 assert.match(html,/Нет подтверждённых данных/);assert.doesNotMatch(html,/0,00/);
 assert.equal(taxPaymentHistory({...report,monthDetails:[{...report.monthDetails[0],fnsAssessed:0}]})[0].assessed,0);
});
test('accountant brief includes both Q1 regimes, source cutoff and unresolved USN status',()=>{
 const brief=taxManagerBrief(review);
 assert.match(brief,/17.*636.*261,40/);assert.match(brief,/2.*404.*308,76/);
 assert.match(brief,/2026-10-31/);assert.match(brief,/2026-10-22/);
 assert.match(brief,/Принятие УСН «Доходы» отдельно не подтверждено/);
 assert.match(brief,/Получить первичный документ/);
 assert.doesNotMatch(brief,/УСН принята|Всё проверено/);
});
