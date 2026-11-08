import assert from 'node:assert/strict';
import test from 'node:test';
import { OWNER_MONEY_ACCOUNTS, VTB_OWNER_ACCOUNT, parseOwnerMoneyStatements } from '../lib/procurement-cash-forecast-source';

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

test('maps exactly seven verified owner bank/card/safe positions and no other 1C cashboxes', () => {
  const statements = valid();
  statements[1].accounts.push(row('Касса Подотчетника', 'cash', 20));
  statements[1].accounts.push(row('Сейф Расходный ', 'cash', 21));
  const result = parseOwnerMoneyStatements(statements, asOf);
  assert.equal(result.complete, true);
  assert.equal(result.positions.length, 7);
  assert.equal(result.positions.reduce((sum, position) => sum + position.balanceMinor, 0), 84_000);
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
  const unknownSafe = valid();
  unknownSafe[1].accounts.push(row('Новый сейф', 'cash', 26));
  assert.equal(parseOwnerMoneyStatements(unknownSafe, asOf).complete, false);
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

test('zero VTB requires its exact complete scoped empty statement, never just absence', () => {
  const statements = valid();
  statements[0].accounts = statements[0].accounts.filter((r: any) => r.account.name !== 'ВТБ КБР');
  const empty = { ...payload('bank', []), account_ref: VTB_OWNER_ACCOUNT.ref, movements: [], movements_returned: 0 };
  const proof = { ...VTB_OWNER_ACCOUNT, payload: empty };
  assert.equal(parseOwnerMoneyStatements(statements, asOf).complete, false);
  const verified = parseOwnerMoneyStatements(statements, asOf, [proof]);
  assert.equal(verified.complete, true);
  assert.equal(verified.positions.find(p => p.bucketId === `onec:${VTB_OWNER_ACCOUNT.ref}`)?.balanceMinor, 0);
  for (const patch of [{ complete: false }, { truncated: true }, { date_to: '2026-09-11' }, { account_ref: 'wrong' }, { movements: [{}] }, { movements_returned: 1 }, { accounts: [{}] }]) {
    assert.equal(parseOwnerMoneyStatements(statements, asOf, [{ ...proof, payload: { ...empty, ...patch } }]).complete, false);
  }
  assert.equal(parseOwnerMoneyStatements(statements, asOf, [{ ...proof, ref: '00000000-0000-0000-0000-000000000001', payload: { ...empty, account_ref: '00000000-0000-0000-0000-000000000001' } }]).complete, false);
});
