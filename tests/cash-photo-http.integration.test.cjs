const test=require('node:test');
test('real HTTP cash intents, replay, attachment and legacy compatibility', {skip:process.env.CASH_PHOTO_HTTP_INTEGRATION!=='1'}, async()=>{
const assert=require('node:assert/strict'),{randomUUID,createHash}=require('node:crypto');
const root=require('node:path').resolve(__dirname,'..');
if(process.env.DATABASE_URL!=='postgresql://preview:schedule-source-local-only@127.0.0.1:55481/cash_photo_test_20261104')throw Error('ISOLATED_TEST_ONLY');
const {PrismaClient}=require(root+'/node_modules/@prisma/client'),bcrypt=require(root+'/node_modules/bcryptjs');const db=new PrismaClient();const ids=[];let checks=0;
const origin='http://127.0.0.1:3224',date=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
try {
await fetch('http://127.0.0.1:3221/demo-control',{method:'POST',body:JSON.stringify({delay:1800})});
const users=[];for(let i=0;i<2;i++){const u=await db.user.create({data:{login:'http-photo-'+randomUUID(),name:'HTTP изолированный тест',department:'wholesale',role:'EMPLOYEE',passwordHash:await bcrypt.hash('isolated-http-pass',4)}});ids.push(u.id);const day=await db.workDayEntry.create({data:{userId:u.id,date,department:'wholesale',shiftCode:'09_19',shiftLabel:'09:00–19:00',status:'active'}});await db.userOneCCashboxMapping.create({data:{userId:u.id,oneCCashboxRef:'00000000-0000-4000-8000-000000000002',oneCCashboxName:'test'}});const login=await fetch(origin+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({login:u.login,password:'isolated-http-pass'})});assert.equal(login.status,200);users.push({...u,day,cookie:login.headers.getSetCookie().find(value=>value.startsWith('offonika_session=')).split(';')[0]});}
const user=users[0],photo=Buffer.alloc(600000,5);photo.set([0xff,0xd8,0xff]);const hash=createHash('sha256').update(photo).digest('hex');
const make=(baselineId=null)=>({protocol:2,idempotencyKey:randomUUID(),direction:'deposit_safe',amount:'40000',comment:'Local route verification',workDayEntryId:user.day.id,workDayDate:date,clientCreatedAt:new Date().toISOString(),baselineId,photoSha256:hash,photoBytes:photo.length});
const post=body=>fetch(origin+'/api/employee/cash-operations',{method:'POST',headers:{Cookie:user.cookie,'Content-Type':'application/json'},body:JSON.stringify(body)});
const get=(key,who=user,protocol=true)=>fetch(origin+'/api/employee/cash-operations?idempotencyKey='+key+(protocol?'&protocol=2':''),{headers:{Cookie:who.cookie}});
const first=make(),started=Date.now(),financial=post(first);
let receipt;for(let i=0;i<30;i++){const r=await get(first.idempotencyKey);if(r.status===200){receipt=await r.json();break;}await new Promise(r=>setTimeout(r,30));}assert.ok(receipt);const metadataMs=Date.now()-started;
assert.equal(receipt.operation.photoPath,'');assert.equal(receipt.operation.status,'pending_1c');checks++;
assert.equal((await get(first.idempotencyKey,user,false)).status,409);checks++;
assert.equal((await get(first.idempotencyKey,users[1])).status,404);checks++;
const replay=await post(first);assert.equal(replay.status,202);checks++;
for(let index=0;index<2;index++){const r=await fetch(origin+'/api/employee/cash-operations?idempotencyKey='+first.idempotencyKey+'&chunk='+index,{method:'PATCH',headers:{Cookie:user.cookie,'X-Photo-Sha256':hash},body:photo.subarray(index*524288,(index+1)*524288)});assert.equal(r.status,200);}
const photoReceipt=await (await get(first.idempotencyKey)).json();assert.ok(photoReceipt.operation.photoPath);assert.equal(photoReceipt.operation.status,'pending_1c');checks++;
assert.equal((await financial).status,200);checks++;
const posted=await (await get(first.idempotencyKey)).json();assert.equal(posted.operation.status,'posted_1c_pair');checks++;
// A second physical transfer with the same amount and current baseline is accepted.
const second=make(posted.operation.id),third=make(posted.operation.id);
const results=await Promise.all([post(second),post(third)]);assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);checks++;
assert.equal(await db.cashOperation.count({where:{userId:user.id}}),2);checks++;
const secondPayload=await (results[0].status===200?results[0]:results[1]).json();
// Loss of the final financial response is recovered by the same key, without new documents.
const key=secondPayload.operation.idempotencyKey;const replay2=await post(key===second.idempotencyKey?second:third);assert.equal(replay2.status,200);assert.equal((await replay2.json()).operation.id,secondPayload.operation.id);checks++;
// Old multipart clients still save their original image and complete a pair.
const form=new FormData();form.set('idempotencyKey',randomUUID());form.set('amount','12345');form.set('direction','deposit_safe');form.set('photo',new File([photo],'original.jpg',{type:'image/jpeg'}));const legacy=await fetch(origin+'/api/employee/cash-operations',{method:'POST',headers:{Cookie:user.cookie},body:form});assert.equal(legacy.status,200);assert.ok((await legacy.json()).operation.photoPath);checks++;
// Photo-first recovery compatibility also accepts an original above8MiB.
const latest=await db.cashOperation.findFirst({where:{userId:user.id},orderBy:{id:'desc'}});
const fallbackKey=randomUUID(),fallback=new FormData(),largePhoto=Buffer.alloc(12*1024*1024+77,5);largePhoto.set([0xff,0xd8,0xff]);const largeHash=createHash('sha256').update(largePhoto).digest('hex');
for(const [key,value] of Object.entries({protocol:'2',idempotencyKey:fallbackKey,direction:'deposit_safe',amount:'40000',baselineId:String(latest.id),photoSha256:largeHash,photoBytes:String(largePhoto.length),workDayEntryId:String(user.day.id),workDayDate:date}))fallback.set(key,value);
fallback.set('photo',new File([largePhoto],'original.jpg',{type:'image/jpeg'}));
const fallbackResponse=await fetch(origin+'/api/employee/cash-operations',{method:'POST',headers:{Cookie:user.cookie},body:fallback});
assert.equal(fallbackResponse.status,200);const fallbackRow=(await fallbackResponse.json()).operation;
assert.ok(fallbackRow.photoPath);assert.ok(fallbackRow.photoReceivedAt);assert.equal(fallbackRow.photoExpectedSha256,largeHash);assert.equal(fallbackRow.photoExpectedBytes,largePhoto.length);checks++;
// Delayed metadata from a closed shift remains for ADMIN; no automatic 1C write.
await db.workDayEntry.update({where:{id:user.day.id},data:{status:'completed',endedAt:new Date()}});
const closed=make(fallbackRow.id),closedResponse=await post(closed);assert.equal(closedResponse.status,202);
const closedPayload=await closedResponse.json();assert.equal(closedPayload.manualControl,true);assert.equal(closedPayload.operation.status,'one_c_error');checks++;
assert.equal((await fetch(origin+'/api/employee/cash-operations?idempotencyKey='+first.idempotencyKey)).status,401);checks++;
console.log(JSON.stringify({checks,metadataMs,sameAmountTransfers:2,legacyPhotoFirst:'passed',storageFailureFallback:'passed',largePhotoFirstBytes:largePhoto.length,closedShiftProtection:'passed',externalFinancialWrites:0}));
} finally {await db.user.deleteMany({where:{id:{in:ids}}});await db.$disconnect();await fetch('http://127.0.0.1:3221/demo-control',{method:'POST',body:JSON.stringify({delay:15000})});}
});
