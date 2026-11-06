import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import JSZip from 'jszip';
import { publishTaxTelegramContext } from '../lib/tax-telegram-context';

test('publishes only verified current review and invalidates a newer broken review', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'tax-telegram-'));
  try {
    const raw = { schema:1, cutoff:'2026-05-31',reviewedAt:'2026-06-02', q1UsnCents:100000000,q1PsnCents:1900000000,
      months:[{periodKey:'2026-04',fnsCents:3000000000,paymentsCents:4100000000},{periodKey:'2026-05',fnsCents:1100000000,paymentsCents:100000000}],
      fnsCrossing:'2026-05-12',paymentsCrossing:'2026-04-29', bridge:[{title:'Разница',cents:100000000,note:'Для проверки'}],
      findings:[{title:'Проверка',status:'open',detail:'Связь не подтверждена',action:'Проверить',sourceName:'source.zip'}],
      sources:[{title:'Источник',originalName:'source.zip',purpose:'Документы'}] };
    const zip = new JSZip();zip.file('tax-management-review.json',JSON.stringify(raw));
    const bytes = await zip.generateAsync({type:'nodebuffer'});await writeFile(path.join(root,'review.zip'),bytes);
    const review = {id:'review',documentType:'CORRECTION_EVIDENCE',status:'UPLOADED',originalName:'AUSN_management_review_test.zip',storageKey:'review.zip',sha256:createHash('sha256').update(bytes).digest('hex'),createdAt:new Date('2026-06-02')};
    const source = {...review,id:'source',originalName:'source.zip',createdAt:new Date('2026-05-31')};
    const target = path.join(root,'intake','telegram-management-review.json');
    assert.deepEqual(await publishTaxTelegramContext([review,source],target,root),{state:'ready',changed:true});
    assert.equal(JSON.parse(await readFile(target,'utf8')).q1PsnCents,1900000000);
    assert.equal((await stat(target)).mode & 0o777, 0o640);
    assert.deepEqual(await publishTaxTelegramContext([review,source],target,root),{state:'ready',changed:false});
    const newer = {...review,id:'newer',createdAt:new Date('2026-06-03'),sha256:'0'.repeat(64)};
    assert.deepEqual(await publishTaxTelegramContext([review,source,newer],target,root),{state:'unavailable',changed:true});
    assert.equal(JSON.parse(await readFile(target,'utf8')).schema,0);
    assert.deepEqual(await readFile(path.join(root,'review.zip')),bytes);
  } finally { await rm(root,{recursive:true,force:true}); }
});
