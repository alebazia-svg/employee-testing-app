import test from 'node:test';
import assert from 'node:assert/strict';
import QRCode from 'qrcode';
import { decodeWorkdayQrPhoto } from '../lib/workday-qr-photo';

function photo(payload: string, rotate = false) {
  const { modules } = QRCode.create(payload);
  const scale = 6;
  const width = (modules.size + 8) * scale;
  const data = new Uint8ClampedArray(width * width * 4).fill(255);
  for (let y = 0; y < width; y++) for (let x = 0; x < width; x++) {
    const row = Math.floor(y / scale) - 4;
    const col = Math.floor(x / scale) - 4;
    if (row < 0 || col < 0 || row >= modules.size || col >= modules.size || !modules.get(row, col)) continue;
    const index = (rotate ? x * width + (width - y - 1) : y * width + x) * 4;
    data[index] = data[index + 1] = data[index + 2] = 0;
  }
  return { data, width };
}

test('real QR pixels use the existing payload, including rotated photos', () => {
  for (const rotated of [false, true]) {
    const { data, width } = photo('offonika-workday-start:retail', rotated);
    assert.deepEqual(decodeWorkdayQrPhoto(data, width, width, 'retail'), { department: 'retail', qrPayload: 'offonika-workday-start:retail' });
  }
});

test('other department and unrelated QR cannot start a shift', () => {
  for (const payload of ['offonika-workday-start:wholesale', 'https://example.com']) {
    const { data, width } = photo(payload);
    assert.throws(() => decodeWorkdayQrPhoto(data, width, width, 'retail'), /другого отдела|не QR-код начала/);
  }
});

test('unreadable photo gives a retry instruction', () => {
  assert.throws(() => decodeWorkdayQrPhoto(new Uint8ClampedArray(100 * 100 * 4).fill(255), 100, 100, 'retail'), /не распознан/);
});
