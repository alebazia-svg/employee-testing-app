export function normalizeOneCDateTime(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return new Date(value).toISOString();
  const source = typeof value === 'string' ? value.trim() : '';
  if (!source) return '';
  const russian = source.match(/^(\d{2})\.(\d{2})\.(\d{4})[ T](\d{1,2}):(\d{2}):(\d{2})/);
  const compact = source.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/);
  const normalized = russian
    ? `${russian[3]}-${russian[2]}-${russian[1]}T${russian[4].padStart(2, '0')}:${russian[5]}:${russian[6]}+03:00`
    : compact
      ? `${compact[1]}-${compact[2]}-${compact[3]}T${compact[4]}:${compact[5]}:${compact[6]}+03:00`
      : /[zZ]$|[+-]\d{2}:?\d{2}$/.test(source)
        ? source
        : `${source.replace(' ', 'T')}+03:00`;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString();
}
