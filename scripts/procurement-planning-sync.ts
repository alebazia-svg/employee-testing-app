import { open, unlink, readFile } from 'node:fs/promises';
import { planningCachePath, readPlanningSnapshot, writePlanningSnapshot } from '../lib/procurement-planning-cache';
import { collectPlanningSnapshot } from '../lib/procurement-planning-sync';
import { prisma } from '../lib/prisma';

async function main() {
  // Initialize the private directory without publishing a fresh empty snapshot.
  const { mkdir } = await import('node:fs/promises');
  const { dirname } = await import('node:path');
  await mkdir(dirname(planningCachePath()), { recursive: true, mode: 0o700 });
  const lockPath = `${planningCachePath()}.lock`;
  let lock = await open(lockPath, 'wx', 0o600).catch(() => null);
  if (!lock) {
    const pid = Number(await readFile(lockPath, 'utf8').catch(() => ''));
    if (Number.isSafeInteger(pid) && pid > 0) {
      try { process.kill(pid, 0); } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ESRCH') {
          await unlink(lockPath).catch(() => {});
          lock = await open(lockPath, 'wx', 0o600).catch(() => null);
        }
      }
    }
  }
  if (!lock) throw Error('PLANNING_SYNC_ALREADY_RUNNING');
  await lock.writeFile(String(process.pid));
  try {
    const previous = await readPlanningSnapshot(Date.now(), true);
    const plans = await prisma.supplierPaymentPlan.findMany({ where: { status: { in: ['SUBMITTED', 'APPROVED', 'NEEDS_CHANGES'] } }, select: { orderRefs: true } });
    const refs = [...new Set(plans.flatMap(p => Array.isArray(p.orderRefs) ? p.orderRefs.map(String) : []))];
    const snapshot = await collectPlanningSnapshot(previous, refs);
    await writePlanningSnapshot(snapshot);
    console.log(JSON.stringify({ ok: true, orders: snapshot.rows.length,
      states: snapshot.rows.reduce<Record<string, number>>((counts, r) => { const s = r.planningState || 'unknown'; counts[s] = (counts[s] || 0) + 1; return counts; }, {}),
      checkedAt: snapshot.checkedAt, oneCWrites: 0 }));
  } finally { await lock.close(); await unlink(lockPath); await prisma.$disconnect(); }
}
async function run() { try { await main(); } catch (error: any) { const code = typeof error?.code === 'string' && /^[A-Z0-9_]+$/.test(error.code) ? error.code
  : error instanceof Error && /^[A-Z_]+$/.test(error.message) ? error.message : 'SOURCE_OR_DATABASE_ERROR';
  console.error(`PLANNING_SYNC_FAILED ${code}: previous snapshot preserved`); if (!process.argv.includes('--watch')) process.exitCode = 1; } }
async function start() {
  do { await run(); if (!process.argv.includes('--watch')) break; await new Promise(resolve => setTimeout(resolve, 3 * 60000)); } while (true);
}
void start();
