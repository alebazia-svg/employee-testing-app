'use client';

export type EmployeeCashOutboxItem = {
  id: string;
  userId: number;
  workDayEntryId: number;
  workDayDate: string;
  createdAt: string;
  url: string;
  direction: string;
  amount: string;
  comment: string;
  photo: Blob;
  photoName?: string;
  photoType?: string;
  lastError: string;
};

const databaseName = 'offonika-workday-safety';
const storeName = 'cash-operation-outbox';
const databaseVersion = 1;

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(databaseName, databaseVersion);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(storeName)) database.createObjectStore(storeName, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('OFFLINE_STORAGE_UNAVAILABLE'));
  });
}

function runRequest<T>(mode: IDBTransactionMode, callback: (store: IDBObjectStore) => IDBRequest<T>) {
  return openDatabase().then((database) => new Promise<T>((resolve, reject) => {
    let transaction: IDBTransaction | undefined;
    const fail = (error: unknown) => {
      database.close();
      reject(error ?? new Error('OFFLINE_STORAGE_FAILED'));
    };
    try {
      transaction = database.transaction(storeName, mode);
      const activeTransaction = transaction;
      activeTransaction.onerror = () => fail(activeTransaction.error);
      activeTransaction.onabort = () => fail(activeTransaction.error);
      const request = callback(activeTransaction.objectStore(storeName));
      request.onerror = () => fail(request.error);
      // Request success is provisional: the transaction can still abort.
      activeTransaction.oncomplete = () => {
        database.close();
        resolve(request.result);
      };
    } catch (error) {
      try { transaction?.abort(); } catch { /* Transaction may already be inactive. */ }
      fail(error);
    }
  }));
}

export function saveEmployeeCashOutboxItem(item: EmployeeCashOutboxItem) {
  return runRequest('readwrite', (store) => store.put(item));
}

export function removeEmployeeCashOutboxItem(id: string) {
  return runRequest('readwrite', (store) => store.delete(id));
}

export function listEmployeeCashOutboxItems() {
  return runRequest<EmployeeCashOutboxItem[]>('readonly', (store) => store.getAll());
}

export function cashOutboxResponseAcknowledges(result: unknown, item: EmployeeCashOutboxItem) {
  if (!result || typeof result !== 'object' || !('operation' in result)) return false;
  const operation = result.operation;
  if (!operation || typeof operation !== 'object') return false;
  const row = operation as Record<string, unknown>;
  // A successful HTTP response alone is not proof that this exact operation
  // is durable. A 202 is sufficient when it includes the matching saved row;
  // posting in 1C is owned by the server, not the phone's upload queue.
  return typeof row.id === 'number' && Number.isSafeInteger(row.id) && row.id > 0
    && row.idempotencyKey === item.id
    && row.userId === item.userId
    && row.direction === item.direction
    && row.amount === Number(item.amount.replace(',', '.'))
    && (!Number.isSafeInteger(item.workDayEntryId) || row.workDayEntryId === item.workDayEntryId)
    && (!/^\d{4}-\d{2}-\d{2}$/.test(item.workDayDate) || row.date === item.workDayDate);
}

export function cashOutboxFormData(item: EmployeeCashOutboxItem) {
  if (!(item.photo instanceof Blob) || item.photo.size <= 0) {
    throw new Error('Сохранённая фотография повреждена. Обратитесь к администратору — сумму и запись не удаляйте.');
  }
  // WebKit may restore a File from IndexedDB as a plain Blob. Rebuilding it
  // with an explicit filename keeps the multipart body valid on iOS/PWA.
  const photoType = item.photoType || item.photo.type || 'image/jpeg';
  const photoName = item.photoName || `cash-operation-${item.id}.jpg`;
  const photo = new File([item.photo], photoName, { type: photoType, lastModified: Date.now() });
  const formData = new FormData();
  formData.append('direction', item.direction);
  formData.append('amount', item.amount);
  formData.append('comment', item.comment);
  formData.append('idempotencyKey', item.id);
  // Records created by the previous PWA version do not have these fields.
  // Keep them retryable on the same day, while every new record is pinned to
  // the exact workday that was active when the employee took the photo.
  if (Number.isSafeInteger(item.workDayEntryId) && item.workDayEntryId > 0 && /^\d{4}-\d{2}-\d{2}$/.test(item.workDayDate)) {
    formData.append('workDayEntryId', String(item.workDayEntryId));
    formData.append('workDayDate', item.workDayDate);
  }
  formData.append('clientCreatedAt', item.createdAt);
  formData.append('photo', photo, photo.name);
  return formData;
}
