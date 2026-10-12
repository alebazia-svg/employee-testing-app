import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';

async function load(entry: string, mocks: Record<string, string>) {
  const result = await build({entryPoints:[entry],bundle:true,write:false,platform:'node',format:'cjs',packages:'external',plugins:[{name:'isolated',setup(b){
    b.onResolve({filter:/^(?:@\/lib\/|\.\/)/},args=>{
      const key=args.path.replace(/^@\/lib\/|^\.\//,'');
      return mocks[key] ? {path:key,namespace:'mock'} : null;
    });
    b.onLoad({filter:/.*/,namespace:'mock'},args=>({contents:mocks[args.path],loader:'js'}));
  }}]});
  const module={exports:{} as any};
  new Function('require','module','exports',result.outputFiles[0].text)(createRequire(import.meta.url),module,module.exports);
  return module.exports;
}
const row=()=>({ref:'order',number:'1',date:new Date().toISOString(),manager:'Buyer',supplierPartner:'Supplier',supplierCounterparty:'Counterparty',orderPaymentGap:1000});

test('command catalogue removes only the duplicate read, not identity/completeness/paid guards',async()=>{
  const g=globalThis as any;
  const state=g.commandReadTest={calls:0,source:{complete:true,rows:[row()],checkedAt:new Date().toISOString(),errors:[]},fail:false};
  try {
    const api=await load('lib/procurement-planning-submit.ts',{
      'procurement-request-catalogue':`export const fetchRawRequestOrderCatalogue=async()=>{};
        export const fetchRequestOrderCatalogue=async()=>{const s=globalThis.commandReadTest;s.calls++;if(s.fail)throw Error('offline');return structuredClone(s.source)};`,
    });
    const run=(source?:any,selection=[row()],refs=['order'])=>api.planningSubmissionError(selection,[{refs,amount:1000}],undefined,source);
    assert.equal(await run(state.source),null);
    assert.equal(state.calls,0);
    assert.ok(await run({...state.source,complete:false}));
    assert.ok(await run({...state.source,rows:[]}));
    for(const changed of [{manager:'Another'},{supplierPartner:'Another'}])
      assert.ok(await run({...state.source,rows:[{...row(),...changed}]}));
    assert.ok(await run(state.source,[row()],['order','order']));
    const paid={...row(),paymentClosure:{state:'paid',remainingRub:0,checkedAt:new Date().toISOString(),receipts:[{number:'1'}]}};
    assert.ok(await run({...state.source,rows:[paid]}));
    paid.paymentClosure.checkedAt=new Date(Date.now()-3600000).toISOString();
    assert.ok(await run({...state.source,rows:[paid]}));
    assert.equal(state.calls,0,'provided server catalogue still validates without another network call');
    assert.equal(await run(),null);assert.equal(await run(),null);
    assert.equal(state.calls,2,'independent commands do not reuse prior results');
    state.fail=true;assert.ok(await run());
  } finally {delete g.commandReadTest;}
});

function gate(){let resolve!:()=>void;const promise=new Promise<void>(r=>{resolve=r});return {promise,resolve};}

test('buyer edit starts independent reads together and never writes on failed guards or version race',async()=>{
  const g=globalThis as any;
  const api=await load('app/api/procurement/payment-plans/[id]/route.ts',{
    auth:`export const getCurrentUser=async()=>({id:1,name:'Buyer',role:'EMPLOYEE',portalArea:'PROCUREMENT'});`,
    prisma:`const s=()=>globalThis.commandEditTest;const tx={
      $executeRaw:async()=>{},supplierPaymentPlan:{findFirst:async()=>structuredClone(s().plan),findMany:async()=>[],
      updateMany:async({where,data})=>{if(s().scenario==='race')return {count:0};if(where.updatedAt.toISOString()!==s().plan.updatedAt.toISOString())throw Error('VERSION_GUARD');s().writes++;s().data=data;return {count:1}},
      findUniqueOrThrow:async()=>({...s().plan,...s().data})},supplierPaymentPlanEvent:{create:async()=>({id:'event'})}};
      export const prisma={...tx,$transaction:async fn=>{s().transactions++;return fn(tx)}};`,
    'procurement-request-catalogue':`export const fetchRawRequestOrderCatalogue=async()=>{};
      export const fetchRequestOrderCatalogue=async()=>{const s=globalThis.commandEditTest;await s.check('catalogue');return {complete:s.scenario!=='incomplete',rows:[{...s.row,manager:s.scenario==='owner'?'Another':'Buyer',...(s.scenario==='paid'?{paymentClosure:{state:'paid',remainingRub:0,checkedAt:new Date().toISOString(),receipts:[{number:'1'}]}}:{})}],errors:[],checkedAt:new Date().toISOString()}};`,
    'procurement-plan-revision-server':`export const proposeApprovedRevision=async()=>{throw Error('NOT_THIS_BRANCH')};export const freshEvidence=async()=>{const s=globalThis.commandEditTest;await s.check('payments');return Object.assign(new Map(),{versions:new Map()})};`,
    'procurement-usdt-funding-server':`export const readFundingBalance=async()=>{await globalThis.commandEditTest.check('funding');return null};export const assertFundingBalance=async()=>{};`,
    'procurement-payment-notifications':`export const notifyAdminsAboutProcurementPlans=async()=>{globalThis.commandEditTest.notifications++};`,
    'procurement-planning-overlap':`export const planningRequestOverlap=()=>globalThis.commandEditTest.scenario==='overlap';`,
  });
  try {
    for(const scenario of ['success','incomplete','owner','paid','payments','funding','race','overlap']) {
      const gates={catalogue:gate(),payments:gate(),funding:gate()};
      const state:any=g.commandEditTest={scenario,started:[],writes:0,transactions:0,notifications:0,row:row(),
        plan:{id:'plan',managerUserId:1,supplierPartner:'Supplier',supplierCounterparty:'Counterparty',orderRefs:['order'],orderNumbers:['1'],paymentPurpose:'GOODS',status:'SUBMITTED',plannedAmount:1000,plannedDate:new Date(),updatedAt:new Date(),condition:'',paymentMethod:'CASH',currency:'RUB',oneCCashEvidence:{manualLinks:'sentinel'}},
        check:async(key:keyof typeof gates)=>{state.started.push(key);await gates[key].promise;if(key===scenario)throw Error('offline');},
      };
      const pending=api.PATCH(new Request('http://localhost/test',{method:'PATCH',body:JSON.stringify({supplierPartner:'Supplier',supplierCounterparty:'Counterparty',orderRefs:['order'],plannedDate:new Date().toISOString().slice(0,10),plannedAmount:1000,paymentMethod:'CASH',condition:'updated',version:state.plan.updatedAt.toISOString()})}),{params:Promise.resolve({id:'plan'})});
      const outcome=pending.then((response:Response)=>response,(error:Error)=>error);
      await new Promise(r=>setImmediate(r));
      assert.deepEqual([...state.started].sort(),['catalogue','funding','payments']);
      assert.equal(state.transactions,0);
      gates.catalogue.resolve();gates.payments.resolve();await new Promise(r=>setImmediate(r));
      assert.equal(state.transactions,0,'funding must also finish before transaction');
      gates.funding.resolve();const response=await outcome;
      assert.ok(response instanceof Response,scenario);
      assert.equal(response.status,scenario==='success'?200:scenario==='incomplete'||scenario==='payments'?503:scenario==='owner'?400:409,scenario);
      assert.equal(state.started.filter((key:string)=>key==='catalogue').length,1,'only one catalogue read per edit');
      assert.equal(state.writes,scenario==='success'?1:0);
      assert.equal(state.notifications,scenario==='success'?1:0);
      if(scenario==='success')assert.equal(state.data.oneCCashEvidence,undefined,'manual links are not overwritten');
    }
  } finally {delete g.commandEditTest;}
});

test('both create routes start evidence with catalogue and reuse the same server selection',async()=>{
  const g=globalThis as any;
  const mocks:Record<string,string>={
    auth:`export const getCurrentUser=async()=>({id:1,name:'Buyer',role:'EMPLOYEE',portalArea:'PROCUREMENT'});`,
    prisma:`const s=()=>globalThis.commandCreateTest;const tx={$executeRaw:async()=>{},supplierPaymentPlan:{findMany:async()=>[],create:async({data})=>{s().writes++;return {...data,id:'new'}}},supplierPaymentPlanEvent:{create:async()=>({id:'event'})}};export const prisma={...tx,$transaction:async fn=>{s().transactions++;return fn(tx)}};`,
    'procurement-request-catalogue':`export const fetchRequestOrderCatalogue=async()=>{const s=globalThis.commandCreateTest;await s.check('catalogue');return s.source};`,
    'procurement-supplier-settlements':`export const fetchSupplierSettlements=async()=>{await globalThis.commandCreateTest.check('settlements');return {complete:true,rows:[]}};export const summarizeSupplierSettlements=()=>({unsupportedCurrencyRows:0,bySupplier:{Supplier:{}}});`,
    'procurement-supplier-position':`export const buyerOrderPurpose=()=> 'order';export const supplierPosition=()=> 'debt';`,
    'procurement-plan-revision-server':`export const freshEvidence=async()=>{await globalThis.commandCreateTest.check('payments');return Object.assign(new Map(),{versions:new Map()})};`,
    'procurement-usdt-funding-server':`export const readFundingBalance=async()=>{await globalThis.commandCreateTest.check('funding');return null};export const assertFundingBalance=async()=>{};`,
    'procurement-payment-notifications':`export const notifyAdminsAboutProcurementPlans=async()=>{};`,
    'procurement-planning-submit':`export const planningSubmissionError=async(rows,requests,onVerified,source)=>{const s=globalThis.commandCreateTest;if(source!==s.source)throw Error('COMMAND_SOURCE_NOT_REUSED');s.selectionChecks++;return null};`,
  };
  try {
    for(const batch of [false,true]) {
      const api=await load(batch?'app/api/procurement/payment-plans/batch/route.ts':'app/api/procurement/payment-plans/route.ts',mocks);
      for(const scenario of ['success','payments','funding']) {
        const gates={catalogue:gate(),settlements:gate(),payments:gate(),funding:gate()};
        const state:any=g.commandCreateTest={writes:0,transactions:0,started:[],selectionChecks:0,source:{complete:true,rows:[row()],errors:[],checkedAt:new Date().toISOString()},
          check:async(key:keyof typeof gates)=>{state.started.push(key);await gates[key].promise;if(key===scenario)throw Error('offline');},
        };
        const data={basis:'ORDER',supplierPartner:'Supplier',supplierCounterparty:'Counterparty',orderRefs:['order'],plannedDate:new Date().toISOString().slice(0,10),plannedAmount:1000,paymentMethod:'CASH',condition:''};
        const operation=api.POST(new Request('http://localhost/test',{method:'POST',body:JSON.stringify(batch?{plannedDate:data.plannedDate,rows:[{...data,orderRef:'order'}]}:data)}));
        const outcome=operation.then((r:Response)=>r,(e:Error)=>e);
        await new Promise(r=>setImmediate(r));
        for(const key of ['catalogue','settlements','payments'])assert.ok(state.started.includes(key),`${batch}: ${key} starts without waiting for other reads`);
        assert.equal(state.transactions,0);
        gates.catalogue.resolve();gates.settlements.resolve();gates.payments.resolve();
        await new Promise(r=>setImmediate(r));
        assert.equal(state.transactions,0);
        gates.funding.resolve();const response=await outcome;
        assert.ok(response instanceof Response,`${batch}/${scenario}`);
        assert.equal(response.ok,scenario==='success',`${batch}/${scenario}: ${response.status}`);
        assert.equal(state.writes,scenario==='success'?1:0);
        assert.equal(state.started.filter((k:string)=>k==='catalogue').length,1);
        if(scenario==='success')assert.equal(state.selectionChecks,1);
      }
    }
  }finally{delete g.commandCreateTest;}
});
