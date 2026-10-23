import test from 'node:test';
import assert from 'node:assert/strict';
import { isWorkdayQrMode, usesWorkdayQrPhotoFallback } from '../lib/workday-qr-mode';

test('only an explicit saved photo preference switches the scanner', () => {
  assert.equal(usesWorkdayQrPhotoFallback({}), false);
  assert.equal(usesWorkdayQrPhotoFallback({ qrScanMode: 'SCAN' }), false);
  assert.equal(usesWorkdayQrPhotoFallback({ qrScanMode: 'PHOTO' }), true);
});

test('API accepts only the two supported modes', () => {
  for (const value of ['SCAN', 'PHOTO']) assert.equal(isWorkdayQrMode(value), true);
  for (const value of [null, undefined, '', 'photo', 'OTHER', 1, {}, ['PHOTO']]) assert.equal(isWorkdayQrMode(value), false);
});
