import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { probeTBankCabinetSnapshot, tbankCabinetWatchdogCopy } from '../lib/tbank-cabinet-watchdog';

test('watchdog reports a fresh empty interval as healthy', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'tbank-watchdog-'));
  const file = path.join(directory, 'current.json');
  await writeFile(file, JSON.stringify({ version: 1, generatedAt: '2026-09-03T16:55:00.000Z', complete: true,
    periodFrom: '2026-09-01T00:00:00.000Z', periodTo: '2026-09-03T17:02:00.000Z', operations: [] }));
  const probe = await probeTBankCabinetSnapshot({ path: file, now: new Date('2026-09-03T17:00:00.000Z') });
  assert.equal(probe.ok, true);
  assert.equal(tbankCabinetWatchdogCopy(probe).type, 'dependency.recovered');
});

test('watchdog produces plain action copy for a stale feed', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'tbank-watchdog-'));
  const file = path.join(directory, 'current.json');
  await writeFile(file, JSON.stringify({ version: 1, generatedAt: '2026-09-03T16:40:00.000Z', complete: true,
    periodFrom: '2026-09-01T00:00:00.000Z', periodTo: '2026-09-03T17:02:00.000Z', operations: [] }));
  const probe = await probeTBankCabinetSnapshot({ path: file, now: new Date('2026-09-03T17:00:00.000Z') });
  assert.equal(probe.ok, false);
  assert.deepEqual(tbankCabinetWatchdogCopy(probe), {
    type: 'dependency.down', title: 'Нет новых данных Т-Банка',
    body: 'Операции по картам и QR не обновляются более 10 минут. Откройте отдельное окно Edge «OFFONIKA TBank Monitor» на Mac и восстановите вход.',
  });
});
