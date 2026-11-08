import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { getAttendanceRows, getScheduleRows } from '../lib/google-sheets';
import { boundedTeamRead } from '../lib/team-source-deadline';

const privateKey = generateKeyPairSync('rsa', { modulusLength: 1024, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } }).privateKey;
for (const [label, read] of [['attendance', getAttendanceRows], ['schedule', getScheduleRows]] as const) {
  for (const stage of [1, 2, 3]) test(`${label} cancels the actual HTTP request at stage ${stage}, not just the UI wait`, async () => {
    const keys = ['GOOGLE_SHEETS_CLIENT_EMAIL', 'GOOGLE_SHEETS_PRIVATE_KEY', 'GOOGLE_SHEETS_SPREADSHEET_ID', 'GOOGLE_SHEETS_SCHEDULE_SPREADSHEET_ID'];
    const saved = keys.map(key => process.env[key]);
    const original = globalThis.fetch;
    process.env.GOOGLE_SHEETS_CLIENT_EMAIL = 'synthetic@example.invalid';
    process.env.GOOGLE_SHEETS_PRIVATE_KEY = privateKey;
    process.env.GOOGLE_SHEETS_SPREADSHEET_ID = 'synthetic';
    process.env.GOOGLE_SHEETS_SCHEDULE_SPREADSHEET_ID = 'synthetic';
    let calls = 0, cancelled = false;
    let signal: AbortSignal | undefined;
    globalThis.fetch = async (_url, options) => {
      calls++;
      assert.ok(options?.signal);
      if (signal) assert.equal(options.signal, signal);
      signal = options.signal as AbortSignal;
      if (calls === stage) return new Promise((_resolve, reject) => signal!.addEventListener('abort', () => { cancelled = true; reject(new Error('aborted')); }, { once: true }));
      if (calls === 1) return Response.json({ access_token: 'synthetic-token' });
      return Response.json({ sheets: [{ properties: { title: 'Ответы на форму (1)' } }, { properties: { title: 'График работы' } }] });
    };
    try {
      await assert.rejects(boundedTeamRead<unknown>(signal => read({ signal }), 5));
      assert.equal(calls, stage); assert.equal(cancelled, true); assert.equal(signal?.aborted, true);
    } finally {
      globalThis.fetch = original;
      keys.forEach((key, index) => saved[index] === undefined ? delete process.env[key] : process.env[key] = saved[index]);
    }
  });
}

test('a completed source read clears the cancellation timer', async () => {
  let signal!: AbortSignal;
  const result = await boundedTeamRead(async value => { signal = value; return ['unchanged']; }, 5);
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.deepEqual(result, ['unchanged']); assert.equal(signal.aborted, false);
});
