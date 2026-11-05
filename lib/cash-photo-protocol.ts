/** Original bytes are transferred once per acknowledged chunk; never recompress evidence. */
export const CASH_PHOTO_CHUNK_BYTES = 512 * 1024;
// Cash evidence uses small resumable requests; ordinary full-resolution phone
// captures must not inherit the 8 MiB limit of unrelated checklist attachments.
export const CASH_PHOTO_MAX_BYTES = 64 * 1024 * 1024;

export function validCashPhotoIdentity(hash: unknown, size: unknown): hash is string {
  return typeof hash === 'string' && /^[a-f0-9]{64}$/.test(hash)
    && typeof size === 'number' && Number.isSafeInteger(size) && size > 0 && size <= CASH_PHOTO_MAX_BYTES;
}

export function cashPhotoChunkLength(total: number, index: number) {
  if (!Number.isSafeInteger(index) || index < 0 || index >= Math.ceil(total / CASH_PHOTO_CHUNK_BYTES)) return null;
  return Math.min(CASH_PHOTO_CHUNK_BYTES, total - index * CASH_PHOTO_CHUNK_BYTES);
}
