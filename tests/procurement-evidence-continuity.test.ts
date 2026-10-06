import test from 'node:test';
import assert from 'node:assert/strict';
import { paymentEvidenceIdentity, paymentEvidenceView, preservePaymentEvidenceViews, savedPaymentEvidence } from '../lib/procurement-evidence-continuity';
import { matchProcurementPaymentEvidence, type ProcurementPaymentEvidence } from '../lib/procurement-currency-payment-evidence';
import { isFinishedPaymentState, SMALL_REMAINDER_COMPLETED } from '../lib/procurement-small-remainder';
import { readFileSync } from 'node:fs';

const now = new Date('2026-10-06T10:00:00Z');
const plan = () => ({ id: 'baseus', managerUserId: 1, supplierPartner: 'Baseus', supplierCounterparty: '',
  orderRefs: ['order'], plannedAmount: '47600', currency: 'RUB', paymentMethod: 'CASH',
  foreignAmount: null, plannedDate: '2026-09-30', createdAt: '2026-09-29', updatedAt: now,
  status: 'APPROVED', oneCCashEvidence: { manualRubleLinks: [{ ref: 'manual', fingerprint: 'kept' }], pendingRevision: null } as any });
const evidence = (state: ProcurementPaymentEvidence['state'], amount = 47600) => ({
  state, actualSupplier: 'Baseus', issuedAmount: amount, paidAmount: 0, paidForeignAmount: 0,
  remainingAmount: Math.max(0, 47600 - amount), remainingForeignAmount: null,
  actualExchangeRate: null, currencyPayments: [],
  cashOrders: amount ? [{ ref: 'rko', number: '001793', date: '30.09.2026 15:27:43', amount, cashbox: 'Cash' }] : [],
} as ProcurementPaymentEvidence);
function memory(p = plan()) {
  const writes: any[] = [];
  return { p, writes, store: { updateMany: async (args: any) => {
    writes.push(args);
    if (args.where.updatedAt !== p.updatedAt || JSON.stringify(args.where.oneCCashEvidence.equals) !== JSON.stringify(p.oneCCashEvidence)) return { count: 0 };
    p.oneCCashEvidence = args.data.oneCCashEvidence;
    return { count: 1 };
  } } };
}
async function save(m: ReturnType<typeof memory>, e = evidence('ISSUED_BY_ONE_C')) {
  return preservePaymentEvidenceViews([m.p], new Map([[m.p.id, e]]), true, now, m.store, now);
}

test('confirmed Baseus survives repeated outages and a fresh page load without writes', async () => {
  const m = memory(); await save(m);
  for (let i = 0; i < 3; i++) {
    const reloaded = { ...m.p, oneCCashEvidence: JSON.parse(JSON.stringify(m.p.oneCCashEvidence)) };
    const views = await preservePaymentEvidenceViews([reloaded], new Map([[m.p.id, evidence('NO_EVIDENCE', 0)]]), false, now, m.store, now);
    const v = views.get(m.p.id)!;
    assert.equal(v.state, 'ISSUED_BY_ONE_C');
    assert.equal(v.issuedAmount, 47600);
    assert.equal(v.verification, 'last-confirmed');
    assert.equal(v.verifiedAt, now.toISOString());
  }
  assert.equal(m.writes.length, 1);
  assert.deepEqual(m.p.oneCCashEvidence.manualRubleLinks, [{ ref: 'manual', fingerprint: 'kept' }]);
});

test('A100 small remainder does not turn back into a demand for 25 RUB during outage', async () => {
  const m = memory({ ...plan(), id: 'a100', plannedAmount: '30025' });
  const paid = { ...evidence(SMALL_REMAINDER_COMPLETED, 30000), remainingAmount: 25 };
  await save(m, paid);
  const v = paymentEvidenceView(m.p, evidence('PARTIALLY_ISSUED', 30000), false, now.toISOString());
  assert.equal(v.state, SMALL_REMAINDER_COMPLETED);
  assert.ok(isFinishedPaymentState(v.state));
  assert.equal(v.remainingAmount, 25);
});

test('a complete read with cancelled RKO replaces paid evidence and never resurrects it on outage', async () => {
  const m = memory(); await save(m);
  const unposted = evidence('NO_EVIDENCE', 0);
  await preservePaymentEvidenceViews([m.p], new Map([[m.p.id, unposted]]), true,
    new Date(now.getTime()+1000), m.store, new Date(now.getTime()+2000));
  assert.equal(savedPaymentEvidence(m.p)?.evidence.state, 'NO_EVIDENCE');
  assert.equal(paymentEvidenceView(m.p, unposted, false, now.toISOString()).issuedAmount, 0);
});

test('no confirmed snapshot means unknown, never unpaid or a new unlinked payment', () => {
  const v = paymentEvidenceView(plan(), evidence('PARTIALLY_ISSUED', 30000), false, now.toISOString());
  assert.equal(v.state, 'SOURCE_UNAVAILABLE');
  assert.equal(v.verification, 'unavailable');
  assert.deepEqual(v.cashOrders, []);
});

test('changed amount/order/status/manual allocation invalidates old cached identity', async () => {
  const m = memory(); await save(m);
  for (const patch of [{ plannedAmount: '50000' }, { orderRefs: ['other'] }, { status: 'SUBMITTED' },
    { supplierPartner: 'Another supplier' }, { oneCCashEvidence: { ...m.p.oneCCashEvidence, manualRubleLinks: [] } }]) {
    assert.equal(paymentEvidenceView({ ...m.p, ...patch }, evidence('NO_EVIDENCE', 0), false, now.toISOString()).verification, 'unavailable');
  }
  assert.equal(paymentEvidenceIdentity(m.p), paymentEvidenceIdentity({ ...m.p, updatedAt: new Date() }), 'cache writes do not invalidate identity');
});

test('cache excludes cash-collection instructions and is not used by the business matcher', async () => {
  const m = memory(); await save(m, { ...evidence('ISSUED_BY_ONE_C'), collection: { state: 'ready' } as any });
  assert.equal(savedPaymentEvidence(m.p)?.evidence.collection, undefined);
  assert.equal(paymentEvidenceView(m.p, evidence('NO_EVIDENCE',0), false, now.toISOString()).collection, undefined);
  const live = matchProcurementPaymentEvidence([{ ...m.p, planCode:'P', plannedAmount:47600 }], [], [], []);
  assert.equal(live.get(m.p.id)?.issuedAmount, 0, 'stored presentation must not authorize payment allocation');
});

test('cache updates use optimistic guard, preserve metadata and do not persist incomplete reads', async () => {
  const m = memory(); await save(m);
  assert.equal(m.writes[0].where.id, m.p.id);
  assert.equal(m.writes[0].where.updatedAt, now);
  assert.ok(m.writes[0].where.oneCCashEvidence.equals.manualRubleLinks);
  assert.equal(m.writes[0].data.updatedAt, now, 'cache must not invalidate open revision/completion quotes');
  assert.deepEqual(Object.keys(m.writes[0].data), ['updatedAt', 'oneCCashEvidence']);
  await save(m); assert.equal(m.writes.length, 1, 'same result writes at most once per five minutes');
  m.p.oneCCashEvidence.lastCompletePaymentView.readStartedAt = new Date(now.getTime()+10000).toISOString();
  await save(m, evidence('NO_EVIDENCE',0)); assert.equal(m.writes.length, 1, 'older reads cannot overwrite newer proof');
});

test('persistence failure leaves fresh evidence intact and outage without cache unknown', async () => {
  const p = plan();
  const result = await preservePaymentEvidenceViews([p], new Map([[p.id, evidence('ISSUED_BY_ONE_C')]]), true,
    now, { updateMany: async () => { throw Error('database temporarily unavailable'); } }, now);
  assert.equal(result.get(p.id)?.state, 'ISSUED_BY_ONE_C');
  assert.equal(paymentEvidenceView(p, evidence('NO_EVIDENCE',0), false, now.toISOString()).state, 'SOURCE_UNAVAILABLE');
});

test('real matcher sequence: paid, source fails, reload, source recovers; amounts never change', async () => {
  for (const [target, paid, expected] of [[47600,47600,'ISSUED_BY_ONE_C'],[30025,30000,SMALL_REMAINDER_COMPLETED]] as const) {
    const m = memory({...plan(),plannedAmount:String(target),oneCCashEvidence:{}});
    const matchingPlan={...m.p,planCode:'P',plannedAmount:target,createdAt:'2026-09-29T09:00:00Z'};
    const rko={ref:'rko',number:'TEST',date:'30.09.2026 12:00:00',posted:true,deleted:false,
      documentCurrency:'РУБ',documentAmount:paid,baseDocumentRef:'order',supplier:'Baseus'};
    const fresh=matchProcurementPaymentEvidence([matchingPlan],[],[rko],[],{allowSmallRemainder:true});
    assert.equal(fresh.get(m.p.id)?.state,expected);
    await preservePaymentEvidenceViews([m.p],fresh,true,now,m.store,now);
    const incomplete=matchProcurementPaymentEvidence([matchingPlan],[],[rko],[],{allowSmallRemainder:false});
    const reload=JSON.parse(JSON.stringify(m.p));
    const offline=paymentEvidenceView(reload,incomplete.get(m.p.id)!,false,now.toISOString());
    assert.equal(offline.state,expected);assert.equal(offline.issuedAmount,paid);
    const recovered=paymentEvidenceView(reload,fresh.get(m.p.id)!,true,now.toISOString());
    assert.equal(recovered.state,expected);assert.equal(recovered.verification,'current');
  }
});

test('concurrent older snapshot cannot overwrite newer cache or a manual link edit', async () => {
  const m = memory();
  const older={...m.p,oneCCashEvidence:structuredClone(m.p.oneCCashEvidence)};
  await save(m);
  const first=m.p.oneCCashEvidence;
  await preservePaymentEvidenceViews([older],new Map([[older.id,evidence('NO_EVIDENCE',0)]]),true,now,m.store,now);
  assert.equal(m.p.oneCCashEvidence,first,'JSON CAS guards even when business updatedAt is unchanged');
  const beforeEdit={...m.p,oneCCashEvidence:structuredClone(m.p.oneCCashEvidence)};
  m.p.oneCCashEvidence={...m.p.oneCCashEvidence,manualRubleLinks:[]};
  await preservePaymentEvidenceViews([beforeEdit],new Map([[m.p.id,evidence('NO_EVIDENCE',0)]]),true,now,m.store,now);
  assert.deepEqual(m.p.oneCCashEvidence.manualRubleLinks,[]);
});

test('both screens consume persisted views; unknown is not awaiting; review actions require complete sources', () => {
  const admin = readFileSync('app/(dashboard)/admin/procurement/page.tsx','utf8');
  const buyer = readFileSync('app/(dashboard)/procurement/page.tsx','utf8');
  for(const page of [admin,buyer]) assert.match(page,/preservePaymentEvidenceViews/);
  assert.match(admin,/paymentLinks=\{evidenceComplete \?/);
  assert.match(admin,/initialPlans=\{plansWithOrderContext\.map/);
  assert.match(admin,/evidence: paymentEvidence\.get\(plan.id\)!/, 'financial calculations keep fresh evidence');
  const buyerUI = readFileSync('app/(dashboard)/procurement/ProcurementPaymentCalendarClient.tsx','utf8');
  assert.doesNotMatch(buyerUI,/evidenceSourceError \? \{ \.\.\.plan, evidence: undefined/);
  assert.match(buyerUI,/const reservesUnavailable =[^;]*unverifiedPaymentView/);
  assert.match(buyerUI,/const planningBlocked =[^;]*unverifiedPaymentView/);
  for(const path of ['app/(dashboard)/admin/procurement/AdminProcurementClient.tsx','app/(dashboard)/procurement/ProcurementPaymentCalendarClient.tsx']) {
    assert.match(readFileSync(path,'utf8'),/verification\s*!==\s*'unavailable'/);
  }
});
