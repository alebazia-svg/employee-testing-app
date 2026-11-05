import test from 'node:test';
import assert from 'node:assert/strict';
import {requisitesImageWithAmount} from '../lib/procurement-share-image';

test('share copy retains full image dimensions, places amount below, and releases source URL', async () => {
  const previous = {Image: globalThis.Image, document: globalThis.document, create: URL.createObjectURL, revoke: URL.revokeObjectURL};
  const revoked: string[] = [];
  const draws: unknown[][] = [];
  const labels: unknown[][] = [];
  const canvas = {width: 0, height: 0, getContext: () => ({fillRect() {}, drawImage(...args: unknown[]) {draws.push(args);}, fillText(...args: unknown[]) {labels.push(args);}}), toBlob: (done: (b: Blob) => void) => done(new Blob(['prepared-png'], {type: 'image/png'}))};
  try {
    URL.createObjectURL = () => 'blob:test-source';
    URL.revokeObjectURL = url => revoked.push(url);
    globalThis.Image = class {naturalWidth = 1200; naturalHeight = 1800; onload?: () => void; set src(_: string) {queueMicrotask(() => this.onload?.());}} as unknown as typeof Image;
    globalThis.document = {createElement: () => canvas} as unknown as Document;
    const original = new File(['original'], 'supplier-photo.jpg', {type: 'image/jpeg'});
    const result = await requisitesImageWithAmount(original, '4 255 CNY');
    assert.equal(canvas.width, 1200);
    assert.ok(canvas.height > 1800);
    assert.equal(draws.length, 1);
    // The three-argument form preserves natural size and never crops the source.
    assert.deepEqual(draws[0].slice(1), [0, 0]);
    assert.equal(labels[0][0], '4 255 CNY');
    assert.ok(Number(labels[0][2]) > 1800);
    assert.equal(result.type, 'image/png');
    assert.equal(await original.text(), 'original');
    assert.deepEqual(revoked, ['blob:test-source']);
    await assert.rejects(requisitesImageWithAmount(new File(['pdf'], 'qr.pdf', {type: 'application/pdf'}), '1 CNY'), /не является картинкой/);
  } finally {
    globalThis.Image = previous.Image;
    globalThis.document = previous.document;
    URL.createObjectURL = previous.create;
    URL.revokeObjectURL = previous.revoke;
  }
});
