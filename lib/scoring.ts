import type {
  StressResponses,
  ActivityResponses,
  SleepResponses,
  NutritionResponses,
  CognitionResponses,
  QuestionnaireResponses,
  WellnessScores,
} from './types'

// Clamps a value to [0, 100]
function clamp(n: number): number {
  return Math.max(0, Math.min(100, n))
}

// Normalises a raw sum to 0–100 given the min and max possible raw values
function norm(raw: number, min: number, max: number): number {
  return clamp(Math.round(((raw - min) / (max - min)) * 100))
}

// ─────────────────────────────────────────────
// PSS-4 stress score
// Raw scale: 1–5 per item, 4 items → raw range 4–20
// Higher raw = more stress = LOWER wellness score
//
// NOTE: The written spec says items 2 & 3 are positively-worded.
// The HTML source-of-truth (kindr_questionnaire_v2.html) marks items 2 & 4
// as positively-worded ("confident handling problems", "things going your way").
// Item 3 is negatively-worded ("difficulties piling up"). HTML wins.
// Reverse-score items 2 and 4: reversed = 6 − raw
// ─────────────────────────────────────────────
export function scoreStress({ q1, q2, q3, q4 }: StressResponses): number {
  const raw =
    q1 +          // negative: higher raw → more stressed
    (6 - q2) +    // positive → reverse
    q3 +          // negative
    (6 - q4)      // positive → reverse
  // raw range: 4 (least stressed) → 20 (most stressed)
  // Invert so that higher wellness score = less stress
  return norm(20 - raw, 0, 16)
}

// ─────────────────────────────────────────────
// IPAQ-SF activity score
// vigorous/moderate: 1–7 days; energy: 1–5; sitting: 1–10 (reverse)
// sitting is reverse-scored: 11 − raw puts high sitting at low value
// ─────────────────────────────────────────────
export function scoreActivity({ vigorous, moderate, energy, sitting }: ActivityResponses): number {
  const vigNorm    = norm(vigorous, 1, 7)              // 0–100
  const modNorm    = norm(moderate, 1, 7)              // 0–100
  const energyNorm = norm(energy, 1, 5)                // 0–100
  const sitNorm    = norm(11 - sitting, 1, 10)         // reverse: less sitting = higher score
  return clamp(Math.round((vigNorm + modNorm + energyNorm + sitNorm) / 4))
}

// ─────────────────────────────────────────────
// PSQI-based sleep score
// duration: 1–6 (3hrs–10+hrs); optimal is step 5 (8–9hrs) → bell-curve
// latency: 1–6 (instantly–60+min); reverse-scored
// restedness: 1–5; waking: 0–3 (0=rarely, reverse-scored)
// ─────────────────────────────────────────────
export function scoreSleep({ duration, latency, restedness, waking }: SleepResponses): number {
  // Duration bell-curve: optimal at 5 (8–9 hrs); distance from optimal
  const durationScores = [0, 20, 40, 60, 100, 80] as const
  const durationNorm   = durationScores[duration - 1] ?? 0

  // Latency reverse: step 1 (instantly) = 100, step 6 (60+min) = 0
  const latencyNorm = norm(7 - latency, 1, 6)

  const restednessNorm = norm(restedness, 1, 5)

  // Waking reverse: 0 (rarely) = 100, 3 (nightly) = 0
  const wakingNorm = clamp(Math.round(((3 - waking) / 3) * 100))

  return clamp(Math.round((durationNorm + latencyNorm + restednessNorm + wakingNorm) / 4))
}

// ─────────────────────────────────────────────
// Nutrition score
// fruitVeg: 1–5; water: 1–5; processed: 1–5 (reverse); mealReg: 1–4; alcohol: 1–5 (reverse)
// ─────────────────────────────────────────────
export function scoreNutrition({ fruitVeg, water, processed, mealRegularity, alcohol }: NutritionResponses): number {
  const fvNorm      = norm(fruitVeg, 1, 5)
  const waterNorm   = norm(water, 1, 5)
  const procNorm    = norm(6 - processed, 1, 5)    // reverse: never processed = best
  const mealNorm    = norm(mealRegularity, 1, 4)
  const alcNorm     = norm(6 - alcohol, 1, 5)      // reverse: no alcohol = best
  return clamp(Math.round((fvNorm + waterNorm + procNorm + mealNorm + alcNorm) / 5))
}

// ─────────────────────────────────────────────
// Cognition score
// focus: 1–5; fog: 1–5 (reverse); memory: 1–5; trainOfThought: 1–5 (reverse); wordFinding: 1–5 (reverse)
// ─────────────────────────────────────────────
export function scoreCognition({ focus, fog, memory, trainOfThought, wordFinding }: CognitionResponses): number {
  const focusNorm = norm(focus, 1, 5)
  const fogNorm   = norm(6 - fog, 1, 5)             // reverse: no fog = best
  const memNorm   = norm(memory, 1, 5)
  const totNorm   = norm(6 - trainOfThought, 1, 5)  // reverse: never losing thread = best
  const wfNorm    = norm(6 - wordFinding, 1, 5)     // reverse: no word-finding issues = best
  return clamp(Math.round((focusNorm + fogNorm + memNorm + totNorm + wfNorm) / 5))
}

// ─────────────────────────────────────────────
// Compute all five dimensions + overall average
// ─────────────────────────────────────────────
export function computeAll(r: QuestionnaireResponses): WellnessScores {
  const stress    = scoreStress(r.stress)
  const activity  = scoreActivity(r.activity)
  const sleep     = scoreSleep(r.sleep)
  const nutrition = scoreNutrition(r.nutrition)
  const cognition = scoreCognition(r.cognition)
  const overall   = clamp(Math.round((stress + activity + sleep + nutrition + cognition) / 5))
  return { stress, activity, sleep, nutrition, cognition, overall }
}
