import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

function load(source: string) {
  const compiled = ts.transpileModule(source + '\nexport { UploadStatusNotice };', { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const realRequire = createRequire(import.meta.url);
  const exports: Record<string, any> = {};
  const requireModule = (id: string) => id === 'next/navigation' ? { useRouter: () => ({ refresh() {} }) } : realRequire(id.startsWith('@/') ? path.resolve(id.slice(2)) : id);
  new Function('require', 'exports', compiled)(requireModule, exports);
  return exports;
}
const sourcePath = 'app/(dashboard)/admin/taxes/TaxDocumentUpload.tsx';

test('a delayed result is not presented as a failure or success; confirmed states retain their labels', () => {
  const { UploadStatusNotice } = load(readFileSync(sourcePath, 'utf8'));
  const base = { attempt: 1, owner: 'form', ownerVisible: true, fileName: 'income.xlsx', changes: [], message: 'Still checking' };
  const html = (progress: string) => renderToStaticMarkup(React.createElement(UploadStatusNotice, { status: { ...base, progress } }));
  assert.match(html('waiting'), /Файл принят/);
  assert.match(html('waiting'), /Still checking/);
  assert.doesNotMatch(html('waiting'), /Файл не обработан|Готово/);
  assert.match(html('failed'), /Файл не обработан/);
  assert.match(html('done'), /Готово/);
  assert.equal(html('sending'), '');
});
