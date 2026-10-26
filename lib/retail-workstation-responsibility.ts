import { attendanceEmployeeKey } from './attendance-identity';

/** Owner-confirmed seating: Zukhra and Milana keep their PCs; Magomed replaces
 * the absent owner. Stable portal keys survive aQsi terminal replacement.
 * This identifies responsibility for a check, never proof of a missing receipt.
 */
export function retailHomeTerminalKey(name: string): string | null {
  const key = attendanceEmployeeKey(name);
  if (key === attendanceEmployeeKey('Абшаева Зухра')) return '2332022071';
  if (key === attendanceEmployeeKey('Чеченова Милана')) return '1010808747019437';
  return null;
}

export function fiscalWorkstationLabel(label: string | null, responsible: string | null) {
  return label && responsible ? `${label} (${responsible})` : label;
}

export function isRetailWorkstationReplacement(name: string) {
  return attendanceEmployeeKey(name) === attendanceEmployeeKey('Костеренко Магомед');
}
