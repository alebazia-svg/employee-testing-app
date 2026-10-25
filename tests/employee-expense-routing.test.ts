import test from 'node:test';
import assert from 'node:assert/strict';
import { expenseAllocations, routeEmployeeExpenses, expenseRouteKey, expenseRouteCopy, adminExpenseRouteKey, adminExpenseRouteCopy, type ExpenseRouteEmployee } from '../lib/employee-expense-routing';
import { DELIVERY_PHONE_RESERVE_REF as reserve } from '../lib/procurement-delivery-reserve';
import { workdayNotificationThreadKey, workdayNotificationThreadWhere } from '../lib/workday-notification-thread';
import { expensePushTtl } from '../lib/employee-expense-policy';
const now = new Date('2026-10-25T15:10:00Z');
const employees: ExpenseRouteEmployee[] = [
 {id:8,name:'Лиана',applicantRef:'user-liana',cashboxRef:'liana',cashboxName:'Касса Хурзокова',department:'wholesale',onShift:true},
 {id:5,name:'Магомед',applicantRef:'user-magomed',cashboxRef:'magomed',cashboxName:'Касса Костеренко',department:'retail',onShift:false,shiftState:'ended'},
 {id:4,name:'Зухра',applicantRef:'user-zuhra',cashboxRef:'zuhra',cashboxName:'Касса Абшаева',department:'retail',onShift:true},
];
const source = () => ({ref:'request',number:'001141',date:'25.10.2026 18:09:01',amount:103000,posted:true,deletionMark:false,status:{key:'payable'},
 cashbox:{ref:'',name:''},requestedBy:{ref:'user-zuhra',name:'Абшаева Зухра'},currency:{name:'руб'},paymentForm:{cash:true,cashless:false,card:false},
 plannedDistribution:{complete:true,rows:[['liana','Касса Хурзокова',50000],['magomed','Касса Костеренко',16000],[reserve,'Резерв Под Телефоны',37000]].map(([ref,name,amount],i)=>({line_number:i+1,payment_place:{ref,name},amount,payment_date:'25.10.2026 0:00:00'}))},
 execution:{complete:true,executed_amount:0,remaining_amount:103000},linkedCashExpenseOrders:{complete:true,rows:[] as any[]}});
function pay(s: ReturnType<typeof source>,cashbox:string,amount:number,id=cashbox) { s.execution.executed_amount+=amount;s.execution.remaining_amount-=amount;s.linkedCashExpenseOrders.rows.push({ref:id,posted:true,deletion_mark:false,amount,request_amount:amount,executed_amount:amount,cashbox:{ref:cashbox},source_paths:['payment_line.request']});return s; }
const route = (s=source(), team=employees, extra={}) => routeEmployeeExpenses({complete:true,checkedAt:now.toISOString(),now,employees:team,rows:[{source:s,seenAt:now.toISOString(),cycle:1}],...extra});
test('cash push expires on offline devices within one sync interval and respects quiet hours',()=>{
 assert.equal(expensePushTtl(new Date('2026-10-25T07:00:00Z')),180);
 assert.equal(expensePushTtl(new Date('2026-10-25T18:59:30Z')),30);
 assert.equal(expensePushTtl(new Date('2026-10-25T19:00:00Z')),0);
});
test('non-payable, deleted, unposted, non-cash and unsupported currency never instruct an employee',()=>{
 for(const mutate of [
  (s:any)=>s.status.key='not_approved',(s:any)=>s.status.key='approved',(s:any)=>s.status.key='rejected',
  (s:any)=>s.deletionMark=true,(s:any)=>s.posted=false,(s:any)=>s.paymentForm.cash=false,
  (s:any)=>s.paymentForm.cashless=true,(s:any)=>s.paymentForm.card=true,(s:any)=>s.currency.name='USD',
 ]) {const s=source();mutate(s);assert.deepEqual(route(s).items,[]);}
});
test('duplicate, stale or future-dated observations cannot authorize cash actions',()=>{
 const s=source();
 for(const rows of [
  [{source:s,seenAt:new Date(+now-360001).toISOString(),cycle:1}],
  [{source:s,seenAt:new Date(+now+1).toISOString(),cycle:1}],
  [1,2].map(cycle=>({source:s,seenAt:now.toISOString(),cycle})),
 ]) {const r=route(s,employees,{rows});assert.deepEqual(r.items,[]);assert.deepEqual(r.adminItems,[]);}
});
test('empty header uses native split: each cashier only their amount, reserve applicant, absent cashier not delegated',()=>{
 const r=route();assert.equal(r.state,'ready');
 assert.deepEqual(r.items.filter(i=>i.mode==='execute').map(i=>[i.userId,i.remaining,i.onShift]),[[8,50000,true],[4,37000,true]]);
 const admin=r.adminItems[0];assert.equal(admin.remaining,16000);assert.equal(admin.reason,'Смена завершена');assert.equal(admin.applicant,'Абшаева Зухра');
 assert.ok(!r.items.some(i=>i.userId===4&&i.mode==='execute'&&i.cashboxRef==='magomed'));
});
test('partial RKO closes only its cashbox; full proof closes all and posting reversal restores only reversed amount',()=>{
 const s=pay(source(),'liana',30000);assert.equal(route(s).items.find(i=>i.userId===8)!.remaining,20000);
 pay(s,'liana',20000,'second');assert.ok(!route(s).items.some(i=>i.userId===8));assert.equal(route(s).items.find(i=>i.cashboxRef===reserve)!.remaining,37000);
 pay(s,'magomed',16000);pay(s,reserve,37000);assert.deepEqual(route(s).items,[]);
 s.linkedCashExpenseOrders.rows.at(-1).posted=false;s.linkedCashExpenseOrders.rows.at(-1).executed_amount=0;s.execution.executed_amount-=37000;s.execution.remaining_amount+=37000;
 assert.deepEqual(route(s).items.map(i=>[i.userId,i.remaining]),[[4,37000]]);
});
test('late or absent shift changes responsibility presentation, never amounts or authority',()=>{
 const active=route(source(),employees.map(e=>({...e,onShift:true})));assert.ok(!active.items.some(i=>i.mode==='coordinate'));
 const inactive=route(source(),employees.map(e=>({...e,onShift:false})));assert.ok(inactive.items.every(i=>!i.onShift));
 assert.equal(route().adminItems[0].remaining,16000);assert.equal(inactive.adminItems.length,3);
});
test('unsafe, stale or ambiguous sources are held; one bad request does not suppress another',()=>{
 for(const mutate of [
  (s:any)=>s.plannedDistribution.complete=false,(s:any)=>s.plannedDistribution.rows[0].amount=1,
  (s:any)=>s.plannedDistribution.rows[0].payment_date='',(s:any)=>s.plannedDistribution.rows[1].line_number=1,
  (s:any)=>{pay(s,'liana',1000);s.linkedCashExpenseOrders.rows[0].source_paths=['comment'];},
  (s:any)=>{pay(s,'liana',1000);s.linkedCashExpenseOrders.rows.push(s.linkedCashExpenseOrders.rows[0]);},
  (s:any)=>pay(s,'other-cashbox',1000), (s:any)=>pay(s,'liana',50001),
 ]){const s=source();mutate(s);const r=route(s);assert.deepEqual(r.items,[]);assert.deepEqual(r.unavailableRefs,['request']);}
 assert.equal(route(source(),employees,{complete:false}).state,'unavailable');
 assert.equal(route(source(),employees,{checkedAt:new Date(+now-400000).toISOString()}).state,'unavailable');
 const bad=source();bad.ref='bad';bad.execution.complete=false;
 const r=route(source(),employees,{rows:[{source:source(),seenAt:now.toISOString(),cycle:1},{source:bad,seenAt:now.toISOString(),cycle:1}]});
 assert.ok(r.items.length);assert.deepEqual(r.unavailableRefs,['bad']);
});
test('exact configured applicant only; disabled/missing/ambiguous applicant never assigns reserve to arbitrary worker',()=>{
 for(const team of [employees.filter(e=>e.id!==4),employees.map(e=>({...e,applicantRef:''})),[...employees,{...employees[2],id:99,cashboxRef:'another'}]]) {
  assert.ok(!route(source(),team).items.some(i=>i.cashboxRef===reserve&&i.mode==='execute'));
 }
 const duplicate=[...employees,{...employees[0],id:9}];assert.ok(!route(source(),duplicate).items.some(i=>i.cashboxRef==='liana'&&i.mode==='execute'));
 for(const missing of ['', 'other-user', '00000000-0000-0000-0000-000000000000']) { const s=source();s.requestedBy.ref=missing;assert.ok(!route(s).items.some(i=>i.cashboxRef===reserve),'same full name cannot substitute a missing/mismatched identity'); }
 const renamed=source();renamed.requestedBy.name='Новое отображаемое имя';renamed.requestedBy.ref='USER-ZUHRA';assert.equal(route(renamed).items.find(i=>i.cashboxRef===reserve)?.userId,4,'stable identity survives name changes');
});
test('safes never become cashier tasks; linked Astemir topup is excluded for every recipient',()=>{
 const s=source();s.plannedDistribution.rows[0].payment_place.name='Сейф Расходный';assert.ok(!route(s).items.some(i=>i.cashboxRef==='liana'));
 assert.deepEqual(route(source(),employees,{excludedRefs:['request']}).items,[]);
});
test('future allocation is silent; repeated cashbox rows aggregate; partial execution across different dates is ambiguous',()=>{
 const s=source();s.plannedDistribution.rows[0].payment_date='26.10.2026';assert.ok(!route(s).items.some(i=>i.cashboxRef==='liana'));
 const same=source();same.plannedDistribution.rows[0].amount=30000;same.plannedDistribution.rows.push({...same.plannedDistribution.rows[0],line_number:4,amount:20000});
 assert.equal(route(same).items.find(i=>i.userId===8)!.remaining,50000);
 same.plannedDistribution.rows[3].payment_date='26.10.2026';assert.equal(route(same).items.find(i=>i.userId===8)!.remaining,30000);
 pay(same,'liana',1000);assert.equal(expenseAllocations(same),null);
});
test('legacy single cashbox and notification identity survive; different requests are not hidden by one unread thread',()=>{
 const s:any=source();delete s.plannedDistribution;s.cashbox={ref:'liana',name:'Касса Хурзокова'};
 const item=route(s).items[0];assert.equal(item.remaining,103000);assert.equal(expenseRouteKey(item),'employee-expense:8:liana:request:1');
 assert.equal(expenseRouteKey({...item,remaining:1}),expenseRouteKey(item));
 const a={id:1,kind:'employee_expense_payable',fingerprint:expenseRouteKey(item)};
 const b={...a,id:2,fingerprint:expenseRouteKey({...item,ref:'other'})};
 assert.notEqual(workdayNotificationThreadKey(a),workdayNotificationThreadKey(b));
 assert.deepEqual(workdayNotificationThreadWhere(a),{kind:a.kind,fingerprint:{contains:':request:'},status:'sent'});
 assert.match(expenseRouteCopy([item]).title,/103 000 ₽/);assert.match(expenseRouteCopy([item]).body,/001141/);
});

test('shift explanations are factual; ADMIN ownership survives a later start; no foreign-cash applicant task',()=>{
 for(const [state,label] of [['ended','Смена завершена'],['not_started','Смена не начата'],['day_off','Сегодня выходной']] as const){
  const team=employees.map(e=>e.id===5?{...e,shiftState:state}:e);
  const r=route(source(),team),part=r.adminItems[0];assert.equal(part.reason,label);
  assert.equal(adminExpenseRouteCopy(part).body,`Касса Костеренко · ${label}`);
  const started=route(source(),team.map(e=>({...e,onShift:true})),{adminAssignments:[{key:adminExpenseRouteKey(part),reason:label}]});
  assert.equal(started.adminItems.length,1);assert.equal(started.adminItems[0].reason,'Выдача уже передана вам');assert.ok(!started.items.some(i=>i.cashboxRef==='magomed'));
  assert.equal(route(pay(source(),'magomed',16000),team).adminItems.length,0);
 }
 const r=route(source(),employees.filter(e=>e.id!==5));assert.equal(r.adminItems[0].reason,'Кассир не определён');
 const s=source();s.plannedDistribution.rows[0].payment_place.name='Маленький сейф';assert.ok(route(s).adminItems.some(i=>i.reason.includes('сейфа')));
});

test('a retained handover does not falsely report yesterday’s shift as today’s',()=>{
 const part=route().adminItems[0];const next=route(source(),employees,{adminAssignments:[{key:adminExpenseRouteKey(part),reason:'Сегодня выходной',at:'2026-10-24T09:00:00Z'}]});
 assert.equal(next.adminItems[0].reason,'За вами с 24.10');assert.equal(next.adminItems[0].handoverNote,'При передаче: выходной по графику.');
});
