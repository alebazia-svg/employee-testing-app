import test from 'node:test';
import assert from 'node:assert/strict';
import {requiredScheduleWeekDates,schedulePlanningWeek,scheduleWeekReminder,scheduleWeekNoticeRef,scheduleWeekAllowsDate,SCHEDULE_WEEK_KIND} from '../lib/schedule-week-reminder';
import {scheduleAttentionItems} from '../lib/employee-schedule-attention';
import {employeeActionReminder} from '../lib/employee-action-reminder';
import {employeeReminderIconKind} from '../lib/employee-notice-icons';
import {notificationTargetKey,workdayNotificationHref} from '../lib/workday-notifications';
import {requestedDates} from '../lib/employee-schedule-snapshot';
const today='2026-10-26',weekStart=today;
test('weekly snapshots load the entire visible grid including saved past days without requiring those days to be filled',()=>{
 const wednesday='2026-10-28';
 assert.deepEqual(requestedDates(null,weekStart,wednesday)?.dates,['2026-10-26','2026-10-27','2026-10-28','2026-10-29','2026-10-30','2026-10-31','2026-11-01']);
 assert.equal(requiredScheduleWeekDates(wednesday)[0],wednesday);
 const friday=requestedDates(null,'2026-11-02','2026-10-30')!;
 assert.equal(friday.dates.length,14);assert.equal(friday.dates[0],weekStart);assert.equal(friday.dates.at(-1),'2026-11-08');
 assert.equal(requestedDates(null,'2026-11-02','2026-10-29'),null);
 assert.equal(requestedDates(null,'2026-11-09','2026-10-30'),null);
 assert.equal(requestedDates('2026-10',weekStart,today),null);
 assert.equal(requestedDates(null,'',today),null);
 assert.equal(requestedDates(null,null,wednesday)?.dates[0],wednesday,'ordinary upcoming-day snapshot is unchanged');
});
test('fixed Monday-Sunday window, next week starts being requested on Friday, never a rolling extra day',()=>{
 assert.equal(schedulePlanningWeek('2026-10-29'),'2026-10-26');
 assert.equal(schedulePlanningWeek('2026-10-30'),'2026-11-02');
 assert.equal(schedulePlanningWeek('2026-11-01'),'2026-11-02');
 assert.equal(schedulePlanningWeek('2026-11-02'),'2026-11-02');
 assert.equal(requiredScheduleWeekDates(today).length,7);assert.equal(requiredScheduleWeekDates('2026-10-30').length,10);
 assert.equal(requiredScheduleWeekDates('2026-10-30').at(-1),'2026-11-08');
 assert.equal(requiredScheduleWeekDates('2026-12-31').at(-1),'2027-01-03');
 assert.equal(requiredScheduleWeekDates('2028-02-28').at(-1),'2028-03-05');
});
test('weekly save scope crosses month/year but cannot write past dates or arbitrary future weeks',()=>{
 for(const d of ['2026-10-26','2026-10-31','2026-11-01'])assert.equal(scheduleWeekAllowsDate(weekStart,d,today),true);
 for(const d of ['2026-10-25','2026-11-02'])assert.equal(scheduleWeekAllowsDate(weekStart,d,today),false);
 assert.equal(scheduleWeekAllowsDate('2026-11-02','2026-11-08','2026-10-29'),false);
 assert.equal(scheduleWeekAllowsDate('2026-11-02','2026-11-08','2026-10-30'),true);
 assert.equal(scheduleWeekAllowsDate('2026-11-09','2026-11-10','2026-10-30'),false);
});
