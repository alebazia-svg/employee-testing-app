import sharp from 'sharp';
import jsQR from 'jsqr';
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

test('real QR pixels use the existing payload, including rotated photos', async () => {
  for (const rotated of [false, true]) {
    const { data, width } = photo('offonika-workday-start:retail', rotated);
    assert.deepEqual(await decodeWorkdayQrPhoto(data, width, width, 'retail'), { department: 'retail', qrPayload: 'offonika-workday-start:retail' });
  }
});

test('other department and unrelated QR cannot start a shift', async () => {
  for (const payload of ['offonika-workday-start:wholesale', 'https://example.com']) {
    const { data, width } = photo(payload);
    await assert.rejects(decodeWorkdayQrPhoto(data, width, width, 'retail'), /другого отдела|не QR-код начала/);
  }
});

test('unreadable photo gives a retry instruction', async () => {
  await assert.rejects(decodeWorkdayQrPhoto(new Uint8ClampedArray(100 * 100 * 4).fill(255), 100, 100, 'retail'), /не распознан/);
});


test('actual portal QR window that the old full-frame decoder missed is read without manual crop', async () => {
  const { data, info } = await sharp('tests/fixtures/qr-photo/portal-qr-window.png').ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const pixels = new Uint8ClampedArray(data);
  assert.equal(jsQR(pixels, info.width, info.height)?.data ?? null, null);
  for (const department of ['retail', 'wholesale']) {
    assert.equal((await decodeWorkdayQrPhoto(pixels, info.width, info.height, department)).department, department);
  }
});

test('cancelled region search cannot accept a late result', async () => {
  const { data, width } = photo('offonika-workday-start:retail');
  await assert.rejects(decodeWorkdayQrPhoto(data, width, width, 'retail', () => false), { name: 'AbortError' });
});

test('close-up without white margins is accepted', async () => {
  const buffer = await QRCode.toBuffer('offonika-workday-start:retail', { width: 640, margin: 0 });
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal((await decodeWorkdayQrPhoto(new Uint8ClampedArray(data), info.width, info.height, 'retail')).department, 'retail');
});

test('arbitrary rotation and moderate slant are accepted', async () => {
  const buffer = await QRCode.toBuffer('offonika-workday-start:retail', { width: 640, margin: 2 });
  const variants = [
    sharp(buffer).rotate(33, { background: '#ffffff' }),
    sharp(buffer).rotate(147, { background: '#ffffff' }),
    sharp(buffer).affine([[1, 0.25], [0.03, 0.9]], { background: '#ffffff' }),
  ];
  for (const image of variants) {
    const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    assert.equal((await decodeWorkdayQrPhoto(new Uint8ClampedArray(data), info.width, info.height, 'retail')).department, 'retail');
  }
});

test('small off-centre code among surrounding content is found automatically', async () => {
  const buffer = await QRCode.toBuffer('offonika-workday-start:retail', { width: 110, margin: 2 });
  const { data, info } = await sharp({ create: { width: 1400, height: 1000, channels: 4, background: '#e7e2da' } })
    .composite([{ input: buffer, left: 190, top: 700 }]).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal((await decodeWorkdayQrPhoto(new Uint8ClampedArray(data), info.width, info.height, 'retail')).department, 'retail');
});


test('cancelling while searching regions discards further decoding', async () => {
  const { data, info } = await sharp('tests/fixtures/qr-photo/portal-qr-window.png').ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let checks = 0;
  await assert.rejects(decodeWorkdayQrPhoto(new Uint8ClampedArray(data), info.width, info.height, 'retail', () => ++checks < 2), { name: 'AbortError' });
});
