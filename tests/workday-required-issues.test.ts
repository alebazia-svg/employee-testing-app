import assert from 'node:assert/strict';
import test from 'node:test';
import { findApprovedCloseException, findOpenRequiredWorkdayIssues, readIssueIds, sameIssueIds } from '../lib/workday-required-issues';

test('required issues can be limited to the closing workday date', async () => {
  let where: unknown;
  const db: any = {
    workdayControlIssue: {
      findMany: async (args: { where: unknown }) => {
        where = args.where;
        return [];
      },
    },
  };

  await findOpenRequiredWorkdayIssues(db, 7, '2026-08-24');
  assert.deepEqual(where, {
    userId: 7,
    status: 'open',
    employeeActionRequired: true,
    originDate: { lte: '2026-08-24' },
  });
});

test('close exception covers only the exact current set of required issues', async () => {
  assert.deepEqual(readIssueIds([3, '2', 3, 0, 'bad']), [2, 3]);
  assert.equal(sameIssueIds([2, 3], [2, 3]), true);
  assert.equal(sameIssueIds([2, 3], [2, 3, 4]), false);

  const db: any = {
    workdayCloseExceptionRequest: {
      findMany: async () => [
        { id: 'old', issueIds: [2], status: 'approved' },
        { id: 'exact', issueIds: [3, 2, 2], status: 'approved' },
      ],
    },
  };
  assert.equal((await findApprovedCloseException(db, 10, [2, 3]))?.id, 'exact');
  assert.equal(await findApprovedCloseException(db, 10, [2, 3, 4]), null);
});
