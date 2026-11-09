import test from 'node:test';
import assert from 'node:assert/strict';
import { teamOpenWork } from '../lib/team-open-work';
test('Distinct actions survive a shared shift-card link; the generic checklist row does not repeat them', ()=>{
 const row={id:7,name:'Сотрудник',planState:'working',missing:false,needsReview:false,review:'',issues:[],timing:[],
 alerts:['К согласованию · 200 ₽','Оформите расходник · 100 ₽'],
 alertTargets:{'К согласованию · 200 ₽':'shift-task-12','Оформите расходник · 100 ₽':'shift-task-12'},
 openTasks:[{id:12,title:'Сдача смены',when:'По плану · 18:00 МСК'}]};
 const items=teamOpenWork([row],[],[],'2026-11-09');
 assert.deepEqual(items.map(i=>i.label).sort(),[...row.alerts].sort());
 assert(items.every(i=>i.context.includes('18:00')&&i.href.includes('shift-task-12')));
});
