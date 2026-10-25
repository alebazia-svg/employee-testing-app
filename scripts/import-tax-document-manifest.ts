import { readFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '../lib/prisma';
import { persistTaxDocument, validateTaxDocumentInput } from '../lib/tax-document-upload';

type ManifestItem = {
  path: string;
  documentType: string;
  periodKey: string;
  coverageFrom?: string;
  coverageTo?: string;
};

async function main() {
  const manifestPath = process.argv[2];
  if (!manifestPath) throw new Error('Передайте путь к JSON-манифесту.');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as ManifestItem[];
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN', isActive: true }, orderBy: { id: 'asc' }, select: { id: true } });
  if (!admin) throw new Error('Активный администратор не найден.');
  const results = [];
  for (const item of manifest) {
    const input = validateTaxDocumentInput(item);
    const coverageFrom = item.coverageFrom || input.periodKey;
    const coverageTo = item.coverageTo || input.periodKey;
    if (!/^20\d{2}-(?:0[1-9]|1[0-2])$/.test(coverageFrom) || !/^20\d{2}-(?:0[1-9]|1[0-2])$/.test(coverageTo) || coverageFrom > coverageTo) throw new Error(`Некорректный диапазон: ${item.path}`);
    const bytes = await readFile(item.path);
    const file = new File([bytes], path.basename(item.path));
    const stored = await persistTaxDocument(file);
    try {
      const record = await prisma.taxControlDocument.create({ data: { ...input, coverageFrom, coverageTo, ...stored, uploadedById: admin.id }, select: { id: true, originalName: true } });
      results.push({ state: 'imported', ...record, coverageFrom, coverageTo });
    } catch (error) {
      const duplicate = typeof error === 'object' && error && 'code' in error && error.code === 'P2002';
      await unlink(path.join(process.cwd(), 'uploads', stored.storageKey)).catch(() => {});
      if (!duplicate) throw error;
      results.push({ state: 'duplicate', originalName: path.basename(item.path), coverageFrom, coverageTo });
    }
  }
  console.log(JSON.stringify(results, null, 2));
}

main().finally(() => prisma.$disconnect());
