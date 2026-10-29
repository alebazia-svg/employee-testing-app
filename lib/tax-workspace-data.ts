import { portalForecast, portalRisk, type PortalReport } from './ausn-portal-view';
import { reviewIssues, reviewMonths } from './ausn-month-review';
import { buildTaxDocumentPlan } from './tax-document-plan';
import { taxHealth, type HealthDocument } from './tax-health';
import { limitOutlook } from './ausn-limit-outlook';
import type { FnsGaps } from './ausn-fns-gaps';

// One place that turns runner reports and the document archive into what the
// taxes page shows, shared by the ADMIN page and the local preview.
export function buildTaxWorkspace(input: { reports: PortalReport[]; documents: HealthDocument[]; now: Date; gaps?: FnsGaps }) {
  const { reports, documents, now, gaps } = input;
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Moscow' }).format(now);
  const year = today.slice(0, 4);
  const month = today.slice(0, 7);
  // Reports are sorted newest first; the newest of each scope wins even if broken,
  // so an invalid fresh run is never hidden behind an older success.
  const full = reports.find((report) => report.kind === 'full' && report.year === year);
  const current = reports.find((report) => report.kind === 'month' && report.periodKey === month) || reports.find((report) => report.kind === 'month' && report.year === year);
  const limitSource = full?.available ? full : current;
  const plan = buildTaxDocumentPlan({ now, reports: [], documents: documents.map((document) => ({ ...document, source: 'portal' as const })) });
  const months = reviewMonths({ report: full, plan, today });
  return {
    full, current, plan, months,
    risk: portalRisk(limitSource, now),
    forecast: portalForecast(full),
    outlook: limitOutlook(full, today),
    issues: reviewIssues({ report: full, months, gaps: gaps && full && gaps.sourceFile.includes((/(\d{8}T\d{6})\.md$/.exec(full.sourceFile) || [])[1] || '-') ? gaps : undefined }),
    health: taxHealth({ full, current, documents, now }),
  };
}
