import { portalPersonName, type PortalPerson } from './portal-person';
/** Bind each saved notification to its own message, never to the latest reply. */
export function employeeReplyMessageId(row: { kind: string; fingerprint: string; issueId: number | null; reviewId: string | null }) {
  if (row.kind === 'workday_issue_reply' && row.issueId) {
    const match = /^workday-issue:(\d+):admin-message:([^:]+)$/.exec(row.fingerprint);
    return match && Number(match[1]) === row.issueId ? match[2] : null;
  }
  if (row.kind === 'terminal_fiscal_review_reply' && row.reviewId) {
    const match = /^terminal-fiscal-review:([^:]+):admin-message:([^:]+)(?::\d+)?$/.exec(row.fingerprint);
    return match && match[1] === row.reviewId ? match[2] : null;
  }
  return null;
}
export function employeeReplyCopy(kind: string, message?: { body: string; author: PortalPerson } | null) {
  return { title: kind === 'terminal_fiscal_review_reply' ? 'Ответ по чеку' : 'Ответ по проверке',
    ...(message ? { body: `${portalPersonName(message.author)}: ${message.body}`.slice(0, 180) } : {}) };
}
