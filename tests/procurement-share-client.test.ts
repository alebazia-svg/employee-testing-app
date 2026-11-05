import test from 'node:test';import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';import {prepareTransfer} from '../lib/procurement-share-client';
const bytes=new TextEncoder().encode('original-qr-a');const hash=createHash('sha256').update(bytes).digest('hex');
const entry={id:'plan/a',version:'v',supplier:'A',currency:'CNY',amount:100,text:'',network:'',files:[{id:'file/b',sha256:hash,mimeType:'image/png',size:bytes.length}]};
test('download uses both exact plan and document IDs; foreign bytes/size fail before image preparation',async()=>{
 let url='';const request=async(input:any)=>{url=String(input);return new Response('foreign-qr');};
 await assert.rejects(prepareTransfer(entry,100,0,request as typeof fetch),/не совпал/);
 assert.equal(url,'/api/procurement/payment-plans/plan%2Fa/receipts/file%2Fb');
 await assert.rejects(prepareTransfer({...entry,files:[{...entry.files[0],size:1}]},100,0,(async()=>new Response(bytes)) as typeof fetch),/не совпал/);
 await assert.rejects(prepareTransfer({...entry,files:[entry.files[0],entry.files[0]]},100,0),/один актуальный QR/);
});
