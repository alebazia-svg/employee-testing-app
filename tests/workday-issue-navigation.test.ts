import test from 'node:test';
import assert from 'node:assert/strict';
import {workdayIssueLocation,workdayIssueTarget} from '../lib/workday-issue-navigation';
const current='https://team.example/admin/workday?date=2026-10-19&control=all&view=overview&employee=4&focus=shift-issues#employees-control';
test('an issue opens over its original overview rather than the link’s action-queue background',()=>{
 const id=workdayIssueTarget('/admin/workday?date=2026-10-19&view=attention&issue=12',current,'2026-10-19');
 assert.equal(id,12);
 const opened=new URL(workdayIssueLocation(current,id),'https://team.example');
 assert.equal(opened.searchParams.get('view'),'overview');assert.equal(opened.searchParams.get('control'),'all');assert.equal(opened.searchParams.has('employee'),false);assert.equal(opened.searchParams.has('focus'),false);assert.equal(opened.hash,'#employees-control');
 const closed=new URL(workdayIssueLocation(opened.href,null),'https://team.example');assert.equal(closed.searchParams.has('issue'),false);assert.equal(closed.searchParams.get('date'),'2026-10-19');assert.equal(closed.searchParams.get('view'),'overview');
});
test('the same issue handling preserves queue and audit contexts',()=>{
 for(const view of ['attention','audit']){const url=new URL(current);url.searchParams.set('view',view);assert.equal(new URL(workdayIssueLocation(url.href,7),'https://team.example').searchParams.get('view'),view);}
});
test('foreign origins, other dates, other sections and malformed ids retain ordinary navigation',()=>{
 for(const href of ['https://other.example/admin/workday?date=2026-10-19&issue=1','/admin/workday?date=2026-10-18&issue=1','/admin/attendance?date=2026-10-19&issue=1','/admin/workday?issue=0','/admin/workday?issue=-1','/admin/workday?issue=Infinity','/admin/workday?issue=9007199254740992'])assert.equal(workdayIssueTarget(href,current,'2026-10-19'),null);
});
test('current-day navigation also works when the initial page has no date query',()=>{
 assert.equal(workdayIssueTarget('/admin/workday?issue=12','https://team.example/admin/workday','2026-10-19'),12);
});
