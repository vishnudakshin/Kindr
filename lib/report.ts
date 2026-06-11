// lib/report.ts
//
// Layer 4: assemble the engine output (ranked findings, strengths, body-system statuses) into a
// presentation-ready report model. Pure and UI-agnostic — the React/PDF layer renders this shape and
// maps the semantic palette tokens to the Kindr design system. No clinical thresholds live here.

import type { Finding, FindingsResult } from './findings'
import type { LabInterpretation } from './lab-interpretation'
import type { Pillar, Severity } from './findings-config'
import type { BodySystem } from './lab-config'

// Semantic palette tokens (the UI maps these to Kindr hex values: sage=good, ochre=monitor,
// brick=action, clay=gentle, cream=surface). Keeping them semantic means the report model never
// hard-codes brand colours.
export type Palette = 'sage' | 'ochre' | 'brick' | 'clay' | 'cream'

export interface ReportFinding {
  id: string
  title: string
  detail: string
  severity: Severity
  severityLabel: string
  palette: Palette
  refer: boolean
  markers: string[]
  signals: string[]
  pillars: Pillar[]
  managedNote?: string
  related: { id: string; title: string; note: string }[]
}

export interface FindingGroup {
  id: 'priorities' | 'monitor' | 'optimize'
  title: string
  blurb: string
  palette: Palette
  findings: ReportFinding[]
}

export interface SystemDial {
  system: BodySystem
  label: string // Optimal | Monitor | Needs attention | Urgent
  palette: Palette
  measured: number
}

export interface ReportSnapshot {
  headline: string
  subhead: string
  systems: SystemDial[]
  counts: { priorities: number; monitor: number; optimize: number; strengths: number }
}

export interface TriageBanner {
  title: string
  message: string
  items: { title: string; detail: string }[]
}

export interface PillarFocus { pillar: Pillar; label: string; count: number }

export interface KindrReport {
  generatedAt: string
  snapshot: ReportSnapshot
  triage: TriageBanner | null
  groups: FindingGroup[]
  strengths: ReportFinding[]
  focus: PillarFocus[]
  reassessmentDays: number
  disclaimer: string
}

// ── mappings ──────────────────────────────────────────────────────────────
const SEVERITY_PALETTE: Record<Severity, Palette> = {
  urgent: 'brick', high: 'brick', moderate: 'ochre', low: 'clay', info: 'sage',
}
const SEVERITY_LABEL: Record<Severity, string> = {
  urgent: 'Time-sensitive', high: 'Priority', moderate: 'Worth monitoring',
  low: 'Gentle optimization', info: 'Strength',
}
const SYSTEM_LABEL_PALETTE: Record<string, Palette> = {
  Optimal: 'sage', Monitor: 'ochre', 'Needs attention': 'brick', Urgent: 'brick',
}
const PILLAR_LABEL: Record<Pillar, string> = {
  Nourish: 'Nourish', Move: 'Move', Calm: 'Calm', Clinical: 'Clinical',
}

function toReportFinding(f: Finding): ReportFinding {
  return {
    id: f.id,
    title: f.title,
    detail: f.detail,
    severity: f.severity,
    severityLabel: f.kind === 'strength' ? 'Strength' : SEVERITY_LABEL[f.severity],
    palette: SEVERITY_PALETTE[f.severity],
    refer: f.refer,
    markers: f.biomarkers,
    signals: f.signals,
    pillars: f.pillars,
    managedNote: f.managedNote,
    related: f.links.map(l => ({ id: l.toId, title: l.toTitle, note: l.note })),
  }
}

// ── headline copy ──────────────────────────────────────────────────────────
function buildHeadline(
  counts: ReportSnapshot['counts'], hasReferral: boolean,
): { headline: string; subhead: string } {
  if (hasReferral) {
    return {
      headline: 'A few results are worth a clinician\u2019s eyes',
      subhead: 'We\u2019ve flagged those clearly below, alongside the everyday changes that will move the rest.',
    }
  }
  if (counts.priorities > 0) {
    return {
      headline: 'You have a clear set of focus areas',
      subhead: 'Nothing here needs urgent care \u2014 these are the places where small, consistent changes will do the most.',
    }
  }
  if (counts.monitor > 0) {
    return {
      headline: 'Mostly steady, with a few things to watch',
      subhead: 'A handful of markers are worth keeping an eye on over the next cycle.',
    }
  }
  if (counts.strengths > 0) {
    return {
      headline: 'Your results look strong across the board',
      subhead: 'Here\u2019s what\u2019s working \u2014 the goal now is simply to protect it.',
    }
  }
  return { headline: 'Your wellness snapshot', subhead: 'A calm overview of where things stand today.' }
}

// ── main ────────────────────────────────────────────────────────────────
export function buildReport(
  findings: FindingsResult,
  lab: LabInterpretation,
  opts: { generatedAt?: string; reassessmentDays?: number } = {},
): KindrReport {
  const priorities = findings.findings.filter(f => f.severity === 'urgent' || f.severity === 'high')
  const monitor = findings.findings.filter(f => f.severity === 'moderate')
  const optimize = findings.findings.filter(f => f.severity === 'low' || f.severity === 'info')

  const groups: FindingGroup[] = []
  if (priorities.length) groups.push({
    id: 'priorities', title: 'Where to focus first', palette: 'brick',
    blurb: 'The findings with the most evidence behind them and the biggest payoff from acting.',
    findings: priorities.map(toReportFinding),
  })
  if (monitor.length) groups.push({
    id: 'monitor', title: 'Worth keeping an eye on', palette: 'ochre',
    blurb: 'Not urgent \u2014 markers and habits to revisit at your next check-in.',
    findings: monitor.map(toReportFinding),
  })
  if (optimize.length) groups.push({
    id: 'optimize', title: 'Small optimizations', palette: 'clay',
    blurb: 'Fine-tuning for someone already in good shape.',
    findings: optimize.map(toReportFinding),
  })

  const counts = {
    priorities: priorities.length, monitor: monitor.length,
    optimize: optimize.length, strengths: findings.strengths.length,
  }

  // Snapshot: tested body systems as a status garden, worst first.
  const tierOrder = ['Urgent', 'Needs attention', 'Monitor', 'Optimal']
  const systems: SystemDial[] = lab.systems
    .filter(s => s.measured > 0)
    .map(s => ({ system: s.system, label: s.label, palette: SYSTEM_LABEL_PALETTE[s.label] ?? 'sage', measured: s.measured }))
    .sort((a, b) => tierOrder.indexOf(a.label) - tierOrder.indexOf(b.label) || a.system.localeCompare(b.system))

  const { headline, subhead } = buildHeadline(counts, findings.hasReferral)

  // Triage banner: only when something needs a clinician.
  const referItems = findings.urgent
  const triage: TriageBanner | null = referItems.length === 0 ? null : {
    title: referItems.length === 1 ? 'One result to discuss with a clinician' : `${referItems.length} results to discuss with a clinician`,
    message: 'These are flags, not diagnoses \u2014 a quick conversation with a doctor is the right next step. Everything else in this report is yours to work on.',
    items: referItems.map(f => ({ title: f.title, detail: f.detail })),
  }

  // Pillar focus (for the plan handoff): emphasis across concern findings, excluding Clinical.
  const pillarCounts = new Map<Pillar, number>()
  for (const f of findings.findings) {
    for (const p of f.pillars) {
      if (p === 'Clinical') continue
      pillarCounts.set(p, (pillarCounts.get(p) ?? 0) + 1)
    }
  }
  const focus: PillarFocus[] = [...pillarCounts.entries()]
    .map(([pillar, count]) => ({ pillar, label: PILLAR_LABEL[pillar], count }))
    .sort((a, b) => b.count - a.count)

  return {
    generatedAt: opts.generatedAt ?? new Date().toISOString(),
    snapshot: { headline, subhead, systems, counts },
    triage,
    groups,
    strengths: findings.strengths.map(toReportFinding),
    focus,
    reassessmentDays: opts.reassessmentDays ?? 90,
    disclaimer: 'Kindr is a wellness companion, not a medical service. Nothing here is a diagnosis. Reference ranges vary between labs, and results are only one part of your health picture \u2014 always confirm anything that concerns you with a qualified clinician.',
  }
}
