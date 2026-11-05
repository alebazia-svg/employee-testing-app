'use client';
import React,{useEffect,useRef,useState} from 'react';
import {X,Paperclip} from 'lucide-react';
import {RECEIPT_MAX_BYTES} from '@/lib/procurement-receipt-policy';
import {procurementFileSize} from '@/lib/procurement-file-size';

type Props={method:string;supplier:string;disabled:boolean;initialText?:string;initialNetwork?:string;existingFileName?:string;
  onSaveText?:(text:string,network:string)=>Promise<boolean>;
  onSaveFile:(file:File)=>Promise<boolean>;
  onClose:()=>void};

/** One entry for text and/or a payment image; existing endpoints own persistence. */
export function ProcurementRequisitesEditor({method,supplier,disabled,initialText='',initialNetwork,existingFileName,onSaveText,onSaveFile,onClose}:Props){
  const dialog=useRef<HTMLDialogElement>(null),input=useRef<HTMLInputElement>(null);
  const [text,setText]=useState(initialText),[network,setNetwork]=useState(initialNetwork??(method==='USDT'?'TRC20':''));
  const [file,setFile]=useState<File|null>(null),[error,setError]=useState('');
  const [saving,setSaving]=useState(false),[textSaved,setTextSaved]=useState(false);
  const lock=useRef(false);
  useEffect(()=>{dialog.current?.showModal();return()=>dialog.current?.close();},[]);
  const busy=disabled||saving;
  const qr=['USDT','CNY'].includes(method);
  const textChanged=!!text.trim()&&(text.trim()!==initialText.trim()||network!==(initialNetwork??(method==='USDT'?'TRC20':'')));
  const hasChanges=textChanged||!!file;
  async function save(){
    if(busy||lock.current||!hasChanges)return;
    lock.current=true;setSaving(true);setError('');
    try{
      if(textChanged&&!textSaved){
        if(!onSaveText||!await onSaveText(text.trim(),method==='USDT'?network.trim():'')){
          setError('Реквизиты не сохранены. Данные остались в окне — повторите попытку.');return;
        }
        setTextSaved(true);
      }
      if(file&&!await onSaveFile(file)){
        setError(text.trim()?'Текст сохранён. Файл не сохранён — повторите отправку файла.':'Файл не сохранён. Повторите отправку.');return;
      }
      onClose();
    }catch{setError('Сохранение не подтверждено. Повторите попытку.');}
    finally{lock.current=false;setSaving(false);}
  }
  return <dialog ref={dialog} className="procurement-receipts-dialog requisites-editor-dialog" aria-labelledby="requisites-editor-title"
    onCancel={event=>{event.preventDefault();if(!busy)onClose();}}>
    <header><div><h2 id="requisites-editor-title">{initialText||existingFileName?'Изменить реквизиты':'Добавить реквизиты'}</h2><p className="mt-1 text-sm text-slate-600">{supplier}</p></div>
      <button type="button" className="procurement-receipt-button" aria-label="Закрыть реквизиты" disabled={busy} onClick={onClose}><X size={18}/></button></header>
    <form className="requisites-editor-form" onSubmit={event=>{event.preventDefault();void save();}}>
      {onSaveText?<label className="requisites-editor-field">{method==='USDT'?'Адрес кошелька':method==='CNY'?'ID получателя Alipay':'Реквизиты получателя'}
        <textarea autoFocus rows={2} maxLength={2000} value={text} disabled={busy||textSaved} onChange={e=>setText(e.target.value)}
          placeholder={method==='USDT'?'Вставьте адрес кошелька':method==='CNY'?'Вставьте ID получателя':'Телефон или счёт, банк и получатель'}/>
      </label>:null}
      {method==='USDT'&&text.trim()?<div className="payment-network-fields"><label className="requisites-editor-field">Сеть
        <select value={['TRC20','ERC20','BEP20'].includes(network)?network:'OTHER'} disabled={busy||textSaved} onChange={e=>setNetwork(e.target.value==='OTHER'?'':e.target.value)}>
          <option value="TRC20">TRC20 (Tron)</option><option value="ERC20">ERC20 (Ethereum)</option><option value="BEP20">BEP20 (BNB Smart Chain)</option><option value="OTHER">Другая сеть</option>
        </select></label>{!['TRC20','ERC20','BEP20'].includes(network)?<label className="requisites-editor-field">Название сети<input maxLength={60} value={network} disabled={busy||textSaved} onChange={e=>setNetwork(e.target.value)}/></label>:null}</div>:null}
      <div className="requisites-editor-attachment"><span>{qr?'QR-код для оплаты':'Файл с реквизитами'}</span>
        {existingFileName&&!file?<details className="text-sm font-normal text-slate-600"><summary>Текущий файл</summary><p className="mt-2 break-words">{existingFileName}</p></details>:null}
        {file?<div className="requisites-editor-file"><span>{file.name}<small>{procurementFileSize(file.size)}</small></span><button type="button" disabled={busy} className="procurement-receipt-button" onClick={()=>setFile(null)}>Убрать</button></div>:null}
        <button type="button" disabled={busy} className="procurement-receipt-button" onClick={()=>input.current?.click()}><Paperclip size={16}/>{file?'Заменить':'Выбрать файл'}</button>
        <p className="text-sm font-normal text-slate-600">JPG, PNG, WebP или PDF · до 10 МБ</p>
      </div>
      {error?<p role="alert" className="text-sm text-red-700">{error}</p>:null}
      {saving?<p role="status" className="text-sm">Сохраняем реквизиты…</p>:null}
      <footer className="requisites-editor-footer"><button type="button" disabled={busy} className="procurement-receipt-button" onClick={onClose}>Отмена</button><button type="submit" className="procurement-receipt-button requisites-editor-save" disabled={busy||!hasChanges||(method==='USDT'&&!!text.trim()&&!network.trim())}>Сохранить</button></footer>
      <input hidden ref={input} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={event=>{
        const chosen=event.currentTarget.files?.[0];event.currentTarget.value='';if(!chosen)return;
        if(!['image/jpeg','image/png','image/webp','application/pdf'].includes(chosen.type)||chosen.size<=0||chosen.size>RECEIPT_MAX_BYTES){setError('Выберите фото JPG, PNG, WebP или PDF до 10 МБ.');return;}
        setFile(chosen);setError('');
      }}/>
    </form>
  </dialog>;
}
