'use client';
import type { AppObservation, AppState } from './portal-app-observation';
import { readAppRelease } from './employee-app-update';

export const appStateEvent = 'portal-app-state';
export const appCommandEvent = 'portal-app-update-command';
let state: AppState = 'safe_screen';
let clientId: string | null = null;
let commandId: string | undefined;
export function reportAppState(next: AppState) {
  if (state === next) return;
  state = next;
  window.dispatchEvent(new Event(appStateEvent));
}
export function appClientObservation(): AppObservation | undefined {
  const release = readAppRelease({ version: process.env.NEXT_PUBLIC_APP_VERSION, builtAt: process.env.NEXT_PUBLIC_APP_BUILT_AT });
  if (!release) return;
  try {
    if (!clientId) {
      const saved = sessionStorage.getItem('portal-app-client');
      clientId = saved && /^[0-9a-f-]{36}$/i.test(saved) ? saved : crypto.randomUUID();
      sessionStorage.setItem('portal-app-client', clientId);
      commandId = sessionStorage.getItem('portal-app-command') || undefined;
    }
    return { ...release, clientId, state, ...(commandId ? { commandId } : {}) };
  } catch { return; }
}
export function acceptAppCommand(value: unknown) {
  if (!value || typeof value !== 'object') return;
  const id = (value as { id?: unknown }).id;
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) return;
  if (commandId === id) return;
  try { sessionStorage.setItem('portal-app-command', id); } catch { return; }
  commandId = id;
  window.dispatchEvent(new Event(appCommandEvent));
  window.dispatchEvent(new Event(appStateEvent));
}
export const currentAppCommandId = () => commandId;
