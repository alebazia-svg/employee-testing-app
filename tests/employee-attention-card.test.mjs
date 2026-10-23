import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const client = readFileSync(new URL('../app/(dashboard)/employee/EmployeeTodayClient.tsx', import.meta.url), 'utf8');
const card = readFileSync(new URL('../components/EmployeeAttentionSummaryCard.tsx', import.meta.url), 'utf8');
const panel = readFileSync(new URL('../components/workday/EmployeeAttentionPanel.tsx', import.meta.url), 'utf8');

test('attention card keeps direct single-task navigation and grouped multi-task navigation', () => {
  // The released UI moved this navigation into the native attention panel.
  // Preserve direct single-row opening and a list for multiple rows there.
  assert.match(client, /<EmployeeAttentionPanel/);
  assert.match(panel, /setSelectedId\(id \?\? \(rows\.length === 1 \? rows\[0\]\.id : null\)\)/);
  assert.match(panel, /onClick=\{\(\) => kind === 'cash_issue' && request \? cashIssue\?\.open\(request.ref\) : openSheet\(kind\)\}/);
  assert.match(panel, /onClick=\{\(\) => openItem\(item\.id\)\}/);
  assert.match(panel, /Проверьте чеки/);
  assert.match(panel, /selectedId && !selected/);
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
