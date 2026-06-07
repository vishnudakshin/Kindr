// lib/scoring.ts
//
// Pure, side-effect-free scorers for the v3 questionnaire. Every domain resolves to a 0–100
// `wellness` value where higher = better. Each scorer also returns the native `raw` score, a
// human-readable `band`, any `flags`, and a `confidence` level for the labs-fusion layer.

import type {
  StressResponses, ActivityResponses, SleepResponses, NutritionResponses,
  CognitionResponses, WellbeingResponses, HistoryResponses, SymptomsResponses,
  QuestionnaireResponses, QuestionnaireScore, DomainResult, AnthropometricResult,
  AlcoholResult, WellnessScores, WellnessDomain, Ethnicity,
} from './types'
import * as C from './clinical-config'

// ──────────────── helpers ────────────────
const clamp = (x: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, x))
const round = (x: number) => Math.round(x)
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)

// Pick a label by exclusive upper bound (evaluated with `<`); last entry is the fallback.
function categorize(value: number, cutoffs: [number, string][]): string {
  for (const [upper, label] of cutoffs) if (value < upper) return label
  return cutoffs[cutoffs.length - 1][1]
}

// Linear interpolation, used for the documented PROMIS approximation.
function lerp(x: number, x0: number, x1: number, y0: number, y1: number): number {
  if (x1 === x0) return y0
  return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0)
}

// raw → PROMIS T-score: use an official lookup entry if present, else the linear approximation.
function promisRawToT(
  raw: number, table: Record<number, number>,
  rawMin: number, rawMax: number, tAtMin: number, tAtMax: number,
): number {
  const exact = table[raw]
  if (exact !== undefined) return exact
  return lerp(clamp(raw, rawMin, rawMax), rawMin, rawMax, tAtMin, tAtMax)
}

// Map a PROMIS T-score to 0–100 wellness, normalised over the form's ACHIEVABLE T-range (the T at the
// best- and worst-possible raw scores under the active conversion). Because raw→T is monotonic,
// rawMin→lowest T and rawMax→highest T. `higherIsBetter` is true for ability scales (Cognition) and
// false for symptom scales (Sleep Disturbance). This guarantees a full 0–100 span per domain and
// auto-adjusts to the official tables when supplied.
function promisWellness(
  t: number, table: Record<number, number>,
  rawMin: number, rawMax: number, tAtMin: number, tAtMax: number,
  higherIsBetter: boolean,
): number {
  const tLow = promisRawToT(rawMin, table, rawMin, rawMax, tAtMin, tAtMax)
  const tHigh = promisRawToT(rawMax, table, rawMin, rawMax, tAtMin, tAtMax)
  const frac = tHigh === tLow ? 0 : (t - tLow) / (tHigh - tLow)
  return clamp((higherIsBetter ? frac : 1 - frac) * 100)
}

// ──────────────── Stress: PSS-10 ────────────────
export function scoreStress(r: StressResponses): DomainResult {
  const raw = r.items.reduce((sum, v, i) => {
    const val = clamp(v, C.PSS10_ITEM_MIN, C.PSS10_ITEM_MAX)
    return sum + (C.PSS10_REVERSE_INDICES.includes(i) ? C.PSS10_ITEM_MAX - val : val)
  }, 0)
  const wellness = round(100 * (1 - raw / C.PSS10_RAW_MAX))
  return {
    domain: 'stress',
    wellness,
    raw,
    band: categorize(raw, C.PSS10_BANDS),
    flags: raw >= C.PSS10_ELEVATED_RAW ? ['elevated_stress'] : [],
    confidence: 'high',
  }
}

// ──────────────── Activity: EVS + strength + sedentary ────────────────
export function scoreActivity(r: ActivityResponses): DomainResult {
  const mvpa = Math.max(0, r.mvpaDays) * Math.max(0, r.mvpaMinutes) // min/week

  let aerobic: number
  if (mvpa >= C.WHO_AEROBIC_TARGET) {
    aerobic = 100
  } else if (mvpa >= C.WHO_AEROBIC_MIN) {
    aerobic = C.ACTIVITY_GUIDELINE_FLOOR_SCORE +
      (100 - C.ACTIVITY_GUIDELINE_FLOOR_SCORE) *
      (mvpa - C.WHO_AEROBIC_MIN) / (C.WHO_AEROBIC_TARGET - C.WHO_AEROBIC_MIN)
  } else {
    aerobic = C.ACTIVITY_GUIDELINE_FLOOR_SCORE * mvpa / C.WHO_AEROBIC_MIN
  }

  const strength = Math.min(100, (Math.max(0, r.strengthDays) / C.WHO_STRENGTH_DAYS) * 100)
  let score = C.ACTIVITY_AEROBIC_WEIGHT * aerobic + C.ACTIVITY_STRENGTH_WEIGHT * strength
  const sedentary = r.sittingHours > C.SEDENTARY_PENALTY_HOURS
  if (sedentary) score *= C.SEDENTARY_PENALTY_FACTOR

  const meetsAerobic = mvpa >= C.WHO_AEROBIC_MIN
  const meetsStrength = r.strengthDays >= C.WHO_STRENGTH_DAYS
  const flags: string[] = []
  if (meetsAerobic) flags.push('meets_aerobic_guideline')
  if (meetsStrength) flags.push('meets_strength_guideline')
  if (sedentary) flags.push('high_sedentary')

  const wellness = round(clamp(score))
  const band =
    wellness >= 80 ? 'Highly active'
    : wellness >= 60 ? 'Sufficiently active'
    : wellness >= 35 ? 'Insufficiently active'
    : 'Inactive'

  return {
    domain: 'activity',
    wellness,
    raw: mvpa,
    band,
    flags,
    confidence: 'moderate',
    meta: {
      mvpaMinPerWeek: mvpa,
      aerobicScore: round(aerobic),
      strengthScore: round(strength),
      meetsAerobic,
      meetsStrength,
    },
  }
}

// ──────────────── Sleep: PROMIS Sleep Disturbance 8a ────────────────
export function scoreSleep(r: SleepResponses): DomainResult {
  const raw = r.items.reduce((a, v) => a + clamp(v, 1, 5), 0) // 8–40
  const t = promisRawToT(
    raw, C.PROMIS_SLEEP_RAW_TO_T,
    C.PROMIS_SLEEP_RAW_MIN, C.PROMIS_SLEEP_RAW_MAX,
    C.PROMIS_SLEEP_T_AT_MIN, C.PROMIS_SLEEP_T_AT_MAX,
  )
  const wellness = round(promisWellness(
    t, C.PROMIS_SLEEP_RAW_TO_T,
    C.PROMIS_SLEEP_RAW_MIN, C.PROMIS_SLEEP_RAW_MAX,
    C.PROMIS_SLEEP_T_AT_MIN, C.PROMIS_SLEEP_T_AT_MAX,
    false, // higher T = more disturbance → lower wellness
  ))
  const band =
    t >= 70 ? 'Severe disturbance'
    : t >= 60 ? 'Moderate disturbance'
    : t >= 55 ? 'Mild disturbance'
    : 'Within normal limits'

  return {
    domain: 'sleep',
    wellness,
    raw,
    band,
    flags: t >= C.PROMIS_SLEEP_FLAG_T ? ['elevated_sleep_disturbance'] : [],
    confidence: C.USING_APPROXIMATE_PROMIS_CONVERSION ? 'moderate' : 'high',
    meta: { tScore: round(t), approxConversion: C.USING_APPROXIMATE_PROMIS_CONVERSION },
  }
}

// ──────────────── Nutrition: STC (diet quality) ────────────────
export function scoreNutrition(r: NutritionResponses): DomainResult {
  const raw = r.stc.reduce((a, v) => a + clamp(v, 0, C.STC_ITEM_MAX), 0) // 0–16, higher = less healthy
  const wellness = round(100 * (1 - raw / C.STC_RAW_MAX))
  const band =
    wellness >= 80 ? 'Strong diet quality'
    : wellness >= 60 ? 'Reasonable diet quality'
    : wellness >= 40 ? 'Room to improve'
    : 'Poor diet quality'
  return { domain: 'nutrition', wellness, raw, band, flags: [], confidence: 'moderate' }
}

// ──────────────── Alcohol: AUDIT-C (flag, not folded into nutrition) ────────────────
export function scoreAlcohol(r: NutritionResponses, sex: string): AlcoholResult {
  const raw = r.auditC.reduce((a, v) => a + clamp(v, 0, C.AUDITC_ITEM_MAX), 0) // 0–12
  const isFemale = /female|woman/i.test(sex)
  const threshold = isFemale ? C.AUDITC_RISK_THRESHOLD_FEMALE : C.AUDITC_RISK_THRESHOLD_MALE
  return { raw, riskFlag: raw >= threshold, wellness: round(100 * (1 - raw / C.AUDITC_RAW_MAX)) }
}

// ──────────────── Cognition: PROMIS Cognitive Function 4a ────────────────
export function scoreCognition(r: CognitionResponses): DomainResult {
  const raw = r.items.reduce((a, v) => a + clamp(v, 1, 5), 0) // 4–20, higher = better
  const t = promisRawToT(
    raw, C.PROMIS_COG_RAW_TO_T,
    C.PROMIS_COG_RAW_MIN, C.PROMIS_COG_RAW_MAX,
    C.PROMIS_COG_T_AT_MIN, C.PROMIS_COG_T_AT_MAX,
  )
  const wellness = round(promisWellness(
    t, C.PROMIS_COG_RAW_TO_T,
    C.PROMIS_COG_RAW_MIN, C.PROMIS_COG_RAW_MAX,
    C.PROMIS_COG_T_AT_MIN, C.PROMIS_COG_T_AT_MAX,
    true, // higher T = better function
  ))
  const band =
    wellness >= 80 ? 'Sharp'
    : wellness >= 60 ? 'Good'
    : wellness >= 40 ? 'Variable'
    : 'Frequent difficulty'
  return {
    domain: 'cognition',
    wellness,
    raw,
    band,
    flags: t < C.PROMIS_COG_LOW_T ? ['low_perceived_cognition'] : [],
    confidence: C.USING_APPROXIMATE_PROMIS_CONVERSION ? 'moderate' : 'high',
    meta: { tScore: round(t), approxConversion: C.USING_APPROXIMATE_PROMIS_CONVERSION },
  }
}

// ──────────────── Wellbeing: WHO-5 ────────────────
export function scoreWellbeing(r: WellbeingResponses): DomainResult {
  const raw = r.items.reduce((a, v) => a + clamp(v, 0, C.WHO5_ITEM_MAX), 0) // 0–25
  const wellness = round(raw * 4) // already 0–100
  const flags: string[] = []
  if (wellness < C.WHO5_DEPRESSION_SCREEN) flags.push('depression_screen_positive')
  else if (wellness < C.WHO5_POOR_WELLBEING) flags.push('low_wellbeing')
  const band =
    wellness < C.WHO5_DEPRESSION_SCREEN ? 'Very low — screen'
    : wellness < C.WHO5_POOR_WELLBEING ? 'Low'
    : wellness < 75 ? 'Moderate'
    : 'Good'
  return { domain: 'wellbeing', wellness, raw, band, flags, confidence: 'high' }
}

// ──────────────── Anthropometrics (flags, not scored) ────────────────
function bmiProfile(e?: Ethnicity): C.BmiProfile {
  return e === 'south_asian' ? 'south_asian' : 'general'
}

export function computeAnthropometrics(h: HistoryResponses): AnthropometricResult {
  const profile = bmiProfile(h.ethnicity)

  let heightM = 0, weightKg = 0
  if (h.unit === 'metric') {
    heightM = (parseFloat(h.heightCm) || 0) / 100
    weightKg = parseFloat(h.weightKg) || 0
  } else {
    const ft = parseFloat(h.heightFt) || 0
    const inch = parseFloat(h.heightIn) || 0
    heightM = (ft * 12 + inch) * 0.0254
    weightKg = (parseFloat(h.weightLbs) || 0) * 0.453592
  }

  const flags: string[] = []

  let bmi: number | null = null
  let bmiCategory: string | null = null
  if (heightM > 0 && weightKg > 0) {
    const b = weightKg / (heightM * heightM)
    if (b >= C.BMI_PLAUSIBLE_MIN && b <= C.BMI_PLAUSIBLE_MAX) {
      bmi = Math.round(b * 10) / 10
      bmiCategory = categorize(bmi, C.BMI_CUTOFFS[profile])
      if (bmiCategory === 'Overweight') flags.push('bmi_overweight')
      if (bmiCategory === 'Obese') flags.push('bmi_obese')
    }
  }

  let whtr: number | null = null
  const waistCm = parseFloat(h.waistCm)
  const heightCm = heightM * 100
  if (heightCm > 0 && !isNaN(waistCm) && waistCm > 0) {
    whtr = Math.round((waistCm / heightCm) * 100) / 100
    if (whtr >= C.WHTR_RISK_THRESHOLD) flags.push('central_adiposity')
    const cut = C.WAIST_RISK_CM[profile]
    const isFemale = /female|woman/i.test(h.sex)
    if ((isFemale && waistCm >= cut.female) || (!isFemale && waistCm >= cut.male)) flags.push('elevated_waist')
  }

  return { bmi, bmiCategory, whtr, flags }
}

// ──────────────── Symptoms pass-through (for labs fusion) ────────────────
export function collectSymptomFlags(s: SymptomsResponses): string[] {
  const slug = (x: string) => x.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
  return [...s.physical, ...s.energyMood]
    .filter(v => v && v.toLowerCase() !== 'none')
    .map(slug)
}

// ──────────────── Aggregate ────────────────
export function scoreQuestionnaire(q: QuestionnaireResponses): QuestionnaireScore {
  const domains: Record<WellnessDomain, DomainResult> = {
    stress: scoreStress(q.stress),
    activity: scoreActivity(q.activity),
    sleep: scoreSleep(q.sleep),
    nutrition: scoreNutrition(q.nutrition),
    cognition: scoreCognition(q.cognition),
    wellbeing: scoreWellbeing(q.wellbeing),
  }

  const alcohol = scoreAlcohol(q.nutrition, q.history.sex)
  const anthropometrics = computeAnthropometrics(q.history)
  const symptomFlags = collectSymptomFlags(q.symptoms)

  // Overall: weighted mean over OVERALL_DOMAINS (wellbeing weight 0 → excluded).
  let weightedSum = 0, weightTotal = 0
  for (const d of C.OVERALL_DOMAINS) {
    const w = C.DOMAIN_WEIGHTS[d]
    weightedSum += domains[d].wellness * w
    weightTotal += w
  }
  const overall = round(weightTotal ? weightedSum / weightTotal : 0)

  // Cross-check WHO-5 against the behavioural-domain mean.
  const domainMean = mean(C.OVERALL_DOMAINS.map(d => domains[d].wellness))
  const delta = round(domains.wellbeing.wellness - domainMean)
  const wellbeingCrossCheck = { delta, flag: Math.abs(delta) >= C.WELLBEING_CROSSCHECK_DELTA }

  return { domains, anthropometrics, alcohol, symptomFlags, overall, wellbeingCrossCheck }
}

// ──────────────── Adapter to the existing WellnessScores shape ────────────────
export function toWellnessScores(q: QuestionnaireResponses): WellnessScores {
  const s = scoreQuestionnaire(q)
  return {
    stress: s.domains.stress.wellness,
    activity: s.domains.activity.wellness,
    sleep: s.domains.sleep.wellness,
    nutrition: s.domains.nutrition.wellness,
    cognition: s.domains.cognition.wellness,
    wellbeing: s.domains.wellbeing.wellness,
    overall: s.overall,
  }
}

// Backwards-compatible alias for lib/data.ts → saveQuestionnaire().
export const computeAll = toWellnessScores
