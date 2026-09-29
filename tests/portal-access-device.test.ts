import test from 'node:test';
import assert from 'node:assert/strict';
import { accessDevice, accessPushLabel } from '../lib/portal-access-device';
test('reported devices and browsers stay coarse, desktop iPad ambiguity stays explicit', () => {
  const cases = [
    ['Mozilla Macintosh AppleWebKit Chrome/153 Safari/537 Edg/153', 'Mac', 'Edge'],
    ['Mozilla iPhone AppleWebKit Version/18 Safari/605', 'iPhone', 'Safari'],
    ['Mozilla iPad AppleWebKit CriOS/150 Safari/605', 'iPad', 'Chrome'],
    ['Mozilla Macintosh AppleWebKit Version/18 Safari/605', 'Mac / iPad', 'Safari'],
    ['Mozilla Android Mobile Chrome/145', 'Телефон Android', 'Chrome'],
    ['Mozilla Windows NT Chrome/153 Edg/153', 'Компьютер Windows', 'Edge'],
    ['Mozilla Android Chrome/100 SamsungBrowser/21', 'Планшет Android', 'Samsung Internet'],
    ['Mozilla Linux Firefox/100', 'Компьютер Linux', 'Firefox'],
    ['', 'Устройство не определено', 'Браузер не определён'],
  ];
  for (const [ua, device, browser] of cases) assert.deepEqual(accessDevice(ua), { device, browser });
  assert.deepEqual(accessDevice('<script>private IP password</script>'), { device: 'Устройство не определено', browser: 'Браузер не определён' });
});
test('a subscription moved to another account or disabled is not reported as connected', () => {
  assert.equal(accessPushLabel('connected', { userId: 1, disabledAt: null }, 1), 'Подключены');
  for (const sub of [null, { userId: 2, disabledAt: null }, { userId: 1, disabledAt: new Date() }]) assert.equal(accessPushLabel('connected', sub, 1), 'Подписка не активна');
  assert.equal(accessPushLabel('unknown', null, 1), 'Не проверены');
  assert.equal(accessPushLabel('blocked', null, 1), 'Запрещены в браузере');
});
