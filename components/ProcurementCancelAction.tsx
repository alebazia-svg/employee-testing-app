'use client';
import {useState} from 'react';
export function ProcurementCancelAction({id,version,admin=false,disabled=false,onSaved}:{id:string;version?:string;admin?:boolean;disabled?:boolean;onSaved:(plan:any)=>void}) {
  const [confirm,setConfirm]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
  async function save(){
    if(busy||disabled||!version)return;
    setBusy(true);setError('');
    try{
      const url=admin?'/api/admin/procurement/payment-plans/'+id:'/api/procurement/payment-plans/'+id+'/cancel';
      const res=await fetch(url,{method:admin?'PATCH':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'CANCEL',version})});
      const plan=await res.json();
      if(!res.ok)throw Error(plan.error||'Не удалось отменить заявку.');
      onSaved(plan);
    }catch(e){setError(e instanceof Error?e.message:'Не удалось проверить оплату.');}
    finally{setBusy(false);}
  }
  return <div className="space-y-2">{confirm?<><p className="text-sm">Убрать заявку из текущих оплат? Запись останется в истории.</p><div className="flex gap-2"><button type="button" className="pam-button" disabled={busy} onClick={()=>{setConfirm(false);setError('');}}>Назад</button><button type="button" className="pam-button" disabled={disabled||busy} onClick={save}>{busy?'Проверяем оплату…':'Подтвердить отмену'}</button></div></>:<button type="button" className="pam-cancel" disabled={disabled||!version} onClick={()=>setConfirm(true)}>Отменить заявку</button>}{error&&<p role="alert" className="text-sm text-red-700">{error}</p>}</div>;
}
