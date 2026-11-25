'use client';
import { cashMetadataAcknowledges, cashOutboxResponseAcknowledges, type EmployeeCashOutboxItem } from './employee-cash-outbox';
import { readEmployeeCashReceipt, watchEmployeeCashPersistence } from './employee-cash-receipt';
import { validateCashPhoto } from './cash-photo-validation';
import { CASH_PHOTO_CHUNK_BYTES } from './cash-photo-protocol';

export async function prepareEmployeeCashPhoto(file: File, baselineId: number | null) {
  const format = await validateCashPhoto(file);
  const photoSha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer())), b => b.toString(16).padStart(2, '0')).join('');
  return { protocol: 2 as const, photoSha256, baselineId, photoType: format.mime };
}

export class CashTransferError extends Error {
  constructor(message: string, readonly payload?: unknown, readonly status?: number) { super(message); }
}

async function jsonRequest(url: string, init?: RequestInit, fetcher: typeof fetch = fetch, timeoutMs = init?.method === 'POST' ? 120_000 : 30_000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetcher(url, { ...init, cache: 'no-store', signal: controller.signal });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new CashTransferError(data?.error || 'Не удалось связаться с порталом. Повторим отправку исходного фото.', data, response.status);
    return data;
  } finally { clearTimeout(timeout); }
}

/** The first small POST still owns the protected 1C call. A read-only receipt
 * releases the UI and starts attachment transport without waiting for 1C.
 * Losing any response never changes the intent UUID or discards the photo.
 */
export async function saveEmployeeCashIntent<T>(item: EmployeeCashOutboxItem, callbacks: {
  onMetadata?: (operation: T) => void | Promise<void>; onOperation?: (operation: T) => void; onPhotoProgress?: (value: number) => void;
}, fetcher: typeof fetch = fetch): Promise<{ operation: T; message?: string }> {
  if (item.protocol !== 2 || !item.photoSha256) throw new Error('Некорректная сохранённая инкассация');
  const read = () => readEmployeeCashReceipt<T>(item, fetcher);
  let receipt = await read();
  if (!receipt) {
    let stop = () => {};
    try {
      receipt = await new Promise<{ operation: T }>((resolve, reject) => {
        stop = watchEmployeeCashPersistence<T>(item, operation => resolve({ operation }), read);
        // Catch is attached immediately, even if the read wins the race.
        void jsonRequest(item.url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
          protocol: 2, direction: item.direction, amount: item.amount, comment: item.comment,
          idempotencyKey: item.id, workDayEntryId: item.workDayEntryId, workDayDate: item.workDayDate,
          clientCreatedAt: item.createdAt, baselineId: item.baselineId ?? null,
          photoSha256: item.photoSha256, photoBytes: item.photo.size, distinctFromOperationId: item.distinctFromOperationId,
        }) }, fetcher).then(result => {
          if (!cashMetadataAcknowledges(result, item)) reject(new Error('Портал не подтвердил сохранение суммы.'));
          else { callbacks.onOperation?.(result.operation); resolve(result); }
        }, reject);
      });
    } finally { stop(); }
  }
  await callbacks.onMetadata?.(receipt.operation);
  return receipt;
}

export async function transferEmployeeCash<T>(item: EmployeeCashOutboxItem, callbacks: {
  onMetadata?: (operation: T) => void | Promise<void>; onOperation?: (operation: T) => void; onPhotoProgress?: (value: number) => void;
}, fetcher: typeof fetch = fetch): Promise<{ operation: T; message?: string }> {
  if (!item.photoSha256) throw new Error('Некорректная сохранённая инкассация');
  // An acknowledged financial record must never be recreated because the
  // photo worker cannot read it. It can only read and attach the original.
  const receipt = item.metadataSaved ? null : await saveEmployeeCashIntent<T>(item, callbacks, fetcher);
  if (receipt && cashOutboxResponseAcknowledges(receipt, item)) return receipt;

  try {
    return await uploadMissingCashPhotoChunks<T>(item, item.photoSha256, callbacks, fetcher, 30_000);
  } catch (error) {
    if (!isTransientCashPhotoError(error)) throw error;
    // The interrupted request might have committed. Refresh the accepted
    // chunk list and use a longer deadline for the slow connection.
    return uploadMissingCashPhotoChunks<T>(item, item.photoSha256, callbacks, fetcher, 120_000);
  }
}

function isTransientCashPhotoError(error: unknown) {
  if (error instanceof CashTransferError && error.status !== undefined) {
    return error.status === 408 || error.status >= 500;
  }
  return error instanceof TypeError || error instanceof Error && error.name === 'AbortError';
}

async function uploadMissingCashPhotoChunks<T>(
  item: EmployeeCashOutboxItem,
  photoSha256: string,
  callbacks: { onPhotoProgress?: (value: number) => void },
  fetcher: typeof fetch,
  uploadTimeoutMs: number,
): Promise<{ operation: T; message?: string }> {
  const endpoint = `${item.url}?idempotencyKey=${encodeURIComponent(item.id)}`;
  const progress = await jsonRequest(`${endpoint}&protocol=2`, undefined, fetcher);
  if (!cashMetadataAcknowledges(progress, item)) throw new Error('Не удалось подтвердить сохранение суммы.');
  if (cashOutboxResponseAcknowledges(progress, item)) return progress;
  const received = new Set<number>(progress.photo?.receivedChunks ?? []);
  const total = Math.ceil(item.photo.size / CASH_PHOTO_CHUNK_BYTES);
  const sendChunk = async (index: number) => {
    const start = index * CASH_PHOTO_CHUNK_BYTES;
    const body = await item.photo.slice(start, start + CASH_PHOTO_CHUNK_BYTES).arrayBuffer();
    return jsonRequest(`${endpoint}&chunk=${index}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/octet-stream', 'X-Photo-Sha256': photoSha256 },
      body,
    }, fetcher, uploadTimeoutMs);
  };
  let result = progress;
  for (let index = 0; index < total; index++) {
    if (!received.has(index)) result = await sendChunk(index);
    callbacks.onPhotoProgress?.(Math.round((index + 1) / total * 100));
  }
  if (!cashOutboxResponseAcknowledges(result, item)) {
    // All chunks can be present after a server restart before finalization.
    result = await sendChunk(total - 1);
  }
  if (!cashOutboxResponseAcknowledges(result, item)) throw new Error('Фото пока не подтверждено порталом. Повторим отправку исходного снимка.');
  return result;
}
