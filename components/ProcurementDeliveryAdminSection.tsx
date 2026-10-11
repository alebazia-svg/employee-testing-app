import React from 'react';
import { getCurrentAdmin } from '@/lib/auth';
import { deliveryMappedUser, loadDeliveryView, loadDeliveryHistory } from '@/lib/procurement-delivery-reminders';
import { ExpenseRequestsList, type ExpenseListRow } from './ExpenseRequestsList';

export async function ProcurementDeliveryAdminSection({ history = false, cursor, rows, query, empty, hasMoreNative = false, stageFilter = 'all' }: {
  stageFilter?: string; hasMoreNative?: boolean; history?: boolean; cursor?: string; rows: ExpenseListRow[]; query: string; empty: React.ReactNode;
}) {
  if (!await getCurrentAdmin()) return null;
  const shared = { rows, query, empty, hasMoreNative, queue: !history, stageFilter };
  try {
    await deliveryMappedUser();
    return history ? <ExpenseRequestsList {...shared} history={await loadDeliveryHistory(cursor)} />
      : <ExpenseRequestsList {...shared} delivery={await loadDeliveryView()} />;
  } catch {
    return <ExpenseRequestsList {...shared} warning={<p id="delivery" role="status" className="bg-amber-50 px-5 py-3 text-sm text-amber-900">Не удалось обновить заявки на подотчёт. Повторите обновление страницы; если ошибка останется, проверьте привязку сотрудника к 1С.</p>} />;
  }
}
