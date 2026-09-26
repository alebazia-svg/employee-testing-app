import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchSupplierCurrencyPaymentSnapshot } from '../lib/procurement-currency-payment-source';

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
