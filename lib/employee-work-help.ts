import { getMoscowDateKey } from './workday';

export const WORK_HELP_VERSION = 'schedule-work-v1';
export const WORK_HELP_ACK_KIND = 'work_help_ack';
export const workHelpAckKey = (today: string) => `work-help:${WORK_HELP_VERSION}:${today}`;
export type WorkHelpSnapshot = { version: string; today: string; missingDates: string[]; qualifier: string; acknowledgedAt: string | null; due: boolean };

export function workHelpSnapshot(near: { missing: string[]; qualifier: string }, acknowledgedAt: Date | null, now = new Date()): WorkHelpSnapshot {
  const today = getMoscowDateKey(now);
  const acknowledgedToday = !!acknowledgedAt && getMoscowDateKey(acknowledgedAt) === today;
  return { version: WORK_HELP_VERSION, today, missingDates: near.missing, qualifier: near.qualifier, acknowledgedAt: acknowledgedAt?.toISOString() ?? null, due: near.missing.length > 0 && !acknowledgedToday };
}
export function validWorkHelpAcknowledgement(value: unknown) {
  return !!value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 1 && (value as { version?: unknown }).version === WORK_HELP_VERSION;
}
