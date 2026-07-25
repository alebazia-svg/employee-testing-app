# 1C Workday Automation Audit

Last reviewed: 2026-07-24.

This note captures the current read-only AIAgentAPI surface that can support
Workday automation. It is stale-prone: always verify live `/hs/agent/version`
before relying on it because AIAgentAPI can be updated from the separate
`ai-business-os` workspace by more than one person/Codex session.

## Historical Production Snapshot

The package below was observed during the original audit and is no longer
current release truth:

```text
AIAgentAPI-v0.15.68-money-balances-2026-07-02
```

Observed 1C base/configuration:

```text
Teleinvest_UT11
Управление торговлей, редакция 11 / 11.4.13.57
```

Do not treat local old extension folders such as `v0.15.29` as production
truth. For AIAgentAPI work, follow the release process in `ai-business-os` and
compare Yandex Disk `CURRENT_VERSION.md`, Yandex `DEVELOPMENT_LOCK.md`, and live
`/version`.

## Endpoints Relevant To Workday

Currently used by the portal:

- `/ping`, `/info`, `/version` - health/version diagnostics for `/admin/1c`.
- `/cash-statement-dimensions` - organizations and cashboxes. Live probe found
  2 organizations and 24 cashboxes.
- `/cash-statement-summary` - cash statement analogue for one date,
  organization and cashbox. Source: `РегистрНакопления.ДенежныеСредстваНаличные`.
  Returns opening balance, incoming, outgoing, closing balance and movements.
- `/kkm-equipment-diagnostics` - daily recent checks, KKM cash-register usage
  and acquiring-terminal usage. Workday uses it as partial evidence for KKM and
  Sberbank checks; it does not prove X/Z report generation or a historical
  terminal total at an intermediate minute.
- `/sales-realizations` - 1C sales realizations with manager, counterparty,
  warehouse, amount and lines. Used by OFD matching.
- `/sales-realization-links` - linked cash receipts, acquiring, bank receipts,
  returns and corrections for a realization. Used by OFD matching.

Available but not yet used for Workday:

- `/last-kkm-check` - last KKM receipt from `Документ.ЧекККМ + Товары`;
  includes cash register, cashier/responsible, customer, payment form,
  acquiring terminal, goods and payment rows. Useful signal, but not a full KKM
  shift or X/Z report endpoint.
- `/money-balances` - cash/bank balance overview from cash and bank money
  registers.
- `/sales-summary`, `/sales-breakdown` - sales totals/breakdowns.
- `/sales-customers`, `/sales-customer-products` - customer/product sales
  analytics.
- `/cash-flow-expenses`, `/management-profit` and income/expense probes -
  finance/reporting endpoints, not directly needed for Workday V1.

Do not rely only on `draft_features` from `/version`. Some listed draft routes
may be absent or experimental; verify each endpoint before use.

## Current Portal Usage

`/admin/workday` currently:

- loads `/cash-statement-dimensions`;
- chooses the Offonika organization if found;
- uses the saved explicit portal mapping from employee to 1C cashbox;
- calls `/cash-statement-summary` per employee/cashbox;
- captures the current 1C closing balance server-side when an employee submits
  a cash checklist step or handover, and stores the snapshot in the task audit
  JSON without returning the expected amount through employee APIs;
- does not reconstruct old point-in-time balances from movement timestamps when
  a historical task predates snapshot capture; those checks are marked
  unavailable instead of showing a false financial mismatch;
- loads the shared cashbox `Резерв под телефоны`;
- uses `/kkm-equipment-diagnostics` for daily KKM and Sberbank acquiring
  evidence;
- uses posted `/sales-realizations` for the controlled T-Bank partner and
  matches the 1C manager to the employee;
- shows automatic results separately from employee declarations.
- shows `Нельзя проверить автоматически` when the current source cannot prove
  the result reliably; it does not use `Частично` as a final control status;
- stores administrator manual decisions separately with decision, author,
  timestamp and required comment.

`/employee` currently keeps employee cash recount manual. This is intentional:
do not show expected 1C cash to employees before they enter the physical amount,
otherwise they may copy the 1C balance instead of counting.

## Workday Automation Implications

Can be automated or compared now:

- Admin-side expected cash balance by employee cashbox, after a mapping exists.
- Cash movements/PКО/RКО style evidence via cash statement movements.
- OFD/1C sales realization checks for retail and credit/installment documents.
- Some KKM receipt evidence through `/last-kkm-check`.

Should stay manual for now:

- Physical cash recount by employee.
- Exception comments and discrepancy explanations.
- Real-world handover, withdrawal and encashment confirmation.
- X/Z report proof until a KKM shift summary endpoint exists.
- Terminal report proof until acquiring summary is reliable enough.

## Missing For Workday P0

The largest gap is explicit identity/mapping:

```text
portal user -> 1C employee/manager -> 1C cashbox -> KKM cash register -> terminal(s)
```

Do not keep building automation on surname matching. It breaks for trainees,
renames, shared accounts, duplicate surnames and temporary cashier setup.

Recommended next read-only endpoints:

- `workday-dimensions` or `employee-cashbox-map`: list 1C employees/managers,
  cashboxes, KKM cash registers and terminals with refs and likely ownership.
- `cash-statement-summary-batch`: same cash statement data for many cashboxes in
  one request.
- `kkm-shift-summary`: date + KKM cash register + optional cutoff time,
  returning opening/closing, shift number, acquiring totals and X/Z
  availability.

Recommended portal data:

- Store explicit mapping in portal DB once humans confirm refs.
- Keep a confidence/source flag if any mapping was imported or suggested from
  names.
- Allow admin to update mapping without changing 1C data.

