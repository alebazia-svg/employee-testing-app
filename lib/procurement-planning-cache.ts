import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { readOneCRuntimeEnv } from './one-c-env';
import type { SupplierOrderFinanceSnapshot } from './procurement-payment-source';

export const PLANNING_MAX_AGE_MS = 15 * 60000;
export function planningCachePath() {
  const env = readOneCRuntimeEnv();
  if (!env.baseUrl) throw Error('PLANNING_SOURCE_UNCONFIGURED');
  const scope = createHash('sha256').update(env.baseUrl.replace(/\/$/, '') + '\n' + env.user).digest('hex');
  return path.join(process.env.PROCUREMENT_PLANNING_CACHE_DIR || path.join(process.cwd(), '.cache', 'procurement'), `${scope}.json`);
}
export async function readPlanningSnapshot(now = Date.now(), allowStale = false): Promise<SupplierOrderFinanceSnapshot> {
  try {
    const data = JSON.parse(await readFile(planningCachePath(), 'utf8'));
    if (data.schema !== 'procurement-planning-v1' || !Array.isArray(data.snapshot?.rows)
      || !Array.isArray(data.snapshot?.errors) || typeof data.snapshot?.complete !== 'boolean') throw Error();
    const age = now - Date.parse(data.snapshot.checkedAt);
    if (!Number.isFinite(age) || age < -60000) throw Error();
    if (!allowStale && age > PLANNING_MAX_AGE_MS) {
      return { ...data.snapshot, complete: false, errors: ['PLANNING_SNAPSHOT_STALE'] };
    }
    return data.snapshot;
  } catch {
    return { rows: [], checkedAt: '', complete: false, planningVerified: true, errors: ['PLANNING_SNAPSHOT_MISSING'] };
  }
}
export async function writePlanningSnapshot(snapshot: SupplierOrderFinanceSnapshot) {
  const target = planningCachePath();
  await mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
  const temporary = `${target}.${randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify({ schema: 'procurement-planning-v1', snapshot }), { mode: 0o600, flag: 'wx' });
  await rename(temporary, target);
}
