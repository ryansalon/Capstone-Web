---
version: 1
slug: "static-citizen-dashboard-html"
primary_target: "static/citizen/dashboard.html"
related_targets: ["static/bhw/dashboard.html","static/citizen/consent.html","static/citizen/history.html","static/citizen/profile.html","static/citizen/login.html","static/bhw/login.html","static/bhw/search.html","static/bhw/citizen-view.html","static/bhw/audit-trail.html","static/bhw/reports.html","static/index.html"]
---

# Barangay Health Monitor — Platform Surface Brief

- **Mode:** operate
- **Scope:** Full multi-page platform redesign (`static/index.html`, `static/citizen/*.html`, `static/bhw/*.html`, `static/css/style.css`, and matching DOM/UI helpers in `static/js/{api,citizen,bhw}.js`)

## Direction contract

THESIS:
Built around the Camiguin Basalt & Tidal Sea-Chart system: calm sea-mist operational clarity framed by a deep volcanic basalt rail (`#101B1E`), pelagic teal primary controls (`#0B6B68`), and calibrated inline vital-range contour bands—refusing generic SaaS dark-green admin cards, decorative kickers above headings, and nested card clutter.

OWN-WORLD:
Deep volcanic basalt sidebar & auth civic chrome (`#101B1E`, `#18292E`), calm sea-mist workspace ground (`#F3F7F7`), pure daylight white clinical surfaces (`#FFFFFF`), pelagic teal interactive accent (`#0B6B68`), strict `1px` mineral borders (`#D4E0E1`), crisp `Public Sans` display headings + `Atkinson Hyperlegible` UI/clinical body typography with `tabular-nums` (documented adaptation over generic `Instrument Sans`/`Inter` to maximize `1/I/l` and `0/O` character disambiguation for senior rural residents and Health Passports per `PRODUCT.md`), and semantic clinical states (emerald normal `#0E6B53`, warm amber elevated `#B45309`, signal coral alert `#B91C1C`) plus custom scrollbars, selection highlight (`#E1F0EF`), and crisp focus rings.

STORY:
Residents immediately read their latest BP, SpO2, temperature, pulse, and BMI status against clinical thresholds, inspect trends, print Health Passports, and grant or revoke RA 10173 consent with full transparency; Barangay Health Workers triage community epidemiology, consented clinical dossiers, immutable security audit trails, and anonymized RHU reports in seconds.

FIRST VIEWPORT:
Desktop (`1440x900`): `256px` fixed deep-basalt rail housing CPSC & RHU Mahinog seals, primary route links, active user session, and subtle offline/timezone status; top workspace bar holds route-level privacy/sync chip and multilingual `EN / Bisaya / Tagalog` selector cleanly on one plane; main stage leads directly with an uncluttered status-first verdict header (no decorative eyebrow above `<h1>`), primary action button (`Print Health Passport` / `Find citizens`), and calibrated 3-column key vital contour cards (`BP`, `SpO2`, `Temp`) above trends and RA 10173 controls. Mobile (`390x844`): sticky dark-basalt mobile header with drawer navigation trigger and full-width touch-friendly triage hierarchy.

FORM:
Camiguin Basalt & Tidal Sea-Chart (`4` of `7`, paired with challenger raises integrated into the system: inline severity range glyphs, binary consent matrix parity with flush tabular PHT timestamps, status-first above-the-fold verdict hierarchy, and unified live/consent state chips). `seed:a3928355f03340da`

FINISH:
unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
