'use client';
import React,{useEffect,useRef,useState} from 'react';
import {AlertTriangle,Check,FileText,Paperclip,Plus,QrCode,Upload,X} from 'lucide-react';
import {ProcurementAdminList} from '@/components/ProcurementAdminList';
import {ProcurementAdminComment} from '@/components/ProcurementAdminComment';
import {ProcurementChangeHistory} from '@/components/ProcurementChangeHistory';
import {AdminShell} from '@/components/AdminShell';
import {AdminIdentityProvider} from '@/components/AdminIdentityProvider';
import AdminProcurementClient from '../(dashboard)/admin/procurement/AdminProcurementClient';
import {ProcurementVisualPreview} from '@/components/ProcurementVisualPreview';
import {buildAdminProcurementForecast} from '@/lib/procurement-admin-forecast';
import '@/components/procurement-receipts.css';
import './review.css';

// Read-only snapshot of the owner's observed Cargo request. IDs are local only.
const cargo={id:'local-cargo',planCode:'LOCAL-CARGO',supplierPartner:'Карго Юра',supplierCounterparty:'',orderRefs:[],orderNumbers:[],paymentPurpose:'DELIVERY',plannedDate:'2026-10-24',plannedAmount:'468270',condition:'00OF-000305 1330$\n00OF-000382 1036$\n00OF-000367 180$',paymentMethod:'USDT',currency:'USDT',foreignAmount:'5445',exchangeRate:'86',commissionAmount:null,exchangerName:'',supplierConfirmation:'',status:'APPROVED',createdAt:'2026-10-13T10:02:00Z',manager:{name:'Астемир Тохов'},evidence:{state:'ISSUED_BY_ONE_C',verification:'current' as const,issuedAmount:468300,paidAmount:0,paidForeignAmount:0,remainingAmount:0,remainingForeignAmount:null,actualExchangeRate:null,cashOrders:[{number:'00OF-001945',date:'24.10.2026 17:35:45',amount:468300,cashbox:''}]}};
const event=(id:string,action:string,createdAt:string,changes:{label:string;before:string;after:string}[],reason='')=>({id,action,createdAt,snapshot:{revision:{changes,reason}}});
const plans=[{...cargo,events:[
 event('local-1','UPDATED','2026-10-24T14:30:51Z',[{label:'Сумма, ₽',before:'479 160',after:'468 270'},{label:'Курс',before:'88',after:'86'}]),
 event('local-2','REVISION_APPROVED','2026-10-24T07:32:46Z',[{label:'Сумма, ₽',before:'454 696',after:'479 160'},{label:'Сумма в валюте',before:'5 167',after:'5 445'}],'сегодня только что скинул обновленную сумму'),
 event('local-3','REVISION_REQUESTED','2026-10-24T07:31:55Z',[{label:'Сумма, ₽',before:'454 696',after:'479 160'},{label:'Сумма в валюте',before:'5 167',after:'5 445'}],'сегодня только что скинул обновленную сумму'),
 event('local-4','REVISION_APPROVED','2026-10-24T07:30:06Z',[{label:'Сумма, ₽',before:'419 576',after:'454 696'},{label:'Сумма в валюте',before:'4 688',after:'5 167'},{label:'Курс',before:'89,5',after:'88'}],'увеличилась сумма'),
 event('local-5','REVISION_REQUESTED','2026-10-24T07:16:34Z',[{label:'Сумма, ₽',before:'419 576',after:'454 696'},{label:'Сумма в валюте',before:'4 688',after:'5 167'},{label:'Курс',before:'89,5',after:'88'}],'увеличилась сумма'),
 event('local-6','UPDATED','2026-10-22T19:45:31Z',[{label:'Подготовка денег',before:'По сроку заявки',after:'2026-10-24'}],'Оплата отложена'),
]}];
const balance={balance:null,checkedAt:'',sourceLabel:'Не используется в просмотре документов',error:''};
const forecast=buildAdminProcurementForecast({todayKey:'2026-10-24',plansComplete:false,ordersComplete:false,plansWithOrderContext:plans,scopedOrders:[],managerOrders:[],usdtBalance:balance,accountableBalance:balance},null);
type LocalFile={name:string;url:string;type:string;addedDay:number};
type Kind='details'|'receipt';

export default function Review(){
 const [beforePayment,setBeforePayment]=useState(true);
 const [actor,setActor]=useState<'admin'|'buyer'>('admin');
 const [qrState,setQrState]=useState<'check'|'confirmed'|'replaced'>('check');
 const [exampleReplacement,setExampleReplacement]=useState<number|null>(null);
 const [confirming,setConfirming]=useState(false);
 const [tomorrow,setTomorrow]=useState(false);
 const [editor,setEditor]=useState<'edit'|'schedule'|null>(null);
 const [saved,setSaved]=useState({day:'2026-10-24',amount:'5445',rate:'86',comment:cargo.condition,deferred:false});
 const [draft,setDraft]=useState(saved);
 const [noDate,setNoDate]=useState(false);
 const [notice,setNotice]=useState('');
 const [originalFile,setOriginalFile]=useState(false);
 const [files,setFiles]=useState<Record<Kind,LocalFile[]>>({details:[],receipt:[]});
 const [queue,setQueue]=useState(false),[picker,setPicker]=useState<Kind|null>(null);
 const [selected,setSelected]=useState<File|null>(null),[error,setError]=useState('');
 const [view,setView]=useState<LocalFile|null>(null);
 const urls=useRef<string[]>([]);
 useEffect(()=>()=>urls.current.forEach(URL.revokeObjectURL),[]);
 const pending=files.receipt.length===0;
 const choose=(kind:Kind)=>{setQueue(false);setSelected(null);setError('');setPicker(kind);};
 const accept=(file?:File)=>{
   if(!file)return;
   if(!['image/jpeg','image/png','image/webp','application/pdf'].includes(file.type)||file.size<=0||file.size>10*1024*1024){setError('Выберите JPG, PNG, WebP или PDF до 10 МБ.');return;}
   setSelected(file);setError('');
 };
 const save=()=>{if(!picker||!selected)return;const url=URL.createObjectURL(selected);urls.current.push(url);setFiles(current=>({...current,[picker]:[...current[picker],{name:selected.name,url,type:selected.type,addedDay:tomorrow?25:24}]}));if(picker==='details'){setQrState('replaced');setConfirming(false);}setPicker(null);setSelected(null);};
 const verified=qrState==='confirmed';
 const replaced=(beforePayment&&exampleReplacement)||files.details.length>0;
 const currentQr=files.details.at(-1);
 const resetQr=()=>{setQrState('check');setConfirming(false);setTomorrow(false);setExampleReplacement(null);};
 const dayLabel=saved.day?new Date(saved.day+'T12:00:00+03:00').toLocaleDateString('ru-RU',{day:'numeric',month:'long'}):'Дата уточняется';
 const rubles=(Number(saved.amount)*Number(saved.rate)).toLocaleString('ru-RU',{maximumFractionDigits:2});
 const openEditor=(kind:'edit'|'schedule')=>{setDraft(saved);setNoDate(!saved.day);setEditor(kind);setNotice('');};
 const documents=<div className="pd-documents">
   <section aria-label="Реквизиты для оплаты" className="pd-section">
     <div className="pd-heading"><h3><QrCode size={18}/>Реквизиты для оплаты</h3>{beforePayment&&<button className="procurement-receipt-button" onClick={()=>choose('details')}><Plus size={15}/>Добавить</button>}</div>
     <div className="pd-existing pd-qr-file"><QrCode size={23}/><div className="pd-qr-file-info"><button className="pd-document-name" onClick={()=>currentQr?setView(currentQr):setOriginalFile(true)}>{replaced?'Новый QR-код':'QR-код'} <small>· {replaced?`${currentQr?.addedDay??exampleReplacement} октября`:'13 октября'}</small></button><span>Астемир Тохов · {currentQr?.type==='application/pdf'?'PDF':'JPG'}</span></div>
       {beforePayment&&!saved.deferred&&(actor==='buyer'&&!verified?<button className="pd-qr-check" aria-expanded={confirming} aria-controls="qr-confirmation" onClick={()=>setConfirming(!confirming)}><AlertTriangle size={15}/>Проверить</button>:<span className={`pd-qr-indicator ${verified?'pd-qr-ok':''}`} role="status" title={verified?'Астемир подтвердил актуальность у поставщика':'Астемир проверит QR у поставщика перед оплатой'}>{verified?<Check size={15}/>:<AlertTriangle size={15}/>} {verified?'Подтверждён сегодня':'Требует проверки'}</span>)}
     </div>
     {beforePayment&&!saved.deferred&&actor==='buyer'&&!verified&&confirming&&<div className="pd-confirm" id="qr-confirmation"><p>Поставщик подтвердил, что по этому QR можно оплатить {tomorrow?'25':'24'} октября?</p><div><button className="procurement-receipt-button" onClick={()=>{setQrState('confirmed');setConfirming(false);}}>Подтвердить</button><button className="procurement-receipt-button" onClick={()=>choose('details')}>Заменить</button><button className="procurement-receipt-button" onClick={()=>setConfirming(false)}>Отмена</button></div></div>}
     {replaced&&<details className="pd-old-qr"><summary>Предыдущие реквизиты · {files.details.length>1?files.details.length:1}</summary><div><FileText size={17}/><span>QR от 13 октября</span><span>Заменён</span></div>{files.details.slice(0,-1).map(file=><div key={file.url}><button className="pd-file" onClick={()=>setView(file)}>{file.name}</button><span>Заменён</span></div>)}</details>}
   </section>
   <section aria-label="Чеки оплаты" className={`pd-section pd-payment ${beforePayment?'pd-receipt-before':''}`}>
     <div className="pd-heading"><h3><Paperclip size={18}/>Чеки оплаты</h3><div className="pd-receipt-controls">{!beforePayment&&<span className={pending?'pd-badge':'pd-badge pd-done'}>{pending?'Нужен чек':'Чек добавлен'}</span>}<button className="procurement-receipt-button" onClick={()=>choose('receipt')}><Plus size={15}/>{pending?'Добавить чек':'Добавить ещё'}</button></div></div>
     {files.receipt.map(file=><button className="pd-file" key={file.url} onClick={()=>setView(file)}><Paperclip size={16}/>{file.name}</button>)}
   </section>
 </div>;
 const detail=<div className="pd-cohesive">
   <div className="pd-request-summary"><div><h3>Карго Юра</h3><p>Доставка · Астемир Тохов</p></div><span className={`pd-main-state ${beforePayment&&saved.deferred?'pd-deferred':''}`}>{beforePayment?(saved.deferred?'Оплата отложена':'Деньги готовы'):'Оплачено полностью'}</span></div>
   <div className="pd-money-grid"><div><span>Сумма заявки</span><strong>{Number(beforePayment?saved.amount:cargo.foreignAmount).toLocaleString('ru-RU')} USDT</strong><p>≈ {beforePayment?rubles:'468 270'} ₽ · курс {beforePayment?saved.rate:'86'} ₽</p></div><div><span>{beforePayment?'Подготовить к':'Оплачено по расходнику'}</span><strong>{beforePayment?dayLabel:'468 300 ₽'}</strong><p>{beforePayment?'Перевод в USDT':'24 октября · 17:35'}</p></div></div>
   {beforePayment&&!editor&&<div className="pd-request-actions"><button className="pam-button" onClick={()=>openEditor('edit')}>Изменить</button><button className="pam-button" onClick={()=>openEditor('schedule')}>{actor==='admin'?(saved.deferred?'Изменить отсрочку':'Отложить оплату'):'Перенести дату'}</button></div>}
   {editor&&beforePayment&&<form className="pd-edit-form" aria-label={editor==='edit'?'Изменить заявку':'Срок оплаты'} onSubmit={e=>{e.preventDefault();const next={...draft,day:editor==='schedule'&&noDate?'':draft.day,deferred:editor==='schedule'&&actor==='admin'?true:draft.deferred};setSaved(next);if(next.day!==saved.day)setQrState('check');setEditor(null);setNotice('Изменения сохранены только в примере.');}}>
     <h4>{editor==='edit'?'Изменить заявку':actor==='admin'?'Отложить оплату':'Перенести дату'}</h4>
     <div className="pd-edit-grid"><label>Подготовить к<input type="date" required={!noDate} disabled={editor==='schedule'&&noDate} value={draft.day} onChange={e=>setDraft({...draft,day:e.target.value})}/></label>{editor==='edit'?<><label>Сумма, USDT<input type="number" min="0.01" step="0.01" required value={draft.amount} onChange={e=>setDraft({...draft,amount:e.target.value})}/></label><label>Плановый курс, ₽<input type="number" min="0.01" step="0.01" required value={draft.rate} onChange={e=>setDraft({...draft,rate:e.target.value})}/></label><label className="pd-comment-edit">Комментарий<textarea rows={2} value={draft.comment} onChange={e=>setDraft({...draft,comment:e.target.value})}/></label></>:actor==='admin'?<label className="pd-checkbox"><input type="checkbox" checked={noDate} onChange={e=>setNoDate(e.target.checked)}/>Дата пока неизвестна</label>:null}</div>
     <div className="pd-actions"><button type="button" className="pam-button" onClick={()=>setEditor(null)}>Отмена</button><button type="submit" className="pam-button pam-primary">Сохранить в примере</button></div>
   </form>}
   {notice&&<p className="pd-local-result" role="status">{notice}</p>}
   {!beforePayment&&<div className="pd-expense-row"><FileText size={17}/><strong>Расходник №00OF-001945</strong><span>24 октября 2026</span></div>}
   <ProcurementAdminComment value={beforePayment?saved.comment:cargo.condition} historical={!beforePayment}/>
   {documents}
   <div className="pd-history"><ProcurementChangeHistory events={beforePayment?plans[0].events.slice(1):plans[0].events} initiallyOpen={false}/></div>
   <details className="pd-example-options"><summary>Локальный пример · {actor==='admin'?'вид руководителя':'действия Астемира'}</summary><div><button className="procurement-receipt-button" onClick={()=>{setActor('admin');setConfirming(false);setEditor(null);}}>Что видите вы</button><button className="procurement-receipt-button" onClick={()=>{setActor('buyer');setEditor(null);}}>Действия Астемира</button>{beforePayment&&<><button className="procurement-receipt-button" onClick={()=>{setQrState('confirmed');setConfirming(false);}}>QR подтверждён</button><button className="procurement-receipt-button" onClick={()=>{setQrState('replaced');setExampleReplacement(tomorrow?25:24);setConfirming(false);}}>Загружен новый QR</button><button className="procurement-receipt-button" onClick={()=>{setTomorrow(true);setSaved({...saved,day:'2026-10-25'});setQrState('check');setConfirming(false);}}>Оплата на следующий день</button><button className="procurement-receipt-button" onClick={resetQr}>Нужна проверка</button></>}</div></details>
 </div>;
 return <AdminIdentityProvider name="Кештова Бэла"><div className="pd-preview"><AdminShell pageTitle="Платёжный календарь">
   <div className="pd-review-note">Локальный просмотр · реальные заявки не меняются, уведомления не отправляются
     <div className="pd-mode"><button aria-pressed={beforePayment} onClick={()=>setBeforePayment(true)}>Перед оплатой · пример</button><button aria-pressed={!beforePayment} onClick={()=>setBeforePayment(false)}>После оплаты · Карго Юра</button></div>
   </div>
   {beforePayment?<ProcurementAdminList openItemId="qr-before-payment" items={[{id:'qr-before-payment',name:'Карго Юра',amount:`${Number(saved.amount).toLocaleString('ru-RU')} USDT`,basis:'Доставка',method:'Перевод в USDT',meta:dayLabel,warning:saved.deferred?'Оплата отложена':verified?'QR подтверждён сегодня':'QR требует проверки'}]} renderDetail={()=>detail}/>:<>
   <ProcurementVisualPreview.Provider value={{initialAdminTab:'history',plainPaymentDetails:true,historyDetail:()=>detail,receiptControl:<button className="procurement-receipt-button" onClick={()=>setQueue(true)}><Paperclip size={15}/>Нужны чеки <span className={pending?'pd-count':''}>{pending?1:0}</span></button>,fundingPlan:<p>В этом просмотре показаны только документы заявки «Карго Юра». Прогноз не изменяется.</p>}}>
     <AdminProcurementClient initialPlans={plans} sourceCheckedAt="2026-10-24T16:23:10Z" sourceWarnings={[]} unplannedOrderCount={null} openOrderCount={null} orderPaymentGapTotal={null} unplannedCashCount={null} supplierDebtTotal={null} usdtBalance={balance} accountableBalance={balance} todayKey="2026-10-24" {...forecast}/>
   </ProcurementVisualPreview.Provider>
   </>}
   {queue&&<LocalDialog title="Нужны чеки" close={()=>setQueue(false)}><div className="pd-queue"><div><h3>Карго Юра</h3><p>Доставка · 24 октября</p></div><strong>468 300 ₽</strong>{pending?<button className="procurement-receipt-button pd-warm" onClick={()=>choose('receipt')}>Добавить чек</button>:<span className="pd-badge pd-done">Чек добавлен</span>}</div><p className="pd-hint">Здесь только подтверждения выполненных переводов.</p></LocalDialog>}
   {picker&&<LocalDialog title={picker==='details'?'Добавить реквизиты':'Добавить чек оплаты'} close={()=>setPicker(null)}>
     <div className="pd-upload-context"><strong>Карго Юра</strong><span>{picker==='receipt'&&!beforePayment?'468 300 ₽ · оплата 24 октября':'Доставка'}</span></div>
     <p className="pd-explain">{picker==='details'?'QR-код, счёт или данные получателя':'Подтверждение выполненного перевода'}</p>
     <label className="pd-drop" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();accept(e.dataTransfer.files[0]);}}><Upload size={27}/><strong>{selected?selected.name:'Выбрать файл'}</strong><span>Фото или PDF до 10 МБ · можно перетащить сюда</span><input type="file" aria-label="Выбрать файл" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={e=>accept(e.target.files?.[0])}/></label>
     {error&&<p role="alert" className="pd-error">{error}</p>}
     <p className="pd-hint">Локальный просмотр: файл не отправляется в портал.</p>
     <div className="pd-actions"><button className="procurement-receipt-button" onClick={()=>setPicker(null)}>Отмена</button><button className="procurement-receipt-button pd-primary" disabled={!selected} onClick={save}>{picker==='details'?'Добавить реквизиты':'Добавить чек'}</button></div>
   </LocalDialog>}
   {view&&<LocalDialog title={view.name} close={()=>setView(null)}>{view.type==='application/pdf'?<iframe title={view.name} src={view.url} className="pd-file-preview"/>:<img src={view.url} alt={view.name} className="pd-file-preview"/>}</LocalDialog>}
   {originalFile&&<LocalDialog title="QR-код · 13 октября" close={()=>setOriginalFile(false)}><p>В этом локальном примере показаны сведения о файле. Сам оригинал из рабочего портала не загружен.</p></LocalDialog>}
 </AdminShell></div></AdminIdentityProvider>;
}
function LocalDialog({title,close,children}:{title:string;close:()=>void;children:React.ReactNode}){
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const el=ref.current!,opener=document.activeElement as HTMLElement|null;el.showModal();return()=>{el.close();opener?.isConnected&&opener.focus();};},[]);
 return <dialog ref={ref} className="procurement-receipts-dialog pd-dialog" aria-label={title} onCancel={e=>{e.preventDefault();close();}}><header><h2>{title}</h2><button className="procurement-receipt-button" aria-label="Закрыть" onClick={close}><X size={18}/></button></header><div className="procurement-receipts-body">{children}</div></dialog>;
}
