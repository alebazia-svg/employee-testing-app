'use client';

export type EmployeeCashOutboxItem = {
  id: string;
  userId: number;
  createdAt: string;
  url: string;
  direction: string;
  amount: string;
  comment: string;
  photo: File;
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
    const transaction = database.transaction(storeName, mode);
    const request = callback(transaction.objectStore(storeName));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('OFFLINE_STORAGE_FAILED'));
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error('OFFLINE_STORAGE_FAILED'));
    };
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

export function cashOutboxFormData(item: EmployeeCashOutboxItem) {
  const formData = new FormData();
  formData.append('direction', item.direction);
  formData.append('amount', item.amount);
  formData.append('comment', item.comment);
  formData.append('idempotencyKey', item.id);
  formData.append('photo', item.photo);
  return formData;
}
