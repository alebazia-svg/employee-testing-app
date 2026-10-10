import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const base='http://127.0.0.1:3141';
if(process.env.DATABASE_URL!=='postgresql://postgres@127.0.0.1:55439/procurement_receipts_current_test')throw Error('ISOLATED_RECEIPT_TEST_DATABASE_REQUIRED');
test('authenticated routes: upload, retry, cross-user download, content headers and CSRF',async()=>{
  const cookies:string[]=[];
  for(const login of ['receipt-admin','receipt-buyer']){
    const response=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({login,password:'receipt-local-test-only'})});
    assert.equal(response.status,200);
    cookies.push(response.headers.get('set-cookie')!.split(';')[0]);
  }
  const endpoint=base+'/api/procurement/payment-plans/receipt-review-galida/receipts';
  assert.equal((await fetch(endpoint)).status,401);
  const bytes=await readFile('public/favicon-32x32.png');
  const form=()=>{const data=new FormData();data.set('file',new Blob([bytes],{type:'image/png'}),'Тестовый чек.png');return data;};
  assert.equal((await fetch(endpoint,{method:'POST',headers:{cookie:cookies[0],origin:'https://example.invalid'},body:form()})).status,403);
  const added=await fetch(endpoint,{method:'POST',headers:{cookie:cookies[0],origin:base},body:form()});
  assert.ok([200,201].includes(added.status));
  const data=await added.json();
  const retry=await fetch(endpoint,{method:'POST',headers:{cookie:cookies[0],origin:base},body:form()});
  assert.equal(retry.status,200);assert.equal((await retry.json()).receipt.id,data.receipt.id);
  const download=await fetch(endpoint+'/'+data.receipt.id,{headers:{cookie:cookies[1]}});
  assert.equal(download.status,200);assert.equal(download.headers.get('x-content-type-options'),'nosniff');
  assert.ok(download.headers.get('content-disposition')?.startsWith('attachment;'));
  assert.deepEqual(Buffer.from(await download.arrayBuffer()),bytes);
  const otherPlan=endpoint.replace('receipt-review-galida','receipt-review-smart');
  assert.equal((await fetch(otherPlan+'/'+data.receipt.id,{headers:{cookie:cookies[1]}})).status,404);
  assert.equal((await fetch(endpoint,{headers:{cookie:cookies[1]}})).status,200);
});
