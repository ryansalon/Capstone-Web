---
name: Barangay Health Monitor
description: Dual-portal municipal health telemetry system for Mahinog RHU & CPSC balancing clinical precision with elder-legible clarity under RA 10173.
colors:
  pelagic-teal: "#0B6B68"
  pelagic-teal-deep: "#085452"
  pelagic-teal-press: "#064341"
  pelagic-mist: "#E1F0EF"
  pelagic-border: "#B2D5D3"
  basalt-rail: "#101B1E"
  basalt-elevated: "#18272B"
  basalt-hover: "#213439"
  sea-mist-canvas: "#F3F7F7"
  clinical-paper: "#FFFFFF"
  mineral-subtle: "#EAF0F1"
  mineral-tint: "#F7FAFA"
  mineral-rule: "#D4E0E1"
  mineral-rule-strong: "#B1C5C8"
  ink-obsidian: "#101B1E"
  ink-slate: "#22343A"
  ink-muted: "#465E64"
  ink-subtle: "#516A70"
  rail-ink: "#F2F7F7"
  rail-ink-muted: "#A9BEC3"
  emerald-clinical: "#0E6B53"
  emerald-bg: "#E5F4EE"
  emerald-border: "#A8D9C7"
  amber-clinical: "#92400E"
  amber-bg: "#FEF3C7"
  amber-border: "#F5C563"
  crimson-clinical: "#991B1B"
  crimson-solid: "#B91C1C"
  crimson-bg: "#FEE2E2"
  crimson-border: "#F8A5A5"
  cobalt-info: "#1E40AF"
  cobalt-bg: "#EFF6FF"
  cobalt-border: "#BFDBFE"
typography:
  display:
    fontFamily: "Public Sans, Segoe UI, system-ui, sans-serif"
    fontSize: "1.65rem"
    fontWeight: 700
    lineHeight: 1.24
    letterSpacing: "-0.015em"
  headline:
    fontFamily: "Public Sans, Segoe UI, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.28
    letterSpacing: "-0.01em"
  metric:
    fontFamily: "Public Sans, Segoe UI, system-ui, sans-serif"
    fontSize: "2.05rem"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "-0.02em"
    fontFeature: "tnum"
  title:
    fontFamily: "Public Sans, Segoe UI, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "0em"
  body:
    fontFamily: "Atkinson Hyperlegible, Public Sans, Segoe UI, sans-serif"
    fontSize: "0.96875rem"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "0em"
  label:
    fontFamily: "Public Sans, Segoe UI, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "0em"
rounded:
  sm: "6px"
  md: "10px"
  lg: "14px"
  pill: "999px"
spacing:
  xs: "6px"
  sm: "10px"
  md: "16px"
  lg: "20px"
  xl: "28px"
components:
  button-primary:
    backgroundColor: "{colors.pelagic-teal}"
    textColor: "{colors.clinical-paper}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "8px 17px"
    height: "40px"
  button-primary-hover:
    backgroundColor: "{colors.pelagic-teal-deep}"
    textColor: "{colors.clinical-paper}"
  button-secondary:
    backgroundColor: "{colors.clinical-paper}"
    textColor: "{colors.ink-obsidian}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "8px 17px"
    height: "40px"
  button-danger:
    backgroundColor: "{colors.crimson-solid}"
    textColor: "{colors.clinical-paper}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "8px 17px"
    height: "40px"
  input-clinical:
    backgroundColor: "{colors.clinical-paper}"
    textColor: "{colors.ink-obsidian}"
    rounded: "{rounded.sm}"
    padding: "9px 13px"
    height: "42px"
  card-vital:
    backgroundColor: "{colors.clinical-paper}"
    textColor: "{colors.ink-slate}"
    rounded: "{rounded.md}"
    padding: "18px 19px"
  nav-rail-item-active:
    backgroundColor: "{colors.pelagic-teal}"
    textColor: "{colors.clinical-paper}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "10px 14px"
  badge-good:
    backgroundColor: "{colors.emerald-bg}"
    textColor: "{colors.emerald-clinical}"
    rounded: "{rounded.pill}"
    padding: "3px 10px"
---

# Design System: Barangay Health Monitor

## Overview

**Creative North Star: "Camiguin Basalt & Tidal Sea-Chart"**

Barangay Health Monitor serves two distinct municipal constituencies from one unified local-first system in Mahinog, Camiguin: residents checking personal kiosk vitals under Republic Act 10173, and Barangay Health Workers (BHWs) triaging community telemetry at the Rural Health Unit. The interface pairs an authoritative dark volcanic basalt chrome (`pelagic-teal` over `basalt-rail`) with bright daylight `sea-mist-canvas` clinical workspaces so long screening sessions stay calm and personal health passports stay unmistakable for elderly citizens.

Rather than consumer wellness clichés—pastel gradients, decorative kickers, pulsing dots, or floating glass cards—the surface treats every blood pressure, SpO2, temperature, pulse, weight, and BMI readout as a durable municipal sea-chart. High-aperture letterforms (`Atkinson Hyperlegible`), strict `tabular-nums` alignment, crisp hairline mineral borders, and restrained exponential settling transitions keep critical thresholds scannable at a glance across English, Filipino, and Cebuano translations without losing clinical authority on print or low-bandwidth clinic workstations.

**Key Characteristics:**
- Dark volcanic basalt navigation rail (`256px` fixed) and civic auth stage paired with daylight clinical sea-mist workspaces (`>= 4.5:1` WCAG AA contrast everywhere).
- Elder-legible typographic hierarchy led by `Public Sans` headings and `Atkinson Hyperlegible` body copy with strict `tabular-nums` telemetry metrics.
- Flat structural containment separated by `1px` mineral borders—never nested bordered boxes inside summary panels.
- Explicit RA 10173 data-privacy states (`Allowed` / `Blocked`, `Granted` / `Withheld`, `Confirmed`) surfaced through accessible color-and-label badges.
- Offline-ready printstylesheets and single-viewport kiosk charts built cleanly without decorative badge bloat.

## Colors

Color carries strict civic and clinical meaning. **Pelagic Teal** anchors navigation selection, primary actions, and verified portal links (`6.4:1` contrast on white), while neutral surfaces divide cleanly between the dark **Basalt Rail** (orientation chrome) and daylight **Sea Mist** + **Clinical Paper** (patient data and BHW workflows). Semantic colors (**Emerald Clinical**, **Amber Clinical**, **Crimson Clinical**, **Cobalt Info**) are reserved exclusively for health triage ranges, RA 10173 consent statuses, and audit classifications—never decorative accents.

**The Pelagic Contrast Rule.** Interactive actions on daylight surfaces use **Pelagic Teal**, reserving **Basalt Rail** strictly for navigation chrome and split-screen civic provenance so users immediately distinguish workplace chrome from clinical content.

**The Clinical Signal Hierarchy.** Never encode clinical state or RA 10173 permission through hue alone; pair semantic fill/ink/border triplets (**Emerald Clinical**, **Amber Clinical**, **Crimson Clinical**) with explicit status words (`Normal`, `Elevated`, `Stage 2`, `Allowed`, `Blocked`).

## Typography

Display structure uses **Public Sans** (`600–800`) for clean civic headings, compact button labels, and bold vital readouts, paired with **Atkinson Hyperlegible** (`400–700`, `15.5px` base) for body copy, clinical notes, table cells, and instructions so visually impaired or older residents never confuse `1/I/l` or `0/O`.

**The Elder-Legible Scale Rule.** Every numeric telemetry value, chart tick, badge count, and audit timestamp applies `tabular-nums` so readings stack vertically across cards and trend tables without jitter.

## Layout

Authenticated workspaces run inside a persistent left **Basalt Rail** (`256px` on desktop, collapsing below `900px` into a compact header bar + bottom mobile tab dock) and a slim `52px` top mineral bar holding the jurisdictional privacy indicator (`Municipality of Mahinog · RA 10173 Protected`) and unified language switcher (`English`, `Filipino`, `Bisaya`). Main canvases open directly onto crisp 3-column desktop clinical vitals grids (12 columns / 3 equal tracks) on Citizen Dashboard, and 5-column KPI strips + balanced 3-column metadata grids on BHW views, stepping cleanly down at `1024px`, `900px`, and `640px` with zero horizontal overflow.

**The Telemetry Density Rule.** Keep one top-level page heading per view directly adjacent to its action bar, and never prepend decorative uppercase eyebrow kickers above section titles or repeat the active citizen name inside secondary panel headers.

## Elevation & Depth

Depth relies on subtle tonal stepping and hairline **Mineral Rule** borders (`1px`) rather than heavy blur shadows. Cards lift just a whisper off **Sea Mist Canvas** via **Clinical Paper** backgrounds and micro-elevation shadows (`--shadow-xs`), brightening their border to **Mineral Rule Strong** on hover.

**The Flat-Surface Rule.** Never place a bordered or tinted sub-card inside another card body (such as registry totals or vital card grids inside outer wrapper panels); separate internal summary regions with generous padding and `1px` top hairline rules instead.

**The Restrained Settle.** Under `@media (prefers-reduced-motion: no-preference)`, primary summary banners, auth cards, and dialogs enter with a subtle `6px` vertical settle over `360ms` using `cubic-bezier(0.16, 1, 0.3, 1)`, while gauge pins glide smoothly along clinical scales (`450ms`). All motion collapses immediately when reduced motion is preferred.

## Shapes

Architectural corners stay disciplined across portals: `6px` (`--radius-sm`) on buttons, form inputs, table surfaces, and nav items; `10px` (`--radius-md`) on vital cards, KPI panels, and summary sections; `14px` (`--radius-lg`) on flagship hero banners, authentication cards, and modals; and `999px` (`--radius-pill`) strictly on semantic status badges, language controls, and filter chips.

**The Cramped-Free Surface Rule.** Every standalone surface preserves at least `16px–20px` internal padding (`--spacing-md` / `--spacing-lg`) and `>= 10px` element gaps, never compressing interactive hit targets below `40px` height (`34px` minimum for inline table/compact actions).

## Components

- **Primary Action Button (`button-primary`)**: Solid **Pelagic Teal** fill with white `Public Sans` label, `40px` min-height, `6px` radius, shifting to **Pelagic Teal Deep** on hover and crisp `3px` teal focus ring on keyboard focus.
- **Secondary & Danger Actions (`button-secondary`, `button-danger`)**: Crisp white paper with **Mineral Rule Strong** border for neutral secondary actions (`Print`, `Refresh`, `Clinical Guide`); **Crimson Solid** reserved solely for destructive actions (`Revoke consent`, account deletion).
- **Clinical Form Fields (`input-clinical`)**: `42px` high fields framed by `1px` **Mineral Rule Strong**, white interior, `6px` radius, highlighting in **Pelagic Teal** on hover and gaining `--focus-ring` on focus. Password fields house an inline accessible `Show` toggle.
- **Basalt Sidenav Item (`nav-rail-item-active`)**: Full-width `6px`-radius row inside the dark rail (`padding: 10px 14px`) switching from **Rail Ink Muted** text to high-contrast **Pelagic Teal** fill with subtle `18%` white inner border when active (`aria-current="page"`).
- **Vital Telemetry Card (`card-vital`)**: White clinical container (`18px 19px` padding, `10px` radius) uniting metric label + status pill top row, bold tabular value + unit row, normal reference target + delta chip, color-graded horizontal gauge bar with black marker pin, and inline sparkline canvas. Warning/alert states tint subtly (`#FFFDF7` / `#FFF9F9`) with matching semantic border.
- **Semantic Status & Consent Badges (`badge-good` / `Allowed` / `Blocked`)**: Full-pill (`999px`) status indicators rendering emerald, amber, crimson, or neutral mineral pairs with explicit `1px` borders for clinical severity and RA 10173 consent comparison lists.
- **Auth Role Tabs & Civic Showcase**: Segmented dual-role switcher (`Citizen` / `Health Worker`) pinned cleanly inside compact header tabs (`h2.auth-role-title`) without overriding document heading hierarchy.

## Do's and Don'ts

### Do:
- **Do** use `Public Sans` for headings/metrics (`tabular-nums`) and `Atkinson Hyperlegible` (`0.96875rem`, `1.55` line-height) for prose, tables, and consent guidance.
- **Do** separate sibling subsections inside panels using `1px` mineral rules (`#D4E0E1`) rather than boxing sub-metrics inside inner cards.
- **Do** enforce explicit `40px` minimum button height and `42px` form control height across Citizen and BHW tools.
- **Do** preserve semantic text alongside every clinical badge (`Allowed`, `Blocked`, `Normal`, `Stage 2`, `Critical`) and include both official seals in print passports and referrals.

### Don't:
- **Don't** place vertical `> 1px` colored `border-left` stripes on cards, modals, tabs, or callouts.
- **Don't** add decorative uppercase eyebrow kickers above page titles or animate decorative pulsing status dots.
- **Don't** wrap `.card` vital grids or `.total` registry figures inside redundant outer `.panel` borders on BHW views.
- **Don't** use glassmorphic backdrop blurs, neon gradients, or sub-`12.5px` micro-copy on resident-facing records.
