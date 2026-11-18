import test from 'node:test';
import assert from 'node:assert/strict';
import { payrollDisplayName } from '../lib/payroll-display-name';
test('Muhamed display spelling is consistent and other identities remain intact', () => {
  assert.equal(payrollDisplayName('Кумыков Мухаммед'), 'Кумыков Мухамед');
  assert.equal(payrollDisplayName('Кумыков Мухамед'), 'Кумыков Мухамед');
  assert.equal(payrollDisplayName('Тохов Астемир'), 'Тохов Астемир');
  assert.equal(payrollDisplayName('СтажерЗакупка'), 'СтажерЗакупка');
});


test('Timur statement label changes from November without rewriting earlier labels or other names', () => {
  const key = 'СтажерРозница · поклейка (09.2026)';
  for (const period of [undefined, '2026-09', '2026-10', 'invalid']) assert.equal(payrollDisplayName(key,period),'Тимур · поклейка');
  for (const period of ['2026-11','2026-12','2027-01']) {
    assert.equal(payrollDisplayName(key,period),'Назранов Тимур');
    assert.equal(payrollDisplayName('Костеренко Магомед',period),'Костеренко Магомед');
    assert.equal(payrollDisplayName('Кумыков Мухаммед',period),'Кумыков Мухамед');
  }
  assert.equal(payrollDisplayName('СтажерРозница','2026-11'),'СтажерРозница','raw 1C source labels remain original');
});
