import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AdminShiftControlDetails } from '../app/(dashboard)/admin/workday/AdminShiftControlDetails';

Object.assign(globalThis, { React });

// No router provider: unsupported departments must never mount the dialog's
// hooks/listeners, even when the selected employee URL asks it to open.
test('a selected procurement employee does not mount a shift-control dialog', () => {
  const html = renderToStaticMarkup(<AdminShiftControlDetails
    employeeId={11} employeeName='Тест закупки' department='procurement'
    departmentName='Закупки' scheduleLabel='Рабочий день' run={null} workDay={null}
    dateKey='2026-11-13' initialOpen
  />);
  assert.equal(html, '<span class="text-sm font-semibold text-slate-400">—</span>');
});
