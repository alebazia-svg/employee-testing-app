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
test('wallets stay plain text with amount/network/address on separate lines and in the archive',async()=>{
 const wallet={...entry,id:'wallet-plan',currency:'USDT',text:'T-TEST-ADDRESS-NOT-FOR-PAYMENT',network:'TRC20',files:[]};
 const result=await prepareTransfer(wallet,2145.5,2);
 assert.equal(result.kind,'TEXT');assert.equal(result.file.type,'text/plain');assert.equal(result.file.name,'payment-03-USDT-2145-5.txt');
 assert.equal(result.text,'2145.5 USDT\nTRC20\nT-TEST-ADDRESS-NOT-FOR-PAYMENT');
 assert.equal(await result.file.text(),result.text);assert.equal(result.recipient,wallet.text);
 const alipay=await prepareTransfer({...wallet,id:'alipay-plan',currency:'CNY',text:'test-alipay',network:''},1000,3);
 assert.equal(alipay.text,'1000 CNY\ntest-alipay');assert.notEqual(alipay.file.name,result.file.name);
});
