import React from 'react';
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { ProcurementMissingOrderWarning } from '../components/ProcurementMissingOrderWarning';
import { ProcurementCancelledHistory } from '../components/ProcurementCancelledHistory';

const ref = 'glass-order';
const glass = {
  id:'glass', planCode:'PAY-20260930-794810', supplierPartner:'Glass 111', status:'CANCELLED',
  orderRefs:[ref], orderNumbers:['00OF-000410'],
  events:[{action:'CANCELLED', createdAt:'2026-11-21T18:16:50Z', snapshot:{actorName:'Администратор'}}],
};
const warning = (plans: typeof glass[], refs = [ref]) =>
  renderToStaticMarkup(<ProcurementMissingOrderWarning plans={plans} refs={refs}/>);

test('Glass 111 leaves the banner on cancellation and keeps its searchable saved order in history', () => {
  assert.match(warning([{...glass, status:'APPROVED'}]), /00OF-000410/);
  assert.equal(warning([glass]), '');
  const history = renderToStaticMarkup(<ProcurementCancelledHistory plans={[glass]} query="000410"/>);
  for (const text of ['Glass 111', glass.planCode, '00OF-000410', '21:16:50', 'Администратор']) assert.ok(history.includes(text));
});

test('only the other owner is displayed when a missing order is shared', () => {
  for (const status of ['SUBMITTED', 'APPROVED', 'NEEDS_CHANGES']) {
    const open = {...glass, id:'other', status, planCode:'OTHER', orderRefs:['second',ref], orderNumbers:['SECOND','00OF-000410']};
    const banner = warning([glass,open]);
    assert.match(banner, /00OF-000410 · заявка OTHER/);
    assert.ok(!banner.includes(glass.planCode));
    assert.equal(warning([glass,{...open,status:'CANCELLED'}]), '');
  }
  assert.match(warning([glass], [ref, 'unknown-order']), /unknown-order/);
});
