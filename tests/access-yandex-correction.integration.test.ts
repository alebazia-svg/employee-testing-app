import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {prisma} from '../lib/prisma';
import {recordPortalAccess,accessSessionIdentity} from '../lib/portal-access-journal';
import {createSessionToken} from '../lib/session';
if(process.env.DATABASE_URL!=='postgresql://postgres:access-demo-local-only@127.0.0.1:55504/access_demo')throw Error('Requires isolated access demo');
test('fresh Yandex correction stays within the exact bound session and preserves identity/auth/push/history',async()=>{
 const now=new Date(),code=randomUUID();
 const user=await prisma.user.create({data:{login:'yandex-test-'+randomUUID(),name:'Yandex test',role:'ADMIN',passwordHash:'not-login'}});
 const token=createSessionToken(user.id,+now),identity=accessSessionIdentity(token,user.id,now)!;
 const ua='Mozilla Macintosh Chrome/152.0.0.0 YaBrowser/26.10.0.0 Safari/537.36';
 try{
  const session=await prisma.portalAccessSession.create({data:{userId:user.id,sessionHash:identity.sessionHash,device:'Mac',browser:'Chrome',browserInstanceId:code,observedBrowserId:code,firstSeenAt:new Date(+now-120000),lastSeenAt:new Date(+now-120000),loginAt:new Date(+now-120000),pushState:'blocked',expiresAt:identity.expiresAt}});
  const other=await prisma.portalAccessSession.create({data:{userId:user.id,sessionHash:'old-'+randomUUID(),device:'Mac',browser:'Chrome',browserInstanceId:randomUUID(),expiresAt:identity.expiresAt}});
  const before=await prisma.portalAccessSession.findUniqueOrThrow({where:{id:session.id}});
  await prisma.portalAccessBrowserOwner.create({data:{browserInstanceId:code,ownerUserId:user.id,label:'Mac test',deviceGroupId:'test-group'}});
  const owner=await prisma.portalAccessBrowserOwner.findUnique({where:{browserInstanceId:code}});
  await recordPortalAccess({userId:user.id,token,browserInstanceId:code,userAgent:ua,now});
  const after=await prisma.portalAccessSession.findUniqueOrThrow({where:{id:session.id}});
  assert.equal(after.browser,'Яндекс');
  for(const field of ['sessionHash','browserInstanceId','userId','pushState','pushSubscriptionId','loginAt','firstSeenAt','expiresAt','loggedOutAt','isService','serviceMarkedAt','listArchivedAt'] as const)assert.deepEqual(after[field],before[field],field);
  assert.deepEqual(await prisma.portalAccessBrowserOwner.findUnique({where:{browserInstanceId:code}}),owner);
  assert.deepEqual(await prisma.portalAccessSession.findUnique({where:{id:other.id}}),other);
  await prisma.portalAccessSession.update({where:{id:session.id},data:{browser:'Chrome',lastSeenAt:new Date(+now-120000)}});
  await recordPortalAccess({userId:user.id,token,browserInstanceId:randomUUID(),userAgent:ua,now});
  assert.equal((await prisma.portalAccessSession.findUniqueOrThrow({where:{id:session.id}})).browser,'Chrome','mismatched browser cannot reclassify the bound history');
 }finally{await prisma.user.delete({where:{id:user.id}});await prisma.$disconnect();}
});
