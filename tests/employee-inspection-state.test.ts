import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectionDeviceSnapshot, type InspectionConnectionRecord } from '../lib/employee-inspection-state';
import { employeePreviewUrl } from '../lib/employee-preview-request';
import { employeePreviewHref } from '../lib/employee-navigation';

const now=new Date('2026-11-08T08:00:00Z');
const row=(id:string,extra:Partial<InspectionConnectionRecord>={}):InspectionConnectionRecord=>({id,userId:7,device:'iPhone',browser:'Safari',browserInstanceId:id,observedBrowserId:id,isService:false,serviceMarkedAt:null,listArchivedAt:null,lastSeenAt:now,expiresAt:new Date('2026-12-01T00:00:00Z'),loggedOutAt:null,displayMode:'app',contextCheckedAt:now,deviceObservation:null,pushState:'not_connected',pushCheckedAt:now,pushSubscription:null,...extra});
const snapshot=(rows:InspectionConnectionRecord[],selected:string|null=null)=>inspectionDeviceSnapshot(rows,7,selected,new Set(),new Set(),now);

test('phone state never borrows a connected computer or another employee subscription',()=>{
 const rows=[row('phone'),row('computer',{device:'Компьютер Windows',displayMode:'browser',pushState:'connected',pushSubscription:{userId:7,disabledAt:null}}),row('foreign',{userId:8,pushState:'connected',pushSubscription:{userId:8,disabledAt:null}})];
 const s=snapshot(rows);assert.equal(s.selectedId,'phone');assert.equal(s.connections.length,2);assert.equal(s.connections.find(c=>c.id===s.selectedId)?.state,'notifications');
 assert.equal(snapshot(rows,'computer').connections.find(c=>c.id==='computer')?.state,'ready');
 assert.equal(snapshot(rows,'foreign').selectedId,null);
 assert.equal(snapshot([row('wrong-owner',{pushState:'connected',pushSubscription:{userId:8,disabledAt:null}})]).connections[0].state,'notifications');
 assert.equal(snapshot([row('inactive',{pushState:'connected',pushSubscription:{userId:7,disabledAt:now}})]).connections[0].state,'notifications');
});

test('stale, signed-out, mismatched and archived observations never assert a current fault',()=>{
 for(const r of [row('old',{pushCheckedAt:new Date('2026-11-06T08:00:00Z'),contextCheckedAt:new Date('2026-11-06T08:00:00Z')}),row('out',{loggedOutAt:now}),row('expired',{expiresAt:now}),row('mismatch',{observedBrowserId:'another'}),row('archived',{listArchivedAt:now})]){
  const c=snapshot([r]).connections[0];assert.equal(c.state,'checking');assert.equal(c.fresh,false);assert.equal(c.pushLabel,'Нет свежих данных');
 }
});

test('installed phone and Safari preserve their actual different guidance; explicit denial and unsupported are retained',()=>{
 assert.equal(snapshot([row('safari',{displayMode:'browser'})]).connections[0].state,'safari');
 assert.equal(snapshot([row('denied',{pushState:'blocked'})]).connections[0].state,'denied');
 assert.equal(snapshot([row('unsupported',{pushState:'unsupported'})]).connections[0].state,'unsupported');
 assert.equal(snapshot([row('unknown',{pushState:'unknown'})]).connections[0].state,'checking');
 assert.equal(snapshot([]).selectedId,null);
});

test('same bound connection uses the latest observation, while administrative/service connections are excluded',()=>{
 const rows=[row('first',{lastSeenAt:new Date(now.getTime()-60000)}),row('latest',{browserInstanceId:'first',observedBrowserId:'first',pushState:'blocked'}),row('service',{isService:true}),row('admin'),row('owner')];
 const s=inspectionDeviceSnapshot(rows,7,null,new Set(['admin']),new Set(['owner']),now);
 assert.deepEqual(s.connections.map(c=>c.id),['latest']);assert.equal(s.connections[0].state,'denied');
 assert.equal(inspectionDeviceSnapshot(rows,7,'first',new Set(['admin']),new Set(['owner']),now).selectedId,'latest','same bound browser follows a new employee session');
 const text=JSON.stringify(s);assert.ok(!text.includes('pushSubscription'));assert.ok(!text.includes('browserInstanceId'));assert.ok(!text.includes('deviceObservation'));
});

test('inspection transport forwards only explicit read resources and selected connection, never identity or mutation',()=>{
 assert.equal(employeePreviewUrl('visit','/api/employee/app-setup?connection=phone&userId=8'),'/api/admin/employees/preview/visit?resource=app-setup&connection=phone');
 assert.equal(employeePreviewUrl('visit','/api/employee/work-help?userId=8'),'/api/admin/employees/preview/visit?resource=work-help');
 assert.throws(()=>employeePreviewUrl('visit','/api/employee/work-help',{method:'POST'}));
 assert.throws(()=>employeePreviewUrl('visit','/api/employee/push-subscription',{method:'POST'}));
 assert.equal(employeePreviewHref('visit','/employee?tab=schedule',{connection:'phone'}),'/admin/employees/preview/visit?tab=schedule&connection=phone');
});
