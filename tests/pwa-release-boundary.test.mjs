import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';

const read = path => fs.readFileSync(path, 'utf8');
test('PWA compact mark preserves approved geometry and palette with an inner bevel', () => {
  const asset = fs.readFileSync('public/brand/mobo-master/mobo-symbol-copper-ui.svg');
  assert.equal(createHash('sha256').update(asset).digest('hex'), 'aebb312cbb4c759a712fa640a0025ccf0f3093509d4b66bbdfeffcc4f8dae929');
  const compact = read('public/brand/mobo-master/mobo-symbol-copper-compact.svg');
  assert.deepEqual([...compact.matchAll(/ d="([^"]+)"/g)].map(m => m[1]), [...asset.toString().matchAll(/ d="([^"]+)"/g)].map(m => m[1]));
  assert.deepEqual([...compact.matchAll(/stop-color="([^"]+)"/g)].map(m => m[1]), [...asset.toString().matchAll(/stop-color="([^"]+)"/g)].map(m => m[1]));
  assert.doesNotMatch(compact, /feDropShadow|<image/);
  assert.match(compact, /in="SourceAlpha" in2="down" operator="out"/);
  assert.match(compact, /feMergeNode in="lit"/);
  assert.match(read('app/(dashboard)/employee/EmployeePortalHeader.tsx'), /src='\/brand\/mobo-master\/mobo-symbol-copper-compact.svg'/);
  assert.doesNotMatch(read('public/pwa-copper.css'), /content:url\('\/brand\/mobo-master\/mobo-symbol-3d-light-ui.svg'\)/);
});
test('release contains no acceptance routes, seeds, design lab or test runner', () => {
  for (const path of ['app/api/employee/acceptance', 'app/api/employee/design-lab',
    'app/(dashboard)/employee/test-scenarios', 'ops/pwa-acceptance', 'lib/pwa-acceptance.ts',
    'lib/pwa-design-lab.ts', 'components/PwaVisualProposal.tsx', 'app/about-local-preview']) {
    assert.equal(fs.existsSync(path), false, path);
  }
});
test('approved appearance does not require a test account or environment', () => {
  const layout = read('app/(dashboard)/employee/layout.tsx');
  assert.match(layout, /EmployeeInterfaceStyle copper/);
  assert.doesNotMatch(layout, /pwa-test|isPwaAcceptance|isPwaDesignLab|PwaVisualProposal/);
  const client = read('app/(dashboard)/employee/EmployeeTodayClient.tsx');
  assert.doesNotMatch(client, /designLab|Имитировать QR|api\/employee\/design-lab/);
  assert.match(client, /getUserMedia/);
});
test('real fiscal verifier cannot substitute a simulated receipt', () => {
  const source = read('lib/kkm-shift-close-control.ts');
  const verifier = source.split('export async function verifyEmployeeKkmShiftClose')[1]
    .split('export function kkmShiftCloseFingerprint')[0];
  assert.doesNotMatch(verifier, /simulateKkmShiftClose|ENABLE_DEV_WORKDAY_TOOLS|kkm_test|pwa-test/);
  assert.match(verifier, /loadPlatformaOfdZReports/);
});
