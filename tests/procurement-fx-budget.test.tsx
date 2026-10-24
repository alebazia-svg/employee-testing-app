import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';

test('saved FX budget stays visible with explicit request rate; no invented rate',async()=>{
  const output=await build({entryPoints:['components/ProcurementFxBudget.tsx'],bundle:true,write:false,platform:'node',format:'cjs',packages:'external',jsx:'automatic'});
  const module={exports:{} as {ProcurementFxBudget:React.ComponentType<any>}};
  new Function('require','module','exports',output.outputFiles[0].text)(createRequire(import.meta.url),module,module.exports);
  const render=(patch={})=>renderToStaticMarkup(React.createElement(module.exports.ProcurementFxBudget,{method:'USDT',foreignAmount:5445,rubles:468270,rate:86,...patch})).replace(/\u00a0/g,' ');
  assert.match(render(),/468 270/);assert.match(render(),/Курс заявки: 86 ₽ \/ USDT/);
  assert.match(render({method:'CNY'}),/CNY/);
  assert.doesNotMatch(render({rate:0}),/Курс заявки/);
  for(const patch of [{foreignAmount:0},{rubles:NaN},{method:'CASH'}])assert.equal(render(patch),'');
  const source=readFileSync('app/(dashboard)/admin/procurement/AdminProcurementClient.tsx','utf8');
  assert.equal((source.match(/<ProcurementFxBudget /g)||[]).length,2,'pending and approved cards share budget display');
});

test('manual review offers RUB RKO for USDT budget with the same excess bounds',async()=>{
  const output=await build({entryPoints:['components/ProcurementUnlinkedPayments.tsx'],bundle:true,write:false,platform:'node',format:'cjs',packages:'external',jsx:'automatic',plugins:[{name:'router',setup(b){
    b.onResolve({filter:/^next\/navigation$/},()=>({path:'router',namespace:'mock'}));
    b.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:'export const useRouter=()=>({refresh(){}});',loader:'js'}));
  }}]});
  const module={exports:{} as {ProcurementUnlinkedPayments:React.ComponentType<any>}};
  new Function('require','module','exports',output.outputFiles[0].text)(createRequire(import.meta.url),module,module.exports);
  const payment={ref:'rko',number:'TEST',date:'24.10.2026 17:35:45',posted:true,deleted:false,documentAmount:468300,documentCurrency:'РУБ',baseDocumentRef:'',supplier:'Supplier',contract:'Contract'};
  const plan={id:'usdt-plan',supplierPartner:'Supplier',supplierCounterparty:'',orderNumbers:[],remaining:468270,remainingForeign:5445,status:'APPROVED',paymentMethod:'USDT'};
  const render=(patch={})=>renderToStaticMarkup(React.createElement(module.exports.ProcurementUnlinkedPayments,{payments:[payment],plans:[plan],linked:[],allowSmallExcess:true,...patch}));
  assert.match(render(),/value="usdt-plan"/);
  assert.doesNotMatch(render({allowSmallExcess:false}),/value="usdt-plan"/);
  assert.doesNotMatch(render({plans:[{...plan,hasPendingRevision:true}]}),/value="usdt-plan"/);
  assert.doesNotMatch(render({payments:[{...payment,documentAmount:468771}]}),/value="usdt-plan"/);
});
