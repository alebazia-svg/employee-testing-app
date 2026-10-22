'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ReceiptText } from 'lucide-react';
import { ActionReminderNotice } from '@/components/workday/EmployeeActionReminder';
import { ReminderBell } from '@/components/workday/ReminderBell';
import { EmployeeNoticeIcon } from '@/components/workday/EmployeeNoticeIcon';
import { EmployeeNotificationInbox, type EmployeeInboxItem } from '@/components/workday/EmployeeNotificationInbox';
import styles from './comparison.module.css';

const options = [
  { id: 'current', label: 'Сейчас: колокольчик', description: 'Покачивание и сигналы по бокам.' },
  { id: 'movement', label: 'Чек с движением', description: 'Значок чека коротко приподнимается и поворачивается.' },
  { id: 'copper', label: 'Медный акцент', description: 'Чек выделяется цветом и более сильной линией.' },
  { id: 'combined', label: 'Движение и медный акцент', description: 'Тот же чек: движение и цвет работают вместе.' },
];

export function ReminderComparison() {
  const [message, setMessage] = useState('Примеры. Рабочие уведомления не изменены.');
  const [inbox, setInbox] = useState(false);
  const examples = [
    { kind:'receipt' as const, title:'Проверьте чеки' },
    { kind:'checklist' as const, title:'Введите остаток по кассе' },
    { kind:'money' as const, title:'Оформите расходники в 1С' },
    { kind:'closing' as const, title:'Продолжите сдачу смены' },
  ];
  const sampleItems: EmployeeInboxItem[] = [
    { id:1,kind:'terminal_fiscal_review',title:'Проверьте чеки',body:'Нужно проверить чек по оплате.',readAt:null,href:'/employee',taskId:null,issueId:null,reviewId:'example',active:true },
    { id:2,kind:'planned',title:'Заполните чек-лист',body:'Введите остаток по кассе.',readAt:null,href:'/employee',taskId:1,issueId:null,reviewId:null,active:true },
    { id:3,kind:'employee_expense_payable',title:'Заявка к оплате',body:'Оформите расходник по заявке.',readAt:null,href:'/employee',taskId:null,issueId:null,reviewId:null,active:true },
    { id:4,kind:'workday_issue_reply',title:'Ответ администратора',body:'Посмотрите ответ по вашему вопросу.',readAt:null,href:'/employee',taskId:null,issueId:1,reviewId:null,active:true },
  ];
  return <main className={styles.page}>
    <Link href='/employee' className={styles.back}>← Рабочий день</Link>
    <h1>Как заметнее?</h1>
    <p className={styles.intro}>Одна задача — четыре варианта значка.</p>
    {options.map(option => <section key={option.id} className={styles.example}>
      <h2>{option.label}</h2>
      <ActionReminderNotice title='Проверьте чеки'
        icon={option.id === 'current' ? <ReminderBell /> : <span aria-hidden='true' className={`${styles.icon} ${option.id === 'movement' || option.id === 'combined' ? styles.movement : ''} ${option.id === 'copper' || option.id === 'combined' ? styles.copper : ''}`}><ReceiptText size={26} strokeWidth={1.8} /></span>}
        onOpen={() => setMessage('Это пример: здесь открылся бы список чеков.')}
        onDefer={() => setMessage('Это пример: рабочее напоминание не отложено.')} />
      <p className={styles.description}>{option.description}</p>
    </section>)}
    <h2>Выбранный вариант — по типам задач</h2>
    <p className={styles.description}>Примеры оформления, не реальные задания.</p>
    {examples.map(example => <section key={example.kind} className={styles.example}>
      <ActionReminderNotice title={example.title} icon={<EmployeeNoticeIcon kind={example.kind} animated />} onOpen={() => setMessage('Это пример оформления. Рабочие данные не меняются.')} onDefer={() => setMessage('Это пример: рабочее напоминание не отложено.')} />
    </section>)}
    <button type='button' className={styles.inboxButton} onClick={() => setInbox(true)}>Показать список уведомлений</button>
    {inbox && <EmployeeNotificationInbox items={sampleItems} onClose={() => setInbox(false)} onChoose={() => setMessage('Выбран пример уведомления. Рабочие данные не меняются.')} permission={<p className={styles.note}>Примеры оформления, не реальные уведомления.</p>} />}
    <p className={styles.note} aria-live='polite'>{message}</p>
  </main>;
}
