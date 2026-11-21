'use strict';
const {prisma}=require('/app/lib/prisma.ts');
const {freshEvidence}=require('/app/lib/procurement-plan-revision-server.ts');
const {createHash}=require('node:crypto'),fs=require('node:fs/promises'),path=require('node:path');
const hash=x=>createHash('sha256').update(x).digest('hex');
const digest=x=>hash(JSON.stringify(x));
async function snapshot() {
 const data=await prisma.$transaction(async tx=>{
  await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
  const plans=await tx.supplierPaymentPlan.findMany({orderBy:{id:'asc'},select:{id:true,planCode:true,status:true,updatedAt:true,orderRefs:true,oneCCashEvidence:true}});
  const files=await tx.supplierPaymentReceipt.findMany({orderBy:{id:'asc'}});
  return {plans,files};
 });
 const e=await freshEvidence();
 const plans=data.plans.map(p=>{
  const row=e.get(p.id);
  if(!row||e.versions.get(p.id)!==p.updatedAt.toISOString())throw Error('PLAN_CHANGED_DURING_READ');
  const native=[...row.cashOrders.map(x=>['rub',x.ref,x.number,x.date,x.amount]),...row.currencyPayments.map(x=>['fx',x.ref,x.number,x.date,x.foreignAmount,x.documentForeignAmount,x.unallocatedForeignAmount])].sort((a,b)=>String(a[1]).localeCompare(String(b[1])));
  return [p.id,digest([p.status,p.orderRefs,p.oneCCashEvidence?.manualRubleLinks,p.oneCCashEvidence?.completion,row.state,row.paidAmount,row.paidForeignAmount,row.issuedAmount,row.remainingAmount,row.remainingForeignAmount,native])];
 });
 const files=[];
 let physical=0;
 for(const f of data.files){
  if(!f.storageKey.startsWith('text:')){
   if(!/^[a-f0-9-]+\.(jpg|png|webp|pdf)$/.test(f.storageKey))throw Error('UNEXPECTED_FILE_KEY');
   const bytes=await fs.readFile(path.join('/app/uploads/procurement-receipts',f.storageKey));
   if(hash(bytes)!==f.sha256||bytes.length!==f.size)throw Error('FILE_DIGEST_MISMATCH');
   physical++;
  }
  files.push([f.id,digest([f.planId,f.storageKey,f.sha256,f.paymentRefs,f.paymentSnapshots,f.purpose,f.revision,f.replacedById,f.textContent,f.network])]);
 }
 const advance=data.plans.find(p=>p.planCode==='PAY-20261116-688975');
 const other=data.plans.find(p=>p.planCode==='PAY-20261112-673799');
 const a=e.get(advance?.id),b=e.get(other?.id);
 if(a?.state!=='PAID_BY_ONE_C'||a.paidForeignAmount!==4199.69||!a.currencyPayments.some(x=>x.number==='00OF-002114'&&x.foreignAmount===4199.69)||b?.currencyPayments.some(x=>x.number==='00OF-002114'))throw Error('LUXO_RECONCILIATION');
 const anchors=data.plans.reduce((n,p)=>n+(p.oneCCashEvidence?.confirmedSupplierPayments?.length||0),0);
 console.log(JSON.stringify({plans,files,physical,anchors,luxo:{state:a.state,amount:a.paidForeignAmount},other:b.state}));
}
snapshot().catch(e=>{console.error(e.code||e.name,String(e.message).split('\n').pop().slice(0,70));process.exitCode=1}).finally(()=>prisma.$disconnect());
