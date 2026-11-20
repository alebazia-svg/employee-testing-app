import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readdir, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildDailyFiscalReport } from '../lib/terminal-fiscal-daily-report';
import { compareFiscalSettlement } from '../lib/terminal-fiscal-settlement';
import { readFiscalReport, writeFiscalReport, validFiscalDay, type SavedFiscalReport } from '../lib/terminal-fiscal-report-cache';

test('persistent fiscal cache preserves last full snapshot, isolates sources and rejects corrupt snapshots', async()=>{
 const directory=await mkdtemp(path.join(tmpdir(),'fiscal-report-test-'));
 const prior=process.env.FISCAL_REPORT_CACHE_DIR;
 const source=process.env['1C_BASE_URL'];
 process.env.FISCAL_REPORT_CACHE_DIR=directory;
 process.env['1C_BASE_URL']='http://local-fixture.invalid';
 const day='2026-10-12';
 const base=buildDailyFiscalReport({from:new Date(`${day}T00:00:00+03:00`),to:new Date('2026-10-13T00:00:00+03:00'),parts:[]});
 const report:SavedFiscalReport={...base,complete:{bank:true,oneC:true,ofd:true},sourceComplete:{bank:true,oneC:true,ofd:true},configurationComplete:true,updatedAt:new Date().toISOString(),settlement:{...compareFiscalSettlement(null,{from:day,to:day,fiscalKopecks:0,fiscalComplete:true}),complete:true}};
 try {
  assert.equal(await readFiscalReport(day),null);
  assert.equal(await writeFiscalReport(day,{...report,settlement:{...report.settlement,complete:false}}),true);
  assert.equal((await readFiscalReport(day))?.settlement.complete,false);
  assert.equal(await writeFiscalReport(day,report),true);
  assert.deepEqual(await readFiscalReport(day),{...report,settlementUpdatedAt:report.updatedAt});
  assert.equal(await writeFiscalReport(day,{...report,complete:{...report.complete,ofd:false},sourceComplete:{...report.sourceComplete,ofd:false}}),false);
  assert.deepEqual(await readFiscalReport(day),{...report,settlementUpdatedAt:report.updatedAt});
  assert.equal(await writeFiscalReport(day,{...report,settlement:{...report.settlement,complete:false}}),true);
  assert.equal((await readFiscalReport(day))?.settlementReused,true);
  assert.equal((await readFiscalReport(day))?.settlement.complete,true);
  const unresolved={...report,complete:{...report.complete,oneC:false},unlinkedAcquiringCount:1,unlinkedAcquiringKopecks:50000,status:'incomplete' as const};
  assert.equal(await writeFiscalReport(day,unresolved),true);
  assert.equal((await readFiscalReport(day))?.unlinkedAcquiringCount,1);
  assert.equal((await readFiscalReport(day))?.complete.oneC,false);
  assert.equal(await writeFiscalReport(day,report),true);
  process.env['1C_BASE_URL']='http://other-local-fixture.invalid';
  assert.equal(await readFiscalReport(day),null);
  process.env['1C_BASE_URL']='http://local-fixture.invalid';
  const [scope]=await readdir(directory);
  const target=path.join(directory,scope,`${day}.json`);
  const saved=JSON.parse(await readFile(target,'utf8'));
  assert.ok(saved.algorithmVersion);
  await writeFile(target,JSON.stringify({...saved,algorithmVersion:'obsolete-rules'}));
  assert.equal(await readFiscalReport(day),null);
  assert.equal(await writeFiscalReport(day,report),true);
  assert.deepEqual(await readFiscalReport(day),{...report,settlementUpdatedAt:report.updatedAt});
  delete saved.algorithmVersion;
  await writeFile(target,JSON.stringify(saved));
  assert.equal(await readFiscalReport(day),null);
  await writeFile(path.join(directory,scope,`${day}.json`),'broken');
  assert.equal(await readFiscalReport(day),null);
  await assert.rejects(()=>readFiscalReport('../../escape'));
  assert.equal(validFiscalDay('2026-02-30'),false);
  assert.equal(validFiscalDay(day),true);
 } finally {
  if(prior===undefined)delete process.env.FISCAL_REPORT_CACHE_DIR;else process.env.FISCAL_REPORT_CACHE_DIR=prior;
  if(source===undefined)delete process.env['1C_BASE_URL'];else process.env['1C_BASE_URL']=source;
  await rm(directory,{recursive:true,force:true});
 }
});
