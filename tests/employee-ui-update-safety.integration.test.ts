import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {PrismaClient} from '@prisma/client';
import {build} from 'esbuild';
import {createSessionToken} from '../lib/session';
const url=process.env.PUSH_ACCESS_TEST_DB??'';
test('isolated PostgreSQL: UI heartbeat preserves targeted app update commands and all employee business records',{skip:!/^postgresql:\/\/postgres:push-sync-local-only@127\.0\.0\.1:55490\/push_sync_test$/.test(url)},async()=>{
 const db=new PrismaClient({datasources:{db:{url:url+'?connection_limit=2'}}}),marker='ui-update-'+randomUUID(),ids:number[]=[];
 const keys=['PORTAL_SESSION_SECRET','NEXT_PUBLIC_APP_VERSION','NEXT_PUBLIC_APP_BUILT_AT'] as const,old=keys.map(k=>process.env[k]);
 process.env.PORTAL_SESSION_SECRET='isolated-ui-updater-secret-at-least-32';process.env.NEXT_PUBLIC_APP_VERSION='1.0.2';process.env.NEXT_PUBLIC_APP_BUILT_AT='2026-11-08T00:00:00Z';
 try{
  const user=await db.user.create({data:{name:marker,login:marker,passwordHash:'not-login',role:'EMPLOYEE'}});ids.push(user.id);
  const now=new Date(),token=createSessionToken(user.id),browserId=randomUUID(),clientId=randomUUID();
  const ui={setup:'notifications',busy:false,error:null,online:true,sampledAt:now.toISOString()};
  const app={version:'1.0.1',builtAt:'2026-11-07T00:00:00Z',clientId,state:'current',ui};
  const session=await db.portalAccessSession.create({data:{userId:user.id,sessionHash:createHash('sha256').update('portal-access-v1:'+token).digest('hex'),device:'iPhone',browser:'Safari',browserInstanceId:browserId,observedBrowserId:browserId,expiresAt:new Date(now.getTime()+86400000),appObservation:app,appCheckedAt:now}});
  const mocks:Record<string,unknown>={'server-only':{},'./prisma':{prisma:db},'@/lib/prisma':{prisma:db}};
  const compiled=await build({entryPoints:['lib/portal-app-update-server.ts'],bundle:true,write:false,platform:'node',format:'cjs',packages:'external',plugins:[{name:'db',setup(b){b.onResolve({filter:/.*/},a=>a.path in mocks?{path:a.path,external:true}:undefined);}}]});
  const module={exports:{} as any},require=createRequire(import.meta.url);new Function('require','module','exports',compiled.outputFiles[0].text)((name:string)=>mocks[name]??require(name),module,module.exports);
  const server=module.exports,requested=await server.requestAppUpdate(session.id,123,now);assert.equal(requested.status,200);
  const command=requested.command;
  await server.observeAppUpdate(user.id,token,{...app,ui:{...ui,busy:true}},new Date(now.getTime()+1000),browserId);
  let saved=await db.portalAccessSession.findUniqueOrThrow({where:{id:session.id}});assert.equal((saved.appObservation as any).ui.busy,true);assert.equal((saved.appUpdateCommand as any).id,command.id);assert.equal((saved.appUpdateCommand as any).completedAt,undefined);
  await server.observeAppUpdate(user.id,token,{...app,clientId:randomUUID(),ui:{...ui,setup:'ready'}},new Date(now.getTime()+2000),browserId);
  saved=await db.portalAccessSession.findUniqueOrThrow({where:{id:session.id}});assert.equal((saved.appObservation as any).clientId,clientId,'another tab cannot replace the targeted report');
  await server.observeAppUpdate(user.id,token,{...app,version:'1.0.2',builtAt:'2026-11-08T00:00:00Z',commandId:command.id,ui:{...ui,setup:'ready'}},new Date(now.getTime()+3000),browserId);
  saved=await db.portalAccessSession.findUniqueOrThrow({where:{id:session.id}});assert.ok((saved.appUpdateCommand as any).completedAt);assert.equal((saved.appObservation as any).ui.setup,'ready');
  assert.equal(await db.workDayEntry.count({where:{userId:user.id}}),0);assert.equal(await db.workScheduleEntry.count({where:{userId:user.id}}),0);assert.equal(await db.workdayNotification.count({where:{userId:user.id}}),0);assert.equal(await db.workdayPushSubscription.count({where:{userId:user.id}}),0);
 }finally{await db.user.deleteMany({where:{id:{in:ids}}});await db.$disconnect();keys.forEach((k,i)=>old[i]===undefined?delete process.env[k]:process.env[k]=old[i]);}
});
