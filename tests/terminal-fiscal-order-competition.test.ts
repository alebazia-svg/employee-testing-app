import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../lib/prisma';
import { runTerminalFiscalHistoricalDryRun } from '../lib/terminal-fiscal-runner';
import type { OneCCheck, OfdReceipt } from '../lib/terminal-fiscal-matching';

const from=new Date('2026-10-27T00:00:00+03:00'),to=new Date('2026-10-28T00:00:00+03:00');
const at='2026-10-27T12:20:53+03:00',checkedAt='2026-10-28T10:00:00Z';
function setup(t:TestContext) {
 const owner={id:'map1',isActive:true,terminalKey:'t1',oneCAcquiringTerminalRef:'shared',oneCCashRegisterRef:'kkm1',kktRegistrationNumber:'k1',effectiveFrom:new Date('2026-01-01'),effectiveTo:null};
 const peer={...owner,id:'map2',terminalKey:'t2',oneCCashRegisterRef:'kkm2',kktRegistrationNumber:'k2'};
 const delegate=prisma.terminalFiscalMapping;
 const findUnique=delegate.findUnique,findMany=delegate.findMany;
 delegate.findUnique=(async()=>owner) as unknown as typeof findUnique;
 delegate.findMany=(async()=>[peer]) as unknown as typeof findMany;
 t.after(()=>{delegate.findUnique=findUnique;delegate.findMany=findMany;});
 const bank={terminalKey:'t1',rrn:'b1',transactionDate:at,amountKopecks:7290000,type:'Debit' as const};
 const items=[{name:'Samsung S26 12/256 Gb Black',quantity:1,priceKopecks:7290000,sumKopecks:7290000,paymentType:1,productType:10}];
 const check:OneCCheck={sourceRef:'acquiring1',sourceType:'acquiring_operation',operationType:'sale',dateTime:'2026-10-27T12:22:55+03:00',cashRegisterRef:'',kktRegistrationNumber:'',totalKopecks:7290000,electronicKopecks:7290000,cashier:{ref:'',name:''},cardPayments:[{lineNumber:'1',amountKopecks:7290000,acquiringTerminalRef:'shared',referenceNumber:'',authorizationCode:'',terminalReceiptNumber:''}],items:[],fiscalState:'unconfirmed',fiscalStateMeaning:'data_state_only',acquiringOrderState:'complete',acquiringOrder:{ref:'order',number:'075',dateTime:at,totalKopecks:7290000,items}};
 const receipt:OfdReceipt={fiscalDriveNumber:'fn',fiscalDocumentNumber:'638',fiscalSign:'fp',receiptAt:'2026-10-27T12:14:00+03:00',kktRegistrationNumber:'k1',totalKopecks:7290000,electronicKopecks:7290000,operationType:1,items};
 return {owner,peer,bank,check,receipt};
}
for(const state of ['no-competitor','competing-payment','incomplete-peer-bank','incomplete-peer-ofd'] as const)test(`runner includes the other physical workplace before confirming order proof: ${state}`,async t=>{
 const f=setup(t);const bankCalls:string[]=[],ofdCalls:string[]=[];
 const r=await runTerminalFiscalHistoricalDryRun({mappingId:'map1',periodFrom:from,periodTo:to,persist:false,includeEvidence:true},{
  loadTbank:async q=>{bankCalls.push(q.terminalKey);return{complete:!(q.terminalKey==='t2'&&state==='incomplete-peer-bank'),checkedAt,data:q.terminalKey==='t1'?[f.bank]:state==='competing-payment'?[{...f.bank,terminalKey:'t2',rrn:'b2'}]:[]};},
  loadOneC:async()=>({complete:true,checkedAt,data:[f.check]}),
  loadOfd:async q=>{ofdCalls.push(q.kktRegistrationNumber);return{complete:!(q.kktRegistrationNumber==='k2'&&state==='incomplete-peer-ofd'),checkedAt,data:q.kktRegistrationNumber==='k1'?[f.receipt]:[]};},
 });
 assert.ok(r.acquired&&r.output&&r.evidence);assert.equal(r.persisted,false);assert.deepEqual(bankCalls,['t1','t2']);assert.deepEqual(ofdCalls,['k1','k2']);assert.equal(r.output.records.length,1);assert.equal(r.evidence.bankOperations.length,1);assert.equal(r.evidence.ofdReceipts.length,1);
 assert.equal(r.output.records[0].status==='confirmed',state==='no-competitor');
 if(state.startsWith('incomplete'))assert.equal(r.output.records[0].status,'unavailable');
});
test('ordinary native matching does not add peer source dependencies',async t=>{
 const f=setup(t);delete f.check.acquiringOrder;delete f.check.acquiringOrderState;
 const calls:string[]=[];
 const r=await runTerminalFiscalHistoricalDryRun({mappingId:'map1',periodFrom:from,periodTo:to,persist:false,includeEvidence:true},{loadTbank:async q=>{calls.push(q.terminalKey);return{complete:true,checkedAt,data:[f.bank]};},loadOneC:async()=>({complete:true,checkedAt,data:[f.check]}),loadOfd:async()=>({complete:true,checkedAt,data:[f.receipt]})});
 assert.ok(r.acquired);assert.deepEqual(calls,['t1']);
});
test('a competing workplace native fiscal proof does not block the unique order on this workplace',async t=>{
 const f=setup(t);
 const native:OneCCheck={...f.check,sourceRef:'native2',sourceType:'sale_check',dateTime:at,cashRegisterRef:'kkm2',kktRegistrationNumber:'k2',fiscalState:'confirmed',fiscalDriveNumber:'fn2',fiscalDocumentNumber:'639',fiscalSign:'fp2',acquiringOrder:undefined,acquiringOrderState:undefined,items:f.receipt.items};
 const peerReceipt={...f.receipt,kktRegistrationNumber:'k2',fiscalDriveNumber:'fn2',fiscalDocumentNumber:'639',fiscalSign:'fp2'};
 const r=await runTerminalFiscalHistoricalDryRun({mappingId:'map1',periodFrom:from,periodTo:to,persist:false,includeEvidence:true},{
  loadTbank:async q=>({complete:true,checkedAt,data:[q.terminalKey==='t1'?f.bank:{...f.bank,terminalKey:'t2',rrn:'b2'}]}),
  loadOneC:async()=>({complete:true,checkedAt,data:[f.check,native]}),
  loadOfd:async q=>({complete:true,checkedAt,data:[q.kktRegistrationNumber==='k1'?f.receipt:peerReceipt]}),
 });
 assert.ok(r.acquired&&r.output);assert.equal(r.output.records.length,1);assert.equal(r.output.records[0].status,'confirmed');assert.equal(r.output.records[0].oneCCheckKey,'acquiring1');
});
for(const outage of ['partial','throw','mapping-failure'])test(`peer outage preserves unrelated native fiscal proof: ${outage}`,async t=>{
 const f=setup(t),nativeAmount=150000;
 if(outage==='mapping-failure')prisma.terminalFiscalMapping.findMany=(async()=>{throw Error('offline');}) as typeof prisma.terminalFiscalMapping.findMany;
 const nativeBank={...f.bank,rrn:'native1500',amountKopecks:nativeAmount};
 const native:OneCCheck={...f.check,sourceRef:'native1',sourceType:'sale_check',dateTime:at,cashRegisterRef:'kkm1',kktRegistrationNumber:'k1',totalKopecks:nativeAmount,electronicKopecks:nativeAmount,fiscalState:'confirmed',fiscalDriveNumber:'native-fn',fiscalDocumentNumber:'635',fiscalSign:'native-fp',acquiringOrder:undefined,acquiringOrderState:undefined,cardPayments:[{...f.check.cardPayments[0],amountKopecks:nativeAmount}],items:[{name:'Accessory',quantity:1,priceKopecks:nativeAmount,sumKopecks:nativeAmount}]};
 const nativeReceipt={...f.receipt,fiscalDriveNumber:'native-fn',fiscalDocumentNumber:'635',fiscalSign:'native-fp',totalKopecks:nativeAmount,electronicKopecks:nativeAmount,items:native.items};
 const r=await runTerminalFiscalHistoricalDryRun({mappingId:'map1',periodFrom:from,periodTo:to,persist:false,includeEvidence:true},{loadTbank:async q=>{if(outage==='throw'&&q.terminalKey==='t2')throw Error('offline');return{complete:q.terminalKey==='t1',checkedAt,data:q.terminalKey==='t1'?[f.bank,nativeBank]:[]};},loadOneC:async()=>({complete:true,checkedAt,data:[f.check,native]}),loadOfd:async q=>({complete:true,checkedAt,data:q.kktRegistrationNumber==='k1'?[f.receipt,nativeReceipt]:[]})});
 assert.ok(r.acquired&&r.output);assert.equal(r.output.records.find(v=>v.amountKopecks===nativeAmount)?.status,'confirmed');assert.equal(r.output.records.find(v=>v.amountKopecks===7290000)?.status,'unavailable');
});
