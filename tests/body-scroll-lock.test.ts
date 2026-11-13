import test from 'node:test';
import assert from 'node:assert/strict';
import { lockBodyScroll } from '../lib/body-scroll-lock';

test('closing the last dialog restores the original page overflow', () => {
  for (const overflow of ['', 'auto', 'hidden']) {
    const body = { style: { overflow } } as HTMLElement;
    const release = lockBodyScroll(body);
    assert.equal(body.style.overflow, 'hidden');
    release();
    assert.equal(body.style.overflow, overflow);
  }
});

test('overlapping dialogs release in either order without leaving the page locked', () => {
  for (const order of [[0, 1], [1, 0]]) {
    const body = { style: { overflow: '' } } as HTMLElement;
    const release = [lockBodyScroll(body), lockBodyScroll(body)];
    release[order[0]]();
    assert.equal(body.style.overflow, 'hidden');
    release[order[1]]();
    assert.equal(body.style.overflow, '');
  }
});

test('cleanup is idempotent and a later dialog captures a fresh baseline', () => {
  const body = { style: { overflow: '' } } as HTMLElement;
  const release = lockBodyScroll(body);
  release();
  body.style.overflow = 'auto';
  const laterRelease = lockBodyScroll(body);
  release();
  assert.equal(body.style.overflow, 'hidden');
  laterRelease();
  assert.equal(body.style.overflow, 'auto');
});
