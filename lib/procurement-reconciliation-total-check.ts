type Row = Record<string, unknown>;
const name = (v: unknown) => typeof v === 'string' ? v.trim() : '';
const money = (v: unknown) => {
  if (typeof v !== 'number' || !Number.isFinite(v) || !Number.isSafeInteger(Math.round(v * 100))
    || Math.abs(v * 100 - Math.round(v * 100)) > 0.00001) throw new Error('INVALID_AMOUNT');
  return Math.round(v * 100);
};
const sum = (a: number, b: number) => {
  if (!Number.isSafeInteger(a + b)) throw new Error('AMOUNT_OVERFLOW');
  return a + b;
};

/** Secondary report control only. UUID-grain reconciliation remains mandatory.
 * The legacy report has names, not UUIDs: this check cannot prove identity or
 * authorize offsetting between contracts/organizations or closing a request. */
export function supplierTotalCheck(detail: unknown, report: unknown, supplierName: string, date: string): boolean {
  try {
    const d = detail as Record<string, unknown>, p = report as Record<string, unknown>;
    if (!d || !p || p.ok !== true || p.endpoint !== 'supplier-settlements'
      || p.date_from !== date || p.date_to !== date || !Array.isArray(p.rows) || !Array.isArray(d.ledger_balances)
      || p.sign_convention !== 'Supplier debt is negative; overpayment or positive balance is positive. closing_balance = opening_balance - debt_increase + debt_decrease.') return false;
    const totals = p.totals as Row;
    if (!totals || totals.is_limited !== false || totals.rows_count !== p.rows.length) return false;
    const expected = new Map<string, number>(), actual = new Map<string, number>();
    const contracts = new Map<string, string>(), currencies = new Map<string, string>();
    const key = (contract: unknown, currency: unknown) => {
      if (typeof contract !== 'string' || !name(currency)) throw new Error('MISSING_LABEL');
      return JSON.stringify([name(contract), name(currency)]);
    };
    for (const row of d.ledger_balances as Row[]) {
      for (const [labels, label, ref] of [
        [contracts, name(row.contract_name), row.contract_ref],
        [currencies, name(row.currency_name), row.currency_ref],
      ] as const) {
        if (typeof ref !== 'string' || (labels.has(label) && labels.get(label) !== ref)) throw new Error('AMBIGUOUS_LABEL');
        labels.set(label, ref);
      }
      const k = key(row.contract_name, row.currency_name);
      actual.set(k, sum(actual.get(k) ?? 0, money(row.raw_balance)));
    }
    const seen = new Set<string>();
    for (const row of p.rows as Row[]) {
      if (!row || typeof row !== 'object') return false;
      if (name(row.supplier_partner) !== supplierName.trim()) continue;
      const identity = JSON.stringify(['supplier_partner', 'supplier_counterparty', 'organization', 'contract', 'currency'].map(k => {
        if (typeof row[k] !== 'string') throw new Error('MISSING_DIMENSION');
        return row[k];
      }));
      if (seen.has(identity)) return false;
      seen.add(identity);
      if (sum(sum(money(row.opening_balance), -money(row.debt_increase)), money(row.debt_decrease)) !== money(row.closing_balance)) return false;
      const k = key(row.contract, row.currency);
      expected.set(k, sum(expected.get(k) ?? 0, money(row.closing_balance)));
    }
    return [...new Set([...actual.keys(), ...expected.keys()])].every(k => (actual.get(k) ?? 0) === (expected.get(k) ?? 0));
  } catch { return false; }
}
