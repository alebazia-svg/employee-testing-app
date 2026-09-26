export const ADMIN_INBOX_TECHNICAL_EVENT_TYPES = [
  'dependency.down',
  'dependency.recovered',
  'infrastructure.down',
  'infrastructure.recovered',
] as const;

const TECHNICAL_EVENT_TYPE_SET = new Set<string>(ADMIN_INBOX_TECHNICAL_EVENT_TYPES);
const TECHNICAL_RECOVERY_TYPE_SET = new Set<string>([
  'dependency.recovered',
  'infrastructure.recovered',
]);

export function adminInboxTechnicalSourceKey(input: { sourceType: string; sourceId: string }) {
  return `${input.sourceType}\u0000${input.sourceId}`;
}

export function isAdminInboxTechnicalEvent(type: string) {
  return TECHNICAL_EVENT_TYPE_SET.has(type);
}

export function effectiveAdminInboxReadAt(input: {
  storedReadAt: Date | null;
  occurredAt: Date;
  eventId: string;
  eventType: string;
  lifecycleManaged: boolean;
  sourceActive: boolean;
  latestTechnicalEventId?: string;
}) {
  if (input.storedReadAt) return input.storedReadAt;

  // An update of an existing procurement payment is useful in history, but it
  // does not require a new action from the administrator.
  if (input.eventType === 'procurement.payment_updated') return input.occurredAt;

  if (isAdminInboxTechnicalEvent(input.eventType)) {
    // Recovery closes the incident, and only the latest still-active outage is
    // allowed to contribute to the unread counter.
    if (TECHNICAL_RECOVERY_TYPE_SET.has(input.eventType)) return input.occurredAt;
    if (input.latestTechnicalEventId !== input.eventId) return input.occurredAt;
  }

  if (input.lifecycleManaged && !input.sourceActive) return input.occurredAt;
  return null;
}
