import assert from 'node:assert/strict';
import test from 'node:test';
import { startVisibleSync, type VisibleSyncEnvironment } from '../lib/visible-sync';

test('syncs immediately and repeatedly while the page stays visible', () => {
  let visible = true;
  let syncCount = 0;
  let intervalCallback: () => void = () => assert.fail('Interval callback was not registered');
  let focusListener: () => void = () => assert.fail('Focus listener was not registered');
  let visibilityListener: () => void = () => assert.fail('Visibility listener was not registered');
  let pageShowListener: () => void = () => assert.fail('Page show listener was not registered');
  let clearedTimerId: number | null = null;
  let focusListenerRemoved = false;
  let visibilityListenerRemoved = false;
  let pageShowListenerRemoved = false;

  const environment: VisibleSyncEnvironment = {
    isVisible: () => visible,
    setInterval: (callback) => {
      intervalCallback = callback;
      return 42;
    },
    clearInterval: (timerId) => {
      clearedTimerId = timerId;
    },
    addFocusListener: (listener) => {
      focusListener = listener;
    },
    removeFocusListener: (listener) => {
      focusListenerRemoved = focusListener === listener;
    },
    addVisibilityListener: (listener) => {
      visibilityListener = listener;
    },
    removeVisibilityListener: (listener) => {
      visibilityListenerRemoved = visibilityListener === listener;
    },
    addPageShowListener: (listener) => {
      pageShowListener = listener;
    },
    removePageShowListener: (listener) => {
      pageShowListenerRemoved = pageShowListener === listener;
    },
  };

  const stop = startVisibleSync(() => {
    syncCount += 1;
  }, 5_000, environment);

  assert.equal(syncCount, 1);

  intervalCallback();
  assert.equal(syncCount, 2);

  visible = false;
  intervalCallback();
  assert.equal(syncCount, 2);

  visible = true;
  visibilityListener();
  focusListener();
  assert.equal(syncCount, 4);

  visible = false;
  pageShowListener();
  assert.equal(syncCount, 5);

  focusListener();
  assert.equal(syncCount, 6);

  stop();
  assert.equal(clearedTimerId, 42);
  assert.equal(focusListenerRemoved, true);
  assert.equal(visibilityListenerRemoved, true);
  assert.equal(pageShowListenerRemoved, true);
});

test('refreshes workday timing and checklist state without focus events', () => {
  type Snapshot = {
    workDay: null | {
      startedAt: string;
      lateMinutes: number;
    };
    tasks: Array<{
      id: number;
      status: 'pending' | 'done';
    }>;
  };

  let serverSnapshot: Snapshot = {
    workDay: null,
    tasks: [{ id: 17, status: 'pending' }],
  };
  let renderedSnapshot = serverSnapshot;
  let intervalCallback: () => void = () => assert.fail('Interval callback was not registered');

  const environment: VisibleSyncEnvironment = {
    isVisible: () => true,
    setInterval: (callback) => {
      intervalCallback = callback;
      return 1;
    },
    clearInterval: () => undefined,
    addFocusListener: () => undefined,
    removeFocusListener: () => undefined,
    addVisibilityListener: () => undefined,
    removeVisibilityListener: () => undefined,
    addPageShowListener: () => undefined,
    removePageShowListener: () => undefined,
  };

  const stop = startVisibleSync(() => {
    renderedSnapshot = structuredClone(serverSnapshot);
  }, 5_000, environment);

  serverSnapshot = {
    workDay: {
      startedAt: '2026-07-26T06:07:00.000Z',
      lateMinutes: 7,
    },
    tasks: [{ id: 17, status: 'done' }],
  };
  intervalCallback();

  assert.equal(renderedSnapshot.workDay?.startedAt, '2026-07-26T06:07:00.000Z');
  assert.equal(renderedSnapshot.workDay?.lateMinutes, 7);
  assert.equal(renderedSnapshot.tasks[0].status, 'done');

  stop();
});
