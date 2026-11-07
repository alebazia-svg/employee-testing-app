import test from 'node:test';
import assert from 'node:assert/strict';
import { collectDeviceObservation, createDeviceObservationCollector, deviceSystemSummary, deviceFieldSource, deviceObservationFromUa, parseDeviceObservation } from '../lib/portal-device-observation';

const android = 'Mozilla/5.0 (Linux; Android 10; K) Chrome/142.0.0.0 Mobile Safari/537.36';
const safari = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) Version/26.2 Mobile/15E148 Safari/604.1';

test('partial hints never promote reduced Android version or browser version to expanded evidence', async () => {
  const result = await collectDeviceObservation({ userAgent: android, userAgentData: { getHighEntropyValues: async () => ({ platform: 'Android', architecture: 'arm' }) } });
  assert.equal(result.source, 'client-hints'); assert.equal(result.hintsState, 'partial');
  assert.equal(deviceFieldSource(result, 'architecture'), 'client-hints');
  assert.equal(deviceFieldSource(result, 'platformVersion'), 'user-agent');
  assert.equal(deviceFieldSource(result, 'browserVersion'), 'user-agent');
  assert.equal(deviceSystemSummary(result), 'Android · версия не подтверждена');
  assert.equal(result.platformVersion, '10', 'retain raw report for diagnostics');
});

test('iOS Safari and legacy mixed-source versions never appear as confirmed OS versions', () => {
  const result = deviceObservationFromUa(safari);
  assert.equal(result.browserVersion, '26.2'); assert.equal(result.platformVersion, '18.7');
  assert.equal(deviceSystemSummary(result), 'iOS / iPadOS · версия не подтверждена');
  assert.equal(deviceSystemSummary({ source: 'client-hints', platform: 'macOS', platformVersion: '27.0.1' }), 'macOS · версия не подтверждена');
});

test('full hints retain model and exact reported versions; unrelated GREASE brand cannot win', async () => {
  const result = await collectDeviceObservation({ userAgent: android, userAgentData: { getHighEntropyValues: async () => ({ platform: 'Android', platformVersion: '16.0.0', model: 'Pixel 9', fullVersionList: [{ brand: 'Not A Brand', version: '999' }, { brand: 'Google Chrome', version: '142.0.7444.77' }] }) } });
  assert.equal(result.hintsState, 'complete'); assert.equal(result.model, 'Pixel 9'); assert.equal(result.browserVersion, '142.0.7444.77');
  assert.equal(deviceSystemSummary(result), 'Android 16.0.0');
  assert.equal(parseDeviceObservation(JSON.parse(JSON.stringify(result)))?.fieldSources?.model, 'client-hints');
  const changed = await collectDeviceObservation({ userAgent: android, userAgentData: { getHighEntropyValues: async () => ({ platform: 'Windows' }) } });
  assert.equal(changed.platformVersion, undefined, 'never mix different platforms');
});

test('failed reads retry after a minute, concurrent calls share a read, successful cache refreshes', async () => {
  let time = 100000, calls = 0;
  const read = createDeviceObservationCollector({ userAgent: android }, () => time, async () => {
    calls++; await Promise.resolve();
    return { source: 'user-agent', hintsState: calls === 1 ? 'timeout' : 'complete', collectedAt: new Date(time).toISOString() };
  });
  const [a, b] = await Promise.all([read(), read()]); assert.equal(calls, 1); assert.equal(a, b);
  time += 59999; assert.equal(await read(), a); assert.equal(calls, 1);
  time++; const c = await read(); assert.equal(calls, 2); assert.notEqual(c.collectedAt, a.collectedAt);
  time += 299999; assert.equal(await read(), c); time++; await read(); assert.equal(calls, 3);
});

test('repeated failures are bounded and unsupported browsers are not repeatedly probed', async () => {
  let time = 100000, calls = 0;
  const read = createDeviceObservationCollector({ userAgent: android }, () => time, async () => { calls++; return { source: 'user-agent', hintsState: 'error' }; });
  for (let i = 0; i < 8; i++) { await read(); time += 60000; } assert.equal(calls, 3);
  calls = 0;
  const unsupported = createDeviceObservationCollector({ userAgent: safari }, () => time, async () => { calls++; return { source: 'user-agent', hintsState: 'unsupported' }; });
  await unsupported(); time += 86400000; await unsupported(); assert.equal(calls, 1);
});

test('provenance cannot carry extra identifiers or claim missing fields', () => {
  for (const extra of [ { fieldSources: { serial: 'client-hints' } }, { fieldSources: { model: 'client-hints' } }, { fieldSources: { platform: 'guessed' } }, { fieldSources: {} }, { collectedAt: 'tomorrow' } ]) {
    assert.equal(parseDeviceObservation({ source: 'client-hints', platform: 'Android', ...extra }), null);
  }
  assert.equal(parseDeviceObservation({ source: 'user-agent', platform: 'Android', fieldSources: { platform: 'client-hints' } }), null);
});
test('Yandex version keeps its own UA provenance rather than a Chrome engine version',async()=>{
  const ua='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/152.0.0.0 YaBrowser/26.10.0.0 Safari/537.36';
  const result=await collectDeviceObservation({userAgent:ua,userAgentData:{getHighEntropyValues:async()=>({platform:'macOS',platformVersion:'26.6.2',fullVersionList:[{brand:'Google Chrome',version:'152.0.1.2'}]})}});
  assert.equal(result.browserVersion,'26.10.0.0');
  assert.equal(result.fieldSources?.browserVersion,'user-agent');
  assert.equal(result.fieldSources?.platformVersion,'client-hints');
});
