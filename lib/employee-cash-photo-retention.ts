'use client';

import {
  listEmployeeCashOutboxItems,
  readEmployeeCashOutboxItem,
  removeEmployeeCashOutboxItem,
  saveEmployeeCashOutboxItem,
  probeEmployeeCashStorage,
  type EmployeeCashOutboxItem,
} from './employee-cash-outbox';

// Keep the first File even if IndexedDB refuses a write. This survives component
// re-entry, but is deliberately NOT described as durable phone storage.
const retained = new Map<string, { item: EmployeeCashOutboxItem; durable: boolean }>();
const acknowledged = new Set<string>();

export function isEmployeeCashPhotoVolatile(id: string) {
  return retained.get(id)?.durable === false;
}

export function hasVolatileEmployeeCashPhoto(userId: number) {
  return [...retained.values()].some(row => row.item.userId === userId && !row.durable);
}

export async function prepareEmployeeCashStorage() {
  // Persistence is a browser decision, not a guarantee. Failure never disables
  // the camera, the small money request or the retained-file retry.
  try { void navigator.storage?.persist?.().catch(() => false); } catch { /* Unsupported browser. */ }
  try { await probeEmployeeCashStorage(); return true; } catch { return false; }
}

async function digest(photo: Blob) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await photo.arrayBuffer())), b => b.toString(16).padStart(2, '0')).join('');
}

export async function retainEmployeeCashOutboxItem(item: EmployeeCashOutboxItem) {
  if (acknowledged.has(item.id)) return;
  const prior = retained.get(item.id);
  const entry = { item, durable: Boolean(prior?.durable && prior.item.photoSha256 === item.photoSha256 && prior.item.photo === item.photo) };
  retained.set(item.id, entry); // Before the first await: never drop the capture.
  await saveEmployeeCashOutboxItem(item);
  const restored = await readEmployeeCashOutboxItem(item.id);
  if (!restored || restored.id !== item.id || restored.userId !== item.userId
    || !(restored.photo instanceof Blob) || restored.photo.size !== item.photo.size
    || await digest(restored.photo) !== (item.photoSha256 || await digest(item.photo))) {
    throw new Error('PHOTO_STORAGE_VERIFICATION_FAILED');
  }
  // A newer metadata/duplicate update may already own the same original file.
  const current = retained.get(item.id);
  if (current?.item.photo === item.photo) current.durable = true;
}

export async function listRetainedEmployeeCashOutboxItems() {
  let stored: EmployeeCashOutboxItem[] = [];
  try { stored = await listEmployeeCashOutboxItems(); }
  catch (error) { if (retained.size === 0) throw error; }
  for (const item of stored) {
    if (!retained.has(item.id) && !acknowledged.has(item.id)) {
      let durable = item.photo instanceof Blob && item.photo.size > 0;
      if (durable && item.photoSha256) {
        try { durable = await digest(item.photo) === item.photoSha256; } catch { durable = false; }
      }
      if (!retained.has(item.id) && !acknowledged.has(item.id)) retained.set(item.id, { item, durable });
    }
  }
  return [...retained.values()].map(entry => entry.item);
}

export async function removeRetainedEmployeeCashOutboxItem(id: string) {
  // Call only after an exact server photo receipt or the existing explicit
  // duplicate decision. A failed disk deletion must retain a retryable key.
  const entry = retained.get(id);
  try { await removeEmployeeCashOutboxItem(id); }
  catch (error) { if (!entry || entry.durable) throw error; }
  acknowledged.add(id);
  retained.delete(id);
}
