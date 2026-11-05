import test from 'node:test';
import assert from 'node:assert/strict';
import { transferEmployeeCash, saveEmployeeCashIntent, prepareEmployeeCashPhoto } from '../lib/employee-cash-transfer';
import { cashMetadataAcknowledges, cashOutboxResponseAcknowledges, type EmployeeCashOutboxItem } from '../lib/employee-cash-outbox';
import { CASH_PHOTO_CHUNK_BYTES } from '../lib/cash-photo-protocol';

async function fixture() {
  const bytes = new Uint8Array(CASH_PHOTO_CHUNK_BYTES + 100); bytes.set([0xff, 0xd8, 0xff]);
  const photo = new File([bytes], 'original.jpg', { type: 'image/jpeg' });
  const item: EmployeeCashOutboxItem = { id: '12345678-1234-4234-9234-123456789abc', userId: 8, workDayEntryId: 12, workDayDate: '2026-11-04', createdAt: new Date().toISOString(), url: '/api/employee/cash-operations', direction: 'deposit_safe', amount: '40000', comment: '', photo, lastError: '', ...await prepareEmployeeCashPhoto(photo, null) };
  const operation = { id: 44, idempotencyKey: item.id, userId: item.userId, workDayEntryId: item.workDayEntryId, date: item.workDayDate, direction: item.direction, amount: 40000,
    photoExpectedSha256: item.photoSha256, photoExpectedBytes: photo.size, photoPath: '', photoReceivedAt: null as string | null, status: 'retrying_1c' };
  return { item, operation };
}

test('the portal receipt releases work before slow 1C completes; photo is acknowledged independently', async () => {
  const { item, operation } = await fixture();
  let started = false, metadataShown = false, posts = 0;
  let finish!: (value: Response) => void;
  const pending = new Promise<Response>(resolve => { finish = resolve; });
  const received = new Set<number>();
  const fetcher: typeof fetch = async (_url, init) => {
    if (init?.method === 'POST') { posts++; started = true; assert.ok(String(init.body).length < 1500); return pending; }
    if (init?.method === 'PATCH') {
      assert.ok(metadataShown, 'work must be released before attachment upload');
      const i = Number(new URL(String(_url), 'http://localhost').searchParams.get('chunk')); received.add(i);
      assert.ok((init.body as Blob).size <= CASH_PHOTO_CHUNK_BYTES);
      if (received.size === 2) { operation.photoPath = 'uploads/cash-operations/test.jpg'; operation.photoReceivedAt = new Date().toISOString(); }
      return Response.json({ operation });
    }
    return started ? Response.json({ operation, photo: { receivedChunks: [...received] } }) : new Response(null, { status: 404 });
  };
  const result = await transferEmployeeCash(item, { onMetadata: () => { metadataShown = true; assert.equal(operation.photoPath, ''); } }, fetcher);
  assert.equal(posts, 1); assert.equal(cashOutboxResponseAcknowledges(result, item), true);
  assert.equal(operation.status, 'retrying_1c', 'photo upload must not claim that 1C completed');
  finish(Response.json({ operation })); await pending;
});

test('a lost chunk response resumes the accepted photo without another financial POST', async () => {
  const { item, operation } = await fixture();
  const received = new Set([0]); let failed = false, posts = 0; const sent: number[] = [];
  const fetcher: typeof fetch = async (url, init) => {
    if (init?.method === 'POST') { posts++; throw new Error('financial retry must not occur'); }
    if (init?.method === 'PATCH') {
      const i = Number(new URL(String(url), 'http://localhost').searchParams.get('chunk')); sent.push(i); received.add(i);
      if (!failed) { failed = true; throw new Error('response lost'); }
      operation.photoPath = 'uploads/photo.jpg'; operation.photoReceivedAt = new Date().toISOString();
    }
    return Response.json({ operation, photo: { receivedChunks: [...received] } });
  };
  await assert.rejects(transferEmployeeCash(item, {}, fetcher));
  assert.equal(cashMetadataAcknowledges({ operation }, item), true);
  assert.equal(cashOutboxResponseAcknowledges({ operation }, item), false, 'metadata alone must never discard the retained photo');
  assert.ok(cashOutboxResponseAcknowledges(await transferEmployeeCash(item, {}, fetcher), item));
  assert.deepEqual(sent, [1, 1]); assert.equal(posts, 0);
});

test('a mismatched original photo or a legacy metadata-only receipt cannot clear v2 evidence', async () => {
  const { item, operation } = await fixture();
  for (const patch of [{ userId: 99 }, { workDayEntryId: 99 }, { photoExpectedSha256: 'a'.repeat(64) }, { photoExpectedBytes: 2 }]) {
    assert.equal(cashMetadataAcknowledges({ operation: { ...operation, ...patch } }, item), false);
  }
  assert.equal(cashOutboxResponseAcknowledges({ operation: { ...operation, photoPath: 'uploads/partial.jpg' } }, item), false);
  await assert.rejects(prepareEmployeeCashPhoto(new File(['not an image'], 'a.jpg', { type: 'image/jpeg' }), null));
});


test('the short money-intent path never uploads the photo or waits for attachment transport',async()=>{
 const {item,operation}=await fixture();let posts=0,patches=0,metadata=0,exists=false;
 const fetcher:typeof fetch=async(url,init)=>{
  if(init?.method==='POST'){posts++;exists=true;const body=JSON.parse(String(init.body));assert.equal(body.idempotencyKey,item.id);assert.equal(body.photoSha256,item.photoSha256);assert.equal(body.photoBytes,item.photo.size);assert.ok(String(init.body).length<1500);return Response.json({operation},{status:202});}
  if(init?.method==='PATCH'){patches++;throw Error('photo must have an independent lifecycle');}
  return exists?Response.json({operation}):new Response(null,{status:404});
 };
 const result=await saveEmployeeCashIntent(item,{onMetadata:()=>{metadata++;}},fetcher);
 assert.equal(posts,1);assert.equal(patches,0);assert.equal(metadata,1);
 assert.equal(cashMetadataAcknowledges(result,item),true);assert.equal(cashOutboxResponseAcknowledges(result,item),false);
});
