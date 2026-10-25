import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {build} from 'esbuild';

// Uses an isolated browser context and bundled component, never a portal or DB.
// Set PROCUREMENT_TEST_PLAYWRIGHT to a Playwright module path; optionally set
// PROCUREMENT_TEST_BROWSER to a locally installed Chromium executable.
test('receipt picker: direct upload, exact links, cancellation, retry and multiple payments', {
  skip: !process.env.PROCUREMENT_TEST_PLAYWRIGHT,
}, async () => {
  const {chromium} = createRequire(import.meta.url)(process.env.PROCUREMENT_TEST_PLAYWRIGHT!);
  const bundle = await build({
    stdin: {resolveDir: process.cwd(), loader: 'tsx', contents: `
      import React from 'react';
      import {createRoot} from 'react-dom/client';
      import {flushSync} from 'react-dom';
      import {ProcurementDocumentSections} from './components/ProcurementDocumentSections';
      const root=createRoot(document.getElementById('root'));
      let sequence=0;
      window.mount=(options={})=>{
        window.saved=[]; window.changed=[]; window.uploadOk=true;
        const {count=1,method='USDT',admin=true,disabled=false,currency=false,files=[]}=options;
        const payments=Array.from({length:count},(_,i)=>({ref:'payment-'+i,number:'RKO-'+i,amount:50,date:'2026-10-25'}));
        flushSync(()=>root.render(<ProcurementDocumentSections key={++sequence}
          plan={{id:'isolated',supplierPartner:'Test',plannedAmount:100,orderNumbers:[],
            plannedDate:'2026-10-25',status:'APPROVED',paymentMethod:method,
            evidence:{state:count?'PARTIALLY_ISSUED':'NO_EVIDENCE',issuedAmount:count?50:0,
              cashOrders:currency?[]:payments,currencyPayments:currency?payments:[]}}}
          files={files} admin={admin} disabled={disabled} today="2026-10-25"
          onOpen={()=>{}} onChange={async(file,action,purpose)=>{window.changed.push({id:file.id,action,purpose});return true;}}
          onAdd={async(files,purpose,replacement,refs)=>{
            window.saved.push({names:files.map(f=>f.name),purpose,replacement,refs});
            return window.uploadOk;
          }}/>));
      };
    `}, bundle: true, write: false, platform: 'browser', format: 'iife',
    define: {'process.env.NODE_ENV': '"test"'},
  });
  const browser = await chromium.launch({headless:true, ...(process.env.PROCUREMENT_TEST_BROWSER?{executablePath:process.env.PROCUREMENT_TEST_BROWSER}:{})});
  try {
    const page = await browser.newPage();
    await page.setContent('<div id="root"></div>');
    await page.addScriptTag({content:bundle.outputFiles[0].text});
    const mount = (options:Record<string,unknown>)=>page.evaluate((o:unknown)=>(window as any).mount(o),options);
    const saved = ()=>page.evaluate(()=>(window as any).saved);
    const picker = async(name='Добавить чек')=>{
      const event=page.waitForEvent('filechooser');
      await page.getByRole('button',{name,exact:true}).click();
      return event;
    };
    const file={name:'receipt.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.7\n%%EOF')};
    for(const admin of [true,false])for(const currency of [false,true]){
      await mount({admin,currency});
      // Switching from requisites must not retain their purpose for this upload.
      await (await picker('Добавить реквизиты')).setFiles([]);
      const chooser=await picker();
      assert.equal(await page.getByText('Чек за оплату',{exact:true}).count(),0);
      await chooser.setFiles(file);
      assert.deepEqual(await saved(),[{names:['receipt.pdf'],purpose:'RECEIPT',replacement:undefined,refs:[`${currency?'currency':'cash'}:payment-0`]}]);
      // A cancelled chooser saves nothing; the same file can then be selected again.
      await (await picker()).setFiles([]);
      assert.equal((await saved()).length,1);
      await page.evaluate(()=>(window as any).uploadOk=false);
      await (await picker()).setFiles(file);
      await page.evaluate(()=>(window as any).uploadOk=true);
      await (await picker()).setFiles(file);
      assert.equal((await saved()).length,3);
    }
    await mount({count:0,method:'ACCOUNTABLE_QR'});
    await (await picker()).setFiles(file);
    assert.deepEqual((await saved())[0].refs,['pending-qr']);
    await mount({count:2});
    await page.getByRole('button',{name:'Добавить чек',exact:true}).click();
    assert.equal(await page.getByRole('checkbox').count(),2);
    assert.equal(await page.getByRole('button',{name:'Выбрать чек',exact:true}).isDisabled(),true);
    await page.getByRole('checkbox').nth(1).check();
    const multiple=page.waitForEvent('filechooser');
    await page.getByRole('button',{name:'Выбрать чек',exact:true}).click();
    await (await multiple).setFiles(file);
    assert.deepEqual((await saved())[0].refs,['cash:payment-1']);
    for(const admin of [true,false])for(const method of ['USDT','CNY','BANK']){
      await mount({admin,method});
      await (await picker('Добавить реквизиты')).setFiles(file);
      assert.deepEqual(await saved(),[{names:['receipt.pdf'],purpose:method==='BANK'?'REQUISITES':'QR',replacement:undefined,refs:undefined}]);
      assert.equal(await page.getByText('Что добавляем',{exact:true}).count(),0);
      assert.equal(await page.getByRole('button',{name:'Выбрать файл',exact:true}).count(),0);
      // Switching back from a receipt must reset its payment reference/purpose.
      await (await picker()).setFiles([]);
      await (await picker('Добавить реквизиты')).setFiles(file);
      assert.deepEqual((await saved())[1],(await saved())[0]);
    }
    const previous={id:'old',planId:'isolated',purpose:'REQUISITES',originalName:'old.pdf',size:30,createdAt:'2026-10-20',author:{name:'Test'}};
    await mount({files:[previous]});
    await (await picker('Заменить')).setFiles(file);
    assert.deepEqual((await saved())[0],{names:['receipt.pdf'],purpose:'REQUISITES',replacement:previous,refs:undefined});
    await (await picker()).setFiles(file);
    assert.equal((await saved())[1].replacement,undefined);
    for(const method of ['USDT','CNY','BANK']){
      await mount({method,files:[{...previous,purpose:'RECEIPT'}]});
      await page.getByRole('button',{name:'Это реквизиты',exact:true}).click();
      assert.equal(await page.getByRole('radio').count(),0);
      assert.equal(await page.getByText(/QR кошелька|Реквизиты кошелька|QR Alipay|Другие реквизиты/).count(),0);
      await page.getByRole('button',{name:'Отмена',exact:true}).click();
      assert.deepEqual(await page.evaluate(()=>(window as any).changed),[]);
      await page.getByRole('button',{name:'Это реквизиты',exact:true}).click();
      await page.getByRole('button',{name:'Да, это реквизиты',exact:true}).click();
      assert.deepEqual(await page.evaluate(()=>(window as any).changed),[{id:'old',action:'CLASSIFY',purpose:method==='BANK'?'REQUISITES':'QR'}]);
    }
    await mount({count:0,method:'USDT'});
    assert.equal(await page.getByRole('button',{name:'Добавить чек',exact:true}).count(),0);
    await mount({disabled:true});
    assert.equal(await page.getByRole('button',{name:'Добавить чек',exact:true}).isDisabled(),true);
  } finally {await browser.close();}
});
