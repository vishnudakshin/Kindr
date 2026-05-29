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
  focus: number        // 1–5
  fog: number          // 1–5 (reverse-scored)
  memory: number       // 1–5
  taskSwitching: number // 1–5
}

export interface SymptomsResponses {
  physical: string[]
  energyMood: string[]
  qol: number // 1–5
}

export interface QuestionnaireResponses {
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

export interface UserProfile {
  name: string
  dateJoined: string
  reassessmentDate: string
  goals: GoalId[]
}

export interface AppData {
  user: UserProfile
  questionnaire: QuestionnaireResponses
  currentScores: WellnessScores
  bloodPanel: BloodPanel
  planItems: PlanItem[]
  resources: Resource[]
  scoreHistory: ScoreSnapshot[]
}
