import assert from 'node:assert/strict';
import test from 'node:test';
import { createEmployeeAppUpdater, readAppRelease, type AppRelease, type UpdateAttempt } from '../lib/employee-app-update';

const current: AppRelease = { version: '1.4.16', builtAt: '2026-10-16T17:31:16.194Z' };
const next: AppRelease = { version: '1.4.17', builtAt: '2026-10-17T12:00:00Z' };
function setup() {
  let time = 1_000_000, visible = true, safe = true, reloads = 0, requests = 0;
  let remote: unknown = next;
  let attempt: UpdateAttempt | null = null;
  let fetcher = async (_signal: AbortSignal): Promise<unknown> => remote;
  let storageFails = false;
  const updater = createEmployeeAppUpdater(current, {
    now: () => time,
    visible: () => visible,
    safe: () => safe,
    fetchRelease: signal => { requests++; return fetcher(signal); },
    readAttempt: () => attempt,
    saveAttempt: value => { if (storageFails) throw Error('Storage unavailable'); attempt = value; },
    reload: () => { reloads++; },
  });
  return {
    updater, advance: () => { time += 16_000; }, setSafe: (value: boolean) => { safe = value; },
    setVisible: (value: boolean) => { visible = value; }, setRemote: (value: unknown) => { remote = value; },
    setFetcher: (value: typeof fetcher) => { fetcher = value; }, failStorage: () => { storageFails = true; },
    setAttempt: (value: UpdateAttempt) => { attempt = value; },
    counts: () => ({ reloads, requests }), attempt: () => attempt,
  };
}

test('same release and malformed metadata never cause a reload', async () => {
  const s = setup();
  for (const value of [current, null, {}, { version: 'login', builtAt: next.builtAt }, { version: next.version, builtAt: 'bad' }]) {
    s.setRemote(value); s.advance(); await s.updater.check();
  }
  assert.equal(s.counts().reloads, 0);
  assert.equal(readAppRelease('HTML login page'), null);
});

test('one safe reload persists the target before navigation, including a rollback', async () => {
  for (const version of ['1.4.17', '1.4.15']) {
    const s = setup(); s.setRemote({ ...next, version });
    await s.updater.check(); s.advance(); await s.updater.check(); await s.updater.retry();
    assert.deepEqual(s.counts(), { reloads: 1, requests: 1 });
    assert.equal(s.attempt()?.target, `${version}@${next.builtAt}`);
  }
});

test('busy workflow defers and rechecks the server after the workflow finishes', async () => {
  const s = setup(); s.setSafe(false);
  await s.updater.check(); s.advance(); await s.updater.retry();
  assert.deepEqual(s.counts(), { reloads: 0, requests: 1 });
  s.setSafe(true); await s.updater.retry();
  assert.deepEqual(s.counts(), { reloads: 1, requests: 2 });
});

test('withdrawn release is not applied from an earlier pending check', async () => {
  const s = setup(); s.setSafe(false); await s.updater.check();
  s.setRemote(current); s.setSafe(true); s.advance(); await s.updater.retry();
  assert.equal(s.counts().reloads, 0);
});

test('opening a form or hiding the app during a request prevents navigation', async () => {
  for (const block of ['form', 'hidden', 'dispose']) {
    const s = setup(); let finish!: (value: unknown) => void;
    s.setFetcher(() => new Promise(resolve => { finish = resolve; }));
    const checking = s.updater.check();
    if (block === 'form') s.setSafe(false);
    if (block === 'hidden') s.setVisible(false);
    if (block === 'dispose') s.updater.dispose();
    finish(next); await checking;
    assert.equal(s.counts().reloads, 0, block);
  }
});

test('offline and failed checks keep the screen and recover later', async () => {
  const s = setup(); s.setVisible(false); await s.updater.check();
  assert.equal(s.counts().requests, 0);
  s.setVisible(true); s.setFetcher(async () => { throw Error('offline'); });
  await s.updater.check(); assert.equal(s.counts().reloads, 0);
  s.advance(); s.setFetcher(async () => next); await s.updater.check();
  assert.equal(s.counts().reloads, 1);
});

test('focus bursts share one request and checks are throttled', async () => {
  const s = setup(); let finish!: (value: unknown) => void;
  s.setFetcher(() => new Promise(resolve => { finish = resolve; }));
  const first = s.updater.check(); await s.updater.check();
  finish(current); await first; await s.updater.check();
  assert.equal(s.counts().requests, 1);
});

test('cached old client cannot cause rapid repeated reloads', async () => {
  const s = setup();
  s.setAttempt({ target: `${next.version}@${next.builtAt}`, at: 999_000 });
  await s.updater.check(); assert.equal(s.counts().reloads, 0);
  for (let i = 0; i < 20; i++) s.advance();
  await s.updater.retry(); assert.equal(s.counts().reloads, 1);
});

test('blocked storage fails safely without a reload', async () => {
  const s = setup(); s.failStorage(); await s.updater.check();
  assert.equal(s.counts().reloads, 0);
});
