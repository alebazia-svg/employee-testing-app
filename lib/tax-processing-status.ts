// Best-effort memory of background recalculations, so the uploader can see the
// server's reason when a file fails. The database status stays the source of
// truth; after a restart only the generic message is shown.
type ProcessingNote = { state: 'processing' | 'done' | 'failed'; message?: string; at: number };

const globalNotes = globalThis as typeof globalThis & { __taxProcessingNotes?: Map<string, ProcessingNote> };
const notes = globalNotes.__taxProcessingNotes ??= new Map<string, ProcessingNote>();

export function rememberTaxProcessing(id: string, note: Omit<ProcessingNote, 'at'>) {
  notes.set(id, { ...note, at: Date.now() });
  for (const [key, value] of notes) if (Date.now() - value.at > 6 * 60 * 60_000) notes.delete(key);
}

export function taxProcessingNote(id: string) {
  return notes.get(id);
}
