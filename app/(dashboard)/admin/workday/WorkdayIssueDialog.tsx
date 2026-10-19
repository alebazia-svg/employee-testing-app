'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AdminWorkdayIssueDetail } from '@/lib/admin-workday-issue-detail';
import { workdayIssueLocation, workdayIssueTarget } from '@/lib/workday-issue-navigation';
import { WORKDAY_CARD_OPEN, type WorkdayCardTarget } from '@/lib/workday-card-navigation';
import { TerminalFiscalReviewConversation } from '@/components/TerminalFiscalReviewConversation';
import { WorkdayIssueDialogFrame } from './WorkdayIssueDialogFrame';

export function WorkdayIssueDialog({id,date,currentUserId}:{id?:number;date:string;currentUserId:number}) {
 const [selected,setSelected]=useState<number|null>(id??null),[detail,setDetail]=useState<AdminWorkdayIssueDetail|null>(null);
 const [error,setError]=useState(''),[retry,setRetry]=useState(0),[discard,setDiscard]=useState(false);
 const dialog=useRef<HTMLDialogElement>(null),pending=useRef<(()=>void)|null>(null),selectedRef=useRef(selected);
 const returnHref=useRef(''),displayHref=useRef(''),openedHere=useRef(false),approvedPop=useRef(false),opener=useRef<HTMLElement|null>(null);
 selectedRef.current=selected;
 const apply=useCallback((next:number|null)=>{
  selectedRef.current=next;setSelected(next);if(next===null)setDetail(null);setError('');setDiscard(false);pending.current=null;
  if(next!==null)window.dispatchEvent(new CustomEvent<WorkdayCardTarget>(WORKDAY_CARD_OPEN,{detail:{employeeId:0,focus:null}}));
  else requestAnimationFrame(()=>{if(opener.current?.isConnected)opener.current.focus({preventScroll:true});});
 },[]);
 const request=useCallback((action:()=>void)=>{
  if(dialog.current?.querySelector('[aria-busy="true"]'))return;
  if(dialog.current?.querySelector<HTMLTextAreaElement>('textarea:not(:disabled)')?.value.trim()){pending.current=action;setDiscard(true);return;}
  action();
 },[]);
 const openIssue=useCallback((next:number)=>request(()=>{
  if(selectedRef.current===next)return;
  const current=window.location.href,href=workdayIssueLocation(current,next);
  if(selectedRef.current===null){
   returnHref.current=workdayIssueLocation(current,null);opener.current=document.activeElement as HTMLElement;
   openedHere.current=true;window.history.replaceState({},'',returnHref.current);window.history.pushState({workdayIssue:true},'',href);
  }else window.history.replaceState({workdayIssue:window.history.state?.workdayIssue},'',href);
  displayHref.current=window.location.href;apply(next);
 }),[request,apply]);
 const close=()=>request(()=>{
  if(openedHere.current&&window.history.state?.workdayIssue){approvedPop.current=true;window.history.back();return;}
  window.history.replaceState({workdayIssue:window.history.state?.workdayIssue},'',returnHref.current||workdayIssueLocation(window.location.href,null));apply(null);
 });
 useEffect(()=>{
  if(!returnHref.current)returnHref.current=workdayIssueLocation(window.location.href,null);
  displayHref.current=window.location.href;
  const click=(event:MouseEvent)=>{
   if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
   const link=event.target instanceof Element?event.target.closest<HTMLAnchorElement>('a[href]'):null;
   if(!link||link.target&&link.target!=='_self'||link.hasAttribute('download'))return;
   const next=workdayIssueTarget(link.href,window.location.href,date);
   if(next===null)return;
   event.preventDefault();openIssue(next);
  };
  const pop=()=>{
   const destination=window.location.href,url=new URL(destination);
   if(url.pathname!=='/admin/workday'||(url.searchParams.get('date')??date)!==date)return;
   const next=workdayIssueTarget(destination,destination,date);
   if(next===selectedRef.current)return;
   const approved=approvedPop.current;approvedPop.current=false;
   if(!approved&&dialog.current?.querySelector<HTMLTextAreaElement>('textarea:not(:disabled)')?.value.trim()){
    window.history.replaceState({workdayIssue:window.history.state?.workdayIssue},'',displayHref.current);
    request(()=>{window.history.replaceState({workdayIssue:window.history.state?.workdayIssue},'',destination);displayHref.current=destination;apply(next);});
   }else{displayHref.current=destination;apply(next);}
  };
  const leave=(event:BeforeUnloadEvent)=>{if(dialog.current?.querySelector<HTMLTextAreaElement>('textarea:not(:disabled)')?.value.trim()){event.preventDefault();event.returnValue='';}};
  document.addEventListener('click',click,true);window.addEventListener('popstate',pop);window.addEventListener('beforeunload',leave);
  return()=>{document.removeEventListener('click',click,true);window.removeEventListener('popstate',pop);window.removeEventListener('beforeunload',leave);};
 },[date,openIssue,apply,request]);
 useEffect(()=>{
  if(selected===null)return;
  const abort=new AbortController();setError('');
  fetch(`/api/admin/workday/issues/${selected}`,{cache:'no-store',signal:abort.signal})
   .then(async response=>{const body=await response.json();if(!response.ok)throw Error(response.status===404?'Замечание не найдено.':response.status===403?'Нет доступа. Войдите в портал заново.':'Не удалось загрузить замечание.');return body as AdminWorkdayIssueDetail;})
   .then(body=>{if(!abort.signal.aborted)setDetail(body);})
   .catch(error=>{if(!abort.signal.aborted)setError(error instanceof Error?error.message:'Не удалось загрузить замечание.');});
  return()=>abort.abort();
 },[selected,retry]);
 if(selected===null)return null;
 // Keep the displayed receipt intact until its replacement is ready.
 const switching=detail!==null&&detail.id!==selected;
 return <WorkdayIssueDialogFrame title={detail?.title??'Замечание'} onClose={close} dialogRef={dialog} loading={switching&&!error}>
  {discard&&<div className="workday-issue-discard" role="alert"><b>Сообщение не отправлено</b><p>Перейти без отправки? Черновик будет удалён.</p><button className="team-button" onClick={()=>{pending.current=null;setDiscard(false);}}>Продолжить</button> <button className="team-button" onClick={()=>{const action=pending.current;pending.current=null;setDiscard(false);action?.();}}>Продолжить без отправки</button></div>}
  <div hidden={discard}>
   {!detail&&!error&&<p role="status">Загружаем замечание…</p>}
   {error&&<div role="alert"><p>{error}</p><button type="button" className="team-button" onClick={()=>setRetry(value=>value+1)}>Повторить загрузку</button></div>}
   {detail&&<>
    <div className="workday-issue-person"><b>{detail.userName}</b><span className={`team-status ${detail.open?'amber':'green'}`}>{detail.state}</span></div>
    {detail.siblings.length>1&&<nav className="workday-issue-switch" aria-label="Замечания сотрудника">{detail.siblings.map(item=><a key={item.id} aria-current={item.id===detail.id?'page':undefined} href={`/admin/workday?date=${date}&control=all&issue=${item.id}#employees-control`}>{item.label}</a>)}</nav>}
    <div className="workday-issue-document"><span>{detail.kkm?'Касса':'Реализация'}</span><b>{detail.document}</b>{!detail.kkm&&<strong>{detail.amount}</strong>}</div>
    <section className="workday-issue-explanation"><h3>Что нужно проверить</h3><p>{detail.instruction}</p></section>
    {detail.kkm&&<details><summary>Фото чека закрытия</summary>{detail.photoHref?<a href={detail.photoHref} target="_blank" rel="noreferrer"><img className="workday-issue-photo" src={detail.photoHref} alt="Чек закрытия смены"/><small>Нажмите, чтобы увеличить</small></a>:<p>Фото не приложено.</p>}</details>}
    <details><summary>Даты и сведения проверки</summary><dl><dt>Возникло</dt><dd>{detail.origin}</dd><dt>Последняя автопроверка</dt><dd>{detail.checked}</dd>{detail.receiptCashierName&&<><dt>Кассир чека</dt><dd>{detail.receiptCashierName}</dd></>}{detail.receiptDelayMinutes!==null&&<><dt>Задержка чека</dt><dd>{detail.receiptDelayMinutes} мин</dd></>}{detail.kkm&&<><dt>ККТ</dt><dd>{detail.kkt}</dd><dt>Источники</dt><dd>{detail.source}</dd></>}</dl>{detail.deliveries.map((label,index)=><p key={index}>{label}</p>)}</details>
    <fieldset disabled={switching} style={{border:0,padding:0,margin:0,minWidth:0}}><section className="workday-issue-conversation"><h3>Переписка</h3><TerminalFiscalReviewConversation key={detail.id} initialMessages={detail.messages} currentUserId={currentUserId} endpoint={`/api/admin/workday/issues/${detail.id}/messages`} disabled={!detail.open}/></section>
    {detail.canDismiss&&<details><summary>Дополнительные действия</summary><form action={`/api/admin/workday/issues/${detail.id}/dismiss`} method="post"><button className="team-button" type="submit">Снять как тестовую проверку</button><p>Только для ошибочно созданной тестовой проверки.</p></form></details>}
    </fieldset>
   </>}
  </div>
 </WorkdayIssueDialogFrame>;
}
