// lib/lab-config.ts
//
// Biomarker registry for Layer 2 (lab interpretation). Keyed by the EXACT test names emitted by the
// OCR PANEL_GROUPS so extracted values flow straight in. Each entry defines the unit it expects, the
// body-system it rolls up into, a direction, a clinical reference range (sex/age-aware where needed),
// an optional 'optimal' band, optional critical (red-flag) bounds, and Layer-1 cross-link tags.
//
// IMPORTANT CAVEATS
//  • Ranges below are standard ADULT conventional-unit ranges (the units common in Indian labs).
//    They MUST be reviewed by a clinician and ideally overridden per-lab — reference intervals vary by
//    assay. Each entry's `unit` is the unit the value is assumed to be in; OCR output must be in that
//    unit or normalised first, or the status will be wrong.
//  • `ref` = population clinical range (the basis for out-of-range FLAGS). `optimal` = a narrower,
//    preference-based "functional" band — surface it as guidance, never as a diagnosis.
//  • This is wellness/education, not diagnosis. `critical` bounds and qualitative abnormals set a
//    `refer` flag that should route the user to a clinician rather than a self-care tip.

import type { Ethnicity } from './types'

export type Sex = 'male' | 'female' | 'unknown'

export type BodySystem =
  | 'Thyroid' | 'Liver' | 'Kidney' | 'Heart & Lipids'
  | 'Vitamins & Minerals' | 'Blood' | 'Metabolic' | 'Hormones'
  | 'Inflammation & Iron'

export type Direction =
  | 'high_bad'    // higher = worse (hs-CRP, glucose, LDL…)
  | 'low_bad'     // lower = worse (vitamin D, HDL, eGFR, haemoglobin…)
  | 'two_sided'   // out of range either way (TSH, electrolytes…)
  | 'qualitative' // categorical urinalysis values
  | 'context'     // interpret only with other markers / cycle / menopausal status

export interface NumericRange { low?: number; high?: number }
export type RangeBySex = { male: NumericRange; female: NumericRange; unknown?: NumericRange }
export interface PatientContext {
  age: number | null
  sex: Sex
  ethnicity: Ethnicity
  menopausal?: boolean
  hsCRPElevated?: boolean // set during interpretPanel; used for the ferritin confounder rule
}
export type RangeSpec = NumericRange | RangeBySex | ((ctx: PatientContext) => NumericRange)

export interface BiomarkerDef {
  unit: string
  system: BodySystem
  direction: Direction
  ref?: RangeSpec
  optimal?: RangeSpec
  critical?: RangeSpec
  normalValues?: string[]   // qualitative: substrings treated as normal
  abnormalValues?: string[] // qualitative: substrings treated as abnormal
  referOnAbnormal?: boolean  // qualitative/critical → route to clinician
  crossLinks?: string[]      // Layer-1 domain names + symptom keyword fragments
  note?: string
}

// Fallback system for any extracted marker not in the registry, by its OCR group.
export const GROUP_TO_SYSTEM: Record<string, BodySystem> = {
  'Complete Blood Count':       'Blood',
  'Inflammation & Iron Profile':'Inflammation & Iron',
  'Vitamins & Minerals':        'Vitamins & Minerals',
  'Liver Function':             'Liver',
  'Kidney Function':            'Kidney',
  'Urinalysis':                 'Kidney',
  'Metabolic':                  'Metabolic',
  'Lipids & Cardiac':           'Heart & Lipids',
  'Thyroid':                    'Thyroid',
  'Hormones':                   'Hormones',
  'Hormones · Optional':        'Hormones',
}

// Canonical panel schema — imported by app/api/ocr/route.ts so extraction and registry stay in sync.
export const PANEL_GROUPS: Record<string, string[]> = {
  'Complete Blood Count': [
    'Haemoglobin', 'Haematocrit', 'MCV', 'MCH', 'MCHC', 'RDW',
    'White Blood Cells', 'Neutrophils', 'Lymphocytes', 'Monocytes',
    'Eosinophils', 'Basophils', 'Platelets', 'NLR',
  ],
  'Inflammation & Iron Profile': [
    'hs-CRP', 'ESR', 'Ferritin', 'Serum Iron', 'TIBC', 'Transferrin Saturation',
  ],
  'Vitamins & Minerals': [
    'Vitamin D (25-OH)', 'Folate (B9)', 'Vitamin B12', 'Magnesium',
    'Sodium', 'Potassium', 'Chloride', 'Bicarbonate', 'Calcium',
  ],
  'Liver Function': [
    'ALT', 'AST', 'GGT', 'ALP', 'Bilirubin', 'Total Protein',
    'Albumin', 'Globulin', 'Fatty Liver Index',
  ],
  'Kidney Function': ['Creatinine', 'eGFR', 'BUN/Urea'],
  'Metabolic': ['Fasting Glucose', 'Fasting Insulin', 'HOMA-IR', 'HbA1c'],
  'Lipids & Cardiac': [
    'Total Cholesterol', 'HDL', 'LDL', 'Triglycerides', 'Non-HDL',
    'TC/HDL Ratio', 'TG/HDL Ratio', 'ApoB', 'Lp(a)',
  ],
  'Thyroid': ['TSH', 'FT3', 'FT4'],
  'Urinalysis': [
    'Colour & Transparency', 'Protein', 'Glucose', 'Ketones', 'pH',
    'RBC', 'Pus Cells', 'Epithelial Cells', 'Casts', 'Crystals', 'Bacteria',
  ],
  'Hormones': ['Morning Cortisol', 'DHEA-S'],
  'Hormones · Optional': [
    'SHBG', 'Total Testosterone (men)', 'Free Testosterone (men)',
    'Estradiol (women)', 'FSH (women)', 'LH (women)',
  ],
}

// age-dependent helpers
const esrUpper = (ctx: PatientContext): NumericRange => {
  // Westergren rule of thumb: upper ≈ age/2 (men), (age+10)/2 (women).
  const a = ctx.age ?? 50
  return { high: ctx.sex === 'female' ? (a + 10) / 2 : a / 2 }
}

export const BIOMARKERS: Record<string, BiomarkerDef> = {
  // ── Complete Blood Count → Blood ──────────────────────────────────────────
  'Haemoglobin': {
    unit: 'g/dL', system: 'Blood', direction: 'low_bad',
    ref: { male: { low: 13.0, high: 17.0 }, female: { low: 12.0, high: 15.5 } },
    critical: { low: 8 }, crossLinks: ['fatigue', 'activity', 'cognition'],
  },
  'Haematocrit': {
    unit: '%', system: 'Blood', direction: 'low_bad',
    ref: { male: { low: 40, high: 50 }, female: { low: 36, high: 46 } }, crossLinks: ['fatigue'],
  },
  'MCV': { unit: 'fL', system: 'Blood', direction: 'two_sided', ref: { low: 80, high: 100 },
    note: 'Low → consider iron deficiency; high → consider B12/folate deficiency.' },
  'MCH': { unit: 'pg', system: 'Blood', direction: 'two_sided', ref: { low: 27, high: 33 } },
  'MCHC': { unit: 'g/dL', system: 'Blood', direction: 'two_sided', ref: { low: 32, high: 36 } },
  'RDW': { unit: '%', system: 'Blood', direction: 'high_bad', ref: { high: 14.5 },
    note: 'Elevated RDW can be an early sign of mixed nutritional deficiency.' },
  'White Blood Cells': { unit: '10^9/L', system: 'Blood', direction: 'two_sided',
    ref: { low: 4.0, high: 11.0 }, critical: { low: 2.0, high: 30 }, crossLinks: ['illness'] },
  'Neutrophils': { unit: '%', system: 'Blood', direction: 'two_sided', ref: { low: 40, high: 75 },
    note: 'Percentage range; absolute count (×10^9/L) is preferred if available.' },
  'Lymphocytes': { unit: '%', system: 'Blood', direction: 'two_sided', ref: { low: 20, high: 45 } },
  'Monocytes': { unit: '%', system: 'Blood', direction: 'two_sided', ref: { low: 2, high: 10 } },
  'Eosinophils': { unit: '%', system: 'Blood', direction: 'high_bad', ref: { high: 6 } },
  'Basophils': { unit: '%', system: 'Blood', direction: 'high_bad', ref: { high: 2 } },
  'Platelets': { unit: '10^9/L', system: 'Blood', direction: 'two_sided',
    ref: { low: 150, high: 400 }, critical: { low: 50, high: 1000 } },
  'NLR': { unit: 'ratio', system: 'Blood', direction: 'high_bad', ref: { high: 3 }, optimal: { high: 2 },
    crossLinks: ['stress', 'illness'], note: 'Neutrophil-to-lymphocyte ratio — a general inflammation/stress marker.' },

  // ── Inflammation & Iron Profile → Inflammation & Iron ────────────────────
  'hs-CRP': { unit: 'mg/L', system: 'Inflammation & Iron', direction: 'high_bad',
    ref: { high: 3 }, optimal: { high: 1 }, critical: { high: 10 },
    crossLinks: ['stress', 'sleep', 'nutrition', 'metabolic', 'central_adiposity'],
    note: '<1 low / 1–3 average / >3 high cardiovascular risk; >10 suggests acute inflammation — interpret the cause.' },
  'ESR': { unit: 'mm/hr', system: 'Inflammation & Iron', direction: 'high_bad', ref: esrUpper, crossLinks: ['illness'] },
  'Ferritin': { unit: 'ng/mL', system: 'Inflammation & Iron', direction: 'two_sided',
    ref: { male: { low: 30, high: 400 }, female: { low: 15, high: 200 } },
    crossLinks: ['fatigue', 'hair_loss', 'cognition', 'activity'],
    note: 'Acute-phase reactant — read alongside hs-CRP. If hs-CRP is elevated, a normal-looking ferritin can mask iron deficiency.' },
  'Serum Iron': { unit: 'µg/dL', system: 'Inflammation & Iron', direction: 'two_sided', ref: { low: 60, high: 170 } },
  'TIBC': { unit: 'µg/dL', system: 'Inflammation & Iron', direction: 'two_sided', ref: { low: 240, high: 450 },
    note: 'High TIBC with low ferritin/iron supports iron deficiency.' },
  'Transferrin Saturation': { unit: '%', system: 'Inflammation & Iron', direction: 'two_sided',
    ref: { low: 20, high: 50 }, crossLinks: ['fatigue'],
    note: '<20% supports iron deficiency; >50% suggests iron overload. Derived = Serum Iron / TIBC × 100.' },

  // ── Vitamins & Minerals ───────────────────────────────────────────────────
  'Vitamin D (25-OH)': { unit: 'ng/mL', system: 'Vitamins & Minerals', direction: 'low_bad',
    ref: { low: 30 }, optimal: { low: 40, high: 60 }, critical: { low: 10 },
    crossLinks: ['fatigue', 'wellbeing', 'cognition'],
    note: '<20 deficient, 20–30 insufficient, ≥30 sufficient. Deficiency is highly prevalent in South-Asian populations.' },
  'Folate (B9)': { unit: 'ng/mL', system: 'Vitamins & Minerals', direction: 'low_bad', ref: { low: 4 }, crossLinks: ['cognition'] },
  'Vitamin B12': { unit: 'pg/mL', system: 'Vitamins & Minerals', direction: 'low_bad',
    ref: { low: 200 }, optimal: { low: 400 }, crossLinks: ['cognition', 'fatigue'],
    note: '200–300 is borderline and may still be deficient — consider MMA/homocysteine.' },
  'Magnesium': { unit: 'mg/dL', system: 'Vitamins & Minerals', direction: 'two_sided', ref: { low: 1.7, high: 2.2 },
    crossLinks: ['sleep', 'stress', 'metabolic'], note: 'Serum magnesium underestimates total-body status.' },
  'Sodium': { unit: 'mmol/L', system: 'Vitamins & Minerals', direction: 'two_sided',
    ref: { low: 135, high: 145 }, critical: { low: 125, high: 155 } },
  'Potassium': { unit: 'mmol/L', system: 'Vitamins & Minerals', direction: 'two_sided',
    ref: { low: 3.5, high: 5.1 }, critical: { low: 3.0, high: 6.0 }, referOnAbnormal: true },
  'Chloride': { unit: 'mmol/L', system: 'Vitamins & Minerals', direction: 'two_sided', ref: { low: 98, high: 107 } },
  'Bicarbonate': { unit: 'mmol/L', system: 'Vitamins & Minerals', direction: 'two_sided', ref: { low: 22, high: 29 } },
  'Calcium': { unit: 'mg/dL', system: 'Vitamins & Minerals', direction: 'two_sided',
    ref: { low: 8.5, high: 10.5 }, critical: { low: 7, high: 12 },
    note: 'Correct for albumin where possible.' },

  // ── Liver Function → Liver ────────────────────────────────────────────────
  'ALT': { unit: 'U/L', system: 'Liver', direction: 'high_bad',
    ref: { male: { high: 41 }, female: { high: 33 } }, critical: { high: 200 },
    crossLinks: ['metabolic', 'central_adiposity'] },
  'AST': { unit: 'U/L', system: 'Liver', direction: 'high_bad', ref: { high: 40 }, critical: { high: 200 } },
  'GGT': { unit: 'U/L', system: 'Liver', direction: 'high_bad',
    ref: { male: { high: 60 }, female: { high: 40 } }, crossLinks: ['alcohol', 'metabolic'],
    note: 'Sensitive to alcohol — corroborates the AUDIT-C risk flag.' },
  'ALP': { unit: 'U/L', system: 'Liver', direction: 'two_sided', ref: { low: 40, high: 130 } },
  'Bilirubin': { unit: 'mg/dL', system: 'Liver', direction: 'high_bad', ref: { high: 1.2 },
    note: 'Mild isolated elevation is often benign (e.g., Gilbert’s syndrome).' },
  'Total Protein': { unit: 'g/dL', system: 'Liver', direction: 'two_sided', ref: { low: 6.0, high: 8.3 } },
  'Albumin': { unit: 'g/dL', system: 'Liver', direction: 'low_bad', ref: { low: 3.5, high: 5.0 } },
  'Globulin': { unit: 'g/dL', system: 'Liver', direction: 'two_sided', ref: { low: 2.0, high: 3.5 } },
  'Fatty Liver Index': { unit: 'score', system: 'Liver', direction: 'high_bad',
    ref: { high: 60 }, optimal: { high: 30 }, crossLinks: ['central_adiposity', 'metabolic', 'nutrition'],
    note: '<30 rules out, ≥60 rules in hepatic steatosis.' },

  // ── Kidney Function → Kidney ──────────────────────────────────────────────
  'Creatinine': { unit: 'mg/dL', system: 'Kidney', direction: 'high_bad',
    ref: { male: { high: 1.3, low: 0.7 }, female: { high: 1.1, low: 0.6 } }, critical: { high: 2.0 } },
  'eGFR': { unit: 'mL/min/1.73m²', system: 'Kidney', direction: 'low_bad',
    ref: { low: 90 }, critical: { low: 30 },
    note: 'Use the 2021 race-free CKD-EPI equation — do NOT apply an ethnicity coefficient here. <60 persistent suggests CKD.' },
  'BUN/Urea': { unit: 'mg/dL', system: 'Kidney', direction: 'two_sided', ref: { low: 7, high: 20 },
    note: 'Range assumes BUN. If your lab reports Urea, the range is ≈15–40 mg/dL — confirm which the OCR captures.' },
  // Urinalysis (qualitative)
  'Colour & Transparency': { unit: '', system: 'Kidney', direction: 'qualitative',
    normalValues: ['pale', 'straw', 'yellow', 'clear'], abnormalValues: ['cloudy', 'turbid', 'red', 'brown'] },
  'Protein': { unit: '', system: 'Kidney', direction: 'qualitative',
    normalValues: ['nil', 'negative', 'absent'], abnormalValues: ['trace', '1+', '2+', '3+', 'present'], referOnAbnormal: true,
    note: 'Proteinuria warrants clinical follow-up.' },
  'Glucose': { unit: '', system: 'Kidney', direction: 'qualitative',
    normalValues: ['nil', 'negative', 'absent'], abnormalValues: ['1+', '2+', '3+', 'present'],
    crossLinks: ['metabolic'], note: 'Glycosuria → check fasting glucose / HbA1c.' },
  'Ketones': { unit: '', system: 'Kidney', direction: 'qualitative',
    normalValues: ['nil', 'negative', 'absent'], abnormalValues: ['trace', '1+', '2+', 'present'],
    crossLinks: ['metabolic'] },
  'pH': { unit: '', system: 'Kidney', direction: 'two_sided', ref: { low: 4.5, high: 8.0 } },
  'RBC': { unit: '/hpf', system: 'Kidney', direction: 'high_bad', ref: { high: 2 }, referOnAbnormal: true,
    note: 'Haematuria warrants clinical follow-up.' },
  'Pus Cells': { unit: '/hpf', system: 'Kidney', direction: 'high_bad', ref: { high: 5 }, crossLinks: ['illness'],
    note: 'Elevated pus cells / bacteria suggest possible UTI.' },
  'Epithelial Cells': { unit: '/hpf', system: 'Kidney', direction: 'high_bad', ref: { high: 15 } },
  'Casts': { unit: '', system: 'Kidney', direction: 'qualitative',
    normalValues: ['nil', 'absent', 'occasional hyaline', 'none'], abnormalValues: ['cellular', 'granular', 'rbc', 'wbc'], referOnAbnormal: true },
  'Crystals': { unit: '', system: 'Kidney', direction: 'qualitative',
    normalValues: ['nil', 'absent', 'none', 'few'], abnormalValues: [] },
  'Bacteria': { unit: '', system: 'Kidney', direction: 'qualitative',
    normalValues: ['nil', 'absent', 'none'], abnormalValues: ['present', 'numerous', 'many'], crossLinks: ['illness'] },

  // ── Metabolic → Metabolic ─────────────────────────────────────────────────
  'Fasting Glucose': { unit: 'mg/dL', system: 'Metabolic', direction: 'high_bad',
    ref: { high: 99, low: 70 }, optimal: { high: 90 }, critical: { high: 250, low: 54 },
    crossLinks: ['afternoon', 'nutrition', 'central_adiposity'],
    note: '100–125 = prediabetes range; ≥126 = diabetes range (refer).' },
  'Fasting Insulin': { unit: 'µIU/mL', system: 'Metabolic', direction: 'high_bad',
    ref: { high: 25 }, optimal: { high: 8 }, crossLinks: ['central_adiposity', 'metabolic'] },
  'HOMA-IR': { unit: 'index', system: 'Metabolic', direction: 'high_bad',
    ref: { high: 2.0 }, optimal: { high: 1.0 }, crossLinks: ['central_adiposity', 'nutrition', 'activity'],
    note: 'Insulin-resistance index, computed = Fasting Glucose (mg/dL) × Fasting Insulin (µU/mL) / 405. >2 suggests resistance; >2.9 is marked.' },
  'HbA1c': { unit: '%', system: 'Metabolic', direction: 'high_bad',
    ref: { high: 5.6 }, optimal: { high: 5.4 }, critical: { high: 9.0 },
    crossLinks: ['afternoon', 'central_adiposity', 'nutrition'],
    note: '5.7–6.4 = prediabetes range; ≥6.5 = diabetes range (refer).' },

  // ── Lipids & Cardiac → Heart & Lipids ────────────────────────────────────
  'Total Cholesterol': { unit: 'mg/dL', system: 'Heart & Lipids', direction: 'high_bad', ref: { high: 200 } },
  'HDL': { unit: 'mg/dL', system: 'Heart & Lipids', direction: 'low_bad',
    ref: { male: { low: 40 }, female: { low: 50 } }, crossLinks: ['activity'] },
  'LDL': { unit: 'mg/dL', system: 'Heart & Lipids', direction: 'high_bad',
    ref: { high: 130 }, optimal: { high: 100 }, critical: { high: 190 },
    note: '≥190 raises the question of familial hypercholesterolaemia (refer).' },
  'Triglycerides': { unit: 'mg/dL', system: 'Heart & Lipids', direction: 'high_bad',
    ref: { high: 150 }, critical: { high: 500 }, crossLinks: ['central_adiposity', 'metabolic'],
    note: '≥500 carries pancreatitis risk (refer).' },
  'Non-HDL': { unit: 'mg/dL', system: 'Heart & Lipids', direction: 'high_bad', ref: { high: 160 }, optimal: { high: 130 } },
  'TC/HDL Ratio': { unit: 'ratio', system: 'Heart & Lipids', direction: 'high_bad', ref: { high: 5 }, optimal: { high: 3.5 } },
  'TG/HDL Ratio': { unit: 'ratio', system: 'Heart & Lipids', direction: 'high_bad', ref: { high: 3 }, optimal: { high: 2 },
    crossLinks: ['metabolic', 'central_adiposity'], note: 'A practical insulin-resistance proxy.' },
  'ApoB': { unit: 'mg/dL', system: 'Heart & Lipids', direction: 'high_bad', ref: { high: 130 }, optimal: { high: 90 },
    note: 'Arguably a better cardiovascular risk marker than LDL.' },
  'Lp(a)': { unit: 'nmol/L', system: 'Heart & Lipids', direction: 'high_bad', ref: { high: 75 },
    note: 'Largely genetic; a once-in-a-lifetime measurement. Units vary (nmol/L vs mg/dL) — confirm.' },

  // ── Thyroid → Thyroid ─────────────────────────────────────────────────────
  'TSH': { unit: 'mIU/L', system: 'Thyroid', direction: 'two_sided',
    ref: { low: 0.4, high: 4.0 }, optimal: { low: 0.5, high: 2.5 }, critical: { high: 10 },
    crossLinks: ['fatigue', 'cognition', 'hair_loss', 'cold', 'wellbeing'],
    note: '4–10 with normal FT4 = subclinical hypothyroidism (monitor).' },
  'FT3': { unit: 'pg/mL', system: 'Thyroid', direction: 'two_sided', ref: { low: 2.3, high: 4.2 } },
  'FT4': { unit: 'ng/dL', system: 'Thyroid', direction: 'two_sided', ref: { low: 0.8, high: 1.8 } },

  // ── Hormones → Hormones ───────────────────────────────────────────────────
  'Morning Cortisol': { unit: 'µg/dL', system: 'Hormones', direction: 'two_sided', ref: { low: 6, high: 18 },
    crossLinks: ['stress'], note: 'A single morning value is a screen only — diurnal pattern (or cortisol:DHEA) is more informative.' },
  'DHEA-S': { unit: 'µg/dL', system: 'Hormones', direction: 'two_sided',
    ref: (ctx) => {
      // Declines with age; broad sex/age bands.
      const a = ctx.age ?? 40
      if (ctx.sex === 'female') return a < 40 ? { low: 65, high: 380 } : { low: 30, high: 200 }
      return a < 40 ? { low: 110, high: 510 } : { low: 70, high: 310 }
    }, crossLinks: ['stress', 'wellbeing'] },
  'SHBG': { unit: 'nmol/L', system: 'Hormones', direction: 'context',
    ref: { male: { low: 18, high: 54 }, female: { low: 30, high: 90 } },
    note: 'Interpret with testosterone to gauge free hormone.' },
  'Total Testosterone (men)': { unit: 'ng/dL', system: 'Hormones', direction: 'low_bad', ref: { low: 300, high: 1000 },
    crossLinks: ['low_libido', 'fatigue', 'mood', 'activity'], note: 'Measure morning, fasting.' },
  'Free Testosterone (men)': { unit: 'pg/mL', system: 'Hormones', direction: 'low_bad', ref: { low: 9, high: 30 },
    crossLinks: ['low_libido', 'fatigue'] },
  'Estradiol (women)': { unit: 'pg/mL', system: 'Hormones', direction: 'context',
    crossLinks: ['low_libido', 'wellbeing'],
    note: 'Highly dependent on menstrual-cycle phase / menopausal status — uninterpretable without that context.' },
  'FSH (women)': { unit: 'mIU/mL', system: 'Hormones', direction: 'context',
    note: 'Phase/menopause dependent; elevated in the menopausal transition.' },
  'LH (women)': { unit: 'mIU/mL', system: 'Hormones', direction: 'context',
    note: 'Phase dependent; interpret with FSH and cycle context.' },
}
