import 'server-only';
import {createHash, randomUUID} from 'node:crypto';
import {mkdir, readFile, rename, writeFile, unlink} from 'node:fs/promises';
import path from 'node:path';
import {planningCachePath} from './procurement-planning-cache';

// Presentation only. Never read by mutation validation or financial matching.
export type BuyerDisplayBucket = 'planning' | 'balances' | 'delivery';
export type BuyerDisplayRecord<T> = {schema:1; scope:string; bucket:BuyerDisplayBucket; startedAt:number; savedAt:string; data:T};
const MAX_AGE = 7 * 86400000;
const writes = new Map<string, Promise<void>>();
export function validBuyerDisplayRecord<T>(value:unknown, scope:string, bucket:BuyerDisplayBucket, now=Date.now()):value is BuyerDisplayRecord<T> {
  const row=value as BuyerDisplayRecord<T> | null;
  const age=now-Date.parse(row?.savedAt ?? '');
  return !!row && row.schema===1 && row.scope===scope && row.bucket===bucket
    && Number.isFinite(row.startedAt) && row.startedAt<=now+60000
    && Number.isFinite(age) && age>=-60000 && age<=MAX_AGE
    && !!row.data && typeof row.data==='object';
}
function target(scope:string,bucket:BuyerDisplayBucket) {
  const base=planningCachePath();
  return `${base}.buyer-display-${createHash('sha256').update(scope).digest('hex')}-${bucket}.json`;
}
export async function readBuyerDisplay<T>(scope:string,bucket:BuyerDisplayBucket):Promise<BuyerDisplayRecord<T>|null> {
  try {const row=JSON.parse(await readFile(target(scope,bucket),'utf8'));return validBuyerDisplayRecord<T>(row,scope,bucket)?row:null;} catch{return null;}
}
export async function writeBuyerDisplay<T>(scope:string,bucket:BuyerDisplayBucket,data:T,startedAt:number) {
  let file:string;try{file=target(scope,bucket);}catch{return;}
  const previous=writes.get(file)??Promise.resolve();
  const next=previous.catch(()=>{}).then(async()=>{
    const old=await readBuyerDisplay<T>(scope,bucket);
    if(old && old.startedAt>startedAt)return;
    await mkdir(path.dirname(file),{recursive:true,mode:0o700});
    const temp=`${file}.${randomUUID()}.tmp`;
    try {
      await writeFile(temp,JSON.stringify({schema:1,scope,bucket,startedAt,savedAt:new Date().toISOString(),data}),{mode:0o600,flag:'wx'});
      await rename(temp,file);
    } finally {await unlink(temp).catch(()=>{});}
  }).catch(()=>{});
  writes.set(file,next);
  await next;
  if(writes.get(file)===next)writes.delete(file);
}
