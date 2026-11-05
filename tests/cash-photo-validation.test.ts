import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { validateCashPhoto, cashPhotoFormat, CASH_PHOTO_ACCEPT } from '../lib/cash-photo-validation';
import { CASH_PHOTO_MAX_BYTES, CASH_PHOTO_CHUNK_BYTES, validCashPhotoIdentity, cashPhotoChunkLength } from '../lib/cash-photo-protocol';
import { validateEmployeeImage } from '../lib/image-upload';
import { prepareEmployeeCashPhoto } from '../lib/employee-cash-transfer';

test('a phone capture above8MiB is accepted unchanged by cash only',async()=>{
 const bytes=new Uint8Array(12*1024*1024+31);bytes.set([255,216,255]);
 const file=new File([bytes],'phone.jpg',{type:'image/jpeg'});
 await assert.rejects(validateEmployeeImage(file),/8/);
 assert.equal((await validateCashPhoto(file)).extension,'jpg');
 const prepared=await prepareEmployeeCashPhoto(file,17);
 assert.equal(prepared.photoSha256,createHash('sha256').update(bytes).digest('hex'));
 assert.equal(prepared.baselineId,17);
 assert.equal(prepared.photoType,'image/jpeg');
 assert.equal(file.size,bytes.length);
 assert.equal(validCashPhotoIdentity(prepared.photoSha256,file.size),true);
 assert.equal(cashPhotoChunkLength(file.size,Math.ceil(file.size/CASH_PHOTO_CHUNK_BYTES)-1),31);
});
test('cash accepts the supported camera header with empty/alias MIME; other uploads keep their stricter policy',async()=>{
 for(const mime of ['', 'image/jpg','application/octet-stream']){
  const file=new File([new Uint8Array([255,216,255,1])],'camera',{type:mime});
  assert.equal((await validateCashPhoto(file)).mime,'image/jpeg');
  await assert.rejects(validateEmployeeImage(file));
 }
 await assert.rejects(validateCashPhoto(new File(['fake image'],'fake.jpg',{type:'image/jpeg'})));
 await assert.rejects(validateCashPhoto(new File([new Uint8Array([255,216,255])],'fake.png',{type:'image/png'})));
 assert.equal(CASH_PHOTO_ACCEPT,'image/jpeg,image/png,image/webp');
});
test('cash keeps a bounded64MiB envelope and rejects empty/corrupted evidence',()=>{
 const header=new Uint8Array([255,216,255]);
 assert.equal(cashPhotoFormat(header,CASH_PHOTO_MAX_BYTES).extension,'jpg');
 assert.throws(()=>cashPhotoFormat(header,CASH_PHOTO_MAX_BYTES+1));
 assert.throws(()=>cashPhotoFormat(header,0));
 assert.throws(()=>cashPhotoFormat(new Uint8Array([0,1]),100));
 assert.equal(validCashPhotoIdentity('a'.repeat(64),CASH_PHOTO_MAX_BYTES+1),false);
});
