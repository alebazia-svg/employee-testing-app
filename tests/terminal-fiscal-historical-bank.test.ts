import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { loadHistoricalCabinetEvidence, loadTBankCabinetOperations } from '../lib/tbank-cabinet-snapshot';

test('restores only a historical snapshot tied to an existing review, never as a fresh live source',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'fiscal-history-'));const path=join(dir,'bank.json');
 try {
 const operation={operationId:'old-op',rrn:'',terminalKey:'t',transactionDate:'2026-09-07T12:54:23+03:00',amountKopecks:150000,type:'Debit',source:'TERM_SBP'};
 const snapshot={version:1,generatedAt:'2026-09-09T09:22:00Z',periodFrom:'2026-09-01T00:00:00Z',periodTo:'2026-09-09T09:24:00Z',complete:true,operations:[operation]};
 await writeFile(path,JSON.stringify(snapshot));
 const hash=createHash('sha256').update('terminal-fiscal:t|cabinet:old-op|2026-09-07T12:54:23+03:00|Debit|150000').digest('hex');
 const input={path,terminalKey:'t',from:'2026-09-07T00:00:00Z',to:'2026-09-15T00:00:00Z',unresolvedHashes:new Set([hash])};
 assert.equal((await loadHistoricalCabinetEvidence(input)).operations.length,1);
 assert.equal((await loadHistoricalCabinetEvidence(input)).coversRequestedPeriod,false);
 assert.equal((await loadHistoricalCabinetEvidence({...input,to:'2026-09-08T00:00:00Z'})).coversRequestedPeriod,true);
 assert.equal((await loadHistoricalCabinetEvidence({...input,unresolvedHashes:new Set(['unknown'])})).operations.length,0);
 assert.equal((await loadHistoricalCabinetEvidence({...input,terminalKey:'other'})).operations.length,0);
 assert.equal((await loadTBankCabinetOperations({...input,now:new Date('2026-10-19T00:00:00Z')})).complete,false);
 await writeFile(path,JSON.stringify({...snapshot,complete:false}));assert.deepEqual((await loadHistoricalCabinetEvidence(input)).operations,[]);
 await writeFile(path,'invalid');assert.deepEqual((await loadHistoricalCabinetEvidence(input)).operations,[]);
 } finally { await rm(dir,{recursive:true,force:true}); }
});
