import Link from 'next/link';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { accessBrowserCookie, isCurrentAccessBrowser } from '@/lib/portal-access-identity';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { AdminShell } from '@/components/AdminShell';
import type { AccessJournalRow } from '@/components/PortalAccessJournal';
import { PortalAccessDevices } from '@/components/PortalAccessDevices';
import { accessPushLabel } from '@/lib/portal-access-device';
import { accessCurrentConnections, accessLastPushForUser, accessOwnerView } from '@/lib/portal-access-view';
import { parseAppObservation, parseUpdateCommand } from '@/lib/portal-app-observation';
import { serverAppRelease } from '@/lib/portal-app-update-server';
import { parseDeviceObservation, connectionMismatch } from '@/lib/portal-device-observation';

export const dynamic = 'force-dynamic';
export default async function AccessPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string; view?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== 'ADMIN') redirect('/employee');
  const currentBrowserId = (await cookies()).get(accessBrowserCookie)?.value;
  const params = await searchParams;
  const query = (params.q ?? '').trim().slice(0, 100);
  const page = /^\d+$/.test(params.page ?? '') ? Math.min(200, Math.max(1, Number(params.page))) : 1;
  const history = params.view === 'history';
  const now = new Date();
  let rows: AccessJournalRow[] = [], unavailable = false, hasMore = false;
  try {
    const records = await prisma.portalAccessSession.findMany({
      // Include old/expired visits: absence today must not hide an employee.
      // Consolidate before sending the main list to the client; history stays paginated.
      where: history ? (query ? { OR: [
        { user: { name: { contains: query, mode: 'insensitive' } } },
        { user: { login: { contains: query, mode: 'insensitive' } } },
        { device: { contains: query, mode: 'insensitive' } },
        { browser: { contains: query, mode: 'insensitive' } },
      ] } : {}) : { user: { isActive: true } },
      orderBy: history ? [{ firstSeenAt: 'desc' }, { id: 'desc' }] : [{ userId: 'asc' }, { firstSeenAt: 'asc' }, { id: 'asc' }],
      ...(history ? { skip: (page - 1) * 50, take: 51 } : {}),
      select: { id: true, userId: true, device: true, browser: true, browserInstanceId: true, observedBrowserId: true, identityBoundAt: true, observedOrigin: true, deviceObservation: true, deviceCheckedAt: true, lastInteractionAt: true, lastIp: true, ipCheckedAt: true, isService: true, serviceMarkedAt: true, displayMode: true, contextCheckedAt: true, appObservation: true, appCheckedAt: true, appUpdateCommand: true, firstSeenAt: true, loginAt: true, lastSeenAt: true, expiresAt: true, loggedOutAt: true, pushState: true, pushCheckedAt: true, pushSubscriptionId: true,
        user: { select: { name: true, login: true, role: true } }, pushSubscription: { select: { userId: true, disabledAt: true, lastPushUserId: true, lastPushAttemptAt: true, lastPushResultAt: true, lastPushOutcome: true, lastPushErrorCode: true } } },
    });
    hasMore = history && records.length > 50;
    const browserIds = [...new Set(records.flatMap(r => r.browserInstanceId ? [r.browserInstanceId] : []))];
    const owners = browserIds.length ? await prisma.portalAccessBrowserOwner.findMany({ where: { browserInstanceId: { in: browserIds }, disabledAt: null, owner: { isActive: true, role: 'ADMIN' } }, select: { browserInstanceId: true, ownerUserId: true, label: true, deviceGroupId: true } }) : [];
    const ownerByBrowser = new Map(owners.map(owner => [owner.browserInstanceId, owner]));
    const adminConnections = browserIds.length ? await prisma.portalAccessSession.findMany({ where: { browserInstanceId: { in: browserIds }, user: { role: 'ADMIN' } }, distinct: ['browserInstanceId'], select: { browserInstanceId: true } }) : [];
    const adminBrowsers = new Set(adminConnections.map(r => r.browserInstanceId));
    rows = (history ? records.slice(0, 50) : records).map(r => {
      const app = parseAppObservation(r.appObservation), command = parseUpdateCommand(r.appUpdateCommand);
      const owner = r.browserInstanceId ? ownerByBrowser.get(r.browserInstanceId) : undefined;
      const ownership = accessOwnerView(owner?.ownerUserId, r.userId, user.id);
      const mismatched = connectionMismatch(r.browserInstanceId, r.observedBrowserId);
      return { id: r.id, ...r.user, device: r.device, browser: r.browser,
      browserInstanceId: r.browserInstanceId, isService: !ownership.ownerBrowser && (r.isService || ownership.ownerInspection), serviceMarkedAt: r.serviceMarkedAt?.toISOString() ?? null,
      ...ownership,
      canMarkOwner: ownership.canMarkOwner && !mismatched,
      observedBrowserId: r.observedBrowserId, identityBoundAt: r.identityBoundAt?.toISOString() ?? null,
      observedOrigin: r.observedOrigin, deviceObservation: parseDeviceObservation(r.deviceObservation), deviceCheckedAt: r.deviceCheckedAt?.toISOString() ?? null,
      lastInteractionAt: r.lastInteractionAt?.toISOString() ?? null,
      connectionLabel: owner?.label ?? null, deviceGroupId: owner?.deviceGroupId ?? null, adminObserved: Boolean(r.browserInstanceId && adminBrowsers.has(r.browserInstanceId)),
      isCurrentBrowser: !mismatched && isCurrentAccessBrowser(r.browserInstanceId, currentBrowserId),
      lastIp: r.lastIp, ipCheckedAt: r.ipCheckedAt?.toISOString() ?? null,
      appUpdate: app && r.appCheckedAt ? { version: app.version, builtAt: app.builtAt, state: app.state, checkedAt: r.appCheckedAt.toISOString(), command: command ? { requestedAt: command.requestedAt, receivedAt: command.receivedAt, completedAt: command.completedAt, target: command.target } : null } : null,
      displayMode: r.displayMode, contextCheckedAt: r.contextCheckedAt?.toISOString() ?? null,
      lastPush: accessLastPushForUser(r.pushSubscription, r.userId),
      firstSeenAt: r.firstSeenAt.toISOString(), loginAt: r.loginAt?.toISOString() ?? null, lastSeenAt: r.lastSeenAt.toISOString(),
      loggedOutAt: r.loggedOutAt?.toISOString() ?? null, expiresAt: r.expiresAt.toISOString(), pushCheckedAt: r.pushCheckedAt?.toISOString() ?? null,
      pushLabel: accessPushLabel(r.pushState, r.pushSubscription, r.userId), pushSubscriptionId: r.pushSubscriptionId }; });
    if (!history) rows = accessCurrentConnections(rows);
  } catch { unavailable = true; }
  return <AdminShell pageTitle="Устройства и входы" pageDescription="Кто пользуется порталом и где подключены уведомления." headerWidthClass="max-w-6xl"><div className='mx-auto max-w-6xl mb-4 text-sm'><Link href='/admin/employees' className='text-slate-600 hover:underline'>← Сотрудники</Link></div>

    <PortalAccessDevices rows={rows} query={query} history={history} service={params.view === 'service'} page={page} hasMore={hasMore} unavailable={unavailable} nowIso={now.toISOString()} currentRelease={serverAppRelease()} />
  </AdminShell>;
}
