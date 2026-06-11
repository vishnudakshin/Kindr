// lib/findings.ts
//
// Layer 3 engine. Runs FINDING_RULES against the Layer-1 questionnaire score and the Layer-2 lab
// interpretation, derives a confidence and priority for each hit, and returns ranked concern findings,
// positive "strength" findings, an urgent/referral subset, and severity counts for the report + plan.

import type { HistoryResponses, QuestionnaireScore } from './types'
import type { BiomarkerStatus, LabInterpretation } from './lab-interpretation'
import {
  FINDING_RULES, FINDING_LINKS, type FindingConfidence, type FindingContext, type Pillar,
  type RuleHit, type Severity, type Sex,
} from './findings-config'
import type { BodySystem } from './lab-config'

export interface FindingLink { toId: string; toTitle: string; relation: string; note: string }

export interface Finding {
  id: string
  title: string
  kind: 'concern' | 'strength'
  system: BodySystem | 'Cross-system'
  severity: Severity
  confidence: FindingConfidence
  refer: boolean
  pillars: Pillar[]
  biomarkers: string[]
  signals: string[]
  detail: string
  managedNote?: string
  links: FindingLink[]
  priority: number
}

export interface FindingsResult {
  findings: Finding[]                          // concerns, ranked highest priority first
  strengths: Finding[]                         // positive findings (what is going well)
  urgent: Finding[]                            // refer or urgent severity (concerns)
  countsBySeverity: Record<Severity, number>   // concerns only
  hasReferral: boolean
}

const SEVERITY_WEIGHT: Record<Severity, number> = { info: 10, low: 25, moderate: 45, high: 70, urgent: 100 }
const CONFIDENCE_WEIGHT: Record<FindingConfidence, number> = { low: 0, moderate: 8, high: 15 }

function num(v: number | string | null): number | null {
  return typeof v === 'number' ? v : null
}

// ── context builder ────────────────────────────────────────────────────────
function buildContext(q: QuestionnaireScore, lab: LabInterpretation, history: HistoryResponses): FindingContext {
  const map = new Map<string, BiomarkerStatus>()
  for (const b of lab.biomarkers) map.set(b.name, b)

  const tierOf = (n: string) => map.get(n)?.tier ?? 'unknown'
  const below = (n: string) => {
    const s = map.get(n); const v = s ? num(s.value) : null
    return !!(s && v !== null && s.refRange?.low !== undefined && v < s.refRange.low)
  }
  const above = (n: string) => {
    const s = map.get(n); const v = s ? num(s.value) : null
    return !!(s && v !== null && s.refRange?.high !== undefined && v > s.refRange.high)
  }

  const domains = q.domains as Record<string, { wellness: number; flags: string[] }>
  const condStr = [...(history.conditions ?? []), history.conditionsOther ?? ''].join(' ').toLowerCase()
  const famStr = [...(history.familyHistory ?? []), history.familyHistoryOther ?? ''].join(' ').toLowerCase()
  const dietStr = (history.dietaryPreferences ?? []).join(' ').toLowerCase()
  const medStr = [history.medications ?? '', history.medicationsText ?? ''].join(' ').toLowerCase()
  const sex: Sex = lab.context.sex

  return {
    tier: tierOf,
    abnormal: (n) => tierOf(n) === 'out_of_range' || tierOf(n) === 'critical',
    watchOrWorse: (n) => ['watch', 'out_of_range', 'critical'].includes(tierOf(n)),
    below, above,
    value: (n) => { const s = map.get(n); return s ? num(s.value) : null },
    refer: (n) => map.get(n)?.refer ?? false,
    hasFlag: (n, f) => map.get(n)?.flags.includes(f) ?? false,
    domainLow: (d) => !!domains[d] && domains[d].wellness < 50,
    domainScore: (d) => domains[d]?.wellness ?? 100,
    domainFlag: (d, f) => domains[d]?.flags.includes(f) ?? false,
    symptom: (re) => q.symptomFlags.some(s => re.test(s)),
    anthro: (re) => q.anthropometrics.flags.some(s => re.test(s)),
    alcoholRisk: q.alcohol.riskFlag,
    condition: (re) => re.test(condStr),
    familyHistory: (re) => re.test(famStr),
    diet: (re) => re.test(dietStr),
    medication: (re) => re.test(medStr),
    sex,
    age: history.age ?? null,
    smoker: /current|daily|occasional|yes/i.test(history.tobacco ?? ''),
    menopausal: lab.context.menopausal ?? false,
    bpSystolic: history.bpSystolic ?? null,
    bpDiastolic: history.bpDiastolic ?? null,
  }
}

function confidenceFor(hit: RuleHit, c: FindingContext): FindingConfidence {
  const abnormalCount = hit.biomarkers.filter(b => c.abnormal(b)).length
  const corroborated = hit.signals.length > 0
  if (abnormalCount >= 1 && corroborated) return 'high'
  if (abnormalCount >= 2) return 'high'
  if (abnormalCount === 1 || corroborated) return 'moderate'
  return 'low'
}

// ── main ────────────────────────────────────────────────────────────────
export function buildFindings(q: QuestionnaireScore, lab: LabInterpretation, history: HistoryResponses): FindingsResult {
  const c = buildContext(q, lab, history)
  const concerns: Finding[] = []
  const strengths: Finding[] = []

  for (const rule of FINDING_RULES) {
    const hit = rule.detect(c)
    if (!hit) continue
    const kind = rule.kind ?? 'concern'
    const refer = kind === 'concern' && !!hit.refer
    const severity: Severity = refer && SEVERITY_WEIGHT[hit.baseSeverity] < SEVERITY_WEIGHT.high ? 'high' : hit.baseSeverity
    const confidence = confidenceFor(hit, c)
    const priority = SEVERITY_WEIGHT[severity] + CONFIDENCE_WEIGHT[confidence] + (refer ? 20 : 0) + (hit.priorityBoost ?? 0)
    const finding: Finding = {
      id: rule.id,
      title: typeof rule.title === 'function' ? rule.title(c) : rule.title,
      kind,
      system: rule.system,
      severity, confidence, refer,
      pillars: rule.pillars,
      biomarkers: hit.biomarkers.filter(Boolean),
      signals: hit.signals,
      detail: hit.detail,
      managedNote: hit.managedNote,
      links: [],
      priority,
    }
    ;(kind === 'strength' ? strengths : concerns).push(finding)
  }

  // Finding-linking pass: attach context from one finding to another when both are present.
  const all = [...concerns, ...strengths]
  const byId = new Map<string, Finding>()
  for (const f of all) byId.set(f.id, f)
  for (const link of FINDING_LINKS) {
    const source = byId.get(link.source), target = byId.get(link.target)
    if (source && target && !target.links.some(l => l.toId === source.id)) {
      target.links.push({ toId: source.id, toTitle: source.title, relation: link.relation, note: link.note })
    }
  }

  concerns.sort((a, b) =>
    b.priority - a.priority ||
    SEVERITY_WEIGHT[b.severity] - SEVERITY_WEIGHT[a.severity] ||
    CONFIDENCE_WEIGHT[b.confidence] - CONFIDENCE_WEIGHT[a.confidence])
  strengths.sort((a, b) => CONFIDENCE_WEIGHT[b.confidence] - CONFIDENCE_WEIGHT[a.confidence])

  const countsBySeverity: Record<Severity, number> = { info: 0, low: 0, moderate: 0, high: 0, urgent: 0 }
  for (const f of concerns) countsBySeverity[f.severity]++

  return {
    findings: concerns,
    strengths,
    urgent: concerns.filter(f => f.refer || f.severity === 'urgent'),
    countsBySeverity,
    hasReferral: concerns.some(f => f.refer),
  }
}
