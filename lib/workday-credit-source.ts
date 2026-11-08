import type { OneCSalesRealizationDocument, OneCSalesRealizationsResult, OneCSalesRealizationFiscalOperationsResult } from './one-c';

export type WorkdayCreditSource = { ok: boolean; documents: OneCSalesRealizationDocument[]; fiscalByRealization: Record<string, OneCSalesRealizationFiscalOperationsResult>; error?: string };
type PageParams = { dateFrom: string; dateTo: string; posted: 'true'; limit: number; offset: number; includeLines: false };

export async function loadWorkdayCreditDocuments(date: string, read: (params: PageParams) => Promise<OneCSalesRealizationsResult>): Promise<WorkdayCreditSource> {
  const documents: OneCSalesRealizationDocument[] = [];
  const limit = 100;
  for (let offset = 0; offset < 1000; offset += limit) {
    const result = await read({ dateFrom: date, dateTo: date, posted: 'true', limit, offset, includeLines: false });
    if (!result.ok) return { ok: false, documents, fiscalByRealization: {}, error: result.error ?? result.diagnostics.join('; ') };
    documents.push(...result.documents);
    if (result.responseDocumentCount < limit) return { ok: true, documents, fiscalByRealization: {} };
  }
  // An empty probe distinguishes exactly 1000 complete rows from truncation.
  const probe = await read({ dateFrom: date, dateTo: date, posted: 'true', limit: 1, offset: 1000, includeLines: false });
  if (probe.ok && probe.responseDocumentCount === 0) return { ok: true, documents, fiscalByRealization: {} };
  return { ok: false, documents, fiscalByRealization: {}, error: 'Достигнут лимит выгрузки реализаций за день. Полнота данных 1С не подтверждена.' };
}

export async function loadWorkdayCreditFiscal(source: WorkdayCreditSource, needed: (document: OneCSalesRealizationDocument) => boolean, read: (ref: string) => Promise<OneCSalesRealizationFiscalOperationsResult>): Promise<WorkdayCreditSource> {
  if (!source.ok) return source;
  const refs = [...new Set(source.documents.filter(needed).map(document => document.ref))];
  const fiscalByRealization: WorkdayCreditSource['fiscalByRealization'] = {};
  let next = 0, failed = false;
  // The original concurrency limit stays four. A slow document no longer
  // prevents a free slot from starting the next independent read.
  await Promise.all(Array.from({ length: Math.min(4, refs.length) }, async () => {
    while (!failed && next < refs.length) {
      const ref = refs[next++];
      try {
        const result = await read(ref);
        fiscalByRealization[ref] = result.realizationRef === ref ? result : { ...result, ok: false, error: 'Ответ 1С относится к другой реализации.', diagnostics: [...(result.diagnostics ?? []), 'Realization reference mismatch'] };
      }
      catch (error) { failed = true; throw error; }
    }
  }));
  return { ...source, fiscalByRealization };
}
