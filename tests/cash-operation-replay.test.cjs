const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync(require('node:path').join(__dirname, '../app/api/employee/cash-operations/route.ts'), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
async function scenario(status, { oldWorkday = false, noCurrentDay = false, owner = 7, amount = '123', direction = 'deposit_safe', missing = false, failOneC = false, sourceWorkday = false, sourceOwner = 7, sourceDate = '2026-09-03', sourceStatus = 'active', sourceEndedAt = null, clientCreatedAt = null } = {}) {
  let calls = 0;
  let photoWrites = 0;
  let row = { id: 1, userId: owner, workDayEntryId: oldWorkday ? 19 : 20, date: oldWorkday ? '2026-09-03' : '2026-09-04',
    amount: 123, direction: 'deposit_safe', comment: '', status,
    oneCDocumentRef: status === 'posted_1c_pair' ? 'rko' : null, oneCReceiptDocumentRef: status === 'posted_1c_pair' ? 'pko' : null,
    createdAt: new Date('2026-09-03T15:00:00Z'), updatedAt: new Date() };
  const prisma = { workDayEntry: { findUnique: async ({where}) => {
    if (where.id) return {id:where.id,userId:sourceOwner,date:sourceDate,status:sourceStatus,endedAt:sourceEndedAt};
    if (noCurrentDay) return null;
    const date = where.userId_date.date;
    return date === '2026-09-04'
      ? { id: 20, userId: 7, date, status: 'active', endedAt: null }
      : { id: 19, userId: 7, date, status: 'completed', endedAt: new Date(`${date}T15:00:00Z`) };
  } }, cashOperation: {
    findUnique: async () => missing ? null : row, findUniqueOrThrow: async () => row,
    update: async ({data}) => (row = {...row, ...data}),
    create: async ({data}) => {
      assert.equal(missing, true, 'a replay must never create another record');
      return (row = {...row, ...data});
    },
  }, userOneCCashboxMapping: {findUnique: async () => ({isActive: true,oneCCashboxRef:'source'})} };
  prisma.$transaction = async fn => fn(prisma);
  const mocks = {
    '@/lib/auth': {getCurrentUser: async () => ({ id:7, department:'retail', name:'QA' })},
    '@/lib/prisma': {prisma},
    '@/lib/workday': {getMoscowDateKey: date => date ? date.toISOString().slice(0,10) : '2026-09-04', usesWorkdayShiftControl: () => true},
    '@/lib/image-upload': {requestBodyTooLarge: () => false, validateEmployeeImage: async () => ({extension:'jpg'})},
    '@/lib/cash-operation-admin-alert': {createCashOperationFailureAlert: async () => {}},
    '@/lib/workday-cash-encashment-resolution': {resolveCarriedCashEncashmentExceptions: async () => {}},
    '@/lib/one-c': {getCashStatementDimensions: async () => ({ok:true,organizations:[{ref:'org',name:'ОФФОНИКА'}],cashboxes:[{ref:'target',name:'Сейф депозитный'}]}),
      createOneCCashExpenseOrder: async () => {calls++;if(failOneC) throw new Error('1C unavailable');return {ok:true,pairComplete:true,document:{ref:'rko',number:'1'},receiptDocument:{ref:'pko',number:'2'}}; }},
  };
  const exports = {};
  vm.runInNewContext(js, { exports, require: name => {
    if (mocks[name]) return mocks[name];
    if (['crypto','path'].includes(name)) return require(name);
    if(name === 'fs/promises') return {mkdir:async()=>{},writeFile:async()=>{photoWrites++;}};
    throw new Error(`Unexpected import ${name}`);
  }, Response, Request, FormData, File, Date, Buffer, process: {cwd: () => '/tmp'} });
  const form = new FormData();
  form.set('direction',direction);form.set('amount',amount);form.set('idempotencyKey','c3564726-5261-45ce-b080-4fe68782b1e2');form.set('photo',new File(['qa'],'qa.jpg',{type:'image/jpeg'}));
  if(sourceWorkday){form.set('workDayEntryId','19');form.set('workDayDate',sourceDate);}
  if(clientCreatedAt) form.set('clientCreatedAt',clientCreatedAt);
  const result = await exports.POST(new Request('http://localhost/api/employee/cash-operations',{method:'POST',body:form}));
  return { http: result.status, calls, photoWrites, row, body: await result.json() };
}

for (const status of ['posted_1c_pair','manual_in_progress','resolved_manual','one_c_error','retrying_1c','pending_1c']) {
  for (const noCurrentDay of [false,true]) {
    test(`replay ${status} after date change, no current shift=${noCurrentDay}`, async () => {
      const result = await scenario(status, {oldWorkday:true,noCurrentDay});
      assert.equal(result.http, ['posted_1c_pair','resolved_manual'].includes(status) ? 200 : 202);
      assert.equal(result.calls,0);
      assert.equal(result.photoWrites,0);
      assert.equal(result.row.status,status);
      assert.equal(result.body.operation.workDayEntryId,19);
      assert.equal(result.body.operation.date,'2026-09-03');
    });
  }
}
test('same-day completed retry returns the original record without 1C writes',async()=>{
  const result=await scenario('posted_1c_pair');
  assert.equal(result.http,200); assert.equal(result.calls,0);
});
for (const options of [{owner:99},{amount:'124'},{direction:'phone_reserve'}]) {
  test(`replay refuses changed identity or parameters: ${JSON.stringify(options)}`,async()=>{
    const result=await scenario('manual_in_progress',options);
    assert.equal(result.http,409);assert.equal(result.calls,0);
    assert.equal(result.row.status,'manual_in_progress');
    assert.equal(result.body.operation,undefined);
  });
}
test('a genuinely new operation still requires a current workday',async()=>{
  const result=await scenario('pending_1c',{missing:true,noCurrentDay:true});
  assert.equal(result.http,400);assert.equal(result.calls,0);
});
test('a new offline operation after midnight stays attached to its original workday',async()=>{
  const result=await scenario('pending_1c',{missing:true,noCurrentDay:true,sourceWorkday:true,sourceDate:'2026-09-03'});
  assert.equal(result.http,202);assert.equal(result.calls,0);assert.equal(result.photoWrites,1);
  assert.equal(result.row.workDayEntryId,19);assert.equal(result.row.date,'2026-09-03');
  assert.equal(result.row.status,'one_c_error');
});
test('a delayed offline operation from an already closed shift waits for an administrator',async()=>{
  const result=await scenario('pending_1c',{
    missing:true,
    sourceWorkday:true,
    sourceDate:'2026-09-04',
    sourceStatus:'completed',
    sourceEndedAt:new Date('2026-09-04T15:00:00Z'),
  });
  assert.equal(result.http,202);assert.equal(result.calls,0);assert.equal(result.photoWrites,1);
  assert.equal(result.row.workDayEntryId,19);assert.equal(result.row.date,'2026-09-04');
  assert.equal(result.row.status,'one_c_error');
  assert.match(result.row.oneCError,/решение администратора/);
});
test('an outbox record saved by the previous PWA version recovers its original date from clientCreatedAt',async()=>{
  const result=await scenario('pending_1c',{
    missing:true,
    clientCreatedAt:'2026-09-03T17:55:00.000Z',
  });
  assert.equal(result.http,202);assert.equal(result.calls,0);assert.equal(result.photoWrites,1);
  assert.equal(result.row.workDayEntryId,19);assert.equal(result.row.date,'2026-09-03');
  assert.equal(result.row.status,'one_c_error');
});
test('an employee cannot attach a new operation to another employee workday',async()=>{
  const result=await scenario('pending_1c',{missing:true,sourceWorkday:true,sourceOwner:99});
  assert.equal(result.http,409);assert.equal(result.calls,0);assert.equal(result.photoWrites,0);
});
test('new operation still saves photo and creates one complete pair',async()=>{
  const result=await scenario('pending_1c',{missing:true});
  assert.equal(result.http,200);assert.equal(result.calls,1);
  assert.equal(result.photoWrites,1);assert.equal(result.row.status,'posted_1c_pair');
  assert.equal(result.row.workDayEntryId,20);
});
test('new operation still persists for server retry when 1C is unavailable',async()=>{
  const result=await scenario('pending_1c',{missing:true,failOneC:true});
  assert.equal(result.http,202);assert.equal(result.calls,1);
  assert.equal(result.photoWrites,1);assert.equal(result.row.status,'one_c_error');
  assert.equal(result.row.amount,123);
});
