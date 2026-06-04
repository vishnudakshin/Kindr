import type { AppData, QuestionnaireResponses, BloodPanel, DayEntry, AssessmentCycle } from './types'
import { computeAll } from './scoring'

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
  'White Blood Cells':    { goodDirection: 'down', points: [{ date: 'Oct 24', value: 7.1  }, { date: 'Jan 25', value: 6.8  }, { date: 'Apr 25', value: 6.2  }] },
  'hs-CRP':               { goodDirection: 'down', points: [{ date: 'Oct 24', value: 2.8  }, { date: 'Jan 25', value: 2.4  }, { date: 'Apr 25', value: 2.1  }] },
  Ferritin:               { goodDirection: 'up',   points: [{ date: 'Oct 24', value: 22   }, { date: 'Jan 25', value: 25   }, { date: 'Apr 25', value: 28   }] },
  'Vitamin D (25-OH)':    { goodDirection: 'up',   points: [{ date: 'Oct 24', value: 14   }, { date: 'Jan 25', value: 19   }, { date: 'Apr 25', value: 24   }] },
  'Vitamin B12':          { goodDirection: 'up',   points: [{ date: 'Oct 24', value: 280  }, { date: 'Jan 25', value: 295  }, { date: 'Apr 25', value: 310  }] },
  'Fasting Glucose':      { goodDirection: 'down', points: [{ date: 'Oct 24', value: 104  }, { date: 'Jan 25', value: 100  }, { date: 'Apr 25', value: 96   }] },
  'Fasting Insulin':      { goodDirection: 'down', points: [{ date: 'Oct 24', value: 7.8  }, { date: 'Jan 25', value: 8.5  }, { date: 'Apr 25', value: 9.2  }] },
  'HOMA-IR2':             { goodDirection: 'down', points: [{ date: 'Oct 24', value: 1.8  }, { date: 'Jan 25', value: 2.0  }, { date: 'Apr 25', value: 2.1  }] },
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

export function saveBloodPanel(panel: BloodPanel): void {
  mockData.bloodPanel = panel
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
}

export function saveQuestionnaire(answers: QuestionnaireResponses): void {
  mockData.questionnaire = answers
  mockData.user.goals = answers.goals
  mockData.currentScores = computeAll(answers)
  const today = new Date().toISOString().split('T')[0]
  const last = mockData.scoreHistory[mockData.scoreHistory.length - 1]
  if (last) {
    last.date = today
    last.scores = mockData.currentScores
  } else {
    mockData.scoreHistory.push({ date: today, scores: mockData.currentScores })
  }
}

const questionnaire: QuestionnaireResponses = {
  history: {
    unit: 'metric',
    heightCm: '', weightKg: '', heightFt: '', heightIn: '', weightLbs: '',
    conditions: ['None'], conditionsOther: '',
    medications: 'None', medicationsText: '',
    allergies: 'None known', allergiesText: '',
    tobacco: 'Never',
    mentalHealth: 'No',
    familyHistory: ['None known'], familyHistoryOther: '',
  },
  goals: ['energy', 'sleep', 'clarity'],
  stress: { q1: 3, q2: 3, q3: 2, q4: 3 },
  activity: { vigorous: 2, moderate: 4, energy: 3, sitting: 7 },
  sleep: { duration: 4, latency: 3, restedness: 3, waking: 1 },
  nutrition: { fruitVeg: 3, water: 3, processed: 2, mealRegularity: 3, alcohol: 2 },
  cognition: { focus: 3, fog: 2, memory: 3, trainOfThought: 2, wordFinding: 2 },
  symptoms: {
    physical: ['Headaches'],
    energyMood: ['Afternoon crashes', 'Low motivation'],
    otherSymptoms: '',
    qol: 3,
  },
}

const currentScores = computeAll(questionnaire)

export const mockData: AppData = {
  user: {
    name: 'Alex',
    dateJoined: '2025-01-15',
    reassessmentDate: '2025-04-15',
    goals: questionnaire.goals,
  },

  questionnaire,

  currentScores,

  bloodPanel: {
    'Complete Blood Count': {
      Haemoglobin:           { value: '13.8', unit: 'g/dL',    refRange: '13.5–17.5', status: 'normal' },
      Haematocrit:           { value: '41',   unit: '%',       refRange: '41–53',     status: 'normal' },
      MCV:                   { value: '88',   unit: 'fL',      refRange: '80–100',    status: 'normal' },
      MCH:                   { value: '29.5', unit: 'pg',      refRange: '27–33',     status: 'normal' },
      MCHC:                  { value: '33.5', unit: 'g/dL',    refRange: '32–36',     status: 'normal' },
      RDW:                   { value: '13.2', unit: '%',       refRange: '11.5–14.5', status: 'normal' },
      'White Blood Cells':   { value: '6.2',  unit: '×10⁹/L', refRange: '4–11',      status: 'normal' },
      Neutrophils:           { value: '3.8',  unit: '×10⁹/L', refRange: '1.8–7.7',   status: 'normal' },
      Lymphocytes:           { value: '1.9',  unit: '×10⁹/L', refRange: '1.0–4.8',   status: 'normal' },
      Monocytes:             { value: '0.5',  unit: '×10⁹/L', refRange: '0.2–1.0',   status: 'normal' },
      Eosinophils:           { value: '0.18', unit: '×10⁹/L', refRange: '0.04–0.4',  status: 'normal' },
      Basophils:             { value: '0.03', unit: '×10⁹/L', refRange: '0.0–0.1',   status: 'normal' },
      Platelets:             { value: '210',  unit: '×10⁹/L', refRange: '150–400',   status: 'normal' },
      NLR:                   { value: '2.0',  unit: '',        refRange: '<3.0',      status: 'normal' },
    },
    'Acute Phase Reactants': {
      'hs-CRP':   { value: '2.1', unit: 'mg/L',  refRange: '<1.0',      status: 'borderline' },
      'ESR':      { value: '12',  unit: 'mm/hr', refRange: '0–15',      status: 'normal' },
      'Ferritin': { value: '28',  unit: 'ng/mL', refRange: '30–400',    status: 'borderline' },
    },
    'Vitamins': {
      'Vitamin D (25-OH)': { value: '24',  unit: 'ng/mL', refRange: '30–100',   status: 'borderline' },
      'Folate (B9)':       { value: '9.2', unit: 'ng/mL', refRange: '3.1–20',   status: 'normal' },
      'Vitamin B12':       { value: '310', unit: 'pg/mL', refRange: '200–900',  status: 'normal' },
    },
    'Liver Function': {
      'ALT':              { value: '22',  unit: 'U/L',  refRange: '7–56',    status: 'normal' },
      'AST':              { value: '20',  unit: 'U/L',  refRange: '10–40',   status: 'normal' },
      'GGT':              { value: '28',  unit: 'U/L',  refRange: '9–48',    status: 'normal' },
      'ALP':              { value: '74',  unit: 'U/L',  refRange: '44–147',  status: 'normal' },
      'Bilirubin':        { value: '0.8', unit: 'mg/dL', refRange: '0.2–1.2', status: 'normal' },
      'Total Protein':    { value: '7.1', unit: 'g/dL', refRange: '6.3–8.2', status: 'normal' },
      'Albumin':          { value: '4.2', unit: 'g/dL', refRange: '3.5–5.0', status: 'normal' },
      'Globulin':         { value: '2.9', unit: 'g/dL', refRange: '2.0–3.5', status: 'normal' },
      'Fatty Liver Index': { value: '32', unit: '',      refRange: '<30',     status: 'borderline' },
    },
    'Kidney Function': {
      'Creatinine': { value: '0.9',  unit: 'mg/dL',   refRange: '0.7–1.2',   status: 'normal' },
      'eGFR':       { value: '92',   unit: 'mL/min',  refRange: '>60',       status: 'normal' },
      'BUN/Urea':   { value: '15',   unit: 'mg/dL',   refRange: '7–25',      status: 'normal' },
      'Sodium':     { value: '140',  unit: 'mEq/L',   refRange: '136–145',   status: 'normal' },
      'Potassium':  { value: '4.1',  unit: 'mEq/L',   refRange: '3.5–5.0',   status: 'normal' },
      'Chloride':   { value: '102',  unit: 'mEq/L',   refRange: '98–107',    status: 'normal' },
      'Calcium':    { value: '9.6',  unit: 'mg/dL',   refRange: '8.5–10.5',  status: 'normal' },
      'Bicarbonate':{ value: '24',   unit: 'mEq/L',   refRange: '22–29',     status: 'normal' },
    },
    'Metabolic': {
      'Fasting Glucose':  { value: '96',  unit: 'mg/dL', refRange: '70–100',   status: 'normal' },
      'Fasting Insulin':  { value: '9.2', unit: 'µU/mL', refRange: '2–25',     status: 'normal' },
      'HOMA-IR2':         { value: '2.1', unit: '',       refRange: '<2.0',     status: 'borderline' },
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
      'RBC':                   { value: '0',              unit: '/hpf', refRange: '0–2',           status: 'normal' },
      'Pus Cells':             { value: '3',              unit: '/hpf', refRange: '0–5',           status: 'normal' },
      'Epithelial Cells':      { value: 'Occasional',     unit: '/hpf', refRange: 'Occasional',    status: 'normal' },
      'Casts':                 { value: 'None seen',      unit: '',    refRange: 'None seen',      status: 'normal' },
      'Crystals':              { value: 'None seen',      unit: '',    refRange: 'None seen',      status: 'normal' },
      'Bacteria':              { value: 'Absent',         unit: '',    refRange: 'Absent',         status: 'normal' },
    },
    'Hormones': {
      'Morning Cortisol': { value: '18',  unit: 'µg/dL',  refRange: '6–23',    status: 'normal' },
      'DHEA-S':           { value: '220', unit: 'µg/dL',  refRange: '85–690',  status: 'normal' },
    },
    'Hormones · Optional': {
      'SHBG':                       { value: '', unit: 'nmol/L', refRange: '10–57',    status: undefined },
      'Total Testosterone (men)':   { value: '', unit: 'ng/dL',  refRange: '300–1000', status: undefined },
      'Free Testosterone (men)':    { value: '', unit: 'pg/mL',  refRange: '50–210',   status: undefined },
      'Estradiol (women)':          { value: '', unit: 'pg/mL',  refRange: '30–400',   status: undefined },
      'FSH (women)':                { value: '', unit: 'mIU/mL', refRange: '1.5–12',   status: undefined },
      'LH (women)':                 { value: '', unit: 'mIU/mL', refRange: '1.9–12.5', status: undefined },
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
      scores: { nutrition: 42, sleep: 38, activity: 45, cognition: 50, stress: 40, overall: 43 },
    },
    {
      date: '2025-01-15',
      scores: { nutrition: 55, sleep: 50, activity: 58, cognition: 60, stress: 52, overall: 55 },
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
      finalScores: { nutrition: 55, sleep: 50, activity: 58, cognition: 60, stress: 52, overall: 55 },
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
}

// ── Body model types & data ───────────────────────────────────────────────────

export type SystemStatus = 'optimal' | 'monitor' | 'action'

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
  action:  { color: '#C0392B', label: 'Action needed' },
}

function deriveSystem(
  id:         string,
  name:       string,
  panelKeys:  string[],
  anchor:     { x: number; y: number },
  side:       'left' | 'right',
): BodySystem {
  const entries   = panelKeys.flatMap(k => Object.values(mockData.bloodPanel[k] ?? {}))
  const active    = entries.filter(t => t.value !== '')
  const deficient = active.filter(t => t.status === 'borderline' || t.status === 'abnormal')
  const status: SystemStatus = active.some(t => t.status === 'abnormal')
    ? 'action'
    : active.some(t => t.status === 'borderline')
    ? 'monitor'
    : 'optimal'
  return {
    id, name, status,
    markerCount:    active.length,
    deficientCount: deficient.length,
    anchor, side,
  }
}

// Anchors are % of figure box. Use CALIBRATE=true in BodyModel to tune them.
// Anchors calibrated against the 1024x1536 clean stipple asset
// (x/y = % of figure-box div which equals % of image since img fills the div).
// Flip CALIBRATE=true in BodyModel to re-tune interactively.
export const bodySystems: BodySystem[] = [
  // LEFT column — top to bottom
  deriveSystem('thyroid',   'Thyroid',        ['Thyroid'],
    { x: 50,   y: 21   }, 'left'),
  deriveSystem('blood',     'Blood & Immune',  ['Complete Blood Count', 'Acute Phase Reactants'],
    { x: 60,   y: 80   }, 'right'),
  deriveSystem('liver',     'Liver',           ['Liver Function'],
    { x: 44,   y: 39   }, 'left'),
  deriveSystem('vitamins',  'Vitamins',        ['Vitamins'],
    { x: 40,   y: 80   }, 'left'),
  // RIGHT column — top to bottom
  deriveSystem('heart',     'Heart',           ['Lipids & Cardiac'],
    { x: 53,   y: 29   }, 'right'),
  deriveSystem('metabolic', 'Metabolic',       ['Metabolic'],
    { x: 50,   y: 35   }, 'right'),
  deriveSystem('kidney',    'Kidney',          ['Kidney Function', 'Urinalysis'],
    { x: 56,   y: 42   }, 'right'),
]
