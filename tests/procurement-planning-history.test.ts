import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';

test('reader follows advance creation older than receipt and clears failed supplier cache', async t => {
  const originalFetch=globalThis.fetch;
  t.after(()=>{globalThis.fetch=originalFetch;});
  const windows:string[]=[], now=new Date('2026-09-24T09:00:00Z');
  let supplierCalls=0;
  globalThis.fetch=(async input=>{
    const url=new URL(String(input)),kind=url.searchParams.get('detail');
    if(kind==='document-evidence') {
      const from=url.searchParams.get('date_from')!;windows.push(from);
      return Response.json({complete:true,contract_version:'supplier-document-evidence-v1',as_of:'24.09.2026 12:00:00',
        order:[{order_ref:'order'}],receipts:[{receipt_ref:'receipt',receipt_date:'15.09.2026 00:00:00'}],
        movement_date_from:'25.08.2026 00:00:00',due_date_movements:from==='2026-08-25'
          ? [{source_recorder_ref:'receipt',movement_type:'Расход',raw_prepayment:1000,settlement_document_ref:'cash'}]
          : [{source_recorder_ref:'cash',movement_type:'Приход',raw_prepayment:1000,settlement_document_ref:'cash'}]});
    }
    if(kind==='reconciliation') {
      supplierCalls++;
      if(supplierCalls===1)throw Error('NETWORK_TIMEOUT');
      return Response.json({as_of:'24.09.2026 12:00:00',supplier:[{supplier_ref:'supplier',supplier_name:'Supplier'}]});
    }
    return Response.json({});
  }) as typeof fetch;
  const bundle=await build({entryPoints:['lib/procurement-planning-sync.ts'],bundle:true,write:false,platform:'node',format:'cjs',packages:'external',plugins:[{name:'reader-mocks',setup(b){
    b.onResolve({filter:/\/(one-c-env|procurement-reconciliation-total-check)$/},a=>({path:a.path.split('/').pop()!,namespace:'mock'}));
    b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:a.path==='one-c-env'
      ? "export const readOneCRuntimeEnv=()=>({baseUrl:'https://test.invalid',user:'test',password:'test'});"
      : 'export const supplierTotalCheck=()=>true;',loader:'js'}));
  }}]});
  const module={exports:{} as any};
  new Function('require','module','exports',bundle.outputFiles[0].text)(createRequire(import.meta.url),module,module.exports);
  const reader=module.exports.planningReader(now);
  const detail=await reader.detail('order',[{ref:'cash',date:'24.08.2026 12:00:00'}]);
  assert.deepEqual(windows,['2026-08-25','2026-07-25']);
  assert.equal(detail.due_date_movements.length,2);
  assert.equal(detail.movement_date_from,'2026-07-25T00:00:00+03:00');
  await assert.rejects(reader.supplier('order','supplier'),/NETWORK_TIMEOUT/);
  await reader.supplier('order','supplier');
  await reader.supplier('order','supplier');
  assert.equal(supplierCalls,2,'a failed promise is retriable; successful source is shared');
});
