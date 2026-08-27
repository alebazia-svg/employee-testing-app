import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_EMPLOYEE_IMAGE_BYTES, requestBodyTooLarge, validateEmployeeImage } from '@/lib/image-upload';

test('accepts a real JPEG signature and rejects a renamed file', async () => {
  const jpeg = new File([Uint8Array.from([0xff, 0xd8, 0xff, 0x00])], 'photo.jpg', { type: 'image/jpeg' });
  assert.equal((await validateEmployeeImage(jpeg)).extension, 'jpg');
  const fake = new File(['not an image'], 'photo.jpg', { type: 'image/jpeg' });
  await assert.rejects(() => validateEmployeeImage(fake), /настоящие JPG/);
});

test('rejects oversized request before multipart parsing', () => {
  const request = new Request('https://portal.example/upload', { method: 'POST', headers: { 'content-length': String(MAX_EMPLOYEE_IMAGE_BYTES + 1024 * 1024 + 1) } });
  assert.equal(requestBodyTooLarge(request), true);
});
