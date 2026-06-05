# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # start Next.js dev server (localhost:3000)
npm run build    # production build
npm run lint     # ESLint via next lint
npx tsc --noEmit # type-check without emitting (no test suite exists)
```

There are no automated tests. Verify changes by running `npm run dev` and navigating the app.

## Architecture

**Stack:** Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS · Framer Motion · Recharts · @react-pdf/renderer

**Fonts:** Newsreader (serif, `font-serif`) and Inter (sans, `font-sans`) loaded via `next/font/google` in `app/layout.tsx`.

### Route structure

```
app/
  page.tsx                  Landing page → /welcome → /questionnaire → /dashboard
  welcome/                  Onboarding explainer
  questionnaire/            Multi-step intake form (saves to mockData via saveQuestionnaire)
  labs/entry/               Manual blood panel entry + OCR upload
  (shell)/                  Tab-bar shell (BrandHeader + TabBar on every page)
    dashboard/
    labs/                   Blood panel viewer
    report/                 Wellness report
    plan/                   Daily plan with SaplingTree progress visual
    progress/               90-day ForestGrove + ScoreTrend
    resources/
    profile/                Read-only physical/diet info + editable preferences
    share-report/           PDF report builder
  api/ocr/                  POST endpoint — Anthropic Vision extracts blood values from image
  styleguide/               Component reference (dev only)
```

All `(shell)` pages share a sticky bottom `TabBar` (7 tabs) and `BrandHeader`. The shell layout adds `pb-[68px]` to clear the tab bar.

### Data layer

**All state lives in `lib/data.ts` as a mutable in-memory singleton (`mockData`).** There is no backend or database in V1. Mutations go through exported helper functions:

| Function | Purpose |
|---|---|
| `saveQuestionnaire(answers)` | Persists questionnaire + recomputes scores |
| `saveBloodPanel(panel)` | Updates blood results |
| `saveTodayEntry(completed, total)` | Logs today's task completion |
| `saveShareRecord(sections, name?, rel?)` | Appends to shareHistory |

`lib/types.ts` holds all shared interfaces. `lib/scoring.ts` contains the five domain scorers (PSS-4 stress, IPAQ-SF activity, PSQI-based sleep, nutrition, cognition) and grove growth-stage logic.

### Design tokens (Tailwind)

| Token | Value | Usage |
|---|---|---|
| `bg` | `#F5F0D0` | Page background |
| `bg-soft` | `#FAF6E3` | Subtle section background |
| `accent` | `#E8E0A0` | Highlights, pill fills, PDF accents |
| `ink` | `#2C2A1E` | Primary text |
| `ink-2` | `#6B6650` | Secondary / muted text |
| `card` | `#FFFFFF` | Card surfaces |
| `border` | `#D8D0A8` | Dividers and outlines |

Custom shadow: `shadow-card` = `0 1px 4px 0 rgba(44,42,30,0.07)`.

### Key component patterns

**Grove visualisations** — two separate isometric 10×9 grid implementations:
- `components/progress/ForestGrove.tsx` — interactive, used on the Progress tab. Sprite base at `TH * 0.65`; fully grown oaks (stage 5) get an extra `TH * 0.25` offset. Empty tiles (stage 0) render as bare grass diamonds.
- `components/progress/ProgressGrove.tsx` — simpler read-only variant used for standalone renders.

**PDF generation** (`components/share/pdf/`) — built with `@react-pdf/renderer`. The `KindrReportDocument` assembles up to 7 pages from individual page components. The PDF bundle is lazy-loaded on download to avoid bloating the initial JS payload. Radar charts are drawn with react-pdf `<Svg>` primitives (Recharts can't run in the PDF worker).

**OCR route** (`app/api/ocr/route.ts`) — sends a base64 image to Anthropic Claude via `@anthropic-ai/sdk`, gets back structured blood panel values matched against the fixed `PANEL_GROUPS` schema.

**Scoring** — `lib/scoring.ts` exports individual scorers and `computeAll()`. The questionnaire saves answers and immediately recomputes all five dimension scores + overall. The `scoreHistory` array in `mockData` tracks snapshots over time for delta display.

### Conventions

- Pages under `(shell)` that need client interactivity use `'use client'` at the top; static display pages do not.
- Icon library is `@tabler/icons-react` throughout — do not introduce a second icon library.
- No `useEffect` for data fetching — everything reads synchronously from `mockData`.
- The `@react-pdf/renderer` import must stay behind a dynamic `import()` (lazy) to avoid SSR crashes; see `ShareReportScreen.tsx` for the pattern.
