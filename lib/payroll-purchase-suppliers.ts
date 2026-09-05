export const ASTEMIR_ONE_C_IDENTITY = {
  ref: '396022a2-b8d2-11ed-a2b7-0025901e48ee',
  name: 'Тохов Астемир',
} as const;

export const ASTEMIR_APPROVED_SUPPLIERS_AUGUST_2026 = [
  'Luxo',
  'П43/45 Муртаза',
  'Remax',
  'В12',
  'Б89',
  'Daben Ada',
  'Кештов Амирби Юрьевич',
  'Set Sail Film пленки',
  'Керефова Альбина',
  'Phone26 Горяч',
  'МегаАкс АбдулХалик',
  'Baseus Jackson',
  'Глазурь Ростов',
  'Смарт 05',
  'А100 Миво',
  'Usbmag',
  'Tural',
  'П17',
  'Breaking',
  '3-11 Курбан',
  'П37',
] as const;

export const ASTEMIR_EXCLUDED_SUPPLIERS_AUGUST_2026 = [
  '95-RU',
  'Зелим Чечня',
  'Скупка б/у',
  'Е1 Евротел',
  'ЗАРЯ ООО',
  'Кумыков Казбек (Смарт Мобайл)',
  'Хупсергенов Азамат iCenter',
  'Карго Юра',
  'Боготов Аскер (Gadget, Orange)',
  'Купов Мухаммед',
  'Дарфон Анзор (Вэйфон)',
  'ДарФон',
  'А15',
  'ТММ Групп',
  'A110 Bmcase',
  'Южные Ворота 888',
  'Настуев Алим ЦУМ',
  'Кумахова Диана',
  'Автобус',
] as const;

export type PayrollPurchaseSupplierRuleValue = {
  id: number;
  supplierName: string;
  normalizedName: string;
  isActive: boolean;
  source: string;
  createdAt: Date | string;
  updatedAt: Date | string;
};

export type PayrollSupplierSettlement = {
  supplierName: string;
  organizationName: string;
  currency: string;
  debtIncrease: number;
  sourceRows: number;
};

export type PayrollPurchaseSupplierPreviewRow = PayrollSupplierSettlement & {
  ruleId: number | null;
  status: 'APPROVED' | 'EXCLUDED' | 'NEW';
  includedInPayrollBase: boolean;
};

export function normalizePayrollSupplierName(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('ru');
}

export function buildPayrollPurchaseSupplierPreview(
  settlements: PayrollSupplierSettlement[],
  rules: PayrollPurchaseSupplierRuleValue[],
) {
  const rulesByName = new Map(rules.map((rule) => [rule.normalizedName, rule]));
  const rows = settlements
    .filter((row) => row.debtIncrease !== 0)
    .map<PayrollPurchaseSupplierPreviewRow>((row) => {
      const rule = rulesByName.get(normalizePayrollSupplierName(row.supplierName));
      const status = !rule ? 'NEW' : rule.isActive ? 'APPROVED' : 'EXCLUDED';
      return {
        ...row,
        ruleId: rule?.id ?? null,
        status,
        includedInPayrollBase: status === 'APPROVED',
      };
    })
    .sort((a, b) => {
      const statusOrder = { NEW: 0, APPROVED: 1, EXCLUDED: 2 } as const;
      return statusOrder[a.status] - statusOrder[b.status]
        || b.debtIncrease - a.debtIncrease
        || a.supplierName.localeCompare(b.supplierName, 'ru');
    });

  const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
  return {
    rows,
    approvedBase: roundMoney(rows.reduce((sum, row) => sum + (row.includedInPayrollBase ? row.debtIncrease : 0), 0)),
    approvedSupplierCount: rows.filter((row) => row.status === 'APPROVED').length,
    excludedSupplierCount: rows.filter((row) => row.status === 'EXCLUDED').length,
    newSupplierCount: rows.filter((row) => row.status === 'NEW').length,
    ready: rows.every((row) => row.status !== 'NEW'),
  };
}
