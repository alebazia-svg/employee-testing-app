import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { loadTaxManagementReview } from './tax-management-review-source';

type Documents = Parameters<typeof loadTaxManagementReview>[0];

// Called only by the existing trusted refresh CLI, never by a page read.
// A new invalid/latest archive invalidates Telegram's old snapshot as well.
export async function publishTaxTelegramContext(documents: Documents, target: string, uploadsRoot?: string) {
  const review = await loadTaxManagementReview(documents, uploadsRoot);
  const latest = [...documents].sort((a,b) => b.createdAt.getTime()-a.createdAt.getTime()).find(d => d.documentType === 'CORRECTION_EVIDENCE' && /^AUSN_management_review_.*\.zip$/i.test(d.originalName));
  const payload = review ? { ...review, contextSource: { documentId: latest!.id, originalName: latest!.originalName, sha256: latest!.sha256 } } : { schema: 0, reason: 'latest_documentary_review_unavailable', latestDocumentId: latest?.id };
  const serialized = JSON.stringify(payload);
  if (await readFile(target, 'utf8').catch(() => undefined) === serialized) return { state: review ? 'ready' : 'unavailable', changed: false };
  await mkdir(path.dirname(target), { recursive: true, mode: 0o750 });
  const temporary = `${target}.${randomBytes(8).toString('hex')}.tmp`;
  await writeFile(temporary, serialized, { mode: 0o640, flag: 'wx' });
  await rename(temporary, target);
  return { state: review ? 'ready' : 'unavailable', changed: true };
}
