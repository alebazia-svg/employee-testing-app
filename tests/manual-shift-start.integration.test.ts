import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { prisma } from '../lib/prisma';
import { getMoscowDateKey, getMoscowMinutes, getShiftOption, getShiftOptionsForDepartment } from '../lib/workday';
import { changeWorkdayShift, getWorkdayShiftCorrectionState } from '../lib/workday-shift-change';

test('real start route accepts every department choice independently of plans, preserves QR facts and creates the selected checklist', {
  skip: process.env.MANUAL_SHIFT_START_TEST !== '1',
}, async () => {
  const url = new URL(process.env.DATABASE_URL!);
  assert.equal(url.hostname, '127.0.0.1'); assert.equal(url.port, '55481');
  assert.equal(url.pathname, '/manual_shift_test_20261104');
  assert.equal(await prisma.user.count(), 0, 'Dedicated empty localhost database required');
  assert.equal(await prisma.workdayPushSubscription.count(), 0);
  let currentUser: Awaited<ReturnType<typeof prisma.user.findUnique>> = null;
  const mocks: Record<string, unknown> = {
    'server-only': {}, '@/lib/auth': { getCurrentUser: async () => currentUser },
    '@/lib/prisma': { prisma }, './prisma': { prisma },
  };
  const bundled = await build({ entryPoints: ['app/api/employee/workday/start/route.ts'], bundle: true, write: false,
    platform: 'node', format: 'cjs', packages: 'external', plugins: [{ name: 'local-auth-only', setup(b) {
      b.onResolve({filter:/.*/}, a => a.path in mocks ? {path:a.path,external:true} : undefined);
    } }] });
  const mod = { exports: {} as { POST: (req: Request) => Promise<Response> } }, require = createRequire(import.meta.url);
  new Function('require', 'module', 'exports', bundled.outputFiles[0].text)((name: string) => name in mocks ? mocks[name] : require(name), mod, mod.exports);
  const date = getMoscowDateKey(), qrAcceptedAt = new Date(`${date}T10:56:00+03:00`);
  try {
    for (const department of ['retail','wholesale']) for (const shift of getShiftOptionsForDepartment(department)) {
      await prisma.shiftControlTemplate.create({data:{name:`Учебный ${shift.label}`,department,shiftCode:shift.code,
        tasks:{create:[{title:'Приёмка',category:'opening',sortOrder:1,plannedTimeMinutes:shift.startMinutes},
          {title:'Сдача',category:'handover',sortOrder:2,plannedTimeMinutes:shift.endMinutes}]}}});
    }
    for (const department of ['retail','wholesale']) for (const shift of getShiftOptionsForDepartment(department)) {
      for (const scenario of ['solo','empty-plan','colleague-started']) {
        const user = await prisma.user.create({data:{login:`proof-${department}-${shift.code}-${scenario}`,name:'Учебный менеджер',role:'EMPLOYEE',department,passwordHash:'disabled'}});
        currentUser = user;
        if (scenario !== 'empty-plan') await prisma.workScheduleEntry.create({data:{userId:user.id,date,department,status:'working'}});
        if (scenario === 'colleague-started') {
          const helper = await prisma.user.create({data:{login:'proof-helper',name:'Учебная подмена',role:'EMPLOYEE',department,passwordHash:'disabled'}});
          await prisma.workScheduleEntry.create({data:{userId:helper.id,date,department,status:'off'}});
          await prisma.workDayEntry.create({data:{userId:helper.id,date,department,shiftCode:'09_18',shiftLabel:'09:00-18:00',startedAt:new Date(`${date}T09:00:00+03:00`)}});
        }
        const intent = await prisma.workdayStartIntent.create({data:{userId:user.id,date,department,qrAcceptedAt,expiresAt:new Date(Date.now()+60000)}});
        const request = () => new Request('https://local.invalid/api/employee/workday/start',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({shiftCode:shift.code,startIntentId:intent.id,comment:'Учебный выбор смены'})});
        const response = await mod.exports.POST(request());
        assert.equal(response.status,200,`${department} ${shift.code} ${scenario}: ${await response.clone().text()}`);
        const result = await response.json();
        assert.equal(result.workDay.shiftCode,shift.code);
        assert.equal(new Date(result.workDay.startedAt).toISOString(),qrAcceptedAt.toISOString());
        assert.equal(result.workDay.lateMinutes,Math.max(0,getMoscowMinutes(qrAcceptedAt)-shift.startMinutes!));
        assert.equal(result.shiftControlRun.tasks.length,2);
        assert.equal(result.shiftControlRun.tasks[0].plannedTimeMinutes,shift.startMinutes);
        assert.equal(result.shiftControlRun.tasks[1].plannedTimeMinutes,shift.endMinutes);
        assert.equal((await prisma.workdayStartIntent.findUniqueOrThrow({where:{id:intent.id}})).consumedAt !== null,true);
        const replay = await mod.exports.POST(request());
        assert.equal(replay.status,200); assert.equal((await replay.json()).alreadyStarted,true);
        assert.equal(await prisma.workDayEntry.count({where:{userId:user.id}}),1);
        assert.equal(await prisma.shiftControlRun.count({where:{userId:user.id}}),1);
        // Existing five-minute correction guard still protects started checklist facts.
        const before = await prisma.workDayEntry.findUniqueOrThrow({where:{id:result.workDay.id}});
        const alternate = getShiftOptionsForDepartment(department).find(option=>option.code!==shift.code)!;
        const correction = await getWorkdayShiftCorrectionState({userId:user.id,department,date});
        assert.ok(correction.allowedShiftCodes.includes(alternate.code));
        await changeWorkdayShift({userId:user.id,department,date,toShiftCode:alternate.code,source:'employee',shiftControlEnabled:true});
        const after = await prisma.workDayEntry.findUniqueOrThrow({where:{id:before.id}});
        assert.equal(+after.startedAt,+before.startedAt); assert.equal(+after.qrAcceptedAt!,+qrAcceptedAt);
        assert.equal(after.shiftCode,alternate.code);
        const run = await prisma.shiftControlRun.findUniqueOrThrow({where:{workDayEntryId:before.id},include:{tasks:true}});
        await prisma.shiftControlTask.update({where:{id:run.tasks[0].id},data:{status:'done',completedAt:new Date(),numericValue:12345}});
        await assert.rejects(changeWorkdayShift({userId:user.id,department,date,toShiftCode:shift.code,source:'employee',shiftControlEnabled:true}),/уже начались действия/);
        assert.equal((await prisma.shiftControlTask.findUniqueOrThrow({where:{id:run.tasks[0].id}})).numericValue,12345);
        await prisma.user.deleteMany({where:{login:{startsWith:'proof-'}}});
      }
    }
    assert.equal(await prisma.workDayEntry.count(),0);
    const intentBundle=await build({entryPoints:['app/api/employee/workday/start-intent/route.ts'],bundle:true,write:false,
      platform:'node',format:'cjs',packages:'external',plugins:[{name:'local-intent-auth',setup(b){b.onResolve({filter:/.*/},a=>a.path in mocks?{path:a.path,external:true}:undefined);}}]});
    const intentModule={exports:{} as {POST:(req:Request)=>Promise<Response>}};
    new Function('require','module','exports',intentBundle.outputFiles[0].text)((name:string)=>name in mocks?mocks[name]:require(name),intentModule,intentModule.exports);
    currentUser=await prisma.user.create({data:{login:'proof-qr-reuse',name:'Учебный выбор другой смены',department:'wholesale',role:'EMPLOYEE',passwordHash:'disabled'}});
    await prisma.workScheduleEntry.create({data:{userId:currentUser.id,date,department:'wholesale',status:'working'}});
    const scan=()=>new Request('https://local.invalid/api/employee/workday/start-intent',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({qrPayload:'offonika-workday-start:wholesale'})});
    const first=await intentModule.exports.POST(scan());assert.equal(first.status,200);const firstQr=await first.json();
    const again=await intentModule.exports.POST(scan());assert.equal(again.status,200);const reused=await again.json();
    assert.equal(reused.reused,true);assert.equal(reused.startIntentId,firstQr.startIntentId);assert.equal(reused.qrAcceptedAt,firstQr.qrAcceptedAt);
    assert.deepEqual(reused.shiftSelection.allowedShiftCodes,['09_18','09_19','10_19']);
    assert.equal(await prisma.workdayStartIntent.count({where:{userId:currentUser.id}}),1);
    const chosen=reused.shiftSelection.allowedShiftCodes.find((code:string)=>!reused.shiftSelection.recommendedShiftCodes.includes(code));
    assert.ok(chosen,'at least one freely selectable alternative');
    const other=await mod.exports.POST(new Request('https://local.invalid/api/employee/workday/start',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({shiftCode:chosen,startIntentId:reused.startIntentId})}));
    assert.equal(other.status,200);assert.equal((await other.json()).workDay.shiftCode,chosen);
    assert.equal(getShiftOption('11_20').endMinutes,1200);
  } finally {
    await prisma.user.deleteMany({where:{login:{startsWith:'proof-'}}});
    await prisma.shiftControlTemplate.deleteMany({where:{name:{startsWith:'Учебный '}}});
    await prisma.$disconnect();
  }
});
