import assert from 'node:assert/strict';
import test from 'node:test';
import { pwaClientModeFromSignals } from '../lib/pwa-client-mode';

test('iOS home-screen apps are treated as standalone PWAs', () => {
  assert.equal(pwaClientModeFromSignals({ iosStandalone: true }), 'standalone');
});

test('standard and fullscreen installed display modes are treated as PWAs', () => {
  assert.equal(pwaClientModeFromSignals({ displayModeStandalone: true }), 'standalone');
  assert.equal(pwaClientModeFromSignals({ displayModeFullscreen: true }), 'standalone');
});

test('ordinary browser tabs do not claim the primary PWA subscription', () => {
  assert.equal(pwaClientModeFromSignals({}), 'browser');
});
