/** A closed catalogue: never retain URL IDs, search text, query values or fragments. */
export const adminPages = {
  home: ['Главная', '/admin'], workday: ['Контроль дня', '/admin/workday'],
  procurement: ['Закупки · Календарь', '/admin/procurement'], attendance: ['График', '/admin/attendance'],
  employees: ['Сотрудники', '/admin/employees'], access: ['Устройства и входы', '/admin/employees/access'],
  access_service: ['Устройства · Администраторы и проверки', '/admin/employees/access?view=service'],
  access_history: ['Устройства · История входов', '/admin/employees/access?view=history'],
  payroll: ['Зарплата', '/admin/payroll'], taxes: ['Налоги · Обзор', '/admin/taxes'],
  taxes_income: ['Налоги · Доходы', '/admin/taxes?tab=income'], taxes_reconciliation: ['Налоги · Сверка с налоговой', '/admin/taxes?tab=reconciliation'], taxes_documents: ['Налоги · Документы', '/admin/taxes?tab=documents'],
  company: ['Реквизиты', '/admin/company-details'], ofd: ['Чеки: 1С и OFD', '/admin/ofd'],
  tbank: ['Эквайринг T-Банк', '/admin/workday/tbank'], inbox: ['История уведомлений', '/admin/inbox'],
  expenses: ['Заявки', '/admin/expense-requests'], expense_detail: ['Карточка заявки', '/admin/expense-requests/[id]'],
  issue: ['Контроль дня · Вопрос сотрудника', '/admin/workday/issues/[id]'], payment_check: ['Контроль дня · Проверка оплаты', '/admin/workday/payment-checks/[id]'], close_exception: ['Контроль дня · Исключение закрытия', '/admin/workday/close-exceptions/[id]'],
  day_review: ['Зарплата · Проверка дня', '/admin/payroll/day-reviews/[id]'],
  attestations: ['Аттестации', '/admin/attestations'], attestation: ['Карточка аттестации', '/admin/attestations/[id]'], results: ['Результаты аттестаций', '/admin/results'], result: ['Результат аттестации', '/admin/results/[id]'], analytics: ['Аналитика', '/admin/analytics'], one_c: ['1С', '/admin/1c'],
} as const;
export type AdminPage = keyof typeof adminPages;
export type AdminVisitInput = { key: string; page: AdminPage; previous?: AdminPage };
export function isAdminPage(v: unknown): v is AdminPage { return typeof v === 'string' && Object.hasOwn(adminPages, v); }
export function parseAdminVisit(v: unknown): AdminVisitInput | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const p = v as Record<string, unknown>;
  return Object.keys(p).every(k => ['key','page','previous'].includes(k)) && typeof p.key === 'string' && /^[a-zA-Z0-9_-]{8,80}$/.test(p.key) && isAdminPage(p.page) && (p.previous === undefined || isAdminPage(p.previous)) ? p as AdminVisitInput : null;
}
export function adminPageRoute(path: string, query: Pick<URLSearchParams, 'get'>): AdminPage | null {
  if (path === '/admin/employees/access') return query.get('view') === 'service' ? 'access_service' : query.get('view') === 'history' ? 'access_history' : 'access';
  if (path === '/admin/taxes') { const tab = query.get('tab'); return tab === 'income' ? 'taxes_income' : tab === 'reconciliation' ? 'taxes_reconciliation' : tab === 'documents' ? 'taxes_documents' : 'taxes'; }
  for (const [key, [, route]] of Object.entries(adminPages)) {
    if (route.includes('?')) continue;
    if (route === path || route.endsWith('/[id]') && path.startsWith(route.slice(0,-4)) && /^[a-zA-Z0-9_-]+$/.test(path.slice(route.length-4))) return key as AdminPage;
  }
  return null;
}
export const adminMoscowDay = (now = new Date()) => new Date(+now + 10800000).toISOString().slice(0,10);
export type AdminJournalBrowser = { id: string; name: string; service: boolean; group: string; browser: string; connection: number };
export type AdminJournalVisit = { id: string; browserId: string; createdAt: string; page: AdminPage; previous?: AdminPage; account: string };
export type AdminJournalData = { startedAt: string | null; browsers: AdminJournalBrowser[]; visits: AdminJournalVisit[]; summary: { count: number; sections: number; latest: string | null }; matched: number; nextCursor: string | null };
