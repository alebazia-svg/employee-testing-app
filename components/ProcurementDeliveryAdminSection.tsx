import { getCurrentAdmin } from '@/lib/auth';
import { deliveryMappedUser, loadDeliveryView } from '@/lib/procurement-delivery-reminders';
import { ProcurementDeliveryFunding } from './ProcurementDeliveryFunding';

export async function ProcurementDeliveryAdminSection() {
  if (!await getCurrentAdmin()) return null;
  try { await deliveryMappedUser(); } catch {
    return <p id="delivery" className="mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Подотчёт Астемира недоступен: проверьте привязку сотрудника к 1С.</p>;
  }
  return <ProcurementDeliveryFunding view={await loadDeliveryView()} />;
}
