import assert from 'node:assert/strict';
import test from 'node:test';
import { parsePortalReport } from '../lib/ausn-portal-view';
import { taxDecisionReminder, taxFreshnessReminder } from '../lib/tax-attention-reminders';
import { ownerFullReport } from '../app/taxes-development-preview/owner-scenario';

const full = parsePortalReport(ownerFullReport, 'ausn-executive-full-20261025T074847.md');

test('fresh figures raise nothing; stale ones raise one message per stale run', () => {
  assert.equal(taxFreshnessReminder([full], new Date('2026-10-25T12:00:00Z')), undefined);
  const stale = taxFreshnessReminder([full], new Date('2026-10-29T12:00:00Z'))!;
  assert.equal(stale.eventKey, 'tax_figures_stale:ausn-executive-full-20261025T074847.md');
  assert.equal(taxFreshnessReminder([full], new Date('2026-10-30T12:00:00Z'))!.eventKey, stale.eventKey);
  assert.match(stale.body, /Обновить цифры сейчас/);
});

test('an unavailable calculation is reported in plain words', () => {
  const broken = parsePortalReport(ownerFullReport.replace('полнота: да', 'полнота: нет'), 'ausn-executive-full-20261029T050000.md');
  const reminder = taxFreshnessReminder([broken], new Date('2026-10-29T12:00:00Z'))!;
  assert.equal(reminder.title, 'Расчёт по налогам недоступен');
  assert.match(reminder.body, /чеки кассы/);
});

test('decision reminder: silent far ahead, "до даты" within two weeks, "сейчас" after it', () => {
  assert.equal(taxDecisionReminder(full, new Date('2026-09-20T12:00:00Z')), undefined);
  const soon = taxDecisionReminder(full, new Date('2026-10-20T12:00:00Z'))!;
  assert.equal(soon.eventKey, 'tax_limit_decision:2026:by');
  assert.match(soon.title, /нужно до 26 октября/);
  const now = taxDecisionReminder(full, new Date('2026-10-29T12:00:00Z'))!;
  assert.equal(now.eventKey, 'tax_limit_decision:2026:now');
  assert.match(now.body, /10 декабря/);
});
