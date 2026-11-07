import { parseAppObservation } from './portal-app-observation';
import { employeeUiLive, type EmployeeUiObservation } from './employee-ui-observation';
import { connectionMismatch, parseDeviceObservation } from './portal-device-observation';
import { accessPushLabel } from './portal-access-device';
import type { SetupProposalState } from '../components/workday/EmployeeAppSetupContext';

export type InspectionConnectionRecord = {
  id: string; userId: number; device: string; browser: string; browserInstanceId: string | null;
  observedBrowserId: string | null; isService: boolean; serviceMarkedAt: Date | null;
  listArchivedAt: Date | null; lastSeenAt: Date; expiresAt: Date; loggedOutAt: Date | null;
  displayMode: string | null; contextCheckedAt: Date | null; deviceObservation: unknown;
  pushState: string; pushCheckedAt: Date | null;
  appObservation?: unknown; appCheckedAt?: Date | null;
  pushSubscription: { userId: number; disabledAt: Date | null } | null;
};
export type InspectionConnection = {
  id: string; label: string; lastSeenAt: string; checkedAt: string | null;
  pushLabel: string; fresh: boolean; displayMode: string | null; state: SetupProposalState; isPhone: boolean; isIos: boolean; runtime?: EmployeeUiObservation; runtimeAt?: string; live?: boolean;
};
export type InspectionDeviceSnapshot = { connections: InspectionConnection[]; selectedId: string | null; unavailable?: boolean };
const freshAt = (at: Date | null, now: Date) => !!at && at.getTime() <= now.getTime() + 300000 && now.getTime() - at.getTime() <= 86400000;

/** Only the selected employee's exactly identified connection supplies device facts.
 * No ADMIN permission, IP/device-name inference, endpoint, key or auth data is exposed. */
export function inspectionDeviceSnapshot(records: InspectionConnectionRecord[], userId: number, selectedId: string | null, adminBrowsers: Set<string>, ownedBrowsers: Set<string>, now = new Date()): InspectionDeviceSnapshot {
  const latest = new Map<string, InspectionConnectionRecord>();
  for (const row of [...records].sort((a,b) => b.lastSeenAt.getTime()-a.lastSeenAt.getTime() || a.id.localeCompare(b.id))) {
    if (row.userId !== userId || row.isService || row.browserInstanceId && (ownedBrowsers.has(row.browserInstanceId) || adminBrowsers.has(row.browserInstanceId) && !row.serviceMarkedAt)) continue;
    const key = row.browserInstanceId ?? `session:${row.id}`;
    if (!latest.has(key)) latest.set(key,row);
  }
  const connections = [...latest.values()].map(row => {
    const device = parseDeviceObservation(row.deviceObservation);
    const isIos = ['iPhone','iPad'].includes(row.device) || device?.platform === 'iOS / iPadOS';
    const isPhone = isIos || row.device.includes('Android');
    const identified = !connectionMismatch(row.browserInstanceId,row.observedBrowserId);
    const active = !row.loggedOutAt && row.expiresAt > now && (!row.listArchivedAt || row.lastSeenAt > row.listArchivedAt);
    const fresh = active && identified && freshAt(row.pushCheckedAt,now) && row.pushState !== 'unknown';
    const contextFresh = active && identified && freshAt(row.contextCheckedAt,now);
    const pushLabel = fresh ? accessPushLabel(row.pushState,row.pushSubscription,userId) : 'Нет свежих данных';
    let state: SetupProposalState = 'checking';
    if (contextFresh && isIos && row.displayMode === 'browser') state = 'safari';
    else if (fresh) state = pushLabel === 'Подключены' ? 'ready' : row.pushState === 'blocked' ? 'denied' : row.pushState === 'unsupported' ? 'unsupported' : 'notifications';
    const app=parseAppObservation(row.appObservation), runtime=identified ? app?.ui : undefined;
    const live=Boolean(active && runtime && employeeUiLive(runtime,row.appCheckedAt,now));
    if(runtime)state=runtime.setup; // Actual last reported banner, never guessed from ADMIN browser facts.
    return { ...(runtime ? {runtime,live,runtimeAt:row.appCheckedAt?.toISOString()}:{}), id:row.id, label:`${row.device} · ${row.displayMode === 'app' ? 'Приложение' : row.browser}`, lastSeenAt:row.lastSeenAt.toISOString(), checkedAt:row.pushCheckedAt?.toISOString() ?? null, pushLabel, fresh, displayMode:row.displayMode, state, isPhone, isIos };
  });
  // A recent employee phone app is the most useful initial view. Never aggregate
  // a connected desktop subscription into a disconnected phone's state.
  const preferred = connections.find(c => c.fresh && c.isPhone && c.displayMode === 'app')
    ?? connections.find(c=>c.fresh && c.isPhone) ?? connections.find(c=>c.fresh) ?? connections[0];
  const priorBrowser = records.find(r=>r.id===selectedId && r.userId===userId)?.browserInstanceId;
  const selected = connections.find(c=>c.id===selectedId) ?? (priorBrowser ? connections.find(c=>c.id===latest.get(priorBrowser)?.id) : undefined);
  return { connections, selectedId:selectedId === null ? preferred?.id ?? null : selected?.id ?? null };
}
