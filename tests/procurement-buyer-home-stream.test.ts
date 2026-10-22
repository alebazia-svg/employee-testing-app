import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
test('actual home publishes cash/planning/delivery without waiting for payment evidence, then reuses only display cache',async()=>{
  let releaseEvidence!:()=>void;
  const waitEvidence=new Promise<void>(resolve=>{releaseEvidence=resolve;});
  const stamp=new Date().toISOString();
  const balance={balance:100,checkedAt:stamp,sourceLabel:'Test',error:''};
  const cache=new Map<string,unknown>();
  const harness={cache,stamp,balance,waitEvidence};
  const modules:Record<string,string>={
    '@/lib/procurement-admin-plans':`export const readAdminPlans=async()=>[];export const sameAdminPlanVersions=()=>true;`,
    '@/lib/procurement-buyer-display-cache':`export const readBuyerDisplay=async(scope,bucket)=>harness.cache.get(scope+bucket)||null;export const writeBuyerDisplay=async(scope,bucket,data)=>harness.cache.set(scope+bucket,{data,savedAt:harness.stamp});`,
    './ProcurementCalendarStream':`export const ProcurementCalendarStream=()=>null;export const ProcurementCalendarUpdate=()=>null;`,
    '@/components/ProcurementDeliveryPanel':`export const ProcurementDeliveryPanel=()=>null;`,
    '@/components/ProcurementDeliveryCash':`export const ProcurementDeliveryCash=()=>null;`,
    '@/lib/procurement-delivery-reminders':`export const deliveryMappedUser=async()=>({id:1});export const loadDeliveryView=async()=>({snapshot:{balance:200,checkedAt:harness.stamp,lastIssue:null},requested:false,requestStateAvailable:true});`,
    '@/lib/procurement-delivery-policy':`export const deliveryUserAllowed=()=>true;`,
    '@/lib/procurement-evidence-continuity':`export const preservePaymentEvidenceViews=async()=>new Map();export const paymentEvidenceView=()=>({});`,
    '@/lib/prisma':`export const prisma={supplierPaymentPlan:{findMany:async()=>[]}};`,
    '@/lib/procurement-cny-rate':`export const getProcurementCnyRate=async()=>undefined;`,
    '@/lib/procurement-request-catalogue':`export const fetchRequestOrderCatalogue=async()=>({rows:[],complete:true,checkedAt:harness.stamp});`,
    '@/lib/procurement-supplier-roster':`export const fetchManagerSupplierNames=async()=>['Supplier'];`,
    '@/lib/procurement-currency-balance':`export const getProcurementBalances=async()=>({usdt:harness.balance,accountable:harness.balance});`,
    '@/lib/expense-request-source':`export const expenseRequestMoscowCalendarDate=()=> '2026-10-22';export const expenseRequestMoscowDayEnd=()=>new Date();export const fetchExpenseRequestSnapshot=async()=>{await harness.waitEvidence;return {complete:true,rows:[]}};`,
    '@/lib/procurement-usdt-rate':`export const getLatestProcurementUsdtRate=async()=>({rate:90});`,
    '@/lib/procurement-currency-payment-source':`export const fetchSupplierCurrencyPaymentSnapshot=async()=>({complete:true,rubPaymentsSupported:true,payments:[],conversions:[]});`,
    '@/lib/procurement-qr-funding-source':`export const readQrFunding=async()=>null;export const attachQrFunding=()=>{};`,
    '@/lib/procurement-supplier-settlements':`export const fetchSupplierSettlements=async()=>({complete:true,rows:[],checkedAt:harness.stamp});export const summarizeSupplierSettlements=()=>({bySupplier:{Supplier:{debt:1000,advance:0,closingBalance:1000,reviewRequired:false}},debtTotal:1000,unsupportedCurrencyRows:0});`,
  };
  const result=await build({entryPoints:['app/(dashboard)/procurement/ProcurementHome.tsx'],bundle:true,write:false,platform:'node',format:'cjs',packages:'external',jsx:'automatic',plugins:[{name:'isolated-sources',setup(b){
    b.onResolve({filter:/.*/},args=>modules[args.path]?{path:args.path,namespace:'fixture'}:args.path==='server-only'?{path:'empty',namespace:'fixture'}:null);
    b.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:modules[args.path]??'',loader:'tsx'}));
  }}]});
  const mod={exports:{} as {ProcurementHome:(p:unknown)=>Promise<any>}};
  new Function('require','module','exports','harness',result.outputFiles[0].text)(createRequire(import.meta.url),mod,mod.exports,harness);
  const user={id:1,name:'Test',role:'EMPLOYEE',portalArea:'PROCUREMENT',isActive:true,oneCManagerName:'Test'};
  const first=await mod.exports.ProcurementHome({user});
  assert.equal(first.props.initial.usdtBalance.balance,null);
  const [planning,balances,delivery,evidence]=first.props.children.map((s:any)=>s.props.children.type());
  let evidenceDone=false;void evidence.then(()=>{evidenceDone=true;});
  assert.equal((await balances).props.data.usdtBalance.balance,100);
  assert.equal((await planning).props.data.supplierDebtTotal,1000);
  assert.ok((await delivery).props.data.deliveryCashPanel);
  assert.equal(evidenceDone,false);
  const second=await mod.exports.ProcurementHome({user,readOnly:true});
  assert.equal(second.props.initial.usdtBalance.balance,100);
  assert.equal(second.props.initial.supplierDebtTotal,1000);
  assert.equal(second.props.initial.evidenceSourceError,true);
  assert.equal(second.props.initial.sourceError,'SOURCE_LOADING');
  assert.equal(second.props.initial.balancesRefreshing,true);
  assert.deepEqual(second.props.initial.initialPlans,[]);
  releaseEvidence();await evidence;
});
