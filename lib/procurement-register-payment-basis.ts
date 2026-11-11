import type { SupplierCurrencyPaymentRow } from './procurement-currency-payment-source';
import { parseOneCDateTime } from './one-c-date';

const name = (value: unknown) => typeof value === 'string'
  ? value.trim().toLocaleLowerCase('ru-RU').replaceAll('ё', 'е').replace(/\s+/g, ' ') : '';
const ref = (value: unknown) => typeof value === 'string' &&
  /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(value) && !/^0{8}-0{4}-0{4}-0{4}-0{12}$/.test(value)
  ? value.toLowerCase() : '';
const rub = (value: unknown) => ['руб', 'rub', '₽'].includes(name(value));
const currency = (value: unknown) => rub(value) ? 'rub' : name(value);
const cents = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value > 0 &&
  Number.isSafeInteger(Math.round(value * 100)) ? Math.round(value * 100) : null;
const units = (value: unknown, code: unknown) => currency(code) === 'usdt'
  ? typeof value === 'number' && Number.isFinite(value) && value > 0 && Number.isSafeInteger(Math.round(value * 1e8))
    && Math.round(value * 1e8) > 0
    ? Math.round(value * 1e8) : null
  : cents(value);

/** Fresh exact-RKO evidence, never a supplier balance or an amount/date guess.
 * Derived proof stays separate from the original header contract. */
export function attachRegisterPaymentBasis(payment: SupplierCurrencyPaymentRow, payload: Record<string, any>, now = new Date()): SupplierCurrencyPaymentRow {
  const clean = { ...payment, registerContractBasis: undefined };
  // Older releases ignore an unknown detail and return the old settlement report.
  // No capability is inferred from that HTTP 200 response.
  if (payload.contract_version !== 'supplier-payment-basis-v1') return clean;
  const at = parseOneCDateTime(payload.as_of);
  if (payload.ok !== true || payload.complete !== true || payload.write_operations !== false ||
      !at || Math.abs(now.getTime() - at.getTime()) > 15 * 60_000 ||
      !Array.isArray(payload.payment) || payload.payment.length !== 1 ||
      !Array.isArray(payload.movements) || payload.movements.length > 1000) {
    throw new Error('PAYMENT_BASIS_SOURCE_INCOMPLETE');
  }
  const p = payload.payment[0];
  const foreign = currency(payment.documentCurrency) === 'usdt';
  const documentUnits = units(payment.documentAmount, payment.documentCurrency);
  if (!p || ref(p.payment_ref) !== ref(payment.ref) || !ref(payment.ref) ||
      p.payment_number?.trim() !== payment.number.trim() || p.payment_date !== payment.date ||
      units(p.amount, p.currency_name) !== documentUnits || documentUnits === null ||
      (!rub(payment.documentCurrency) && !foreign) || currency(p.currency_name) !== currency(payment.documentCurrency) ||
      !name(payment.supplier) || name(p.supplier_name) !== name(payment.supplier) ||
      !name(payment.counterparty) || name(p.counterparty_name) !== name(payment.counterparty) ||
      typeof p.version_token !== 'string' || !p.version_token.trim()) {
    throw new Error('PAYMENT_BASIS_DOCUMENT_MISMATCH');
  }
  if (typeof p.posted !== 'boolean' || typeof p.deleted !== 'boolean' || typeof p.supplier_payment !== 'boolean') {
    throw new Error('PAYMENT_BASIS_DOCUMENT_SHAPE');
  }
  // A later read may observe unposting/deletion after the document-list read.
  if (!p.posted || p.deleted || !p.supplier_payment) return { ...clean, posted: false, deleted: p.deleted };
  const paidAt = parseOneCDateTime(payment.date);
  if (!payment.posted || payment.deleted || !paidAt || paidAt > now || !payload.movements.length) return clean;
  const dimensions = ['organization_ref', 'supplier_ref', 'counterparty_ref', 'currency_ref'];
  if (dimensions.some(key => !ref(p[key]))) return clean;
  // A USDT document may settle a RUB contract. Compare native register money
  // with the independent per-RKO settlement total/count, never a guessed rate.
  const settlementCurrency = foreign ? payment.settlementCurrency : payment.documentCurrency;
  const expectedTotal = foreign ? units(payment.settlementAmount, settlementCurrency) : documentUnits;
  if (!currency(settlementCurrency) || expectedTotal === null || (foreign &&
      (!Number.isInteger(payment.settlementMovementsCount) || payment.settlementMovementsCount !== payload.movements.length))) return clean;
  const movementDimensions = foreign ? dimensions.filter(key => key !== 'currency_ref') : dimensions;
  let movementCurrencyRef = '';
  const lines = new Set<number>();
  const contracts = new Map<string, string>();
  let total = 0;
  for (const row of payload.movements) {
    if (!row || ref(row.payment_ref) !== ref(payment.ref) ||
        !Number.isInteger(row.line_number) || row.line_number <= 0 || lines.has(row.line_number) ||
        movementDimensions.some(key => ref(row[key]) !== ref(p[key])) ||
        !ref(row.currency_ref) || (movementCurrencyRef && movementCurrencyRef !== ref(row.currency_ref)) ||
        (currency(settlementCurrency) === currency(payment.documentCurrency) && ref(row.currency_ref) !== ref(p.currency_ref)) ||
        currency(row.currency_name) !== currency(settlementCurrency) || row.movement_type !== 'Приход' ||
        parseOneCDateTime(row.movement_date)?.getTime() !== paidAt.getTime() ||
        units(row.amount, settlementCurrency) === null || !ref(row.contract_ref) || !name(row.contract_name)) return clean;
    const contractRef = ref(row.contract_ref);
    if (contracts.has(contractRef) && contracts.get(contractRef) !== row.contract_name.trim()) return clean;
    lines.add(row.line_number);
    movementCurrencyRef = ref(row.currency_ref);
    contracts.set(contractRef, row.contract_name.trim());
    total += units(row.amount, settlementCurrency)!;
  }
  if (!Number.isSafeInteger(total) || total !== expectedTotal) return clean;
  return { ...clean, registerContractBasis: {
    versionToken: p.version_token,
    contracts: [...contracts].sort(([a], [b]) => a.localeCompare(b)).map(([ref, name]) => ({ ref, name })),
  } };
}
