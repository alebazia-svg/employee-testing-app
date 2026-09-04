import assert from 'node:assert/strict';
import test from 'node:test';
import { lateArrivalThresholdMinutes, parseClockMinutes, validateDeviationReason, validateEarlyFinishMinutes } from '../lib/workday-deviation';

test('причина опоздания требуется с шестой минуты', () => {
  assert.equal(lateArrivalThresholdMinutes, 6);
});

test('причины не имеют значения по умолчанию, а Другое требует комментарий', () => {
  for (const invalid of ['constructor', '__proto__', 'toString', 'forgot', null, 1]) {
    assert.equal(validateDeviationReason('late_arrival', invalid, '').ok, false);
    assert.equal(validateDeviationReason('early_finish', invalid, '').ok, false);
  }
  assert.equal(validateDeviationReason('late_arrival', '', '').ok, false);
  assert.equal(validateDeviationReason('late_arrival', 'other', '').ok, false);
  assert.deepEqual(validateDeviationReason('late_arrival', 'forgot_mark', ''), { ok: true, reasonCode: 'forgot_mark', comment: '' });
  assert.deepEqual(validateDeviationReason('early_finish', 'other', '  семейные обстоятельства  '), { ok: true, reasonCode: 'other', comment: 'семейные обстоятельства' });
});

test('раннее завершение сохраняет только время внутри плановой смены', () => {
  for (const invalid of ['24:00', '16:60', '9:30', '', null]) {
    assert.equal(parseClockMinutes(invalid), null);
  }
  assert.equal(parseClockMinutes('16:30'), 990);
  assert.equal(validateEarlyFinishMinutes('08:59', 540, 1080).ok, false);
  assert.equal(validateEarlyFinishMinutes('18:00', 540, 1080).ok, false);
  assert.deepEqual(validateEarlyFinishMinutes('16:30', 540, 1080), { ok: true, requestedEndMinutes: 990 });
});
