'use client';

import React,{useEffect,useId,useRef,useState,type ReactNode} from 'react';
import {CalendarDays,ChevronRight,Search,X} from 'lucide-react';
import type {ProcurementListItem} from './ProcurementSplitList';
import './procurement-admin-list.css';

type Item=ProcurementListItem&{dateLabel?:string;basis?:string;method?:string;priority?:string;amountCaption?:string};
type Props={items:Item[];renderDetail:(id:string)=>ReactNode;renderFooter?:(id:string,close:()=>void)=>ReactNode;empty?:string;dirty?:boolean;busy?:boolean;onClose?:()=>void;onOpen?:(id:string)=>void;error?:string;history?:boolean;searchQuery?:string;openItemId?:string};

export function ProcurementAdminList({items,renderDetail,renderFooter,empty='Записей нет.',dirty=false,busy=false,onClose,onOpen,error,history=false,searchQuery,openItemId}:Props){
  const [localQuery,setQuery]=useState('');
  const query=searchQuery??localQuery;
  const [selected,setSelected]=useState('');
  useEffect(()=>{if(openItemId)setSelected(openItemId);},[openItemId]);
  const selectedItem=items.find(item=>item.id===selected);
  const filtered=items.filter(item=>`${item.name} ${item.search||''} ${item.basis||''}`.toLocaleLowerCase('ru').includes(query.trim().toLocaleLowerCase('ru')));
  const close=()=>{setSelected('');onClose?.();};
  // A successful action or server refresh may move the selected request to another tab.
  useEffect(()=>{if(selected&&!selectedItem){setSelected('');onClose?.();}},[selected,selectedItem,onClose]);
  return <div className="pam-list-workspace">
    {searchQuery===undefined?<label className="pam-search"><Search size={17}/><input type="search" aria-label="Найти поставщика или заказ" placeholder="Поставщик или № заказа" value={query} onChange={e=>setQuery(e.target.value)}/></label>:null}
    <section className="pam-list" aria-label="Список оплат">
      <div className="pam-columns"><span>{history?'Оплачено':'Подготовить к'}</span><span>Поставщик / основание</span><span className="pam-amount">Сумма</span><span>Способ оплаты</span><span/></div>
      {filtered.map((item,index)=><React.Fragment key={item.id}>
        {item.group&&item.group!==filtered[index-1]?.group?<h3 className="pam-group" data-priority={item.priority}>{item.group}<span>{filtered.filter(row=>row.group===item.group).length}</span></h3>:null}
        <button type="button" className="pam-row" aria-label={`Подробности оплаты ${item.name}`} onClick={()=>{setSelected(item.id);onOpen?.(item.id);}}>
          <span className="pam-date" data-priority={item.priority}><CalendarDays size={16}/>{item.dateLabel||item.meta}</span>
          <span className="pam-supplier"><strong>{item.name}</strong><small>{item.basis||item.search}</small>{item.warning?<small className="pam-warning" data-neutral={item.warningTone==='neutral'}>{item.warning}</small>:null}</span>
          <strong className="pam-amount">{item.amountCaption?<span className="block text-xs font-medium text-slate-500">{item.amountCaption}</span>:null}{item.amount}</strong><span className="pam-method">{item.method||''}</span><ChevronRight className="pam-chevron" size={17}/>
        </button>
      </React.Fragment>)}
      {!filtered.length?<p className="pam-empty">{query?'Ничего не найдено. Измените поиск.':empty}</p>:null}
    </section>
    {selectedItem?<PaymentDialog key={selectedItem.id} close={close} dirty={dirty} busy={busy} footer={requestClose=>renderFooter?renderFooter(selectedItem.id,requestClose):<button className="pam-button" onClick={requestClose}>Закрыть</button>}>
      {error?<p role="alert" className="pam-error">{error}</p>:null}
      {renderDetail(selectedItem.id)}
    </PaymentDialog>:null}
  </div>;
}

function PaymentDialog({children,close,footer,dirty,busy}:{children:ReactNode;close:()=>void;footer:(close:()=>void)=>ReactNode;dirty:boolean;busy:boolean}){
  const ref=useRef<HTMLDialogElement>(null),title=useId();
  const [discard,setDiscard]=useState(false);
  const requestClose=()=>{if(busy)return;if(dirty)setDiscard(true);else close();};
  useEffect(()=>{
    const dialog=ref.current!,opener=document.activeElement as HTMLElement|null,overflow=document.body.style.overflow;
    dialog.showModal();document.body.style.overflow='hidden';
    return()=>{dialog.close();document.body.style.overflow=overflow;requestAnimationFrame(()=>opener?.isConnected&&opener.focus({preventScroll:true}));};
  },[]);
  return <dialog ref={ref} className="pam-dialog" aria-labelledby={title} onCancel={e=>{e.preventDefault();requestClose();}} onClick={e=>{
    if(e.target!==e.currentTarget)return;const r=e.currentTarget.getBoundingClientRect();
    if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)requestClose();
  }}>
    <header className="pam-dialog-heading"><h2 id={title}>Заявка на оплату</h2><button type="button" disabled={busy} aria-label="Закрыть окно" onClick={requestClose}><X size={21}/></button></header>
    <div className="pam-dialog-content">{discard?<><h3>Закрыть без сохранения?</h3><p>Введённые изменения не сохранятся.</p></>:null}<div hidden={discard}>{children}</div></div>
    <div className="pam-dialog-footer">{discard?<><button type="button" className="pam-button" onClick={()=>setDiscard(false)}>Продолжить редактирование</button><button type="button" className="pam-button pam-primary" onClick={close}>Не сохранять</button></>:footer(requestClose)}</div>
  </dialog>;
}
