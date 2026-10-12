'use client';

import {useEffect,useRef,useState} from 'react';
import {ArrowLeft,Download,Minus,Plus,Maximize,RefreshCw} from 'lucide-react';
import './procurement-receipt-viewer.css';
import {useReceiptPdf} from './useReceiptPdf';
import {receiptPreviewMime,receiptFittedWidth} from '@/lib/procurement-receipt-viewer';

/** Uses the existing authenticated attachment route; does not modify documents. */
export function ProcurementReceiptViewer({url,name,onBack}:{url:string;name:string;onBack:()=>void}) {
 const [source,setSource]=useState('');
 const [mime,setMime]=useState('');
 const [error,setError]=useState('');
 const [zoom,setZoom]=useState(1);
 const [attempt,setAttempt]=useState(0);
 const [natural,setNatural]=useState({width:0,height:0});
 const [space,setSpace]=useState({width:0,height:0});
 const viewport=useRef<HTMLDivElement>(null);
 const [page,setPage]=useState(1);
 const pdf=useReceiptPdf(source,mime==='application/pdf',page);

 useEffect(()=>{
  const abort=new AbortController();let objectUrl='';let timedOut=false;let disposed=false;
  setSource('');setMime('');setError('');setZoom(1);setPage(1);setNatural({width:0,height:0});
  const timeout=setTimeout(()=>{timedOut=true;abort.abort();},15000);
  (async()=>{
   try {
    const response=await fetch(url,{signal:abort.signal,cache:'no-store',credentials:'same-origin'});
    if(!response.ok)throw new Error('Не удалось загрузить чек. Повторите попытку.');
    const blob=await response.blob();
    const type=receiptPreviewMime(blob.type);
    if(!type)
     throw new Error('Просмотр этого формата недоступен. Файл можно скачать.');
    if(abort.signal.aborted)return;
    objectUrl=URL.createObjectURL(blob);setMime(type);setSource(objectUrl);
   } catch (cause) {
    if(!disposed&&(!abort.signal.aborted||timedOut))setError(timedOut?'Чек загружается слишком долго. Повторите попытку.':cause instanceof Error?cause.message:'Не удалось открыть чек. Повторите попытку или скачайте файл.');
   } finally {clearTimeout(timeout);}
  })();
  return()=>{disposed=true;clearTimeout(timeout);abort.abort();if(objectUrl)URL.revokeObjectURL(objectUrl);};
 },[url,attempt]);

 useEffect(()=>{
  const element=viewport.current;if(!element)return;
  const observer=new ResizeObserver(()=>{
   const style=getComputedStyle(element);
   setSpace({width:element.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight),height:element.clientHeight-parseFloat(style.paddingTop)-parseFloat(style.paddingBottom)});
  });
  observer.observe(element);return()=>observer.disconnect();
 },[]);

 const imageSource=mime==='application/pdf'?pdf.image:source;
 const visibleError=error||pdf.error;
 const imageReady=!!imageSource&&!visibleError;
 const width=receiptFittedWidth(natural,space,zoom);
 const changeZoom=(next:number)=>{setZoom(next);if(next===1)viewport.current?.scrollTo({top:0,left:0});};
 const shape=mime==='application/pdf'?'pdf':natural.width>natural.height?'landscape':'portrait';
 return <div className={`receipt-view-preview receipt-view-${shape}`}>
  <div className="receipt-view-tools">
   <button type="button" autoFocus className="procurement-receipt-button" onClick={onBack}><ArrowLeft size={16}/>К чекам</button>
   {imageReady?<div className="receipt-view-zoom" aria-label="Масштаб чека">
    <button type="button" title="Уменьшить" aria-label="Уменьшить чек" onClick={()=>changeZoom(Math.max(1,zoom-.25))} disabled={zoom===1}><Minus size={17}/></button>
    <span aria-live="polite">{zoom===1?'По размеру':`${Math.round(zoom*100)}%`}</span>
    <button type="button" title="Увеличить" aria-label="Увеличить чек" onClick={()=>changeZoom(Math.min(3,zoom+.25))} disabled={zoom===3}><Plus size={17}/></button>
    <button type="button" title="Показать целиком" aria-label="Чек по размеру окна" onClick={()=>changeZoom(1)}><Maximize size={17}/></button>
   </div>:null}
   <a className="procurement-receipt-button receipt-view-download" href={url} download={name}><Download size={16}/>Скачать</a>
  </div>
  {mime==='application/pdf'&&pdf.pageCount>1?<div className="receipt-view-pages"><button className="procurement-receipt-button" disabled={page===1} onClick={()=>{setPage(p=>p-1);changeZoom(1);}}>Предыдущая</button><span aria-live="polite">{page} из {pdf.pageCount}</span><button className="procurement-receipt-button" disabled={page===pdf.pageCount} onClick={()=>{setPage(p=>p+1);changeZoom(1);}}>Следующая</button></div>:null}
  <div ref={viewport} className="receipt-view-document" aria-busy={!imageSource&&!visibleError}>
   {visibleError?<div className="receipt-view-message"><p role="alert">{visibleError}</p><button type="button" className="procurement-receipt-button" onClick={()=>setAttempt(v=>v+1)}><RefreshCw size={16}/>Повторить</button></div>
    :!imageSource?<p role="status">Открываем чек…</p>
    :<img src={imageSource} alt={name} draggable={false} onLoad={event=>setNatural({width:event.currentTarget.naturalWidth,height:event.currentTarget.naturalHeight})} onError={()=>setError('Изображение повреждено или не поддерживается. Попробуйте скачать файл.')} style={{width:width??'auto',height:'auto',visibility:width?'visible':'hidden'}}/>}
  </div>
  <div className="receipt-view-name" title={name}>{name}</div>
 </div>;
}
