import test from 'node:test';
import assert from 'node:assert/strict';
import { enrichAcquiringOrders } from '../lib/terminal-fiscal-acquiring-order';
import { normalizeOneCAcquiringOperation } from '../lib/terminal-fiscal-sources';
import { reconcileTerminalFiscalMvp, bankOperationKey, type OneCCheck, type OfdReceipt, type TerminalMapping } from '../lib/terminal-fiscal-matching';
import { buildDailyFiscalReport } from '../lib/terminal-fiscal-daily-report';

const terminal = 'f3942aeb-d5a2-11f0-b07c-002590803daf';
const org = '1c2d6c5c-251f-11ec-ac9f-0025901e48ee';
const period = { fromDate: '2026-10-27', toDate: '2026-10-28' };
function fixture() {
 const check = normalizeOneCAcquiringOperation({ registrar_type:'Эквайринговая операция', registrar:'Эквайринговая операция 00OF-000083 от 27.10.2026 18:31:02', period:'27.10.2026 18:31:02',movement_kind:'Приход',money_type:'Поступление по платежной карте',terminal:{ref:terminal},amount:92500 })!;
 const event:any = { number:'00OF-000083',date:'27.10.2026 18:31:02',terminal_ref:terminal,amount:92500,posted:true,deleted:false,organization_ref:org,document_ref:'doc',partner_ref:'partner',
 direct_links:[{relation:'payment_basis',target_type:'Заказ клиента',match_type:'direct',evidence:'explicit_1c_reference',target_ref:'order'}],
 settlement_evidence:{complete:true,root_fields_complete:true,payment_details_complete:true,errors:[],payment_details:[{amount:92500,payment_basis:{ref:'order'}}]} };
 const order:any = {ok:true,partner_ref:'partner',header:{order_ref:'order',order_number:'00OF-000073',order_date:'2026-10-27T18:29:42+03:00',posted:true,amount:92500,currency:'руб'},line_count:1,lines_truncated:false,lines:[{product_ref:'samsung',product_name:'Смартфон Samsung Galaxy S26 Ultra',characteristic:'12/256 Gb Violet',quantity:1,price:92500,amount:92500,cancelled:false}]};
 const settlement:any = {ok:true,completeness:{complete:true},events:[event],has_more:false};
 const receipt:OfdReceipt = {fiscalDriveNumber:'fn',fiscalDocumentNumber:'632',fiscalSign:'1199568598',kktRegistrationNumber:'kkt',receiptAt:'2026-10-27T15:20:00Z',operationType:1,totalKopecks:9250000,electronicKopecks:9250000,items:[{name:'Смартфон Samsung Galaxy S26 Ultra (12/256 Gb Violet)',quantity:1,priceKopecks:9250000,sumKopecks:9250000,paymentType:1,productType:10}]};
 const bank = {terminalKey:'aqsi',rrn:'92500',transactionDate:'2026-10-27T14:35:00Z',amountKopecks:9250000,type:'Debit' as const};
 const mapping:TerminalMapping={id:'map',terminalKey:'aqsi',oneCAcquiringTerminalRef:terminal,oneCCashRegisterRef:'kkm',kktRegistrationNumber:'kkt',activeFrom:'2026-01-01T00:00:00Z'};
 const calls:string[]=[];
 const read=async(path:string)=>{calls.push(path);return path.startsWith('/sale-settlement-links?')?settlement:order;};
 return {check,event,order,settlement,receipt,bank,mapping,read,calls};
}
const sources={tbank:{complete:true,checkedAt:'2026-10-27T16:00:00Z'},oneC:{complete:true,checkedAt:'2026-10-27T16:00:00Z'},ofd:{complete:true,checkedAt:'2026-10-27T16:00:00Z'}};
function reconcile(f:ReturnType<typeof fixture>, checks:OneCCheck[], receipts=[f.receipt], banks=[f.bank]) {
 return reconcileTerminalFiscalMvp({now:'2026-10-27T16:00:00Z',sources,mappings:[f.mapping],bankOperations:banks,oneCChecks:checks,ofdReceipts:receipts});
}

test('92,500: follows explicit payment basis, compares the full characteristic, and renders one confirmed prepayment',async()=>{
 const f=fixture(), enriched=await enrichAcquiringOrders([f.check],period,f.read);
 assert.equal(enriched.complete,true);assert.equal(enriched.data[0].acquiringOrder?.number,'00OF-000073');
 assert.equal(enriched.data[0].cashier.ref,''); // Order evidence never invents a fiscal cashier.
 assert.ok(f.calls[0].includes('date_to=2026-10-28'));assert.ok(f.calls[1].includes('order_ref=order'));
 const output=reconcile(f,enriched.data);assert.equal(output.records[0].status,'confirmed');assert.ok(output.records[0].ofdReceiptKey);
 const report=buildDailyFiscalReport({from:new Date('2026-10-27T00:00:00+03:00'),to:new Date('2026-10-28T00:00:00+03:00'),parts:[{mapping:f.mapping,bankOperations:[f.bank],oneCChecks:enriched.data,ofdReceipts:[f.receipt],records:output.records,complete:{bank:true,oneC:true,ofd:true}}]});
 assert.equal(report.transactions.length,1);assert.equal(report.transactions[0].message,'Предоплата подтверждена');assert.equal(report.transactions[0].oneC[0].orderNumber,'00OF-000073');assert.equal(report.transactions[0].ofd.length,1);assert.equal(report.unresolved,0);assert.equal(report.status,'balanced');
 assert.equal(report.total.bankKopecks,9250000);assert.equal(report.total.oneCKopecks,9250000);assert.equal(report.total.ofdKopecks,9250000);
});
for(const [name,change] of Object.entries({
 'different model':(f:ReturnType<typeof fixture>)=>{f.receipt.items[0].name=f.receipt.items[0].name.replace('Ultra','Plus');},
 'different memory':(f:ReturnType<typeof fixture>)=>{f.receipt.items[0].name=f.receipt.items[0].name.replace('256','512');},
 'different color':(f:ReturnType<typeof fixture>)=>{f.receipt.items[0].name=f.receipt.items[0].name.replace('Violet','Black');},
 'different quantity':(f:ReturnType<typeof fixture>)=>{f.receipt.items[0].quantity=2;},
 'partial prepayment':(f:ReturnType<typeof fixture>)=>{f.receipt.items[0].paymentType=2;},
 'full settlement instead of prepayment':(f:ReturnType<typeof fixture>)=>{f.receipt.items[0].paymentType=4;},
 'wrong cash register':(f:ReturnType<typeof fixture>)=>{f.receipt.kktRegistrationNumber='other';},
 'refund':(f:ReturnType<typeof fixture>)=>{f.receipt.operationType=2;},
 'next-day receipt':(f:ReturnType<typeof fixture>)=>{f.receipt.receiptAt='2026-10-28T15:20:00Z';},
 'missing item':(f:ReturnType<typeof fixture>)=>{f.receipt.items=[];},
 'wrong electronic amount':(f:ReturnType<typeof fixture>)=>{f.receipt.electronicKopecks--;},
 'empty fiscal identity':(f:ReturnType<typeof fixture>)=>{f.receipt.fiscalSign='';},
})) test(`order prepayment remains unconfirmed: ${name}`,async()=>{const f=fixture(), e=await enrichAcquiringOrders([f.check],period,f.read);change(f);assert.notEqual(reconcile(f,e.data).records[0].status,'confirmed');});

test('same-amount candidate orders never replace a direct link',async()=>{const f=fixture();f.event.candidate_links=f.event.direct_links;f.event.direct_links=[];const e=await enrichAcquiringOrders([f.check],period,f.read);assert.equal(e.data[0].acquiringOrderState,'unlinked');assert.notEqual(reconcile(f,e.data).records[0].status,'confirmed');});
test('multiple payment bases stay ambiguous',async()=>{const f=fixture();f.event.direct_links.push({...f.event.direct_links[0],target_ref:'other'});const e=await enrichAcquiringOrders([f.check],period,f.read);assert.equal(e.data[0].acquiringOrderState,'ambiguous');assert.notEqual(reconcile(f,e.data).records[0].status,'confirmed');});
for(const [name,change] of Object.entries({
 'truncated order':(f:ReturnType<typeof fixture>)=>{f.order.lines_truncated=true;},
 'cancelled item':(f:ReturnType<typeof fixture>)=>{f.order.lines[0].cancelled=true;},
 'wrong order scope':(f:ReturnType<typeof fixture>)=>{f.order.partner_ref='other';},
 'unposted order':(f:ReturnType<typeof fixture>)=>{f.order.header.posted=false;},
 'different currency':(f:ReturnType<typeof fixture>)=>{f.order.header.currency='USD';},
 'unbalanced order':(f:ReturnType<typeof fixture>)=>{f.order.header.amount++;},
 'incomplete payment evidence':(f:ReturnType<typeof fixture>)=>{f.event.settlement_evidence.complete=false;},
 'incomplete page':(f:ReturnType<typeof fixture>)=>{f.settlement.completeness.complete=false;},
 'broken pagination':(f:ReturnType<typeof fixture>)=>{f.settlement.has_more=true;},
})) test(`fails closed on ${name}`,async()=>{const f=fixture();change(f);const e=await enrichAcquiringOrders([f.check],period,f.read);assert.equal(e.complete,false);assert.equal(e.data[0].acquiringOrderState,'unavailable');assert.equal(e.data[0].acquiringOrder,undefined);});
test('order HTTP failure never becomes missing-order evidence',async()=>{const f=fixture();const e=await enrichAcquiringOrders([f.check],period,async()=>{throw new Error('offline');});assert.equal(e.complete,false);});
test('two eligible fiscal receipts stay ambiguous',async()=>{const f=fixture(),e=await enrichAcquiringOrders([f.check],period,f.read);const r=reconcile(f,e.data,[f.receipt,{...f.receipt,fiscalDocumentNumber:'633'}]);assert.equal(r.records[0].reasonCode,'OFD_RECEIPT_DUPLICATE');assert.notEqual(r.records[0].status,'confirmed');});
test('one OFD receipt cannot confirm two acquiring documents or payments',async()=>{const f=fixture(),e=await enrichAcquiringOrders([f.check],period,f.read);const second={...e.data[0],sourceRef:'second',dateTime:'2026-10-27T15:40:00Z'};const banks=[f.bank,{...f.bank,rrn:'second',transactionDate:'2026-10-27T15:00:00Z'}];const r=reconcile(f,[...e.data,second],[f.receipt],banks);assert.ok(r.records.every(v=>v.status!=='confirmed'));});
test('unrelated 600 RUB payment stays unresolved beside the confirmed order prepayment',async()=>{const f=fixture(),e=await enrichAcquiringOrders([f.check],period,f.read);const banks=[f.bank,{...f.bank,rrn:'600',amountKopecks:60000,transactionDate:'2026-10-27T12:20:00Z'}];const r=reconcile(f,e.data,[f.receipt],banks);assert.equal(r.records.find(v=>v.bankOperationKey===bankOperationKey(f.bank))?.status,'confirmed');assert.notEqual(r.records.find(v=>v.amountKopecks===60000)?.status,'confirmed');});

test('a receipt claimed by a native 1C check is never reused for an acquiring order',async()=>{
 const f=fixture(),e=await enrichAcquiringOrders([f.check],period,f.read);
 const native:OneCCheck={...f.check,sourceRef:'native',sourceType:'sale_check',cardPayments:[],cashRegisterRef:'kkm',fiscalState:'confirmed',fiscalDriveNumber:'fn',fiscalDocumentNumber:'632',fiscalSign:'1199568598'};
 const r=reconcile(f,[...e.data,native]);assert.notEqual(r.records[0].status,'confirmed');assert.equal(r.records[0].reasonCode,'ONE_C_CHECK_REUSED');
});
test('complete direct order keeps an incomplete source non-confirmed',async()=>{
 const f=fixture(),e=await enrichAcquiringOrders([f.check],period,f.read);
 const r=reconcileTerminalFiscalMvp({now:'2026-10-27T16:00:00Z',sources:{...sources,oneC:{...sources.oneC,complete:false}},mappings:[f.mapping],bankOperations:[f.bank],oneCChecks:e.data,ofdReceipts:[f.receipt]});
 assert.equal(r.records[0].status,'unavailable');
});
test('settlement pagination reads every page before claiming complete evidence',async()=>{
 const f=fixture();let calls=0;
 const e=await enrichAcquiringOrders([f.check],period,async(path)=>{
  if(path.startsWith('/portal/customer-order?'))return f.order;
  calls++;return calls===1?{...f.settlement,events:[],has_more:true,next_cursor:'page2'}:f.settlement;
 });assert.equal(calls,2);assert.equal(e.complete,true);assert.equal(e.data[0].acquiringOrder?.ref,'order');
});

function case72900() {
 const f=fixture();
 f.check.sourceRef='acquiring-operation:Эквайринговая операция 00OF-000085 от 28.10.2026 12:22:55|2026-10-28T09:22:55.000Z|terminal|7290000';
 f.check.dateTime='2026-10-28T09:22:55.000Z';f.check.totalKopecks=7290000;f.check.electronicKopecks=7290000;f.check.cardPayments[0].amountKopecks=7290000;
 Object.assign(f.event,{number:'00OF-000085',date:'28.10.2026 12:22:55',amount:72900});f.event.settlement_evidence.payment_details[0].amount=72900;
 Object.assign(f.order.header,{order_number:'00OF-000075',order_date:'2026-10-28T12:22:30+03:00',amount:72900});
 Object.assign(f.order.lines[0],{product_name:'Смартфон Samsung Galaxy S26',characteristic:'12/256 Gb Black',price:72900,amount:72900});
 Object.assign(f.bank,{rrn:'72900',transactionDate:'2026-10-28T12:20:53+03:00',amountKopecks:7290000});
 Object.assign(f.receipt,{receiptAt:'2026-10-28T09:14:00Z',fiscalDocumentNumber:'638',totalKopecks:7290000,electronicKopecks:7290000});
 Object.assign(f.receipt.items[0],{name:'Смартфон Samsung Galaxy S26 (12/256 Gb Black)',priceKopecks:7290000,sumKopecks:7290000});
 return f;
}
function reconcileLater(f:ReturnType<typeof fixture>,checks:OneCCheck[],receipts=[f.receipt],banks=[f.bank]){
 return reconcileTerminalFiscalMvp({now:'2026-10-28T18:00:00Z',sources,mappings:[f.mapping],bankOperations:banks,oneCChecks:checks,ofdReceipts:receipts});
}
test('72,900: 6m53s earlier KKT timestamp does not veto a unique order/item proof',async()=>{
 const f=case72900(),e=await enrichAcquiringOrders([f.check],{fromDate:'2026-10-28',toDate:'2026-10-29'},f.read);
 const r=reconcileLater(f,e.data);assert.equal(r.records[0].status,'confirmed');assert.equal(r.records[0].evidence.orderReceiptTimeDifferenceSeconds,-413);
 const report=buildDailyFiscalReport({from:new Date('2026-10-28T00:00:00+03:00'),to:new Date('2026-10-29T00:00:00+03:00'),parts:[{mapping:f.mapping,bankOperations:[f.bank],oneCChecks:e.data,ofdReceipts:[f.receipt],records:r.records,complete:{bank:true,oneC:true,ofd:true}}]});
 assert.equal(report.transactions.length,1);assert.equal(report.transactions[0].status,'matched');assert.equal(report.transactions[0].message,'Предоплата подтверждена');assert.match(report.transactions[0].timeNote??'',/раньше оплаты на 6 мин 53 с/);assert.equal(report.total.bankDifferenceKopecks,0);assert.equal(report.total.fiscalDifferenceKopecks,0);
});
for(const at of ['2026-10-28T03:00:00Z','2026-10-28T15:00:00Z'])test(`same-day order proof survives several hours of KKT time difference: ${at}`,async()=>{
 const f=case72900(),e=await enrichAcquiringOrders([f.check],period,f.read);f.receipt.receiptAt=at;assert.equal(reconcileLater(f,e.data).records[0].status,'confirmed');
});
test('a posted acquiring document dated hours before payment can match by unique order evidence',async()=>{
 const f=case72900();f.check.dateTime='2026-10-28T05:00:00.000Z';f.event.date='28.10.2026 8:00:00';
 const e=await enrichAcquiringOrders([f.check],period,f.read);assert.equal(e.complete,true);assert.equal(reconcileLater(f,e.data).records[0].status,'confirmed');
});
test('a closer timestamp cannot select one of two same-amount order documents',async()=>{
 const f=case72900(),e=await enrichAcquiringOrders([f.check],period,f.read);
 const far={...e.data[0],sourceRef:'other-order-payment',dateTime:'2026-10-28T16:00:00Z',acquiringOrder:{...e.data[0].acquiringOrder!,ref:'other-order'}};
 for(const checks of [[e.data[0],far],[far,e.data[0]]]){
  const r=reconcileLater(f,checks);assert.equal(r.records[0].status,'needs_review');assert.equal(r.records[0].reasonCode,'ONE_C_MULTIPLE_CANDIDATES');
 }
});
test('a close payment and a distant equal payment cannot reuse one order',async()=>{
 const f=case72900(),e=await enrichAcquiringOrders([f.check],period,f.read);
 const banks=[f.bank,{...f.bank,rrn:'second',transactionDate:'2026-10-28T17:00:00Z'}];
 assert.ok(reconcileLater(f,e.data,[f.receipt],banks).records.every(r=>r.status!=='confirmed'));
});
test('equal two-by-two order payments are not paired chronologically',async()=>{
 const f=case72900(),e=await enrichAcquiringOrders([f.check],period,f.read);
 const other={...e.data[0],sourceRef:'other-order-payment',dateTime:'2026-10-28T16:00:00Z',acquiringOrder:{...e.data[0].acquiringOrder!,ref:'other'}};
 const banks=[f.bank,{...f.bank,rrn:'second',transactionDate:'2026-10-28T15:00:00Z'}];
 const receipts=[f.receipt,{...f.receipt,fiscalDocumentNumber:'639',receiptAt:'2026-10-28T15:10:00Z'}];
 for(const checks of [[e.data[0],other],[other,e.data[0]]])for(const bs of [banks,[...banks].reverse()]){
  assert.ok(reconcileLater(f,checks,receipts,bs).records.every(r=>r.status!=='confirmed'));
 }
});
test('same-amount native fiscal proof takes precedence over an order without reusing its receipt',async()=>{
 const f=case72900(),e=await enrichAcquiringOrders([f.check],period,f.read);
 const native:OneCCheck={...e.data[0],sourceRef:'native-sale',sourceType:'sale_check',dateTime:f.bank.transactionDate,cashRegisterRef:'kkm',kktRegistrationNumber:'kkt',fiscalState:'confirmed',fiscalDriveNumber:'fn',fiscalDocumentNumber:'638',fiscalSign:'1199568598',acquiringOrder:undefined,acquiringOrderState:undefined,items:f.receipt.items};
 const r=reconcileLater(f,[...e.data,native]);assert.equal(r.records[0].status,'confirmed');assert.equal(r.records[0].oneCCheckKey,'native-sale');
});
test('an orderless document never acquires the wider item-based matching window',()=>{
 const f=case72900();f.check.acquiringOrderState='unlinked';assert.notEqual(reconcileLater(f,[f.check]).records[0].status,'confirmed');
});
