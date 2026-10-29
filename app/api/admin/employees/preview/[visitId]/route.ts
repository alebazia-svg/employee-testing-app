import { employeePreviewResources } from '@/lib/employee-preview-request';
import { employeePayrollResponse } from '@/lib/employee-payroll-response';
import { requireAdminApi } from '@/lib/admin-api-auth';
import { employeePreviewHeaders as headers, readEmployeePreview } from '@/lib/employee-preview';
import { getEmployeeWorkdaySnapshot } from '@/lib/employee-workday-snapshot';
import { loadEmployeeNotifications } from '@/lib/employee-notification-snapshot';
import { loadEmployeeAttention } from '@/lib/employee-attention-snapshot';
import { requestedDates, scheduleSnapshot } from '@/lib/employee-schedule-snapshot';
import { currentCashIssue } from '@/lib/procurement-cash-issue-notifications';
import { cashIssueForUser } from '@/lib/procurement-cash-issue-policy';
import { getWorkdayShiftCorrectionState } from '@/lib/workday-shift-change';
import { getMoscowDateKey } from '@/lib/workday';
import { readNotificationDetail } from '@/lib/notification-detail-reader';
import { prisma } from '@/lib/prisma';
import { receiptSelect, readProcurementReceipt, ReceiptError, legacyReceiptWhere } from '@/lib/procurement-receipts';
import { deliveryUserAllowed } from '@/lib/procurement-delivery-policy';
import { deliveryMappedUser, loadDeliveryView } from '@/lib/procurement-delivery-reminders';
// Explicit read-only allowlist. No arbitrary route forwarding or effective-user auth.
export async function GET(req: Request, context: { params: Promise<{ visitId: string }> }) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  const preview = await readEmployeePreview(auth.user.id, (await context.params).visitId);
  if (!preview) return Response.json({ error: 'Просмотр завершён. Откройте сотрудника заново.' }, { status: 410, headers });
  const url = new URL(req.url), user = preview.employee;
  const resource = url.searchParams.get('resource');
  const allowed = employeePreviewResources(user);
  if (!resource || !allowed.includes(resource)) return Response.json({ error: 'Недоступно в режиме просмотра' }, { status: 400, headers });
  switch (resource) {
    case 'payroll': {
      const query = new URLSearchParams(url.searchParams);
      query.delete('resource');
      return employeePayrollResponse(user, query);
    }
    case 'notification-detail': return readNotificationDetail(user, 'employee', url.searchParams.get('notification') ?? '');
    case 'receipts': {
      const ids = url.searchParams.getAll('plan');
      if (!ids.length || ids.length > 100 || ids.some(id => !id || id.length > 100)) return Response.json({ error: 'Неверный список заявок.' }, { status: 400, headers });
      const receipts = await prisma.supplierPaymentReceipt.findMany({ where: { planId: { in: ids }, plan: { managerUserId: user.id }, ...(url.searchParams.get('documents')==='1'?{}:legacyReceiptWhere) }, select: receiptSelect, orderBy: { createdAt: 'asc' } });
      return Response.json({ receipts }, { headers });
    }
    case 'receipt-file': {
      try {
        const { receipt, bytes } = await readProcurementReceipt(prisma, user, url.searchParams.get('plan') ?? '', url.searchParams.get('receipt') ?? '');
        return new Response(bytes, { headers: { ...headers, 'Content-Type': receipt.mimeType, 'Content-Length': String(bytes.length),
          'Content-Disposition': `attachment; filename="receipt.${receipt.storageKey.split('.').at(-1)}"; filename*=UTF-8''${encodeURIComponent(receipt.originalName).replace(/'/g,'%27')}`,
          'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "sandbox; default-src 'none'" } });
      } catch (error) { return Response.json({ error: error instanceof ReceiptError ? error.message : 'Не удалось открыть чек.' }, { status: error instanceof ReceiptError ? error.status : 503, headers }); }
    }
    case 'delivery': {
      if (!deliveryUserAllowed(user)) return Response.json({ error: 'Недоступно для этого сотрудника.' }, { status: 403, headers });
      try {
        const mapped = await deliveryMappedUser();
        if (mapped.id !== user.id) return Response.json({ error: 'Недоступно для этого сотрудника.' }, { status: 403, headers });
        return Response.json(await loadDeliveryView(), { headers });
      } catch { return Response.json({ error: 'Данные временно недоступны.' }, { status: 503, headers }); }
    }
    case 'change-shift': return Response.json(await getWorkdayShiftCorrectionState({ userId: user.id, department: user.department, date: getMoscowDateKey() }), { headers });
    case 'today': return Response.json(await getEmployeeWorkdaySnapshot(user), { headers });
    case 'notifications': return Response.json(await loadEmployeeNotifications(user, true), { headers });
    case 'attention': return Response.json(await loadEmployeeAttention(user), { headers });
    case 'schedule': {
      const range = requestedDates(url.searchParams.get('month'), url.searchParams.get('week'));
      if (!range) return Response.json({ error: 'Некорректный период графика' }, { status: 400, headers });
      return Response.json(await scheduleSnapshot(user, range.dates, range.monthKey), { headers });
    }
    case 'cash-issue': {
      const current = await currentCashIssue();
      return Response.json({ request: cashIssueForUser(current, user.id)?.request ?? null, unavailable: current.state === 'unknown', waitingForShift: current.state === 'waiting_shift' && current.userId === user.id }, { headers });
    }
    default: return Response.json({ error: 'Недоступно в режиме просмотра' }, { status: 400, headers });
  }
}
