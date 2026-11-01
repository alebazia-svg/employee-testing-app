import { createHash } from 'node:crypto';
import { lstat, readFile } from 'node:fs/promises';
import path from 'node:path';
import JSZip from 'jszip';
import { parseIncomeEvidence, type IncomeEvidenceReview } from './tax-income-evidence';
type Document = { id: string; documentType: string; status: string; originalName: string; storageKey: string; sha256: string; createdAt: Date };
export async function loadIncomeEvidence(documents: Document[], root = path.join(process.cwd(), 'uploads')): Promise<IncomeEvidenceReview | undefined> {
  const doc = documents.filter(d => d.documentType === 'CORRECTION_EVIDENCE' && /^AUSN_tax_evidence_.*\.zip$/i.test(d.originalName)).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  if (!doc || doc.status !== 'UPLOADED') return;
  const file = path.resolve(root, doc.storageKey);
  if (!file.startsWith(path.resolve(root) + path.sep)) return;
  try {
    const st = await lstat(file);
    if (!st.isFile() || st.size > 12 * 1024 * 1024) return;
    const bytes = await readFile(file);
    if (createHash('sha256').update(bytes).digest('hex') !== doc.sha256) return;
    const zip = await JSZip.loadAsync(bytes);
    if (Object.keys(zip.files).length > 100) return;
    const member = zip.file('tax-income-evidence.json');
    // JSZip exposes the central-directory uncompressed size in this metadata.
    const size = (member as unknown as { _data?: { uncompressedSize?: number } })?._data?.uncompressedSize;
    if (!member || !Number.isSafeInteger(size) || Number(size) > 512 * 1024) return;
    const review = parseIncomeEvidence(await member.async('string'));
    // Only link documents the authorized page already queried, never arbitrary
    // external URLs or invented IDs from a supplied assessment.
    const available = new Set(documents.map(d => d.id));
    if (!review || (review.fnsSnapshot && !available.has(review.fnsSnapshot.sourceDocumentId)) || review.cases.some(c => c.sourceDocumentIds.some(id => !available.has(id)))) return;
    return { ...review, documentId: doc.id };
  } catch { return; }
}
