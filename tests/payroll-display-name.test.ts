import test from 'node:test';
import assert from 'node:assert/strict';
import { payrollDisplayName } from '../lib/payroll-display-name';
test('Muhamed display spelling is consistent and other identities remain intact', () => {
  assert.equal(payrollDisplayName('Кумыков Мухаммед'), 'Кумыков Мухамед');
  assert.equal(payrollDisplayName('Кумыков Мухамед'), 'Кумыков Мухамед');
  assert.equal(payrollDisplayName('Тохов Астемир'), 'Тохов Астемир');
  assert.equal(payrollDisplayName('СтажерЗакупка'), 'СтажерЗакупка');
});
