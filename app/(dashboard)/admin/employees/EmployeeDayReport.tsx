'use client';
import { Fragment, useState } from 'react';
import { AlertTriangle, Check, ChevronDown, MousePointer2 } from 'lucide-react';
import type { EmployeeActivityReport } from '@/lib/employee-activity-report';
import type { AuditEpisode, AuditStep } from '@/lib/employee-audit-timeline';
export const activityTime = (value: string) => new Date(value).toLocaleTimeString('ru-RU', { timeZone: 'Europe/Moscow', hour: '2-digit', minute: '2-digit', second: '2-digit' });
const shortTime = (value: string) => activityTime(value).slice(0, 5);

function describe(item: AuditEpisode, step: AuditStep) {
  const place = item.visits ? item.title : step.opened === 'notification' || step.label === 'Уведомление отправлено' || step.label === 'Сообщение появилось в видимой области приложения' ? 'Уведомления' : item.id.startsWith('cash:') ? 'Выдача денег' : item.id.startsWith('handover:') ? 'Сдача смены' : item.id.startsWith('notification:') ? 'Уведомления' : 'Проверка чека';
  const labels: Record<string, [string, string]> = {
    'Уведомление отправлено': ['Система отправила уведомление', ''],
    'Сообщение появилось в видимой области приложения': ['Уведомление показалось в приложении', ''],
    'Открыл уведомление': ['Открыл уведомление', 'Открытие записано'],
    'Открыл карточку': ['Открыл карточку', ''],
    'Закрыл карточку': ['Закрыл карточку', ''],
    'Нажал ответ о ненайденном документе': ['Выбрал ответ: документ не найден', ''],
    'Приложение получило подтверждение сохранения ответа': ['Получил подтверждение отправки', 'Ответ сохранён'],
    'Не удалось отправить. Попробуйте ещё раз.': ['На экране появилась ошибка', 'Отправка не подтверждена'],
    'На экране показана ошибка': ['На экране появилась ошибка', 'Текст не записан'],
    'Открыта форма сдачи смены': ['Открыл сдачу смены', ''],
    'Запущена сдача смены': ['Нажал «Сдать смену»', ''],
    'На экране показано: «Проверяем кассу…»': ['На экране — проверка кассы', 'Ожидание'],
    'Закрытие ККМ подтверждено системой': ['Система проверила закрытие ККМ', 'ККМ закрыта'],
  };
  const [action, outcome] = item.visits ? ['Открыл раздел', ''] : labels[step.label] || [step.label, ''];
  return { place, action, outcome };
}

export default function EmployeeDayReport({ data }: { data: EmployeeActivityReport }) {
  const [filter, setFilter] = useState('all');
  const [expanded, setExpanded] = useState<string | null>(null);
  const items = data.audit || [];
  const source = items.flatMap(item => item.steps.map(step => ({ item, step, ...describe(item, step) }))).sort((a, b) => a.step.at.localeCompare(b.step.at));
  const all: (typeof source[number] & { followUp?: AuditStep })[] = [];
  const attempts = new Set(['Отправил ответ', 'Нажал ответ о ненайденном документе', 'Нажал «Операция не моя»', 'Нажал отмену ответа «Не моя операция»']);
  // Keep the immediate UI response beside its click, retaining both exact events in details.
  // Never combine a server/1C result, another object, or a delayed response.
  for (let i = 0; i < source.length; i++) {
    const row = source[i], next = source[i + 1];
    const elapsed = next ? Date.parse(next.step.at) - Date.parse(row.step.at) : -1;
    if (attempts.has(row.step.label) && next?.item.id === row.item.id && next.step.origin === 'app' && elapsed >= 0 && elapsed < 10000 && ['Не удалось отправить. Попробуйте ещё раз.', 'На экране показана ошибка', 'Приложение получило подтверждение сохранения ответа'].includes(next.step.label)) {
      all.push({ ...row, outcome: next.outcome, followUp: next.step }); i++;
    } else all.push(row);
  }
  const visible = all.filter(row => filter === 'all' || (filter === 'problems' ? ['error', 'warning'].includes((row.followUp || row.step).tone) : row.place === 'Уведомления'));
  const pending = data.obligations.filter(item => item.attention === 'employee' || item.attention === 'owner');
  return <>
    {pending.length > 0 && <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50/60 px-4 py-3"><p className="text-sm font-semibold text-amber-950">Осталось в работе</p>{pending.map(item => <p key={item.id} className="mt-1 text-sm text-amber-950">{item.title} — {item.openedAt ? `открыто в ${shortTime(item.openedAt)}, ` : ''}{item.result.toLowerCase()}.</p>)}</div>}
    <nav aria-label="Действия сотрудника" className="admin-section-tabs mb-3">
      {([['all', 'Все действия'], ['problems', 'Ошибки и предупреждения'], ['notifications', 'Уведомления']] as const).map(([key, title]) => <button key={key} onClick={() => { setFilter(key); setExpanded(null); }} className={`admin-section-tab ${filter === key ? 'is-active' : ''}`} aria-pressed={filter === key}>{title}</button>)}
    </nav>
    <p className="mb-3 text-xs text-slate-500">По порядку в течение дня · время московское</p>
    {data.truncated && <p role="status" className="mb-3 rounded-lg bg-amber-50 p-3 text-sm">Достигнут лимит журнала. Показана часть событий.</p>}
    {visible.length ? <div role="table" aria-label="Ход работы в приложении" className="overflow-hidden rounded-xl border border-slate-200">
      <div role="row" className="hidden grid-cols-[60px_125px_minmax(0,1fr)_170px_20px] gap-3 border-b border-slate-200 bg-stone-50 px-4 py-2.5 text-xs font-semibold text-slate-500 sm:grid">
        {['Время', 'Где', 'Что произошло', 'Результат', ''].map((label, i) => <span role="columnheader" key={i}>{label}</span>)}
      </div>
      {visible.map(({ item, step, place, action, outcome, followUp }) => {
        const tone = (followUp || step).tone;
        const key = `${item.id}:${step.id}`;
        const problem = tone === 'error' || tone === 'warning';
        const colored = tone === 'error' ? 'text-red-800' : tone === 'warning' ? 'text-amber-900' : tone === 'success' ? 'text-emerald-800' : 'text-slate-600';
        const details = !item.visits;
        return <Fragment key={key}>
          <div role="row" className={`grid grid-cols-[48px_minmax(0,1fr)_20px] items-start gap-x-3 gap-y-1 border-b border-slate-100 px-3 py-2.5 last:border-b-0 sm:grid-cols-[60px_125px_minmax(0,1fr)_170px_20px] sm:px-4 ${problem ? tone === 'error' ? 'bg-red-50/60' : 'bg-amber-50/60' : 'bg-white'}`}>
            <time role="cell" title={activityTime(step.at)} className="row-span-3 pt-0.5 text-xs tabular-nums text-slate-500 sm:row-span-1">{shortTime(step.at)}</time>
            <span role="cell" className="text-xs text-slate-500 sm:pt-0.5">{place}</span>
            <div role="cell" className="col-start-2 min-w-0 text-sm sm:col-auto"><p className={item.visits ? 'text-slate-600' : 'font-medium text-slate-900'}>{action}</p>{!item.visits && <p className="mt-0.5 break-words text-xs text-slate-500">{item.title}</p>}</div>
            <span role="cell" className={`col-start-2 flex items-start gap-1.5 text-xs sm:col-auto sm:pt-0.5 ${colored}`}>{problem ? <AlertTriangle size={13} className="mt-0.5 shrink-0"/> : tone === 'success' ? <Check size={14} className="shrink-0"/> : null}{outcome || (problem ? step.label : <span className="hidden text-slate-300 sm:inline">—</span>)}</span>
            <span role="cell" className="col-start-3 row-start-1 sm:col-auto sm:row-auto">{details && <button aria-label={`Подробности: ${shortTime(step.at)}, ${action}`} aria-expanded={expanded === key} onClick={() => setExpanded(expanded === key ? null : key)} className="-m-2 flex h-9 w-9 items-center justify-center rounded-md text-[#996744] hover:bg-[#f5e8dc]"><ChevronDown size={15} className={expanded === key ? 'rotate-180' : ''}/></button>}</span>
          </div>
          {expanded === key && <div role="row" className="border-b border-slate-200 bg-stone-50 px-4 py-3 sm:pl-[92px]"><div role="cell" className="space-y-1 text-xs leading-5 text-slate-600"><p>{activityTime(step.at)} · {step.origin === 'system' ? 'Запись системы' : 'Запись из приложения сотрудника'}</p>{item.notice && <p><strong className="font-medium">Сообщение: </strong>{item.notice}</p>}{step.note && <p>{step.note}</p>}{followUp && <><p>{activityTime(followUp.at)} · {followUp.label}</p>{followUp.note && <p>{followUp.note}</p>}</>}</div></div>}
        </Fragment>;
      })}
    </div> : <div className="rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center"><MousePointer2 className="mx-auto mb-3 text-[#996744]" size={24}/><p className="font-semibold text-slate-800">{filter === 'all' ? 'За этот день записей пока нет' : 'Таких событий не записано'}</p><p className="mt-2 text-sm text-slate-500">Отсутствие записи не означает, что сотрудник не работал.</p></div>}
    <details className="mt-4 text-xs leading-5 text-slate-500"><summary className="cursor-pointer">О данных журнала</summary><p className="mt-2">Открытие не доказывает прочтение. Сохранённый ответ не подтверждает исправление в 1С. Системное событие не всегда устанавливает автора действия.</p><p className="mt-2">Собираются только подключённые действия. При потере связи часть событий может не сохраниться. Длительность просмотра и другие приложения не отслеживаются. Хранение: {data.retentionDays} дней.</p></details>
  </>;
}
