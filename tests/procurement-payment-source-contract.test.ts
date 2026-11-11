import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchSupplierCurrencyPaymentSnapshot, fetchSupplierCurrencyPaymentDisplaySnapshot } from '../lib/procurement-currency-payment-source';
import {hasConfirmedPaymentBasis} from '../lib/procurement-payment-basis';

test('source reads exact register basis for an orderless payment without inventing an order', async t => {
  const env = { ...process.env }; t.after(() => { process.env = env; });
  process.env['1C_BASE_URL']='https://one-c.invalid';process.env['1C_API_USER']='test';process.env['1C_API_PASSWORD']='test';
  const id = (n: number) => `11111111-1111-4111-8111-${String(n).padStart(12,'0')}`;
  const now = new Date();
  const date = new Intl.DateTimeFormat('ru-RU', {timeZone:'Europe/Moscow', day:'2-digit', month:'2-digit', year:'numeric'}).format(now)+' 00:00:00';
  const dimensions = {supplier_ref:id(2),counterparty_ref:id(3),organization_ref:id(4),currency_ref:id(5)};
  let basisReads=0, complete=true;
  t.mock.method(globalThis,'fetch',async(input:string)=>{
    const url=new URL(input);
    if(url.pathname.includes('supplier-currency'))return Response.json({ok:true,rows:[]});
    if(url.pathname.includes('currency-cash-costing-plan'))return Response.json({ok:true,events:[{
      event_type:'supplier_payment',ref:id(1),number:'TEST',date,currency_amount:126000,partner:'Supplier',counterparty:'Company',contract:'',base_document_ref:'',
    }]});
    if(url.pathname.includes('supplier-order-finance-control'))return Response.json({ok:true,request_orders:[]});
    if(url.pathname.includes('supplier-settlements')){
      basisReads++;assert.equal(url.searchParams.get('detail'),'payment-basis');assert.equal(url.searchParams.get('payment_ref'),id(1));
      assert.equal(url.searchParams.get('supplier_search'),'Supplier');
      return Response.json({ok:true,complete,write_operations:false,contract_version:'supplier-payment-basis-v1',as_of:new Date().toISOString(),
        payment:[{...dimensions,payment_ref:id(1),payment_number:'TEST',payment_date:date,amount:126000,supplier_name:'Supplier',counterparty_name:'Company',currency_name:'руб',posted:true,deleted:false,supplier_payment:true,version_token:'v1'}],
        movements:[{...dimensions,payment_ref:id(1),movement_date:date,line_number:1,amount:126000,movement_type:'Приход',currency_name:'руб',contract_ref:id(6),contract_name:'Contract'}]});
    }
    return Response.json({ok:true,cash_expense_orders:[]});
  });
  const read=()=>fetchSupplierCurrencyPaymentSnapshot({from:new Date(now.getTime()-86400000),to:now,plans:[{supplierPartner:'Supplier',orderRefs:[]}]});
  const result=await read();assert.equal(result.complete,true);assert.equal(basisReads,1);
  assert.equal(hasConfirmedPaymentBasis(result.payments[0]),true);
  assert.equal(result.payments[0].contract,'');assert.equal(result.payments[0].baseDocumentRef,'');
  complete=false;await assert.rejects(read,/PAYMENT_BASIS_SOURCE_INCOMPLETE/);
});

test('payment source uses existing posted-RKO endpoint for RUB without new API flags', async (t) => {
  const oldEnv = { ...process.env };
  process.env['1C_BASE_URL'] = 'https://one-c.invalid';
  process.env['1C_API_USER'] = 'test';
  process.env['1C_API_PASSWORD'] = 'test';
  t.after(() => { process.env = oldEnv; });
  let payload: Record<string, unknown> = { ok: true, rows: [] };
  t.mock.method(globalThis, 'fetch', async (input: string) => {
    const url = new URL(input);
    if (url.pathname.includes('supplier-currency')) {
      assert.equal(url.searchParams.has('include_rub'), false);
      return Response.json(payload);
    }
    if (url.pathname.includes('currency-cash-costing-plan')) {
      assert.equal(url.searchParams.get('currency'), 'руб');
      return Response.json({ ok: true, events: [{ event_type: 'supplier_payment', ref: 'rko-rub', date: '16.09.2026 18:47:57',
        number: '001692', currency_amount: 280000, base_document_ref: 'order', partner: 'MEMS', contract: 'MEMS contract',
        expected_settlement_amount: 0, difference_amount: 280000 }] });
    }
    return Response.json({ ok: true, cash_expense_orders: [] });
  });
  const read = () => fetchSupplierCurrencyPaymentSnapshot({ from: new Date('2026-09-15'), to: new Date('2026-09-16') });
  assert.equal((await read()).payments[0].documentAmount, 280000);
  assert.equal((await read()).rubPaymentsSupported, true);
  assert.equal((await read()).complete, true);
  payload.truncated = true;
  assert.equal((await read()).complete, false);
  payload.truncated = false;
  payload.source_errors = ['query-failure'];
  assert.equal((await read()).complete, false);
  payload.source_errors = [];
  payload.rows = [{ ref: 'rko', posted: true, document_amount: 280000, document_currency: 'РУБ', date: '16.09.2026 18:00:00' }];
  assert.equal((await read()).complete, false, 'missing deletion status is not proof of a live document');
});
test('settlement fallback validates requested order and keeps evidence older than 30 days',async(t)=>{
  const oldEnv={...process.env};t.after(()=>{process.env=oldEnv;});
  process.env['1C_BASE_URL']='https://one-c.invalid';process.env['1C_API_USER']='test';process.env['1C_API_PASSWORD']='test';
  const ref='11111111-1111-1111-1111-111111111111';let wrong=false;
  t.mock.method(globalThis,'fetch',async(input:string)=>{
    const url=new URL(input);
    if(url.pathname.includes('supplier-currency'))return Response.json({ok:true,rows:[]});
    if(url.pathname.includes('currency-cash-costing-plan'))return Response.json({ok:true,events:[{event_type:'supplier_payment',ref:'rko',date:'01.01.2025 12:00:00',number:'1',currency_amount:100,base_document_ref:'',partner:'Supplier'}]});
    if(url.pathname.includes('supplier-settlements')){
      assert.equal(url.searchParams.get('order_ref'),ref);
      const from=url.searchParams.get('date_from')!,to=url.searchParams.get('date_to')!;
      assert.equal((Date.parse(to)-Date.parse(from))/86400000,30,'1C accepts at most 31 inclusive calendar days');
      const historical=from<='2025-01-01'&&to>='2025-01-01';
      return Response.json({ok:true,complete:true,write_operations:false,contract_version:'supplier-document-evidence-v1',as_of:historical?to+'T23:59:59+03:00':new Date().toISOString(),order:[{order_ref:wrong?'other':ref,supplier_name:'Supplier',posted:true,deleted:false}],due_date_movements:historical?[{source_recorder_ref:'rko',settlement_object_ref:ref,settlement_document_ref:'rko',movement_date:'01.01.2025 12:00:00',movement_type:'Приход',raw_debt:0,raw_prepayment:100,currency_name:'руб'}]:[]});
    }
    return Response.json({ok:true,cash_expense_orders:[]});
  });
  const read=()=>fetchSupplierCurrencyPaymentSnapshot({from:new Date('2025-01-01T00:00:00Z'),to:new Date(),plans:[{supplierPartner:'Supplier',orderRefs:[ref]}]});
  assert.equal((await read()).payments[0].settlementOrderRef,ref);
  wrong=true;await assert.rejects(read,/ORDER_MISMATCH/);
});

test('USDT source retains settlement units and fetches the missing order link even with no RUB payments',async(t)=>{
  const oldEnv={...process.env};t.after(()=>{process.env=oldEnv;});
  process.env['1C_BASE_URL']='https://one-c.invalid';process.env['1C_API_USER']='test';process.env['1C_API_PASSWORD']='test';
  const ref='11111111-1111-1111-1111-111111111111';
  const now=new Date();const date=new Intl.DateTimeFormat('ru-RU',{timeZone:'Europe/Moscow',day:'2-digit',month:'2-digit',year:'numeric'}).format(now)+' 00:00:00';
  let calls=0;
  t.mock.method(globalThis,'fetch',async(input:string)=>{
    const url=new URL(input);
    if(url.pathname.includes('supplier-currency'))return Response.json({ok:true,rows:[{ref:'rko',date,number:'test',posted:true,deleted:false,document_amount:2725.45,document_currency:'USDT',supplier_partner:'Supplier',base_document_ref:'',settlement_amount:212585.1,settlement_currency:'руб',settlement_movements_count:1}]});
    if(url.pathname.includes('currency-cash-costing-plan'))return Response.json({ok:true,events:[]});
    if(url.pathname.includes('supplier-settlements')){
      calls++;assert.equal(url.searchParams.get('order_ref'),ref);
      return Response.json({ok:true,complete:true,write_operations:false,contract_version:'supplier-document-evidence-v1',as_of:new Date().toISOString(),order:[{order_ref:ref,supplier_name:'Supplier',posted:true,deleted:false}],due_date_movements:[{source_recorder_ref:'rko',settlement_object_ref:ref,settlement_document_ref:'rko',movement_date:date,movement_type:'Приход',raw_debt:0,raw_prepayment:212585.1,currency_name:'руб'}]});
    }
    return Response.json({ok:true,cash_expense_orders:[]});
  });
  const snapshot=await fetchSupplierCurrencyPaymentSnapshot({from:new Date(now.getTime()-86400000),to:now,plans:[{supplierPartner:'Supplier',orderRefs:[ref]}]});
  assert.equal(snapshot.complete,true);assert.equal(calls,1);
  assert.equal(snapshot.payments[0].settlementOrderRef,ref);
  assert.equal(snapshot.payments[0].documentAmount,2725.45);
  assert.equal(snapshot.payments[0].settlementAmount,212585.1);
});

test('orderless debt request discovers and verifies acquisition or header order basis, never catalogue amounts',async(t)=>{
  const oldEnv={...process.env};t.after(()=>{process.env=oldEnv;});
  process.env['1C_BASE_URL']='https://one-c.invalid';process.env['1C_API_USER']='test';process.env['1C_API_PASSWORD']='test';
  const refs=['11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222'];
  const date=new Intl.DateTimeFormat('ru-RU',{timeZone:'Europe/Moscow',day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date())+' 00:00:00';
  let base='',omit=false,reads=0;
  t.mock.method(globalThis,'fetch',async(input:string)=>{
    const url=new URL(input);
    if(url.pathname.includes('supplier-currency'))return Response.json({ok:true,rows:[]});
    if(url.pathname.includes('currency-cash-costing-plan'))return Response.json({ok:true,events:[{event_type:'supplier_payment',ref:'rko',number:'test',date,currency_amount:100,base_document_ref:base,partner:'Supplier'}]});
    if(url.pathname.includes('supplier-order-finance-control')){
      reads++;return Response.json({ok:true,catalogue_complete:false,request_orders:(omit?refs.slice(0,1):refs).map(ref=>({ref,supplier_partner:'Supplier',amount:999999}))});
    }
    if(url.pathname.includes('supplier-settlements')){
      const ref=url.searchParams.get('order_ref');
      return Response.json({ok:true,complete:true,write_operations:false,contract_version:'supplier-document-evidence-v1',as_of:new Date().toISOString(),
        order:[{order_ref:ref,supplier_name:'Supplier',posted:true,deleted:false}],receipts:[{receipt_ref:'receipt-'+ref,posted:true}],
        due_date_movements:[{recorder_ref:'register-'+ref,line_number:1,source_recorder_ref:'rko',settlement_object_ref:ref,settlement_document_ref:'receipt-'+ref,movement_date:date,movement_type:'Расход',raw_debt:50,raw_prepayment:0,currency_name:'руб'}]});
    }
    return Response.json({ok:true,cash_expense_orders:[]});
  });
  const read=()=>fetchSupplierCurrencyPaymentSnapshot({from:new Date(Date.now()-86400000),to:new Date(),plans:[{supplierPartner:'Supplier',orderRefs:[]}]});
  const p=(await read()).payments[0];assert.deepEqual(p.settlementOrderRefs,refs);assert.equal(hasConfirmedPaymentBasis(p),true);assert.equal(reads,1);
  omit=true;assert.equal(hasConfirmedPaymentBasis((await read()).payments[0]),false,'partial discovery is not proof of a whole RKO');
  base=refs[0];assert.equal((await read()).payments[0].verifiedHeaderOrderRef,refs[0]);
  base='unknown-document';assert.equal(hasConfirmedPaymentBasis((await read()).payments[0]),false);
});

test('history reads only periods usable by headerless RKOs while current header state is always rechecked', async t => {
  const env={...process.env};t.after(()=>{process.env=env;});
  process.env['1C_BASE_URL']='https://one-c.invalid';process.env['1C_API_USER']='test';process.env['1C_API_PASSWORD']='test';
  const order='11111111-1111-4111-8111-111111111111';
  const now=new Date(),day=(ago:number)=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now.getTime()-ago*86400000));
  const at=(ago:number)=>day(ago)+'T12:00:00+03:00';
  let active=true;const windows:string[]=[];
  t.mock.method(globalThis,'fetch',async(input:string)=>{
    const url=new URL(input);
    if(url.pathname.includes('supplier-currency'))return Response.json({ok:true,rows:[
      {ref:'header-rko',date:at(65),posted:true,deleted:false,document_amount:10,document_currency:'USDT',supplier_partner:'Supplier',contract:'Contract',base_document_ref:order},
      {ref:'unlinked-rko',date:at(35),posted:true,deleted:false,document_amount:20,document_currency:'USDT',supplier_partner:'Supplier',base_document_ref:'',settlement_amount:200,settlement_currency:'руб',settlement_movements_count:1},
    ]});
    if(url.pathname.includes('currency-cash-costing-plan'))return Response.json({ok:true,events:[]});
    if(url.pathname.includes('supplier-order-finance-control'))return Response.json({ok:true,request_orders:[]});
    if(url.pathname.includes('supplier-settlements')){
      assert.equal(url.searchParams.get('detail'),'document-evidence');
      const from=url.searchParams.get('date_from')!,to=url.searchParams.get('date_to')!;windows.push(to);
      const historical=from<=day(35)&&to>=day(35);
      return Response.json({ok:true,complete:true,write_operations:false,contract_version:'supplier-document-evidence-v1',
        as_of:to===day(0)?new Date().toISOString():to+'T23:59:59+03:00',
        order:[{order_ref:order,supplier_name:'Supplier',posted:active,deleted:!active}],
        due_date_movements:historical?[{source_recorder_ref:'unlinked-rko',settlement_object_ref:order,settlement_document_ref:'unlinked-rko',movement_date:at(35),movement_type:'Приход',raw_debt:0,raw_prepayment:200,currency_name:'руб'}]:[]});
    }
    return Response.json({ok:true,cash_expense_orders:[]});
  });
  const read=()=>fetchSupplierCurrencyPaymentSnapshot({from:new Date(now.getTime()-70*86400000),to:now,plans:[{supplierPartner:'Supplier',orderRefs:[order]},{supplierPartner:'Supplier',orderRefs:[]}]});
  const result=await read();assert.equal(result.complete,true);
  assert.deepEqual(windows,[day(0),day(31)],'the header-only period at day 62 is unused; headerless history is retained');
  assert.equal(result.payments[0].verifiedHeaderOrderRef,order);
  assert.equal(result.payments[1].settlementOrderRef,order);
  active=false;windows.length=0;
  const reversed=await read();
  assert.equal(reversed.payments[0].verifiedHeaderOrderRef,undefined);
  assert.equal(reversed.payments[1].settlementOrderRef,undefined);
  assert.deepEqual(windows,[day(0),day(31)]);
});

test('whole display reads join a running reconciliation, isolate results, and discard completed reads and errors', async t => {
  const env={...process.env};t.after(()=>{process.env=env;});
  process.env['1C_BASE_URL']='https://one-c.invalid';process.env['1C_API_USER']='test';process.env['1C_API_PASSWORD']='test';
  let calls=0,fail=false,release!:()=>void;
  let gate=new Promise<void>(resolve=>{release=resolve;});
  t.mock.method(globalThis,'fetch',async(input:string)=>{
    calls++;await gate;
    if(fail)throw Error('SOURCE_FAILED');
    const url=new URL(input);
    return Response.json(url.pathname.includes('supplier-currency')?{ok:true,rows:[]}:
      url.pathname.includes('currency-cash-costing-plan')?{ok:true,events:[]}:{ok:true,cash_expense_orders:[]});
  });
  const input={from:new Date('2026-01-01'),to:new Date('2026-01-02'),plans:[]};
  const first=fetchSupplierCurrencyPaymentDisplaySnapshot(input),second=fetchSupplierCurrencyPaymentDisplaySnapshot(input);
  await new Promise(resolve=>setImmediate(resolve));assert.equal(calls,3);
  release();const [a,b]=await Promise.all([first,second]);
  a.payments.push({ref:'changed'} as any);assert.deepEqual(b.payments,[]);
  await fetchSupplierCurrencyPaymentDisplaySnapshot(input);assert.equal(calls,6,'a later screen read must fetch again');
  await fetchSupplierCurrencyPaymentSnapshot(input);assert.equal(calls,9,'financial source stays independently fresh');
  fail=true;gate=new Promise<void>(resolve=>{release=resolve;});
  const failed=Promise.allSettled([fetchSupplierCurrencyPaymentDisplaySnapshot(input),fetchSupplierCurrencyPaymentDisplaySnapshot(input)]);
  await new Promise(resolve=>setImmediate(resolve));assert.equal(calls,12);release();
  assert.ok((await failed).every(row=>row.status==='rejected'));
  fail=false;await fetchSupplierCurrencyPaymentDisplaySnapshot(input);assert.equal(calls,15,'a failed read never blocks a fresh retry');
});

test('late display joins reuse the whole graph but changed manual links and financial reads start fresh graphs', async t => {
  const env={...process.env};t.after(()=>{process.env=env;});
  process.env['1C_BASE_URL']='https://one-c.invalid';process.env['1C_API_USER']='test';process.env['1C_API_PASSWORD']='test';
  const order='11111111-1111-4111-8111-111111111111',now=new Date();
  const date=new Intl.DateTimeFormat('ru-RU',{timeZone:'Europe/Moscow',day:'2-digit',month:'2-digit',year:'numeric'}).format(now)+' 00:00:00';
  let calls=0,release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});
  t.mock.method(globalThis,'fetch',async(input:string)=>{
    calls++;const url=new URL(input);
    if(url.pathname.includes('supplier-currency'))return Response.json({ok:true,rows:[{ref:'rko',date,posted:true,deleted:false,document_amount:1,document_currency:'USDT',supplier_partner:'Supplier',base_document_ref:''}]});
    if(url.pathname.includes('currency-cash-costing-plan'))return Response.json({ok:true,events:[]});
    if(url.pathname.includes('supplier-settlements')){
      await gate;
      return Response.json({ok:true,complete:true,write_operations:false,contract_version:'supplier-document-evidence-v1',as_of:new Date().toISOString(),order:[{order_ref:order,supplier_name:'Supplier',posted:true,deleted:false}],due_date_movements:[]});
    }
    return Response.json({ok:true,cash_expense_orders:[]});
  });
  const input={from:new Date(now.getTime()-86400000),to:now,plans:[{supplierPartner:'Supplier',orderRefs:[order],oneCCashEvidence:{}}]};
  const first=fetchSupplierCurrencyPaymentDisplaySnapshot(input);
  await new Promise(resolve=>setImmediate(resolve));assert.equal(calls,4);
  const late=fetchSupplierCurrencyPaymentDisplaySnapshot({...input,plans:[{...input.plans[0],oneCCashEvidence:{lastCompletePaymentView:{verifiedAt:'changed'}}}]});
  await new Promise(resolve=>setImmediate(resolve));assert.equal(calls,4,'saving display evidence does not restart source reconciliation');
  const fresh=fetchSupplierCurrencyPaymentSnapshot(input);
  await new Promise(resolve=>setImmediate(resolve));assert.equal(calls,7,'a financial action rereads the document lists even during a display scan');
  const changed=fetchSupplierCurrencyPaymentDisplaySnapshot({...input,plans:[{...input.plans[0],oneCCashEvidence:{manualRubleLinks:[{ref:'rko',fingerprint:'changed'}]}}]});
  await new Promise(resolve=>setImmediate(resolve));assert.equal(calls,10,'manual payment identity changes cannot join a prior display scan');
  release();await Promise.all([first,late,fresh,changed]);
});
