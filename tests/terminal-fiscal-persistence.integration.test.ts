import assert from 'node:assert/strict';
import test from 'node:test';
import { PrismaClient } from '@prisma/client';
import {
  acquireTerminalFiscalRunLease,
  persistTerminalFiscalCycle,
  terminalFiscalCycleKey,
  terminalFiscalRunKey,
} from '../lib/terminal-fiscal-persistence';
import type { TerminalFiscalMatchingOutput } from '../lib/terminal-fiscal-matching';
import { runTerminalFiscalHistoricalDryRun } from '../lib/terminal-fiscal-runner';
import { getTerminalFiscalAuditSummary } from '../lib/terminal-fiscal-summary';

const prisma = new PrismaClient();
const marker = `test-${Date.now()}`;
let persistedMappingId = '';
const persistedPeriodFrom = new Date('2026-08-10T06:00:00.000Z');
const persistedPeriodTo = new Date('2026-08-10T07:00:00.000Z');

test.after(async () => {
  const mappings = await prisma.terminalFiscalMapping.findMany({ where: { label: marker }, select: { id: true } });
  const mappingIds = mappings.map(({ id }) => id);
  const runs = await prisma.terminalFiscalMatchRun.findMany({ where: { mappingId: { in: mappingIds } }, select: { id: true } });
  const runIds = runs.map(({ id }) => id);
  await prisma.terminalFiscalMatchEvaluation.deleteMany({ where: { runId: { in: runIds } } });
  await prisma.terminalFiscalMatch.deleteMany({ where: { mappingId: { in: mappingIds } } });
  await prisma.terminalFiscalMatchRun.deleteMany({ where: { id: { in: runIds } } });
  await prisma.terminalFiscalMapping.deleteMany({ where: { label: marker } });
  await prisma.$disconnect();
});

test('database lease is exclusive, expirable and cycle persistence is idempotent', async () => {
  const mapping = await prisma.terminalFiscalMapping.create({
    data: {
      label: marker,
      terminalKey: `${marker}-terminal`,
      oneCAcquiringTerminalRef: `${marker}-acquiring`,
      oneCCashRegisterRef: `${marker}-cash`,
      kktRegistrationNumber: `${marker}-kkt`,
      effectiveFrom: new Date('2026-08-10T00:00:00.000Z'),
    },
  });
  persistedMappingId = mapping.id;
  const periodFrom = persistedPeriodFrom;
  const periodTo = persistedPeriodTo;
  const leaseInput = { algorithmVersion: 'mvp-1', mappingId: mapping.id, periodFrom, periodTo };
  const [first, second] = await Promise.all([
    acquireTerminalFiscalRunLease(prisma, leaseInput),
    acquireTerminalFiscalRunLease(prisma, leaseInput),
  ]);
  const winner = first ?? second;
  assert.ok(winner);
  assert.equal([first, second].filter(Boolean).length, 1);
  assert.equal(winner.runKey, terminalFiscalRunKey(leaseInput));

  const checkedAt = { tbank: '2026-08-10T08:00:00.000Z', oneC: '2026-08-10T08:00:01.000Z', ofd: '2026-08-10T08:00:02.000Z' };
  const cycleKey = terminalFiscalCycleKey({ runKey: winner.runKey, sourceIdentityHashes: ['a', 'b'], evaluationIdentityHashes: ['confirmed'] });
  const evaluatedAt = '2026-08-10T08:00:03.000Z';
  const output: TerminalFiscalMatchingOutput = {
    version: 'mvp-1',
    evaluatedAt,
    records: [{
      matchingKey: `${marker}-match`, version: 'mvp-1', status: 'confirmed', reasonCode: 'MATCH_CONFIRMED',
      evaluatedAt, graceUntil: '2026-08-10T09:00:00.000Z', mappingId: mapping.id,
      bankOperationKey: `${marker}-bank`, oneCCheckKey: `${marker}-check`, ofdReceiptKey: `${marker}-ofd`,
      oneCCashierRef: `${marker}-cashier`, oneCCashierName: 'Тестовый кассир',
      operationType: 'sale', amountKopecks: 100, timeDifferenceSeconds: 5, candidateCount: 1,
      evidence: { bankTransactionDate: evaluatedAt }, sourceCheckedAt: checkedAt,
      sourceCompleteness: { tbank: true, oneC: true, ofd: true },
      history: [{ at: evaluatedAt, status: 'confirmed', reasonCode: 'MATCH_CONFIRMED' }],
    }],
  };
  const persisted = await persistTerminalFiscalCycle(prisma, {
    lease: winner,
    cycleKey,
    output,
    sourceCheckedAt: checkedAt,
    sourceCompleteness: { tbank: true, oneC: true, ofd: true },
  });
  assert.deepEqual(persisted, { evaluationsCreated: 1, records: 1 });

  const retryLease = await acquireTerminalFiscalRunLease(prisma, leaseInput);
  assert.ok(retryLease);
  const retried = await persistTerminalFiscalCycle(prisma, {
    lease: retryLease,
    cycleKey,
    output,
    sourceCheckedAt: checkedAt,
    sourceCompleteness: { tbank: true, oneC: true, ofd: true },
  });
  assert.deepEqual(retried, { evaluationsCreated: 0, records: 1 });
  assert.equal(await prisma.terminalFiscalMatch.count({ where: { mappingId: mapping.id } }), 1);
  assert.equal(await prisma.terminalFiscalMatchEvaluation.count({ where: { runId: winner.runId } }), 1);
  const persistedMatch = await prisma.terminalFiscalMatch.findFirstOrThrow({ where: { mappingId: mapping.id } });
  const persistedEvaluation = await prisma.terminalFiscalMatchEvaluation.findFirstOrThrow({ where: { runId: winner.runId } });
  assert.equal(persistedMatch.bankOperationAt?.toISOString(), evaluatedAt);
  assert.equal(persistedEvaluation.bankOperationAt?.toISOString(), evaluatedAt);
  assert.equal(persistedMatch.oneCCashierRef, `${marker}-cashier`);
  assert.equal(persistedEvaluation.oneCCashierRef, `${marker}-cashier`);

  const held = await acquireTerminalFiscalRunLease(prisma, leaseInput);
  assert.ok(held);
  assert.equal(await acquireTerminalFiscalRunLease(prisma, leaseInput), null);
  await prisma.terminalFiscalMatchRun.update({ where: { id: held.runId }, data: { leaseUntil: new Date(0) } });
  assert.ok(await acquireTerminalFiscalRunLease(prisma, leaseInput));
});

test('migration contains partial unique assignment guards', async () => {
  const indexes = await prisma.$queryRaw<Array<{ indexname: string }>>`
    SELECT indexname FROM pg_indexes
    WHERE schemaname = current_schema()
      AND indexname IN (
        'TerminalFiscalMatch_active_bank_operation_key',
        'TerminalFiscalMatch_active_one_c_check_key',
        'TerminalFiscalMatch_active_ofd_receipt_key'
      )
  `;
  assert.equal(indexes.length, 3);
});

test('cycle key ignores fetch timestamps but changes when evaluation state changes', () => {
  const common = { runKey: 'run', sourceIdentityHashes: ['source-b', 'source-a'] };
  const first = terminalFiscalCycleKey({ ...common, evaluationIdentityHashes: ['confirmed'] });
  const sameSnapshot = terminalFiscalCycleKey({ runKey: 'run', sourceIdentityHashes: ['source-a', 'source-b'], evaluationIdentityHashes: ['confirmed'] });
  const transitioned = terminalFiscalCycleKey({ ...common, evaluationIdentityHashes: ['needs-review'] });
  assert.equal(first, sameSnapshot);
  assert.notEqual(first, transitioned);
});

test('a corrected source identity reuses the existing audit match without violating assignment guards', async () => {
  const mapping = await prisma.terminalFiscalMapping.create({
    data: {
      label: marker,
      terminalKey: `${marker}-identity-terminal`,
      oneCAcquiringTerminalRef: `${marker}-identity-acquiring`,
      oneCCashRegisterRef: `${marker}-identity-cash`,
      kktRegistrationNumber: `${marker}-identity-kkt`,
      effectiveFrom: new Date('2026-08-10T00:00:00.000Z'),
    },
  });
  const leaseInput = {
    algorithmVersion: 'mvp-1', mappingId: mapping.id,
    periodFrom: new Date('2026-08-10T10:00:00.000Z'), periodTo: new Date('2026-08-10T11:00:00.000Z'),
  };
  const checkedAt = { tbank: '2026-08-10T12:00:00.000Z', oneC: '2026-08-10T12:00:01.000Z', ofd: '2026-08-10T12:00:02.000Z' };
  const makeOutput = (bankOperationKey: string, matchingKey: string, evaluatedAt: string): TerminalFiscalMatchingOutput => ({
    version: 'mvp-1', evaluatedAt,
    records: [{
      matchingKey, version: 'mvp-1', status: 'confirmed', reasonCode: 'MATCH_CONFIRMED', evaluatedAt,
      graceUntil: '2026-08-10T13:00:00.000Z', mappingId: mapping.id, bankOperationKey,
      oneCCheckKey: `${marker}-identity-check`, ofdReceiptKey: `${marker}-identity-ofd`, operationType: 'sale',
      amountKopecks: 100, timeDifferenceSeconds: 5, candidateCount: 1,
      evidence: { bankTransactionDate: evaluatedAt }, sourceCheckedAt: checkedAt,
      sourceCompleteness: { tbank: true, oneC: true, ofd: true },
      history: [{ at: evaluatedAt, status: 'confirmed', reasonCode: 'MATCH_CONFIRMED' }],
    }],
  });
  const firstLease = await acquireTerminalFiscalRunLease(prisma, leaseInput);
  assert.ok(firstLease);
  await persistTerminalFiscalCycle(prisma, {
    lease: firstLease, cycleKey: `${marker}-identity-cycle-1`,
    output: makeOutput(`${marker}-old-bank`, `${marker}-old-match`, '2026-08-10T12:00:03.000Z'),
    sourceCheckedAt: checkedAt, sourceCompleteness: { tbank: true, oneC: true, ofd: true },
  });
  const secondLease = await acquireTerminalFiscalRunLease(prisma, leaseInput);
  assert.ok(secondLease);
  await persistTerminalFiscalCycle(prisma, {
    lease: secondLease, cycleKey: `${marker}-identity-cycle-2`,
    output: makeOutput(`${marker}-corrected-bank`, `${marker}-corrected-match`, '2026-08-10T12:05:03.000Z'),
    sourceCheckedAt: checkedAt, sourceCompleteness: { tbank: true, oneC: true, ofd: true },
  });
  assert.equal(await prisma.terminalFiscalMatch.count({ where: { mappingId: mapping.id } }), 1);
  assert.equal(await prisma.terminalFiscalMatchEvaluation.count({ where: { runId: firstLease.runId } }), 2);
});

test('audit summary reads an existing run without changing any audit table', async () => {
  assert.ok(persistedMappingId);
  const before = await Promise.all([
    prisma.terminalFiscalMapping.count(), prisma.terminalFiscalMatchRun.count(),
    prisma.terminalFiscalMatch.count(), prisma.terminalFiscalMatchEvaluation.count(),
  ]);
  const summary = await getTerminalFiscalAuditSummary({
    mappingId: persistedMappingId,
    periodFrom: persistedPeriodFrom,
    periodTo: persistedPeriodTo,
  });
  assert.ok(summary);
  assert.equal(summary.total, 1);
  assert.equal(summary.statuses.confirmed, 1);
  assert.deepEqual(summary.safety, { employeeVisible: false, incidentCreation: false, notifications: false });
  assert.deepEqual(await Promise.all([
    prisma.terminalFiscalMapping.count(), prisma.terminalFiscalMatchRun.count(),
    prisma.terminalFiscalMatch.count(), prisma.terminalFiscalMatchEvaluation.count(),
  ]), before);
});

test('runner without explicit persist leaves all four audit tables unchanged', async () => {
  const mapping = await prisma.terminalFiscalMapping.create({
    data: {
      label: marker,
      terminalKey: `${marker}-dry-terminal`,
      oneCAcquiringTerminalRef: `${marker}-dry-acquiring`,
      oneCCashRegisterRef: `${marker}-dry-cash`,
      kktRegistrationNumber: `${marker}-dry-kkt`,
      effectiveFrom: new Date('2026-08-10T00:00:00.000Z'),
    },
  });
  const before = await Promise.all([
    prisma.terminalFiscalMapping.count(), prisma.terminalFiscalMatchRun.count(),
    prisma.terminalFiscalMatch.count(), prisma.terminalFiscalMatchEvaluation.count(),
  ]);
  const checkedAt = '2026-08-11T00:00:00.000Z';
  const result = await runTerminalFiscalHistoricalDryRun({
    mappingId: mapping.id,
    periodFrom: new Date('2026-08-10T06:00:00.000Z'),
    periodTo: new Date('2026-08-10T07:00:00.000Z'),
  }, {
    loadTbank: async () => ({ complete: true, checkedAt, data: [] }),
    loadOneC: async () => ({ complete: true, checkedAt, data: [] }),
    loadOfd: async () => ({ complete: true, checkedAt, data: [] }),
  });
  assert.equal(result.acquired, true);
  assert.equal(result.persisted, false);
  assert.deepEqual(await Promise.all([
    prisma.terminalFiscalMapping.count(), prisma.terminalFiscalMatchRun.count(),
    prisma.terminalFiscalMatch.count(), prisma.terminalFiscalMatchEvaluation.count(),
  ]), before);
});

test('historical late reads include later competing payments but report only the selected day', async () => {
  const mapping = await prisma.terminalFiscalMapping.create({data:{label:marker,terminalKey:`${marker}-later`,oneCAcquiringTerminalRef:'late-acq',oneCCashRegisterRef:'late-kkm',kktRegistrationNumber:'late-kkt',effectiveFrom:new Date('2026-08-01T00:00:00Z')}});
  const from=new Date('2026-08-10T00:00:00+03:00'),to=new Date('2026-08-11T00:00:00+03:00');
  const at='2026-08-10T07:00:00.000Z',nextAt='2026-08-11T07:00:00.000Z',checkedAt='2026-08-19T12:00:00.000Z';
  const original={terminalKey:mapping.terminalKey,rrn:'original',transactionDate:at,amountKopecks:150000,type:'Debit' as const};
  const later={...original,rrn:'later',transactionDate:nextAt};
  const items=[{name:'Стекло',quantity:1,priceKopecks:150000,sumKopecks:150000}];
  const check={sourceRef:'later-check',sourceType:'sale_check' as const,operationType:'sale' as const,dateTime:'2026-08-11T07:02:00.000Z',cashRegisterRef:'late-kkm',kktRegistrationNumber:'late-kkt',totalKopecks:150000,electronicKopecks:150000,cashier:{ref:'',name:''},cardPayments:[{lineNumber:'1',amountKopecks:150000,acquiringTerminalRef:'late-acq',referenceNumber:'',authorizationCode:'',terminalReceiptNumber:''}],items,fiscalState:'confirmed' as const,fiscalStateMeaning:'data_state_only' as const,fiscalDriveNumber:'late-fn',fiscalDocumentNumber:'late-fd',fiscalSign:'late-fp'};
  const receipt={fiscalDriveNumber:'late-fn',fiscalDocumentNumber:'late-fd',fiscalSign:'late-fp',operationType:1,receiptAt:check.dateTime,kktRegistrationNumber:'late-kkt',totalKopecks:150000,electronicKopecks:150000,items};
  const before=await prisma.terminalFiscalMatch.count();
  const result=await runTerminalFiscalHistoricalDryRun({mappingId:mapping.id,periodFrom:from,periodTo:to},{
    loadTbank:async query=>{assert.ok(Date.parse(query.to)>to.getTime());return{complete:true,checkedAt,data:[original,later]};},
    loadOneC:async()=>({complete:true,checkedAt,data:[check]}),loadOfd:async()=>({complete:true,checkedAt,data:[receipt]}),
  });
  assert.ok(result.acquired);
  assert.equal(result.summary.total,1);
  assert.equal(result.summary.statuses.confirmed,0);
  assert.equal(result.summary.reasonCodes.ONE_C_CANDIDATE_NOT_FOUND,1);
  const lateCheck={...check,dateTime:'2026-08-12T07:02:00.000Z'};
  const lateResult=await runTerminalFiscalHistoricalDryRun({mappingId:mapping.id,periodFrom:from,periodTo:to},{loadTbank:async()=>({complete:true,checkedAt,data:[original]}),loadOneC:async()=>({complete:true,checkedAt,data:[lateCheck]}),loadOfd:async()=>({complete:true,checkedAt,data:[{...receipt,receiptAt:lateCheck.dateTime}]})});
  assert.ok(lateResult.acquired);
  assert.equal(lateResult.summary.total,1);
  assert.equal(lateResult.summary.statuses.confirmed,1);
  assert.equal(lateResult.summary.reasonCodes.MATCH_CONFIRMED_LATE,1);
  assert.equal(await prisma.terminalFiscalMatch.count(),before);
});

test('runner restores recorded bank evidence but keeps incomplete historical coverage unavailable', async () => {
  const {mkdtemp,writeFile,rm}=await import('node:fs/promises');
  const {tmpdir}=await import('node:os');const {join}=await import('node:path');const {createHash}=await import('node:crypto');
  const directory=await mkdtemp(join(tmpdir(),'fiscal-runner-archive-'));const path=join(directory,'bank.json');
  const previousPath=process.env.TBANK_CABINET_SNAPSHOT_PATH;
  const mapping=await prisma.terminalFiscalMapping.create({data:{label:marker,terminalKey:`${marker}-archive`,oneCAcquiringTerminalRef:'archive-acq',oneCCashRegisterRef:'archive-cash',kktRegistrationNumber:'archive-kkt',effectiveFrom:new Date('2026-08-01T00:00:00Z')}});
  const user=await prisma.user.create({data:{login:`${marker}-archive`,name:'Local archive test',role:'ADMIN',passwordHash:'not-a-login-hash'}});
  try {
    const at='2026-08-10T10:00:00+03:00';
    const hash=createHash('sha256').update(`terminal-fiscal:${mapping.terminalKey}|archived-rrn|${at}|Debit|40000`).digest('hex');
    await prisma.terminalFiscalEmployeeReview.create({data:{reviewKey:`terminal-fiscal-review:${hash}`,matchingHash:hash,mappingId:mapping.id,employeeId:user.id,status:'admin_review',reasonCode:'ONE_C_CANDIDATE_NOT_FOUND',bankOperationAt:new Date(at),amountKopecks:40000,cashierRefHash:'test'}});
    await writeFile(path,JSON.stringify({version:1,generatedAt:'2026-08-10T09:22:00Z',periodFrom:'2026-08-01T00:00:00Z',periodTo:'2026-08-10T09:24:00Z',complete:true,operations:[{operationId:'id',rrn:'archived-rrn',terminalKey:mapping.terminalKey,transactionDate:at,amountKopecks:40000,type:'Debit',source:'TERM_CARD'}]}));
    process.env.TBANK_CABINET_SNAPSHOT_PATH=path;
    const result=await runTerminalFiscalHistoricalDryRun({mappingId:mapping.id,periodFrom:new Date('2026-08-10T00:00:00+03:00'),periodTo:new Date('2026-08-11T00:00:00+03:00'),includeEvidence:true},{loadTbank:async()=>({complete:true,checkedAt:'2026-10-19T00:00:00Z',data:[]}),loadOneC:async()=>({complete:true,checkedAt:'2026-10-19T00:00:00Z',data:[]}),loadOfd:async()=>({complete:true,checkedAt:'2026-10-19T00:00:00Z',data:[]})});
    assert.ok(result.acquired);assert.equal(result.persisted,false);assert.equal(result.output?.records.length,1);
    assert.equal(result.output?.records[0].reasonCode,'SOURCE_TBANK_HISTORICAL_INCOMPLETE');
    assert.equal(await prisma.terminalFiscalMatch.count({where:{mappingId:mapping.id}}),0);
  } finally {
    if(previousPath===undefined)delete process.env.TBANK_CABINET_SNAPSHOT_PATH;else process.env.TBANK_CABINET_SNAPSHOT_PATH=previousPath;
    await prisma.terminalFiscalEmployeeReview.deleteMany({where:{mappingId:mapping.id}});await prisma.user.delete({where:{id:user.id}});await rm(directory,{recursive:true,force:true});
  }
});

test('full coverage cycle persists group proof and retires approved review, legacy issue and queued reminders',async()=>{
 const {approveFiscalReview,fiscalProposedRecipients}=await import('../lib/terminal-fiscal-admin-gate');
 const {terminalFiscalIssueFingerprint}=await import('../lib/terminal-fiscal-workday-control');
 const mapping=await prisma.terminalFiscalMapping.create({data:{label:marker,terminalKey:`${marker}-coverage`,oneCAcquiringTerminalRef:'coverage-acq',oneCCashRegisterRef:'coverage-cash',kktRegistrationNumber:'coverage-kkt',effectiveFrom:new Date('2026-08-01T00:00:00Z')}});
 const admin=await prisma.user.create({data:{login:`${marker}-coverage-admin`,name:'Local coverage admin',role:'ADMIN',passwordHash:'test-only-no-login'}});
 const employee=await prisma.user.create({data:{login:`${marker}-coverage-employee`,name:'Local coverage employee',role:'EMPLOYEE',passwordHash:'test-only-no-login'}});
 const previous=process.env.TERMINAL_FISCAL_EMPLOYEE_REVIEW_ENABLED;process.env.TERMINAL_FISCAL_EMPLOYEE_REVIEW_ENABLED='true';
 try {
  await prisma.workDayEntry.create({data:{userId:employee.id,date:'2026-08-10',department:'retail',shiftCode:'09_18',shiftLabel:'09:00–18:00',startedAt:new Date('2026-08-10T06:00:00Z'),status:'active'}});
  const at='2026-08-10T07:00:00.000Z',checkedAt='2026-10-19T10:00:00.000Z';
  const bank={terminalKey:mapping.terminalKey,rrn:'coverage-payment',transactionDate:at,amountKopecks:260000,type:'Debit' as const};
  const query={mappingId:mapping.id,periodFrom:new Date('2026-08-10T00:00:00+03:00'),periodTo:new Date('2026-08-11T00:00:00+03:00'),persist:true,syncWorkdayControl:true,includeEvidence:true};
  const missing=await runTerminalFiscalHistoricalDryRun(query,{loadTbank:async()=>({complete:true,checkedAt,data:[bank]}),loadOneC:async()=>({complete:true,checkedAt,data:[]}),loadOfd:async()=>({complete:true,checkedAt,data:[]})});
  assert.ok(missing.acquired&&missing.output);const record=missing.output.records[0];
  const review=await prisma.terminalFiscalEmployeeReview.findFirstOrThrow({where:{mappingId:mapping.id}});assert.equal(review.status,'admin_review');
  const proposed=await fiscalProposedRecipients(prisma,new Date(at),mapping.id);
  await approveFiscalReview(prisma,review.id,admin.id,proposed.users.map(u=>u.id),()=> 'Local approved task');
  assert.ok(await prisma.workdayNotification.count({where:{reviewId:review.id,status:'pending'}}));
  const legacy=await prisma.workdayControlIssue.create({data:{userId:employee.id,fingerprint:terminalFiscalIssueFingerprint(record),ruleKey:'terminal_fiscal_mismatch',severity:'error',title:'Local historical issue',detail:'Local test',status:'open',nextReminderAt:new Date()}});
  await prisma.workdayNotification.create({data:{userId:employee.id,issueId:legacy.id,fingerprint:`${marker}-legacy-reminder`,kind:'issue_reminder',title:'Local reminder',body:'test',scheduledAt:new Date()}});
  const checks=[250000,10000].map((amount,i)=>({sourceRef:`${marker}-coverage-c${i}`,sourceType:'sale_check' as const,operationType:'sale' as const,dateTime:`2026-08-10T07:${i?'40':'30'}:00.000Z`,cashRegisterRef:'coverage-cash',kktRegistrationNumber:'coverage-kkt',totalKopecks:amount,electronicKopecks:amount,cashier:{ref:'coverage-user',name:'Local coverage employee'},cardPayments:[{lineNumber:'1',amountKopecks:amount,acquiringTerminalRef:'coverage-acq',referenceNumber:'',authorizationCode:'',terminalReceiptNumber:''}],items:[{name:`Товар ${i}`,quantity:1,priceKopecks:amount,sumKopecks:amount}],fiscalState:'confirmed' as const,fiscalStateMeaning:'data_state_only' as const,fiscalDriveNumber:`${marker}-fn`,fiscalDocumentNumber:`fd${i}`,fiscalSign:`fp${i}`}));
  const dependencies={loadTbank:async()=>({complete:true,checkedAt,data:[bank]}),loadOneC:async()=>({complete:true,checkedAt,data:checks}),loadOfd:async()=>({complete:true,checkedAt,data:checks.map(c=>({fiscalDriveNumber:c.fiscalDriveNumber,fiscalDocumentNumber:c.fiscalDocumentNumber,fiscalSign:c.fiscalSign,operationType:1,receiptAt:c.dateTime,kktRegistrationNumber:c.kktRegistrationNumber,totalKopecks:c.totalKopecks,electronicKopecks:c.electronicKopecks,items:c.items}))})};
  const covered=await runTerminalFiscalHistoricalDryRun(query,dependencies);assert.ok(covered.acquired&&covered.output);assert.equal(covered.output.records[0].reasonCode,'MATCH_AMOUNT_COVERED');
  const match=await prisma.terminalFiscalMatch.findFirstOrThrow({where:{mappingId:mapping.id}});assert.equal(match.status,'confirmed');assert.equal(match.oneCSourceRef,null);assert.equal(match.ofdFiscalKeyHash,null);assert.ok(match.oneCSourceHash);
  const ended=await prisma.terminalFiscalEmployeeReview.findUniqueOrThrow({where:{id:review.id}});assert.equal(ended.status,'resolved');assert.equal(ended.reasonCode,'MATCH_AMOUNT_COVERED');
  assert.equal((await prisma.workdayControlIssue.findUniqueOrThrow({where:{id:legacy.id}})).status,'resolved');
  assert.equal(await prisma.workdayNotification.count({where:{OR:[{reviewId:review.id},{issueId:legacy.id}],status:'pending'}}),0);
  const notificationCount=await prisma.workdayNotification.count({where:{reviewId:review.id}});
  await runTerminalFiscalHistoricalDryRun(query,dependencies);
  assert.equal(await prisma.workdayNotification.count({where:{reviewId:review.id}}),notificationCount);
  assert.equal((await prisma.terminalFiscalEmployeeReview.findUniqueOrThrow({where:{id:review.id}})).resolvedAt?.getTime(),ended.resolvedAt?.getTime());
  await assert.rejects(approveFiscalReview(prisma,review.id,admin.id,proposed.users.map(u=>u.id),()=>''),/REVIEW_NOT_AVAILABLE/);
 }finally {
  if(previous===undefined)delete process.env.TERMINAL_FISCAL_EMPLOYEE_REVIEW_ENABLED;else process.env.TERMINAL_FISCAL_EMPLOYEE_REVIEW_ENABLED=previous;
  const ids=(await prisma.terminalFiscalEmployeeReview.findMany({where:{mappingId:mapping.id},select:{id:true}})).map(r=>r.id);
  await prisma.adminInboxEvent.deleteMany({where:{sourceType:'terminal_fiscal_review',sourceId:{in:ids}}});
  await prisma.terminalFiscalEmployeeReview.deleteMany({where:{mappingId:mapping.id}});
  await prisma.user.deleteMany({where:{id:{in:[admin.id,employee.id]}}});
 }
});

test('standalone acquiring document for 27800 stays an ADMIN question until fiscal proof exists',async()=>{
 const mapping=await prisma.terminalFiscalMapping.create({data:{label:marker,terminalKey:`${marker}-unfiscalized`,oneCAcquiringTerminalRef:'unfiscalized-acq',oneCCashRegisterRef:'unfiscalized-cash',kktRegistrationNumber:'unfiscalized-kkt',effectiveFrom:new Date('2026-08-01T00:00:00Z')}});
 const admin=await prisma.user.create({data:{login:`${marker}-unfiscalized-admin`,name:'Local fiscal gap admin',role:'ADMIN',passwordHash:'test-only'}});
 const previous=process.env.TERMINAL_FISCAL_EMPLOYEE_REVIEW_ENABLED;process.env.TERMINAL_FISCAL_EMPLOYEE_REVIEW_ENABLED='true';
 try{
  const at='2026-08-10T11:26:00.000Z',checkedAt='2026-10-19T10:00:00Z';
  const bank={terminalKey:mapping.terminalKey,rrn:'unfiscalized',transactionDate:at,amountKopecks:2780000,type:'Debit' as const};
  const acquiring={sourceRef:`${marker}-00OF-000080`,sourceType:'acquiring_operation' as const,operationType:'sale' as const,dateTime:'2026-08-10T11:27:00.000Z',cashRegisterRef:'',kktRegistrationNumber:'',totalKopecks:2780000,electronicKopecks:2780000,cashier:{ref:'',name:''},cardPayments:[{lineNumber:'1',amountKopecks:2780000,acquiringTerminalRef:'unfiscalized-acq',referenceNumber:'',authorizationCode:'',terminalReceiptNumber:''}],items:[],fiscalState:'unconfirmed' as const,fiscalStateMeaning:'data_state_only' as const};
  const run=()=>runTerminalFiscalHistoricalDryRun({mappingId:mapping.id,periodFrom:new Date('2026-08-10T00:00:00+03:00'),periodTo:new Date('2026-08-11T00:00:00+03:00'),persist:true,syncWorkdayControl:true,includeEvidence:true},{loadTbank:async()=>({complete:true,checkedAt,data:[bank]}),loadOneC:async()=>({complete:true,checkedAt,data:[acquiring]}),loadOfd:async()=>({complete:true,checkedAt,data:[]})});
  const first=await run();assert.ok(first.acquired&&first.output);assert.notEqual(first.output.records[0].status,'confirmed');assert.equal(first.output.records[0].oneCCheckKey,acquiring.sourceRef);
  const review=await prisma.terminalFiscalEmployeeReview.findFirstOrThrow({where:{mappingId:mapping.id}});assert.equal(review.status,'admin_review');assert.equal(review.amountKopecks,2780000);
  await run();assert.equal((await prisma.terminalFiscalEmployeeReview.findUniqueOrThrow({where:{id:review.id}})).status,'admin_review');
  assert.equal(await prisma.workdayNotification.count({where:{reviewId:review.id}}),0);
 }finally{
  if(previous===undefined)delete process.env.TERMINAL_FISCAL_EMPLOYEE_REVIEW_ENABLED;else process.env.TERMINAL_FISCAL_EMPLOYEE_REVIEW_ENABLED=previous;
  const ids=(await prisma.terminalFiscalEmployeeReview.findMany({where:{mappingId:mapping.id},select:{id:true}})).map(r=>r.id);
  await prisma.adminInboxEvent.deleteMany({where:{sourceType:'terminal_fiscal_review',sourceId:{in:ids}}});await prisma.terminalFiscalEmployeeReview.deleteMany({where:{mappingId:mapping.id}});await prisma.user.delete({where:{id:admin.id}});
 }
});

test('automatic receipt reminder: thirty minutes, no duplicate, nonblocking handover and late resolution',async()=>{
 const {syncTerminalFiscalEmployeeReviews}=await import('../lib/terminal-fiscal-employee-review');
 const {stageFiscalAdminReview}=await import('../lib/terminal-fiscal-admin-gate');
 const {escalateHandoverReceipts}=await import('../lib/terminal-fiscal-handover');
 const {createHash}=await import('node:crypto');
 const day='2026-08-19';
 const at=day+'T09:00:00Z',evaluated=day+'T09:30:00Z';
 const admin=await prisma.user.create({data:{login:marker+'-auto-admin',name:'Local auto admin',role:'ADMIN',passwordHash:'test'}});
 const users=await Promise.all([1,2].map(i=>prisma.user.create({data:{login:marker+'-auto-'+i,name:'Local auto '+i,role:'EMPLOYEE',department:'retail',passwordHash:'test'}})));
 const m=await prisma.terminalFiscalMapping.create({data:{label:marker,terminalKey:marker+'-auto-terminal',oneCAcquiringTerminalRef:marker+'-auto-acq',oneCCashRegisterRef:marker+'-auto-cash',kktRegistrationNumber:marker+'-auto-kkt',effectiveFrom:new Date(day+'T00:00:00Z')}});
 const entries=await Promise.all(users.map(u=>prisma.workDayEntry.create({data:{userId:u.id,date:day,department:'retail',shiftCode:'09_18',shiftLabel:'09–18',startedAt:new Date(day+'T01:00:00Z'),status:'active'}})));
 await prisma.userOneCCashboxMapping.create({data:{userId:users[0].id,oneCCashboxRef:marker+'-auto-box',oneCCashboxName:'Local auto box',oneCCashRegisterRef:m.oneCCashRegisterRef}});
 const mapping={id:m.id,terminalKey:m.terminalKey,oneCAcquiringTerminalRef:m.oneCAcquiringTerminalRef,oneCCashRegisterRef:m.oneCCashRegisterRef,kktRegistrationNumber:m.kktRegistrationNumber,activeFrom:m.effectiveFrom.toISOString()};
 const record:any={matchingKey:marker+'-auto-payment',mappingId:m.id,status:'pending',reasonCode:'ONE_C_CANDIDATE_PENDING',candidateCount:0,operationType:'sale',amountKopecks:90000,evaluatedAt:evaluated,graceUntil:day+'T11:00:00Z',bankOperationKey:marker+'-auto-bank',evidence:{bankTransactionDate:at},sourceCheckedAt:{tbank:evaluated,oneC:evaluated,ofd:evaluated},sourceCompleteness:{tbank:true,oneC:true,ofd:true},history:[]};
 const sync=async(r:any,closingEmployeeId?:number)=>syncTerminalFiscalEmployeeReviews(prisma,{output:{records:[r],evaluatedAt:r.evaluatedAt} as any,mapping,oneCChecks:[],closingEmployeeId});
 const key='terminal-fiscal-review:'+createHash('sha256').update(record.matchingKey).digest('hex');
 try{
  await sync({...record,sourceCheckedAt:{...record.sourceCheckedAt,oneC:day+'T09:29:59Z'}});
  assert.equal(await prisma.terminalFiscalEmployeeReview.count({where:{reviewKey:key}}),0);
  await sync(record);await sync(record);
  const review=await prisma.terminalFiscalEmployeeReview.findUniqueOrThrow({where:{reviewKey:key}});
  assert.equal(review.status,'open');assert.equal(review.employeeId,users[0].id);assert.equal(review.assignmentScope,'workstation_shift');
  assert.equal(await prisma.workdayNotification.count({where:{reviewId:review.id}}),1);
  assert.equal(await prisma.adminInboxEvent.count({where:{sourceId:review.id}}),0);
  const recent={...record,matchingKey:marker+'-auto-recent',evidence:{bankTransactionDate:day+'T09:28:00Z'}};
  await sync(recent,users[0].id);
  assert.equal(await prisma.terminalFiscalEmployeeReview.count({where:{mappingId:m.id,status:'open'}}),2);
  await prisma.workDayEntry.update({where:{id:entries[0].id},data:{status:'completed',endedAt:new Date(evaluated)}});
  await escalateHandoverReceipts(prisma,{userId:users[0].id,date:day,workDayId:entries[0].id});
  await escalateHandoverReceipts(prisma,{userId:users[0].id,date:day,workDayId:entries[0].id});
  assert.equal(await prisma.adminInboxEvent.count({where:{sourceId:review.id}}),1);
  await stageFiscalAdminReview(prisma,record,mapping);
  assert.equal(await prisma.adminInboxEvent.count({where:{sourceId:review.id}}),1);
  assert.equal((await prisma.terminalFiscalEmployeeReview.findUniqueOrThrow({where:{id:review.id}})).status,'open');
  await sync({...record,status:'confirmed',reasonCode:'MATCH_CONFIRMED',oneCCheckKey:'late-check'});
  assert.equal((await prisma.terminalFiscalEmployeeReview.findUniqueOrThrow({where:{id:review.id}})).status,'resolved');
  assert.equal(await prisma.workdayNotification.count({where:{reviewId:review.id,status:'pending'}}),0);
 }finally{
  const reviews=await prisma.terminalFiscalEmployeeReview.findMany({where:{mappingId:m.id},select:{id:true}});const ids=reviews.map(r=>r.id);
  await prisma.adminInboxEvent.deleteMany({where:{sourceId:{in:ids}}});
  await prisma.terminalFiscalEmployeeReview.deleteMany({where:{mappingId:m.id}});
  await prisma.user.deleteMany({where:{id:{in:[admin.id,...users.map(u=>u.id)]}}});
 }
});

test('confirmed snapshot survives repeated source outages, with every failed cycle audited and a full real mismatch still applied', async () => {
 const mapping=await prisma.terminalFiscalMapping.create({data:{label:marker,terminalKey:marker+'-outage',oneCAcquiringTerminalRef:'outage-acq',oneCCashRegisterRef:'outage-kkm',kktRegistrationNumber:'outage-kkt',effectiveFrom:new Date('2026-08-10')}});
 const at='2026-08-10T07:00:00Z';
 const leaseInput={algorithmVersion:'mvp-1',mappingId:mapping.id,periodFrom:new Date('2026-08-10T00:00:00Z'),periodTo:new Date('2026-08-11T00:00:00Z')};
 const complete={tbank:true,oneC:true,ofd:true};
 const base:any={matchingKey:marker+'-outage-match',version:'mvp-1',status:'confirmed',reasonCode:'MATCH_CONFIRMED',evaluatedAt:at,graceUntil:at,mappingId:mapping.id,bankOperationKey:marker+'-outage-bank',oneCCheckKey:marker+'-outage-check',ofdReceiptKey:marker+'-outage-ofd',oneCCashierRef:'outage-cashier',operationType:'sale',amountKopecks:50000,candidateCount:1,timeDifferenceSeconds:3,evidence:{bankTransactionDate:at},sourceCheckedAt:{tbank:at,oneC:at,ofd:at},sourceCompleteness:complete,history:[]};
 const persist=async(record:any,key:string)=>{
  const lease=await acquireTerminalFiscalRunLease(prisma,leaseInput);assert.ok(lease);
  await persistTerminalFiscalCycle(prisma,{lease,cycleKey:marker+key,output:{version:'mvp-1',evaluatedAt:record.evaluatedAt,records:[record]},sourceCheckedAt:record.sourceCheckedAt,sourceCompleteness:record.sourceCompleteness});
 };
 await persist(base,'-outage-initial');
 const before=await prisma.terminalFiscalMatch.findFirstOrThrow({where:{mappingId:mapping.id}});
 for(const [i,reasonCode] of ['SOURCE_OFD_INCOMPLETE','SOURCE_ONE_C_INCOMPLETE','SOURCE_TBANK_INCOMPLETE'].entries()){
  await persist({...base,status:'unavailable',reasonCode,oneCCheckKey:i===0?base.oneCCheckKey:undefined,ofdReceiptKey:undefined,oneCCashierRef:undefined,evaluatedAt:`2026-08-10T07:0${i+1}:00Z`,sourceCompleteness:{tbank:i!==2,oneC:i!==1,ofd:i!==0}},'-outage-'+i);
  assert.deepEqual(await prisma.terminalFiscalMatch.findUnique({where:{id:before.id}}),before);
 }
 assert.equal(await prisma.terminalFiscalMatchEvaluation.count({where:{matchId:before.id,status:'unavailable'}}),3);
 const run=await prisma.terminalFiscalMatchRun.findUniqueOrThrow({where:{id:before.runId}});
 assert.equal(run.tbankComplete,false);
 await persist({...base,evaluatedAt:'2026-08-10T07:05:00Z'},'-outage-restored');
 assert.equal((await prisma.terminalFiscalMatch.findUniqueOrThrow({where:{id:before.id}})).status,'confirmed');
 await persist({...base,status:'mismatch',reasonCode:'OFD_ELECTRONIC_AMOUNT_MISMATCH',evaluatedAt:'2026-08-10T07:06:00Z'},'-outage-real-mismatch');
 assert.equal((await prisma.terminalFiscalMatch.findUniqueOrThrow({where:{id:before.id}})).status,'mismatch');
});
