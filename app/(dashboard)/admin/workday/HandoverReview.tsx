'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
export type HandoverReviewState = {taskId:number;review:{id:number;reviewedAt:string;reviewedBy:string}|null};
function timestamp(value:string) {
  return new Intl.DateTimeFormat('ru-RU',{timeZone:'Europe/Moscow',day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'}).format(new Date(value));
}
export function HandoverReview({state,closedAt,reason,children}:{state:HandoverReviewState;closedAt:string;reason:string|null;children?:ReactNode}) {
  const router=useRouter();
  const [review,setReview]=useState(state.review);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  useEffect(()=>{setReview(state.review);setError('');},[state.taskId,state.review]);
  async function acknowledge() {
    if(saving||review)return;
    setSaving(true);setError('');
    try {
      const response=await fetch('/api/admin/workday/handover-review',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({taskId:state.taskId})});
      const payload=await response.json().catch(()=>null);
      if(!response.ok||!payload?.review)throw new Error(payload?.error||'Не удалось сохранить проверку. Повторите попытку.');
      setReview(payload.review);
      window.dispatchEvent(new Event('workday-handover-reviewed'));
      router.refresh();
    } catch(e) {setError(e instanceof Error && !(e instanceof TypeError)?e.message:'Не удалось сохранить проверку. Повторите попытку.');}
    finally {setSaving(false);}
  }
  return <section id="shift-handover-review" className="team-review-row team-handover is-pending">
    <header><b>Завершение рабочего дня</b><span className="team-status amber">Сдача не заполнена</span></header>
    <div className="team-handover-review-status">
      <p>День закрыт {timestamp(closedAt)}</p>
      {reason&&<p>Причина: «{reason}»</p>}
      {review?<p role="status">Проверено · {review.reviewedBy} · {timestamp(review.reviewedAt)}</p>:<button type="button" className="team-button" disabled={saving} onClick={acknowledge}>{saving?'Сохраняю…':'Проверено'}</button>}
      {error&&<p role="alert">{error}</p>}
      {children}
    </div>
  </section>;
}
