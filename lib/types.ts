// lib/types.ts — Kindr v3 schema
//
// Migrated from the v2 types to match the v3 evidence-based instrument set.
// BREAKING CHANGES vs v2 (the questionnaire UI in app/questionnaire/page.tsx and
// lib/data.ts must be updated to collect/persist these fields):
//   • Removed `GoalId` and all `goals` (goals selector dropped from questionnaire + profile).
//   • Stress:    PSS-4 (q1–q4)                  → PSS-10 (items[10], each 0–4).
//   • Activity:  vigorous/moderate/energy/sitting → EVS (mvpaDays, mvpaMinutes) + strengthDays + sittingHours.
//   • Sleep:     partial-PSQI fields            → PROMIS Sleep Disturbance SF 8a (items[8], each 1–5).
//   • Nutrition: ad-hoc fields                  → STC (stc[8], each 0–2) + AUDIT-C (auditC[3], each 0–4).
//   • Cognition: ad-hoc fields                  → PROMIS Cognitive Function SF 4a (items[4], each 1–5).
//   • Added `WellbeingResponses` (WHO-5, items[5], each 0–5); `qol` removed from SymptomsResponses.
//   • History:   added `age`, `waistCm`, `ethnicity` (drive age/sex/ethnicity-specific ranges & cut-offs).
//   • WellnessScores: added `wellbeing`. UserProfile.goals removed.

// ============================================================
// Questionnaire response types
// ============================================================

export interface StressResponses {
  // PSS-10: 10 items, each 0–4 (0 = Never … 4 = Very often).
  // Positively-worded items (0-based indices 3,4,6,7) are reverse-scored — see PSS10_REVERSE_INDICES.
  items: number[] // length 10
}

export interface ActivityResponses {
  mvpaDays: number      // 0–7   days/week of moderate-to-strenuous exercise (EVS Q1)
  mvpaMinutes: number   // ≥0    minutes per session on those days (EVS Q2)
  strengthDays: number  // 0–7   days/week of muscle-strengthening activity
  sittingHours: number  // ≥0    hours/day spent sitting (sedentary — scored separately)
}

export interface SleepResponses {
  // PROMIS Sleep Disturbance Short Form 8a: 8 items, each 1–5. Higher raw = MORE disturbance.
  items: number[] // length 8
}

export interface NutritionResponses {
  stc: number[]    // Starting the Conversation: 8 items, each 0–2 (higher = less healthy)
  auditC: number[] // AUDIT-C: 3 items, each 0–4 (higher = higher-risk drinking)
}

export interface CognitionResponses {
  // PROMIS Cognitive Function Short Form 4a: 4 items, each 1–5. Higher = BETTER function.
  items: number[] // length 4
}

export interface WellbeingResponses {
  // WHO-5 Wellbeing Index: 5 items, each 0–5. Higher = better wellbeing.
  items: number[] // length 5
}

export type Ethnicity = 'south_asian' | 'east_asian' | 'general' | 'unspecified'

export interface HistoryResponses {
  age: number | null            // NEW — required for age-specific lab reference ranges & risk
  sex: string                   // 'Female' | 'Male' | 'Intersex' | 'Prefer to self-describe'
  ethnicity?: Ethnicity         // NEW — selects BMI / waist cut-offs (defaults to 'general')
  dietaryPreferences: string[]
  unit: 'metric' | 'imperial'
  heightCm: string
  weightKg: string
  heightFt: string
  heightIn: string
  weightLbs: string
  waistCm: string               // NEW — always in cm (for waist-to-height ratio)
  bpSystolic?: number | null    // NEW — optional resting BP (metabolic-syndrome criterion, hypertension awareness)
  bpDiastolic?: number | null   // NEW
  conditions: string[]
  conditionsOther: string
  medications: string
  medicationsText: string
  allergies: string
  allergiesText: string
  tobacco: string
  mentalHealth: string
  familyHistory: string[]
  familyHistoryOther: string
}

export interface SymptomsResponses {
  physical: string[]
  energyMood: string[]
  otherSymptoms: string
  // NOTE: `qol` removed in v3 — overall wellbeing is now the WHO-5 (WellbeingResponses).
}

export interface QuestionnaireResponses {
  history: HistoryResponses
  stress: StressResponses
  activity: ActivityResponses
  sleep: SleepResponses
  nutrition: NutritionResponses
  cognition: CognitionResponses
  wellbeing: WellbeingResponses
  symptoms: SymptomsResponses
}

// ============================================================
// Scoring output types
// ============================================================

export type WellnessDomain =
  | 'stress' | 'activity' | 'sleep' | 'nutrition' | 'cognition' | 'wellbeing'

export type Confidence = 'low' | 'moderate' | 'high'

export interface DomainResult {
  domain: WellnessDomain
  wellness: number   // 0–100, higher = better
  raw: number        // instrument raw score (native scale)
  band: string       // human-readable severity band
  flags: string[]    // e.g. 'elevated_stress', 'meets_aerobic_guideline'
  confidence: Confidence
  meta?: Record<string, number | boolean | string>
}

export interface AnthropometricResult {
  bmi: number | null
  bmiCategory: string | null
  whtr: number | null // waist-to-height ratio
  flags: string[]     // e.g. 'central_adiposity', 'bmi_obese'
}

export interface AlcoholResult {
  raw: number       // AUDIT-C total 0–12
  riskFlag: boolean // sex-specific threshold met
  wellness: number  // optional 0–100 (NOT folded into the nutrition domain)
}

export interface QuestionnaireScore {
  domains: Record<WellnessDomain, DomainResult>
  anthropometrics: AnthropometricResult
  alcohol: AlcoholResult
  symptomFlags: string[]  // normalised symptom slugs, passed to the labs fusion layer
  overall: number         // 0–100, weighted mean of the 5 behavioural/psychometric domains
  wellbeingCrossCheck: { delta: number; flag: boolean } // WHO-5 vs domain-mean divergence
}

// ============================================================
// Existing app types (carried over; `wellbeing` added, `goals` removed)
// ============================================================

export interface WellnessScores {
  nutrition: number
  sleep: number
  activity: number
  cognition: number
  stress: number
  wellbeing: number // NEW
  overall: number
}

export interface BloodTestResult {
  value: string
  unit: string
  refRange: string
  status?: 'normal' | 'borderline' | 'abnormal'
}

export type BloodPanel = Record<string, Record<string, BloodTestResult>>

export type PlanCategory = 'Nutrition' | 'Mind & Body' | 'Fitness'

export interface PlanItem {
  id: string
  category: PlanCategory
  title: string
  description: string
  completed: boolean
}

export type ResourceType = 'READ' | 'LISTEN' | 'RITUAL'

export interface Resource {
  id: string
  type: ResourceType
  duration: string
  title: string
  description: string
  iconName: string
}

export interface ScoreSnapshot {
  date: string
  scores: WellnessScores
}

export interface DayEntry {
  date: string
  tasksCompleted: number
  tasksTotal: number
}

export interface AssessmentCycle {
  id: string
  startDate: string
  endDate?: string
  days: DayEntry[]
  finalScores?: WellnessScores
}

export interface UserProfile {
  name: string
  dateJoined: string
  reassessmentDate: string
  // `goals` removed in v3.
}

export type SectionId =
  | 'wellnessScores'
  | 'labResults'
  | 'questionnaireAnswers'
  | 'functionalSymptoms'
  | 'planAdherence'
  | 'journeySnapshot'

export type RelationshipType = 'doctor' | 'coach' | 'partner' | 'family' | 'friend' | 'other'

export interface ShareRecord {
  id: string
  date: string
  sections: SectionId[]
  recipientName?: string
  relationship?: RelationshipType
}

export interface AppData {
  user: UserProfile
  questionnaire: QuestionnaireResponses
  currentScores: WellnessScores
  bloodPanel: BloodPanel
  planItems: PlanItem[]
  resources: Resource[]
  scoreHistory: ScoreSnapshot[]
  currentCycle: AssessmentCycle
  previousCycles: AssessmentCycle[]
  shareHistory: ShareRecord[]
}
