import assert from 'node:assert/strict';
import test from 'node:test';
import { OWNER_MONEY_ACCOUNTS, parseOwnerMoneyStatements } from '../lib/procurement-cash-forecast-source';

const asOf = '2026-09-12';
const row = (name: string, type: string, index: number) => ({
  account: { name, ref: `account-${index}` }, type, group: type,
  opening_balance: 100, incoming_total: 25, outgoing_total: 5,
  closing_balance: 120, reconciled: true, reconciliation_difference: 0,
});
const payload = (kind: string, accounts: unknown[]) => ({
  ok: true, endpoint: 'money-statement', money_type: kind,
  date_from: asOf, date_to: asOf, complete: true, truncated: false, accounts,
});
const valid = () => ['bank', 'cash'].map((kind) => payload(kind,
  OWNER_MONEY_ACCOUNTS.filter((account) => account.type === kind)
    .map((account) => row(account.name, kind, OWNER_MONEY_ACCOUNTS.indexOf(account)))));

test('maps exactly six verified owner bank/card/safe positions and no other 1C cashboxes', () => {
  const statements = valid();
  statements[1].accounts.push(row('Касса Подотчетника', 'cash', 20));
  const result = parseOwnerMoneyStatements(statements, asOf);
  assert.equal(result.complete, true);
  assert.equal(result.positions.length, 6);
  assert.equal(result.positions.reduce((sum, position) => sum + position.balanceMinor, 0), 72_000);
  assert.ok(result.accountNames.includes('Сейф Депозитный'));
  assert.equal(result.currencyAssumedRubles, true);
});

test('does not silently use an incomplete, mismatched or newly named account set', () => {
  const missing = valid();
  missing[0].accounts.pop();
  assert.equal(parseOwnerMoneyStatements(missing, asOf).complete, false);

  const inconsistent = valid();
  (inconsistent[1].accounts[0] as ReturnType<typeof row>).closing_balance = 121;
  const result = parseOwnerMoneyStatements(inconsistent, asOf);
  assert.equal(result.complete, false);
  assert.ok(result.warnings.includes('owner_account_arithmetic_or_type_mismatch'));

  const added = valid();
  added[1].accounts.push(row('Новая карта КБР', 'cash', 25));
  assert.equal(parseOwnerMoneyStatements(added, asOf).complete, false);
  assert.ok(parseOwnerMoneyStatements(added, asOf).warnings.includes('new_owner_account_needs_mapping'));
});

test('rejects stale or truncated statement and duplicate account ref', () => {
  const stale = valid();
  stale[0].date_to = '2026-09-11';
  assert.equal(parseOwnerMoneyStatements(stale, asOf).complete, false);

  const truncated = valid();
  truncated[1].truncated = true;
  assert.equal(parseOwnerMoneyStatements(truncated, asOf).complete, false);

  const duplicate = valid();
  (duplicate[1].accounts[0] as ReturnType<typeof row>).account.ref = 'account-0';
  assert.equal(parseOwnerMoneyStatements(duplicate, asOf).complete, false);
});
