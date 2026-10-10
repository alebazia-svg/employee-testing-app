import test from 'node:test';
import assert from 'node:assert/strict';
import {PrismaClient} from '@prisma/client';
import {readFile} from 'node:fs/promises';

test('receipt migrations add defaults without rewriting legacy plan data or links',async()=>{
  assert.equal(process.env.DATABASE_URL,'postgresql://postgres@127.0.0.1:55439/procurement_receipts_current_test');
  const db=new PrismaClient();const rollback=new Error('TEST_ROLLBACK');
  try{
    await assert.rejects(db.$transaction(async tx=>{
      // Private transaction-local schema; the deliberate rollback removes it.
      await tx.$executeRawUnsafe('CREATE SCHEMA receipt_migration_isolated_check');
      await tx.$executeRawUnsafe('SET LOCAL search_path TO receipt_migration_isolated_check');
      await tx.$executeRawUnsafe('CREATE TABLE "User" ("id" INTEGER PRIMARY KEY)');
      await tx.$executeRawUnsafe('CREATE TABLE "SupplierPaymentPlan" ("id" TEXT PRIMARY KEY, "paymentMethod" TEXT, "plannedAmount" NUMERIC, "orderRefs" JSONB, "oneCCashEvidence" JSONB)');
      await tx.$executeRaw`INSERT INTO "SupplierPaymentPlan" VALUES ('legacy','USDT',731483,'["order-423"]'::jsonb,'{"manualRubleLinks":[{"ref":"RKO","fingerprint":"saved"}]}'::jsonb)`;
      const before=await tx.$queryRawUnsafe<any[]>('SELECT * FROM "SupplierPaymentPlan"');
      for(const name of ['20261010190000_procurement_receipts','20261010210000_procurement_payment_purpose','20261010220000_procurement_funding_source']){
        const sql=await readFile(`prisma/migrations/${name}/migration.sql`,'utf8');
        for(const statement of sql.split(';').map(s=>s.trim()).filter(Boolean))await tx.$executeRawUnsafe(statement);
      }
      const after=await tx.$queryRawUnsafe<any[]>('SELECT "id", "paymentMethod", "plannedAmount", "orderRefs", "oneCCashEvidence", "paymentPurpose", "fundingSource" FROM "SupplierPaymentPlan"');
      const {paymentPurpose,fundingSource,...unchanged}=after[0];
      assert.deepEqual(unchanged,before[0]);assert.equal(paymentPurpose,'GOODS');assert.equal(fundingSource,null);
      throw rollback;
    }),error=>error===rollback);
  }finally{await db.$disconnect();}
});
