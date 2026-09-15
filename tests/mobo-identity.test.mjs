import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

const requiredIdentityAssets = [
  'public/brand/mobo-master/mobo-symbol.svg',
  'public/brand/mobo-master/mobo-wordmark.svg',
  'public/brand/mobo-master/mobo-logo-horizontal.svg',
  'public/brand/mobo-master/mobo-symbol-3d-premium.svg',
  'public/portal-app-icon-180.png',
  'public/portal-app-icon-192.png',
  'public/portal-app-icon-512.png',
  'public/portal-app-icon-maskable-512.png',
  'public/favicon-32x32.png',
];

test('approved MOBO identity assets and PWA metadata stay connected', async () => {
  await Promise.all(requiredIdentityAssets.map((path) => access(path)));

  const [manifestText, layoutSource, loginSource, identitySource, adminSource, procurementSource, employeeHeaderSource, employeeSource, brandStyles, serviceWorkerSource, dimensionalSymbol, flatSymbol, horizontalLogo, wordmark] = await Promise.all([
    readFile('public/manifest.webmanifest', 'utf8'),
    readFile('app/layout.tsx', 'utf8'),
    readFile('app/login/page.tsx', 'utf8'),
    readFile('components/PortalIdentityBlock.tsx', 'utf8'),
    readFile('components/AdminShell.tsx', 'utf8'),
    readFile('components/ProcurementShell.tsx', 'utf8'),
    readFile('app/(dashboard)/employee/EmployeePortalHeader.tsx', 'utf8'),
    readFile('app/(dashboard)/employee/EmployeeTodayClient.tsx', 'utf8'),
    readFile('app/mobo-brand.css', 'utf8'),
    readFile('public/workday-sw.js', 'utf8'),
    readFile('public/brand/mobo-master/mobo-symbol-3d-premium.svg', 'utf8'),
    readFile('public/brand/mobo-master/mobo-symbol.svg', 'utf8'),
    readFile('public/brand/mobo-master/mobo-logo-horizontal.svg', 'utf8'),
    readFile('public/brand/mobo-master/mobo-wordmark.svg', 'utf8'),
  ]);

  const manifest = JSON.parse(manifestText);
  assert.equal(manifest.name, 'MOBO · Портал компании');
  assert.equal(manifest.short_name, 'MOBO');
  assert.deepEqual(manifest.icons.map((icon) => icon.src), [
    '/portal-app-icon-192.png',
    '/portal-app-icon-512.png',
    '/portal-app-icon-maskable-512.png',
  ]);
  assert.match(layoutSource, /applicationName: 'MOBO'/);
  assert.match(loginSource, /mobo-symbol-3d-premium\.svg/);
  assert.match(loginSource, /mobo-wordmark\.svg/);
  assert.match(loginSource, /grid w-\[326px\][\s\S]*?sm:w-\[110px\][\s\S]*?Портал компании/);
  assert.match(loginSource, /data\.portalArea === 'PROCUREMENT' \? '\/procurement'/);
  for (const symbolSource of [dimensionalSymbol, flatSymbol, horizontalLogo]) {
    assert.match(symbolSource, /feMorphology[\s\S]*?operator="erode" radius="5"/);
  }
  for (const wordmarkSource of [wordmark, horizontalLogo]) {
    assert.match(wordmarkSource, /operator="dilate" radius="1\.35"/);
  }
  assert.match(identitySource, /\/brand\/mobo-master\/mobo-logo-horizontal\.svg/);
  assert.match(adminSource, /PortalIdentityBlock variant='mobo-master'/);
  assert.match(procurementSource, /PortalIdentityBlock variant='mobo-master-material'/);
  assert.match(employeeHeaderSource, /employee-material-profile-initials/);
  assert.match(employeeSource, /function ColleaguesGlyph\(\)[\s\S]*?portal-brand-strong[\s\S]*?portal-brand-colleague-blue/);
  assert.match(employeeSource, /secondaryColor=\{active \? 'var\(--portal-brand-colleague-blue\)' : '#b6babd'\}/);
  assert.match(brandStyles, /--portal-brand-colleague-blue: #829fbd;/);
  assert.match(brandStyles, /--portal-brand-qr-blue: #b8cce0;/);
  assert.doesNotMatch(serviceWorkerSource, /pwa-wordmark-blue/);
  assert.match(serviceWorkerSource, /icon: '\/portal-app-icon-192\.png'/);
});
