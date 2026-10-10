import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('receipt modal centers despite parent space-y sibling margins and scrolls when tall',()=>{
  const css=read('components/procurement-receipts.css');
  const rule=css.match(/\.procurement-receipts-dialog\s*\{([^}]+)\}/)?.[1]||'';
  for(const declaration of ['position:fixed','inset:0','margin:auto!important','max-height:calc(100dvh - 24px)','overflow-y:auto'])assert.ok(rule.includes(declaration));
});
test('buyer cash summary keeps the approved compact three-column layout and visible values',()=>{
  const calendar=read('app/(dashboard)/procurement/ProcurementPaymentCalendarClient.tsx');
  const summary=calendar.slice(calendar.indexOf('function BalanceSummary('));
  assert.match(summary,/grid grid-cols-3 gap-2/);
  assert.doesNotMatch(summary,/truncate|space-y-1\.5/);
  assert.match(calendar,/freeLabel=\{freeUsdt[^\n]+"Не хватает" : "Свободно"/);
  assert.equal((calendar.match(/availableLabel="Остаток"/g)||[]).length,2);
});

test('calendar routes both existing forms through one modal and preserves discard protection',()=>{
  const calendar=read('app/(dashboard)/procurement/ProcurementPaymentCalendarClient.tsx');
  assert.match(calendar,/<ProcurementPaymentDialog[^>]+onClose=\{requestClosePaymentForm\}/);
  assert.match(calendar,/<ProcurementDiscardDraftDialog/);
  assert.doesNotMatch(calendar,/id="payment-plan-form"/);
  assert.match(calendar,/returnFocus=\{paymentFormOpener.current\}/);
});

test('modal has native focus containment, named heading, busy guard and scroll cleanup',()=>{
  const modal=read('components/ProcurementPaymentDialog.tsx');
  assert.match(modal,/dialog.showModal\(\)/);
  assert.match(modal,/aria-labelledby=\{titleId\}/);
  assert.match(modal,/onCancel=.*preventDefault\(\);if\(!busy\)onClose\(\)/);
  assert.match(modal,/document.body.style.overflow=overflow/);
  assert.match(modal,/opener\?\.isConnected/);
  assert.match(modal,/disabled=\{busy\}/);
});

test('CNY historical source is short and does not imply current payment RKO',()=>{
  const fields=read('components/ProcurementCnyFields.tsx');
  assert.match(fields,/Последний курс из заявки/);
  assert.match(fields,/Последний курс из 1С/);
  assert.doesNotMatch(fields,/reference\.(conversionNumber|documentNumber)|Комментарий расходника/);
  assert.match(fields,/Ориентировочно в рублях/);
});
test('create and edit both display shared debt summary outside disclosures',()=>{
  const calendar=read('app/(dashboard)/procurement/ProcurementPaymentCalendarClient.tsx');
  const form=read('app/(dashboard)/procurement/ProcurementPaymentForm.tsx');
  assert.match(calendar,/<\/details>\}[\s\S]*?<ProcurementPaymentDebtSummary/);
  assert.match(calendar,/orders=\{editBasis==='DEBT'\?\[\]:draft.orderRefs.map/);
  assert.match(form,/<ProcurementPaymentDebtSummary/);
});
