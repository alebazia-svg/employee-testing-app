import React from 'react';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { ProcurementDiscardDraftDialog } from '../components/ProcurementDiscardDraftDialog';

test('discard uses an accessible modal with a safe first action, not a browser confirmation', () => {
  const html = renderToStaticMarkup(<ProcurementDiscardDraftDialog open={false} editing={false} onKeep={()=>{}} onDiscard={()=>{}}/>);
  assert.match(html, /<dialog[^>]*role="alertdialog"[^>]*aria-labelledby="[^"]+"[^>]*aria-describedby=/);
  assert.doesNotMatch(html, /<dialog[^>]* open/);
  assert.match(html, /Удалить черновик оплаты\?/);
  assert.ok(html.indexOf('Продолжить заполнение') < html.indexOf('>Удалить черновик<'));
  assert.match(html, /<button[^>]*autofocus/);
});

test('discarding an edit does not suggest deleting the saved payment request', () => {
  const html = renderToStaticMarkup(<ProcurementDiscardDraftDialog open={false} editing onKeep={()=>{}} onDiscard={()=>{}}/>);
  assert.match(html, /Отменить изменения\?/);
  assert.match(html, /Заявка останется без изменений/);
  assert.doesNotMatch(html, /Удалить черновик/);
});

test('all form exits share the guard; empty drafts close directly and saving cannot be interrupted', () => {
  const calendar = readFileSync('app/(dashboard)/procurement/ProcurementPaymentCalendarClient.tsx','utf8');
  const batch = readFileSync('app/(dashboard)/procurement/ProcurementPaymentBatchForm.tsx','utf8');
  assert.doesNotMatch(calendar, /window\.confirm/);
  assert.equal((calendar.match(/onClick=\{requestClosePaymentForm\}/g) || []).length, 2);
  assert.match(calendar, /onCancel=\{requestClosePaymentForm\}/);
  assert.match(calendar, /if \(saving \|\| batchDraftState\.saving\) return/);
  assert.match(calendar, /if \(hasChanges\) setDiscardOpen\(true\);\s*else closePaymentForm\(\)/);
  assert.match(calendar, /JSON\.stringify\(draft\) !== JSON\.stringify\(originalEditDraft\)/);
  assert.match(batch, /const hasDraft = selected\.length > 0 \|\| Boolean\(plannedDate\)/);
  assert.match(batch, /onDraftStateChange\?\.\(\{ hasDraft, saving \}\)/);
  assert.match(batch, /addEventListener\('beforeunload'/);
});
