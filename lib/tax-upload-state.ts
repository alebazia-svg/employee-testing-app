// Each submission owns its state, even if its form disappears during refresh.
export type TaxUploadStatus = { attempt: number; progress: '' | 'sending' | 'processing' | 'waiting' | 'done' | 'failed'; fileName: string; message: string; changes: string[]; owner: string; ownerVisible: boolean };
export const idleTaxUpload: TaxUploadStatus = { attempt: 0, progress: '', fileName: '', message: '', changes: [], owner: '', ownerVisible: false };
export function createTaxUploadStore() {
  let sequence = 0;
  let snapshot: readonly TaxUploadStatus[] = [];
  const listeners = new Set<() => void>();
  const publish = () => listeners.forEach(listener => listener());
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    begin(owner: string, fileName: string) {
      const attempt = ++sequence;
      snapshot = [...snapshot.filter(status => status.owner !== owner), { ...idleTaxUpload, attempt, owner, fileName, progress: 'sending' }];
      publish();
      return attempt;
    },
    update(attempt: number, patch: Partial<Pick<TaxUploadStatus, 'progress' | 'message' | 'changes' | 'ownerVisible'>>) {
      if (!snapshot.some(status => status.attempt === attempt)) return;
      snapshot = snapshot.map(status => status.attempt === attempt ? { ...status, ...patch } : status);
      publish();
    },
    isBusy(owner: string) { return snapshot.some(status => status.owner === owner && ['sending', 'processing'].includes(status.progress)); },
  };
}
