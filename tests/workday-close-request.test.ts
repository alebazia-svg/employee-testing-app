import test from 'node:test';
import assert from 'node:assert/strict';
import { validateWorkdayCloseRequest as validate } from '../lib/workday-close-request';
test('standard technical reasons require no duplicate explanation', () => {
  for (const reason of ['power','internet','one_c','kkm']) assert.deepEqual(validate(reason,''), {ok:true,reasonCode:reason,comment:''});
});
test('other requires an explanation; invalid reason and excessive text are rejected', () => {
  assert.equal(validate('other','  ').ok,false);
  assert.deepEqual(validate('other','  Принтер\n сломан '),{ok:true,reasonCode:'other',comment:'Принтер сломан'});
  assert.equal(validate('unknown','Причина').ok,false);
  assert.equal(validate('internet','x'.repeat(1001)).ok,false);
});
