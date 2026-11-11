import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);

test('real source and fresh matcher retire a paid USDT notification; partial, ambiguous and cancelled payments stay active',async t=>{
  t.mock.timers.enable({apis:['Date'],now:new Date('2026-11-11T14:00:00Z')});
  const env={...process.env};t.after(()=>{process.env=env;});
  process.env['1C_BASE_URL']='https://one-c.invalid';process.env['1C_API_USER']='test';process.env['1C_API_PASSWORD']='test';
  const id=(n:number)=>`11111111-1111-4111-8111-${String(n).padStart(12,'0')}`;
  for(const scenario of ['paid','partial','ambiguous','unposted','incomplete']){
    const writes:unknown[]=[];
    const amount=scenario==='partial'?4000:8005.95;
    const plan={id:'plan',planCode:'PAY-TEST',supplierPartner:'Supplier',supplierCounterparty:'Company',paymentPurpose:'GOODS',
      status:'APPROVED',paymentMethod:'USDT',orderRefs:[],foreignAmount:8000,plannedAmount:706400,
      plannedDate:new Date('2026-11-11'),createdAt:new Date('2026-10-13'),updatedAt:new Date('2026-10-13'),oneCCashEvidence:null,
      manager:{name:'Buyer',oneCManagerName:''}};
    const db={supplierPaymentPlan:{findMany:async()=>scenario==='ambiguous'?[plan,{...plan,id:'other',planCode:'OTHER'}]:[plan]},
      workdayNotification:{updateMany:async(args:unknown)=>{writes.push(args);return {count:1};}}};
    t.mock.method(globalThis,'fetch',async(input:string)=>{
      const u=new URL(input);
      if(u.pathname.endsWith('/expense-requests'))return Response.json({ok:true,rows:[],completeness:{complete:true}});
      if(u.pathname.endsWith('/supplier-currency-payment-diagnostics'))return Response.json({ok:true,rows:[{
        ref:id(1),number:'TEST',date:'11.11.2026 13:34:58',posted:true,deleted:false,document_amount:amount,document_currency:'USDT',
        supplier_partner:'Supplier',supplier_counterparty:'Company',settlement_amount:amount*78,settlement_currency:'руб',settlement_movements_count:1}]});
      if(u.pathname.endsWith('/currency-exchange-diagnostics'))return Response.json({ok:true,cash_expense_orders:[]});
      if(u.pathname.endsWith('/currency-cash-costing-plan'))return Response.json({ok:true,events:[]});
      if(u.pathname.endsWith('/supplier-order-finance-control'))return Response.json({ok:true,request_orders:[]});
      assert.equal(u.searchParams.get('detail'),'payment-basis');
      const dims={supplier_ref:id(2),counterparty_ref:id(3),organization_ref:id(4)};
      return Response.json({ok:true,complete:scenario!=='incomplete',write_operations:false,contract_version:'supplier-payment-basis-v1',as_of:new Date().toISOString(),
        payment:[{...dims,payment_ref:id(1),payment_number:'TEST',payment_date:'11.11.2026 13:34:58',amount,currency_name:'USDT',currency_ref:id(5),
          supplier_name:'Supplier',counterparty_name:'Company',posted:scenario!=='unposted',deleted:false,supplier_payment:true,version_token:'v1'}],
        movements:[{...dims,payment_ref:id(1),movement_date:'11.11.2026 13:34:58',line_number:1,amount:amount*78,currency_name:'руб',currency_ref:id(6),movement_type:'Приход',contract_ref:id(7),contract_name:'Contract'}]});
    });
    const mocks:Record<string,unknown>={'./prisma':{prisma:db},'@/lib/prisma':{prisma:db},
      './procurement-delivery-notifications':{DELIVERY_READY_KIND:'procurement_delivery_ready',currentDeliveryPush:async()=>({state:'inactive'})}};
    const bundled=await build({entryPoints:['lib/workday-notifications.ts'],bundle:true,write:false,platform:'node',format:'cjs',packages:'external',plugins:[{name:'mock-db',setup(b){b.onResolve({filter:/.*/},a=>a.path in mocks?{path:a.path,external:true}:undefined);}}]});
    const mod={exports:{} as any};
    new Function('require','module','exports',bundled.outputFiles[0].text)((name:string)=>mocks[name]??require(name),mod,mod.exports);
    const notice={id:1,kind:'procurement_payment_approved',fingerprint:'procurement-payment:plan:approved:event',taskId:null,issueId:null,reviewId:null,task:null,issue:null,review:null};
    const active=await mod.exports.reconcileActiveWorkdayNotifications(db,[notice]);
    assert.equal(active.length,scenario==='paid'?0:1,scenario);
    assert.equal(writes.length,scenario==='paid'?1:0,scenario);
  }
});
