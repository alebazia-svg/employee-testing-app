import 'server-only';

import { getCashStatementDimensions, getCashStatementSummary } from '@/lib/one-c';

export type ProcurementCurrencyBalance = { balance: number | null; checkedAt: string; sourceLabel: string; error: string };
export type ProcurementBalances = { usdt: ProcurementCurrencyBalance; accountable: ProcurementCurrencyBalance };

const unavailable = (sourceLabel: string, checkedAt: string, error: string): ProcurementCurrencyBalance => ({ balance: null, checkedAt, sourceLabel, error });

export async function getProcurementBalances(date: string): Promise<ProcurementBalances> {
  const dimensions = await getCashStatementDimensions();
  if (!dimensions.ok) {
    const error = dimensions.error || 'CASHBOX_DIMENSIONS_UNAVAILABLE';
    return {
      usdt: unavailable('1С · Касса USDT', dimensions.checkedAt, error),
      accountable: unavailable('1С · Касса Подотчетника', dimensions.checkedAt, error),
    };
  }
  const organizations = dimensions.organizations.filter((item) => !item.deleted && item.name.trim().toLocaleLowerCase('ru-RU') === 'оффоника');
  const organization = organizations.length === 1 ? organizations[0] : null;

  async function read(cashboxName: string, ambiguityError: string, balanceError: string) {
    const cashboxes = dimensions.cashboxes.filter((item) => !item.deleted && item.name.trim().toLocaleLowerCase('ru-RU') === cashboxName.toLocaleLowerCase('ru-RU'));
    const sourceLabel = `1С · ${cashboxes[0]?.name || cashboxName}`;
    if (!organization || cashboxes.length !== 1) return unavailable(sourceLabel, dimensions.checkedAt, ambiguityError);
    const summary = await getCashStatementSummary({ date, organizationRef: organization.ref, cashboxRef: cashboxes[0].ref });
    if (!summary.ok || summary.closingBalance == null) return unavailable(sourceLabel, summary.checkedAt, summary.error || balanceError);
    return { balance: summary.closingBalance, checkedAt: summary.checkedAt, sourceLabel, error: '' };
  }

  const [usdt, accountable] = await Promise.all([
    read('Касса USDT', 'USDT_CASHBOX_OR_ORGANIZATION_AMBIGUOUS', 'USDT_BALANCE_UNAVAILABLE'),
    read('Касса Подотчетника', 'ACCOUNTABLE_CASHBOX_OR_ORGANIZATION_AMBIGUOUS', 'ACCOUNTABLE_BALANCE_UNAVAILABLE'),
  ]);
  return { usdt, accountable };
}

export async function getProcurementUsdtBalance(date: string) { return (await getProcurementBalances(date)).usdt; }
export async function getProcurementAccountableBalance(date: string) { return (await getProcurementBalances(date)).accountable; }
