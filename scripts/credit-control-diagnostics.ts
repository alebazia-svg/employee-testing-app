import { automaticCreditShadowPeriod, loadCreditRealizationShadowSnapshot } from '@/lib/credit-realization-shadow-runner';

async function main() {
  const period = automaticCreditShadowPeriod(new Date(), 14);
  const snapshot = await loadCreditRealizationShadowSnapshot(period);
  const rows = snapshot.rows.filter((row) => row.result.status !== 'confirmed').map((row) => ({
    document: row.document.number,
    realizationAt: row.document.date,
    amount: row.document.amount,
    status: row.result.status,
    reasons: row.result.reasonCodes,
    employeeAction: row.result.employeeActionEligible,
    receiptDelayMinutes: row.result.receiptDelayMinutes,
    linksComplete: row.links.completeness.complete,
    payments: [
      ...row.links.cashReceipts.direct.map((item) => ({ type: 'cash', number: item.number, date: item.date, amount: item.amount, posted: item.posted })),
      ...row.links.acquiring.direct.map((item) => ({ type: 'card', number: item.number, date: item.date, amount: item.amount, posted: item.posted })),
    ],
    fiscalDocuments: row.links.fiscalControl.documents.map((document) => ({
      sourceType: document.sourceType,
      operations: document.operations.map((operation) => ({
        datetime: operation.datetime,
        type: operation.documentType,
        total: operation.amount,
        cash: operation.cashPayment,
        electronic: operation.electronicPayment,
        credit: operation.postpayment,
        fiscalIdentityComplete: Boolean(operation.fiscalDriveNumber && operation.fiscalDocumentNumber && operation.fiscalSign),
      })),
    })),
  }));
  console.log(JSON.stringify({
    checkedAt: snapshot.checkedAt,
    periodFrom: snapshot.periodFrom,
    periodTo: snapshot.periodTo,
    complete: snapshot.complete,
    oneCComplete: snapshot.oneCComplete,
    ofdComplete: snapshot.ofdComplete,
    errorCode: snapshot.errorCode,
    rows,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'CREDIT_DIAGNOSTICS_FAILED');
  process.exitCode = 1;
});
