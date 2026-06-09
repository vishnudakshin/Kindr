// lib/lab-interpretation.ts
//
// Layer 2: turn an extracted BloodPanel into per-biomarker statuses, roll those up into body-system
// statuses, and (the start of Layer 3) cross-link out-of-range markers with the Layer-1 questionnaire
// signals. Pure functions; no side effects.

import type {
  BloodPanel, BloodTestResult, HistoryResponses, QuestionnaireScore,
} from './types'
import {
  BIOMARKERS, GROUP_TO_SYSTEM, type BiomarkerDef, type BodySystem, type Direction,
  type NumericRange, type PatientContext, type RangeSpec, type Sex,
} from './lab-config'

// ── output types ────────────────────────────────────────────────────────
export type BiomarkerTier = 'optimal' | 'normal' | 'watch' | 'out_of_range' | 'critical' | 'unknown'

export interface BiomarkerStatus {
  name: string
  system: BodySystem
  value: number | string | null
  unit: string
  tier: BiomarkerTier
  refRange: NumericRange | null
  optimalRange: NumericRange | null
  direction: Direction
  flags: string[]
  refer: boolean
  crossLinks: string[]
  note?: string
}

export type SystemLabel = 'Optimal' | 'Monitor' | 'Needs attention' | 'Urgent'

export interface SystemStatus {
  system: BodySystem
  label: SystemLabel
  tier: BiomarkerTier
  drivers: string[] // biomarkers at the worst tier
  measured: number
  refer: boolean
}

export interface LabFinding {
  title: string
  system: BodySystem
  biomarkers: string[]
  linkedSignals: string[]
  confidence: 'low' | 'moderate' | 'high'
  refer: boolean
}

export interface LabInterpretation {
  context: PatientContext
  biomarkers: BiomarkerStatus[]
  systems: SystemStatus[]
  referrals: string[] // biomarker names that should route to a clinician
}

// Adapter to the existing BloodTestResult.status enum, so current UI that reads `.status` still works.
export function tierToStatus(tier: BiomarkerTier): 'normal' | 'borderline' | 'abnormal' {
  if (tier === 'out_of_range' || tier === 'critical') return 'abnormal'
  if (tier === 'watch') return 'borderline'
  return 'normal'
}

// ── helpers ───────────────────────────────────────────────────────────────
const TIER_RANK: Record<BiomarkerTier, number> = {
  unknown: 0, optimal: 1, normal: 2, watch: 3, out_of_range: 4, critical: 5,
}

function parseNumeric(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null
  if (typeof raw === 'number') return raw
  const m = String(raw).replace(/,/g, '').match(/-?\d+(\.\d+)?/)
  return m ? parseFloat(m[0]) : null
}

function resolveRange(spec: RangeSpec | undefined, ctx: PatientContext): NumericRange | null {
  if (!spec) return null
  if (typeof spec === 'function') return spec(ctx)
  if ('male' in spec || 'female' in spec) {
    const s = spec as { male: NumericRange; female: NumericRange; unknown?: NumericRange }
    if (ctx.sex === 'female') return s.female
    if (ctx.sex === 'male') return s.male
    return s.unknown ?? s.male
  }
  return spec as NumericRange
}

function normSex(sex: string): Sex {
  const s = (sex ?? '').toLowerCase()
  if (s.includes('female') || s.includes('woman')) return 'female' // check female first ('female' contains 'male')
  if (s.includes('male') || s.includes('man') || s === 'm') return 'male'
  return 'unknown'
}

export function contextFromHistory(h: HistoryResponses): PatientContext {
  const menopausal = h.age != null && normSex(h.sex) === 'female' && h.age >= 51
  return {
    age: h.age ?? null,
    sex: normSex(h.sex),
    ethnicity: h.ethnicity ?? 'general',
    menopausal,
  }
}

// Below/above a bound, with undefined bounds treated as "no limit".
const belowLow = (v: number, r: NumericRange | null) => r?.low !== undefined && v < r.low
const aboveHigh = (v: number, r: NumericRange | null) => r?.high !== undefined && v > r.high

const round2 = (x: number) => Math.round(x * 100) / 100

function findPanelValue(panel: BloodPanel, name: string): number | null {
  for (const group of Object.keys(panel)) {
    const t = panel[group]?.[name]
    if (t) { const v = parseNumeric(t.value); if (v !== null) return v }
  }
  return null
}

// HOMA-IR = Fasting Glucose (mg/dL) × Fasting Insulin (µU/mL) / 405.
// (If your lab reports glucose in mmol/L, the divisor is 22.5 instead — this assumes mg/dL.)
export function deriveHomaIr(panel: BloodPanel): number | null {
  const glucose = findPanelValue(panel, 'Fasting Glucose')
  const insulin = findPanelValue(panel, 'Fasting Insulin')
  if (glucose === null || insulin === null) return null
  return (glucose * insulin) / 405
}

// ── single biomarker ────────────────────────────────────────────────────
export function interpretBiomarker(
  name: string, result: BloodTestResult, ctx: PatientContext, group?: string,
): BiomarkerStatus {
  const def: BiomarkerDef | undefined = BIOMARKERS[name]
  const system = def?.system ?? (group ? GROUP_TO_SYSTEM[group] : undefined) ?? 'Blood & immune'

  if (!def) {
    return {
      name, system, value: result?.value ?? null, unit: result?.unit ?? '', tier: 'unknown',
      refRange: null, optimalRange: null, direction: 'context',
      flags: ['not_in_registry'], refer: false, crossLinks: [],
    }
  }

  const ref = resolveRange(def.ref, ctx)
  const optimal = resolveRange(def.optimal, ctx)
  const critical = resolveRange(def.critical, ctx)
  const flags: string[] = []
  let refer = false
  let tier: BiomarkerTier = 'unknown'

  // Qualitative (urinalysis) ------------------------------------------------
  if (def.direction === 'qualitative') {
    const raw = String(result?.value ?? '').toLowerCase().trim()
    const isAbn = (def.abnormalValues ?? []).some(a => raw.includes(a))
    const isNorm = (def.normalValues ?? []).some(n => raw.includes(n))
    if (!raw) tier = 'unknown'
    else if (isAbn) { tier = 'out_of_range'; if (def.referOnAbnormal) refer = true }
    else if (isNorm) tier = 'normal'
    else tier = 'normal'
    return {
      name, system, value: result?.value ?? null, unit: def.unit, tier,
      refRange: null, optimalRange: null,
      direction: def.direction, flags, refer, crossLinks: def.crossLinks ?? [], note: def.note,
    }
  }

  const value = parseNumeric(result?.value)
  if (value === null) {
    return {
      name, system, value: result?.value ?? null, unit: def.unit, tier: 'unknown',
      refRange: ref, optimalRange: optimal,
      direction: def.direction, flags: ['unparseable_value'], refer: false,
      crossLinks: def.crossLinks ?? [], note: def.note,
    }
  }

  // Context-only marker with no fixed range (e.g. estradiol/FSH/LH): can't classify alone.
  if (def.direction === 'context' && !ref) {
    return {
      name, system, value, unit: def.unit, tier: 'unknown',
      refRange: null, optimalRange: null, direction: def.direction,
      flags: ['needs_clinical_context'], refer: false, crossLinks: def.crossLinks ?? [], note: def.note,
    }
  }

  // Critical (red-flag) first ------------------------------------------------
  const critViolated =
    (def.direction !== 'low_bad' && aboveHigh(value, critical)) ||
    (def.direction !== 'high_bad' && belowLow(value, critical))
  if (critViolated) { tier = 'critical'; refer = true }
  else {
    const outOfRef =
      (def.direction === 'high_bad' && aboveHigh(value, ref)) ||
      (def.direction === 'low_bad' && belowLow(value, ref)) ||
      (def.direction === 'two_sided' && (aboveHigh(value, ref) || belowLow(value, ref))) ||
      (def.direction === 'context' && (aboveHigh(value, ref) || belowLow(value, ref)))
    if (outOfRef) {
      tier = 'out_of_range'
      if (def.referOnAbnormal) refer = true
    } else if (optimal) {
      const outOfOptimal =
        (def.direction === 'high_bad' && aboveHigh(value, optimal)) ||
        (def.direction === 'low_bad' && belowLow(value, optimal)) ||
        ((def.direction === 'two_sided' || def.direction === 'context') &&
          (aboveHigh(value, optimal) || belowLow(value, optimal)))
      tier = outOfOptimal ? 'watch' : 'optimal'
    } else {
      tier = 'normal'
    }
  }

  // Confounder rule: ferritin masked by inflammation -------------------------
  if (name === 'Ferritin' && ctx.hsCRPElevated && (tier === 'normal' || tier === 'optimal' || tier === 'watch')) {
    flags.push('iron_status_uncertain_inflammation')
  }
  if (def.direction === 'context') flags.push('needs_clinical_context')

  return {
    name, system, value, unit: def.unit, tier,
    refRange: ref, optimalRange: optimal,
    direction: def.direction, flags, refer, crossLinks: def.crossLinks ?? [], note: def.note,
  }
}

// ── full panel ────────────────────────────────────────────────────────────
export function interpretPanel(panel: BloodPanel, history: HistoryResponses): LabInterpretation {
  const ctx = contextFromHistory(history)

  // First pass: is hs-CRP elevated? (drives the ferritin confounder rule)
  for (const group of Object.keys(panel)) {
    const crp = panel[group]?.['hs-CRP']
    if (crp) {
      const v = parseNumeric(crp.value)
      const r = resolveRange(BIOMARKERS['hs-CRP'].ref, ctx)
      if (v !== null && aboveHigh(v, r)) ctx.hsCRPElevated = true
    }
  }

  // HOMA-IR is computed from fasting glucose + insulin when both are present (more reliable than a
  // transcribed value); falls back to any OCR-extracted HOMA-IR otherwise.
  const homaIr = deriveHomaIr(panel)
  const homaResult: BloodTestResult | null =
    homaIr === null ? null : { value: String(round2(homaIr)), unit: 'index', refRange: '' }

  const biomarkers: BiomarkerStatus[] = []
  let sawHoma = false
  for (const group of Object.keys(panel)) {
    const tests = panel[group] ?? {}
    for (const testName of Object.keys(tests)) {
      if (testName === 'HOMA-IR') {
        sawHoma = true
        const st = interpretBiomarker('HOMA-IR', homaResult ?? tests[testName], ctx, group)
        if (homaResult) st.flags.push('derived')
        biomarkers.push(st)
      } else {
        biomarkers.push(interpretBiomarker(testName, tests[testName], ctx, group))
      }
    }
  }
  // Derive HOMA-IR even if the lab didn't list it, as long as glucose + insulin are present.
  if (!sawHoma && homaResult) {
    const st = interpretBiomarker('HOMA-IR', homaResult, ctx, 'Metabolic')
    st.flags.push('derived')
    biomarkers.push(st)
  }

  return {
    context: ctx,
    biomarkers,
    systems: computeSystemStatuses(biomarkers),
    referrals: biomarkers.filter(b => b.refer).map(b => b.name),
  }
}

// ── system rollup ─────────────────────────────────────────────────────────
const LABEL_FOR: Record<BiomarkerTier, SystemLabel> = {
  unknown: 'Optimal', optimal: 'Optimal', normal: 'Optimal',
  watch: 'Monitor', out_of_range: 'Needs attention', critical: 'Urgent',
}

export function computeSystemStatuses(biomarkers: BiomarkerStatus[]): SystemStatus[] {
  const bySystem = new Map<BodySystem, BiomarkerStatus[]>()
  for (const b of biomarkers) {
    if (!bySystem.has(b.system)) bySystem.set(b.system, [])
    bySystem.get(b.system)!.push(b)
  }
  const out: SystemStatus[] = []
  for (const [system, list] of bySystem) {
    const measured = list.filter(b => b.tier !== 'unknown').length
    const worst = list.reduce<BiomarkerTier>(
      (acc, b) => (TIER_RANK[b.tier] > TIER_RANK[acc] ? b.tier : acc), 'normal',
    )
    const drivers = list.filter(b => b.tier === worst && TIER_RANK[worst] >= TIER_RANK.watch).map(b => b.name)
    out.push({
      system, tier: worst, label: LABEL_FOR[worst], drivers, measured,
      refer: list.some(b => b.refer),
    })
  }
  return out
}

// ── Layer-1 ↔ labs fusion (start of Layer 3) ──────────────────────────────
function signalActive(link: string, q: QuestionnaireScore): boolean {
  const d = q.domains as Record<string, { wellness: number; flags: string[] }>
  const low = (k: string) => !!d[k] && d[k].wellness < 50
  const sym = (re: RegExp) => q.symptomFlags.some(f => re.test(f))
  const anthro = (re: RegExp) => q.anthropometrics.flags.some(f => re.test(f))

  // Conceptual aliases → concrete Layer-1 signals.
  switch (link) {
    case 'fatigue': return low('activity') || low('wellbeing') || sym(/motivation|afternoon|crash/)
    case 'metabolic': return low('nutrition') || anthro(/adiposity|obese|waist/)
    case 'mood': return low('wellbeing') || sym(/mood|anxious|overwhelm/)
    case 'central_adiposity': return anthro(/adiposity|obese|waist/)
    case 'alcohol': return q.alcohol.riskFlag
  }
  // Direct: matching domain is low, or a symptom/anthropometric flag contains the tag.
  if (low(link)) return true
  if (q.symptomFlags.some(f => f.includes(link))) return true
  if (q.anthropometrics.flags.some(f => f.includes(link))) return true
  return false
}

export function fuseWithQuestionnaire(lab: LabInterpretation, q: QuestionnaireScore): LabFinding[] {
  const findings: LabFinding[] = []

  // 1) Each abnormal biomarker corroborated by a matching self-report signal.
  for (const b of lab.biomarkers) {
    if (TIER_RANK[b.tier] < TIER_RANK.watch) continue
    const linked = b.crossLinks.filter(l => signalActive(l, q))
    if (linked.length > 0) {
      findings.push({
        title: `${b.name} ${b.tier === 'watch' ? 'borderline' : 'out of range'} with matching self-report`,
        system: b.system,
        biomarkers: [b.name],
        linkedSignals: linked,
        confidence: b.tier === 'critical' || b.tier === 'out_of_range' ? 'high' : 'moderate',
        refer: b.refer,
      })
    }
  }

  // 2) Composite: insulin-resistance / metabolic-syndrome cluster.
  const tierOf = (n: string) => lab.biomarkers.find(b => b.name === n)?.tier ?? 'unknown'
  const metabolicHits = ['HOMA-IR', 'HbA1c', 'Fasting Glucose', 'TG/HDL Ratio', 'Triglycerides', 'Fatty Liver Index']
    .filter(n => TIER_RANK[tierOf(n)] >= TIER_RANK.watch)
  const adiposity = q.anthropometrics.flags.some(f => /adiposity|obese|waist/.test(f))
  if (metabolicHits.length >= 2 && adiposity) {
    findings.push({
      title: 'Insulin-resistance / metabolic-syndrome pattern',
      system: 'Metabolic',
      biomarkers: metabolicHits,
      linkedSignals: ['central_adiposity', ...(q.symptomFlags.includes('afternoon_energy_crashes') ? ['afternoon_energy_crashes'] : [])],
      confidence: 'high',
      refer: false,
    })
  }

  return findings
}
