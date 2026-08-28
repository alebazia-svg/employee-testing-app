import assert from 'node:assert/strict';
import test from 'node:test';
import {
  attendanceEmployeeKey,
  canonicalAttendanceEmployeeName,
} from '../lib/attendance-identity';

test('merges short Google schedule names with full attendance identities', () => {
  assert.equal(canonicalAttendanceEmployeeName('Милана'), 'Чеченова Милана');
  assert.equal(canonicalAttendanceEmployeeName('  Зухра  '), 'Абшаева Зухра');
  assert.equal(attendanceEmployeeKey('Диана'), attendanceEmployeeKey('Кумахова Диана'));
});

test('merges known legacy spelling variants without merging the reusable trainee identity', () => {
  assert.equal(canonicalAttendanceEmployeeName('Магомед Косторенко'), 'Костеренко Магомед');
  assert.equal(canonicalAttendanceEmployeeName('Хурцокова Лиана'), 'Хурзокова Лиана');
  assert.equal(canonicalAttendanceEmployeeName('СтажерРозница'), 'СтажерРозница');
});

test('preserves unknown employee names in a clean display form', () => {
  assert.equal(canonicalAttendanceEmployeeName('  Новый   Сотрудник '), 'Новый Сотрудник');
});
