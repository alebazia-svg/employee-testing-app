import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import test from 'node:test';
import {prisma} from '../lib/prisma';
import {retainPaymentConfirmations} from '../lib/procurement-confirmed-payment-server';
import {confirmedPayments} from '../lib/procurement-confirmed-payment';
import {type ProcurementPaymentEvidence} from '../lib/procurement-currency-payment-evidence';
import {preservePaymentEvidenceViews, savedPaymentEvidence} from '../lib/procurement-evidence-continuity';

test('PostgreSQL persists ownership, serializes competing cabinets and preserves saved evidence', async()=>{
  const url=new URL(process.env.DATABASE_URL || '');
  assert.equal(url.hostname,'127.0.0.1'); assert.equal(url.pathname,'/anchor_test');
  const marker=randomUUID(),payment={ref:randomUUID(),number:'TEST',fingerprint:'TEST'};
  const user=await prisma.user.create({data:{name:marker,login:marker,passwordHash:'unused',role:'EMPLOYEE'}});
  const create=(suffix:string)=>prisma.supplierPaymentPlan.create({data:{planCode:marker+suffix,supplierPartner:marker,managerUserId:user.id,
    plannedDate:new Date(),plannedAmount:100,condition:'test',paymentMethod:'CASH',status:'APPROVED',orderRefs:[],orderNumbers:[],
    oneCCashEvidence:{custom:'preserved'}}});
  const read=()=>prisma.supplierPaymentPlan.findMany();
  try {
    const a=await create('a'),b=await create('b');
    const rows=await read(),started=new Date();
    const first={planId:a.id,payment},other={planId:b.id,payment};
    const attempts=await Promise.allSettled([retainPaymentConfirmations(rows,[first],started),retainPaymentConfirmations(rows,[other],started)]);
    assert.equal(attempts.filter(r=>r.status==='fulfilled').length,1);
    const after=await read();
    const owner=after.find(p=>confirmedPayments(p.oneCCashEvidence).some(link=>link.ref===payment.ref))!;
    const proposal={planId:owner.id,payment};
    const same=await Promise.all([retainPaymentConfirmations(after,[proposal],started),retainPaymentConfirmations(after,[proposal],started)]);
    for(const snapshot of same) assert.equal(confirmedPayments(snapshot.find(p=>p.id===owner.id)!.oneCCashEvidence).length,1);
    assert.deepEqual(owner.oneCCashEvidence,{custom:'preserved',confirmedSupplierPayments:[payment]});
    assert.equal(owner.updatedAt.getTime(),rows.find(p=>p.id===owner.id)!.updatedAt.getTime());
    const e:ProcurementPaymentEvidence={state:'ISSUED_BY_ONE_C',issuedAmount:100,actualSupplier:marker,cashOrders:[],currencyPayments:[],
      paidAmount:0,paidForeignAmount:0,remainingAmount:0,remainingForeignAmount:null,actualExchangeRate:null};
    const base=same[0].find(row=>row.id===owner.id)!;
    await preservePaymentEvidenceViews([base],new Map([[owner.id,e]]),true,started,prisma.supplierPaymentPlan);
    const reloaded=(await read()).find(row=>row.id===owner.id)!;
    assert.equal(savedPaymentEvidence(reloaded)?.evidence.state,'ISSUED_BY_ONE_C');
    const outage=await preservePaymentEvidenceViews([reloaded],new Map([[owner.id,{...e,state:'NO_EVIDENCE'}]]),false,new Date(),prisma.supplierPaymentPlan);
    assert.equal(outage.get(owner.id)!.verification,'last-confirmed');
    assert.equal(outage.get(owner.id)!.state,'ISSUED_BY_ONE_C');
    assert.deepEqual(confirmedPayments(reloaded.oneCCashEvidence),[payment]);
    await prisma.supplierPaymentPlan.update({where:{id:b.id},data:{condition:'edited'}});
    await assert.rejects(retainPaymentConfirmations(after,[{planId:a.id,payment:{...payment,ref:randomUUID()}}],started),/изменились/);
  } finally {
    await prisma.supplierPaymentPlan.deleteMany({where:{managerUserId:user.id}});
    await prisma.user.delete({where:{id:user.id}});
    await prisma.$disconnect();
  }
});
