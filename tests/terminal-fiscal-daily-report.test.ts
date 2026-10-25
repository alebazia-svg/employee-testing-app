import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDailyFiscalReport, type DailyFiscalEvidence } from '../lib/terminal-fiscal-daily-report';
import type { OneCCheck, BankOperation, MatchingAuditRecord, OfdReceipt } from '../lib/terminal-fiscal-matching';
const at='2026-10-12T09:00:00Z';
function evidence():DailyFiscalEvidence {
 const check:OneCCheck={sourceRef:'c',sourceType:'sale_check',operationType:'sale',dateTime:at,cashRegisterRef:'kkm',kktRegistrationNumber:'k',totalKopecks:10000,electronicKopecks:10000,cashier:{ref:'magomed',name:'Магомед'},cardPayments:[],items:[],fiscalState:'confirmed',fiscalStateMeaning:'data_state_only',fiscalDriveNumber:'fn',fiscalDocumentNumber:'fd',fiscalSign:'fp'};
 const bank:BankOperation={terminalKey:'t',rrn:'r',transactionDate:at,amountKopecks:10000,type:'Debit'};
 const receipt:OfdReceipt={fiscalDriveNumber:'fn',fiscalDocumentNumber:'fd',fiscalSign:'fp',receiptAt:at,kktRegistrationNumber:'k',operationType:1,totalKopecks:10000,electronicKopecks:10000,items:[]};
 const record={status:'confirmed',reasonCode:'MATCH_CONFIRMED',sourceCompleteness:{tbank:true,oneC:true,ofd:true},bankOperationKey:'t|r|2026-10-12T09:00:00Z|Debit|10000',oneCCheckKey:'c'} as MatchingAuditRecord;
 return {bankOperations:[bank],oneCChecks:[check],ofdReceipts:[receipt],records:[record],complete:{bank:true,oneC:true,ofd:true}};
}
const report=(parts:DailyFiscalEvidence[])=>buildDailyFiscalReport({from:new Date('2026-10-12T00:00:00+03:00'),to:new Date('2026-10-13T00:00:00+03:00'),parts});
test('attributes by actual 1C cashier and totals each source once across overlapping snapshots',()=>{
 const p=evidence();const r=report([p,structuredClone(p)]);assert.equal(r.rows[0].name,'Магомед');assert.equal(r.total.bankKopecks,10000);assert.equal(r.total.oneCKopecks,10000);assert.equal(r.total.ofdKopecks,10000);assert.equal(r.status,'balanced');
});
test('same manager on a second workplace remains one person without moving sales to the home user',()=>{
 const a=evidence(),b=evidence();b.bankOperations[0].terminalKey='other';b.oneCChecks[0]={...b.oneCChecks[0],sourceRef:'c2',cashRegisterRef:'kkm2',kktRegistrationNumber:'k2',fiscalDocumentNumber:'fd2'};b.ofdReceipts[0]={...b.ofdReceipts[0],kktRegistrationNumber:'k2',fiscalDocumentNumber:'fd2'};b.records[0]={...b.records[0],bankOperationKey:'other|r|2026-10-12T09:00:00Z|Debit|10000',oneCCheckKey:'c2'};
 const r=report([a,b]);assert.equal(r.rows.length,1);assert.equal(r.rows[0].name,'Магомед');assert.equal(r.total.bankKopecks,20000);assert.equal(r.status,'balanced');
});
test('subtracts refunds consistently in all three sources',()=>{
 const p=evidence();p.bankOperations[0].type='Credit';p.oneCChecks[0].sourceType='refund_check';p.oneCChecks[0].operationType='refund';p.ofdReceipts[0].operationType=2;p.records[0].bankOperationKey='t|r|2026-10-12T09:00:00Z|Credit|10000';
 const r=report([p]);assert.equal(r.total.bankKopecks,-10000);assert.equal(r.total.oneCKopecks,-10000);assert.equal(r.total.ofdKopecks,-10000);assert.equal(r.status,'balanced');
});
test('complete fiscal day coverage is reported without changing the underlying audit assignment',()=>{const p=evidence();p.records[0].status='needs_review';p.records[0].reasonCode='ONE_C_CANDIDATE_NOT_FOUND';const r=report([p]);assert.equal(r.status,'balanced');assert.equal(r.unresolved,0);assert.equal(r.rows[0].name,'Магомед');assert.equal(r.rows[0].bankKopecks,10000);assert.equal(r.total.bankDifferenceKopecks,0);assert.equal(p.records[0].status,'needs_review');assert.equal(r.transactions[0].status,'covered');});
test('keeps late documents on their actual day and exposes the linked amount separately',()=>{const p=evidence();p.oneCChecks[0].dateTime='2026-10-13T09:00:00Z';p.ofdReceipts[0].receiptAt='2026-10-13T09:00:00Z';const r=report([p]);assert.equal(r.lateLinkedKopecks,10000);assert.equal(r.total.oneCKopecks,0);assert.equal(r.total.ofdKopecks,0);assert.equal(r.status,'difference');});
test('does not double count unlinked acquiring documents or claim a complete 1C total',()=>{const p=evidence();p.oneCChecks.push({...p.oneCChecks[0],sourceRef:'acq',sourceType:'acquiring_operation'});const r=report([p]);assert.equal(r.total.oneCKopecks,10000);assert.equal(r.unlinkedAcquiringKopecks,10000);assert.equal(r.complete.oneC,false);assert.equal(r.status,'incomplete');});
test('includes a uniquely matched standalone acquiring document once, without inventing a cashier',()=>{const p=evidence();p.oneCChecks[0]={...p.oneCChecks[0],sourceType:'acquiring_operation',cashier:{ref:'',name:''}};const r=report([p]);assert.equal(r.total.oneCKopecks,10000);assert.equal(r.unlinkedAcquiringCount,0);assert.equal(r.rows.find(r=>r.key==='unassigned')?.bankKopecks,10000);});
test('missing sources and unknown operation types never look like a verified zero day',()=>{assert.equal(report([]).status,'incomplete');const p=evidence();p.complete.ofd=false;assert.equal(report([p]).status,'incomplete');p.bankOperations[0].type='Other';assert.equal(report([p]).complete.bank,false);});

test('counts a unique posted acquiring document while OFD remains unresolved',()=>{
 const p=evidence();p.oneCChecks[0]={...p.oneCChecks[0],sourceType:'acquiring_operation',cashier:{ref:'',name:''}};
 p.records[0].status='needs_review';p.records[0].reasonCode='OFD_RECEIPT_NOT_FOUND';p.ofdReceipts=[];
 const r=report([p]);assert.equal(r.total.oneCKopecks,10000);assert.equal(r.complete.oneC,true);assert.equal(r.unresolved,1);assert.equal(r.status,'difference');
});


test('OFD candidate with complete day coverage preserves totals and does not invent an exact match',()=>{
 const p=evidence();p.records[0].status='needs_review';p.records[0].reasonCode='OFD_CANDIDATE_REQUIRES_LINK';delete p.records[0].oneCCheckKey;
 const r=report([p]);assert.equal(r.total.bankKopecks,10000);assert.equal(r.total.oneCKopecks,10000);assert.equal(r.total.ofdKopecks,10000);
 assert.equal(r.status,'balanced');assert.equal(r.transactions[0].status,'covered');assert.equal(r.unresolved,0);
 assert.equal(p.records[0].status,'needs_review');
 p.oneCChecks=[];const missing=report([p]);assert.equal(missing.status,'difference');assert.equal(missing.unresolved,1);
 assert.ok(missing.transactions.some(t=>t.status==='review'&&t.message==='Проверить связь с ОФД'));
 p.complete.ofd=false;assert.equal(report([p]).status,'incomplete');
});
