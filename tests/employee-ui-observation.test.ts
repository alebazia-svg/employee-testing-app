import test from 'node:test';
import assert from 'node:assert/strict';
import { parseEmployeeUiObservation,employeeSetupError,employeeUiLive } from '../lib/employee-ui-observation';
import { parseAppObservation } from '../lib/portal-app-observation';
import { inspectionDeviceSnapshot,type InspectionConnectionRecord } from '../lib/employee-inspection-state';
const now=new Date('2026-11-08T10:00:00Z');
const ui={setup:'notifications' as const,busy:false,error:null,online:true,sampledAt:now.toISOString()};
const app={version:'1.21.46',builtAt:'2026-11-07T20:39:36.808Z',clientId:'76ad826c-ef9d-4582-968b-2c716819fc67',state:'current',ui};

test('only bounded UI service state is admitted; ordinary release observations remain compatible',()=>{
 assert.deepEqual(parseAppObservation(app),app);
 assert.deepEqual(parseEmployeeUiObservation(ui),ui);
 for(const invalid of [{...ui,input:'private'}, {...ui,error:'private raw server payload'}, {...ui,setup:'success'}, {...ui,sampledAt:'bad'}, {...ui,busy:'yes'}, {...ui,online:undefined}])assert.equal(parseEmployeeUiObservation(invalid),null);
 assert.equal(employeeSetupError('https://private.invalid/details'),'Не удалось подключить уведомления. Повторите попытку.');
 const {ui:_,...old}=app;assert.deepEqual(parseAppObservation(old),old);
});

test('live freshness requires a recent received report, without converting a silent phone into a known network error',()=>{
 assert.equal(employeeUiLive(ui,now,now),true);
 const later=new Date(now.getTime()+31000);assert.equal(employeeUiLive(ui,now,later),false);
 assert.equal(employeeUiLive(ui,null,now),false);
 assert.equal(employeeUiLive({...ui,sampledAt:'2026-01-01T00:00:00.000Z'},now,now),true,'phone clock does not invent a stale connection');
});

test('inspection follows the actual banner state through connecting, error and success on one device',()=>{
 const record:InspectionConnectionRecord={id:'phone',userId:7,device:'iPhone',browser:'Safari',browserInstanceId:'phone',observedBrowserId:'phone',isService:false,serviceMarkedAt:null,listArchivedAt:null,lastSeenAt:now,expiresAt:new Date(now.getTime()+86400000),loggedOutAt:null,displayMode:'app',contextCheckedAt:now,deviceObservation:null,pushState:'not_connected',pushCheckedAt:now,pushSubscription:null,appCheckedAt:now};
 const phases=[ui,{...ui,setup:'reconnect' as const,busy:true},{...ui,setup:'reconnect' as const,error:employeeSetupError('failed')},{...ui,setup:'ready' as const}];
 for(const phase of phases){
  const s=inspectionDeviceSnapshot([{...record,appObservation:{...app,ui:phase}}],7,'phone',new Set(),new Set(),now).connections[0];
  assert.equal(s.state,phase.setup);assert.equal(s.live,true);assert.deepEqual(s.runtime,phase);
 }
 const stale=inspectionDeviceSnapshot([{...record,appObservation:app}],7,'phone',new Set(),new Set(),new Date(now.getTime()+60000)).connections[0];
 assert.equal(stale.live,false);assert.equal(stale.runtime?.setup,'notifications');
 const other=inspectionDeviceSnapshot([{...record,observedBrowserId:'another',appObservation:app}],7,'phone',new Set(),new Set(),now).connections[0];assert.equal(other.runtime,undefined);
});

test('rollback format fallback preserves ordinary observation/commands and never repeats successful or failed journal writes',async()=>{
 const {postPortalObservation}=await import('../lib/portal-observation-request');
 const reports:any[]=[];let responses=[400,200];
 const request=async(_input:any,init:any)=>{reports.push(JSON.parse(init.body));return Response.json({ok:true,updateCommand:{id:'retained'}},{status:responses.shift()??200});};
 const sent=await postPortalObservation({permission:'default',app:app as any},new AbortController().signal,false,request as any);
 assert.equal(sent.legacyUi,true);assert.equal(reports.length,2);assert.deepEqual(reports[0].app.ui,ui);assert.equal(reports[1].app.ui,undefined);assert.equal(reports[1].app.clientId,app.clientId);assert.equal((await sent.response.json()).updateCommand.id,'retained');
 for(const status of [200,403,503]){reports.length=0;responses=[status];await postPortalObservation({app:app as any},new AbortController().signal,false,request as any);assert.equal(reports.length,1);}
 reports.length=0;responses=[200];await postPortalObservation({app:app as any},new AbortController().signal,true,request as any);assert.equal(reports.length,1);assert.equal(reports[0].app.ui,undefined);
});
