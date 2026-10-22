import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

for (const [file, reader, refresher] of [
  ['daily-control', 'readPayrollOneCControl', 'refreshPayrollOneCControl'],
  ['attendance-preview', 'readPayrollAttendance', 'refreshPayrollAttendance'],
]) {
  const source = readFileSync(`app/api/admin/payroll/${file}/route.ts`, 'utf8');
  const compiled = ts.transpileModule(source.slice(source.indexOf('export async function GET')), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  test(`${file}: anonymous source refresh is denied before locking or reading`, async () => {
    const dependencies = {
      requireAdminApi: async () => ({ ok: false, response: Response.json({}, { status: 403 }) }),
      [reader]: async () => { throw Error('must not read'); },
      [refresher]: async () => { throw Error('must not refresh'); },
      withPayrollSourceLock: async () => { throw Error('must not lock'); },
    };
    const exports: Record<string, (request: Request) => Promise<Response>> = {};
    new Function('exports', ...Object.keys(dependencies), compiled)(exports, ...Object.values(dependencies));
    for (const method of ['GET', 'POST']) assert.equal((await exports[method](new Request('http://local/'))).status, 403);
  });
  test(`${file}: a busy writer returns conflict without a second refresh`, async () => {
    const dependencies = {
      requireAdminApi: async () => ({ ok: true }),
      [reader]: async () => Response.json({}),
      [refresher]: async () => { throw Error('must not refresh'); },
      withPayrollSourceLock: async () => null,
    };
    const exports: Record<string, (request: Request) => Promise<Response>> = {};
    new Function('exports', ...Object.keys(dependencies), compiled)(exports, ...Object.values(dependencies));
    assert.equal((await exports.POST(new Request('http://local/'))).status, 409);
  });
}
