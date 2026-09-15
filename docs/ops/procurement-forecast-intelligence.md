# Procurement Forecast Intelligence

Status: approved local implementation; not released.

## Current-Snapshot Rules

- Recalculate from read-only 1C data whenever the forecast page refreshes.
- Ordinary supplier attention starts at 300,000 RUB.
- 95-RU uses a separate scale: attention from 1,000,000 RUB and urgent from
  2,000,000 RUB.
- For other suppliers with at least two current orders, urgent attention adapts
  to the current order scale. The urgent boundary is the greater of 600,000 RUB
  or two current median order payment gaps. With only one current order and no
  history, 1,000,000 RUB is used as the conservative urgent boundary.
- Supplier settlement debt and remaining order payments are displayed
  separately. They may overlap and must never be added together as one debt.
- A draft settlement source is marked as requiring review.
- Missing or incomplete order data disables adaptive urgency instead of
  publishing a confident recommendation.

## Refresh And History Boundary

The current local screen refreshes every minute while open and also refreshes
when the browser regains focus, visibility or network access. This is not a
background monitor.

Seven-, thirty- and ninety-day trend detection requires persisted, versioned
snapshots and a production scheduler. The storage and scheduler definitions are
prepared locally, but until they are released and enough history accumulates the
portal must still label the result as a current-snapshot calculation.

## Compact Financial Snapshots

`ProcurementForecastSnapshot` stores only final indicators: verified owner
balances, active requests, the salary estimate, T-Bank limit state, and separate
supplier debt/order-payment-gap measures. It never copies source 1C documents
or bank operations.

The liquidity section also keeps the agreed VTB-card withdrawal constraint of
350,000 RUB per day separate from the unrestricted VTB settlement account. The
T-Bank section keeps package usage, the 1% tier, the following paid tier, and the
verified tariff renewal date as distinct fields.

The content hash excludes the check time. When amounts and statuses stay the
same, the runner updates only `sourceCheckedAt`; a new revision is created only
after a material state change. An incomplete source stays explicitly incomplete
and never becomes a zero amount. A missing owner-money source, supplier source,
or Astemir manager mapping blocks persistence completely.

The repository includes a local systemd service and a 15-minute timer. They are
not installed or enabled in production until the migration and release are
separately approved.
