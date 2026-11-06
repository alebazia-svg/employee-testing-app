import test from 'node:test';
import assert from 'node:assert/strict';
import {adminPageRoute,parseAdminVisit} from '../lib/admin-page-policy';
test('catalogue keeps only known pages and tab enums, never identifiers or private query values',()=>{
  const query=new URLSearchParams('tab=income&search=private&token=secret');
  assert.equal(adminPageRoute('/admin/taxes',query),'taxes_income');
  assert.equal(adminPageRoute('/admin/employees/access',new URLSearchParams('view=history')),'access_history');
  assert.equal(adminPageRoute('/admin/workday/issues/private-id',query),'issue');
  for(const p of ['/admin/employees/access/pages-preview','/admin/employees/preview/id','/admin/dev/qr-test','/employee','/admin/unknown','/admin/workday/issues/id/extra'])assert.equal(adminPageRoute(p,query),null,p);
});
test('collector accepts catalogue references only, and rejects arbitrary context, URL, actor or browser fields',()=>{
  const v={key:'test-visit-123',page:'home',previous:'access'};
  assert.deepEqual(parseAdminVisit(v),v);
  for(const extra of [{page:'/admin?token=secret'},{userId:1},{browserId:'abc'},{url:'/admin'},{previous:'bad'},{key:'x'},{context:{value:'private'}}])assert.equal(parseAdminVisit({...v,...extra}),null);
});
