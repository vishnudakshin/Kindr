export type GoalId =
  | 'energy'
  | 'mood'
  | 'clarity'
  | 'sleep'
  | 'nutrition'
  | 'fitness'
  | 'prevention'
  | 'wellbeing'

export interface StressResponses {
  q1: number // 1–5: unable to control things
  q2: number // 1–5: confident handling problems (positive → reverse-scored)
  q3: number // 1–5: difficulties piling up
  q4: number // 1–5: things going your way (positive → reverse-scored)
}

export interface ActivityResponses {
  vigorous: number // 1–7 days
  moderate: number // 1–7 days
  energy: number   // 1–5
  sitting: number  // 1–10 hours (reverse-scored)
}

export interface SleepResponses {
  duration: number   // 1–6 (3hrs→10+hrs)
  latency: number    // 1–6 (instantly→60+min, reverse-scored)
  restedness: number // 1–5
  waking: 0 | 1 | 2 | 3 // 0=rarely, 1=1-2x/wk, 2=3-4x/wk, 3=nightly (reverse-scored)
}

export interface NutritionResponses {
  fruitVeg: number       // 1–5
  water: number          // 1–5
  processed: number      // 1–5 (reverse-scored)
  mealRegularity: number // 1–4 (1=skip often, 4=optimal)
  alcohol: number        // 1–5 (reverse-scored)
}

export interface CognitionResponses {
  focus: number          // 1–5
  fog: number            // 1–5 (reverse-scored)
  memory: number         // 1–5
  trainOfThought: number // 1–5 (reverse-scored: more frequent = worse)
  wordFinding: number    // 1–5 (reverse-scored: more frequent = worse)
}

export interface HistoryResponses {
  sex: string
  dietaryPreferences: string[]
  unit: 'metric' | 'imperial'
  heightCm: string
  weightKg: string
  heightFt: string
  heightIn: string
  weightLbs: string
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
  qol: number // 1–5
}

export interface QuestionnaireResponses {
  history: HistoryResponses
  goals: GoalId[]
  stress: StressResponses
  activity: ActivityResponses
  sleep: SleepResponses
  nutrition: NutritionResponses
  cognition: CognitionResponses
  symptoms: SymptomsResponses
}

export interface WellnessScores {
  nutrition: number
  sleep: number
  activity: number
  cognition: number
  stress: number
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
  goals: GoalId[]
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
