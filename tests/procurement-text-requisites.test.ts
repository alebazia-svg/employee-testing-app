import test from 'node:test';
import assert from 'node:assert/strict';
import {saveTextRequisites} from '../lib/procurement-text-requisites';
import {needsQrCheck} from '../lib/procurement-qr-check-policy';
import {receiptCoverageCount,paymentRequisites} from '../lib/procurement-document-policy';
const actor={id:1,role:'ADMIN',portalArea:'PROCUREMENT',isActive:true};
function fixture(method='USDT'){
 const plan={id:'p',managerUserId:2,paymentMethod:method,status:'APPROVED',updatedAt:new Date('2026-11-05'),plannedDate:new Date('2026-11-05'),plannedAmount:100,supplierPartner:'Test'};
 const rows:any[]=[],events:any[]=[];
 const db:any={supplierPaymentPlan:{findUnique:async()=>plan},user:{findUnique:async()=>actor},$queryRaw:async()=>[],supplierPaymentReceipt:{findUnique:async({where}:any)=>rows.find(r=>where.id?r.id===where.id:r.sha256===where.planId_sha256.sha256),findFirst:async({where}:any)=>rows.find(r=>r.id===where.id&&r.planId===where.planId),count:async()=>rows.length,create:async({data}:any)=>{const row={id:`r${rows.length}`,revision:0,...data};rows.push(row);return row;},update:async({where,data}:any)=>Object.assign(rows.find(r=>r.id===where.id),{...data,revision:1})},supplierPaymentPlanEvent:{create:async({data}:any)=>events.push(data)}};
 db.$transaction=async(fn:any)=>fn(db);
 return {db,plan,rows,events,command:{text:'T-example-address',network:'TRC20',planVersion:plan.updatedAt.toISOString()}};
}
test('text survives read, retries deduplicate, replacement preserves history; no financial or receipt side effects',async()=>{
 const f=fixture();const original=JSON.stringify(f.plan);
 const first=await saveTextRequisites(f.db,actor,'p',f.command);
 assert.equal(first.receipt.textContent,f.command.text);assert.equal(first.receipt.network,'TRC20');assert.equal(first.receipt.purpose,'REQUISITES');
 assert.equal((await saveTextRequisites(f.db,actor,'p',f.command)).duplicate,true);assert.equal(f.events.length,1);
 assert.equal(receiptCoverageCount({},f.rows),0);assert.equal(needsQrCheck(f.plan,f.rows,'2026-11-05'),false);assert.equal(needsQrCheck(f.plan,[...f.rows,{id:'qr',purpose:'QR'}],'2026-11-05'),false);
 const command={...f.command,text:'T-new-address',replaceId:first.receipt.id,replaceRevision:0};
 const second=await saveTextRequisites(f.db,actor,'p',command);assert.equal(first.receipt.replacedById,second.receipt.id);
 assert.equal((await saveTextRequisites(f.db,actor,'p',command)).duplicate,true);
 await assert.rejects(saveTextRequisites(f.db,actor,'p',{...command,text:'another'}),/изменились/);
 assert.equal(JSON.stringify(f.plan),original);
});
test('allowed methods only, network mandatory only for USDT, stale version and foreign buyer rejected',async()=>{
 for(const method of ['CASH','ACCOUNTABLE_QR']){const f=fixture(method);assert.equal(paymentRequisites(method),null);await assert.rejects(saveTextRequisites(f.db,actor,'p',f.command),/не нужны/);}
 for(const method of ['CNY','BANK']){const f=fixture(method);const saved=await saveTextRequisites(f.db,actor,'p',{...f.command,network:''});assert.equal(saved.receipt.network,null);}
 const f=fixture();await assert.rejects(saveTextRequisites(f.db,actor,'p',{...f.command,network:''}),/сеть/);
 await assert.rejects(saveTextRequisites(f.db,actor,'p',{...f.command,text:''}),/Проверьте/);
 await assert.rejects(saveTextRequisites(f.db,actor,'p',{...f.command,planVersion:'old'}),/изменилась/);
 await assert.rejects(saveTextRequisites(f.db,{...actor,role:'EMPLOYEE',id:3},'p',f.command),/не найдена/);
 assert.equal(f.rows.length,0);
});
