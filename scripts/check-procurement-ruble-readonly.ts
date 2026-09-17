/** Focused read-only regression for the owner-reported MEMS document. No DB writes. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fetchSupplierCurrencyPaymentSnapshot } from '../lib/procurement-currency-payment-source';
import { matchProcurementPaymentEvidence } from '../lib/procurement-currency-payment-evidence';

async function main() {
  const config = Object.fromEntries(fs.readFileSync(path.join(os.homedir(), '.config/1c-integration/agentapi.env'), 'utf8')
    .split('\n').filter((line) => /^[A-Z_]+=/.test(line)).map((line) => {
      const i = line.indexOf('='); return [line.slice(0, i), line.slice(i + 1).trim().replace(/^['"]|['"]$/g, '')];
    }));
  process.env['1C_BASE_URL'] = config.ONEC_BASE_URL;
  process.env['1C_API_USER'] = config.ONEC_API_USER;
  process.env['1C_API_PASSWORD'] = config.ONEC_API_PASSWORD;
  const source = await fetchSupplierCurrencyPaymentSnapshot({ from: new Date('2026-09-15'), to: new Date('2026-09-16'), timeoutMs: 30000 });
  const plan = { id: 'mems', planCode: 'PAY-20260915-803255', supplierPartner: 'MEMS Technology', supplierCounterparty: 'MEMS Technology',
    orderRefs: ['357c10c7-ad22-11f1-8f0e-002590803daf'], plannedAmount: 280000, paymentMethod: 'CASH', status: 'APPROVED',
    createdAt: '2026-09-15T14:33:29.075Z', plannedDate: '2026-09-16' };
  if (!source.complete) throw new Error('INCOMPLETE_SOURCE');
  const result = matchProcurementPaymentEvidence([plan], [], source.payments, source.conversions).get('mems')!;
  if (result.state !== 'ISSUED_BY_ONE_C' || result.issuedAmount !== 280000 || result.cashOrders.length !== 1) throw new Error('MEMS_MISMATCH');
  console.log(JSON.stringify({ readOnly: true, complete: source.complete, state: result.state, paidRub: result.issuedAmount,
    remainingRub: result.remainingAmount, exactOrderLink: true, matchedDocuments: result.cashOrders.length }));
}
main().catch((error) => { console.error(error instanceof Error && ['INCOMPLETE_SOURCE', 'MEMS_MISMATCH'].includes(error.message) ? error.message : 'READONLY_CHECK_FAILED'); process.exitCode = 1; });
