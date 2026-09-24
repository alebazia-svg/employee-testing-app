import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeSupplierSettlement,summarizeSupplierSettlements} from '../lib/procurement-supplier-settlements';
import {buyerOrderPurpose,supplierPosition,supplierPositionSummary} from '../lib/procurement-supplier-position';
const row=(balance:number,contract='Договор',organization='Организация',currency='руб')=>({supplierPartner:'Supplier',supplierCounterparty:'Supplier',currency,closingBalance:balance,contract,organization});
const summarize=(rows:ReturnType<typeof row>[])=>summarizeSupplierSettlements(rows,['Supplier']).bySupplier.Supplier;
test('owner-approved omitted contract nets within a single legal and currency scope without declaring orders paid',()=>{
  const zero=summarize([row(499364.16),row(-499364.16,'')]);
  assert.equal(supplierPosition(zero),'no-debt');
  assert.equal(zero.debt,0);
  const order={orderPaymentGap:499364.16,planningState:'needs_review',paymentClosure:undefined};
  assert.equal(buyerOrderPurpose(order,zero),'history');
  assert.equal(order.planningState,'needs_review');
  assert.equal(buyerOrderPurpose({...order,noAcquisitions:{}},zero),'prepayment');
  const remaining=summarize([row(42550),row(-85050,'')]);
  assert.equal(supplierPosition(remaining),'debt');
  assert.equal(remaining.debt,42500);
  const advance=summarize([row(168502.7),row(-150242,'')]);
  assert.equal(supplierPosition(advance),'no-debt');
  assert.equal(advance.advance,18260.7);
});
test('real supplier debt survives regardless of age and tiny balances are not rounded away',()=>{
  for(const debt of [1416709.59,0.25])assert.equal(supplierPosition(summarize([row(-debt)])),'debt');
});
test('different legal scopes, currencies and real named contracts never silently offset',()=>{
  for(const rows of [[row(100),row(-100,'','Other organization')],[row(100),row(-100,'','Организация','USD')],[row(100),row(-100,'Other contract')]]){
    const balance=summarize(rows);assert.equal(supplierPosition(balance),'review');
    assert.deepEqual(supplierPositionSummary({Supplier:balance}),{debt:0,reviewCount:1});
  }
});
test('duplicate rows, missing legal identity and legacy balances fail closed',()=>{
  assert.equal(supplierPosition(summarize([row(-100),row(-100)])),'review');
  assert.equal(supplierPosition(summarize([{...row(-100),organization:''}])),'review');
  assert.equal(supplierPosition({debt:100,advance:0,closingBalance:-100}),'review');
  assert.equal(supplierPosition(), 'review');
  assert.equal(normalizeSupplierSettlement({supplier_partner:'Supplier',closing_balance:'bad'}),null);
});
