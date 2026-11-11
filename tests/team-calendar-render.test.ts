import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { build } from 'esbuild';
import { createRequire } from 'node:module';

test('future calendar plans preserve sources, departments and the existing layout', async () => {
  const users = [
    { id: 7, name: 'Ахобекова Залина', department: 'wholesale', role: 'EMPLOYEE', isActive: true },
    { id: 4, name: 'Абшаева Зухра', department: 'retail', role: 'EMPLOYEE', isActive: true },
    { id: 10, name: 'Астемир Тохов', department: 'procurement', role: 'EMPLOYEE', isActive: true },
    { id: 11, name: 'Кумыков Мухамед', department: 'procurement', role: 'EMPLOYEE', isActive: true },
    { id: 12, name: 'Неактивный закупщик', department: 'procurement', role: 'EMPLOYEE', isActive: false },
    { id: 20, name: 'Администратор', department: 'procurement', role: 'ADMIN', isActive: true },
  ];
  const schedules = [
    { userId: 7, date: '2026-11-03', status: 'working' },
    { userId: 4, date: '2026-11-03', status: 'off' },
    { userId: 10, date: '2026-11-03', status: 'working' },
    { userId: 11, date: '2026-11-03', status: 'off' },
    { userId: 10, date: '2026-11-04', status: 'off' },
  ];
  const before = JSON.stringify(schedules);
  const mocks: Record<string, any> = {
    '@/lib/prisma': { prisma: {
      user: { findMany: async ({ where }: any) => users.filter(user => user.role === where.role && user.isActive === where.isActive && where.department.in.includes(user.department)) },
      workScheduleEntry: { findMany: async () => schedules },
      workDayEntry: { findMany: async () => [] },
      workdayStartIntent: { findMany: async () => [] },
      adminInboxEvent: { findMany: async () => [] },
      employeeVacation: { findMany: async () => [{ userId: 10, dateFrom: '2026-11-05', dateTo: '2026-11-06' }] },
    } },
    '@/lib/team-control-source': { getTeamGoogleSnapshot: async () => ({
      planAvailable: true, marksAvailable: true, readAt: '2026-11-03T09:00:00Z', marks: [],
      plans: [
        { employee: 'Ахобекова Залина', date: '2026-11-03', plannedWork: false, scheduleNote: '' },
        { employee: 'Ахобекова Залина', date: '2026-11-04', plannedWork: true, scheduleNote: '' },
        { employee: 'Абшаева Зухра', date: '2026-11-03', plannedWork: true, scheduleNote: '' },
        { employee: 'Ахобекова Залина', date: '2026-11-06', plannedWork: true, scheduleNote: '' },
        { employee: 'Ахобекова Залина', date: '2026-11-06', plannedWork: false, scheduleNote: '' },
      ],
    }) },
    './TeamSourceRefresh': { TeamSourceRefresh: () => null },
    'next/link': { __esModule: true, default: ({ children, ...props }: any) => React.createElement('a', props, children) },
  };
  const output = await build({ entryPoints: ['components/admin/TeamScheduleServer.tsx'], bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external', jsx: 'automatic', plugins: [{ name: 'read-only-calendar-fixture', setup(builder) {
    builder.onResolve({ filter: /.*/ }, args => args.path in mocks ? { path: args.path, external: true } : undefined);
  } }] });
  const require = createRequire(import.meta.url), mod = { exports: {} as any };
  new Function('require', 'module', 'exports', output.outputFiles[0].text)((name: string) => mocks[name] ?? require(name), mod, mod.exports);
  const render = async (date: string, now = '2026-11-02T09:00:00Z') => renderToStaticMarkup(await mod.exports.TeamScheduleServer({ date, now:new Date(now) }));
  const today = await render('2026-11-03');
  for (const name of ['Опт', 'Розница', 'Закупки', 'Астемир Тохов', 'Кумыков Мухамед']) assert.ok(today.includes(name), name);
  assert.doesNotMatch(today, /Неактивный закупщик|Администратор/);
  assert.match(today, /Ахобекова Залина<small>Приложение<\/small>/);
  assert.match(today, /aria-label="Ахобекова Залина, 2026-11-03, Рабочий день"/);
  assert.match(today, /aria-label="Абшаева Зухра, 2026-11-03, Выходной"/);
  assert.match(today, /aria-label="Астемир Тохов, 2026-11-03, Рабочий день"/);
  assert.match(today, /aria-label="Кумыков Мухамед, 2026-11-03, Выходной"/);
  const tomorrow = await render('2026-11-04');
  assert.match(tomorrow, /Ахобекова Залина<small>Google<\/small>/);
  assert.match(tomorrow, /aria-label="Ахобекова Залина, 2026-11-04, Рабочий день"/);
  assert.match(tomorrow, /aria-label="Астемир Тохов, 2026-11-04, Выходной"/);
  const missing = await render('2026-11-05');
  assert.match(missing, /Ахобекова Залина<small>Нет записи<\/small>/);
  assert.match(missing, /aria-label="Астемир Тохов, 2026-11-05, Отпуск"/);
  assert.match(await render('2026-11-06'), /Ахобекова Залина<small>Google<\/small>/);
  // Real server projection: saved off + QR, saved working + no QR, empty
  // plans and an accepted start intent without a completed shift selection.
  mocks['@/lib/prisma'].prisma.workDayEntry.findMany = async () => [
    { userId: 4, date: '2026-11-03', qrAcceptedAt: new Date('2026-11-03T09:00:00+03:00') },
  ];
  mocks['@/lib/prisma'].prisma.workdayStartIntent.findMany = async () => [
    { userId: 11, date: '2026-11-03', qrAcceptedAt: new Date('2026-11-03T18:05:00+03:00') },
  ];
  const actual = await render('2026-11-03', '2026-11-03T20:01:00+03:00');
  assert.match(actual, /aria-label="Абшаева Зухра, 2026-11-03, Рабочий день"/);
  assert.match(actual, /aria-label="Ахобекова Залина, 2026-11-03, Выходной"/);
  assert.match(actual, /aria-label="Астемир Тохов, 2026-11-03, Выходной"/);
  assert.match(actual, /aria-label="Кумыков Мухамед, 2026-11-03, Рабочий день"/);
  assert.match(await render('2026-11-02', '2026-11-03T20:01:00+03:00'), /aria-label="Кумыков Мухамед, 2026-11-02, Выходной"/);
  assert.equal(JSON.stringify(schedules), before, 'calendar reads never modify saved plans');
  mocks['@/lib/prisma'].prisma.workDayEntry.findMany = async () => { throw new Error('QR database unavailable'); };
  await assert.rejects(render('2026-11-03', '2026-11-03T20:01:00+03:00'), /QR database unavailable/, 'failed QR read must not invent days off');
});
