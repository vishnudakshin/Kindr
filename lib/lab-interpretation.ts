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
  optRange?: NumericRange | null  // resolved functional optimal band (narrower than refRange)
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

// ── derived indices (computed, not OCR-extracted) ────────────────────────
// Each is injected as a 'derived' biomarker so it gets a tier and feeds the system rollup. When the
// OCR also reports one, the computed value is preferred (exact and consistent).
export interface Derivation {
  name: string
  group: string // OCR group used only as a system fallback when injecting
  compute: (panel: BloodPanel, ctx: PatientContext) => number | null
}

export const DERIVATIONS: Derivation[] = [
  { // HOMA-IR = Fasting Glucose (mg/dL) × Fasting Insulin (µU/mL) / 405. (mmol/L → divide by 22.5.)
    name: 'HOMA-IR', group: 'Metabolic',
    compute: (p) => {
      const g = findPanelValue(p, 'Fasting Glucose'), i = findPanelValue(p, 'Fasting Insulin')
      return g !== null && i !== null ? (g * i) / 405 : null
    },
  },
  { // FIB-4 = (Age × AST) / (Platelets [×10⁹/L] × √ALT)
    name: 'FIB-4', group: 'Liver Function',
    compute: (p, ctx) => {
      const ast = findPanelValue(p, 'AST'), alt = findPanelValue(p, 'ALT'), plt = findPanelValue(p, 'Platelets')
      if (ctx.age === null || ast === null || alt === null || !plt || alt <= 0) return null
      // Registry stores Platelets in lakhs/cumm (values ≤20); ×100 converts to ×10⁹/L.
      // Legacy data stored in ×10⁹/L (values >20) is used directly.
      const plt10_9 = plt <= 20 ? plt * 100 : plt
      return round2((ctx.age * ast) / (plt10_9 * Math.sqrt(alt)))
    },
  },
  { // TyG index = ln(Triglycerides × Fasting Glucose / 2)
    name: 'TyG Index', group: 'Metabolic',
    compute: (p) => {
      const tg = findPanelValue(p, 'Triglycerides'), g = findPanelValue(p, 'Fasting Glucose')
      return tg && g && tg > 0 && g > 0 ? Math.log((tg * g) / 2) : null
    },
  },
  { // Remnant cholesterol = Total Cholesterol − HDL − LDL
    name: 'Remnant Cholesterol', group: 'Lipids & Cardiac',
    compute: (p) => {
      const tc = findPanelValue(p, 'Total Cholesterol'), hdl = findPanelValue(p, 'HDL'), ldl = findPanelValue(p, 'LDL')
      return tc !== null && hdl !== null && ldl !== null ? tc - hdl - ldl : null
    },
  },
  { // A/G ratio = Albumin / Globulin
    name: 'A/G Ratio', group: 'Liver Function',
    compute: (p) => {
      const alb = findPanelValue(p, 'Albumin'), glob = findPanelValue(p, 'Globulin')
      return alb !== null && glob ? alb / glob : null
    },
  },
  { // Albumin-corrected calcium = Calcium + 0.8 × (4.0 − Albumin)
    name: 'Corrected Calcium', group: 'Vitamins & Minerals',
    compute: (p) => {
      const ca = findPanelValue(p, 'Calcium'), alb = findPanelValue(p, 'Albumin')
      return ca !== null && alb !== null ? ca + 0.8 * (4.0 - alb) : null
    },
  },
  { // LH/FSH ratio (women) — PCOS support
    name: 'LH/FSH Ratio', group: 'Hormones · Optional',
    compute: (p) => {
      const lh = findPanelValue(p, 'LH (women)'), fsh = findPanelValue(p, 'FSH (women)')
      return lh !== null && fsh ? round2(lh / fsh) : null
    },
  },
  { // VLDL = Triglycerides / 5 (Friedewald; valid only when TG < 400 mg/dL)
    name: 'VLDL Cholesterol', group: 'Lipids & Cardiac',
    compute: (p) => {
      const tg = findPanelValue(p, 'Triglycerides')
      return tg !== null && tg > 0 && tg < 400 ? round2(tg / 5) : null
    },
  },
  { // AIP = log₁₀(TG [mmol/L] / HDL [mmol/L]); convert mg/dL → TG÷88.57, HDL÷38.67
    name: 'AIP', group: 'Lipids & Cardiac',
    compute: (p) => {
      const tg = findPanelValue(p, 'Triglycerides'), hdl = findPanelValue(p, 'HDL')
      if (tg === null || !hdl || hdl <= 0 || tg <= 0) return null
      return round2(Math.log10((tg / 88.57) / (hdl / 38.67)))
    },
  },
  { // FAI = (Total Testosterone [ng/dL] × 0.03467 × 100) / SHBG [nmol/L]
    name: 'FAI', group: 'Hormones · Optional',
    compute: (p) => {
      const tt = findPanelValue(p, 'Total Testosterone (men)'), shbg = findPanelValue(p, 'SHBG')
      if (tt === null || !shbg || shbg <= 0) return null
      return round2((tt * 3.467) / shbg)
    },
  },
  { // DHEA-S:Cortisol ratio — both inputs in µg/dL
    name: 'DHEA-S:Cortisol', group: 'Stress Hormones',
    compute: (p) => {
      const dhea = findPanelValue(p, 'DHEA-S'), cort = findPanelValue(p, 'Morning Cortisol')
      return dhea !== null && cort ? round2(dhea / cort) : null
    },
  },
  { // Anion Gap = Sodium − (Chloride + Bicarbonate) in mmol/L
    name: 'Anion Gap', group: 'Kidney Function',
    compute: (p) => {
      const na = findPanelValue(p, 'Sodium'), cl = findPanelValue(p, 'Chloride'), hco3 = findPanelValue(p, 'Bicarbonate')
      return na !== null && cl !== null && hco3 !== null ? round2(na - (cl + hco3)) : null
    },
  },
]

// ── single biomarker ────────────────────────────────────────────────────
export function interpretBiomarker(
  name: string, result: BloodTestResult, ctx: PatientContext, group?: string,
): BiomarkerStatus {
  const def: BiomarkerDef | undefined = BIOMARKERS[name]
  const system = def?.system ?? (group ? GROUP_TO_SYSTEM[group] : undefined) ?? 'Blood & immune'

  if (!def) {
    return {
      name, system, value: result?.value ?? null, unit: result?.unit ?? '', tier: 'unknown',
      refRange: null, direction: 'context', flags: ['not_in_registry'], refer: false, crossLinks: [],
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
      name, system, value: result?.value ?? null, unit: def.unit, tier, refRange: null,
      direction: def.direction, flags, refer, crossLinks: def.crossLinks ?? [], note: def.note,
    }
  }

  const value = parseNumeric(result?.value)
  if (value === null) {
    return {
      name, system, value: result?.value ?? null, unit: def.unit, tier: 'unknown', refRange: ref,
      direction: def.direction, flags: ['unparseable_value'], refer: false,
      crossLinks: def.crossLinks ?? [], note: def.note,
    }
  }

  // Context-only marker with no fixed range (e.g. estradiol/FSH/LH): can't classify alone.
  if (def.direction === 'context' && !ref) {
    return {
      name, system, value, unit: def.unit, tier: 'unknown', refRange: null, direction: def.direction,
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
    name, system, value, unit: def.unit, tier, refRange: ref, optRange: optimal,
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

  // Compute derived indices (HOMA-IR, FIB-4, TyG, remnant cholesterol, A/G, corrected calcium).
  const derived = new Map<string, number>()
  for (const d of DERIVATIONS) {
    const v = d.compute(panel, ctx)
    if (v !== null && Number.isFinite(v)) derived.set(d.name, round2(v))
  }
  const derivedResult = (name: string): BloodTestResult => ({ value: String(derived.get(name)), unit: '', refRange: '' })

  const biomarkers: BiomarkerStatus[] = []
  const seen = new Set<string>()
  for (const group of Object.keys(panel)) {
    const tests = panel[group] ?? {}
    for (const testName of Object.keys(tests)) {
      seen.add(testName)
      if (derived.has(testName)) {
        // OCR also reported a derived marker — prefer the computed value.
        const st = interpretBiomarker(testName, derivedResult(testName), ctx, group)
        st.flags.push('derived')
        biomarkers.push(st)
      } else {
        biomarkers.push(interpretBiomarker(testName, tests[testName], ctx, group))
      }
    }
  }
  // Inject derived markers the panel did not list.
  for (const d of DERIVATIONS) {
    if (derived.has(d.name) && !seen.has(d.name)) {
      const st = interpretBiomarker(d.name, derivedResult(d.name), ctx, d.group)
      st.flags.push('derived')
      biomarkers.push(st)
    }
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
