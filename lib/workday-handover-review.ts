import { completedWithoutEncashment, handoverClosedByAdmin } from './workday-close-view';

// Owner-confirmed real employee pilot began on 2026-10-18. Earlier runs are archive/test history.
export const HANDOVER_REVIEW_FROM_DATE = '2026-10-18';
export const HANDOVER_REVIEW_SOURCE = 'workday_handover_review';
export const HANDOVER_REVIEW_EVENT = 'workday.handover_review_required';
export const HANDOVER_REVIEW_DECISION = 'acknowledged';
export function handoverReviewCheckId(taskId: number) { return `unsubmitted-handover-${taskId}`; }
export type HandoverReviewTask = {
  id: number; category: string; required: boolean; status: string; handoverData?: unknown;
};
export function needsHandoverReview(task: HandoverReviewTask, day: {date: string; endedAt: Date | string | null; department: string}) {
  return day.date >= HANDOVER_REVIEW_FROM_DATE && Boolean(day.endedAt) && ['retail','wholesale'].includes(day.department)
    && task.category === 'handover' && task.required && task.status !== 'done'
    && !handoverClosedByAdmin(task) && !completedWithoutEncashment(task);
}
export function handoverReviewRecord<T extends {checkId: string; decision: string}>(taskId: number, reviews: T[]) {
  return reviews.find(review => review.checkId === handoverReviewCheckId(taskId) && review.decision === HANDOVER_REVIEW_DECISION) ?? null;
}
export function handoverReviewReason(comment: string, closingComment = '') {
  const source = closingComment.trim() || comment;
  const reasons = [...source.matchAll(/Причина:\s*([^\n]+)/g)];
  return reasons.at(-1)?.[1].trim().replace(/\.\s*$/, '') || null;
}
export function handoverReviewHref(date: string, employeeId: number) {
  return `/admin/workday?date=${date}&control=all&employee=${employeeId}&focus=shift-handover-review#employees-control`;
}

/** Same-origin JSON POST, including the portal's reverse-proxy host. */
export function handoverReviewRequestAllowed(request: Request) {
  const site=request.headers.get('sec-fetch-site');
  if(site && !['same-origin','none'].includes(site))return false;
  if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))return false;
  const origin=request.headers.get('origin');
  if(!origin)return true; // A signed ADMIN session is still mandatory.
  try {
    const parsed=new URL(origin);
    const host=(request.headers.get('x-forwarded-host')?.split(',')[0]?.trim() || request.headers.get('host') || new URL(request.url).host).toLowerCase();
    return ['http:','https:'].includes(parsed.protocol) && parsed.host===host;
  } catch {return false;}
}
