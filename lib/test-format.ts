export function questionWord(count: number) {
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod10 === 1 && mod100 !== 11) return 'вопрос';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'вопроса';

  return 'вопросов';
}

export function questionCountText(count: number) {
  return `${count} ${questionWord(count)}`;
}

export function sectionWord(count: number) {
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod10 === 1 && mod100 !== 11) return 'раздел';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'раздела';

  return 'разделов';
}

export function sectionCountText(count: number) {
  return `${count} ${sectionWord(count)}`;
}

export function attestationStatusLabel(status: string) {
  return status === 'ACTIVE' ? 'Активна' : 'Черновик';
}

export function attestationTypeLabel(type: string) {
  return type === 'CONTROL' ? 'Контрольная' : 'Пробная';
}
