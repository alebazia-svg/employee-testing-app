import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const require=createRequire(import.meta.url);

test('manual links leave the review queue only while confirmed; history retains the undo action',async()=>{
  const bundle=await build({entryPoints:['components/ProcurementUnlinkedPayments.tsx'],bundle:true,write:false,platform:'node',format:'cjs',packages:'external',jsx:'automatic'});
  const mod={exports:{} as any};
  new Function('require','module','exports',bundle.outputFiles[0].text)((name:string)=>name==='next/navigation'?{useRouter:()=>({refresh(){}})}:require(name),mod,mod.exports);
  const confirmed={planId:'p1',ref:'r1',label:'Confirmed supplier · PAY-1 · РКО 101',confirmed:true};
  const changed={planId:'p2',ref:'r2',label:'Changed supplier · PAY-2',confirmed:false};
  const render=(linked:typeof confirmed[],view:'review'|'history'='review')=>renderToStaticMarkup(React.createElement(mod.exports.ProcurementUnlinkedPayments,{payments:[],plans:[],linked,view}));
  assert.equal(render([]),'');
  assert.equal(render([confirmed]),'','resolved-only queue must be absent');
  const review=render([confirmed,changed]);
  assert.match(review,/Платежи для проверки · 1/);
  assert.match(review,/Changed supplier|Привязка требует проверки/);
  assert.doesNotMatch(review,/Confirmed supplier|Зачтено вручную/);
  const history=render([confirmed,changed],'history');
  assert.match(history,/Зачтено вручную · 1/);
  assert.match(history,/Confirmed supplier/);
  assert.match(history,/Отменить привязку/);
  assert.doesNotMatch(history,/Changed supplier|Платежи для проверки|Привязка требует проверки/);
  assert.equal(render([changed],'history'),'');
  assert.match(render([{...confirmed,confirmed:false}]),/Привязка требует проверки/,'a changed document returns to review');
});

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
