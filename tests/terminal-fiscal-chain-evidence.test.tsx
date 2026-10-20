import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TerminalFiscalChainEvidence } from '../components/TerminalFiscalChainEvidence';
import type { FiscalChainEvidence } from '../lib/terminal-fiscal-chain-review';
const chain: FiscalChainEvidence={alternatives:1,payments:[{at:'2026-10-12T13:45:10Z',amountKopecks:70000}],checks:[{ref:'refund',at:'2026-10-12T13:51:17Z',amountKopecks:50000,refund:true,fiscalDocumentNumber:'512',cashierName:'Магомед'}]};
test('renders payment, signed return, date, cashier and OFD proof without an employee-send action',()=>{const html=renderToStaticMarkup(<TerminalFiscalChainEvidence chain={chain}/>);for(const text of ['Оплата · терминал','Возврат','512','Магомед','ОФД подтверждён','700','-500'])assert.ok(html.includes(text),text);assert.ok(!html.includes('<button'));});
test('does not present one hypothetical chain as selected when several alternatives exist',()=>{const html=renderToStaticMarkup(<TerminalFiscalChainEvidence chain={{...chain,alternatives:2}}/>);assert.ok(html.includes('Найдено вариантов: 2'));assert.ok(!html.includes('<table'));assert.ok(!html.includes('512'));});
