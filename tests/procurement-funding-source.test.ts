import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';

async function moduleWithMocks(file:string,mocks:Record<string,unknown>){
 const output=await build({entryPoints:[file],bundle:true,write:false,platform:'node',format:'cjs',plugins:[{name:'mock',setup(b){b.onResolve({filter:/.*/},a=>a.path in mocks?{path:a.path,external:true}:undefined);}}]});
 const mod={exports:{} as Record<string,any>};
 new Function('require','module','exports',output.outputFiles[0].text)((name:string)=>mocks[name],mod,mod.exports);
 return mod.exports;
}
test('bank reads latest statement day separately; historical limit never becomes current',async()=>{
 const calls:string[]=[];
 const original=globalThis.fetch;
 globalThis.fetch=async url=>{
  const date=new URL(String(url)).searchParams.get('date_to')!;calls.push(date);
  return Response.json({forDate:date,statement_summaries:[{period_end:'10.10.2026 23:59:59'}]});
 };
 try{
  const mod=await moduleWithMocks('lib/tbank-owner-transfer-one-c.ts',{
   'server-only':{},'./one-c-env':{readOneCRuntimeEnv:()=>({baseUrl:'https://example.test',user:'test',password:'test'})},
   './tbank-owner-transfer-control':{tbankTransferPeriod:()=>({periodFrom:'2026-09-22'}),parseTBankOwnerTransferStatement:(raw:any,date:string)=>({status:date==='2026-10-10'&&raw?'verified':'unavailable',freeRemainingMinor:date==='2026-10-10'?15000000:null,nextTransferFeeMinor:()=>0})},
  });
  const result=await mod.fetchDatedTBankControl('2026-10-11');
  assert.deepEqual(calls,['2026-10-11','2026-10-10']);assert.equal(result.current.status,'unavailable');
  assert.equal(result.dated.current,false);assert.equal(result.dated.statementDate,'2026-10-10');assert.equal(result.dated.freeRemainingMinor,15000000);
  assert.equal(mod.latestStatementDay({statement_summaries:[{period_end:'2026-99-99'},{period_end:'2026-10-12'}]},'2026-10-11'),null);
  assert.equal(mod.latestStatementDay(null,'2026-10-11'),null);
 }finally{globalThis.fetch=original;}
});
test('forecast manager source uses active employee mapping and applies exclusions only in forecast',async()=>{
 let where:any, approved:readonly string[]=[];
 const mod=await moduleWithMocks('lib/procurement-funding-source.ts',{
  'server-only':{},'./prisma':{prisma:{userOneCCashboxMapping:{findMany:async(args:any)=>{where=args.where;return [{oneCCashboxRef:'manager'}];}}}},
  './one-c':{getCashFundingContext:async()=>({})},'./procurement-delivery-policy':{DELIVERY_PERSON:{organizationRef:'org'}},
  './procurement-funding-owner-policy':{FUNDING_POLICY_EFFECTIVE_FROM:'2026-10-11',LEGACY_FUNDING_EXCLUSIONS:['approved']},
  './procurement-funding-exclusions':{forecastFundingWithExclusions:(_raw:any,ids:readonly string[])=>{approved=ids;return {checkedAt:'now',cashboxes:[{ref:'safe',name:'Сейф Расходный',balance:10},{ref:'manager',name:'Касса'}],topups:[{private:true}],unassignedCount:0,unassignedAmount:0,reviewCount:0,excludedCount:1};}},
  './procurement-delivery-funding':{deliveryFundingForManagerCashboxes:(data:any,ids:string[])=>({...data,cashboxes:data.cashboxes.filter((b:any)=>ids.includes(b.ref))})},
 });
 const result=await mod.loadForecastManagerCash('2026-10-11');
 assert.equal(where.isActive,true);assert.equal(where.user.isActive,true);assert.equal(where.user.role,'EMPLOYEE');assert.equal(where.user.portalArea,'WORKDAY');
 assert.deepEqual(result.cashboxes,[{ref:'manager',name:'Касса'}]);assert.deepEqual(result.extraCash,[{name:'Сейф Расходный',balance:10}]);assert.equal('topups' in result,false);assert.deepEqual(approved,['approved']);
 await mod.loadForecastManagerCash('2026-10-10');assert.deepEqual(approved,[]);
});
