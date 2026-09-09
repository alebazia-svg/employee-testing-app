import 'server-only';

import { readOneCRuntimeEnv } from '@/lib/one-c-env';

export type SupplierOrderFinanceRow = {
  ref: string;
  date: string;
  number: string;
  supplierPartner: string;
  supplierCounterparty: string;
  manager: string;
  currentState: string;
  amount: number;
  receiptAmount: number;
  paymentAmount: number;
  orderPaymentGap: number;
  supplierDebt: number;
  controlGroup: string;
  controlReason: string;
};

export type SupplierOrderFinanceSnapshot = {
  rows: SupplierOrderFinanceRow[];
  checkedAt: string;
  complete: boolean;
  errors: string[];
};

type RawRow = Record<string, unknown>;

const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const amount = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : Number(value) || 0;

export function normalizeManagerName(value: string) {
  return value.trim().toLocaleLowerCase('ru-RU').replaceAll('ё', 'е').replace(/\s+/g, ' ');
}

export function normalizeSupplierOrder(row: RawRow): SupplierOrderFinanceRow | null {
  const ref = text(row.ref);
  if (!ref) return null;
  return {
    ref,
    date: text(row.date),
    number: text(row.number),
    supplierPartner: text(row.supplier_partner),
    supplierCounterparty: text(row.supplier_counterparty),
    manager: text(row.manager),
    currentState: text(row.current_state),
    amount: amount(row.amount),
    receiptAmount: amount(row.receipt_amount),
    paymentAmount: amount(row.payment_amount),
    orderPaymentGap: amount(row.order_payment_gap),
    supplierDebt: amount(row.supplier_debt),
    controlGroup: text(row.control_group),
    controlReason: text(row.control_reason),
  };
}

export function ordersForManager(rows: SupplierOrderFinanceRow[], managerName: string) {
  const manager = normalizeManagerName(managerName);
  if (!manager) return [];
  return rows.filter((row) => normalizeManagerName(row.manager) === manager);
}

export function ordersRequiringPayment(rows: SupplierOrderFinanceRow[]) {
  return rows.filter((row) => row.orderPaymentGap > 0.009);
}

export async function fetchSupplierOrderFinance(): Promise<SupplierOrderFinanceSnapshot> {
  const env = readOneCRuntimeEnv();
  if (!env.baseUrl || !env.user || !env.password) throw new Error('SUPPLIER_ORDER_SOURCE_UNCONFIGURED');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(env.requestTimeoutMs) || 15_000);
  try {
    const response = await fetch(`${env.baseUrl}/supplier-order-finance-control?limit=1000`, {
      headers: { Accept: 'application/json', Authorization: `Basic ${Buffer.from(`${env.user}:${env.password}`, 'utf8').toString('base64')}` },
      cache: 'no-store', signal: controller.signal,
    });
    const payload = await response.json() as { ok?: boolean; active_goods_orders?: RawRow[]; completeness?: { complete?: boolean } };
    if (!response.ok || payload.ok === false) throw new Error(`SUPPLIER_ORDER_SOURCE_HTTP_${response.status}`);
    const rawRows = Array.isArray(payload.active_goods_orders) ? payload.active_goods_orders : [];
    const rows = rawRows.map(normalizeSupplierOrder).filter((row): row is SupplierOrderFinanceRow => Boolean(row));
    const errors = rows.length === rawRows.length ? [] : ['ROW_REF_MISSING'];
    return { rows, checkedAt: new Date().toISOString(), complete: payload.completeness?.complete !== false && errors.length === 0, errors };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw new Error('SUPPLIER_ORDER_SOURCE_TIMEOUT');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
