'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PremiumDangerTriangleIcon } from '@/components/PwaPreviewIcons';
import { HelpSheet } from './EmployeeAppSetupProposal';
import styles from './EmployeePreviousDayProposal.module.css';

export type PreviousDayProposal = { date: string; dateLabel: string; startLabel: string };

export function EmployeePreviousDayCard({ day, onOpen }: { day: PreviousDayProposal; onOpen: () => void }) {
  return <Card className={`mb-4 rounded-[24px] bg-white p-4 ${styles.card}`}>
    <div className={styles.heading}>
      <span className={styles.marker} aria-hidden='true'><PremiumDangerTriangleIcon color='#9c6b22' secondaryColor='#f1e1bf' secondaryOpacity={0.7} className='h-7 w-7'/></span>
      <div><h2>Вы не завершили предыдущий рабочий день</h2><p>{day.dateLabel}<span> · Начало {day.startLabel}</span></p></div>
    </div>
    <Button type='button' className='employee-material-primary-action w-full' onClick={onOpen}>Завершить рабочий день</Button>
  </Card>;
}

const reasons = [
  { code: 'forgot_close', label: 'Забыл отметить' },
  { code: 'left_early', label: 'Ушёл раньше' },
  { code: 'no_internet', label: 'Не было интернета' },
  { code: 'other', label: 'Другое' },
] as const;

type Props = {
  day: PreviousDayProposal;
  reason: string; comment: string; saving: boolean;
  onReasonChange: (reason: string) => void; onCommentChange: (comment: string) => void;
  onClose: () => void; onSubmit: () => void;
};

/** Existing reason codes and callbacks remain; no departure time is requested. */
export function EmployeePreviousDayCloseProposal(props: Props) {
  return <HelpSheet title='Завершить день' close={props.onClose} lockScroll={false}>
    <p className={styles.context}>{props.day.dateLabel}<span> · Начало {props.day.startLabel}</span></p>
    <fieldset className={styles.reasons}><legend>Почему не отметили уход?</legend>
      <div>{reasons.map(reason => <button key={reason.code} type='button' aria-pressed={props.reason === reason.code} className={`employee-material-reason-choice ${props.reason === reason.code ? 'is-selected' : ''}`} onClick={() => props.onReasonChange(reason.code)}>{reason.label}</button>)}</div>
      {props.reason === 'other' && <label className={styles.comment}>Укажите причину<textarea aria-label='Укажите причину' value={props.comment} onChange={event => props.onCommentChange(event.target.value)} maxLength={1000} rows={2} placeholder='Коротко, своими словами'/></label>}
    </fieldset>
    <Button type='button' className={`employee-material-primary-action w-full ${styles.submit}`} disabled={props.saving || !props.reason || (props.reason === 'other' && !props.comment.trim())} onClick={props.onSubmit}>{props.saving ? 'Сохраняем…' : 'Завершить день'}</Button>
  </HelpSheet>;
}
