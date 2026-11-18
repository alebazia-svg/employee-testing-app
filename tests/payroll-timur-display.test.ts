import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Final from '../app/(dashboard)/admin/payroll/PayrollFinalOverview';
require.extensions['.css'] = () => {};
// Match the existing report-render harness: the unrelated product editor is closed.
const shellPath = require.resolve('../components/AdminShell');
require.cache[shellPath] = { id: shellPath, filename: shellPath, loaded: true, exports: { AdminShell: () => null } } as NodeModule;
const Preview = require('../app/(dashboard)/admin/payroll/PayrollOverviewPreview').default as typeof import('../app/(dashboard)/admin/payroll/PayrollOverviewPreview').default;
import Payments from '../app/(dashboard)/admin/payroll/PayrollLivePayments';
import { FILM_TRAINEE_NAME as employee } from '../lib/payroll-trainee';
Object.assign(globalThis,{React});

test('November name reaches real current/final/payment components while old statements keep their label',()=>{
  for(const [periodKey,label] of [['2026-10','Тимур · поклейка'],['2026-11','Назранов Тимур'],['2026-12','Назранов Тимур']]) {
    const common={periodKey,periodPicker:null,onEmployee:()=>{},onExport:()=>{}};
    const final=renderToStaticMarkup(React.createElement(Final,{...common,runNumber:1,exporting:false,comparing:false,onCompare:()=>{},employees:[{employeeName:employee,salaryType:'retail_sales_bonus',grossPay:700,advance:100,netPay:600,fixedDeduction:0}]}));
    const current=renderToStaticMarkup(React.createElement(Preview,{...common,period:periodKey,date:'18.11.2026',preliminary:true,stale:false,columns:[[{name:'Розница',rows:[{employeeName:employee,shadowGrossPay:700,shadowNetPay:600,advance:100,requiresReview:false,detailDifferences:[]}]}]],issues:[],employeeIssues:[],advancesValid:true,exportDisabled:false,onSource:()=>{},onProducts:async()=>[],onSaveProducts:async()=>[]}));
    const payment=renderToStaticMarkup(React.createElement(Payments,{enabled:true,initialTab:'payments',names:[employee],periodPicker:null,onEmployee:()=>{},children:null,read:{error:'',retry:()=>{},data:{periodKey,cash:{dateFrom:'2026-11-01',dateTo:'2026-11-18',checkedAt:'2026-11-18T12:00:00Z',documents:[]},balance:{version:1,asOf:'2026-11-18',checkedAt:'2026-11-18T12:00:00Z',rows:[]}}}}));
    for(const html of [final,current,payment]) {assert.ok(html.includes(label));assert.ok(!html.includes(employee));}
    assert.match(final,/700/);assert.match(current,/700/);
  }
});
