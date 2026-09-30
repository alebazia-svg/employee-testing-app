import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { AdminShell } from '@/components/AdminShell';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import type { AccessJournalRow } from '@/components/PortalAccessJournal';
import { PortalAccessDevices } from '@/components/PortalAccessDevices';
import { accessPushLabel } from '@/lib/portal-access-device';

export const dynamic = 'force-dynamic';
export default async function AccessPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string; view?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== 'ADMIN') redirect('/employee');
  const params = await searchParams;
  const query = (params.q ?? '').trim().slice(0, 100);
  const page = /^\d+$/.test(params.page ?? '') ? Math.min(200, Math.max(1, Number(params.page))) : 1;
  const history = params.view === 'history';
  const now = new Date();
  let rows: AccessJournalRow[] = [], unavailable = false, hasMore = false;
  try {
    const records = await prisma.portalAccessSession.findMany({
      // Current sessions are read in full so neither a person's devices nor the
      // attention filter are silently limited to one page of the old journal.
      where: history ? (query ? { OR: [
        { user: { name: { contains: query, mode: 'insensitive' } } },
        { user: { login: { contains: query, mode: 'insensitive' } } },
        { device: { contains: query, mode: 'insensitive' } },
        { browser: { contains: query, mode: 'insensitive' } },
      ] } : {}) : { loggedOutAt: null, expiresAt: { gt: now }, user: { isActive: true } },
      orderBy: history ? [{ firstSeenAt: 'desc' }, { id: 'desc' }] : [{ userId: 'asc' }, { firstSeenAt: 'asc' }, { id: 'asc' }],
      ...(history ? { skip: (page - 1) * 50, take: 51 } : {}),
      select: { id: true, userId: true, device: true, browser: true, firstSeenAt: true, loginAt: true, lastSeenAt: true, expiresAt: true, loggedOutAt: true, pushState: true, pushCheckedAt: true,
        user: { select: { name: true, login: true, role: true } }, pushSubscription: { select: { userId: true, disabledAt: true } } },
    });
    hasMore = history && records.length > 50;
    rows = (history ? records.slice(0, 50) : records).map(r => ({ id: r.id, ...r.user, device: r.device, browser: r.browser,
      firstSeenAt: r.firstSeenAt.toISOString(), loginAt: r.loginAt?.toISOString() ?? null, lastSeenAt: r.lastSeenAt.toISOString(),
      loggedOutAt: r.loggedOutAt?.toISOString() ?? null, expiresAt: r.expiresAt.toISOString(), pushCheckedAt: r.pushCheckedAt?.toISOString() ?? null,
      pushLabel: accessPushLabel(r.pushState, r.pushSubscription, r.userId) }));
  } catch { unavailable = true; }
  return <AdminShell><div className='mb-4 text-sm'><Link href='/admin/employees' className='text-slate-600 hover:underline'>← Сотрудники</Link></div>
    <AdminPageHeader title='Устройства и входы' description='Браузеры сотрудников, последние подключения и уведомления.' />
    <PortalAccessDevices rows={rows} query={query} history={history} page={page} hasMore={hasMore} unavailable={unavailable} nowIso={now.toISOString()} />
  </AdminShell>;
}
