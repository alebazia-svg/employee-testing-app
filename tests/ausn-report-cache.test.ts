import test from 'node:test';
import assert from 'node:assert/strict';
import { assessTaxLimitRisk, parseAusnReport } from '../lib/ausn-report-cache';

const report = (usedPercent?: number) => ({ available: usedPercent !== undefined, usedPercent, sourceCompleteness: {}, attention: [], monthlyIncome: [] });

test('tax risk fails closed when the production report is unavailable', () => {
  assert.equal(assessTaxLimitRisk(report()).level, 'unknown');
});

test('tax risk raises severity at approved percentage gates', () => {
  assert.equal(assessTaxLimitRisk(report(79.99)).level, 'normal');
  assert.equal(assessTaxLimitRisk(report(80)).level, 'early');
  assert.equal(assessTaxLimitRisk(report(90)).level, 'plan');
  assert.equal(assessTaxLimitRisk(report(95)).level, 'urgent');
});

test('canonical runner markdown is parsed without recalculating tax totals', () => {
  const parsed = parseAusnReport(`# Отчёт АУСН за 2026-10
| Показатель | Значение |
| --- | ---: |
| Версия кода отчёта | abc123 |
| UTC run time | 2026-10-25T07:48:47Z |
| Data cutoff | 2026-10-24 |
| AgentAPI пользователь | AgentAPIP |
| AgentAPI версия | v442 |
| Всего доходов года для лимита | 48 115 663,16 ₽ |
| Остаток до лимита | 11 884 336,84 ₽ |
| Использовано лимита | 80,19% |
| июль 2026 | 6 051 307,14 ₽ · АУСН |
| август 2026 | 7 736 169,57 ₽ · АУСН |
| сентябрь 2026 | 7 169 708,73 ₽ · АУСН |
| октябрь 2026 по 24.10.2026 | 4 817 602,12 ₽ · АУСН |

## Что требует внимания
- До лимита остаётся 11 884 336,84 ₽.

## Полнота источников
| Показатель | Значение |
| --- | ---: |
| 1С AgentAPI | полный |
| Банк 1С | 127 документов |
| OFD САБИ + Platforma | полнота: да |
`);
  assert.equal(parsed.available, true);
  assert.equal(parsed.totalIncome, 48115663.16);
  assert.equal(parsed.remaining, 11884336.84);
  assert.equal(parsed.usedPercent, 80.19);
  assert.equal(parsed.sourceCompleteness['Банк 1С'], '127 документов');
  assert.equal(parsed.monthlyIncome.length, 4);
  assert.equal(parsed.monthlyIncome[3].partial, true);
  assert.equal(parsed.forecastDaysToLimit, 52);
});
