# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

1. **Barangay Residents & Patients (Citizen Portal):** Residents in Mahinog, Camiguin (including older adults and first-time smartphone/kiosk users) who step up to the Barangay Health Kiosk or log in from home/mobile to review blood pressure, SpO2, body temperature, pulse, weight, and BMI, understand clinical status clearly, print Health Passports, and control record-sharing consent.
2. **Barangay Health Workers & RHU Staff (BHW / RHU Desk):** Frontline barangay health workers and Rural Health Unit of Mahinog clinicians who monitor community-wide fever/hypertension/hypoxemia trends, triage alerts without exposing unconsented residents, inspect individual consented health records, write clinical guidance notes or RHU referrals, reset forgotten resident passwords, audit every access event, and generate printable/CSV RHU reports.

## Product Purpose

Deliver a trustworthy, field-ready municipal public-health workspace bridging an offline-capable Raspberry Pi Barangay Health Kiosk with Citizen personal health transparency and Rural Health Unit (RHU) epidemiological surveillance in Mahinog, Camiguin. Success means residents can read vital results and manage privacy rights effortlessly, while BHW/RHU teams spot community risks early with full auditability.

## Positioning

Purpose-built for Philippine barangay health stations and Rural Health Units under Republic Act No. 10173 (Data Privacy Act of 2012): citizen consent dynamically gates individual record visibility, health worker notes, and alert names across the entire interface, while every lookup (authorized or blocked) is appended to an immutable audit trail.

## Operating Context

- Joint civic deployment by **Camiguin Polytechnic State College (CPSC)** and the **Rural Health Unit of Mahinog**, Municipality of Mahinog, Province of Camiguin.
- Multilingual Filipino community reality: all operational screens support live **English (`en`)**, **Bisaya (`ceb`)**, and **Tagalog (`tl`)** switching via `#authLangSelect` / `#workspaceLangSelect`.
- Low-connectivity / barangay station workflows requiring offline/local-first reliability, fast print workflows (Citizen Health Passport, RHU Referral Slip, Audit Log, RHU Epidemiology Report), and live 30-second surveillance polling.

## Capabilities and Constraints

- **Architecture Constraint (Confirmed):** Preserve plain static HTML, vanilla CSS (`static/css/style.css`), vanilla JS (`static/js/api.js`, `static/js/citizen.js`, `static/js/bhw.js`, plus bundled Chart.js `static/vendor/chart.umd.min.js`), and all existing Flask backend API routes (`app.py`). Zero build step or framework migration.
- **Auth & Routing:** Dual-portal authentication (`/citizen/login.html`, `/citizen/register.html`, `/citizen/forgot-password.html`, `/bhw/login.html`, session router `/index.html`).
- **Citizen Surface:** Personal health dashboard with vital gauges, clinical reference ranges modal, trend charts, print Health Passport, kiosk visit history (`/citizen/history.html`), explicit RA 10173 Grant/Revoke consent matrix & immutable history (`/citizen/consent.html`), and account/password profile (`/citizen/profile.html`).
- **BHW / RHU Surface:** Real-time community KPIs, consent coverage donut, kiosk freshness, fever/BP/SpO2 surveillance trends (`/bhw/dashboard.html`), resident directory search (`/bhw/search.html`), consented resident clinical record, notes & RHU referral slip (`/bhw/citizen-view.html`), immutable security audit trail + CSV export (`/bhw/audit-trail.html`), and anonymized CSV/printable RHU epidemiology reports (`/bhw/reports.html`).
- **Both Portals Prioritized Equally:** Full multi-page platform redesign across Auth, Citizen Portal, and BHW / RHU Desk, with structural navigation and layout improvements permitted provided existing DOM IDs/JS bindings remain intact or are cleanly updated in lockstep.

## Brand Commitments

- Preserve official institutional seals: `/img/cpsc-logo.png` (Camiguin Polytechnic State College) and `/img/rhu-logo.png` (Rural Health Unit of Mahinog).
- Preserve official civic provenance ("Republic of the Philippines · Province of Camiguin · Municipality of Mahinog") and Philippine Data Privacy Act (RA 10173) compliance notices.
- Keep `Barangay Health Monitor` identity and clinical status clarity intact without inventing unverified deployment benchmarks or external claims.

## Evidence on Hand

- Live institutional assets: `static/img/cpsc-logo.png`, `static/img/rhu-logo.png` (and `.svg` counterparts).
- Live Chart.js bundle: `static/vendor/chart.umd.min.js`.
- Verified clinical & privacy backend: `app.py`, `vitals.py`, `models.py`.

## Product Principles

1. **Consent Before Curiosity (RA 10173 First):** Privacy boundaries, denied states, and audit logging are core workflow architecture, not fine print.
2. **Clinical Legibility Under Stress:** Critical readings (hypertension stage 2/crisis, fever, low SpO2) and healthy baselines must read accurately at a glance for both a senior resident and a triage nurse.
3. **Calm Precision Across Dense Operations:** BHW/RHU screens carry high operational density (KPIs, surveillance trends, audit tables, filters) without visual fatigue or ambiguous hierarchy.
4. **Local-First Utility:** Every flow must feel fast, printable, keyboard-navigable, and dependable on modest rural hardware and mobile viewports.

## Accessibility & Inclusion

- High contrast (WCAG AA minimum), clear focus indicators, keyboard-accessible landmarks/skip links, elder-friendly readability and step-by-step sign-in help (`elder-guide`), and responsive layouts across desktop and mobile screens.
