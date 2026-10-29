/** Only these read resources can be requested on behalf of an employee. */
export function employeePreviewUrl(visitId: string, input: string, init?: RequestInit) {
  if ((init?.method ?? 'GET').toUpperCase() !== 'GET') throw new Error('В режиме проверки изменения недоступны.');
  const url = new URL(input, 'https://preview.invalid');
  if (url.origin !== 'https://preview.invalid') throw new Error('Недоступный адрес');
  const resources: Record<string, string> = {
    '/api/employee/payroll': 'payroll',
    '/api/employee/workday/today': 'today',
    '/api/employee/workday/change-shift': 'change-shift',
    '/api/employee/workday/schedule': 'schedule',
    '/api/employee/workday-notifications': 'notifications',
    '/api/employee/workday-attention': 'attention',
    '/api/employee/cash-issue': 'cash-issue',
    '/api/procurement/receipts': 'receipts',
    '/api/procurement/delivery': 'delivery',
  };
  const receiptFile = url.pathname.match(/^\/api\/procurement\/payment-plans\/([^/]+)\/receipts\/([^/]+)$/);
  const notification = url.pathname.match(/^\/api\/notification-details\/employee\/(\d+)$/);
  const resource = notification ? 'notification-detail' : receiptFile ? 'receipt-file' : resources[url.pathname];
  if (!resource) throw new Error('Действие недоступно в режиме проверки.');
  const params = new URLSearchParams({ resource });
  if (notification) params.set('notification', notification[1]);
  if (receiptFile) { params.set('plan', decodeURIComponent(receiptFile[1])); params.set('receipt', decodeURIComponent(receiptFile[2])); }
  if (resource === 'receipts') for (const id of url.searchParams.getAll('plan')) params.append('plan', id);
  if (resource === 'receipts' && url.searchParams.get('documents') === '1') params.set('documents','1');
  if (resource === 'payroll') for (const month of url.searchParams.getAll('month')) params.append('month', month);
  if (resource === 'payroll') for (const mode of url.searchParams.getAll('snapshot')) params.append('snapshot', mode);
  if (resource === 'schedule' && url.searchParams.has('month')) params.set('month', url.searchParams.get('month')!);
  if (resource === 'schedule' && url.searchParams.has('week')) params.set('week', url.searchParams.get('week')!);
  return `/api/admin/employees/preview/${encodeURIComponent(visitId)}?${params}`;
}

/** Match existing employee read permissions without admitting payroll for Procurement. */
export function employeePreviewResources(user: { portalArea: string; department: string }) {
  const workday = ['today', 'attention', 'schedule', 'cash-issue', 'change-shift'];
  return user.portalArea === 'PROCUREMENT'
    ? ['notifications', 'notification-detail', 'receipts', 'receipt-file', 'delivery', ...(user.department === 'procurement' ? workday : [])]
    : ['notifications', ...workday, 'payroll'];
}
