// lib/clinical-config.ts
//
// Every clinical constant and tunable for the v3 scoring engine lives here, so the logic in
// scoring.ts stays declarative and a clinician can review the thresholds without reading code.

import type { WellnessDomain } from './types'

// ──────────────────────────────────────────────
// Stress — PSS-10
// ──────────────────────────────────────────────
export const PSS10_ITEM_MIN = 0
export const PSS10_ITEM_MAX = 4
export const PSS10_RAW_MAX = 40
// 0-based indices of the positively-worded items that are reverse-scored.
export const PSS10_REVERSE_INDICES = [3, 4, 6, 7]
// Interpretive bands for the 0–40 total (cut-offs are exclusive upper bounds, evaluated with `<`).
export const PSS10_BANDS: [number, string][] = [
  [14, 'Low stress'],
  [27, 'Moderate stress'],
  [Infinity, 'High perceived stress'],
]
export const PSS10_ELEVATED_RAW = 27 // ≥ this → 'elevated_stress' flag

// ──────────────────────────────────────────────
// Activity — Exercise Vital Sign + strength + sedentary (WHO 2020)
// ──────────────────────────────────────────────
export const WHO_AEROBIC_MIN = 150        // min/week moderate-equivalent — guideline minimum
export const WHO_AEROBIC_TARGET = 300     // min/week — upper recommended target
export const WHO_STRENGTH_DAYS = 2        // days/week muscle-strengthening
export const SEDENTARY_PENALTY_HOURS = 8  // sitting hrs/day above which the penalty applies
export const SEDENTARY_PENALTY_FACTOR = 0.9
export const ACTIVITY_AEROBIC_WEIGHT = 0.75
export const ACTIVITY_STRENGTH_WEIGHT = 0.25
export const ACTIVITY_GUIDELINE_FLOOR_SCORE = 70 // aerobic sub-score at exactly the 150-min minimum

// ──────────────────────────────────────────────
// PROMIS conversions (Sleep, Cognition)
// ──────────────────────────────────────────────
// PROMIS instruments report a T-score (mean 50, SD 10) via official raw→T lookup tables.
// The official Sleep Disturbance 8a (v1.0) and Cognitive Function 4a (v2.0) tables are populated
// below, so this is false and sleep/cognition report 'high' confidence. (If you ever swap in a
// different short form, repopulate the tables or set this true to fall back to the linear estimate.)
export const USING_APPROXIMATE_PROMIS_CONVERSION = false

// Sleep Disturbance 8a: raw 8–40, higher T = MORE disturbance.
export const PROMIS_SLEEP_RAW_MIN = 8
export const PROMIS_SLEEP_RAW_MAX = 40
export const PROMIS_SLEEP_T_AT_MIN = 30.5 // official T at raw 8  (fallback only)
export const PROMIS_SLEEP_T_AT_MAX = 77.5 // official T at raw 40 (fallback only)
// Official PROMIS Adult v1.0 – Sleep Disturbance 8a raw→T conversion table.
export const PROMIS_SLEEP_RAW_TO_T: Record<number, number> = {
  8: 30.5, 9: 35.3, 10: 38.1, 11: 40.4, 12: 42.2, 13: 43.9, 14: 45.3, 15: 46.7,
  16: 47.9, 17: 49.1, 18: 50.2, 19: 51.3, 20: 52.4, 21: 53.4, 22: 54.3, 23: 55.3,
  24: 56.2, 25: 57.2, 26: 58.1, 27: 59.1, 28: 60.0, 29: 61.0, 30: 62.0, 31: 63.0,
  32: 64.0, 33: 65.1, 34: 66.2, 35: 67.4, 36: 68.7, 37: 70.2, 38: 72.0, 39: 74.1,
  40: 77.5,
}
export const PROMIS_SLEEP_FLAG_T = 60 // ≥ this T → 'elevated_sleep_disturbance' flag

// Cognitive Function 4a: raw 4–20, higher T = BETTER function.
export const PROMIS_COG_RAW_MIN = 4
export const PROMIS_COG_RAW_MAX = 20
export const PROMIS_COG_T_AT_MIN = 24.99 // official T at raw 4  (worst; fallback only)
export const PROMIS_COG_T_AT_MAX = 61.13 // official T at raw 20 (best;  fallback only)
// Official PROMIS Adult v2.0 – Cognitive Function 4a raw→T conversion table.
export const PROMIS_COG_RAW_TO_T: Record<number, number> = {
  4: 24.99, 5: 28.95, 6: 31.07, 7: 32.94, 8: 34.61, 9: 36.17, 10: 37.69, 11: 39.19,
  12: 40.70, 13: 42.25, 14: 43.86, 15: 45.54, 16: 47.33, 17: 49.28, 18: 51.62,
  19: 54.58, 20: 61.13,
}
export const PROMIS_COG_LOW_T = 40 // < this T → 'low_perceived_cognition' flag

// Wellness for the PROMIS domains is normalised over each form's ACHIEVABLE T-range — the T produced
// by the best- and worst-possible raw scores under the active conversion — so every domain spans a
// full 0–100. The endpoints are derived in scoring.ts from PROMIS_*_T_AT_MIN/MAX (or the official
// raw→T table when present), so no separate window constants are needed and the mapping auto-adjusts
// if you drop in the official tables.

// ──────────────────────────────────────────────
// Nutrition — Starting the Conversation (STC) + AUDIT-C
// ──────────────────────────────────────────────
export const STC_ITEM_MAX = 2
export const STC_RAW_MAX = 16 // 8 items × 2; higher = less healthy
export const AUDITC_ITEM_MAX = 4
export const AUDITC_RAW_MAX = 12
export const AUDITC_RISK_THRESHOLD_MALE = 4
export const AUDITC_RISK_THRESHOLD_FEMALE = 3

// ──────────────────────────────────────────────
// Wellbeing — WHO-5
// ──────────────────────────────────────────────
export const WHO5_ITEM_MAX = 5
export const WHO5_RAW_MAX = 25
export const WHO5_POOR_WELLBEING = 50     // wellness % below which wellbeing is 'poor'
export const WHO5_DEPRESSION_SCREEN = 28  // wellness % below which to screen for depression

// ──────────────────────────────────────────────
// Overall score
// ──────────────────────────────────────────────
// Goals removed → fixed equal weights across the 5 behavioural/psychometric domains.
// WHO-5 (wellbeing) is deliberately EXCLUDED from the overall (weight 0) to avoid construct
// overlap; it is used as a cross-check instead.
export const OVERALL_DOMAINS: WellnessDomain[] = ['stress', 'activity', 'sleep', 'nutrition', 'cognition']
export const DOMAIN_WEIGHTS: Record<WellnessDomain, number> = {
  stress: 1, activity: 1, sleep: 1, nutrition: 1, cognition: 1, wellbeing: 0,
}
export const WELLBEING_CROSSCHECK_DELTA = 20 // |WHO-5 − domain mean| above which to flag divergence

// ──────────────────────────────────────────────
// Anthropometrics
// ──────────────────────────────────────────────
export type BmiProfile = 'general' | 'south_asian'
// BMI category cut-offs (exclusive upper bounds, evaluated with `<`; last band is open-ended).
export const BMI_CUTOFFS: Record<BmiProfile, [number, string][]> = {
  general: [
    [18.5, 'Underweight'],
    [25, 'Healthy weight'],
    [30, 'Overweight'],
    [Infinity, 'Obese'],
  ],
  // WHO Asian / ICMR (2009) consensus cut-offs for South-Asian populations.
  south_asian: [
    [18.5, 'Underweight'],
    [23, 'Healthy weight'],
    [25, 'Overweight'],
    [Infinity, 'Obese'],
  ],
}
export const WHTR_RISK_THRESHOLD = 0.5
export const WAIST_RISK_CM: Record<BmiProfile, { male: number; female: number }> = {
  general: { male: 102, female: 88 },
  south_asian: { male: 90, female: 80 },
}
export const BMI_PLAUSIBLE_MIN = 10
export const BMI_PLAUSIBLE_MAX = 70
