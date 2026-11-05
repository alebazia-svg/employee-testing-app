import test from 'node:test';import assert from 'node:assert/strict';
import {prepareShareManifest} from '../lib/procurement-share-manifest';
const actor={role:'ADMIN'};
function fixture(){
 const version='2026-11-05T10:00:00.000Z';
 const plans=['a','b'].map((id,i)=>({id,updatedAt:new Date(version),status:'APPROVED',paymentMethod:i?'USDT':'CNY',supplierPartner:`Supplier ${id}`,foreignAmount:i?200:100,oneCCashEvidence:null}));
 const docs=['b','a'].map(id=>({id:`file-${id}`,planId:id,originalName:'same-name.png',purpose:'QR',mimeType:'image/png',size:100,sha256:id.repeat(64),revision:0,replacedById:null}));
 const evidence=Object.assign(new Map(plans.map(p=>[p.id,{state:'NO_EVIDENCE'}])),{versions:new Map(plans.map(p=>[p.id,version]))});
 const db:any={supplierPaymentPlan:{findMany:async()=>plans},supplierPaymentReceipt:{findMany:async()=>docs}};
 return {db,plans,docs,evidence,selection:plans.map(p=>({id:p.id,version}))};
}
test('batch binds identical filenames to exact plan IDs, preserves amounts and never writes',async()=>{
 const f=fixture(),before=JSON.stringify(f.plans);
 const result=await prepareShareManifest(f.db,actor,[...f.selection].reverse(),async()=>f.evidence);
 assert.deepEqual(result.entries.map(e=>[e.id,e.amount,e.files[0].id,e.files[0].sha256]),[['b',200,'file-b','b'.repeat(64)],['a',100,'file-a','a'.repeat(64)]]);
 assert.equal(JSON.stringify(f.plans),before);
 const again=await prepareShareManifest(f.db,actor,[...f.selection].reverse(),async()=>f.evidence,result.stamp);assert.equal(again.stamp,result.stamp);
 f.docs[0].revision++;
 await assert.rejects(prepareShareManifest(f.db,actor,[...f.selection].reverse(),async()=>f.evidence,result.stamp),/изменились/);
});
test('authorization, duplicate IDs, stale plan/evidence, already-paid and ambiguous QR fail closed',async()=>{
 const f=fixture();await assert.rejects(prepareShareManifest(f.db,{role:'EMPLOYEE'},f.selection,async()=>f.evidence),/Нет доступа/);
 await assert.rejects(prepareShareManifest(f.db,actor,[f.selection[0],f.selection[0]],async()=>f.evidence),/разных заявок/);
 await assert.rejects(prepareShareManifest(f.db,actor,[{...f.selection[0],version:'old'},f.selection[1]],async()=>f.evidence),/изменилась/);
 f.evidence.versions.set('a','old');await assert.rejects(prepareShareManifest(f.db,actor,f.selection,async()=>f.evidence),/требует сверки/);f.evidence.versions.set('a',f.selection[0].version);
 f.evidence.set('a',{state:'ISSUED_BY_ONE_C'});await assert.rejects(prepareShareManifest(f.db,actor,f.selection,async()=>f.evidence),/требует сверки/);f.evidence.set('a',{state:'NO_EVIDENCE'});
 f.docs.push({...f.docs[1],id:'another'});await assert.rejects(prepareShareManifest(f.db,actor,f.selection,async()=>f.evidence),/несколько действующих QR/);
});
test('missing QR uses only own text; partial RUB payment never invents a currency remainder',async()=>{
 const f=fixture();f.docs.splice(1,1);f.docs.push({id:'address-a',planId:'a',purpose:'REQUISITES',textContent:'alipay-a',network:'',revision:0} as any);
 f.evidence.set('a',{state:'PARTIALLY_ISSUED'});
 const result=await prepareShareManifest(f.db,actor,f.selection,async()=>f.evidence);
 assert.equal(result.entries[0].text,'alipay-a');assert.equal(result.entries[0].amount,null);assert.equal(result.entries[0].files.length,0);
 assert.equal(result.entries[1].text,'');assert.equal(result.entries[1].files[0].id,'file-b');
 f.docs.push({id:'another-address-a',planId:'a',purpose:'REQUISITES',textContent:'other',network:'',revision:0} as any);
 await assert.rejects(prepareShareManifest(f.db,actor,f.selection,async()=>f.evidence),/однозначные реквизиты/);
});
test('a new RUB partial payment invalidates even a manually entered currency amount',async()=>{
 const f=fixture();f.evidence.set('a',{state:'PARTIALLY_ISSUED',issuedAmount:100,remainingForeignAmount:100} as any);
 const first=await prepareShareManifest(f.db,actor,f.selection,async()=>f.evidence);assert.equal(first.entries[0].amount,null);
 f.evidence.set('a',{state:'PARTIALLY_ISSUED',issuedAmount:200,remainingForeignAmount:100} as any);
 await assert.rejects(prepareShareManifest(f.db,actor,f.selection,async()=>f.evidence,first.stamp),/изменились/);
});
