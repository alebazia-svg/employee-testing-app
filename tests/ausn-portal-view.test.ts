import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm, symlink, utimes } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { loadPortalReports, parsePortalReport, portalForecast, portalFreshness, portalNumber, portalRisk, selectPortalReport, taxViewHref } from '../lib/ausn-portal-view';
import { portalFixture } from './ausn-portal-fixture';

const now = new Date('2026-10-26T10:00:00Z');

test('portal preserves the full canonical report including its final source evidence', () => {
  const text = portalFixture();
  const parsed = parsePortalReport(text);
  assert.equal(parsed.available, true, parsed.reason);
  assert.equal(parsed.canonicalText, text);
  assert.equal(parsed.totalIncome, 48000000);
  assert.equal(parsed.estimatedTax, 3680000);
  assert.equal(parsed.ensDifference, undefined);
  assert.equal(parsed.incomeStructure?.other, undefined);
  assert.equal(parsed.monthlyIncome.length, 4);
  assert.equal(parsed.monthlyIncome[3].periodKey, '2026-10');
  assert.equal(parsed.monthlyIncome[3].partial, true);
  assert.match(parsed.attention.at(-1)!, /полностью/);
  assert.equal(parsed.codeVersion?.length, 40);
});

test('missing and invalid financial cells never turn into zeroes or stray digits', () => {
  for (const value of [undefined, '', '—', 'нет', 'не рассчитана', 'не найден', 'данных 12', 'NaN', 'Infinity']) assert.equal(portalNumber(value), undefined);
  assert.equal(portalNumber('0,00 ₽'), 0);
  assert.equal(portalNumber('−1\u202f234,56 ₽'), -1234.56);
  assert.equal(portalNumber('2 000 000,00 ₽ · по декларации'), 2000000);
});

test('limit excess retains its sign and raises urgent risk', () => {
  const parsed = parsePortalReport(portalFixture().replace('12 000 000,00 ₽', 'превышение на 12 000 000,00 ₽'));
  assert.equal(parsed.remaining, -12000000);
  assert.equal(portalRisk(parsed, now).level, 'urgent');
});

test('each mandatory source blocks partial totals; ENS and FNS never block complete tax data', () => {
  for (const text of [portalFixture({ ofd: 'нет' }), portalFixture().replace('127 банковских документов', 'недоступен'), portalFixture().replace('пользователь FixtureReader; версия fixture-v1', 'ошибка 1С')]) {
    const parsed = parsePortalReport(text);
    assert.equal(parsed.available, false);
    assert.equal(parsed.totalIncome, undefined);
    assert.equal(parsed.estimatedTax, undefined);
    assert.equal(parsed.monthlyIncome.length, 0);
  }
  const noControls = portalFixture().replace('| ЕНС | загружен |', '| ЕНС | Сверка ЕНС недоступна |').replace('| ЛК ФНС | загружен; 100 строк; покрытие 2026-04–2026-09 |', '| ЛК ФНС | сверка не выполнялась |');
  assert.equal(parsePortalReport(noControls).available, true);
  assert.equal(parsePortalReport(noControls).fnsIncome, undefined);
  assert.equal(parsePortalReport(noControls).ensAssessed, undefined);
});

test('truncation, missing identity, invalid dates and malformed totals fail closed without throwing', () => {
  for (const text of [portalFixture().slice(0, -1), portalFixture().split('## Полнота источников')[0], portalFixture().replace('0123456789abcdef0123456789abcdef01234567', 'unknown'), portalFixture({ cutoff: '2026-99-99' }), portalFixture().replace('48 000 000,00 ₽', 'недоступно')]) {
    const parsed = parsePortalReport(text);
    assert.equal(parsed.available, false, text);
    assert.equal(parsed.totalIncome, undefined);
  }
});

test('saved and future results cannot produce a green current risk status', () => {
  const saved = parsePortalReport(portalFixture({ run: '2026-10-20T08:00:00Z', cutoff: '2026-10-20' }));
  assert.equal(portalFreshness(saved, now).state, 'saved');
  assert.equal(portalRisk(saved, now).level, 'unknown');
  assert.equal(portalFreshness(parsePortalReport(portalFixture({ run: '2026-11-01T08:00:00Z' })), now).state, 'blocked');
  assert.equal(portalFreshness(parsePortalReport(portalFixture({ cutoff: '2026-11-01' })), now).state, 'blocked');
  assert.equal(portalFreshness(parsePortalReport(portalFixture()), now).state, 'fresh');
});

test('month selection never substitutes annual tax, FNS figures or another month', () => {
  const annual = parsePortalReport(portalFixture());
  const month = parsePortalReport(portalFixture({ month: '2026-09' }));
  const exact = selectPortalReport([month, annual], { year: '2026', period: '2026-09' }, now);
  assert.equal(exact.base, 123456.78);
  assert.equal(exact.tax, 9876.54);
  assert.equal(exact.report, month);
  const summary = selectPortalReport([annual], { year: '2026', period: '2026-09' }, now);
  assert.equal(summary.base, 9000000);
  assert.equal(summary.tax, undefined);
  assert.equal(summary.summaryOnly, true);
  assert.equal(summary.structure?.credit, undefined);
  const absent = selectPortalReport([annual], { year: '2026', period: '2026-02' }, now);
  assert.equal(absent.base, undefined);
  assert.equal(absent.report, undefined);
  const blockedMonth = parsePortalReport(portalFixture({ month: '2026-09', ofd: 'нет' }));
  assert.equal(selectPortalReport([blockedMonth, month, annual], { year: '2026', period: '2026-09' }, now).base, undefined);
});

test('year selection and tab links preserve period identity', () => {
  const parsed = parsePortalReport(portalFixture());
  assert.equal(selectPortalReport([parsed], { year: '2025' }, now).report, undefined);
  assert.equal(selectPortalReport([parsed], { year: '2026', period: '2025-09' }, now).period, 'year');
  assert.equal(selectPortalReport([parsed], { year: '../../etc', period: '2026-99' }, now).period, 'year');
  assert.equal(taxViewHref('composition', '2026', '2026-09'), '/admin/taxes?view=composition&year=2026&period=2026-09');
});

test('catalogue isolates files, ignores symlinks and selects newer broken results without cached fallback', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'ausn-portal-test-'));
  try {
    const oldFile = 'ausn-executive-full-20261025T080000.md';
    const newFile = 'ausn-executive-full-20261026T080000.md';
    await writeFile(path.join(directory, oldFile), portalFixture());
    await writeFile(path.join(directory, newFile), '# truncated');
    await writeFile(path.join(directory, 'unrelated.md'), 'not a report');
    await symlink(path.join(directory, oldFile), path.join(directory, 'ausn-executive-current-20261026T090000.md'));
    // Modifying an old file must not make it the newest server run.
    await utimes(path.join(directory, oldFile), now, new Date('2027-01-01'));
    const catalog = await loadPortalReports(directory);
    assert.equal(catalog.length, 2);
    assert.equal(catalog[0].sourceFile, newFile);
    const selected = selectPortalReport(catalog, { year: '2026' }, now);
    assert.equal(selected.report?.available, false);
    assert.equal(selected.base, undefined);
  } finally { await rm(directory, { recursive: true, force: true }); }
});


test('forecast uses one run and only three consecutive completed months within the year', () => {
  const report = parsePortalReport(portalFixture());
  const forecast = portalForecast(report)!;
  assert.deepEqual(forecast.months, ['2026-07', '2026-08', '2026-09']);
  assert.equal(forecast.days, 45);
  assert.equal(forecast.withinYear, true);
  assert.equal(portalRisk(report, now).level, 'plan');
  const fewer = { ...report, monthlyIncome: report.monthlyIncome.slice(1) };
  assert.equal(portalForecast(fewer), undefined);
  const gaps = { ...report, monthlyIncome: report.monthlyIncome.map((month, index) => index === 0 ? { ...month, periodKey: '2026-06' } : month) };
  assert.equal(portalForecast(gaps), undefined);
  const beyondYear = { ...report, remaining: 120000000, usedPercent: 50 };
  assert.equal(portalForecast(beyondYear)?.withinYear, false);
  assert.equal(portalRisk(beyondYear, now).level, 'normal');
});

test('monthly runner fields remain independent of annual totals and optional categories', () => {
  const text = portalFixture({ month: '2026-09' }).replace('Начислено в ЕНС за доступные периоды', 'Начислено в ЕНС за период');
  const report = parsePortalReport(text);
  assert.equal(report.monthTax, 9876.54);
  assert.equal(report.monthBase, 123456.78);
  assert.equal(report.incomeStructure?.other, undefined);
  assert.equal(report.ensAssessed, 3000000);
});

test('large new artifacts block rather than silently replacing them with an old report', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'ausn-large-test-'));
  try {
    await writeFile(path.join(directory, 'ausn-executive-full-20261025T080000.md'), portalFixture());
    await writeFile(path.join(directory, 'ausn-executive-full-20261026T080000.md'), 'x'.repeat(256001));
    const reports = await loadPortalReports(directory);
    assert.equal(selectPortalReport(reports, { year: '2026' }, now).report?.available, false);
  } finally { await rm(directory, { recursive: true, force: true }); }
});


test('the last day of an ongoing month is not a completed month for pace estimates', () => {
  const report = parsePortalReport(portalFixture({ cutoff: '2026-10-31', run: '2026-10-31T08:00:00Z' }));
  assert.equal(report.monthlyIncome.at(-1)?.partial, true);
  assert.deepEqual(portalForecast(report)?.months, ['2026-07', '2026-08', '2026-09']);
});

test('a report spanning two calendar years cannot masquerade as a single annual total', () => {
  const report = parsePortalReport(portalFixture().replace('июль 2026', 'июль 2025'));
  assert.equal(report.available, false);
  assert.equal(report.totalIncome, undefined);
  assert.match(report.reason!, /разных лет/);
});


test('data cutoff cannot be after the server run day', () => {
  const report = parsePortalReport(portalFixture({ run: '2026-10-20T08:00:00Z', cutoff: '2026-10-26' }));
  assert.equal(report.available, false);
  assert.match(report.reason!, /позже даты запуска/);
});
