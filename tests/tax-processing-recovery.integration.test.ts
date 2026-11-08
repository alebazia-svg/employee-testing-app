import test from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const database = process.env.PORTAL_RELIABILITY_TEST_DATABASE_URL;
test('real PostgreSQL lock protects attempt ordering and restart reconciliation', { skip: !database }, async () => {
  const url = new URL(database!);
  assert.ok(['127.0.0.1', 'localhost'].includes(url.hostname), 'Only an isolated local database is allowed');
  const schema = url.searchParams.get('schema') || '';
  assert.match(schema, /^reliability_test_[a-z0-9_]+$/);
  const db = new PrismaClient({ datasources: { db: { url: database } } });
  const saved = { database: process.env.DATABASE_URL, root: process.env.AUSN_PORTAL_INTAKE_DIR };
  const root = await mkdtemp(path.join(os.tmpdir(), 'tax-recovery-db-'));
  process.env.DATABASE_URL = database;
  process.env.AUSN_PORTAL_INTAKE_DIR = root;
  let disconnect: (() => Promise<void>) | undefined;
  try {
    // A separate disposable schema, not the audit fixture tables or production.
    await db.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    await db.$executeRawUnsafe(`CREATE TABLE "${schema}"."TaxControlDocument" (id TEXT PRIMARY KEY, status TEXT NOT NULL)`);
    await db.$executeRaw`INSERT INTO "TaxControlDocument" (id, status) VALUES ('doc', 'UPLOADED')`;
    const { taxProcessingJobs } = await import('../lib/tax-processing-recovery');
    const { prisma } = await import('../lib/prisma');
    disconnect = () => prisma.$disconnect();
    const old = await taxProcessingJobs().begin('doc');
    const current = await taxProcessingJobs().begin('doc');
    await taxProcessingJobs().finish('doc', current.attempt, { state: 'done' });
    assert.equal(await taxProcessingJobs().finish('doc', old.attempt, { state: 'failed' }), null);
    const status = async () => (await db.$queryRaw<Array<{ status: string }>>`SELECT status FROM "TaxControlDocument" WHERE id='doc'`)[0].status;
    assert.equal(await status(), 'PROCESSED');
    const recovering = await taxProcessingJobs().begin('doc');
    await mkdir(path.join(root, 'results'), { recursive: true });
    await writeFile(path.join(root, 'results', `${recovering.attempt}.json`), JSON.stringify({ status: 'completed' }));
    assert.equal(await status(), 'UPLOADED');
    assert.equal((await taxProcessingJobs().reconcile('doc'))?.state, 'done');
    assert.equal(await status(), 'PROCESSED');
    await taxProcessingJobs().finish('doc', recovering.attempt, { state: 'processing' });
    assert.equal(await status(), 'PROCESSED');
  } finally {
    if (disconnect) await disconnect();
    await db.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await db.$disconnect();
    if (saved.database === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = saved.database;
    if (saved.root === undefined) delete process.env.AUSN_PORTAL_INTAKE_DIR; else process.env.AUSN_PORTAL_INTAKE_DIR = saved.root;
  }
});
