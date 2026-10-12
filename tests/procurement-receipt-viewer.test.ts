import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {receiptPreviewMime,receiptFittedWidth} from '../lib/procurement-receipt-viewer';
test('only supported raster images and PDF can be rendered',()=>{
 for(const type of ['image/jpeg','image/png','image/webp','application/pdf'])assert.equal(receiptPreviewMime(type),type);
 assert.equal(receiptPreviewMime('Application/PDF; charset=binary'),'application/pdf');
 for(const type of ['image/svg+xml','text/html','application/javascript','','application/octet-stream'])assert.equal(receiptPreviewMime(type),null);
});
test('portrait receipt fits fully without initial upscaling; zoom is relative to fitted size',()=>{
 const image={width:590,height:1280},space={width:640,height:640};
 assert.equal(receiptFittedWidth(image,space,1),295);
 assert.equal(receiptFittedWidth(image,space,1.25),368.75);
 assert.equal(receiptFittedWidth({width:32,height:32},space,1),32);
});
test('landscape, mobile and zoom limits remain bounded',()=>{
 assert.equal(receiptFittedWidth({width:1600,height:800},{width:900,height:600},1),900);
 assert.equal(receiptFittedWidth({width:590,height:1280},{width:300,height:590},1),590*590/1280);
 assert.equal(receiptFittedWidth({width:100,height:100},{width:500,height:500},5),300);
 assert.equal(receiptFittedWidth({width:100,height:100},{width:500,height:500},.5),100);
});
test('unmeasured or invalid geometry never produces Infinity or invalid CSS',()=>{
 assert.equal(receiptFittedWidth({width:0,height:10},{width:300,height:500},1),undefined);
 assert.equal(receiptFittedWidth({width:10,height:10},{width:-1,height:500},1),undefined);
 assert.equal(receiptFittedWidth({width:10,height:10},{width:300,height:500},NaN),undefined);
});
const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('ordinary receipt UI opens viewer without preview flags or demo documents',()=>{
 const source=read('components/ProcurementReceipts.tsx');
 assert.match(source,/setViewFile\(\{file,supplier:plan.supplierPartner\}\)/);
 assert.match(source,/<ProcurementReceiptViewer/);
 assert.doesNotMatch(source,/VisualPreview|local-viewer-example|receipt-file|receipt-preview-sample/);
 assert.match(source,/if\(inline\)return content/);
});
test('viewing only reads existing authenticated attachment; download stays explicit',()=>{
 const source=read('components/ProcurementReceiptViewer.tsx');
 assert.match(source,/credentials:'same-origin'/);
 assert.match(source,/download=\{name\}/);
 assert.match(source,/URL.revokeObjectURL/);
 assert.match(source,/abort.abort\(\)/);
 assert.doesNotMatch(source,/method:\s*['"](?:POST|PUT|PATCH|DELETE)/);
 const route=read('app/api/procurement/payment-plans/[id]/receipts/[receiptId]/route.ts');
 assert.match(route,/getCurrentUser/);
 assert.match(route,/readProcurementReceipt\(prisma,user/);
 assert.match(route,/private, no-store/);
 assert.match(route,/attachment/);
});
test('PDF is rendered locally only on demand with cancellation, without active PDF content',()=>{
 const source=read('components/useReceiptPdf.ts');
 assert.match(source,/if\(!source\|\|!enabled\)return/);
 assert.match(source,/import\(/);
 assert.match(source,/isEvalSupported:false/);
 assert.match(source,/enableXfa:false/);
 assert.match(source,/loading\?\.destroy/);
 assert.match(source,/render\?\.cancel/);
 assert.match(source,/clearTimeout\(timeout\)/);
 assert.doesNotMatch(source,/https?:\/\//);
});
test('receipt notifications reuse their dialog and restore payment context on return',()=>{
 const source=read('components/NotificationRecordDialog.tsx');
 assert.match(source,/hidden=\{receiptPreview\}/);
 assert.match(source,/single inline onPreviewChange=\{setReceiptPreview\}/);
 const receipt=read('components/ProcurementReceipts.tsx');
 assert.match(receipt,/onPreviewChange\?\.\(!!viewFile\)/);
});
