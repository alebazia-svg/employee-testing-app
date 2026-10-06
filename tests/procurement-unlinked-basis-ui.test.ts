import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const require=createRequire(import.meta.url);

test('ADMIN keeps an unbased RKO visible without a confirm action; verified chains remain assignable',async()=>{
  const bundle=await build({entryPoints:['components/ProcurementUnlinkedPayments.tsx'],bundle:true,write:false,platform:'node',format:'cjs',packages:'external',jsx:'automatic'});
  const mod={exports:{} as any};
  new Function('require','module','exports',bundle.outputFiles[0].text)((name:string)=>name==='next/navigation'?{useRouter:()=>({refresh(){}})}:require(name),mod,mod.exports);
  const payment={ref:'rko',number:'TEST',date:'01.10.2026 12:00:00',supplier:'Supplier',baseDocumentRef:'',documentAmount:100,documentCurrency:'РУБ',posted:true,deleted:false};
  const plans=[{id:'p',supplierPartner:'Supplier',supplierCounterparty:'',orderRefs:[],orderNumbers:[],remaining:100,remainingForeign:null,status:'APPROVED',paymentMethod:'CASH'}];
  const render=(p:typeof payment)=>renderToStaticMarkup(React.createElement(mod.exports.ProcurementUnlinkedPayments,{payments:[p],plans,linked:[]}));
  const unbased=render(payment);
  assert.match(unbased,/РКО TEST/);assert.match(unbased,/Не удалось проверить основание оплаты/);assert.doesNotMatch(unbased,/<select|>Подтвердить</);
  assert.doesNotMatch(unbased,/Договор не указан|Проверьте договор или заказ/);
  assert.doesNotMatch(render({...payment,...{contract:'  '}}),/Договор не указан|<select/);
  for(const patch of [{contract:'Contract'},{requestOrderRef:'order'},{settlementOrderRefs:['o1','o2']}]){
    const based=render({...payment,...patch});assert.match(based,/<select/);assert.match(based,/Основание в 1С подтверждено/);
    assert.doesNotMatch(based,/Договор не указан|Не удалось проверить/);
  }
});
