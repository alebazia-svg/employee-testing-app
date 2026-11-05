import React from 'react';import test from 'node:test';import assert from 'node:assert/strict';import {renderToStaticMarkup} from 'react-dom/server';
import {ProcurementRateOverview,rateOverviewState} from '../components/ProcurementRateOverview';
import type {DailyQuote} from '../lib/procurement-daily-rate';
const q=(day:string,rate:number,revision=1):DailyQuote=>({id:day+revision,currency:'USDT',day,rate,revision,actor:'Test',createdAt:day+'T10:00:00Z'});
test('last confirmation carries forward without falsely confirming the next day or using future rates',()=>{
 const quotes=[q('2026-11-04',85),q('2026-11-05',86),q('2026-11-05',86.5,2),q('2026-11-07',90)],original=JSON.stringify(quotes);
 assert.equal(rateOverviewState(quotes,'USDT','2026-11-05').quote?.rate,86.5);assert.equal(rateOverviewState(quotes,'USDT','2026-11-05').confirmed,true);
 assert.equal(rateOverviewState(quotes,'USDT','2026-11-06').quote?.rate,86.5);assert.equal(rateOverviewState(quotes,'USDT','2026-11-06').confirmed,false);
 assert.equal(rateOverviewState(quotes,'USDT','2026-11-03').quote,null);assert.equal(JSON.stringify(quotes),original);
});
test('one independent two-currency block also renders without any request dependency',()=>{
 const html=renderToStaticMarkup(<ProcurementRateOverview today="2026-11-05" day="2026-11-06" quotes={[q('2026-11-05',86)]} onOpen={()=>{}} onDayChange={()=>{}}/>);
 assert.equal((html.match(/aria-label="Курсы для оплат"/g)||[]).length,1);assert.match(html,/На завтра/);assert.match(html,/От 5 ноября/);assert.match(html,/Не задан/);assert.doesNotMatch(html,/data-confirmed="true"/);
});
