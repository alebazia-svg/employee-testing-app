import assert from 'node:assert/strict';
import test from 'node:test';
import { reconcileTerminalFiscalMvp, type BankOperation, type OneCCheck, type OfdReceipt, type TerminalFiscalMatchingInput } from '../lib/terminal-fiscal-matching';
const at = (minutes: number) => new Date(Date.parse('2026-10-12T09:00:00Z') + minutes * 60000).toISOString();
const bank = (amount: number, minute = 0, rrn = String(amount)): BankOperation => ({terminalKey:'t',rrn,transactionDate:at(minute),amountKopecks:amount,type:'Debit'});
function check(amount: number, minute: number, id: string, refund = false): OneCCheck {return {sourceRef:id,sourceType:refund?'refund_check':'sale_check',operationType:refund?'refund':'sale',dateTime:at(minute),cashRegisterRef:'c',kktRegistrationNumber:'k',totalKopecks:amount,electronicKopecks:amount,cashier:{ref:'u',name:'Менеджер'},cardPayments:refund?[]:[{lineNumber:'1',amountKopecks:amount,acquiringTerminalRef:'a',referenceNumber:'',authorizationCode:'',terminalReceiptNumber:''}],items:[{name:refund?'old':id,quantity:1,priceKopecks:amount,sumKopecks:amount}],fiscalState:'confirmed',fiscalStateMeaning:'data_state_only',fiscalDriveNumber:'fn',fiscalDocumentNumber:id,fiscalSign:id};}
function input(banks: BankOperation[], checks: OneCCheck[]): TerminalFiscalMatchingInput {return {now:at(600),sources:Object.fromEntries(['tbank','oneC','ofd'].map(s=>[s,{complete:true,checkedAt:at(600)}])) as TerminalFiscalMatchingInput['sources'],mappings:[{id:'m',terminalKey:'t',oneCAcquiringTerminalRef:'a',oneCCashRegisterRef:'c',kktRegistrationNumber:'k',activeFrom:at(-600)}],bankOperations:banks,oneCChecks:checks,ofdReceipts:checks.map(c=>({fiscalDriveNumber:'fn',fiscalDocumentNumber:c.fiscalDocumentNumber!,fiscalSign:c.fiscalSign!,operationType:c.operationType==='refund'?2:1,receiptAt:c.dateTime,kktRegistrationNumber:'k',totalKopecks:c.totalKopecks,electronicKopecks:c.electronicKopecks,items:c.items} satisfies OfdReceipt))};}
test('recognizes separate fiscal receipts without falsely confirming a bank link',()=>{const i=input([bank(260000)],[check(250000,1,'a'),check(10000,16,'b')]);const r=reconcileTerminalFiscalMvp(i).records[0];assert.equal(r.reasonCode,'ONE_C_SPLIT_RECEIPTS_REVIEW');assert.equal(r.status,'needs_review');assert.equal(r.oneCCheckKey,undefined);assert.equal(r.history.at(-1)?.reasonCode,r.reasonCode);});
test('recognizes two payments for one delayed receipt without assigning it twice',()=>{const r=reconcileTerminalFiscalMvp(input([bank(200000),bank(50000,3)],[check(250000,145,'sum')])).records;assert.ok(r.every(r=>r.reasonCode==='ONE_C_COMBINED_PAYMENTS_REVIEW'&&!r.oneCCheckKey));});
test('recognizes exchange delta and keeps the original matched payment',()=>{const old=check(50000,1,'old');const refund=check(50000,11,'return',true);const i=input([bank(50000),bank(70000,5)],[old,check(120000,10,'new'),refund]);const r=reconcileTerminalFiscalMvp(i).records;assert.equal(r[0].status,'confirmed');assert.equal(r[1].reasonCode,'ONE_C_EXCHANGE_REVIEW');assert.equal(r[1].oneCCheckKey,undefined);});
test('never infers chains with incomplete sources, missing fiscal proof, wrong goods or reused parts',()=>{const base=input([bank(260000)],[check(250000,1,'a'),check(10000,16,'b')]);for(const change of ['source','ofd','items','reuse','kkm','outside']){const i=structuredClone(base);if(change==='source')i.sources.tbank.complete=false;if(change==='ofd')i.ofdReceipts.pop();if(change==='items')i.ofdReceipts[0].items=[{...i.ofdReceipts[0].items[0],name:'different'}];if(change==='reuse')i.bankOperations.push(bank(250000,1));if(change==='kkm')i.oneCChecks[0].cashRegisterRef='other';if(change==='outside')i.oneCChecks[1].dateTime=at(181);assert.notEqual(reconcileTerminalFiscalMvp(i).records[0].reasonCode,'ONE_C_SPLIT_RECEIPTS_REVIEW',change);}});
test('does not infer an exchange when a bank refund was paid',()=>{const old=check(50000,1,'old');const refund=check(50000,11,'r',true);const i=input([bank(50000),bank(70000,5),{...bank(50000,11,'refund'),type:'Credit'}],[old,check(120000,10,'new'),refund]);assert.notEqual(reconcileTerminalFiscalMvp(i).records[1].reasonCode,'ONE_C_EXCHANGE_REVIEW');});

test('recognizes shortened OFD item labels within a grouped receipt without losing quantity and price checks',()=>{
 const c=check(250000,145,'sum');c.items=[{name:'Защитная пленка Leather with design Кожа',quantity:1,priceKopecks:250000,sumKopecks:250000}];
 const i=input([bank(200000),bank(50000,3)],[c]);i.ofdReceipts[0].items=[{...c.items[0],name:'Защитная Leather with design (шт)'}];
 assert.equal(reconcileTerminalFiscalMvp(i).records[0].reasonCode,'ONE_C_COMBINED_PAYMENTS_REVIEW');
 i.ofdReceipts[0].items[0].quantity=2;
 assert.notEqual(reconcileTerminalFiscalMvp(i).records[0].reasonCode,'ONE_C_COMBINED_PAYMENTS_REVIEW');
});

test('does not count duplicate fiscal identities as two constituent receipts',()=>{
 const a=check(10000,1,'a');const duplicate={...a,sourceRef:'duplicate'};
 const i=input([bank(20000)],[a,duplicate]);i.ofdReceipts=[i.ofdReceipts[0]];
 assert.notEqual(reconcileTerminalFiscalMvp(i).records[0].reasonCode,'ONE_C_SPLIT_RECEIPTS_REVIEW');
});
