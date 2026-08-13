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

An employee checklist answer is a manual declaration, not the source of truth.
The system's control result should be formed separately from all available
evidence: portal data, 1C, OFD/SABY, photos, cash operations and future trusted
sources. The employee can complete the checklist even when automatic checks are
pending or contradictory; contradictions become warnings or control events for
admin review instead of hard blockers.

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

## AI As Control Amplifier

AI should strengthen the portal's existing business controls, not replace
deterministic rules, source systems or human responsibility.

The portal remains rules-first:

- 1C, OFD/SABY, PostgreSQL and deterministic matching create the factual base;
- control events carry status, owner, evidence and required action;
- AI may explain, summarize, group, draft and help investigate those events;
- AI must not be the source of truth for money, discipline, payroll or 1C data;
- high-impact actions stay human-in-the-loop.

Useful AI layers should appear only after the underlying business workflow is
stable enough to trust:

- AI explanations for already-detected Workday, OFD, cash and payroll events;
- Daily Brief for the owner: open issues, fixed issues, overdue actions and
  data-quality warnings;
- Business Knowledge / Tool Registry for rules, endpoint contracts, playbooks
  and operating procedures;
- evaluator checks before important notifications or disciplinary summaries;
- long-term AI Operations Copilot that answers questions from verified portal
  data and points to evidence.

Do not build AI as a parallel product or a magic chatbot. AI is the next layer
of the control platform: it makes exceptions understandable, helps managers act
faster and keeps honest work simple.

## Product Evolution

The long-term direction is one continuous product evolution, not separate
projects:

```text
Employee Portal
  -> Business Control Platform
  -> AI Operations Copilot
  -> Business Operating System
```

### Employee Portal

Employees use the portal daily for the practical workday path: start day, QR
presence confirmation, shift tasks, cash operations, comments, photos when still
needed and handover.

### Business Control Platform

The portal becomes the control layer over 1C, OFD/SABY, PostgreSQL and future
banking data. It detects exceptions, keeps evidence, assigns responsibility and
tracks whether issues are open, fixed or need review.

### AI Operations Copilot

AI helps the owner and managers understand the control layer:

- "What is wrong today?"
- "Which cashboxes need attention?"
- "Which OFD errors are still open?"
- "Why does this payroll result need review?"

The copilot reads verified events and evidence. It does not silently change 1C,
payroll, database state or discipline outcomes.

### Business Operating System

The mature product coordinates daily work, controls, exceptions, notifications,
analytics and AI-assisted decision support in one operating layer for the
business.

## Future AUSN Reporting Boundary

The existing AUSN report should eventually use the same server-side read-only
sources as terminal fiscal control: 1C, OFD and T-Bank. This reporting path must
remain independent of the portal UI and be callable by Aslan from his own
computer through an authenticated ordinary read-only request, without SSH and
without routing through Bela's computer.

Internal Docker networking for the portal must not make these sources private
to the portal application. The external reporting contract should be exposed by
the server-side read API with its own authentication, rate limits and audit,
while OFD and bank secrets remain on the server and never reach clients.
