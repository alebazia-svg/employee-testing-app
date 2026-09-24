import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { readPlanningSnapshot, writePlanningSnapshot, planningCachePath } from '../lib/procurement-planning-cache';

test('snapshots are isolated by 1C base and stale/missing data cannot authorize requests', async t => {
  const saved = { ...process.env }; t.after(() => { process.env = saved; });
  process.env.PROCUREMENT_PLANNING_CACHE_DIR = await mkdtemp(path.join(tmpdir(), 'planning-cache-test-'));
  process.env['1C_BASE_URL'] = 'https://test.invalid/base'; process.env['1C_API_USER'] = 'test';
  assert.equal((await readPlanningSnapshot()).complete, false);
  const now = Date.now(), snapshot = { rows: [], errors: [], complete: true, planningVerified: true, checkedAt: new Date(now).toISOString() };
  await writePlanningSnapshot(snapshot); assert.deepEqual(await readPlanningSnapshot(now), snapshot);
  assert.equal((await readPlanningSnapshot(now + 16 * 60000)).complete, false);
  const testPath = planningCachePath(); process.env['1C_BASE_URL'] = 'https://production.invalid/base';
  assert.notEqual(planningCachePath(), testPath); assert.equal((await readPlanningSnapshot(now)).complete, false);
});
