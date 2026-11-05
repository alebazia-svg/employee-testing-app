import { createHash } from 'node:crypto';
import { lstat, readFile } from 'node:fs/promises';
import path from 'node:path';
import JSZip from 'jszip';
import { parseTaxManagementReview } from './tax-management-review';

type Document = { id: string; documentType: string; status: string; originalName: string; storageKey: string; sha256: string; createdAt: Date };
export async function loadTaxManagementReview(documents: Document[], root = path.join(process.cwd(), 'uploads')) {
  const sorted = [...documents].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const doc = sorted.find(d => d.documentType === 'CORRECTION_EVIDENCE' && /^AUSN_management_review_.*\.zip$/i.test(d.originalName));
  if (!doc || doc.status !== 'UPLOADED') return;
  try {
    const file = path.resolve(root, doc.storageKey);
    if (!file.startsWith(path.resolve(root) + path.sep)) return;
    const stat = await lstat(file);
    if (!stat.isFile() || stat.size > 12 * 1024 * 1024) return;
    const bytes = await readFile(file);
    if (createHash('sha256').update(bytes).digest('hex') !== doc.sha256) return;
    const zip = await JSZip.loadAsync(bytes);
    if (Object.keys(zip.files).length > 100) return;
    const member = zip.file('tax-management-review.json');
    const size = (member as unknown as { _data?: { uncompressedSize?: number } })?._data?.uncompressedSize;
    if (!member || !Number.isSafeInteger(size) || Number(size) > 256 * 1024) return;
    const review = parseTaxManagementReview(await member.async('string'));
    if (!review) return;
    const sources = review.sources.map(source => {
      const match = sorted.find(d => d.originalName === source.originalName && ['UPLOADED', 'PROCESSED'].includes(d.status));
      return { ...source, documentId: match?.id };
    });
    // Missing evidence fails closed: a broken/newer review cannot show old certainty.
    if (sources.some(s => !s.documentId)) return;
    return { ...review, sources, documentId: doc.id };
  } catch { return; }
}
