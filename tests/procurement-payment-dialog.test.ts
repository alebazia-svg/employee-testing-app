import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

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
