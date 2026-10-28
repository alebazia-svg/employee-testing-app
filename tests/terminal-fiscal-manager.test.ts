import test from 'node:test';
import assert from 'node:assert/strict';
import {fiscalManager,applyFiscalManagers} from '../lib/terminal-fiscal-manager';
import {buildDailyFiscalReport,type DailyFiscalEvidence} from '../lib/terminal-fiscal-daily-report';
import {bankOperationKey,canonicalFiscalKey} from '../lib/terminal-fiscal-matching';
import {loadFiscalManager} from '../lib/terminal-fiscal-manager-loader';
import {syncFiscalManagerAlert} from '../lib/terminal-fiscal-manager-alert';
import {needsAdminAttention} from '../lib/admin-inbox-attention-policy';
const milana={id:3,name:'Чеченова Милана',cashierRef:'milana'},magomed={id:5,name:'Костеренко Магомед',cashierRef:'magomed'};
const decide=(cashiers:Array<{ref:string;name:string}>,expected:typeof milana|null=milana)=>fiscalManager({expected,cashiers,people:[milana,magomed]});
test('shift attribution becomes confirmed only when the 1C cashier identity agrees',()=>{
 assert.equal(decide([]).state,'shift');assert.equal(decide([]).name,milana.name);
 assert.equal(decide([{ref:'milana',name:milana.name}]).state,'confirmed');
 assert.equal(decide([{ref:'magomed',name:magomed.name}]).state,'conflict');
 assert.equal(decide([],null).state,'unknown');
 assert.equal(decide([{ref:'milana',name:milana.name}],null).state,'one_c');
 assert.equal(decide([{ref:'unmapped',name:milana.name}]).state,'conflict','equal display names do not prove identity');
 assert.equal(decide([{ref:'milana',name:milana.name},{ref:'magomed',name:magomed.name}]).state,'conflict');
});
function dbFixture(){
 const events:any[]=[],receipts:any[]=[];let assignments:any[]=[],shiftEnd:Date|null=null;
 const db:any={
  workDayEntry:{findMany:async()=>[{userId:3,startedAt:new Date('2026-10-28T05:00Z'),endedAt:shiftEnd,user:{name:milana.name}},{userId:5,startedAt:new Date('2026-10-28T05:00Z'),endedAt:null,user:{name:magomed.name}}]},
  terminalFiscalMapping:{findUnique:async()=>({oneCCashRegisterRef:'kkm',terminalKey:'1010808747019437'}),findMany:async()=>[]},
  workdayKkmAssignment:{findMany:async({where}:any)=>assignments.filter(a=>a.at<=where.effectiveFrom.lte&&(!a.until||a.until>where.effectiveFrom.lte)).map(a=>({userId:a.userId}))},
  userOneCCashboxMapping:{findMany:async()=>[milana,magomed].map(p=>({userId:p.id,oneCCashierRef:p.cashierRef,oneCCashRegisterRef:null,user:{name:p.name}}))},
  adminInboxEvent:{findUnique:async()=>events[0]??null,upsert:async({create,update}:any)=>{if(events[0])Object.assign(events[0],update);else events.push({id:'event',...create});return events[0];}},
  user:{findMany:async()=>[{id:1}]},adminInboxReceipt:{createMany:async()=>{if(!receipts.length)receipts.push({readAt:null});},updateMany:async({data}:any)=>receipts.forEach(r=>Object.assign(r,data))},
  $transaction:async(fn:any)=>fn(db),
 };
 return {db,events,receipts,setAssignments:(v:any[])=>assignments=v,setEnd:(v:Date)=>shiftEnd=v};
}
test('dated KKM overrides and handovers use the instant of the payment; ambiguous seating is never guessed',async()=>{
 const f=dbFixture(),at=new Date('2026-10-28T09:20Z');
 assert.equal((await loadFiscalManager(f.db,{at,mappingId:'m',cashiers:[]})).name,milana.name);
 f.setAssignments([{userId:5,at:new Date('2026-10-28T09:00Z')}]);
 assert.equal((await loadFiscalManager(f.db,{at,mappingId:'m',cashiers:[]})).name,magomed.name);
 f.setAssignments([{userId:3,at:new Date('2026-10-28T08:00Z'),until:at},{userId:5,at}]);
 assert.equal((await loadFiscalManager(f.db,{at,mappingId:'m',cashiers:[]})).name,magomed.name);
 f.setAssignments([{userId:3,at},{userId:5,at}]);assert.equal((await loadFiscalManager(f.db,{at,mappingId:'m',cashiers:[]})).state,'unknown');
 f.setAssignments([]);f.setEnd(new Date('2026-10-28T09:00Z'));assert.equal((await loadFiscalManager(f.db,{at,mappingId:'m',cashiers:[]})).state,'unknown');
});
test('92,500 and 72,900 move all three amounts to the same manager without changing financial results',()=>{
 for(const amount of [9250000,7290000]){
  const at='2026-10-28T09:20:53Z',bank={terminalKey:'t',rrn:'r',transactionDate:at,amountKopecks:amount,type:'Debit' as const};
  const c:any={sourceRef:'a',sourceType:'acquiring_operation',operationType:'sale',dateTime:at,cashRegisterRef:'',kktRegistrationNumber:'',electronicKopecks:amount,totalKopecks:amount,cashier:{ref:'',name:''},cardPayments:[],items:[],fiscalState:'unconfirmed'};
  const ofd:any={kktRegistrationNumber:'kkt',receiptAt:at,operationType:1,electronicKopecks:amount,totalKopecks:amount,fiscalDriveNumber:'fn',fiscalDocumentNumber:'638',fiscalSign:'fp',items:[]};
  const part:DailyFiscalEvidence={bankOperations:[bank],oneCChecks:[c],ofdReceipts:[ofd],complete:{bank:true,oneC:true,ofd:true},records:[{status:'confirmed',reasonCode:'MATCH_CONFIRMED',bankOperationKey:bankOperationKey(bank),oneCCheckKey:'a',ofdReceiptKey:canonicalFiscalKey(ofd),evidence:{},sourceCompleteness:{tbank:true,oneC:true,ofd:true}} as any]};
  const report=buildDailyFiscalReport({from:new Date('2026-10-27T21:00Z'),to:new Date('2026-10-28T21:00Z'),parts:[part]});
  const before=structuredClone(report.total),native=report.nativeFiscalKopecks;
  applyFiscalManagers(report,new Map([[report.transactions[0].key,decide([])]]));
  assert.deepEqual(report.total,before);assert.equal(report.nativeFiscalKopecks,native);assert.equal(report.rows.length,1);assert.equal(report.rows[0].name,milana.name);
  assert.equal(report.rows[0].bankKopecks,amount);assert.equal(report.rows[0].oneCKopecks,amount);assert.equal(report.rows[0].ofdKopecks,amount);
  assert.equal(report.transactions[0].status,'matched');assert.equal(report.rows[0].bankDifferenceKopecks,0);assert.equal(report.rows[0].fiscalDifferenceKopecks,0);
 }
});
test('ADMIN alert is idempotent, survives read, resolves and reopens; incomplete sources preserve it',async()=>{
 const f=dbFixture(),record:any={matchingKey:'payment',mappingId:'m',evaluatedAt:'2026-10-28T11:00Z',evidence:{bankTransactionDate:'2026-10-28T09:20:53Z'},amountKopecks:7290000,sourceCompleteness:{tbank:true,oneC:true,ofd:true}};
 const cashier=[{ref:'magomed',name:magomed.name}];
 await syncFiscalManagerAlert(f.db,record,cashier);await syncFiscalManagerAlert(f.db,record,cashier);assert.equal(f.events.length,1);assert.equal(f.events[0].type,'fiscal_manager.attention');
 assert.equal(needsAdminAttention({id:'e',readAt:'now',event:f.events[0],meta:{category:'requests'},sourceState:{active:true}}),true);
 await syncFiscalManagerAlert(f.db,{...record,sourceCompleteness:{tbank:true,oneC:false,ofd:true}},[]);assert.equal(f.events[0].type,'fiscal_manager.attention');
 await syncFiscalManagerAlert(f.db,record,[{ref:'milana',name:milana.name}]);assert.equal(f.events[0].type,'fiscal_manager.resolved');
 f.receipts[0].readAt='read';await syncFiscalManagerAlert(f.db,record,cashier);assert.equal(f.receipts[0].readAt,null);
});
test('ordinary missing cashier with a reliable shift does not create an ADMIN question',async()=>{const f=dbFixture();await syncFiscalManagerAlert(f.db,{matchingKey:'p',evaluatedAt:'2026-10-28T11:00Z',evidence:{bankTransactionDate:'2026-10-28T09:20Z'},mappingId:'m',sourceCompleteness:{tbank:true,oneC:true,ofd:true}} as any,[]);assert.equal(f.events.length,0);});
test('a conflicting group preserves known per-document cashiers and signed refunds in totals',()=>{
 const report:any={transactions:[{key:'g',at:'2026-10-28T09:00Z',manager:'Милана, Магомед',status:'covered',bank:[{key:'b'}],oneC:[{key:'c1'},{key:'c2'}],ofd:[{key:'kkt|f1'},{key:'kkt|f2'}]}],rows:[{key:'cashier:milana',name:milana.name},{key:'cashier:magomed',name:magomed.name},{key:'unassigned',name:'Не распределено'}],movements:[{source:'bank',key:'b',managerKey:'unassigned',amountKopecks:-100},{source:'oneC',key:'c1',managerKey:'cashier:milana',amountKopecks:-60},{source:'oneC',key:'c2',managerKey:'cashier:magomed',amountKopecks:-40},{source:'ofd',key:'f1',managerKey:'cashier:milana',amountKopecks:-60},{source:'ofd',key:'f2',managerKey:'cashier:magomed',amountKopecks:-40}],status:'review',total:{bankKopecks:-100,oneCKopecks:-100,ofdKopecks:-100}};
 const before=structuredClone(report.movements);applyFiscalManagers(report,new Map([['g',decide([{ref:'milana',name:milana.name},{ref:'magomed',name:magomed.name}])]]));
 assert.deepEqual(report.movements,before);assert.equal(report.rows.find((r:any)=>r.key==='cashier:magomed').oneCKopecks,-40);assert.equal(report.transactions[0].status,'covered');
});
test('an unknown manager becomes an ADMIN question only after the existing quiet period',async()=>{
 const f=dbFixture();f.setAssignments([{userId:3,at:new Date('2026-10-28T08:00Z')},{userId:5,at:new Date('2026-10-28T08:00Z')}]);
 const record:any={matchingKey:'p',mappingId:'m',amountKopecks:100,evaluatedAt:'2026-10-28T09:40Z',evidence:{bankTransactionDate:'2026-10-28T09:20Z'},sourceCompleteness:{tbank:true,oneC:true,ofd:true}};
 await syncFiscalManagerAlert(f.db,record,[]);assert.equal(f.events.length,0);
 await syncFiscalManagerAlert(f.db,{...record,evaluatedAt:'2026-10-28T10:00Z'},[]);assert.equal(f.events[0].type,'fiscal_manager.attention');assert.match(f.events[0].body,/однозначного ответственного/);
});
