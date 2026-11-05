import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {ProcurementRequestRate} from '../components/ProcurementRequestRate';

test('actual rate requires current unambiguous foreign payment evidence',()=>{
  const evidence={verification:'current',state:'PARTIALLY_PAID_BY_ONE_C',paidForeignAmount:50,actualExchangeRate:87};
  const render=(patch={})=>renderToStaticMarkup(<ProcurementRequestRate method="USDT" rate="86" evidence={{...evidence,...patch}}/>).replace(/<[^>]+>/g,'');
  assert.match(render(),/Курс заявки: 86 ₽ \/ USDT/);
  assert.match(render(),/Курс оплаты: 87 ₽ \/ USDT/);
  for(const patch of [{verification:'last-confirmed'},{verification:'unavailable'},{state:'MISMATCH'},{state:'PARTIALLY_ISSUED'},{paidForeignAmount:0},{paymentAmountNeedsConfirmation:true},{actualExchangeRate:NaN}]) {
    assert.doesNotMatch(render(patch),/Курс оплаты:/);
    assert.match(render(patch),/Курс заявки: 86/);
  }
});
