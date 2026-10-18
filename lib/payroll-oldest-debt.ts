import type { PayrollLedgerRead } from './payroll-one-c-ledger';
import type { PayrollCashRead } from './payroll-one-c-payments';

// Owner-approved policy for Bela only. Never a native 1C payroll-month field.
// An opening debt stays an unnamed older bucket; its individual months are not invented.
export function oldestPayrollDebt(employee: string, ref: string, period: string,
  ledger: PayrollLedgerRead | undefined, cash: PayrollCashRead, totalDebtMinor: number) {
  if (employee !== 'Кештова Бэла' || !ledger?.allocationEvidence
      || ledger.dateFrom !== `${period}-01` || ledger.dateFrom !== cash.dateFrom || ledger.dateTo !== cash.dateTo) return null;
  const evidence = ledger.allocationEvidence;
  const opening = evidence.opening.filter(r => r.employeeRef === ref);
  const movements = evidence.movements.filter(r => r.employeeRef === ref);
  if (new Set([...opening, ...movements].map(r => r.organizationRef)).size > 1 || opening.some(r => r.signedMinor > 0)) return null;
  const buckets = new Map<string, number>([['0000-00', -opening.reduce((s,r) => s+r.signedMinor,0)]]);
  const paid = new Map<string, number>();
  const currentDocuments: { key: string; amount: number }[] = [];
  const months = ['янв','фев','мар','апр','ма','июн','июл','авг','сент','окт','ноя','дек'];
  let accrued = 0, advances = 0;
  for (const movement of [...movements].sort((a,b) => a.date.localeCompare(b.date) || a.sign-b.sign || a.key.localeCompare(b.key))) {
    if (movement.amountMinor < 0) return null;
    if (movement.sign === -1 && movement.kind === 'asset_liability_movement') {
      const match = /^\s*(?:проценты|зарплата|заработная плата)\s+за\s+([а-яё]+)(?:\s+(20\d{2}))?\s*$/iu.exec(movement.comment);
      const month = match ? months.findIndex(m => match[1].toLowerCase().startsWith(m)) + 1 : 0;
      if (!month) return null;
      const year = match![2] ? Number(match![2]) : Number(movement.date.slice(0,4)) - (month > Number(movement.date.slice(5,7)) ? 1 : 0);
      const key = `${year}-${String(month).padStart(2,'0')}`;
      buckets.set(key, (buckets.get(key) ?? 0) + movement.amountMinor);
      if (key === period) accrued += movement.amountMinor;
    } else if (movement.sign === 1 && movement.kind === 'cash_expense') {
      const docs = cash.documents.filter(d => d.key === movement.key && d.identityConfirmed && d.employeeRef.toLowerCase() === ref && Math.round(d.amount*100) === movement.amountMinor);
      if (docs.length !== 1) return null;
      const doc = docs[0];
      if (doc.comment.trim() && !doc.advancePeriod) return null;
      let rest = movement.amountMinor, forPeriod = 0;
      // Explicit advances may precede their accrual. Unlabelled excess is not guessed.
      const keys = doc.advancePeriod ? [doc.advancePeriod] : [...buckets.keys()].sort();
      for (const key of keys) {
        const take = doc.advancePeriod ? rest : Math.min(rest, Math.max(0,buckets.get(key) ?? 0));
        buckets.set(key,(buckets.get(key) ?? 0)-take);
        paid.set(key,(paid.get(key) ?? 0)+take);
        rest -= take;
        if (key === period) forPeriod += take;
        if (!rest) break;
      }
      if (rest) return null;
      if (forPeriod) currentDocuments.push({key:doc.key,amount:forPeriod/100});
      if (doc.advancePeriod === period) advances += forPeriod;
    } else return null;
  }
  const total = [...buckets.values()].reduce((s,v) => s+v,0);
  if (accrued <= 0 || total !== totalDebtMinor || [...buckets.values()].some(v => v < 0)) return null;
  return { remaining: (buckets.get(period) ?? 0)/100, accrued: accrued/100,
    paid: (paid.get(period) ?? 0)/100, advances: advances/100,
    olderDebt: [...buckets].reduce((s,[key,v]) => s+(key < period ? v : 0),0)/100, currentDocuments };
}
