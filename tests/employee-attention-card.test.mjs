import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const client = readFileSync(new URL('../app/(dashboard)/employee/EmployeeTodayClient.tsx', import.meta.url), 'utf8');
const card = readFileSync(new URL('../components/EmployeeAttentionSummaryCard.tsx', import.meta.url), 'utf8');

test('attention card keeps direct single-task navigation and grouped multi-task navigation', () => {
  assert.match(client, /attentionCount > 0 && !showCloseResolution/);
  assert.match(client, /attentionCount === 1 \? attentionItems\[0\]\.title/);
  assert.match(client, /attentionCount === 1 \? attentionItems\[0\]\.meta/);
  assert.match(client, /if \(attentionCount === 1\) \{ router\.push\(attentionItems\[0\]\.href\); return; \}/);
  assert.match(client, /requiredIssuesForBanner\.every\(\(issue\) => issue\.ruleKey === 'credit_realization_mismatch'\)/);
  assert.match(client, /Проверьте задачи: \$\{attentionCount\}/);
  assert.match(client, /'Проверить чеки' : 'Посмотреть задачи'/);
  assert.match(card, /DangerTriangleIcon.*color='#a85a08'.*secondaryColor='#f6d58b'/);
});

test('receipt endings use the actual employee count helper', () => {
  const body = client.match(/function countWord\([^)]*\) \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(body);
  const countWord = new Function('count', 'one', 'few', 'many', body);
  for (const [count, expected] of [[1,'чек'],[2,'чека'],[3,'чека'],[4,'чека'],[5,'чеков'],[11,'чеков'],[14,'чеков'],[21,'чек'],[22,'чека'],[25,'чеков']]) {
    assert.equal(countWord(count, 'чек', 'чека', 'чеков'), expected);
  }
});
