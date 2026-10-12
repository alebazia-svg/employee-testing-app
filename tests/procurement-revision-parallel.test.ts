import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return {promise, resolve};
}

test('revision checks overlap, wait before writes and reject failed or changed evidence', async () => {
  const g = globalThis as any;
  const mocks: Record<string, string> = {
    prisma: `const s=()=>globalThis.parallelRevisionTest; const tx={
      $executeRaw:async()=>{},supplierPaymentPlan:{findMany:async(args)=>{if(args?.where)return [];
        if(s().snapshotRace)s().plan.updatedAt=new Date('2026-10-12T00:01:00Z');return [structuredClone(s().plan)];},
      findUniqueOrThrow:async()=>structuredClone(s().plan),update:async({data})=>{s().writes++;return {...s().plan,...data}}},
      supplierPaymentPlanEvent:{create:async()=>({id:'event'})}};
      export const prisma={...tx,$transaction:async fn=>{s().transactions++;return fn(tx)}};`,
    'procurement-currency-payment-source': `export const fetchSupplierCurrencyPaymentSnapshot=async()=>{
      const s=globalThis.parallelRevisionTest;await s.check('payments');
      return {complete:!s.incomplete,rubPaymentsSupported:true,payments:[],conversions:[]}};`,
    'expense-request-source': `export const expenseRequestMoscowDayEnd=()=>new Date('2026-10-13');
      export const fetchExpenseRequestSnapshot=async()=>({complete:true,rows:[]});`,
    'procurement-ruble-payment-evidence': 'export const paymentEvidenceFrom=(_p,d)=>d;',
    'procurement-currency-payment-evidence': `export const matchProcurementPaymentEvidence=()=>new Map([['plan',{
      state:globalThis.parallelRevisionTest.paid?'PAID_BY_ONE_C':'NO_EVIDENCE',issuedAmount:0,paidAmount:0,paidForeignAmount:0}]]);`,
    'procurement-usdt-funding-server': `export const readFundingBalance=async()=>{await globalThis.parallelRevisionTest.check('funding');return 1000};
      export const assertFundingBalance=async()=>{};`,
    'procurement-basis-change-server': `export const validateBasisChangeTarget=async(_p,d)=>{await globalThis.parallelRevisionTest.check('basis');return d};`,
    'procurement-payment-notifications': 'export const notifyAdminsAboutProcurementPlans=async()=>{};export const notifyProcurementManagerAboutDecision=async()=>{};',
  };
  const bundle=await build({entryPoints:['lib/procurement-plan-revision-server.ts'],bundle:true,write:false,platform:'node',format:'cjs',packages:'external',plugins:[{name:'isolated',setup(b){
    b.onResolve({filter:/^\.\//},a=>mocks[a.path.slice(2)]?{path:a.path.slice(2),namespace:'mock'}:null);
    b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:mocks[a.path],loader:'js'}));
  }}]});
  const mod={exports:{} as any};
  new Function('require','module','exports',bundle.outputFiles[0].text)(createRequire(import.meta.url),mod,mod.exports);
  try {
    for (const scenario of ['success','same-basis','basis','payments','funding','incomplete','race','snapshot-race','paid','reject']) {
      const gates=Object.fromEntries(['basis','payments','funding'].map(k=>[k,deferred()]));
      const data={supplierPartner:'Test',supplierCounterparty:'',orderRefs:['new'],orderNumbers:['2'],plannedDate:'2026-10-14',plannedAmount:100,paymentMethod:'CASH',currency:'RUB',foreignAmount:null,condition:''};
      const sameBasis=['same-basis','snapshot-race'].includes(scenario);
      const state:any=g.parallelRevisionTest={started:[],writes:0,transactions:0,snapshotRace:scenario==='snapshot-race',incomplete:scenario==='incomplete',paid:scenario==='paid',
        plan:{...data,id:'plan',orderRefs:sameBasis?['new']:[],status:'APPROVED',plannedDate:new Date('2026-10-14'),createdAt:new Date('2026-10-01'),updatedAt:new Date('2026-10-12'),manager:{name:'Test'},
          oneCCashEvidence:{pendingRevision:{id:'revision',data,changes:[]}}},
        check:async(key:string)=>{state.started.push(key);await gates[key].promise;if(key===scenario)throw Error('check failed');},
      };
      const operation=mod.exports.decideApprovedRevision('plan',1,'revision',scenario!=='reject',scenario==='reject'?'Оставить прежнее':'');
      // Attach the rejection observer before releasing any gates.
      const outcome=operation.then(()=>null,(error:Error)=>error);
      await new Promise(resolve=>setImmediate(resolve));
      if(scenario==='reject') {
        assert.equal(await outcome,null);assert.deepEqual(state.started,[]);assert.equal(state.writes,1);continue;
      }
      assert.deepEqual([...state.started].sort(),sameBasis?['funding','payments']:['basis','funding','payments']);
      assert.equal(state.transactions,0,'no transaction while checks are pending');
      gates.basis.resolve();gates.payments.resolve();
      await new Promise(resolve=>setImmediate(resolve));
      assert.equal(state.writes,0,'funding must also complete');
      if(scenario==='race')state.plan.updatedAt=new Date('2026-10-12T00:01:00Z');
      gates.funding.resolve();
      const error=await outcome;
      if(['success','same-basis'].includes(scenario)){assert.equal(error,null);assert.equal(state.writes,1);}
      else {assert.ok(error);assert.equal(state.writes,0);}
    }
  } finally {delete g.parallelRevisionTest;}
});
