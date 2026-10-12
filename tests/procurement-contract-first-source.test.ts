import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {paymentFingerprint} from '../lib/procurement-manual-payment-links';
import {matchProcurementPaymentEvidence} from '../lib/procurement-currency-payment-evidence';

test('contract-first reads preserve order allocation and manual links, and fail closed on invalid proof',async()=>{
  const out=await build({entryPoints:['lib/procurement-currency-payment-source.ts'],bundle:true,write:false,format:'cjs',platform:'node',packages:'external',plugins:[{name:'fixture-env',setup(b){
    b.onResolve({filter:/one-c-env$/},()=>({path:'env',namespace:'fixture'}));
    b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:"export const readOneCRuntimeEnv=()=>({baseUrl:'https://fixture.invalid',user:'test',password:'test'});",loader:'js'}));
  }}]});
  const mod={exports:{} as any};new Function('require','module','exports',out.outputFiles[0].text)(createRequire(import.meta.url),mod,mod.exports);
  const ref=(n:number)=>`11111111-1111-4111-8111-${String(n).padStart(12,'0')}`;
  const now=new Date(),stamp=new Date(now.getTime()-3600000+3*3600000).toISOString();
  const date=`${stamp.slice(8,10)}.${stamp.slice(5,7)}.${stamp.slice(0,4)} ${stamp.slice(11,19)}`;
  const dimensions={supplier_ref:ref(2),counterparty_ref:ref(3),organization_ref:ref(4),currency_ref:ref(5)};
  const raw={event_type:'supplier_payment',ref:ref(1),number:'TEST',date,currency_amount:100,base_document_ref:'',cashbox:'',partner:'Supplier',counterparty:'Company',contract:''};
  const originalPayment={ref:raw.ref,number:raw.number,date,documentCurrency:'РУБ',documentAmount:100,baseDocumentRef:'',supplier:'Supplier',counterparty:'Company',contract:'',posted:true,deleted:false};
  const debt={id:'debt',planCode:'DEBT',status:'APPROVED',supplierPartner:'Supplier',supplierCounterparty:'Company',orderRefs:[],plannedAmount:100,paymentMethod:'CASH',createdAt:new Date(now.getTime()-2*86400000).toISOString()};
  const order={...debt,id:'order',planCode:'ORDER',orderRefs:[ref(9)]};
  const originalFetch=globalThis.fetch;
  try {
    for(const scenario of ['contract','order','manual','unsupported','incomplete','mismatch','cancelled']) {
      const calls:string[]=[];
      globalThis.fetch=async(input)=>{
        const u=new URL(String(input));assert.equal(u.host,'fixture.invalid');
        const endpoint=u.pathname.slice(1),detail=u.searchParams.get('detail')||'';
        calls.push(endpoint+':'+detail);
        let payload:any;
        if(endpoint==='supplier-currency-payment-diagnostics')payload={ok:true,rows:[]};
        else if(endpoint==='currency-exchange-diagnostics')payload={ok:true,cash_expense_orders:[]};
        else if(endpoint==='currency-cash-costing-plan')payload={ok:true,events:[raw]};
        else if(endpoint==='supplier-order-finance-control')payload={ok:true,request_orders:[{ref:ref(9),supplier_partner:'Supplier'}]};
        else if(detail==='payment-basis')payload=scenario==='unsupported'?{ok:true,rows:[]}:{ok:true,complete:scenario!=='incomplete',write_operations:false,contract_version:'supplier-payment-basis-v1',as_of:new Date().toISOString(),
          payment:[{...dimensions,payment_ref:raw.ref,payment_number:raw.number,payment_date:date,amount:scenario==='mismatch'?99:100,supplier_name:'Supplier',counterparty_name:'Company',currency_name:'руб',posted:scenario!=='cancelled',deleted:false,supplier_payment:true,version_token:'v1'}],
          movements:[{...dimensions,payment_ref:raw.ref,line_number:1,movement_date:date,amount:100,movement_type:'Приход',currency_name:'руб',contract_ref:ref(6),contract_name:'Contract'}]};
        else if(detail==='document-evidence')payload={ok:true,complete:true,truncated:false,write_operations:false,contract_version:'supplier-document-evidence-v1',as_of:new Date().toISOString(),
          order:[{order_ref:ref(9),supplier_name:'Supplier',posted:true,deleted:false}],receipts:[],
          due_date_movements:[{source_recorder_ref:raw.ref,settlement_document_ref:raw.ref,settlement_object_ref:ref(9),movement_type:'Приход',raw_debt:0,raw_prepayment:100,movement_date:date,currency_name:'руб'}]};
        else throw Error('Unexpected fixture read');
        return Response.json(payload);
      };
      const manual={...debt,oneCCashEvidence:{manualRubleLinks:[{ref:raw.ref,fingerprint:paymentFingerprint(originalPayment)}]}};
      const plans=scenario==='order'?[debt,order]:scenario==='manual'?[manual]:[debt];
      const read=()=>mod.exports.fetchSupplierCurrencyPaymentSnapshot({from:new Date(now.getTime()-3*86400000),to:now,plans});
      if(['incomplete','mismatch'].includes(scenario)){await assert.rejects(read,/PAYMENT_BASIS_/);continue;}
      const snapshot=await read();assert.equal(snapshot.complete,true);
      if(scenario==='contract'){
        assert.equal(snapshot.payments[0].registerContractBasis.contracts.length,1);
        assert.equal(calls.length,4,'three lists plus exact payment proof, without order catalogue');
        assert.equal(matchProcurementPaymentEvidence([debt],[],snapshot.payments,[]).get('debt')!.issuedAmount,100);
        calls.length=0;await read();assert.equal(calls.length,4,'next read must fetch fresh data, not reuse settled proof');
      }
      if(scenario==='order'){
        assert.ok(calls.includes('supplier-settlements:document-evidence'),'explicit order must always be checked');
        assert.equal(snapshot.payments[0].settlementOrderRef,ref(9));
        assert.equal(snapshot.payments[0].registerContractBasis,undefined,'retain the existing proof shape');
        const allocation=matchProcurementPaymentEvidence([debt,order],[],snapshot.payments,[]);
        assert.equal(allocation.get('order')!.issuedAmount,100);
        assert.equal(allocation.get('debt')!.issuedAmount,0,'never assign a payment twice');
      }
      if(scenario==='manual'){
        assert.ok(calls.includes('supplier-order-finance-control:'));
        assert.ok(!calls.includes('supplier-settlements:payment-basis'),'manual supplier keeps original proof path');
        assert.equal(paymentFingerprint(snapshot.payments[0]),paymentFingerprint(originalPayment));
      }
      if(scenario==='unsupported'){
        assert.ok(calls.includes('supplier-order-finance-control:'));
        assert.equal(snapshot.payments[0].settlementOrderRef,ref(9),'fallback still verifies native order');
      }
      if(scenario==='cancelled'){
        assert.equal(snapshot.payments[0].posted,false);
        assert.equal(matchProcurementPaymentEvidence([debt],[],snapshot.payments,[]).get('debt')!.issuedAmount,0);
      }
    }
  } finally {globalThis.fetch=originalFetch;}
});
