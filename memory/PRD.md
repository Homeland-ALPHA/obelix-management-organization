# Obelix Property Management — Marketing Site PRD

## Original problem statement
Premium, production-quality SaaS marketing site for "Obelix Property Management," an NYC-specific
property-management operating system for landlords, property managers, asset managers and
multifamily owners. Marketing pages only — realistic dashboard previews and working landing-page
interactions, no authenticated app, no database, no payments.

Follow-up requests from user:
1. Do not overload one page — give each nav header its own page.
2. Link to the user's existing underwriting business, Obelix Underwriting, at `theobelix.com`.

## Architecture
- React 19 + CRA (craco), react-router-dom v7, Tailwind, framer-motion, recharts, lucide-react.
- Frontend only. FastAPI backend untouched boilerplate; no API calls from the site.
- `src/data/landing.js` holds all copy/data. `src/components/landing/*` are reusable sections.
  `src/pages/*` compose sections per route. `Layout.jsx` wraps Nav + Footer + scroll manager.
- Design: near-black (#0A0A0A) surfaces, muted gold (#C7A36B) accent, Cormorant Garamond serif
  headlines + Inter UI, 1px hairline borders, restrained motion.

## Routes
| Route | Content |
|---|---|
| `/` | Hero + dashboard preview, fragmentation/problem visual, module index, comparison table, CTA |
| `/platform` | Six feature modules with Learn-more expansion |
| `/compliance` | 7-step violation workflow + detail panel + progress, compliance calendar + reminders |
| `/maintenance` | Today's Priorities filterable table, mobile work-order interface |
| `/financials` | Financial KPIs, portfolio chart, arrears aging |
| `/owners` | Owner dashboard KPIs, chart, working approval actions |
| `/pricing` | Three unit-band tiers (custom quote), comparison table |
| `/security` | Access and records controls + honest no-certification disclaimer |
| `/privacy`, `/terms` | Plain-language legal summaries |

## Implemented (2026-06)
- All sections from the brief, split across 10 routes with sticky nav, active states, breadcrumbs,
  mobile menu, scroll-to-top on navigation and hash handling.
- Interactive: priority filters (9 rows), feature Learn-more toggles, approval Approve / Request
  Another Quote / Decline, reminder toggles (90/30/7/today), early-access form with validation +
  personalized confirmation + reset.
- Obelix Underwriting external links (`https://www.theobelix.com`) in nav, hero, mobile menu and
  footer, all `target=_blank rel=noopener noreferrer`.
- Compliance/legal guardrails: no legal-advice claims, no invented security certifications,
  pricing marked indicative, footer disclaimer.
- Verified: routing, all interactions, form validation/confirmation, no console errors, no
  horizontal overflow at 1920 / 820 / 390.

## Backlog
- P0: none open.
- P1: dedicated `/demo` scheduling page or Calendly embed; persist early-access submissions
  (FastAPI + MongoDB) with email notification via Resend.
- P2: SEO metadata per route (react-helmet), OG images, sitemap; case-study/customer page;
  authenticated product build-out.
