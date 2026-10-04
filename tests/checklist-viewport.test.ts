import assert from 'node:assert/strict';
import test from 'node:test';
import { checklistScrollTarget } from '../lib/checklist-viewport';

test('does not scroll an already visible checklist', () => {
  assert.equal(checklistScrollTarget(100, 100, 600, 720), null);
});
test('returns to the checklist when its header is above the viewport', () => {
  assert.equal(checklistScrollTarget(500, -200, 200, 720), 288);
});
test('reveals a task obscured by bottom navigation without scrolling to the page header', () => {
  assert.equal(checklistScrollTarget(0, 300, 790, 720), 288);
});
test('never asks for a negative scroll position', () => {
  assert.equal(checklistScrollTarget(0, 0, 800, 720), 0);
});
