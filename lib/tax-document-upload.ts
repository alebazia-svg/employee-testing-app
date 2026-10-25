import { createHash, randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
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

function detectFormat(bytes: Uint8Array) {
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return { extension: 'pdf', mime: 'application/pdf' };
  if (bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) return { extension: 'xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
  const prefix = new TextDecoder('utf-8', { fatal: false }).decode(bytes.slice(0, 512)).replace(/^\uFEFF/, '').trimStart();
  if (prefix.startsWith('<?xml') || prefix.startsWith('<')) return { extension: 'xml', mime: 'application/xml' };
  if (!bytes.slice(0, 512).some((byte) => byte === 0)) return { extension: 'csv', mime: 'text/csv' };
  return null;
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
  const format = detectFormat(bytes);
  if (!format) throw new Error('Поддерживаются PDF, XLSX, XML и текстовые CSV-файлы.');
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const storageKey = `tax-documents/${new Date().getUTCFullYear()}/${randomUUID()}.${format.extension}`;
  const absolutePath = path.join(process.cwd(), 'uploads', storageKey);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, bytes, { flag: 'wx', mode: 0o600 });
  return { storageKey, sha256, size: file.size, mimeType: format.mime, originalName: safeOriginalName(file.name) };
}
