# Product Vision

## Operating Principle: Trust But Verify

The portal should make honest work simple and make formal checkmarks useless.

Employees should not copy data from 1C or fill long forms just so the business
can say a control exists. Employees confirm only the facts that genuinely need a
human action: physical cash recounts, real-world task completion, comments about
exceptions, and evidence where automation cannot yet verify the event.

If a check can be performed automatically through 1C, OFD/SABY, banking data or
another reliable source, the portal should perform that check itself. Manual
input should be reduced to the minimum needed to capture the real-world fact.

If an employee marks "everything is OK" and a later automatic check finds a
mismatch, that mismatch is a separate control event, not just a UI validation
error. Future control events may:

- ask the employee to re-check the issue;
- request a comment or proof;
- notify the manager or owner;
- appear in an exceptions / violations journal;
- affect discipline or bonus rules after the policy is approved.

Design goal: do not build a second 1C. Build a daily control layer that compares
employee-confirmed facts with system data and shows exceptions clearly.
