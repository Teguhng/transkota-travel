# TRANSKOTA Design System (DESIGN.md)

## Brand Identity & Purpose
TRANSKOTA is an executive intercity travel and minibus booking platform serving Sumatera and Jawa routes (Lampung, Palembang, Jakarta, Metro, Tanggamus). The visual design conveys reliability, precision timetables, passenger comfort, and transaction security without generic marketing hype or decorative fluff.

## Visual Language: Nordic Slate & Ocean Blue
A dual-theme system calibrated for anti-glare daytime booking and zero eye-strain night-mode operations.

### Color Palette & Contrast (WCAG 2.1 AA/AAA)
* **Light Mode (Daytime)**
  * Canvas: `Slate-50` (`oklch(98.8% 0.004 250)`)
  * Surface / Cards: `White` (`#FFFFFF`)
  * Elevated Containers: `Slate-100` (`#F1F5F9`)
  * Subtle Rules & Borders: `Slate-200` (`oklch(86% 0.012 250)`)
  * Primary Ink: `Slate-900` (`oklch(16% 0.02 260)`) — Contrast 17.85:1 (AAA)
  * Muted Ink: `Slate-600` (`oklch(50% 0.02 260)`) — Contrast 7.58:1 (AAA)
  * Brand Accent: Royal Ocean Blue (`#2563EB` / `oklch(51% 0.22 264)`)
  * Secondary Accent: Warm Amber (`oklch(81% 0.16 82)`)
* **Dark Mode (Night Operations)**
  * Canvas: `Slate-950` (`#020617` / `oklch(15% 0.012 262)`)
  * Surface / Cards: `Slate-900` (`#0F172A` / `oklch(19% 0.012 262)`)
  * Subtle Rules & Borders: `Slate-800` (`#1E293B` / `oklch(31% 0.014 262)`)
  * Primary Ink: `Slate-100` (`#F1F5F9` / `oklch(96% 0.005 250)`) — Contrast 16.30:1 (AAA)
  * Muted Ink: `Slate-400` (`#94A3B8` / `oklch(65% 0.012 250)`) — Contrast 6.96:1 (AA)
  * Brand Accent: Bright Ocean Blue (`#3B82F6` / `oklch(62% 0.2 264)`)

### Typography
* **Typeface**: Plus Jakarta Sans for interface, headlines, and data.
* **Numbers**: Tabular numerals (`font-variant-numeric: tabular-nums`) for departure times, prices, and vehicle registration numbers.
* **Hierarchy**:
  * Display Headline: 2.25rem (36px) desktop / 1.75rem (28px) mobile, font-weight 800.
  * Section Headers: 1.25rem (20px), font-weight 700.
  * Body & Captions: 0.875rem (14px) / 0.75rem (12px), font-weight 500-600.

## Antislop Dials
* **ENERGY: 2** — Clear, focused transit utility. Strong contrast, crisp 1px borders, purposeful blue CTA buttons, zero ambient glow or blurry orbs.
* **RHYTHM: 2** — Structured section flow driven by user needs:
  1. Route Search Engine (Origin, Destination, Date, Quick Date selectors)
  2. Active Departure Timetable (Boarding pass cards with real-time seat availability)
  3. Fleet & Service Standards (Cabin layout, atomic hold safety, scheduled departures)
  4. Popular Intercity Corridors (Direct routes with estimated travel duration and fares)
* **MOTION: 1** — Functional transitions only:
  * 120ms button pressed state (`transform: translateY(1px)`)
  * Zero decorative loops (`animate-pulse` and `animate-ping` removed from non-status elements)
  * Respects `prefers-reduced-motion: reduce`

## Component Standards
* **No Decorative Emoji**: All illustrations and icons use bespoke, clean SVG vector graphics (cabin seats, steering wheel, calendar, route compass).
* **Zero Dead Controls**: Only implemented routes and actions are clickable. Non-implemented services (cargo/charter) are omitted rather than displayed as dead buttons.
* **Responsive Robustness**: Guaranteed zero layout breakages, zero horizontal scrollbars, and full touch target usability on 360px (Samsung Galaxy) and 402px (iPhone 17) viewports.
* **No Em Dash**: Copy strictly uses clean sentences or standard hyphens.

