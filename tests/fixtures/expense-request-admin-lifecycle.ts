export const lifecycleFixture = {
  ref: 'request-fixture-1',
  created: { statusKey: 'not_approved', at: '2026-08-17T07:00:00.000Z' },
  seen: { at: '2026-08-17T07:05:00.000Z', adminId: 1 },
  payable: { statusKey: 'payable', at: '2026-08-17T07:10:00.000Z' },
  returned: { statusKey: 'not_approved', at: '2026-08-17T07:20:00.000Z' },
} as const;
