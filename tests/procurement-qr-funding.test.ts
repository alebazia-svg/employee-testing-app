import test from 'node:test';
import assert from 'node:assert/strict';
import {matchQrFunding,qrMovementTime,type QrFundingPlan} from '../lib/procurement-qr-funding';
import {qrPaymentStage,needsProcurementReceipt,hasConfirmedReceiptPayment} from '../lib/procurement-receipt-policy';
import {paymentListRemainder} from '../lib/procurement-list-amount';
const plan:QrFundingPlan={id:'a',planCode:'PAY-20261020-123456',supplierPartner:'USB Mag',supplierCounterparty:'',plannedAmount:42200,paymentMethod:'ACCOUNTABLE_QR',status:'APPROVED',createdAt:'2026-10-20T08:00:00Z'};
const out={account_ref:'owner',transfer_account:{ref:'buyer'},linked_document:{},document:{ref:'out',number:'123'},incoming:0,outgoing:42200,flow_class:'internal_transfer',metadata_available:true,currency_group:'cash',period:'21.10.2026 12:00:00',comment:'qr usbmag'};
const inc={...out,account_ref:'buyer',transfer_account:{ref:'owner'},linked_document:{ref:'out'},document:{ref:'in',number:'124'},incoming:42200,outgoing:0,comment:''};
const payload={ok:true,endpoint:'money-statement',money_type:'cash',date_from:'2026-10-01',date_to:'2026-10-22',complete:true,truncated:false,movements:[out,inc]};
const match=(plans=[plan],p:any=payload)=>matchQrFunding(plans,p,'buyer','2026-10-01','2026-10-22','2026-10-22T12:00:00Z');
test('exact QR supplier label and verified expense/receipt pair annotate funding only',()=>{
 const before=JSON.stringify([plan,payload]);const f=match().get('a')!;
 assert.equal(f.state,'confirmed');assert.equal(f.amount,42200);assert.equal(f.match,'supplier');
 assert.equal(JSON.stringify([plan,payload]),before);
 const p={...plan,plannedDate:'2026-10-25',evidence:{state:'NO_EVIDENCE',verification:'current',issuedAmount:0,paidAmount:0,paidForeignAmount:0,qrFunding:f}};
 assert.equal(qrPaymentStage(p,0),'Ожидает чека');assert.equal(needsProcurementReceipt(p,0,'2026-10-22'),true);
 assert.equal(qrPaymentStage(p,1),'Ожидает расходника');assert.equal(needsProcurementReceipt(p,1,'2026-10-22'),false);
 assert.equal(hasConfirmedReceiptPayment(p),false);assert.equal(qrPaymentStage(p,null),'');
 assert.equal(qrPaymentStage({...p,evidence:{...p.evidence,state:'ISSUED_BY_ONE_C',issuedAmount:42200}},1),'');
});
test('ambiguity, cancelled ownership and duplicate transfers never guess',()=>{
 for(const other of [{...plan,id:'b',planCode:'PAY-20261020-654321'}, {...plan,id:'b',status:'CANCELLED'}, {...plan,id:'b',paymentMethod:'BANK'}])assert.equal(match([plan,other]).get('a')!.state,'none');
 assert.equal(match([plan],{...payload,movements:[out,inc,out]}).get('a')!.state,'none');
 const second=[{...out,document:{ref:'out2'},linked_document:{ref:'in2'}},{...inc,document:{ref:'in2'},linked_document:{ref:'out2'}}];
 assert.equal(match([plan],{...payload,movements:[out,inc,...second]}).get('a')!.state,'none');
});
test('explicit unique plan code disambiguates but never overrides amount/account/status guards',()=>{
 const p={...payload,movements:[{...out,comment:'QR, USB Mag, PAY-20261020-123456'},inc]};
 assert.equal(match([plan,{...plan,id:'b',planCode:'PAY-20261020-654321'}],p).get('a')!.match,'code');
 for(const patch of [{plannedAmount:40000},{status:'SUBMITTED'},{hasPendingRevision:true},{paymentMethod:'USDT'},{createdAt:'2026-10-22T00:00:00Z'}])assert.notEqual(match([{...plan,...patch}],p).get('a')!.state,'confirmed');
 for(const comment of ['USB Mag','QR другой','qr usbmag дополнительная оплата','QR PAY-20261020-999999','QR PAY-20261020-123456 PAY-20261020-654321'])assert.equal(match([plan],{...p,movements:[{...out,comment},inc]}).get('a')!.state,'none');
});
test('incomplete source, bad pair, reversal and mismatched account cannot fund a request',()=>{
 for(const patch of [{complete:false},{truncated:true},{ok:false},{money_type:'bank'},{date_from:'2026-10-02'}])assert.equal(match([plan],{...payload,...patch}).get('a')!.state,'unavailable');
 for(const patch of [{transfer_account:{ref:'other'}},{linked_document:{ref:'other'}},{outgoing:42000},{metadata_available:false},{flow_class:'supplier_payment'},{currency_group:'usdt'},{incoming:5},{period:'bad'}])assert.equal(match([plan],{...payload,movements:[{...out,...patch},inc]}).get('a')!.state,'none');
 assert.equal(match([plan],{...payload,movements:[]}).get('a')!.state,'none');
 assert.equal(match([plan],{...payload,movements:[inc]}).get('a')!.state,'none');
 assert.equal(match([{...plan,createdAt:'2026-09-01'}],{...payload,movements:[]}).get('a')!.state,'unavailable');
});
test('financial problems and other payment methods take precedence over QR stage',()=>{
 for(const state of ['MISMATCH','NEEDS_REVIEW','SOURCE_UNAVAILABLE'])assert.equal(qrPaymentStage({...plan,evidence:{state,qrFunding:match().get('a')}},1),'');
 for(const paymentMethod of ['BANK','USDT','CNY','CASH'])assert.equal(qrPaymentStage({...plan,paymentMethod,evidence:{state:'NO_EVIDENCE',qrFunding:match().get('a')}},1),'');
});
test('list remainder stays in the request currency and never invents USDT from RUB',()=>{
 const p={plannedAmount:100000,foreignAmount:1000,paymentMethod:'USDT',evidence:{state:'PARTIALLY_PAID_BY_ONE_C',remainingAmount:70000,remainingForeignAmount:700}};
 assert.equal(paymentListRemainder(p),'Доплатить 700 USDT');
 assert.equal(paymentListRemainder({...p,evidence:{...p.evidence,remainingForeignAmount:null}}),null);
 assert.equal(paymentListRemainder({...p,paymentMethod:'CASH'}),'Доплатить 70 000 ₽');
});

// Native 1C strings use a single hour digit from midnight through 09:59.
// Keep exact Moscow time: Date.parse on DD.MM is either invalid or ambiguous.
test('1C single-digit hours preserve the instant and confirm only the existing exact transfer pair',()=>{
 assert.equal(qrMovementTime('17.11.2026 0:41:16'),Date.parse('2026-11-16T21:41:16Z'));
 for(const hour of [0,1,9,10,23]){
  const h=String(hour).padStart(2,'0');
  assert.equal(qrMovementTime(`21.10.2026 ${hour}:41:16`),Date.parse(`2026-10-21T${h}:41:16+03:00`));
  assert.equal(qrMovementTime(`21.10.2026 ${h}:41:16`),Date.parse(`2026-10-21T${h}:41:16+03:00`));
 }
 const source={...payload,movements:[{...out,period:'21.10.2026 0:41:16'},{...inc,period:'21.10.2026 0:41:22'}]};
 const before=JSON.stringify(source),funding=match([plan],source).get(plan.id)!;
 assert.equal(funding.state,'confirmed');assert.equal(funding.amount,42200);
 assert.equal(JSON.stringify(source),before,'source documents and their identities remain untouched');
 const view={...plan,evidence:{state:'NO_EVIDENCE',verification:'current',issuedAmount:0,paidAmount:0,paidForeignAmount:0,qrFunding:funding}};
 assert.equal(qrPaymentStage(view,0),'Ожидает чека');assert.equal(hasConfirmedReceiptPayment(view),false);
 assert.equal(qrPaymentStage(view,1),'Ожидает расходника');
 assert.equal(match([{...plan,createdAt:'2026-10-21T00:00:00Z'}],source).get(plan.id)!.state,'none','an earlier transfer never funds a newly created request');
 const incomplete={...source,movements:[source.movements[0]]};
 assert.equal(match([plan],incomplete).get(plan.id)!.state,'none');
 const cancelled={...plan,status:'CANCELLED'};
 assert.equal(match([plan,cancelled],source).get(plan.id)!.state,'none','cancelled ownership still prevents reassignment');
});

test('a destructive action waits for review of a competing QR transfer', () => {
 const candidates=[plan,{...plan,id:'other',planCode:'PAY-20261020-234567'}];
 const guarded=matchQrFunding(candidates,payload,'buyer',payload.date_from,payload.date_to,'2026-10-22T12:00:00Z',plan.id);
 assert.equal(guarded.get(plan.id)?.state,'unavailable');
 assert.equal(guarded.get('other')?.state,'none');
 assert.equal(match(candidates).get(plan.id)?.state,'none');
});

test('V12 transfer within both limits advances the QR stage only for a unique match', () => {
 const v12 = {...plan, supplierPartner: 'В12', plannedAmount: 113000};
 const movements = [{...out, comment: 'qr в12', outgoing: 112700}, {...inc, incoming: 112700}];
 const source = {...payload, movements};
 const funding = match([v12], source).get(v12.id);
 assert.equal(funding?.amount, 112700);
 const view = {...v12, evidence: {state:'NO_EVIDENCE', verification:'current', qrFunding:funding}};
 assert.equal(qrPaymentStage(view, 0), 'Ожидает чека');
 assert.equal(qrPaymentStage(view, 0, false), 'Нужен чек');
 assert.equal(qrPaymentStage(view, 1, false), 'Чек добавлен');
 assert.equal(match([v12, {...v12, id:'b', plannedAmount:112700}], source).get(v12.id)?.state, 'none');
 for (const plannedAmount of [113201, 114000]) {
  assert.equal(match([{...v12, plannedAmount}], source).get(v12.id)?.state, 'none');
 }
 const small = {...source, movements:[{...movements[0], outgoing:9700}, {...movements[1], incoming:9700}]};
 assert.equal(match([{...v12, plannedAmount:10000}], small).get(v12.id)?.state, 'none');
});
