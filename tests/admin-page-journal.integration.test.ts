import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {prisma} from '../lib/prisma';
import {writeAdminVisit,readAdminJournal} from '../lib/admin-page-journal';
const expected='postgresql://postgres:access-demo-local-only@127.0.0.1:55504/access_demo';
if(process.env.DATABASE_URL!==expected)throw Error('Requires the isolated access demo database.');
test('real DB: exact browser binding, service separation, deduplication, summary/search/pagination and preservation',async()=>{
 const marker='admin-pages-'+Date.now(), now=new Date(), code=randomUUID(), codex=randomUUID(), codex2=randomUUID(), claude=randomUUID();
 const user=await prisma.user.create({data:{login:marker,name:'Journal test',role:'ADMIN',passwordHash:'not-login'}});
 const coverage=await prisma.portalActivityCoverage.findUnique({where:{id:2}});
 try{
  const session=await prisma.portalAccessSession.create({data:{userId:user.id,sessionHash:marker,device:'Mac',browser:'Chrome',browserInstanceId:code,observedBrowserId:code,pushState:'subscribed',expiresAt:new Date(+now+86400000)}});
  await prisma.portalAccessBrowserOwner.create({data:{browserInstanceId:code,ownerUserId:user.id,label:'Mac test',deviceGroupId:marker}});
  const before=await prisma.portalAccessSession.findUnique({where:{id:session.id}});
  assert.equal(await writeAdminVisit(user.id,marker,codex,{key:randomUUID(),page:'home'},now),false);
  assert.equal(await writeAdminVisit(user.id,marker,code,{key:'first-event',page:'home'},now),true);
  assert.equal(await writeAdminVisit(user.id,marker,code,{key:'reload-event',page:'home'},new Date(+now+1000)),true);
  assert.equal(await prisma.portalActivityEvent.count({where:{userId:user.id}}),1);
  assert.equal(await writeAdminVisit(user.id,marker,code,{key:'second-event',page:'employees',previous:'home'},new Date(+now+2000)),true);
  assert.equal(await writeAdminVisit(user.id,marker,code,{key:'return-event',page:'home',previous:'employees'},new Date(+now+3000)),true);
  assert.equal(await writeAdminVisit(user.id,marker,code,{key:'return-event',page:'home'},new Date(+now+60000)),true);
  assert.equal(await prisma.portalActivityEvent.count({where:{userId:user.id}}),3);
  assert.deepEqual(await prisma.portalAccessSession.findUnique({where:{id:session.id}}),before);
  assert.equal((await prisma.portalAccessBrowserOwner.findUnique({where:{browserInstanceId:code}}))?.label,'Mac test');
  for(const [id,name,group] of [[codex,'Служебный браузер Codex','service-test'],[codex2,'Служебный браузер Codex','service-test'],[claude,'Служебный браузер Claude','claude-test']]){
   await prisma.portalAccessSession.create({data:{userId:user.id,sessionHash:marker+id,device:'Mac',browser:'Chrome',browserInstanceId:id,observedBrowserId:id,isService:true,expiresAt:new Date(+now+86400000)}});
   await prisma.portalAccessBrowserOwner.create({data:{browserInstanceId:id,ownerUserId:user.id,label:name,deviceGroupId:group}});
   assert.equal(await writeAdminVisit(user.id,marker+id,id,{key:randomUUID(),page:'access'},new Date(+now+4000)),true);
  }
  const params=new URLSearchParams({browser:code,q:'Сотрудники'}),future=new Date(+now+120000);
  const search=await readAdminJournal(params,future);assert.equal(search.summary.count,3);assert.equal(search.summary.sections,2);assert.equal(search.matched,1);assert.equal(search.visits[0].page,'employees');
  const group=await readAdminJournal(new URLSearchParams({browser:codex,group:'1'}),future);assert.equal(group.summary.count,2);assert.ok(group.visits.every(v=>v.browserId!==claude));
  const service=await readAdminJournal(new URLSearchParams({scope:'service'}),future);assert.ok(service.visits.some(v=>v.browserId===claude));assert.ok(!service.visits.some(v=>v.browserId===code));
  for(let i=0;i<52;i++)await writeAdminVisit(user.id,marker,code,{key:randomUUID(),page:i%2?'home':'employees'},new Date(+now+180000+i*31000));
  const allNow=new Date(+now+4000000),first=await readAdminJournal(new URLSearchParams({browser:code}),allNow);
  assert.equal(first.visits.length,50);assert.equal(first.summary.count,55);assert.ok(first.nextCursor);
  const second=await readAdminJournal(new URLSearchParams({browser:code,cursor:first.nextCursor!}),allNow);assert.equal(second.visits.length,5);assert.equal(second.summary.count,55);assert.ok(!second.nextCursor);assert.ok(!second.visits.some(v=>first.visits.some(f=>f.id===v.id)));
  await prisma.portalAccessSession.update({where:{id:session.id},data:{observedBrowserId:codex}});
  assert.equal(await writeAdminVisit(user.id,marker,code,{key:randomUUID(),page:'home'},allNow),false);
  await prisma.portalAccessSession.update({where:{id:session.id},data:{observedBrowserId:code,loggedOutAt:now}});
  assert.equal(await writeAdminVisit(user.id,marker,code,{key:randomUUID(),page:'home'},allNow),false);
  await prisma.portalAccessSession.update({where:{id:session.id},data:{loggedOutAt:null,expiresAt:now}});
  assert.equal(await writeAdminVisit(user.id,marker,code,{key:randomUUID(),page:'home'},allNow),false);
  await prisma.user.update({where:{id:user.id},data:{role:'EMPLOYEE'}});
  assert.equal(await writeAdminVisit(user.id,marker+codex,codex,{key:randomUUID(),page:'home'},allNow),false);
  await assert.rejects(()=>readAdminJournal(new URLSearchParams('date=2026-02-30'),now),RangeError);
 }finally{await prisma.user.delete({where:{id:user.id}});if(!coverage)await prisma.portalActivityCoverage.deleteMany({where:{id:2}});await prisma.$disconnect();}
});
