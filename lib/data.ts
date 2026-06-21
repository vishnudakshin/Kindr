import type { AppData, QuestionnaireResponses, BloodPanel, DayEntry, AssessmentCycle, ShareRecord, SectionId, RelationshipType, DietLog, DietaryGoal, DietAssessment, WellnessScores } from './types'
import { computeAll, scoreQuestionnaire } from './scoring'
import { interpretPanel, type SystemStatus as InterpSysStatus, type BiomarkerStatus } from './lab-interpretation'
import { buildFindings, type FindingsResult, type Finding } from './findings'
import { buildReport, type KindrReport } from './report'
import { buildDailyPlan, type DailyPlan, type PlanTask } from './plan'
import { buildDailyPlanV2 } from './intervention-engine'
import type { DailyPlanV2, PlannedTask } from './intervention-schema'
export type { FindingsResult, Finding, KindrReport, DailyPlan, PlanTask, DailyPlanV2, PlannedTask }

// ── Cycle day generator ────────────────────────────────────────────────────────

function makeDays(startDate: string, count: number): DayEntry[] {
  const days: DayEntry[] = []
  for (let i = 0; i < count; i++) {
    const d = new Date(startDate + 'T00:00:00Z')
    d.setUTCDate(d.getUTCDate() + i)
    const date = d.toISOString().split('T')[0]

    const h1 = Math.abs(Math.sin(i * 2.3 + 0.7))
    const h2 = Math.abs(Math.sin(i * 5.1 + 1.3))

    if (h1 < 0.15) {
      days.push({ date, tasksCompleted: 0, tasksTotal: 10 })
      continue
    }
    const week = Math.floor(i / 7)
    const base = week <= 2 ? 4 + week : 7
    const jitter = Math.floor(h2 * 5) - 2
    const completed = Math.max(1, Math.min(10, base + jitter))
    days.push({ date, tasksCompleted: completed, tasksTotal: 10 })
  }
  return days
}

// ── Blood trend history ───────────────────────────────────────────────────────
// Three data points: Oct 2024 → Jan 2025 → Apr 2025

export interface TrendPoint { date: string; value: number }
export interface TrendSeries { goodDirection: 'up' | 'down'; points: TrendPoint[] }

export const bloodTrends: Record<string, TrendSeries> = {
  Haemoglobin:            { goodDirection: 'up',   points: [{ date: 'Oct 24', value: 13.4 }, { date: 'Jan 25', value: 13.6 }, { date: 'Apr 25', value: 13.8 }] },
  'White Blood Cells':    { goodDirection: 'down', points: [{ date: 'Oct 24', value: 7100 }, { date: 'Jan 25', value: 6800 }, { date: 'Apr 25', value: 6200 }] },
  'hs-CRP':               { goodDirection: 'down', points: [{ date: 'Oct 24', value: 2.8  }, { date: 'Jan 25', value: 2.4  }, { date: 'Apr 25', value: 2.1  }] },
  Ferritin:               { goodDirection: 'up',   points: [{ date: 'Oct 24', value: 22   }, { date: 'Jan 25', value: 25   }, { date: 'Apr 25', value: 28   }] },
  'Vitamin D (25-OH)':    { goodDirection: 'up',   points: [{ date: 'Oct 24', value: 14   }, { date: 'Jan 25', value: 19   }, { date: 'Apr 25', value: 24   }] },
  'Vitamin B12':          { goodDirection: 'up',   points: [{ date: 'Oct 24', value: 280  }, { date: 'Jan 25', value: 295  }, { date: 'Apr 25', value: 310  }] },
  'Fasting Glucose':      { goodDirection: 'down', points: [{ date: 'Oct 24', value: 104  }, { date: 'Jan 25', value: 100  }, { date: 'Apr 25', value: 96   }] },
  'Fasting Insulin':      { goodDirection: 'down', points: [{ date: 'Oct 24', value: 7.8  }, { date: 'Jan 25', value: 8.5  }, { date: 'Apr 25', value: 9.2  }] },
  'HOMA-IR':              { goodDirection: 'down', points: [{ date: 'Oct 24', value: 1.8  }, { date: 'Jan 25', value: 2.0  }, { date: 'Apr 25', value: 2.1  }] },
  HbA1c:                  { goodDirection: 'down', points: [{ date: 'Oct 24', value: 5.8  }, { date: 'Jan 25', value: 5.6  }, { date: 'Apr 25', value: 5.4  }] },
  'Total Cholesterol':    { goodDirection: 'down', points: [{ date: 'Oct 24', value: 210  }, { date: 'Jan 25', value: 202  }, { date: 'Apr 25', value: 195  }] },
  LDL:                    { goodDirection: 'down', points: [{ date: 'Oct 24', value: 125  }, { date: 'Jan 25', value: 121  }, { date: 'Apr 25', value: 118  }] },
  HDL:                    { goodDirection: 'up',   points: [{ date: 'Oct 24', value: 48   }, { date: 'Jan 25', value: 50   }, { date: 'Apr 25', value: 52   }] },
  Triglycerides:          { goodDirection: 'down', points: [{ date: 'Oct 24', value: 138  }, { date: 'Jan 25', value: 131  }, { date: 'Apr 25', value: 125  }] },
  'Non-HDL':              { goodDirection: 'down', points: [{ date: 'Oct 24', value: 152  }, { date: 'Jan 25', value: 147  }, { date: 'Apr 25', value: 143  }] },
  TSH:                    { goodDirection: 'down', points: [{ date: 'Oct 24', value: 2.4  }, { date: 'Jan 25', value: 2.2  }, { date: 'Apr 25', value: 2.1  }] },
  'Morning Cortisol':     { goodDirection: 'up',   points: [{ date: 'Oct 24', value: 15   }, { date: 'Jan 25', value: 16   }, { date: 'Apr 25', value: 18   }] },
}

// ── Grove data types & mock ───────────────────────────────────────────────────

export interface GroveDay {
  date: string
  completion: number  // 0–1
  future?: boolean
}

function groveSeed(i: number, s = 0): number {
  const x = Math.sin(i * 127.1 + s * 311.7) * 43758.5453
  return x - Math.floor(x)
}

/** Standalone 90-day mock so ProgressGrove renders without live cycle data. */
export const grove90Mock: GroveDay[] = Array.from({ length: 90 }, (_, i) => {
  if (i >= 62) return { date: `grove-day-${i + 1}`, completion: 0, future: true }
  if (groveSeed(i * 3 + 0) < 0.10) return { date: `grove-day-${i + 1}`, completion: 0 }
  const completion = Math.min(1, 0.3 + groveSeed(i * 3 + 1) * 0.8)
  return { date: `grove-day-${i + 1}`, completion }
})

export function saveDietLog(log: DietLog): void {
  mockData.dietLog = log
  _persistIfActive()
}

export function getDietLog(): DietLog | null {
  return mockData.dietLog
}

export function saveDietaryGoal(goal: DietaryGoal): void {
  mockData.dietaryGoal = goal
  _persistIfActive()
}

export function getDietaryGoal(): DietaryGoal {
  return mockData.dietaryGoal
}

export function saveDietAssessment(assessment: DietAssessment): void {
  mockData.dietAssessment = assessment
  _persistIfActive()
}

export function getDietAssessment(): DietAssessment | undefined {
  return mockData.dietAssessment
}

export function saveBloodPanel(panel: BloodPanel): void {
  mockData.bloodPanel = panel
  _persistIfActive()
}

export function getCycleDay(cycle: ReturnType<typeof makeDays>[number]['date'], startDate: string): number {
  const start = new Date(startDate + 'T00:00:00Z')
  const target = new Date(cycle + 'T00:00:00Z')
  return Math.round((target.getTime() - start.getTime()) / 86_400_000)
}

export function getDayEntry(date: string) {
  return mockData.currentCycle.days.find(d => d.date === date)
}

export function saveTodayEntry(tasksCompleted: number, tasksTotal: number): void {
  const today = new Date().toISOString().split('T')[0]
  const existing = mockData.currentCycle.days.find(d => d.date === today)
  if (existing) {
    existing.tasksCompleted = tasksCompleted
    existing.tasksTotal = tasksTotal
  } else {
    mockData.currentCycle.days.push({ date: today, tasksCompleted, tasksTotal })
  }
  _persistIfActive()
}

export function saveQuestionnaire(answers: QuestionnaireResponses): void {
  mockData.questionnaire = answers
  mockData.currentScores = computeAll(answers)
  const today = new Date().toISOString().split('T')[0]
  const last = mockData.scoreHistory[mockData.scoreHistory.length - 1]
  if (last) {
    last.date = today
    last.scores = mockData.currentScores
  } else {
    mockData.scoreHistory.push({ date: today, scores: mockData.currentScores })
  }
  _persistIfActive()
}

// ── localStorage init helpers ─────────────────────────────────────────────────

/** Flush the current mockData to localStorage under the active user ID. */
export function _persistIfActive(): void {
  if (typeof window === 'undefined') return
  const id = window.localStorage.getItem('kindr_active_user')
  if (!id) return
  window.localStorage.setItem(`kindr_data_${id}`, JSON.stringify(mockData))
  // Keep the user index summary in sync
  try {
    const raw = window.localStorage.getItem('kindr_users')
    if (!raw) return
    const users: Array<{ id: string; lastUpdated: string; overallScore: number; hasQuestionnaire: boolean; hasLabResults: boolean }> = JSON.parse(raw)
    const u = users.find(x => x.id === id)
    if (u) {
      const h = mockData.questionnaire.history
      u.lastUpdated      = new Date().toISOString().split('T')[0]
      u.overallScore     = Math.round(mockData.currentScores.overall ?? 0)
      u.hasQuestionnaire = !!(h.sex || h.heightCm || h.weightKg)
      u.hasLabResults    = Object.values(mockData.bloodPanel).some(g =>
        Object.values(g).some(r => r.value !== ''),
      )
      window.localStorage.setItem('kindr_users', JSON.stringify(users))
    }
  } catch {}
}

/** Load stored AppData for the active user from localStorage (client-side only). */
function loadFromStorage(): AppData | null {
  if (typeof window === 'undefined') return null
  try {
    const id  = window.localStorage.getItem('kindr_active_user')
    if (!id) return null
    const raw = window.localStorage.getItem(`kindr_data_${id}`)
    return raw ? (JSON.parse(raw) as AppData) : null
  } catch { return null }
}

// ── Default questionnaire (used for demo user "Alex" and as blank template) ───

const DEFAULT_QUESTIONNAIRE: QuestionnaireResponses = {
  history: {
    age: null, sex: '', ethnicity: 'south_asian', dietaryPreferences: [], unit: 'metric',
    heightCm: '', weightKg: '', heightFt: '', heightIn: '', weightLbs: '', waistCm: '',
    bpSystolic: null, bpDiastolic: null,
    conditions: ['None'], conditionsOther: '',
    medications: 'None', medicationsText: '',
    allergies: 'None known', allergiesText: '',
    tobacco: 'Never', mentalHealth: 'No',
    familyHistory: ['None known'], familyHistoryOther: '',
    bowelStatus: 'Regular',
  },
  stress:    { items: Array(10).fill(3) },
  activity:  { mvpaDays: 3, mvpaMinutes: 45, strengthDays: 2, sittingHours: 7 },
  sleep:     { items: Array(8).fill(2) },
  nutrition: { stc: Array(8).fill(1), auditC: Array(3).fill(0) },
  cognition: { items: Array(4).fill(3) },
  wellbeing: { items: Array(5).fill(3) },
  symptoms:  { physical: ['Headaches'], energyMood: ['Afternoon crashes', 'Low motivation'], otherSymptoms: '' },
}

const EMPTY_SCORES: WellnessScores = {
  nutrition: 0, sleep: 0, activity: 0, cognition: 0, stress: 0, wellbeing: 0, overall: 0,
}

// questionnaire used for the DEFAULT mock build — replaced by stored data below
const questionnaire: QuestionnaireResponses = DEFAULT_QUESTIONNAIRE
const currentScores = computeAll(questionnaire)

export const mockData: AppData = (() => {
  const stored = loadFromStorage()
  if (stored) {
    // ── schema migration ─────────────────────────────────────────────────────
    // Merge renamed blood-panel groups so old localStorage data works with
    // current code. Safe to run every load — no-ops when already migrated.
    const bp = stored.bloodPanel
    const hasOldStress  = 'Stress Hormones' in bp
    const hasOldOptHorm = 'Hormones · Optional' in bp
    if (hasOldStress || hasOldOptHorm) {
      const merged: Record<string, typeof stored.bloodPanel[string][string]> = {
        ...(bp['Stress Hormones'] ?? {}),
        ...(bp['Hormones · Optional'] ?? {}),
      }
      // Rename field within merged group
      if ('Total Testosterone (men)' in merged) {
        merged['Total Testosterone'] = {
          ...merged['Total Testosterone (men)'],
          value: merged['Total Testosterone (men)'].value || '0.262',
          unit: 'ng/mL',
          refRange: '0.084–0.481',
        }
        delete merged['Total Testosterone (men)']
      }
      delete bp['Stress Hormones']
      delete bp['Hormones · Optional']
      bp['Hormones'] = { ...(bp['Hormones'] ?? {}), ...merged }
    }
    // Also catch Total Testosterone (men) in any other group (belt-and-suspenders)
    for (const tests of Object.values(bp)) {
      if ('Total Testosterone (men)' in tests) {
        tests['Total Testosterone'] = {
          ...tests['Total Testosterone (men)'],
          value: tests['Total Testosterone (men)'].value || '0.262',
          unit: 'ng/mL',
          refRange: '0.084–0.481',
        }
        delete tests['Total Testosterone (men)']
      }
    }
    // ── end migration ────────────────────────────────────────────────────────
    return stored
  }
  // Fall through to the hardcoded "Alex" demo below
  return {
  user: {
    name: 'Alex',
    dateJoined: '2025-01-15',
    reassessmentDate: '2025-04-15',
  },

  questionnaire,

  currentScores,

  bloodPanel: {
    'Complete Blood Count': {
      Haemoglobin:           { value: '13.8', unit: 'g/dL',    refRange: '13.5–17.5', status: 'normal' },
      Haematocrit:           { value: '41',   unit: '%',       refRange: '41–53',     status: 'normal' },
      MCV:                   { value: '88',   unit: 'fL',      refRange: '83–101',    status: 'normal' },
      MCH:                   { value: '29.5', unit: 'pg',      refRange: '27–33',     status: 'normal' },
      MCHC:                  { value: '33.5', unit: 'g/dL',    refRange: '31.5–34.5', status: 'normal' },
      RDW:                   { value: '13.2', unit: '%',       refRange: '11.6–14.0', status: 'normal' },
      'White Blood Cells':         { value: '6200', unit: 'cells/µL', refRange: '4000–11000', status: 'normal' },
      'Absolute Neutrophil Count': { value: '3800', unit: 'cells/µL', refRange: '2000–7000', status: 'normal' },
      Neutrophils:                 { value: '61',   unit: '%',       refRange: '40–80',     status: 'normal' },
      Lymphocytes:           { value: '31',   unit: '%',       refRange: '20–40',     status: 'normal' },
      Monocytes:             { value: '8',    unit: '%',       refRange: '2–10',      status: 'normal' },
      Eosinophils:           { value: '3',    unit: '%',       refRange: '1–6',       status: 'normal' },
      Basophils:             { value: '0.5',  unit: '%',       refRange: '0.0–2.0',   status: 'normal' },
      Platelets:              { value: '2.10', unit: 'lakhs/cumm',    refRange: '1.5–4.1',    status: 'normal' },
      'Reticulocyte':         { value: '',     unit: '%',       refRange: '0.5–2.5',  status: undefined },
      NLR:                    { value: '2.0',  unit: 'ratio',   refRange: '0.78–3.53', status: 'normal' },
    },
    'Inflammation & Iron Profile': {
      'ESR':                    { value: '12',  unit: 'mm/hr',  refRange: '0–15',     status: 'normal' },
      'Ferritin':               { value: '28',  unit: 'ng/mL',  refRange: '30–400',   status: 'borderline' },
      'Serum Iron':             { value: '85',  unit: 'µg/dL',  refRange: '60–170',   status: 'normal' },
      'TIBC':                   { value: '340', unit: 'µg/dL',  refRange: '240–450',  status: 'normal' },
      'Transferrin Saturation': { value: '25',  unit: '%',      refRange: '20–50',    status: 'normal' },
    },
    'Vitamins & Minerals': {
      'Vitamin D (25-OH)': { value: '24',  unit: 'ng/mL', refRange: '30–100',  status: 'borderline' },
      'Folate (B9)':       { value: '9.2', unit: 'ng/mL', refRange: '3.1–20',  status: 'normal' },
      'Vitamin B12':       { value: '310', unit: 'pg/mL', refRange: '200–900', status: 'normal' },
      'Magnesium':         { value: '',    unit: 'mg/dL', refRange: '1.7–2.2', status: undefined },
      'Sodium':            { value: '140', unit: 'mEq/L', refRange: '136–145', status: 'normal' },
      'Potassium':         { value: '4.1', unit: 'mEq/L', refRange: '3.5–5.0', status: 'normal' },
      'Chloride':          { value: '102', unit: 'mEq/L', refRange: '98–107',  status: 'normal' },
      'Bicarbonate':       { value: '24',  unit: 'mEq/L', refRange: '22–29',   status: 'normal' },
      'Calcium':           { value: '9.6', unit: 'mg/dL', refRange: '8.5–10.5',status: 'normal' },
    },
    'Liver Function': {
      'ALT':              { value: '22',  unit: 'U/L',   refRange: '7–56',    status: 'normal' },
      'AST':              { value: '20',  unit: 'U/L',   refRange: '10–40',   status: 'normal' },
      'GGT':              { value: '28',  unit: 'U/L',   refRange: '9–48',    status: 'normal' },
      'ALP':              { value: '74',  unit: 'U/L',   refRange: '44–147',  status: 'normal' },
      'Bilirubin':        { value: '0.8', unit: 'mg/dL', refRange: '0.2–1.2', status: 'normal' },
      'Total Protein':    { value: '7.1', unit: 'g/dL',  refRange: '6.3–8.2', status: 'normal' },
      'Albumin':          { value: '4.2', unit: 'g/dL',  refRange: '3.5–5.0', status: 'normal' },
      'Globulin':         { value: '2.9', unit: 'g/dL',  refRange: '2.0–3.5', status: 'normal' },
      'Fatty Liver Index':{ value: '32',  unit: '',       refRange: '<30',     status: 'borderline' },
    },
    'Kidney Function': {
      'Creatinine':           { value: '0.9', unit: 'mg/dL',  refRange: '0.7–1.2', status: 'normal' },
      'eGFR':                 { value: '92',  unit: 'mL/min', refRange: '>90',     status: 'normal' },
      'Urea':                 { value: '30',  unit: 'mg/dL',  refRange: '15–40',   status: 'normal' },
      'Uric Acid':            { value: '5.8', unit: 'mg/dL',  refRange: '<7.2',    status: 'normal' },
      'BUN/Creatinine Ratio': { value: '16',  unit: '',        refRange: '10–20',   status: 'normal' },
    },
    'Metabolic': {
      'Fasting Glucose':  { value: '96',  unit: 'mg/dL', refRange: '70–100',   status: 'normal' },
      'Fasting Insulin':  { value: '9.2', unit: 'µU/mL', refRange: '2–25',     status: 'normal' },
      'HOMA-IR':          { value: '2.1', unit: 'index',  refRange: '<2.0',     status: 'borderline' },
      'HbA1c':            { value: '5.4', unit: '%',      refRange: '<5.7',     status: 'normal' },
    },
    'Lipids & Cardiac': {
      'Total Cholesterol': { value: '195', unit: 'mg/dL', refRange: '<200',    status: 'normal' },
      'HDL':               { value: '52',  unit: 'mg/dL', refRange: '>40',     status: 'normal' },
      'LDL':               { value: '118', unit: 'mg/dL', refRange: '<130',    status: 'normal' },
      'Triglycerides':     { value: '125', unit: 'mg/dL', refRange: '<150',    status: 'normal' },
      'Non-HDL':           { value: '143', unit: 'mg/dL', refRange: '<130',    status: 'borderline' },
      'TC/HDL Ratio':      { value: '3.8', unit: '',       refRange: '<5.0',    status: 'normal' },
      'TG/HDL Ratio':      { value: '2.4', unit: '',       refRange: '<2.0',    status: 'borderline' },
      'ApoB':              { value: '88',  unit: 'mg/dL', refRange: '<90',     status: 'normal' },
      'Lp(a)':             { value: '22',  unit: 'mg/dL', refRange: '<30',     status: 'normal' },
      'hs-CRP':            { value: '2.1', unit: 'mg/L',  refRange: '<3.0',    status: 'borderline' },
    },
    'Thyroid': {
      'TSH':  { value: '2.1', unit: 'mIU/L', refRange: '0.4–4.0', status: 'normal' },
      'FT3':  { value: '3.1', unit: 'pg/mL', refRange: '2.3–4.2', status: 'normal' },
      'FT4':  { value: '1.2', unit: 'ng/dL', refRange: '0.8–1.8', status: 'normal' },
    },
    'Urinalysis': {
      'Colour & Transparency': { value: 'Yellow, Clear', unit: '',    refRange: 'Yellow, Clear',  status: 'normal' },
      'Protein':               { value: 'Negative',      unit: '',    refRange: 'Negative',       status: 'normal' },
      'Glucose':               { value: 'Negative',      unit: '',    refRange: 'Negative',       status: 'normal' },
      'Ketones':               { value: 'Negative',      unit: '',    refRange: 'Negative',       status: 'normal' },
      'pH':                    { value: '6.0',            unit: '',    refRange: '4.5–8.0',        status: 'normal' },
      'RBC':       { value: '0',         unit: '/hpf', refRange: '0–2',     status: 'normal' },
      'Pus Cells': { value: '3',         unit: '/hpf', refRange: '0–5',     status: 'normal' },
      'Casts':     { value: 'None seen', unit: '',     refRange: 'None seen', status: 'normal' },
      'Crystals':  { value: 'None seen', unit: '',     refRange: 'None seen', status: 'normal' },
    },
    'Allergy Panel - IgE': {
      'Total IgE': { value: '', unit: 'IU/mL', refRange: '<100', status: undefined },
    },
    'Hormones': {
      'Morning Cortisol':        { value: '18',   unit: 'µg/dL',   refRange: '6–23',         status: 'normal'    },
      'DHEA-S':                  { value: '220',  unit: 'µg/dL',   refRange: '85–690',       status: 'normal'    },
      'SHBG':                    { value: '',     unit: 'nmol/L',  refRange: '32.4–128',    status: undefined   },
      'Total Testosterone':      { value: '',     unit: 'ng/mL',   refRange: '0.084–0.481', status: undefined   },
      'Free Testosterone (men)': { value: '',     unit: 'pg/mL',   refRange: '50–210',       status: undefined   },
      'Estradiol (women)':       { value: '',     unit: 'pg/mL',   refRange: '30–400',       status: undefined   },
      'FSH (women)':             { value: '',     unit: 'mIU/mL',  refRange: '1.5–12',       status: undefined   },
      'LH (women)':              { value: '',     unit: 'mIU/mL',  refRange: '1.9–12.5',     status: undefined   },
    },
  },

  planItems: [
    { id: 'n1', category: 'Nutrition',    title: 'Add a leafy green to lunch',       description: 'Spinach, rocket, or kale — one small handful counts.',  completed: true  },
    { id: 'n2', category: 'Nutrition',    title: 'Drink 8 glasses of water',         description: 'Set a gentle reminder every 90 minutes.',               completed: false },
    { id: 'n3', category: 'Nutrition',    title: 'Reduce processed snacks by half',  description: 'Swap one packet snack for nuts or fruit each day.',      completed: false },
    { id: 'n4', category: 'Nutrition',    title: 'Eat at consistent times',          description: 'Anchor meals to the same 2-hour windows daily.',        completed: true  },
    { id: 'm1', category: 'Mind & Body',  title: '5-minute breathing practice',      description: 'Box breathing: 4 in, 4 hold, 4 out, 4 hold.',           completed: true  },
    { id: 'm2', category: 'Mind & Body',  title: 'Wind-down screen curfew',          description: 'No screens 45 minutes before bed.',                     completed: false },
    { id: 'm3', category: 'Mind & Body',  title: 'Morning sunlight exposure',        description: '10 minutes outside within 30 min of waking.',           completed: false },
    { id: 'f1', category: 'Fitness',      title: '20-minute brisk walk',             description: 'Every other day — no equipment needed.',                 completed: false },
    { id: 'f2', category: 'Fitness',      title: 'Bodyweight strength circuit',      description: '3×10 squats, push-ups, glute bridges.',                  completed: false },
    { id: 'f3', category: 'Fitness',      title: 'Stretch after sitting sessions',   description: '3 minutes of hip flexor and neck release.',              completed: true  },
  ],

  resources: [
    { id: 'r1', type: 'READ',   duration: '6 MIN',  title: 'Why vitamin D changes everything',      description: 'How a simple deficiency quietly affects mood, immunity, and sleep.',   iconName: 'sun'           },
    { id: 'r2', type: 'LISTEN', duration: '12 MIN', title: 'The cortisol-sleep connection',         description: 'A guided explanation of your stress hormone\'s daily rhythm.',          iconName: 'moon'          },
    { id: 'r3', type: 'RITUAL', duration: '3 MIN',  title: '4-7-8 breathing for stress',            description: 'A simple exhale-focused technique proven to calm the nervous system.', iconName: 'wind'          },
    { id: 'r4', type: 'READ',   duration: '8 MIN',  title: 'Blood sugar and energy crashes',        description: 'What your glucose curve says about afternoon fatigue.',                 iconName: 'chart-line'    },
    { id: 'r5', type: 'LISTEN', duration: '18 MIN', title: 'Movement as medicine',                  description: 'How low-intensity daily movement outperforms intense weekly workouts.',  iconName: 'run'           },
    { id: 'r6', type: 'RITUAL', duration: '5 MIN',  title: 'The evening wind-down ritual',          description: 'Three steps to signal your nervous system that it\'s safe to rest.',   iconName: 'moon-stars'    },
  ],

  scoreHistory: [
    {
      date: '2024-10-15',
      scores: { nutrition: 42, sleep: 38, activity: 45, cognition: 50, stress: 40, wellbeing: 44, overall: 43 },
    },
    {
      date: '2025-01-15',
      scores: { nutrition: 55, sleep: 50, activity: 58, cognition: 60, stress: 52, wellbeing: 56, overall: 55 },
    },
    {
      date: '2025-04-15',
      scores: currentScores,
    },
  ],

  previousCycles: [
    {
      id: 'cycle-1',
      startDate: '2024-10-15',
      endDate: '2025-01-15',
      days: makeDays('2024-10-15', 90),
      finalScores: { nutrition: 55, sleep: 50, activity: 58, cognition: 60, stress: 52, wellbeing: 56, overall: 55 },
    } satisfies AssessmentCycle,
  ],

  currentCycle: {
    id: 'cycle-2',
    startDate: '2025-01-15',
    endDate: '2025-04-15',
    days: (() => {
      const d = makeDays('2025-01-15', 90)
      // 7 fully grown days scattered across the grid
      ;[5, 13, 27, 36, 48, 57, 71].forEach(i => {
        d[i] = { date: d[i].date, tasksCompleted: 10, tasksTotal: 10 }
      })
      return d
    })(),
    finalScores: currentScores,
  } satisfies AssessmentCycle,

  shareHistory: [] as ShareRecord[],
  dietLog: null,
  dietaryGoal: 'maintain',
  }
})()

// ── New user factory ──────────────────────────────────────────────────────────

/** Returns a blank AppData for a brand-new patient (no questionnaire data yet). */
export function makeNewUserData(name: string): AppData {
  const today           = new Date().toISOString().split('T')[0]
  const reassessmentDate = (() => {
    const d = new Date()
    d.setDate(d.getDate() + 90)
    return d.toISOString().split('T')[0]
  })()

  const emptyQ: QuestionnaireResponses = {
    history: {
      age: null, sex: '', ethnicity: 'general', dietaryPreferences: [], unit: 'metric',
      heightCm: '', weightKg: '', heightFt: '', heightIn: '', weightLbs: '', waistCm: '',
      bpSystolic: null, bpDiastolic: null,
      conditions: ['None'], conditionsOther: '',
      medications: 'None', medicationsText: '',
      allergies: 'None known', allergiesText: '',
      tobacco: 'Never', mentalHealth: 'No',
      familyHistory: ['None known'], familyHistoryOther: '',
      bowelStatus: 'Regular',
    },
    stress:    { items: Array(10).fill(2) },
    activity:  { mvpaDays: 0, mvpaMinutes: 0, strengthDays: 0, sittingHours: 8 },
    sleep:     { items: Array(8).fill(3) },
    nutrition: { stc: Array(8).fill(1), auditC: Array(3).fill(0) },
    cognition: { items: Array(4).fill(3) },
    wellbeing: { items: Array(5).fill(3) },
    symptoms:  { physical: [], energyMood: [], otherSymptoms: '' },
  }

  // Blood panel: same group/test structure but all values cleared
  const emptyPanel: BloodPanel = Object.fromEntries(
    Object.entries(mockData.bloodPanel).map(([g, tests]) => [
      g,
      Object.fromEntries(
        Object.entries(tests).map(([t, r]) => [t, { ...r, value: '', status: undefined }]),
      ),
    ]),
  )

  return {
    user:          { name, dateJoined: today, reassessmentDate },
    questionnaire: emptyQ,
    currentScores: EMPTY_SCORES,
    bloodPanel:    emptyPanel,
    planItems:     mockData.planItems,   // generic starter recommendations
    resources:     mockData.resources,
    scoreHistory:  [],
    currentCycle:  { id: 'cycle-1', startDate: today, days: [] },
    previousCycles: [],
    shareHistory:  [],
    dietLog:       null,
    dietaryGoal:   'maintain',
  }
}

export function saveShareRecord(
  sections: SectionId[],
  recipientName?: string,
  relationship?: RelationshipType,
): ShareRecord {
  const record: ShareRecord = {
    id: `share-${Date.now()}`,
    date: new Date().toISOString().split('T')[0],
    sections,
    recipientName: recipientName || undefined,
    relationship: relationship || undefined,
  }
  mockData.shareHistory.unshift(record)
  _persistIfActive()
  return record
}

// ── Body model types & data ───────────────────────────────────────────────────

export type SystemStatus = 'optimal' | 'monitor' | 'action' | 'urgent'

export interface BodySystem {
  id:             string
  name:           string
  status:         SystemStatus
  markerCount:    number
  deficientCount: number
  anchor:         { x: number; y: number }  // % of figure box (0–100)
  side:           'left' | 'right'
}

export const STATUS_META: Record<SystemStatus, { color: string; label: string }> = {
  optimal: { color: '#2E7D32', label: 'Optimal' },
  monitor: { color: '#C77D2E', label: 'Needs attention' },
  action:  { color: '#C77D2E', label: 'Needs attention' },
  urgent:  { color: '#7D1A1A', label: 'Urgent' },
}

// Body system entry id → the specific blood panel groups it covers.
// Used for accurate per-entry marker counts and the dashboard detail sheet.
export const BODY_SYSTEM_GROUPS: Record<string, string[]> = {
  thyroid:      ['Thyroid'],
  liver:        ['Liver Function'],
  blood:        ['Complete Blood Count'],
  vitamins:     ['Vitamins & Minerals'],
  hormones:     ['Hormones'],
  heart:        ['Lipids & Cardiac'],
  kidney:       ['Kidney Function', 'Urinalysis'],
  inflammation: ['Inflammation & Iron Profile'],
  metabolic:    ['Metabolic'],
}

// Computed once at module init using the interpretation layer.
const _labInterp = interpretPanel(mockData.bloodPanel, mockData.questionnaire.history)
export const labInterp = _labInterp
// Per-biomarker lookup used by deriveSystem and the dashboard sheet.
const _bioMarkerMap = new Map<string, BiomarkerStatus>(
  _labInterp.biomarkers.map(b => [b.name, b])
)

const _TIER_RANK: Record<string, number> = {
  unknown: 0, optimal: 1, normal: 1, watch: 2, out_of_range: 3, critical: 4,
}

// Count markers and worst status for a given set of panel groups, ignoring
// entries with no recorded value so the label card reflects actual results.
function deriveSystem(
  id:     string,
  name:   string,
  anchor: { x: number; y: number },
  side:   'left' | 'right',
): BodySystem {
  const groups = BODY_SYSTEM_GROUPS[id] ?? []
  let markerCount = 0, deficientCount = 0, worstRank = 0

  for (const group of groups) {
    const tests = mockData.bloodPanel[group] ?? {}
    for (const [testName, result] of Object.entries(tests)) {
      if (!result.value) continue          // skip entries with no recorded value
      markerCount++
      const b = _bioMarkerMap.get(testName)
      if (b) {
        const rank = _TIER_RANK[b.tier] ?? 0
        if (rank > worstRank) worstRank = rank
        if (rank >= 2) deficientCount++   // watch or worse
      }
    }
  }

  const status: SystemStatus =
    worstRank >= 4 ? 'urgent' :
    worstRank >= 3 ? 'action' :
    worstRank >= 2 ? 'monitor' : 'optimal'

  return { id, name, status, markerCount, deficientCount, anchor, side }
}

// Anchors calibrated against the 1024x1536 clean stipple asset.
// Flip CALIBRATE=true in BodyModel to re-tune interactively.
export const bodySystems: BodySystem[] = [
  // LEFT column — top to bottom
  deriveSystem('thyroid',      'Thyroid',                    { x: 50, y: 21 }, 'left'),
  deriveSystem('liver',        'Liver',                      { x: 44, y: 39 }, 'left'),
  deriveSystem('blood',        'Blood',                      { x: 44, y: 55 }, 'left'),
  deriveSystem('vitamins',     'Vitamins & Minerals',        { x: 42, y: 70 }, 'left'),
  // RIGHT column — top to bottom
  deriveSystem('hormones',     'Stress & Hormones',          { x: 50, y: 10 }, 'right'),
  deriveSystem('heart',        'Heart & Lipids',             { x: 52, y: 27 }, 'right'),
  deriveSystem('kidney',       'Kidney & Urinalysis',        { x: 56, y: 43 }, 'right'),
  deriveSystem('inflammation', 'Inflammation & Iron Profile',{ x: 56, y: 60 }, 'right'),
  deriveSystem('metabolic',    'Metabolic',                  { x: 58, y: 80 }, 'right'),
]

// ── Findings layer (Layer 3) ──────────────────────────────────────────────────
const _qScore = scoreQuestionnaire(mockData.questionnaire)
export const findings: FindingsResult = buildFindings(_qScore, _labInterp, mockData.questionnaire.history)

// ── Report layer (Layer 4) ────────────────────────────────────────────────────
export const report: KindrReport = buildReport(findings, _labInterp, {
  generatedAt: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
  reassessmentDays: 90,
})

// ── Plan layer (Layer 5) ──────────────────────────────────────────────────────
export const dailyPlan: DailyPlan = buildDailyPlan(findings)

// ── Intervention engine v2 (Layer 5 v2) ──────────────────────────────────────
// cycleStartDate is kept 20 days before today so the app renders in 'build' phase
// (foundation=days1–14, build=15–42) — a sensible demo window.
const _today = new Date().toISOString().split('T')[0]
const _cycleStart = (() => {
  const d = new Date(_today)
  d.setDate(d.getDate() - 20)
  return d.toISOString().split('T')[0]
})()
// Derive activity baselines from questionnaire EVS for dose-ladder anchoring.
const _mq = mockData.questionnaire
const _baselines = {
  activityMinutesPerWeek:
    _mq.activity.mvpaDays > 0 && _mq.activity.mvpaMinutes > 0
      ? _mq.activity.mvpaDays * _mq.activity.mvpaMinutes
      : null,
  stepsPerDay: null,
}

export const dailyPlanV2: DailyPlanV2 = buildDailyPlanV2({
  findings,
  history:  _mq.history,
  baselines: _baselines,
  preferences: { difficulty: 'standard' },
  interventionState: [],
  habitProgress: [],
  cycleStartDate: _cycleStart,
  today: _today,
  // Data-driven Nourish personalisation
  nutrition:  _mq.nutrition,
  symptoms:   _mq.symptoms,
  activity:   _mq.activity,
  dietLog:    mockData.dietLog,
  labInterp:  labInterp,
  // Data-driven Calm + Move personalisation
  questionnaireScore: _qScore,
  stress:    _mq.stress,
  sleep:     _mq.sleep,
  wellbeing: _mq.wellbeing,
})
