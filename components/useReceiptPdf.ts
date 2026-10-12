'use client';
import {useEffect,useState} from 'react';

type RenderTask={promise:Promise<void>;cancel:()=>void};
type PdfPage={getViewport:(options:{scale:number})=>{width:number;height:number};render:(options:unknown)=>RenderTask};
type PdfDocument={numPages:number;getPage:(page:number)=>Promise<PdfPage>};
type PdfLoadingTask={promise:Promise<PdfDocument>;destroy:()=>Promise<void>};
type PdfModule={GlobalWorkerOptions:{workerSrc:string};getDocument:(options:unknown)=>PdfLoadingTask};
const assets='/vendor/receipt-pdfjs-6.4.299/';

/** PDF documents stay in the browser; no third-party document service. */
export function useReceiptPdf(source:string,enabled:boolean,pageNumber:number){
 const [document,setDocument]=useState<PdfDocument|null>(null);
 const [image,setImage]=useState('');
 const [error,setError]=useState('');
 useEffect(()=>{
  let cancelled=false;let loading:PdfLoadingTask|undefined;
  setDocument(null);setImage('');setError('');
  if(!source||!enabled)return;
  const timeout=setTimeout(()=>{cancelled=true;setError('PDF открывается слишком долго. Повторите попытку или скачайте файл.');void loading?.destroy().catch(()=>{});},20000);
  (async()=>{
   try {
    const modulePath=assets+'pdf.min.mjs';
    const pdf=await import(/* webpackIgnore: true */ modulePath) as PdfModule;
    if(cancelled)return;
    pdf.GlobalWorkerOptions.workerSrc=assets+'pdf.worker.min.mjs';
    loading=pdf.getDocument({url:source,cMapUrl:assets+'cmaps/',cMapPacked:true,standardFontDataUrl:assets+'standard_fonts/',wasmUrl:assets+'wasm/',isEvalSupported:false,enableXfa:false});
    const loaded=await loading.promise;
    if(!cancelled)setDocument(loaded);
   }catch {if(!cancelled)setError('Не удалось показать PDF. Возможно, файл защищён паролем или повреждён. Его можно скачать.');}
   finally {clearTimeout(timeout);}
  })();
  return()=>{cancelled=true;clearTimeout(timeout);void loading?.destroy().catch(()=>{});};
 },[source,enabled]);
 useEffect(()=>{
  let cancelled=false;let render:RenderTask|undefined;let canvas:HTMLCanvasElement|undefined;
  setImage('');
  if(!document)return;
  setError('');
  const timeout=setTimeout(()=>{cancelled=true;render?.cancel();setError('Страница PDF открывается слишком долго. Повторите попытку или скачайте файл.');},20000);
  (async()=>{
   try {
    const page=await document.getPage(pageNumber);if(cancelled)return;
    const original=page.getViewport({scale:1});
    const view=page.getViewport({scale:Math.min(2.5,3000/Math.max(original.width,original.height))});
    canvas=window.document.createElement('canvas');canvas.width=Math.ceil(view.width);canvas.height=Math.ceil(view.height);
    render=page.render({canvas,canvasContext:canvas.getContext('2d'),viewport:view});
    await render.promise;
    if(!cancelled)setImage(canvas.toDataURL('image/png'));
   }catch {if(!cancelled)setError('Не удалось показать страницу PDF. Файл можно скачать.');}
   finally {clearTimeout(timeout);if(canvas){canvas.width=0;canvas.height=0;}}
  })();
  return()=>{cancelled=true;clearTimeout(timeout);render?.cancel();};
 },[document,pageNumber]);
 return {image,error,pageCount:document?.numPages||0};
}
