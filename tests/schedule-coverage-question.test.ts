import test from 'node:test';
import assert from 'node:assert/strict';
import {scheduleCoverageQuestion,scheduleQuestionDates,schedulePushAt,scheduleCoverageRef} from '../lib/schedule-coverage-question';
const base={department:'wholesale',date:'2026-10-26',today:'2026-10-26',employees:[{id:1,name:'Хурзокова Лиана'},{id:2,name:'Ахобекова Залина'}],entries:[{userId:1,status:'off'}],vacations:[]};
test('wording describes missing plans, never claims actual absence; source closes when covered or past',()=>{
 const q=scheduleCoverageQuestion(base);assert.equal(q.active,true);assert.match(q.title,/никто не отмечен в графике/);assert.match(q.body,/Залина — график не заполнен/);assert.doesNotMatch(q.body,/не приш|отсутств|никого нет/);
 assert.equal(scheduleCoverageQuestion({...base,entries:[{userId:1,status:'working'},{userId:2,status:'working'}]}).active,false);
 assert.equal(scheduleCoverageQuestion({...base,today:'2026-10-27'}).active,false);
 assert.deepEqual(scheduleCoverageQuestion({...base,vacations:[{userId:2,dateFrom:base.date,dateTo:base.date}]}).missingIds,[]);
 assert.equal(scheduleCoverageQuestion({...base,employees:[]}).active,false);
});
test('morning at 08:30, tomorrow only from 18:00 Moscow; future pushes cannot flood the month',()=>{
 assert.deepEqual(scheduleQuestionDates(new Date('2026-10-26T05:29:59Z')),[]);
 assert.deepEqual(scheduleQuestionDates(new Date('2026-10-26T05:30:00Z')),['2026-10-26']);
 assert.deepEqual(scheduleQuestionDates(new Date('2026-10-26T15:00:00Z')),['2026-10-26','2026-10-27']);
 assert.equal(schedulePushAt('2026-11-01',new Date('2026-10-26T05:30Z')).toISOString(),'2026-10-31T15:00:00.000Z');
 assert.equal(scheduleCoverageRef('retail:2026-02-30'),null);
});
