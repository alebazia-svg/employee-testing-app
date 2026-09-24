import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { procurementSourceHealth } from '../lib/procurement-source-health';
import { buyerPaymentComment, preservePaymentReview, splitPaymentReview } from '../lib/procurement-buyer-comment';
import { reviewRequestCondition } from '../lib/procurement-order-selection';
import { buyerReviewScenario } from '../app/procurement-payment-review/scenarios';

test('each incomplete payment source and failed plans query has an independent error, empty success is valid',()=>{
  const ok = <T,>(value:T):PromiseFulfilledResult<T>=>({status:'fulfilled',value});
  const fail:PromiseRejectedResult={status:'rejected',reason:Error('offline')};
  const requests=ok({complete:true}),payments=ok({complete:true,rubPaymentsSupported:true});
  assert.deepEqual(procurementSourceHealth(ok([]),requests,payments),{plansSourceError:false,evidenceSourceError:false});
  assert.equal(procurementSourceHealth(fail,requests,payments).plansSourceError,true);
  for(const r of [fail,ok({complete:false})]) assert.equal(procurementSourceHealth(ok([]),r,payments).evidenceSourceError,true);
  for(const p of [fail,ok({complete:false,rubPaymentsSupported:true}),ok({complete:true,rubPaymentsSupported:false})]) assert.equal(procurementSourceHealth(ok([]),requests,p).evidenceSourceError,true);
});
test('legacy review envelope is retained for ADMIN but hidden from the buyer, including repeated wrapping',()=>{
  const rows=[{planningState:'needs_review',number:'123',planningReason:'Есть аванс'}];
  const full=reviewRequestCondition(rows,'Позвонить после 15:00');
  assert.equal(buyerPaymentComment(full),'Позвонить после 15:00');
  assert.match(splitPaymentReview(full).review,/Есть аванс/);
  const edited=preservePaymentReview(full,'Новая договорённость');
  assert.equal(buyerPaymentComment(edited),'Новая договорённость');
  assert.equal(splitPaymentReview(edited).review,splitPaymentReview(full).review);
  assert.equal(reviewRequestCondition(rows,full),full,'resubmission does not duplicate the envelope');
  assert.equal(buyerPaymentComment(reviewRequestCondition(rows,'Оплата по выбранным заказам')),'');
  const unusual='Мой текст\nОснование закупщика: не служебный текст';
  assert.equal(buyerPaymentComment(unusual),unusual);
  assert.equal(buyerPaymentComment('Нужна сверка перед оплатой. Личная заметка'),'Нужна сверка перед оплатой. Личная заметка');
});

let renderer:Promise<(props:unknown)=>string>;
function render(props:unknown) {
  renderer ??= (async()=>{
    const output=await build({stdin:{contents:`import React from 'react'; import {renderToStaticMarkup} from 'react-dom/server'; import Calendar from './app/(dashboard)/procurement/ProcurementPaymentCalendarClient'; export const render=p=>renderToStaticMarkup(<Calendar {...p}/>);`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'node',format:'cjs',packages:'external',jsx:'automatic',plugins:[{name:'router',setup(b){b.onResolve({filter:/^next\/navigation$/},()=>({path:'navigation',namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:'export const useRouter=()=>({refresh(){}});'}));}}]});
    const module={exports:{} as {render:(p:unknown)=>string}};
    new Function('require','module','exports',output.outputFiles[0].text)(createRequire(import.meta.url),module,module.exports);
    return module.exports.render;
  })();
  return renderer.then(fn=>fn(props));
}
test('real calendar renders request stages, partial RUB remainder, paid history and buyer comment',async()=>{
  const props=buyerReviewScenario('lifecycle','2026-09-24')!;
  const html=await render({...props,basisPreview:false});
  assert.match(html,/ЧАСТИЧНО ОПЛАЧЕНО/);assert.match(html,/Оплачено 40\s000,00.*осталось по заявке 60\s000,00/);
  assert.match(html,/НА СОГЛАСОВАНИИ/);assert.match(html,/НУЖНО ИСПРАВИТЬ/);assert.match(html,/Оплачено полностью/);
  assert.match(html,/Подготовить к обеду/);assert.doesNotMatch(html,/служебная проверка|Основание закупщика|Нужна сверка перед оплатой|Учебная отменённая заявка/);
});
test('failed plan load never renders empty success, new actions or zero reserves',async()=>{
  const html=await render({...buyerReviewScenario('plans-unavailable','2026-09-24'),basisPreview:false});
  assert.match(html,/Не удалось загрузить заявки/);assert.doesNotMatch(html,/Заявок пока нет|Добавить оплаты|Запланировать оплату|На согласовании: 0/);
  assert.doesNotMatch(html,/>Свободно<[^]*?>25\s000/);
  assert.match(html,/Резервы неизвестны/);
});
test('incomplete payment source hides paid conclusions and blocks editing, preserving visible requests',async()=>{
  const html=await render({...buyerReviewScenario('payments-unavailable','2026-09-24'),basisPreview:false});
  assert.match(html,/Оплаты из 1С сейчас не проверены/);assert.match(html,/Учебный поставщик/);
  assert.doesNotMatch(html,/Оплачено полностью|ЧАСТИЧНО ОПЛАЧЕНО|Добавить оплаты|>Изменить</);
});
test('missing settlements block new actions without showing a false zero supplier debt',async()=>{
  const html=await render({...buyerReviewScenario('lifecycle','2026-09-24'),supplierDebtError:true,basisPreview:false});
  assert.match(html,/Долги поставщикам сейчас не проверены/);
  assert.match(html,/Учебный поставщик/);
  assert.doesNotMatch(html,/Добавить оплаты|Запланировать оплату|>Изменить</);
  assert.match(html,/Долг поставщикам по 1С<[^]*?—/);
});
test('preparation date is not represented as supplier overdue debt',async()=>{
  const html=await render({...buyerReviewScenario('lifecycle','2026-09-23'),todayKey:'2026-09-24'});
  assert.match(html,/Дата подготовки прошла/);assert.doesNotMatch(html,/Просрочено|Дата оплаты уже прошла/);
});
test('edit never replaces amount with order nominal value; save remains disabled in preview and incomplete data',async()=>{
  const source=await readFile('app/(dashboard)/procurement/ProcurementPaymentCalendarClient.tsx','utf8');
  assert.doesNotMatch(source,/estimateRoubles|selected\.reduce.*order\.amount/);
  const toggle=source.slice(source.indexOf('function toggleOrder'),source.indexOf('async function submit'));
  assert.doesNotMatch(toggle,/plannedAmount:/);
  assert.match(source,/basisPreview \|\| planningBlocked/);
  assert.match(source,/Когда подготовить деньги/);
});

test('supplier position replaces acquisition totals and old no-debt orders are not suggested',async()=>{
  const props=buyerReviewScenario('order-evidence','2026-09-25')!;
  const base=props.initialOrders[0];
  const old={...base,ref:'old-open',number:'OLD-OPEN',date:'21.12.2023',
    outstandingAcquisitions:{checkedAt:props.checkedAt}};
  const html=await render({...props,supplierDebtError:false,supplierBalances:{[base.supplierPartner]:{debt:0,advance:0,closingBalance:0,reviewRequired:false}},initialOrders:[old,{...base,ref:'old-unproven',number:'OLD-UNPROVEN',date:'20.12.2023'}]});
  assert.doesNotMatch(html,/OLD-OPEN/);
  assert.doesNotMatch(html,/OLD-UNPROVEN/);
  assert.match(html,/Долг поставщикам по 1С/);
  assert.doesNotMatch(html,/Подтверждённая часть|900\s000/);
  const debtHtml=await render({...props,supplierDebtError:false,supplierBalances:{[base.supplierPartner]:{debt:1000,advance:0,closingBalance:-1000,reviewRequired:false}},initialOrders:[old]});
  assert.match(debtHtml,/OLD-OPEN/);
  assert.match(debtHtml,/1\s000,00/);
});
