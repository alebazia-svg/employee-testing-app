import { ArrowDownToLine, Banknote, CalendarDays, ClipboardList, Info, LogOut, MessageCircle, Package, ReceiptText } from 'lucide-react';
import type { EmployeeNoticeKind } from '@/lib/employee-notice-icons';
import styles from './EmployeeNoticeIcon.module.css';

const icons = { receipt: ReceiptText, checklist: ClipboardList, money: Banknote, encashment: ArrowDownToLine, closing: LogOut, message: MessageCircle, schedule: CalendarDays, delivery: Package, notice: Info };

export function EmployeeNoticeIcon({ kind, animated = false, size = 20 }: { kind: EmployeeNoticeKind; animated?: boolean; size?: number }) {
  const Icon = icons[kind];
  const paper = kind === 'receipt' || kind === 'checklist';
  const motion = paper ? styles.paper : kind === 'encashment' ? styles.vertical : styles.nudge;
  return <span aria-hidden='true' className={`${styles.icon} ${animated ? `${styles.animated} ${motion}` : ''}`} style={{ width: animated ? 38 : size, height: animated ? 34 : size }}>
    <Icon size={animated ? 26 : size} strokeWidth={1.8} />
  </span>;
}
