import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { workdayIssueView, issueSource } from '@/lib/workday-control-issue-view';
import { formatDateLabel, formatTime, getMoscowDateKey } from '@/lib/workday';
import { TerminalFiscalReviewConversation } from '@/components/TerminalFiscalReviewConversation';
import { WorkdayIssueDialogFrame } from './WorkdayIssueDialogFrame';
export async function WorkdayIssueDialog({id,date,currentUserId}:{id:number;date:string;currentUserId:number}) {
 const closeHref=`/admin/workday?date=${date}&control=all&view=attention#employees-control`;
 const issue=await prisma.workdayControlIssue.findUnique({where:{id},include:{user:{select:{name:true}},task:{select:{handoverData:true}},messages:{orderBy:{createdAt:'asc'},include:{author:{select:{id:true,name:true,role:true}}}},notifications:{where:{kind:'workday_issue_reply'},orderBy:{createdAt:'desc'},take:5}}});
 if(!issue)return <WorkdayIssueDialogFrame title="Замечание" closeHref={closeHref}><p>Замечание не найдено.</p></WorkdayIssueDialogFrame>;
 const view=workdayIssueView(issue),open=issue.status==='open'&&issue.employeeActionRequired,kkm=issue.ruleKey==='kkm_shift_not_closed';
 const siblings=await prisma.workdayControlIssue.findMany({where:{userId:issue.userId,status:'open',employeeActionRequired:true},orderBy:{detectedAt:'asc'}});
 const data=issueSource(issue.sourceData),handover=issueSource(issue.task?.handoverData),photos=issueSource(handover.photos),photo=issueSource(photos.zReport);
 const photoHref=typeof photo.storagePath==='string'?`/api/admin/workday/shift-control-photo?path=${encodeURIComponent(photo.storagePath)}`:'';
 const instruction=view.instruction.trim();
 const fallbackAmount=instruction.match(/([\d\s\u00a0]+)\s*₽/);
 const amount=view.amount || (fallbackAmount ? `${Number(fallbackAmount[1].replace(/\s/g,'' )).toLocaleString('ru-RU')} ₽` : '');
 const hasUsefulInstruction=/[А-Яа-яЁё]/.test(instruction) && instruction!==`${view.documentNumber} · ${view.amount}` && instruction!==view.summaryMeta;
 return <WorkdayIssueDialogFrame title={kkm?issue.title:'Чек по кредитной продаже'} closeHref={closeHref}>
  <div className="workday-issue-person"><b>{issue.user.name}</b><span className={`team-status ${open?'amber':'green'}`}>{open?view.verificationPending?'Не удалось проверить':'Исправляет сотрудник':'Закрыто'}</span></div>
  {siblings.length>1&&<nav className="workday-issue-switch" aria-label="Замечания сотрудника">{siblings.map(item=><Link key={item.id} aria-current={item.id===id?'page':undefined} href={`/admin/workday?date=${date}&control=all&view=attention&issue=${item.id}#employees-control`}>{workdayIssueView(item).documentNumber||`Замечание ${item.id}`}</Link>)}</nav>}
  <div className="workday-issue-document"><span>{kkm?'Касса':'Реализация'}</span><b>{kkm?String(data.cashRegisterName||'Не определена'):view.documentNumber||'Номер не указан'}</b>{!kkm&&<strong>{amount||'Сумма не указана'}</strong>}</div>
  <section className="workday-issue-explanation"><h3>Что нужно проверить</h3><p>{view.verificationPending?'Повторная проверка не завершена. Предыдущее замечание остаётся на контроле.':kkm?issue.detail:hasUsefulInstruction?instruction:'Причина не указана. Проверьте чек в 1С.'}</p></section>
  {kkm&&<details><summary>Фото чека закрытия</summary>{photoHref?<a href={photoHref} target="_blank" rel="noreferrer"><img className="workday-issue-photo" src={photoHref} alt="Чек закрытия смены"/><small>Нажмите, чтобы увеличить</small></a>:<p>Фото не приложено.</p>}</details>}
  <details><summary>Даты и сведения проверки</summary><dl><dt>Возникло</dt><dd>{formatDateLabel(issue.originDate)}</dd><dt>Последняя автопроверка</dt><dd>{formatDateLabel(getMoscowDateKey(issue.lastDetectedAt))} · {formatTime(issue.lastDetectedAt)}</dd>{view.receiptCashierName&&<><dt>Кассир чека</dt><dd>{view.receiptCashierName}</dd></>}{view.receiptDelayMinutes!==null&&<><dt>Задержка чека</dt><dd>{view.receiptDelayMinutes} мин</dd></>}{kkm&&<><dt>ККТ</dt><dd>{String(data.kktRegistrationNumber||'Не определена')}</dd><dt>Источники</dt><dd>{String(data.sourceError||issue.detail)}</dd></>}</dl>{issue.notifications.map(n=><p key={n.id}>{n.readAt?'Сообщение прочитано':n.pushStatus==='delivered'?'Доставлено на устройство':n.pushStatus==='no_subscription'?'Сообщение доступно в портале':n.status==='pending'?'Ожидает отправки':'Сообщение сохранено'}</p>)}</details>
  <section className="workday-issue-conversation"><h3>Переписка</h3><TerminalFiscalReviewConversation key={issue.id} initialMessages={issue.messages.map(message=>({...message,createdAt:message.createdAt.toISOString()}))} currentUserId={currentUserId} endpoint={`/api/admin/workday/issues/${issue.id}/messages`} disabled={!open}/></section>
  {open&&issue.ruleKey==='credit_realization_mismatch'&&<details><summary>Дополнительные действия</summary><form action={`/api/admin/workday/issues/${issue.id}/dismiss`} method="post"><button className="team-button" type="submit">Снять как тестовую проверку</button><p>Только для ошибочно созданной тестовой проверки.</p></form></details>}
 </WorkdayIssueDialogFrame>;
}
