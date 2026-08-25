import type { Plane } from '@/components/chrome'

/**
 * Topbar title and plane identity, keyed by pathname.
 *
 * Every page under (app)/ used to set these itself, by calling
 * `<Shell current="x" plane="y">` directly in its own page.tsx. Since the
 * route-group restructure moved Shell into (app)/layout.tsx — rendered
 * once, wrapping every route — that per-page choice needs to happen here
 * instead, driven by whichever path proxy.ts is currently forwarding via
 * the x-pathname header (see (app)/layout.tsx).
 *
 * Titles are deliberately shorter than each page's own <h1> — a nav label,
 * not a repeat of the page's own heading.
 */
export const ROUTE_META: Record<string, { title: string; plane: Plane }> = {
  '/trends': { title: 'Your trends', plane: 'private' },
  '/check-in': { title: 'Daily check-in', plane: 'private' },
  '/nudges': { title: 'Health nudges', plane: 'private' },
  '/boundaries': { title: 'Boundary assistant', plane: 'private' },
  '/recognition': { title: 'Recognition & connection', plane: 'private' },
  '/workspace': { title: 'Adaptive workspace', plane: 'private' },

  '/leave': { title: 'Leave & profile', plane: 'work' },
  '/holidays': { title: 'Holidays', plane: 'work' },
  '/attendance': { title: 'Attendance', plane: 'work' },
  '/payroll': { title: 'Payroll', plane: 'work' },
  '/expenses': { title: 'Expenses', plane: 'work' },
  '/assets': { title: 'Assets', plane: 'work' },
  '/company-policies': { title: 'Company policies', plane: 'work' },
  '/news': { title: 'News', plane: 'work' },
  '/complaints': { title: 'Complaints', plane: 'work' },
  '/resignations': { title: 'Resignations', plane: 'work' },

  // Each of these matches the plane its own page.tsx already passes to
  // PlaneBadge — org is reserved for anonymous, aggregate data (structural
  // load, the decision-history audit trail); everything else HR touches
  // is still work-plane, identifiable employment data.
  '/org': { title: 'Structural load', plane: 'org' },
  '/hr/decisions': { title: 'Decision history', plane: 'org' },
  '/hr': { title: 'People', plane: 'work' },
  '/hr/accounts': { title: 'Accounts', plane: 'work' },
  '/letter-heads': { title: 'Letter heads', plane: 'work' },
  '/custom-fields': { title: 'Data fields', plane: 'work' },
  '/offboarding': { title: 'Offboarding', plane: 'work' },
  '/warnings': { title: 'Warnings', plane: 'work' },
}
