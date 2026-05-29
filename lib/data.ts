import type { AppData, QuestionnaireResponses } from './types'
import { computeAll } from './scoring'

const questionnaire: QuestionnaireResponses = {
  goals: ['energy', 'sleep', 'clarity'],
  stress: { q1: 3, q2: 3, q3: 2, q4: 3 },
  activity: { vigorous: 2, moderate: 4, energy: 3, sitting: 7 },
  sleep: { duration: 4, latency: 3, restedness: 3, waking: 1 },
  nutrition: { fruitVeg: 3, water: 3, processed: 2, mealRegularity: 3, alcohol: 2 },
  cognition: { focus: 3, fog: 2, memory: 3, taskSwitching: 3 },
  symptoms: {
    physical: ['Headaches'],
    energyMood: ['Afternoon crashes', 'Low motivation'],
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
      Haemoglobin:          { value: '13.8', unit: 'g/dL',   refRange: '13.5–17.5', status: 'normal' },
      Haematocrit:          { value: '41',   unit: '%',      refRange: '41–53',     status: 'normal' },
      'White Blood Cells':  { value: '6.2',  unit: '×10⁹/L', refRange: '4–11',      status: 'normal' },
      Platelets:            { value: '210',  unit: '×10⁹/L', refRange: '150–400',   status: 'normal' },
      Neutrophils:          { value: '3.8',  unit: '×10⁹/L', refRange: '1.8–7.7',   status: 'normal' },
      Lymphocytes:          { value: '1.9',  unit: '×10⁹/L', refRange: '1.0–4.8',   status: 'normal' },
      'NLR':                { value: '2.0',  unit: '',        refRange: '<3.0',      status: 'normal' },
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
      'Protein':  { value: 'Negative', unit: '', refRange: 'Negative', status: 'normal' },
      'Glucose':  { value: 'Negative', unit: '', refRange: 'Negative', status: 'normal' },
      'Ketones':  { value: 'Negative', unit: '', refRange: 'Negative', status: 'normal' },
      'pH':       { value: '6.0',      unit: '', refRange: '4.5–8.0',  status: 'normal' },
    },
    'Hormones': {
      'Morning Cortisol': { value: '18',  unit: 'µg/dL',  refRange: '6–23',    status: 'normal' },
      'DHEA-S':           { value: '220', unit: 'µg/dL',  refRange: '85–690',  status: 'normal' },
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
}
