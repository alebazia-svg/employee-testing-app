import { createHash, randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import { taxDocumentTypes } from './tax-document-types';

export const MAX_TAX_DOCUMENT_BYTES = 12 * 1024 * 1024;

export function taxDocumentRequestTooLarge(request: Request) {
  const length = Number(request.headers.get('content-length'));
  return Number.isFinite(length) && length > MAX_TAX_DOCUMENT_BYTES + 1024 * 1024;
}
const allowedTypes = new Set(Object.keys(taxDocumentTypes));

function safeOriginalName(value: string) {
  return path.basename(value).replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 180) || 'document';
}

function detectFormat(bytes: Uint8Array, originalName = '') {
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return { extension: 'pdf', mime: 'application/pdf' };
  if (bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) return /\.zip$/i.test(originalName) ? { extension: 'zip', mime: 'application/zip' } : { extension: 'xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
  if (bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0) return { extension: 'xls', mime: 'application/vnd.ms-excel' };
  const prefix = new TextDecoder('utf-8', { fatal: false }).decode(bytes.slice(0, 512)).replace(/^\uFEFF/, '').trimStart();
  if (prefix.startsWith('<?xml') || prefix.startsWith('<')) return { extension: 'xml', mime: 'application/xml' };
  if (!bytes.slice(0, 512).some((byte) => byte === 0)) return { extension: 'csv', mime: 'text/csv' };
  return null;
}

const monthNames: Record<string, string> = {
  январь: '01', февраль: '02', март: '03', апрель: '04', май: '05', июнь: '06',
  июль: '07', август: '08', сентябрь: '09', октябрь: '10', ноябрь: '11', декабрь: '12',
};

function previousMonth(date: Date) {
  const value = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - 1, 1));
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}`;
}

function parseRussianDate(value: unknown) {
  const match = String(value ?? '').trim().match(/^(\d{2})\.(\d{2})\.(20\d{2})$/);
  return match ? new Date(Date.UTC(Number(match[3]), Number(match[2]) - 1, Number(match[1]))) : null;
}

export async function detectTaxDocumentCoverage(input: { documentType: string; periodKey: string; originalName: string; bytes: Uint8Array; extension: string }) {
  const fallback = { coverageFrom: input.periodKey, coverageTo: input.periodKey, detected: false, note: 'Период подтверждён вручную.' };
  if (input.documentType === 'AUSN_CALCULATION') return { coverageFrom: '2026-04', coverageTo: input.periodKey, detected: false, note: 'Диапазон начинается с перехода на АУСН; последний месяц подтверждён вручную.' };
  if (input.documentType === 'AUSN_INCOME' && ['xls', 'xlsx'].includes(input.extension)) {
    try {
      const workbook = XLSX.read(input.bytes, { type: 'array', cellDates: false });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false });
      const dates = rows.slice(1).map((row) => parseRussianDate(row[0])).filter((date): date is Date => Boolean(date)).sort((a, b) => a.getTime() - b.getTime());
      if (dates.length) return { coverageFrom: '2026-04', coverageTo: previousMonth(dates.at(-1)!), detected: true, note: 'Определено по датам операций; незавершённый месяц не засчитан.' };
    } catch {}
  }
  if (input.documentType === 'ENS_OPERATIONS' && input.extension === 'zip') {
    try {
      const archive = await JSZip.loadAsync(input.bytes);
      const entries = await Promise.all(Object.values(archive.files).filter((entry) => !entry.dir).map((entry) => entry.async('uint8array')));
      const csv = entries.map((entry) => {
        const utf8 = new TextDecoder('utf-8').decode(entry);
        return utf8.includes('Отчетный период') ? utf8 : new TextDecoder('windows-1251').decode(entry);
      }).find((text) => text.includes('Отчетный период'));
      if (csv) {
        const lines = csv.split(/\r?\n/).filter(Boolean);
        const headers = lines[0].split(';').map((value) => value.trim());
        const yearIndex = headers.indexOf('Отчетный год');
        const periodIndex = headers.indexOf('Отчетный период');
        const periods = lines.slice(1).map((line) => line.split(';')).map((row) => {
          const month = monthNames[(row[periodIndex] || '').trim().toLowerCase()];
          const year = (row[yearIndex] || '').trim();
          return month && /^20\d{2}$/.test(year) ? `${year}-${month}` : null;
        }).filter((period): period is string => Boolean(period)).sort();
        if (periods.length) return { coverageFrom: periods[0], coverageTo: periods.at(-1)!, detected: true, note: 'Определено по фактическим периодам начислений АУСН внутри архива ЕНС.' };
      }
    } catch {}
  }
  return fallback;
}

export function validateTaxDocumentInput(input: { documentType: unknown; periodKey: unknown }) {
  const documentType = String(input.documentType ?? '').trim();
  const periodKey = String(input.periodKey ?? '').trim();
  if (!allowedTypes.has(documentType)) throw new Error('Выберите тип документа.');
  if (!/^20\d{2}(?:-(?:0[1-9]|1[0-2]))?$/.test(periodKey)) throw new Error('Укажите год или месяц в формате ГГГГ-ММ.');
  return { documentType, periodKey };
}

export async function persistTaxDocument(file: File) {
  if (!file.size) throw new Error('Выберите файл.');
  if (file.size > MAX_TAX_DOCUMENT_BYTES) throw new Error('Файл слишком большой. Максимальный размер — 12 МБ.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const format = detectFormat(bytes, file.name);
  if (!format) throw new Error('Поддерживаются PDF, XLS, XLSX, ZIP, XML и текстовые CSV-файлы.');
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const storageKey = `tax-documents/${new Date().getUTCFullYear()}/${randomUUID()}.${format.extension}`;
  const absolutePath = path.join(process.cwd(), 'uploads', storageKey);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, bytes, { flag: 'wx', mode: 0o600 });
  return { storageKey, sha256, size: file.size, mimeType: format.mime, originalName: safeOriginalName(file.name), bytes, extension: format.extension };
}
