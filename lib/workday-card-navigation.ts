import type { MouseEvent } from 'react';
export type WorkdayCardTarget = { employeeId:number; focus:string|null };
export const WORKDAY_CARD_OPEN = 'workday:open-employee';
export function workdayCardTarget(href:string,date:string):WorkdayCardTarget|null {
 const url=new URL(href,'http://local');
 const id=url.searchParams.get('employee');
 if(url.pathname!=='/admin/workday'||url.searchParams.get('date')!==date||!id||!/^\d+$/.test(id)||Number(id)<1)return null;
 return {employeeId:Number(id),focus:url.searchParams.get('focus')};
}
export function openWorkdayCard(event:MouseEvent<HTMLAnchorElement>,date:string){
 if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
 const target=workdayCardTarget(event.currentTarget.href,date);
 if(!target)return;
 event.preventDefault();
 window.history.replaceState(window.history.state,'',event.currentTarget.href);
 window.dispatchEvent(new CustomEvent<WorkdayCardTarget>(WORKDAY_CARD_OPEN,{detail:target}));
}
