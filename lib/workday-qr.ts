export const WORKDAY_QR_PREFIX = 'offonika-workday-start:';
// Matches the procurement QR already published in ADMIN and on the approved A5 poster.
export const PROCUREMENT_WORKDAY_QR_PAYLOAD = `${WORKDAY_QR_PREFIX}procurement`;
export const WORKDAY_START_INTENT_TTL_MS = 15 * 60 * 1000;

export type WorkdayQrDepartment = 'retail' | 'wholesale' | 'procurement';

export function parseWorkdayQrDepartment(value: string): WorkdayQrDepartment | null {
  const match = value.trim().match(/^offonika-workday-start:(retail|wholesale|procurement)$/i);
  return match ? (match[1].toLowerCase() as WorkdayQrDepartment) : null;
}

export function workdayStartIntentExpiresAt(qrAcceptedAt: Date) {
  return new Date(qrAcceptedAt.getTime() + WORKDAY_START_INTENT_TTL_MS);
}
