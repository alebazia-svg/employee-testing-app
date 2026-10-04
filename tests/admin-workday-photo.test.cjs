const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync(path.join(__dirname, '../app/api/admin/workday/shift-control-photo/route.ts'), 'utf8');
const js = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true}}).outputText;
async function run(role, photo, missing = false) {
  const reads = [];
  const exports = {};
  vm.runInNewContext(js, {exports, URL, Response, process: {cwd: () => '/app'}, require: name => {
    if (name === 'path') return path;
    if (name === '@/lib/auth') return {getCurrentUser: async () => role ? {role} : null};
    if (name === 'fs/promises') return {readFile: async file => {reads.push(file); if (missing) throw Error('missing'); return Buffer.from('photo');}};
    throw Error(name);
  }});
  const response = await exports.GET(new Request(`https://test.invalid/photo?path=${encodeURIComponent(photo)}`));
  return {response, reads};
}
for (const folder of ['shift-control', 'cash-operations']) {
  test(`admin can view ${folder} photos`, async () => {
    const {response, reads} = await run('ADMIN', `uploads/${folder}/17/photo.jpg`);
    assert.equal(response.status, 200);
    assert.deepEqual(reads, [`/app/uploads/${folder}/17/photo.jpg`]);
    assert.equal(response.headers.get('content-type'), 'image/jpeg');
  });
}
for (const role of [null, 'EMPLOYEE']) test(`photo rejects role ${role}`, async () => {
  const {response, reads} = await run(role, 'uploads/cash-operations/17/photo.jpg');
  assert.equal(response.status, 403); assert.equal(reads.length, 0);
});
for (const photo of ['uploads/cash-operations/../../server.env', '/etc/passwd', 'uploads/other/photo.jpg', 'uploads/cash-operations-evil/photo.jpg']) test(`reject unsafe path ${photo}`, async () => {
  const {response, reads} = await run('ADMIN', photo);
  assert.equal(response.status, 400); assert.equal(reads.length, 0);
});
test('missing photo is reported, not treated as a loaded image', async () => {
  assert.equal((await run('ADMIN', 'uploads/cash-operations/17/missing.jpg', true)).response.status, 404);
});
