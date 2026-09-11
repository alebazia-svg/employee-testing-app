import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('current procurement workflow keeps its structure under the neutral identity', async () => {
  const [shell, notifications, refresh, calendar, batch, styles] = await Promise.all([
    readFile('components/ProcurementShell.tsx', 'utf8'),
    readFile('components/ProcurementNotificationsButton.tsx', 'utf8'),
    readFile('components/ProcurementDataRefresh.tsx', 'utf8'),
    readFile('app/(dashboard)/procurement/ProcurementPaymentCalendarClient.tsx', 'utf8'),
    readFile('app/(dashboard)/procurement/ProcurementPaymentBatchForm.tsx', 'utf8'),
    readFile('app/globals.css', 'utf8'),
  ]);

  assert.match(shell, /PortalIdentityBlock/);
  assert.match(shell, /ProcurementNotificationsButton/);
  assert.match(shell, /portal-neutral-design procurement-shell/);
  assert.match(notifications, /procurement-notification-trigger/);
  assert.match(refresh, /procurement-data-refresh/);
  assert.match(shell, /procurement-header-logout inline-flex/);
  assert.match(calendar, /Что стоит проверить/);
  assert.match(calendar, /Добавить ещё одну оплату/);
  assert.match(calendar, /ProcurementDataRefresh/);
  assert.match(batch, /procurement-order-selected/);
  assert.match(styles, /\.portal-neutral-design\.procurement-shell/);
  assert.match(styles, /linear-gradient\(150deg, #272e38 0%, #171c24 72%, #11151b 100%\)/);
  assert.doesNotMatch(shell, /BrandBlock/);
  assert.doesNotMatch(calendar, /text-\[#58a908\]/);
});
