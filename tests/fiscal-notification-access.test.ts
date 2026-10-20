import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
test('fiscal modal details require an owned ADMIN receipt; no employee or cross-account access',async()=>{
 let receipt:any=null,loaded=0;
 const mocks:Record<string,any>={
 './fiscal-review-data':{loadFiscalReviewData:async()=>{loaded++;return {id:'review'};}},
 '@/lib/prisma':{prisma:{adminInboxReceipt:{findFirst:async({where}:any)=>{assert.equal(where.userId,1);return receipt;}}}},
 '@/lib/procurement-plan-revision':{},'@/lib/procurement-receipt-policy':{},'@/lib/procurement-buyer-comment':{},'@/lib/expense-request-list-item':{},
 };
 const out=await build({entryPoints:['lib/notification-detail-reader.ts'],bundle:true,write:false,platform:'node',format:'cjs',packages:'external',plugins:[{name:'fixture',setup(b){b.onResolve({filter:/.*/},a=>a.path in mocks?{path:a.path,external:true}:undefined);}}]});
 const require=createRequire(import.meta.url),mod={exports:{} as any};new Function('require','module','exports',out.outputFiles[0].text)((n:string)=>mocks[n]??require(n),mod,mod.exports);
 const read=mod.exports.readNotificationDetail,admin={id:1,role:'ADMIN',portalArea:'manager',isActive:true};
 assert.equal((await read({...admin,role:'EMPLOYEE'},'admin','receipt')).status,403);assert.equal(loaded,0);
 assert.equal((await read(admin,'admin','someone-else')).status,404);assert.equal(loaded,0);
 receipt={event:{sourceType:'terminal_fiscal_review',sourceId:'review',href:'/admin/workday/payment-checks/review'}};
 const response=await read(admin,'admin','receipt');assert.equal(response.status,200);assert.equal(response.headers.get('Cache-Control'),'private, no-store');assert.equal((await response.json()).detail.id,'review');assert.equal(loaded,1);
});
