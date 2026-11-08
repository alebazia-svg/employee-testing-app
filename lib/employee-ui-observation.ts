import { parseEmployeeScreen,type EmployeeScreenState } from './employee-screen-state';
import type { EmployeeSetupState } from './employee-app-setup-state';

const setupStates: readonly string[] = ['checking','safari','ready','offline','unsupported','denied','notifications','reconnect'];
/** Bounded service UI only; never field values, phone pixels or arbitrary error payloads. */
export type EmployeeUiObservation = { setup: EmployeeSetupState; busy: boolean; error: string | null; online: boolean; sampledAt: string; screen?:EmployeeScreenState;foreground?:boolean };
const safeErrors = [
 'Уведомления недоступны на этом устройстве.', 'Разрешите уведомления в настройках устройства.',
 'Уведомления пока не включены.', 'Не удалось подключить уведомления. Повторите попытку.',
 'Не удалось подключить уведомления. Попробуйте ещё раз.',
];
export function employeeSetupError(error: string | undefined) {
 return !error ? null : safeErrors.includes(error) ? error : 'Не удалось подключить уведомления. Повторите попытку.';
}
export function parseEmployeeUiObservation(value: unknown): EmployeeUiObservation | null {
 if (!value || typeof value!=='object' || Array.isArray(value)) return null;
 const v=value as Record<string,unknown>;
 if(Object.keys(v).some(k=>!['busy','error','online','sampledAt','setup','screen','foreground'].includes(k)) || v.screen!==undefined&&!parseEmployeeScreen(v.screen) || v.foreground!==undefined&&typeof v.foreground!=='boolean' || !setupStates.includes(String(v.setup)) || typeof v.busy!=='boolean' || typeof v.online!=='boolean' || v.error!==null && (typeof v.error!=='string'||!safeErrors.includes(v.error)) || typeof v.sampledAt!=='string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v.sampledAt) || !Number.isFinite(Date.parse(v.sampledAt))) return null;
 return v as EmployeeUiObservation;
}
export function employeeUiLive(_ui:EmployeeUiObservation,receivedAt:Date|null|undefined,now:Date) {
 // Server receipt time is authoritative; an incorrect phone clock is not a connection fault.
 const received=receivedAt?.getTime() ?? NaN;
 return _ui.foreground!==false && Number.isFinite(received) && received<=now.getTime()+5000 && now.getTime()-received<=30000;
}
