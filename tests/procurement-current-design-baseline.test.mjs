import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('current procurement workflow keeps its structure under the neutral identity', async () => {
  const [shell, notifications, refresh, calendar, batch, adminCalendar, styles, revisionServer, verification] = await Promise.all([
    readFile('components/ProcurementShell.tsx', 'utf8'),
    readFile('components/ProcurementNotificationsButton.tsx', 'utf8'),
    readFile('components/ProcurementDataRefresh.tsx', 'utf8'),
    readFile('app/(dashboard)/procurement/ProcurementPaymentCalendarClient.tsx', 'utf8'),
    readFile('app/(dashboard)/procurement/ProcurementPaymentBatchForm.tsx', 'utf8'),
    readFile('app/(dashboard)/admin/procurement/AdminProcurementClient.tsx', 'utf8'),
    readFile('app/globals.css', 'utf8'),
    readFile('lib/procurement-plan-revision-server.ts', 'utf8'),
    readFile('lib/procurement-planning-verification.ts', 'utf8'),
  ]);

  assert.match(shell, /PortalIdentityBlock/);
  assert.match(shell, /ProcurementNotificationsButton/);
  assert.match(shell, /portal-neutral-design procurement-shell/);
  assert.match(notifications, /procurement-notification-trigger/);
  assert.match(refresh, /procurement-data-refresh/);
  assert.match(shell, /procurement-header-logout inline-flex/);
  assert.match(calendar, /Запланировать оплату/);
  assert.match(calendar, /Добавить оплаты/);
  assert.match(calendar, /Долг поставщикам по 1С/);
  assert.doesNotMatch(calendar + batch, /поступлен|поступившим/i);
  assert.match(calendar, /supplierPositionSummary\(supplierBalances\)/);
  assert.match(calendar, /Пока недоступно/);
  assert.doesNotMatch(calendar + batch, /Сумму доплаты|Доплату уточните|Остаток к оплате по приобретениям|Заказы без долга по приобретениям|setShowPaid/i);
  assert.match(batch, /const historyVisible = Boolean\(query\.trim\(\)\) && matchingHistory.length > 0/);
  assert.doesNotMatch(calendar, /label="По приобретениям в 1С"|receiptSummary\.debtRub/);
  assert.match(calendar, /поставщиков: долг не подтверждён/);
  assert.doesNotMatch(calendar, /независимо от возраста заказов/);
  assert.doesNotMatch(calendar, /Заказы за последние 90 дней/);
  assert.doesNotMatch(calendar + batch + revisionServer + verification, /руководител/i);
  assert.doesNotMatch(calendar, /label="Перед новой оплатой"|проверить авансы|Проверить зачёт авансов/);
  assert.doesNotMatch(calendar + batch, /Сумму новой оплаты выбираете вы|не сумма новой оплаты|ProcurementPaymentGuidance/);
  assert.match(batch, /Сколько перечислить сейчас/);
  assert.doesNotMatch(batch, /Почему\?|проверьте зачёт|Перед оплатой проверить зачёт/);
  assert.doesNotMatch(calendar, /label="Подтверждённый долг по заказам"|72 для планирования/);
  assert.match(calendar, /reservesUnavailable \? '—' : rub\.format\(plannedQr\)/);
  assert.doesNotMatch(calendar, /ProcurementReceiptEvidence/);
  assert.match(batch, /ProcurementReceiptEvidence/);
  assert.match(calendar, /ProcurementDataRefresh/);
  assert.match(batch, /procurement-order-selected/);
  assert.match(adminCalendar, /Требуется ваше решение/);
  assert.match(adminCalendar, /Сколько денег свободно/);
  assert.match(adminCalendar, /Ближайшие 7 дней/);
  assert.match(adminCalendar, /Если согласовать/);
  assert.match(adminCalendar, /id=\{`payment-plan-\$\{plan\.id\}`\}/);
  assert.match(styles, /\.portal-neutral-design\.procurement-shell/);
  assert.match(styles, /linear-gradient\(150deg, #272e38 0%, #171c24 72%, #11151b 100%\)/);
  assert.doesNotMatch(shell, /BrandBlock/);
  assert.doesNotMatch(calendar, /text-\[#58a908\]/);
});
