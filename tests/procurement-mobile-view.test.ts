import assert from 'node:assert/strict';
import test from 'node:test';
import {procurementMobileFreshness} from '../lib/procurement-mobile-view';
const now=new Date('2026-10-27T15:00:00Z');
test('mobile freshness uses Moscow time and keeps same-day text short',()=>{
 assert.equal(procurementMobileFreshness('2026-10-27T14:32:00Z',now),'Обновлено в 17:32');
 assert.match(procurementMobileFreshness('2026-10-26T14:32:00Z',now),/26\.10.*17:32/);
});
test('source failure distinguishes saved evidence and unknown freshness',()=>{
 assert.equal(procurementMobileFreshness('2026-10-27T14:32:00Z',now,false,true),'Сохранено: 17:32');
 assert.equal(procurementMobileFreshness('',now,false,true),'Данные не обновлены');
 assert.equal(procurementMobileFreshness('invalid',now),'Данные не обновлены');
 assert.equal(procurementMobileFreshness('invalid',now,true),'Обновляем…');
});
