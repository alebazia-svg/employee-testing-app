import 'server-only';
import { createOneCCashExpenseOrder, previewOneCCashExpenseOrder, getCashStatementSummary, type CreateOneCCashExpenseOrderParams } from './one-c';

import { handoverEnvironment } from './retail-cash-handover-environment';

async function verifyHandoverBase() {
  const target = handoverEnvironment();
  if (!target) throw Error('Не настроена база 1С для передачи кассы.');
  const authorization = Buffer.from(`${process.env['1C_API_USER'] ?? ''}:${process.env['1C_API_PASSWORD'] ?? ''}`).toString('base64');
  const response = await fetch(`${target.url}/version`, {
    cache: 'no-store', redirect: 'error', headers: { Authorization: `Basic ${authorization}` },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw Error('Не удалось проверить базу 1С.');
  const version = await response.json();
  if (version.environment !== target.environment || version.base !== target.base) {
    throw Error('База 1С для передачи кассы не подтверждена.');
  }
}
export async function postRetailHandoverPair(params:CreateOneCCashExpenseOrderParams, expected:number|null, date:string) {
  await verifyHandoverBase();
  // Read an existing pair FIRST: its own cash movements must not invalidate an
  // unknown-response retry by changing the source balance.
  const preview=await previewOneCCashExpenseOrder(params);
  if(!preview.ok)throw Error(preview.error||'Предпросмотр пары 1С не выполнен.');
  if(preview.idempotentReplay&&preview.pairComplete)return preview;
  const balance=await getCashStatementSummary({date,organizationRef:params.organizationRef,cashboxRef:params.cashboxRef});
  if(!balance.ok||balance.closingBalance===null)throw Error('Не удалось проверить кассу перед проведением.');
  if(expected!==null&&Math.abs(balance.closingBalance-expected)>0.001)throw Error('Остаток кассы изменился после пересчёта. Передача требует проверки администратора.');
  return createOneCCashExpenseOrder(params);
}
